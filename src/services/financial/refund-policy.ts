import { IdempotencyKeys } from './idempotency-keys';

/**
 * @file RefundPolicy - Canonical Golden Path Primitive for Refund Calculations & Over-refund Prevention.
 * @module RefundPolicy
 * 
 * JSDoc / Usage Guidelines:
 * ✅ DO THIS:
 *   const { refundAmount, idempotencyKey } = RefundPolicy.calcRefund(order, previousRefundsCents, unfulfilledQty, totalQty);
 * 
 * ❌ NEVER DO THIS (Over-refund Overcharge):
 *   const refund = order.charge; // ❌ Over-refunds when order was partially fulfilled!
 */

export interface OrderRefundInput {
  id: string;
  charge: bigint | number;
  quantity: number;
}

export interface RefundCalcResult {
  refundAmount: bigint;
  idempotencyKey: string;
  isPartial: boolean;
  unfulfilledQty: number;
}

export const RefundPolicy = {
  /**
   * Calculates safe refund amount strictly clamped to remaining order charge.
   */
  calcRefund(
    order: OrderRefundInput,
    previousRefundsCents: bigint | number = BigInt(0),
    unfulfilledQty?: number,
    statusVariant: string = 'final'
  ): RefundCalcResult {
    const totalCharge = BigInt(order.charge);
    const prevRefunds = BigInt(previousRefundsCents);
    const maxAvailableRefund = totalCharge > prevRefunds ? totalCharge - prevRefunds : BigInt(0);

    const totalQty = order.quantity > 0 ? order.quantity : 1;
    const remainingQty = typeof unfulfilledQty === 'number' ? Math.min(totalQty, Math.max(0, unfulfilledQty)) : totalQty;

    // Calculate exact refund using pure BigInt arithmetic to avoid Number float precision loss
    const remainingQtyBigInt = BigInt(remainingQty);
    const totalQtyBigInt = BigInt(totalQty);
    const rawRefundAmount = (totalCharge * remainingQtyBigInt) / totalQtyBigInt;

    // CLAMP: Never exceed maxAvailableRefund
    const finalRefundAmount = rawRefundAmount > maxAvailableRefund ? maxAvailableRefund : rawRefundAmount;

    const idempotencyKey = IdempotencyKeys.forOrderRefund(order.id, `${statusVariant}-${remainingQty}`);

    return {
      refundAmount: finalRefundAmount,
      idempotencyKey,
      isPartial: remainingQty < totalQty,
      unfulfilledQty: remainingQty
    };
  }
};
