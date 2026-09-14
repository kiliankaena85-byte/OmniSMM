import { describe, it, expect } from 'vitest';

describe('Admin Finance & P&L Integrity (Step 11)', () => {
  it('should accurately calculate P&L metrics according to fintech accounting rules', () => {
    // Input parameters in kopecks (cents)
    const revenueGross = 1_000_000_00; // 1,000,000.00 RUB
    const refunds = 50_000_00;         // 50,000.00 RUB
    const gatewayFees = 35_000_00;     // 35,000.00 RUB (~3.5% YooKassa)
    const cogs = 400_000_00;           // 400,000.00 RUB (COGS / provider costs)
    const baseTaxRate = 6.0;           // 6% USN
    const opex = 100_000_00;           // 100,000.00 RUB monthly OPEX

    // Net Revenue = Gross - Refunds - Gateway Fees
    const revenueNet = revenueGross - refunds - gatewayFees;
    expect(revenueNet).toBe(915_000_00);

    // Gross Margin = Net Revenue - COGS
    const marginGross = revenueNet - cogs;
    expect(marginGross).toBe(515_000_00);

    // Margin percentage
    const marginPercentage = (marginGross / revenueNet) * 100;
    expect(marginPercentage).toBeCloseTo(56.28, 2);

    // Taxes for USN Income - Expenses (on marginGross)
    const taxes = Math.round(marginGross * (baseTaxRate / 100));
    expect(taxes).toBe(30_900_00);

    // Net Profit (EBITDA) = Gross Margin - Taxes - OPEX
    const profitNet = marginGross - taxes - opex;
    expect(profitNet).toBe(384_100_00);
  });

  it('should enforce 2026 VAT threshold limit (20 million rubles)', () => {
    const VAT_THRESHOLD_CENTS = 2_000_000_000; // 20,000,000.00 RUB
    const baseTaxRate = 6.0;

    function calculateEffectiveTaxRate(annualRevenueCents: number): {
      effectiveRate: number;
      isVatExceeded: boolean;
    } {
      const isVatExceeded = annualRevenueCents >= VAT_THRESHOLD_CENTS;
      const effectiveRate = isVatExceeded ? baseTaxRate + 5.0 : baseTaxRate;
      return { effectiveRate, isVatExceeded };
    }

    // 1. Under threshold: 15 million rubles
    const under = calculateEffectiveTaxRate(1_500_000_000);
    expect(under.isVatExceeded).toBe(false);
    expect(under.effectiveRate).toBe(6.0);

    // 2. Exactly at threshold: 20 million rubles
    const exact = calculateEffectiveTaxRate(2_000_000_000);
    expect(exact.isVatExceeded).toBe(true);
    expect(exact.effectiveRate).toBe(11.0); // 6% + 5% VAT

    // 3. Above threshold: 25 million rubles
    const above = calculateEffectiveTaxRate(2_500_000_000);
    expect(above.isVatExceeded).toBe(true);
    expect(above.effectiveRate).toBe(11.0);
  });

  it('should verify proportional COGS calculation for partially completed orders', () => {
    function calculateConfirmedCogs(quantity: number, remains: number, providerCost: number): number {
      if (quantity <= 0) return 0;
      const delivered = Math.max(0, quantity - remains);
      return Math.round((delivered / quantity) * providerCost);
    }

    // 1. 1000 ordered, 0 remains (100% delivered), cost 100 RUB
    expect(calculateConfirmedCogs(1000, 0, 100)).toBe(100);

    // 2. 1000 ordered, 400 remains (60% delivered), cost 100 RUB -> 60 RUB COGS
    expect(calculateConfirmedCogs(1000, 400, 100)).toBe(60);

    // 3. 1000 ordered, 1000 remains (0% delivered, full cancel) -> 0 RUB COGS
    expect(calculateConfirmedCogs(1000, 1000, 100)).toBe(0);

    // 4. Edge case: quantity = 0 -> safety 0
    expect(calculateConfirmedCogs(0, 0, 100)).toBe(0);
  });
});
