import { db } from '../../lib/db';
import { WalletOps } from './wallet-ops';
import { WalletService } from './wallet.service';
import { calculatePartialRefund } from '@/utils/refund';
import { Prisma } from '@prisma/client';
import { LoyaltyService } from '../users/loyalty.service';

export class RefundPolicyService {
  /**
   * Processes an automated refund based on strict mathematical rules (Cents).
   * Supports PARTIAL, CANCELED, and ERROR statuses.
   */
  static async processRefund(
    order: { id: string, userId: string, charge: number, quantity: number, remains: number, status: string, tenantId?: string },
    reasonDetail: string = '',
    txClient: Prisma.TransactionClient = db
  ) {
    if (['COMPLETED', 'PENDING', 'IN_PROGRESS', 'AWAITING_PAYMENT'].includes(order.status)) {
      return null;
    }

    // Process referral commission adjustments
    try {
      if (order.status === 'CANCELED' || order.status === 'ERROR') {
        await LoyaltyService.reverseCommission(txClient, order.id);
      } else if (order.status === 'PARTIAL') {
        await LoyaltyService.handlePartialCommission(txClient, order.id, order.remains, order.quantity);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[RefundPolicyService] Failed to process referral commission for order ${order.id}:`, errMsg);
    }

    let refundCents = 0;
    let reason = `Возврат Заказ #${order.id}`;

    if (order.status === 'CANCELED' || order.status === 'ERROR') {
      // 100% Full Refund MINUS any previous partial refunds
      let previousRefunds = 0;
      const partialRefundLedger = await txClient.ledgerEntry.findFirst({
        where: {
          idempotencyKey: `refund_${order.id}_PARTIAL`,
          ...(order.tenantId ? { tenantId: order.tenantId } : {})
        }
      });
      if (partialRefundLedger) {
        previousRefunds += Number(partialRefundLedger.amount);
      }
      
      refundCents = Math.max(0, order.charge - previousRefunds);
      reason = `Полный возврат (${order.status}) Заказ #${order.id} ${reasonDetail}`.trim();
    } else if (order.status === 'PARTIAL') {
      // Proportional mathematical partial refund via ARCHITECTURE CONTRACT
      refundCents = calculatePartialRefund(order);
      reason = `Частичный возврат (Partial, ${order.remains} не выполнено) Заказ #${order.id}`.trim();
    }

    if (refundCents > 0) {
      // Generates a unique deduplication key for this refund operation
      const idempotencyKey = `refund_${order.id}_${order.status}`;
      if (txClient === db) {
        return await WalletService.refund(order.userId, refundCents, reason, idempotencyKey, undefined, order.tenantId);
      } else {
        return await WalletOps.refund(txClient, order.userId, refundCents, reason, { idempotencyKey, tenantId: order.tenantId });
      }
    }

    return null;
  }
}

