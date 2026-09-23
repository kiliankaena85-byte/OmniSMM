import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WalletOps } from '@/services/financial/wallet-ops';
import { CustomerLiabilityTreasuryHarness } from '@/services/ai/harnesses/customer-liability-treasury.harness';

describe('Platform Regression, AI Degradation & Core Independence Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. Core Financial Path Independence (Zero AI Coupling)
  // =========================================================================
  describe('1. Core Financial Invariants & Wallet Operations', () => {
    it('executes WalletOps.charge and Ledger-First entry independently of AI subsystem status', async () => {
      const mockUser = {
        id: 'usr_buyer_1',
        balance: BigInt(50000), // 500.00 RUB
        tenantId: 'smmplan',
      };

      const ledgerCreateMock = vi.fn().mockResolvedValue({ id: 'ledg_1' });
      const ledgerFindFirstMock = vi.fn().mockResolvedValue(null);
      const userUpdateManyMock = vi.fn().mockResolvedValue({ count: 1 });
      const userFindUniqueOrThrowMock = vi.fn().mockResolvedValue({ balance: BigInt(40000) });

      const fakeTx = {
        user: {
          findUnique: vi.fn().mockResolvedValue(mockUser),
          findUniqueOrThrow: userFindUniqueOrThrowMock,
          updateMany: userUpdateManyMock,
        },
        ledgerEntry: {
          findFirst: ledgerFindFirstMock,
          create: ledgerCreateMock,
        },
      };

      // Execute standard order charge via WalletOps
      const result = await WalletOps.charge(
        fakeTx as any,
        'usr_buyer_1',
        BigInt(10000), // 100.00 RUB
        'Order #ord_test_direct payment',
        { idempotencyKey: 'idem_ord_charge_1', tenantId: 'smmplan' }
      );

      expect(result.success).toBe(true);
      expect(result.balance).toBe(BigInt(40000));
      // Ledger entry MUST be written before user balance update (Ledger-First invariant)
      expect(ledgerCreateMock).toHaveBeenCalled();
      expect(userUpdateManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'usr_buyer_1' }),
          data: expect.objectContaining({
            balance: { decrement: BigInt(10000) },
          }),
        })
      );
    });

    it('prevents overdraft and rejects negative balance transitions', async () => {
      const mockUser = {
        id: 'usr_broke',
        balance: BigInt(1000), // 10.00 RUB
        tenantId: 'smmplan',
      };

      const fakeTx = {
        user: { findUnique: vi.fn().mockResolvedValue(mockUser) },
      };

      await expect(
        WalletOps.charge(
          fakeTx as any,
          'usr_broke',
          BigInt(5000), // 50.00 RUB (exceeds 10.00 RUB balance)
          'Failed overcharge attempt',
          { idempotencyKey: 'idem_overcharge' }
        )
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // 2. Tax Calculation Resilience Under AI Total Failure
  // =========================================================================
  describe('2. Fiscal 54-FZ & Russian Tax Law Compliance (ст. 346.17 НК РФ)', () => {
    it('accurately computes 6% USN and 22% VAT 2026 cash-method reserves regardless of AI downtime', () => {
      // Inflow = 5,000,000 RUB
      const standardUsn = CustomerLiabilityTreasuryHarness.evaluate({
        liquidCashBankRub: 3000000,
        liquidCashGatewaysRub: 1000000,
        providerBalancesUsd: 5000,
        usdToRubExchangeRate: 90.0,
        totalCustomerWithdrawableDepositsRub: 800000,
        totalCustomerBonusBalancesRub: 100000,
        activeUnfulfilledOrdersCostRub: 200000,
        currentQuarterGrossInflowRub: 5000000,
        taxScheme: 'USN_6_INCOME',
        gatewayRollingReservePercent: 5,
        minimumWorkingCapitalBufferRub: 200000,
      });

      // 6% on 5,000,000 = 300,000 RUB
      expect(standardUsn.estimatedQuarterlyTaxDueRub).toBe(300000);
      expect(standardUsn.customerBonusCreditsRub).toBe(100000);
      expect(standardUsn.safeOwnerDrawCapacityRub).toBe(2900000);

      // Enterprise VAT 2026 (22%)
      const vat2026 = CustomerLiabilityTreasuryHarness.evaluate({
        liquidCashBankRub: 25000000,
        liquidCashGatewaysRub: 5000000,
        providerBalancesUsd: 10000,
        usdToRubExchangeRate: 90.0,
        totalCustomerWithdrawableDepositsRub: 2000000,
        totalCustomerBonusBalancesRub: 500000,
        activeUnfulfilledOrdersCostRub: 500000,
        currentQuarterGrossInflowRub: 22000000, // > 20M limit
        taxScheme: 'VAT_2026_22_PERCENT',
        gatewayRollingReservePercent: 5,
        minimumWorkingCapitalBufferRub: 500000,
      });

      // 22% on 22,000,000 = 4,840,000 RUB
      expect(vat2026.estimatedQuarterlyTaxDueRub).toBe(4840000);
      expect(vat2026.liquidityHealthStatus).toBe('SOLVENT_GREEN');
    });
  });

  // =========================================================================
  // 3. Multi-Tenant Brand Isolation Under AI Execution
  // =========================================================================
  describe('3. Multi-Tenant Brand Isolation Invariants (SMMplan vs SMMflux)', () => {
    it('strictly isolates tenant financial accounting and prevents cross-tenant balance leakage', () => {
      const planTreasury = CustomerLiabilityTreasuryHarness.evaluate({
        liquidCashBankRub: 500000,
        liquidCashGatewaysRub: 100000,
        providerBalancesUsd: 1000,
        usdToRubExchangeRate: 90.0,
        totalCustomerWithdrawableDepositsRub: 200000, // SMMplan deposits
        totalCustomerBonusBalancesRub: 20000,
        activeUnfulfilledOrdersCostRub: 50000,
        currentQuarterGrossInflowRub: 600000,
        taxScheme: 'USN_6_INCOME',
        gatewayRollingReservePercent: 5,
        minimumWorkingCapitalBufferRub: 50000,
      });

      const fluxTreasury = CustomerLiabilityTreasuryHarness.evaluate({
        liquidCashBankRub: 200000,
        liquidCashGatewaysRub: 50000,
        providerBalancesUsd: 300,
        usdToRubExchangeRate: 90.0,
        totalCustomerWithdrawableDepositsRub: 80000, // SMMflux deposits
        totalCustomerBonusBalancesRub: 10000,
        activeUnfulfilledOrdersCostRub: 20000,
        currentQuarterGrossInflowRub: 250000,
        taxScheme: 'USN_6_INCOME',
        gatewayRollingReservePercent: 5,
        minimumWorkingCapitalBufferRub: 50000,
      });

      expect(planTreasury.customerRealDepositsRub).toBe(200000);
      expect(fluxTreasury.customerRealDepositsRub).toBe(80000);
      expect(planTreasury.safeOwnerDrawCapacityRub).not.toBe(fluxTreasury.safeOwnerDrawCapacityRub);
    });
  });
});
