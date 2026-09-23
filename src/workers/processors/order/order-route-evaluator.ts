// tenant-isolation-ignore: Background worker executed within order.processor runWithTenant wrapper
import { UnrecoverableError } from 'bullmq';
import { db } from '../../../lib/db';
import { logger } from '../../../lib/logger';
import { SmartRoutingService, MarginGuard, PrioritizedRoute } from '../../../services/providers/smart-routing.service';
import type { OrderWithRelations, RouteCapabilityCheckResult } from './types';

const log = logger.child({ component: 'OrderRouteEvaluator' });

export class OrderRouteEvaluator {
  static async resolveRoutes(order: OrderWithRelations): Promise<PrioritizedRoute[]> {
    let candidateRoutes: PrioritizedRoute[] = [];
    try {
      candidateRoutes = await SmartRoutingService.getPrioritizedRoutes(order.serviceId);
    } catch (routeErr) {
      log.warn(`[OrderProcessor] Failed to query prioritized routes, falling back to service provider`, { routeErr });
    }

    if (candidateRoutes.length === 0 && order.service?.provider) {
      candidateRoutes = [
        {
          id: 'fallback_primary',
          serviceId: order.serviceId,
          providerId: order.service.provider.id,
          providerServiceId: order.providerServiceId || order.service.externalId || '',
          isPrimary: true,
          isActive: true,
          priority: 0,
          failoverMode: 'manual',
          provider: order.service.provider,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      ];
    }

    if (candidateRoutes.length === 0) {
      const noRoutesMsg = 'Нет доступных активных маршрутов или провайдеров для выполнения заказа.';
      log.warn(`[OrderProcessor] Order ${order.id}: ${noRoutesMsg}`);
      try {
        const { QuarantineService } = await import('../../../services/providers/quarantine.service');
        await QuarantineService.evaluateTriggerA(order.serviceId, noRoutesMsg);
      } catch { /* ignore */ }

      await db.order.update({
        where: { id: order.id },
        data: {
          status: 'PENDING_CHECK',
          error: `[NO_ACTIVE_PROVIDER] ${noRoutesMsg} Заказ ожидает назначения поставщика оператором.`
        }
      });

      try {
        const { OrderTriageAlertService } = await import('@/services/orders/order-triage-alert.service');
        await OrderTriageAlertService.sendOrderCheckAlert({
          orderId: order.id,
          numericId: order.numericId,
          serviceName: order.service?.name || '',
          categoryName: order.service?.category?.name,
          networkName: order.service?.category?.network?.name,
          link: order.link,
          quantity: order.quantity,
          chargeKopecks: order.charge,
          userEmail: order.user?.email,
          tenantId: order.tenantId,
          providerName: 'Не назначен',
        }, noRoutesMsg, 'Не назначен');
      } catch { /* ignore */ }

      throw new UnrecoverableError(`No active routes: ${noRoutesMsg}`);
    }

    return candidateRoutes;
  }

  static async verifyRouteCapabilitiesAndMargin(
    order: OrderWithRelations,
    route: PrioritizedRoute,
    primaryProviderId: string
  ): Promise<RouteCapabilityCheckResult> {
    if (!route.provider?.apiUrl || !route.provider?.apiKey) {
      return {
        isCompatible: false,
        reason: `Провайдер ${route.provider?.name || route.providerId} не имеет валидного API URL или ключа`
      };
    }

    let shadowSvc = null;
    try {
      if (db.shadowService) {
        shadowSvc = await db.shadowService.findUnique({
          where: {
            providerId_externalId: {
              providerId: route.providerId,
              externalId: String(route.providerServiceId)
            }
          }
        });
      }
    } catch {
      shadowSvc = null;
    }

    // Drip-Feed Capability
    if (order.isDripFeed) {
      const supportsDrip = shadowSvc ? shadowSvc.dripfeed : (route.providerId === order.service?.providerId ? order.service.isDripFeedEnabled : true);
      if (!supportsDrip) {
        return { isCompatible: false, reason: `Маршрут ${route.provider.name} не поддерживает Drip-Feed` };
      }
    }

    // CustomData Capability
    if (order.customData) {
      const customType = shadowSvc ? shadowSvc.customDataType : (route.providerId === order.service?.providerId ? order.service.customDataType : 'NONE');
      if (customType === 'NONE' && shadowSvc) {
        return { isCompatible: false, reason: `Маршрут ${route.provider.name} не поддерживает customData` };
      }
    }

    // MarginGuard check with 5% currency volatility buffer
    const providerRate = shadowSvc?.rate ?? (route.providerId === order.service?.providerId ? order.service.rate : 0);
    const providerCurrency = route.provider.balanceCurrency || (route.providerId === order.service?.providerId ? order.service.providerCurrency : 'USD');

    if (providerRate > 0 && order.charge && order.charge > BigInt(0)) {
      const marginCheck = await MarginGuard.checkMargin(
        order.charge,
        order.quantity,
        providerRate,
        providerCurrency,
        0.05
      );

      if (!marginCheck.isProfitable) {
        const errorReason = marginCheck.reason || 'Маржа маршрута отрицательна с учетом буфера 5%';
        log.warn(`[OrderProcessor] Margin rejected for route ${route.provider.name}: ${errorReason}`);
        await SmartRoutingService.recordFailoverEvent({
          serviceId: order.serviceId,
          action: 'MARGIN_REJECTED',
          fromProviderId: primaryProviderId,
          toProviderId: route.providerId,
          reason: errorReason
        });
        return { isCompatible: false, reason: errorReason, isMarginError: true };
      }
    }

    return { isCompatible: true };
  }
}
