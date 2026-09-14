import { describe, it, expect } from 'vitest';

describe('Admin Marketing & Promo Economics Integrity (Step 12)', () => {
  it('should validate promo code bonus types and business rules', () => {
    type PromoType = 'DISCOUNT' | 'VOUCHER';
    
    function applyPromoEffect(
      type: PromoType,
      value: number,
      orderCostCents: number
    ): { finalCostCents: number; walletCreditCents: number } {
      if (type === 'DISCOUNT') {
        // Percentage discount capped at 100%
        const discountPct = Math.min(100, Math.max(0, value));
        const finalCost = Math.round(orderCostCents * (1 - discountPct / 100));
        return { finalCostCents: finalCost, walletCreditCents: 0 };
      } else {
        // VOUCHER: credits rubles/cents directly to wallet, order cost unchanged
        return { finalCostCents: orderCostCents, walletCreditCents: value };
      }
    }

    // 1. DISCOUNT: 15% off 1000 RUB (100,000 cents) -> 850 RUB
    const discountResult = applyPromoEffect('DISCOUNT', 15, 100_000);
    expect(discountResult.finalCostCents).toBe(85_000);
    expect(discountResult.walletCreditCents).toBe(0);

    // 2. VOUCHER: 200 RUB voucher (20,000 cents) -> credits 20,000 cents
    const voucherResult = applyPromoEffect('VOUCHER', 20_000, 100_000);
    expect(voucherResult.finalCostCents).toBe(100_000);
    expect(voucherResult.walletCreditCents).toBe(20_000);
  });

  it('should verify referral payout integrity: strict full-payout requirement', () => {
    function validatePayoutRequest(referralBalanceCents: number, requestedAmountCents: number) {
      if (referralBalanceCents <= 0) {
        return { valid: false, error: 'Zero referral balance' };
      }
      if (requestedAmountCents > referralBalanceCents) {
        return { valid: false, error: 'Insufficient referral balance' };
      }
      if (requestedAmountCents !== referralBalanceCents) {
        return { 
          valid: false, 
          error: 'Partial payouts are not supported to maintain financial data integrity.' 
        };
      }
      return { valid: true, error: null };
    }

    // 1. Full balance payout -> valid
    expect(validatePayoutRequest(50_000, 50_000)).toEqual({ valid: true, error: null });

    // 2. Partial payout attempt -> rejected
    expect(validatePayoutRequest(50_000, 25_000)).toEqual({
      valid: false,
      error: 'Partial payouts are not supported to maintain financial data integrity.',
    });

    // 3. Overdraft attempt -> rejected
    expect(validatePayoutRequest(50_000, 60_000)).toEqual({
      valid: false,
      error: 'Insufficient referral balance',
    });

    // 4. Zero balance -> rejected
    expect(validatePayoutRequest(0, 5000)).toEqual({
      valid: false,
      error: 'Zero referral balance',
    });
  });

  it('should correctly format referral economics monthly distribution', () => {
    const mockCommissions = [
      { amount: 50_000, monthIndex: 0 }, // Jan: 500 RUB
      { amount: 25_000, monthIndex: 0 }, // Jan: 250 RUB
      { amount: 100_000, monthIndex: 1 }, // Feb: 1,000 RUB
    ];

    const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн'];
    const monthlyTotals: Record<string, number> = {};
    for (const m of months) monthlyTotals[m] = 0;

    for (const comm of mockCommissions) {
      const m = months[comm.monthIndex];
      if (monthlyTotals[m] !== undefined) {
        monthlyTotals[m] += comm.amount;
      }
    }

    expect(monthlyTotals['Янв']).toBe(75_000);
    expect(monthlyTotals['Фев']).toBe(100_000);
    expect(monthlyTotals['Мар']).toBe(0);
  });
});
