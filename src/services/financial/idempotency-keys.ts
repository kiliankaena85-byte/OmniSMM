/**
 * @file IdempotencyKeys - Canonical Golden Path Primitive for Idempotency Key Construction.
 * @module IdempotencyKeys
 * 
 * JSDoc / Usage Guidelines:
 * ✅ DO THIS (Stable Business Keys):
 *   const key = IdempotencyKeys.forOrderCharge(order.id);
 *   const refundKey = IdempotencyKeys.forOrderRefund(order.id, 'partial');
 * 
 * ❌ NEVER DO THIS (Volatile Unstable Keys):
 *   const badKey = `charge-${order.id}-${Date.now()}`; // ❌ Will cause double charges on retries!
 *   const randomKey = `deposit-${Math.random()}`;       // ❌ Non-repeatable!
 */

export const IDEMPOTENCY_RULES = {
  FORBIDDEN_PATTERNS: ['Date.now()', 'Math.random()', 'new Date().getTime()'],
  REQUIREMENT: 'Idempotency keys MUST be constructed strictly from stable business entity identifiers.'
};

export const IdempotencyKeys = {
  /**
   * Generates a stable key for charging an order.
   */
  forOrderCharge(orderId: string): string {
    if (!orderId) throw new Error('orderId is required for forOrderCharge');
    return `order-charge:${orderId}`;
  },

  /**
   * Generates a stable key for refunding an order or order portion.
   */
  forOrderRefund(orderId: string, status: string): string {
    if (!orderId) throw new Error('orderId is required for forOrderRefund');
    return `refund:${orderId}:${status || 'full'}`;
  },

  /**
   * Generates a stable key for a balance deposit / payment top-up.
   */
  forDeposit(paymentId: string): string {
    if (!paymentId) throw new Error('paymentId is required for forDeposit');
    return `deposit:${paymentId}`;
  },

  /**
   * Generates a stable key for referral commission awards.
   */
  forCommission(orderId: string, referrerId: string): string {
    if (!orderId || !referrerId) throw new Error('orderId and referrerId are required for forCommission');
    return `commission:${orderId}:${referrerId}`;
  },

  /**
   * Generates a stable key for referral balance transfers.
   */
  forReferralTransfer(userId: string, nonce: string | number): string {
    if (!userId) throw new Error('userId is required for forReferralTransfer');
    return `referral-transfer:${userId}:${nonce || '1'}`;
  },

  /**
   * Generates a stable key for support compensation.
   */
  forCompensation(ticketId: string, hash: string): string {
    if (!ticketId) throw new Error('ticketId is required for forCompensation');
    return `compensation:${ticketId}:${hash || 'default'}`;
  }
};
