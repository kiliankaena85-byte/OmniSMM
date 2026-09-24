import { Job } from 'bullmq';
import { OrderJobPayload } from '@/lib/queue-manager';
import { OrderPreflightGuard } from './order/order-preflight-guard';
import { OrderRouteEvaluator } from './order/order-route-evaluator';
import { OrderDispatchExecutor } from './order/order-dispatch-executor';
import { runWithTenant, runWithTenantBypass } from '@/lib/tenant-context';
import { registerValidTenant } from '@/lib/tenant-resolver-edge';
import { db } from '@/lib/db';
import { withTelemetryContext, generateTraceId } from '@/lib/logger';

export { DatabaseOrderError } from './order/types';

export default async function orderProcessor(job: Job<OrderJobPayload>) {
  let tenantId = job.data?.tenantId;

  // Server-side tenantId validation: query true tenantId from DB and reject spoofed payloads
  if (job.data?.orderId) {
    const orderRecord = await runWithTenantBypass('BullMQ orderProcessor resolve tenantId', async () => {
      // tenant-isolation-ignore: Fallback tenantId recovery for background job with missing tenant context
      return await db.order.findUnique({
        where: { id: job.data.orderId },
        select: { tenantId: true }
      });
    });

    if (!orderRecord) {
      const { logger } = await import('@/lib/logger');
      logger.warn(`[OrderProcessor] Order ${job.data.orderId} not found in DB. Discarding job.`);
      return;
    }

    const trueTenantId = orderRecord.tenantId || 'smmplan';
    if (tenantId && tenantId !== trueTenantId) {
      const { logger } = await import('@/lib/logger');
      logger.warn(`[TenantSpoofGuard] Discarding job ${job.id}: Payload tenantId '${tenantId}' does not match DB owner tenantId '${trueTenantId}' for order ${job.data.orderId}.`);
      return;
    }
    tenantId = trueTenantId;
  }

  // Fallback to 'smmplan' for backward compatibility
  const resolvedTenantId = tenantId || 'smmplan';
  registerValidTenant(resolvedTenantId);
  if (job.data) {
    job.data.tenantId = resolvedTenantId;
  }
  
  const traceId = job.data?.metadata?.traceId || generateTraceId();

  return await withTelemetryContext({ traceId, tenantId: resolvedTenantId, component: 'OrderProcessor' }, async () => {
    const { order, redisKey } = await OrderPreflightGuard.validateAndFetchOrder(job);
    if (!order) return;

    const candidateRoutes = await OrderRouteEvaluator.resolveRoutes(order);
    const primaryProviderId = candidateRoutes.find(r => r.isPrimary)?.providerId || candidateRoutes[0]?.providerId;

    await OrderDispatchExecutor.executeDispatchLoop({
      order,
      candidateRoutes,
      primaryProviderId,
      redisKey,
    });
  });
}
