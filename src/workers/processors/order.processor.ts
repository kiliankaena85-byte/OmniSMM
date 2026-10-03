import { Job } from 'bullmq';
import { OrderJobPayload } from '@/lib/queue-manager';
import { OrderPreflightGuard } from './order/order-preflight-guard';
import { OrderRouteEvaluator } from './order/order-route-evaluator';
import { OrderDispatchExecutor } from './order/order-dispatch-executor';
import { InHouseOrderDispatcher } from './order/in-house-order-dispatcher';
import { runWithTenant, runWithTenantBypass } from '@/lib/tenant-context';
import { registerValidTenant } from '@/lib/tenant-resolver-edge';
import { db } from '@/lib/db';
import { withTelemetryContext, generateTraceId } from '@/lib/logger';

export { DatabaseOrderError } from './order/types';

export default async function orderProcessor(job: Job<OrderJobPayload>) {
  let tenantId = job.data?.tenantId;

  // Server-side tenantId recovery: only query DB if tenantId is not present in job data
  if (!tenantId && job.data?.orderId) {
    const orderRecord = await runWithTenantBypass('BullMQ orderProcessor resolve tenantId', async () => {
      // tenant-isolation-ignore: Fallback tenantId recovery for background job with missing tenant context
      return await db.order.findUnique({
        where: { id: job.data.orderId },
        select: { tenantId: true }
      });
    });

    if (orderRecord?.tenantId) {
      tenantId = orderRecord.tenantId;
    }
  }

  // Fallback to 'smmplan' for backward compatibility
  const resolvedTenantId = tenantId || 'smmplan';
  registerValidTenant(resolvedTenantId);
  if (job.data) {
    job.data.tenantId = resolvedTenantId;
  }
  
  const traceId = job.data?.metadata?.traceId || generateTraceId();

  return await withTelemetryContext({ traceId, tenantId: resolvedTenantId, component: 'OrderProcessor' }, async () => {
    return await runWithTenant(resolvedTenantId, async () => {
      const { order, redisKey, lockHeld } = await OrderPreflightGuard.validateAndFetchOrder(job);
      if (lockHeld) {
        throw new Error(`[OrderProcessor] Order ${job.data?.orderId} is currently locked by another concurrent process. Retrying via BullMQ backoff.`);
      }
      if (!order) return;

      // 1. Приоритетное исполнение собственными мощностями (Tier-0 In-House Engine: Telegram / HLS Stream)
      const inHouseResult = await InHouseOrderDispatcher.tryDispatchInHouse(order, redisKey);
      if (inHouseResult.handled && inHouseResult.success) {
        return;
      }

      // 2. Внешняя каскадная маршрутизация (если услуга внешняя или все внутренние слоты заняты)
      const candidateRoutes = await OrderRouteEvaluator.resolveRoutes(order);
      const primaryProviderId = candidateRoutes.find(r => r.isPrimary)?.providerId || candidateRoutes[0]?.providerId;

      await OrderDispatchExecutor.executeDispatchLoop({
        order,
        candidateRoutes,
        primaryProviderId,
        redisKey,
      });
    });
  });
}
