import { UnrecoverableError } from 'bullmq';
import { db } from '../../../lib/db';
import { getRedisConnection } from '@/lib/queue-manager';
import type { DispatchLoopContext } from './types';

export class OrderAllRoutesFailedHandler {
  static async handle(
    ctx: DispatchLoopContext,
    marginRejectionCount: number,
    lastMarginError: string,
    lastError: string
  ): Promise<never> {
    const { order, candidateRoutes, redisKey } = ctx;
    const connection = getRedisConnection();

    if (marginRejectionCount > 0 && marginRejectionCount === candidateRoutes.length) {
      const holdMessage = `PRICE_DRIFT_HOLD: ${lastMarginError || 'Себестоимость поставщика превышает оплату клиента.'}`;
      await db.order.update({ where: { id: order.id }, data: { status: 'PENDING_CHECK', error: holdMessage } });
      await connection.del(redisKey).catch(() => {});
      throw new UnrecoverableError(`Price Drift Hold: ${holdMessage}`);
    }

    try {
      const { QuarantineService } = await import('../../../services/providers/quarantine.service');
      await QuarantineService.evaluateTriggerA(order.serviceId, lastError);
    } catch { /* ignore */ }

    const { OrderTriageAlertService } = await import('@/services/orders/order-triage-alert.service');
    const classification = OrderTriageAlertService.classifyError(lastError);
    const formattedError = OrderTriageAlertService.formatOrderErrorMessage(classification, lastError, candidateRoutes[0]?.provider?.name);

    await db.order.update({
      where: { id: order.id },
      data: {
        status: 'PENDING_CHECK',
        providerId: candidateRoutes[0]?.providerId || order.providerId,
        providerServiceId: candidateRoutes[0]?.providerServiceId || order.providerServiceId,
        error: formattedError
      }
    });

    await connection.del(redisKey).catch(() => {});
    throw new UnrecoverableError(`Order moved to PENDING_CHECK: ${lastError}`);
  }
}
