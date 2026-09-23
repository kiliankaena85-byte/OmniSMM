import { Job } from 'bullmq';
import { OrderJobPayload } from '@/lib/queue-manager';
import { OrderPreflightGuard } from './order/order-preflight-guard';
import { OrderRouteEvaluator } from './order/order-route-evaluator';
import { OrderDispatchExecutor } from './order/order-dispatch-executor';
import { runWithTenant, runWithTenantBypass } from '@/lib/tenant-context';
import { registerValidTenant } from '@/lib/tenant-resolver-edge';
import { db } from '@/lib/db';

export { DatabaseOrderError } from './order/types';

export default async function orderProcessor(job: Job<OrderJobPayload>) {
  let tenantId = job.data?.tenantId;

  // Fail-safe guard: if tenantId is absent or empty, query the order using runWithTenantBypass to get its true tenantId
  if (!tenantId && job.data?.orderId) {
    const orderRecord = await runWithTenantBypass('BullMQ orderProcessor resolve tenantId', async () => {
      // tenant-isolation-ignore: Fallback tenantId recovery for background job with missing tenant context
      return await db.order.findUnique({
        where: { id: job.data.orderId },
        select: { tenantId: true }
      });
    });
    tenantId = orderRecord?.tenantId;
  }

  // Fallback to 'smmplan' for backward compatibility
  const resolvedTenantId = tenantId || 'smmplan';
  registerValidTenant(resolvedTenantId);
  if (job.data && !job.data.tenantId && tenantId) {
    job.data.tenantId = tenantId;
  }
  
  return await runWithTenant(resolvedTenantId, async () => {
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
