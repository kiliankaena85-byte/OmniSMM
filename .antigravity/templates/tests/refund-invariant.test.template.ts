import { describe, it, expect } from 'vitest';
import { RefundPolicy } from '@/services/financial/refund-policy';

describe('Refund Invariant Test Template', () => {
  it('prevents over-refunding when previous refunds exist', () => {
    const order = { id: 'ord-1', charge: 1000_00n, quantity: 100 };
    const { refundAmount } = RefundPolicy.calcRefund(order, 600_00n, 100);
    expect(refundAmount).toBeLessThanOrEqual(400_00n);
  });
});
