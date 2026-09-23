import { Job } from 'bullmq';
import { OrderJobPayload } from '@/lib/queue-manager';
import { OrderPreflightGuard } from './order/order-preflight-guard';
import { OrderRouteEvaluator } from './order/order-route-evaluator';
import { OrderDispatchExecutor } from './order/order-dispatch-executor';

export { DatabaseOrderError } from './order/types';

export default async function orderProcessor(job: Job<OrderJobPayload>) {
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
}
