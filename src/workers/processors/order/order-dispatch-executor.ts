import { UnrecoverableError } from 'bullmq';
import { db } from '../../../lib/db';
import { getRedisConnection } from '@/lib/queue-manager';
import { logger } from '../../../lib/logger';
import { providerService } from '../../../services/providers/provider.service';
import { SmartRoutingService, PrioritizedRoute } from '../../../services/providers/smart-routing.service';
import { OrderRouteEvaluator } from './order-route-evaluator';
import { OrderAllRoutesFailedHandler } from './order-all-routes-failed-handler';
import { DatabaseOrderError, DispatchLoopContext } from './types';

const log = logger.child({ component: 'OrderDispatchExecutor' });

export class OrderDispatchExecutor {
  static async executeDispatchLoop(ctx: DispatchLoopContext): Promise<void> {
    const { order, candidateRoutes, primaryProviderId, redisKey } = ctx;
    const connection = getRedisConnection();

    let dispatched = false;
    let lastError = '';
    let marginRejectionCount = 0;
    let lastMarginError = '';

    for (let i = 0; i < candidateRoutes.length; i++) {
      const route = candidateRoutes[i];
      const nextRoute = candidateRoutes[i + 1];

      const check = await OrderRouteEvaluator.verifyRouteCapabilitiesAndMargin(order, route, primaryProviderId);
      if (!check.isCompatible) {
        lastError = check.reason || '';
        if (check.isMarginError) {
          marginRejectionCount++;
          lastMarginError = lastError;
        }
        continue;
      }

      try {
        const provider = await providerService.getWorkerProviderInstance(route.provider as unknown as import('@prisma/client').Provider);
        const runQty = (order.isDripFeed && order.runs && order.runs > 0)
          ? Math.max(1, Math.floor(order.quantity / order.runs))
          : order.quantity;

        const serviceName = order.service?.name?.toLowerCase() || '';
        const payload: Record<string, unknown> = {
          service: route.providerServiceId,
          link: order.link,
          quantity: runQty,
          ref: order.id,
          custom_id: order.id
        };

        if (order.isDripFeed && order.runs && order.interval) {
          payload.runs = order.runs;
          payload.interval = order.interval;
        }

        if (order.customData) {
          const cType = order.service?.customDataType;
          if (cType === 'NUMBER' || (serviceName.includes('опрос') && !serviceName.includes('просмотр')) || serviceName.includes('голосование') || serviceName.includes('poll')) {
            payload.answers_number = order.customData;
          } else {
            payload.comments = order.customData;
          }
        }

        await connection.set(redisKey, '1', 'EX', 3600);

        const { AdaptiveRateLimiterService } = await import('../../../services/providers/adaptive-rate-limiter.service');
        await AdaptiveRateLimiterService.acquireToken(route.providerId);

        const response = await provider.createOrder(payload as Parameters<typeof provider.createOrder>[0]);

        if (response.error && !response.order) {
          throw new Error(response.error);
        }

        const extId = response.order ? response.order.toString() : '';

        try {
          await db.order.update({
            where: { id: order.id },
            data: {
              externalId: extId,
              providerId: route.providerId,
              providerServiceId: route.providerServiceId,
              status: 'IN_PROGRESS'
            }
          });
        } catch (dbError) {
          throw new DatabaseOrderError(dbError instanceof Error ? dbError.message : String(dbError));
        }

        if (route.providerId !== primaryProviderId) {
          await SmartRoutingService.recordFailoverEvent({
            serviceId: order.serviceId,
            action: 'FAILOVER_SWAP',
            fromProviderId: primaryProviderId,
            toProviderId: route.providerId,
            reason: `Failover to ${route.provider.name} succeeded. Previous error: ${lastError}`
          });
        }

        log.info(`[OrderProcessor] Dispatched Order ${order.id} | Provider: ${route.provider.name} | External ID: ${extId}`);
        dispatched = true;
        break;

      } catch (error: unknown) {
        if (error instanceof DatabaseOrderError || (typeof error === 'object' && error !== null && 'isDatabaseError' in error)) {
          throw error;
        }

        const errMsg = (error instanceof Error ? error.message : String(error)).toLowerCase();
        const isTimeout = errMsg.includes('timeout') || errMsg.includes('etimedout') || errMsg.includes('econnreset') || errMsg.includes('socket hang up') || errMsg.includes('eai_again');

        if (isTimeout) {
          await db.order.update({
            where: { id: order.id },
            data: { status: 'PENDING_CHECK', error: `Сетевой таймаут при отправке: ${error instanceof Error ? error.message : String(error)}` }
          });
          try {
            const { sendAdminAlert } = await import('@/lib/notifications');
            sendAdminAlert(
              `⚠️ [ТАЙМАУТ СВЯЗИ С ПОСТАВЩИКОМ] Заказ #${order.numericId} (Услуга: ${order.service?.name || ''})\n` +
              `Поставщик ${route.provider.name} не ответил вовремя. Заказ переведён в статус PENDING_CHECK.`,
              'WARNING'
            );
          } catch { /* ignore */ }
          throw new UnrecoverableError(`Ambiguous Timeout: ${error instanceof Error ? error.message : String(error)}`);
        }

        const originalError = error instanceof Error ? error.message : String(error);
        lastError = originalError;

        if (route.failoverMode !== 'automatic') {
          const { OrderTriageAlertService } = await import('@/services/orders/order-triage-alert.service');
          const classification = OrderTriageAlertService.classifyError(originalError);
          const formattedError = OrderTriageAlertService.formatOrderErrorMessage(classification, originalError, route.provider.name);

          await db.order.update({
            where: { id: order.id },
            data: { status: 'PENDING_CHECK', providerId: route.providerId, providerServiceId: route.providerServiceId, error: formattedError }
          });

          try {
            await OrderTriageAlertService.sendOrderCheckAlert({
              orderId: order.id, numericId: order.numericId, serviceName: order.service?.name || '',
              categoryName: order.service?.category?.name, networkName: order.service?.category?.network?.name,
              link: order.link, quantity: order.quantity, chargeKopecks: order.charge,
              userEmail: order.user?.email, tenantId: order.tenantId, providerName: route.provider.name,
            }, originalError, route.provider.name);
          } catch { /* ignore */ }

          await connection.del(redisKey).catch(() => {});
          throw new UnrecoverableError(`Manual failover mode: operator triage required`);
        }

        if (nextRoute) {
          await SmartRoutingService.recordFailoverEvent({
            serviceId: order.serviceId, action: 'FAILOVER_SWAP', fromProviderId: route.providerId,
            toProviderId: nextRoute.providerId, reason: `Provider ${route.provider.name} failed: ${originalError}. Cascading.`
          });
        }
      }
    }

    if (!dispatched) {
      await OrderAllRoutesFailedHandler.handle(ctx, marginRejectionCount, lastMarginError, lastError);
    }
  }
}
