import { describe, it, expect } from 'vitest';
import { CustomerLiabilityTreasuryHarness } from '@/services/ai/harnesses/customer-liability-treasury.harness';

describe('Stage 5: Customer Liability Escrow, Taxes & Safe Owner Draw Capacity', () => {
  describe('1. CustomerLiabilityTreasuryHarness Evaluation', () => {
    it('accurately distinguishes real customer deposits from bonus credits and calculates positive Safe Owner Draw', () => {
      const res = CustomerLiabilityTreasuryHarness.evaluate({
        liquidCashBankRub: 500000,
        liquidCashGatewaysRub: 200000,
        providerBalancesUsd: 1000, // $1000 * 92.5 = 92,500 RUB
        usdToRubExchangeRate: 92.5,
        totalCustomerWithdrawableDepositsRub: 150000, // Real debt
        totalCustomerBonusBalancesRub: 25000, // Excluded from debt!
        activeUnfulfilledOrdersCostRub: 30000, // Order escrow
        currentQuarterGrossInflowRub: 400000, // Tax base
        taxScheme: 'USN_6_INCOME', // 6% = 24,000 RUB
        gatewayRollingReservePercent: 5, // 5% of 200,000 = 10,000 RUB
        minimumWorkingCapitalBufferRub: 100000, // Safety buffer
      });

      // Total liquid = 500k + 200k + 92.5k = 792,500 RUB
      expect(res.totalLiquidAssetsRub).toBe(792500);

      // Customer escrow = 150k + 30k = 180,000 RUB
      expect(res.totalCustomerEscrowLiabilityRub).toBe(180000);
      expect(res.customerRealDepositsRub).toBe(150000);
      expect(res.customerBonusCreditsRub).toBe(25000);

      // Tax due = 400k * 6% = 24,000 RUB
      expect(res.estimatedQuarterlyTaxDueRub).toBe(24000);

      // Rolling reserve = 10,000 RUB
      expect(res.gatewayRollingReserveRub).toBe(10000);

      // Safe owner draw = 792,500 - 180,000 - 24,000 - 10,000 - 100,000 = 478,500 RUB
      expect(res.safeOwnerDrawCapacityRub).toBe(478500);
      expect(res.liquidityHealthStatus).toBe('SOLVENT_GREEN');
      expect(res.accountingCausalityBreakdown.length).toBeGreaterThan(0);
    });

    it('blocks owner draw and flags INSOLVENT_CRITICAL_RED when total cash is less than customer liabilities + taxes', () => {
      const res = CustomerLiabilityTreasuryHarness.evaluate({
        liquidCashBankRub: 50000, // Only 50k in bank
        liquidCashGatewaysRub: 20000,
        providerBalancesUsd: 100, // $100 * 90 = 9k
        usdToRubExchangeRate: 90.0,
        totalCustomerWithdrawableDepositsRub: 200000, // 200k owed to users!
        totalCustomerBonusBalancesRub: 50000,
        activeUnfulfilledOrdersCostRub: 50000,
        currentQuarterGrossInflowRub: 300000, // Tax = 18,000 RUB
        taxScheme: 'USN_6_INCOME',
        gatewayRollingReservePercent: 5,
        minimumWorkingCapitalBufferRub: 100000,
      });

      // Total liquid = 79,000 RUB, but debt = 250,000 + 18,000 = 268,000 RUB!
      expect(res.safeOwnerDrawCapacityRub).toBe(0);
      expect(res.liquidityHealthStatus).toBe('INSOLVENT_CRITICAL_RED');
      expect(res.accountingCausalityBreakdown.some((c) => c.includes('КРИТИЧЕСКИЙ РИСК'))).toBe(true);
      expect(res.recommendations[0]).toContain('Срочно пополнить расчетный счет');
    });

    it('applies 22% VAT rate when VAT_2026_22_PERCENT tax scheme is activated', () => {
      const res = CustomerLiabilityTreasuryHarness.evaluate({
        liquidCashBankRub: 1000000,
        liquidCashGatewaysRub: 500000,
        providerBalancesUsd: 0,
        usdToRubExchangeRate: 90.0,
        totalCustomerWithdrawableDepositsRub: 200000,
        totalCustomerBonusBalancesRub: 0,
        activeUnfulfilledOrdersCostRub: 0,
        currentQuarterGrossInflowRub: 1000000, // 1M inflow
        taxScheme: 'VAT_2026_22_PERCENT', // 22% = 220,000 RUB
        gatewayRollingReservePercent: 0,
        minimumWorkingCapitalBufferRub: 0,
      });

      expect(res.estimatedQuarterlyTaxDueRub).toBe(220000);
      // Safe draw = 1.5M - 200k - 220k = 1,080,000 RUB
      expect(res.safeOwnerDrawCapacityRub).toBe(1080000);
    });
  });
});
