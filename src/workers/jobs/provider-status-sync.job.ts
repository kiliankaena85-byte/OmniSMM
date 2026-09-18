/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Provider Status Sync Job (Lost in Space Order Polling).
 */

import { db } from '@/lib/db';
import { CircuitBreaker } from '@/lib/resilience/circuit-breaker';
import { ProviderService } from '@/services/providers/provider.service';
import { RefundPolicyService } from '@/services/financial/refund-policy.service';

export class ProviderStatusSyncJob {
  private static readonly providerService = new ProviderService();

  /**
   * Polls stuck orders in IN_PROGRESS or CANCELING state older than 10 minutes.
   */
  static async syncStuckOrders(): Promise<{ synced: number; skipped: number; errors: number }> {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const stuckOrders = await db.order.findMany({
      where: {
        status: { in: ['IN_PROGRESS', 'CANCELING'] },
        externalId: { not: null },
        updatedAt: { lte: tenMinutesAgo },
      },
      include: {
        provider: true,
      },
      take: 50,
    });

    let synced = 0;
    let skipped = 0;
    let errors = 0;

    for (const order of stuckOrders) {
      const provider = order.provider;
      if (!provider || !provider.isActive || !order.externalId) {
        skipped++;
        continue;
      }

      // Check Circuit Breaker before calling
      const circuit = await CircuitBreaker.getStatus(provider.id);
      if (circuit.state === 'OPEN') {
        skipped++;
        continue;
      }

      try {
        await CircuitBreaker.execute(provider.id, provider.name, async () => {
          const instance = await this.providerService.getProviderInstance(provider);
          const statusResult = await instance.getOrderStatus(order.externalId!);

          if (statusResult && statusResult.status) {
            const raw = statusResult.status.toLowerCase();
            const targetStatus = raw === 'completed' ? 'COMPLETED' : raw === 'canceled' ? 'CANCELED' : raw === 'partial' ? 'PARTIAL' : null;

            if (targetStatus && targetStatus !== order.status) {
              await db.$transaction(async (tx) => {
                await tx.order.update({
                  where: { id: order.id },
                  data: { status: targetStatus },
                });

                if (targetStatus === 'CANCELED') {
                  await RefundPolicyService.processRefund(
                    {
                      id: order.id,
                      userId: order.userId,
                      charge: Number(order.charge),
                      quantity: order.quantity,
                      remains: order.quantity,
                      status: 'CANCELED',
                      tenantId: order.tenantId,
                    },
                    'Авто-возврат: провайдер подтвердил отмену заказа (фоновая сверка)',
                    tx
                  );
                } else if (targetStatus === 'PARTIAL') {
                  const remainsNum = statusResult.remains !== undefined ? parseInt(String(statusResult.remains), 10) : 0;
                  const safeRemains = Math.min(order.quantity, Math.max(0, isNaN(remainsNum) ? 0 : remainsNum));
                  await RefundPolicyService.processRefund(
                    {
                      id: order.id,
                      userId: order.userId,
                      charge: Number(order.charge),
                      quantity: order.quantity,
                      remains: safeRemains,
                      status: 'PARTIAL',
                      tenantId: order.tenantId,
                    },
                    'Авто-возврат: частичное выполнение у провайдера (фоновая сверка)',
                    tx
                  );
                }
              });
              synced++;
            }
          }
        });
      } catch (err) {
        console.error(`[ProviderStatusSyncJob] Failed to sync order ${order.id}:`, err);
        errors++;
      }
    }

    return { synced, skipped, errors };
  }
}
