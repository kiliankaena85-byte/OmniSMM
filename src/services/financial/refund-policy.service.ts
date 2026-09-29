import { db } from '../../lib/db';
import { runSerializableTransaction } from '../../lib/transactions';
import { WalletOps } from './wallet-ops';
import { calculatePartialRefund } from '@/utils/refund';
import { Prisma } from '@prisma/client';
import { LoyaltyService } from '../users/loyalty.service';

export class RefundPolicyService {
  /**
   * Processes an automated refund based on strict mathematical rules (Cents/BigInt).
   * Supports PARTIAL, CANCELED, and ERROR statuses.
   * Guarantees atomic transaction execution for balance refund and commission adjustments.
   */
  static async processRefund(
    order: { id: string; userId: string; charge: number | bigint; quantity: number; remains: number; status: string; tenantId?: string },
    reasonDetail: string = '',
    txClient: Prisma.TransactionClient = db
  ) {
    if (['COMPLETED', 'PENDING', 'IN_PROGRESS', 'AWAITING_PAYMENT'].includes(order.status)) {
      return null;
    }

    const executeInTx = async (tx: Prisma.TransactionClient) => {
      // 1. Process referral commission adjustments atomically
      if (order.status === 'CANCELED' || order.status === 'ERROR') {
        await LoyaltyService.reverseCommission(tx, order.id);
      } else if (order.status === 'PARTIAL') {
        await LoyaltyService.handlePartialCommission(tx, order.id, order.remains, order.quantity);
      }

      // 2. Query previous refunds atomically
      const previousRefundsAgg = await tx.ledgerEntry.aggregate({
        where: {
          userId: order.userId,
          status: 'APPROVED',
          ...(order.tenantId ? { tenantId: order.tenantId } : {}),
          OR: [
            { idempotencyKey: { startsWith: `refund_${order.id}_` } },
            { idempotencyKey: `refund-order-${order.id}` },
            { idempotencyKey: `refund-ttl-${order.id}` },
            { idempotencyKey: `refund-dlq-${order.id}` },
          ]
        },
        _sum: { amount: true },
      });

      const chargeBig = typeof order.charge === 'bigint' ? order.charge : BigInt(order.charge);
      const alreadyRefundedBig = previousRefundsAgg._sum.amount ? BigInt(previousRefundsAgg._sum.amount) : 0n;

      let refundBigInt = 0n;
      let reason = `Возврат Заказ #${order.id}`;

      if (order.status === 'CANCELED' || order.status === 'ERROR') {
        refundBigInt = chargeBig > alreadyRefundedBig ? chargeBig - alreadyRefundedBig : 0n;
        reason = `Полный возврат (${order.status}) Заказ #${order.id} ${reasonDetail}`.trim();
      } else if (order.status === 'PARTIAL') {
        const partialCalc = BigInt(calculatePartialRefund(order));
        const maxAvailable = chargeBig > alreadyRefundedBig ? chargeBig - alreadyRefundedBig : 0n;
        refundBigInt = partialCalc < maxAvailable ? partialCalc : maxAvailable;
        reason = `Частичный возврат (Partial, ${order.remains} не выполнено) Заказ #${order.id}`.trim();
      }

      if (refundBigInt > 0n) {
        const idempotencyKey = `refund_${order.id}_${order.status}`;
        return await WalletOps.refund(tx, order.userId, refundBigInt, reason, {
          idempotencyKey,
          tenantId: order.tenantId
        });
      }

      return null;
    };

    if (txClient === db) {
      return await runSerializableTransaction(async (tx) => {
        return await executeInTx(tx);
      });
    } else {
      return await executeInTx(txClient);
    }
  }
}

