import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnitEconomicsElasticityHarness } from '@/services/ai/harnesses/unit-economics-elasticity.harness';
import { SupplierArbitrageOptimizationHarness } from '@/services/ai/harnesses/supplier-arbitrage.harness';
import { ChurnRiskLtvDefenseHarness } from '@/services/ai/harnesses/churn-risk-ltv.harness';
import { CustomerLiabilityTreasuryHarness } from '@/services/ai/harnesses/customer-liability-treasury.harness';
import { CxCompensationGateService } from '@/services/financial/cx-compensation-gate.service';
import { db } from '@/lib/db';

describe('Adversarial AI Stress, Anti-Hallucination & Boundary Clamping Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // VECTOR 1: Anti-Dumping & Margin Clamping Under Adversarial Inputs
  // =========================================================================
  describe('Vector 1: Adversarial Inputs & Margin Floor Clamping', () => {
    it('strictly flags margin floor violations when predatory low markups are passed', () => {
      const result = UnitEconomicsElasticityHarness.simulate({
        serviceId: 'srv_hack_test',
        serviceName: 'Low Margin Service',
        baseCogsRub: 100.0,
        fxBufferPercent: 5, // Effective COGS = 105.00 RUB
        currentPriceRub: 150.0,
        currentVolume: 1000,
        priceElasticityOfDemand: -2.5,
        elasticityModel: 'LINEAR',
        minMarginFloorPercent: 15, // Required >= 15% margin
        markupSteps: [0.02, 0.05, 0.15, 0.30], // Low positive markups
        roundingStrategy: 'CHARM_90',
      });

      // Assert effective COGS includes FX buffer
      expect(result.effectiveCogsWithFxRub).toBe(105);

      // Verify that simulations with margin < 15% are marked as violated
      const lowMarkup = result.simulations.find((s) => s.markupPercent === 2);
      expect(lowMarkup?.isMarginFloorViolated).toBe(true);
      expect(lowMarkup?.grossMarginPercent).toBeLessThan(15);

      // Verify that optimal selected point DOES NOT violate margin floor
      expect(result.optimalPricePoint.isMarginFloorViolated).toBe(false);
      expect(result.optimalPricePoint.grossMarginPercent).toBeGreaterThanOrEqual(15);
    });

    it('rejects invalid, negative or NaN values in Zod schema compilation (Zero-Defect Schema Barrier)', () => {
      expect(() => {
        UnitEconomicsElasticityHarness.simulate({
          serviceId: '',
          serviceName: 'Corrupted Service',
          baseCogsRub: -50.0, // Negative COGS rejected
          fxBufferPercent: 5,
          currentPriceRub: 100,
          currentVolume: 100,
          priceElasticityOfDemand: 0,
          markupSteps: [-0.5], // Negative markup rejected
        } as any);
      }).toThrow();
    });
  });

  // =========================================================================
  // VECTOR 2: Supplier Arbitrage Edge-Cases & Fuzzing
  // =========================================================================
  describe('Vector 2: Supplier Arbitrage Edge-Cases & Disqualification Fuzzing', () => {
    it('disqualifies suppliers with 100% cancellation or extreme quality drop rates without crashing', () => {
      const result = SupplierArbitrageOptimizationHarness.optimize({
        targetServiceCategory: 'VK_LIKES',
        maxCancellationThreshold: 0.10, // 10% max cancellation
        maxDropThreshold: 0.15, // 15% max drop
        candidates: [
          {
            providerId: 'prov_broken_cancellation',
            providerName: 'Broken Supplier 1',
            externalServiceId: '1',
            baseCogsRub: 10.0, // Very cheap, but unreliable
            slaP50Minutes: 1,
            slaP90Minutes: 2,
            cancellationRate: 0.45, // 45% cancellation -> DISQUALIFIED
            qualityDropRate: 0.05,
            currentUsdBalance: 100,
          },
          {
            providerId: 'prov_broken_drops',
            providerName: 'Broken Supplier 2',
            externalServiceId: '2',
            baseCogsRub: 12.0,
            slaP50Minutes: 1,
            slaP90Minutes: 2,
            cancellationRate: 0.02,
            qualityDropRate: 0.60, // 60% drop -> DISQUALIFIED
            currentUsdBalance: 100,
          },
          {
            providerId: 'prov_zero_balance',
            providerName: 'Zero Balance Supplier',
            externalServiceId: '3',
            baseCogsRub: 15.0,
            slaP50Minutes: 5,
            slaP90Minutes: 10,
            cancellationRate: 0.01,
            qualityDropRate: 0.01,
            currentUsdBalance: 0, // 0 balance -> DISQUALIFIED
          },
          {
            providerId: 'prov_reliable',
            providerName: 'Reliable Premium Supplier',
            externalServiceId: '4',
            baseCogsRub: 25.0,
            slaP50Minutes: 10,
            slaP90Minutes: 20,
            cancellationRate: 0.02,
            qualityDropRate: 0.02,
            currentUsdBalance: 250,
          },
        ],
      });

      expect(result.disqualifiedRoutes.length).toBe(3);
      expect(result.selectedPrimaryRoute.providerId).toBe('prov_reliable');
      expect(result.fallbackCascade.length).toBe(0); // No other valid candidates left
    });
  });

  // =========================================================================
  // VECTOR 3: Anti-Hallucination & LTV Retention Budget Bounding
  // =========================================================================
  describe('Vector 3: Churn & LTV Compensation Ceiling Clamping', () => {
    it('hard-clamps trust compensation to maximum 15% of lifetime margin and strict 2500 RUB cap', () => {
      // High-spending VIP with 1,000,000 RUB spend and 300,000 RUB margin
      const result = ChurnRiskLtvDefenseHarness.evaluate({
        customer: {
          userId: 'usr_whale_vip',
          accountAgeDays: 365,
          historicalSpendRub: 1000000,
          lifetimeMarginRub: 300000, // 15% would be 45,000 RUB
          monthlyAverageSpendRub: 85000,
          failedOrdersCount30d: 5,
          ticketSupportLagHours: 12.0,
          recentDropRatePercent: 15.0,
          customerTier: 'VIP',
        },
        maxAllowedMarginCompensationRate: 0.15,
        maxAbsoluteCompensationCapRub: 2500, // Hard platform safety cap
      });

      // Verify that even for high margin, compensation never exceeds the 2500 RUB safety cap
      expect(result.trustBudgetCeilingRub).toBe(2500);
      if (result.recommendedCompensation.compensationCostRub) {
        expect(result.recommendedCompensation.compensationCostRub).toBeLessThanOrEqual(2500);
      }
      expect(result.recommendedCompensation.isWithinBudget).toBe(true);
    });

    it('recommends budget-safe compensation package when customer churn risk is evaluated', () => {
      const result = ChurnRiskLtvDefenseHarness.evaluate({
        customer: {
          userId: 'usr_happy_regular',
          accountAgeDays: 180,
          historicalSpendRub: 10000,
          lifetimeMarginRub: 3000,
          monthlyAverageSpendRub: 2000,
          failedOrdersCount30d: 0,
          ticketSupportLagHours: 0,
          recentDropRatePercent: 0,
          customerTier: 'REGULAR',
        },
      });

      expect(result.baselineChurnProbability).toBeLessThan(0.10);
      expect(result.recommendedCompensation.isWithinBudget).toBe(true);
    });
  });

  // =========================================================================
  // VECTOR 4: High-Concurrency & Stress Simulation
  // =========================================================================
  describe('Vector 4: Concurrency & Mathematical Stability Under High Load', () => {
    it('executes 100 parallel elasticity simulations without memory leak or precision drift', () => {
      const runs = 100;
      const startTime = performance.now();

      const results = Array.from({ length: runs }, (_, i) => {
        return UnitEconomicsElasticityHarness.simulate({
          serviceId: `srv_parallel_${i}`,
          serviceName: `Parallel Test Service ${i}`,
          baseCogsRub: 50.0 + (i % 20),
          fxBufferPercent: 5,
          currentPriceRub: 80.0 + (i % 30),
          currentVolume: 500 + i * 10,
          priceElasticityOfDemand: -1.2,
          markupSteps: [0.15, 0.25, 0.35, 0.50],
          roundingStrategy: 'CHARM_90',
        });
      });

      const durationMs = performance.now() - startTime;

      expect(results.length).toBe(runs);
      // All 100 runs must complete with zero errors in under 500ms
      expect(durationMs).toBeLessThan(500);
      for (const res of results) {
        expect(res.optimalPricePoint.beautifulPriceRub).toBeGreaterThan(0);
        expect(Number.isFinite(res.optimalPricePoint.projectedGrossProfitRub)).toBe(true);
      }
    });

    it('processes 100 parallel treasury evaluations with exact Decimal.js precision', () => {
      const runs = 100;
      for (let i = 0; i < runs; i++) {
        const evalRes = CustomerLiabilityTreasuryHarness.evaluate({
          liquidCashBankRub: 1000000 + i * 1000,
          liquidCashGatewaysRub: 500000,
          providerBalancesUsd: 2000,
          usdToRubExchangeRate: 92.5,
          totalCustomerWithdrawableDepositsRub: 300000,
          totalCustomerBonusBalancesRub: 50000,
          activeUnfulfilledOrdersCostRub: 80000,
          currentQuarterGrossInflowRub: 1200000,
          taxScheme: 'USN_6_INCOME',
          gatewayRollingReservePercent: 5,
          minimumWorkingCapitalBufferRub: 100000,
        });

        expect(evalRes.liquidityHealthStatus).toBe('SOLVENT_GREEN');
        expect(evalRes.safeOwnerDrawCapacityRub).toBeGreaterThan(0);
        // Customer liabilities must never subtract non-withdrawable bonusBalance
        expect(evalRes.totalCustomerEscrowLiabilityRub).toBe(380000); // 300k deposits + 80k active orders
      }
    });
  });

  // =========================================================================
  // VECTOR 5: Zero-Trust Auxiliary Boundary & Anti-Exploit Guards
  // =========================================================================
  describe('Vector 5: Zero-Trust Auxiliary Boundary Verification', () => {
    it('blocks compensation attempts on fresh or suspicious accounts', async () => {
      vi.spyOn(db.user, 'findUnique').mockResolvedValue({
        id: 'usr_suspicious',
        createdAt: new Date(), // Just created 1 minute ago!
        payments: [], // 0 deposits!
        cxCompensations: [],
      } as any);

      const check = await CxCompensationGateService.evaluateCompensationEligibility('usr_suspicious', BigInt(5000));
      expect(check.allowed).toBe(false);
      expect(check.rejectionReason).toContain('Account age');
    });

    it('enforces maximum daily compensation limit of 5000 cents (50 RUB)', async () => {
      vi.spyOn(db.user, 'findUnique').mockResolvedValue({
        id: 'usr_frequent_claims',
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days old
        payments: [{ amount: BigInt(500000) }], // 5000 RUB lifetime
        cxCompensations: [
          { amountCents: BigInt(4000), createdAt: new Date() }, // Already received 40 RUB today
        ],
      } as any);

      // Attempt to claim 20 RUB (would exceed 50 RUB daily cap)
      const check = await CxCompensationGateService.evaluateCompensationEligibility('usr_frequent_claims', BigInt(2000));
      expect(check.allowed).toBe(false);
      expect(check.rejectionReason).toContain('breaches daily ceiling of 50 RUB');
    });
  });
});
