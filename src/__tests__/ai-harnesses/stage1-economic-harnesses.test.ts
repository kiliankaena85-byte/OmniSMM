import { describe, it, expect } from 'vitest';
import { UnitEconomicsElasticityHarness } from '@/services/ai/harnesses/unit-economics-elasticity.harness';
import { SupplierArbitrageOptimizationHarness } from '@/services/ai/harnesses/supplier-arbitrage.harness';
import { ChurnRiskLtvDefenseHarness } from '@/services/ai/harnesses/churn-risk-ltv.harness';
import { CashflowLiquidityForecastHarness } from '@/services/ai/harnesses/cashflow-forecast.harness';
import { zodToGeminiFunctionDeclaration } from '@/services/ai/zod-to-gemini-schema';
import { GeminiToolClient } from '@/services/ai/gemini-tool-client';
import { z } from 'zod';
import Decimal from 'decimal.js';

describe('Stage 1: Core Gemini Tool-Calling & Deterministic Economic Harnesses', () => {
  describe('1. zodToGeminiFunctionDeclaration schema compiler', () => {
    it('compiles nested Zod object into valid Gemini OpenAPI schema', () => {
      const TestSchema = z.object({
        serviceId: z.string().describe('ID of the service'),
        multiplier: z.number().positive().describe('Price multiplier'),
        tags: z.array(z.string()).describe('Tags list'),
        optionalFlag: z.boolean().optional(),
      });

      const decl = zodToGeminiFunctionDeclaration('testTool', 'A test calculation tool', TestSchema);
      expect(decl.name).toBe('testTool');
      expect(decl.description).toBe('A test calculation tool');
      expect(decl.parameters.type).toBe('OBJECT');
      expect(decl.parameters.properties?.serviceId.type).toBe('STRING');
      expect(decl.parameters.properties?.multiplier.type).toBe('NUMBER');
      expect(decl.parameters.properties?.tags.type).toBe('ARRAY');
      expect(decl.parameters.required).toContain('serviceId');
      expect(decl.parameters.required).toContain('multiplier');
      expect(decl.parameters.required).toContain('tags');
      expect(decl.parameters.required).not.toContain('optionalFlag');
    });
  });

  describe('2. UnitEconomicsElasticityHarness', () => {
    it('applies beautiful rounding and computes profit with +5% FX buffer', () => {
      const res = UnitEconomicsElasticityHarness.simulate({
        serviceId: 'srv_1',
        serviceName: 'VK Followers HQ',
        baseCogsRub: 100.0,
        fxBufferPercent: 5.0, // Effective COGS = 105.00 RUB
        currentPriceRub: 150.0,
        currentVolume: 1000,
        priceElasticityOfDemand: -1.2,
        elasticityModel: 'LINEAR',
        minMarginFloorPercent: 15.0,
        markupSteps: [0.25, 0.50, 0.80, 1.00],
        roundingStrategy: 'CHARM_90',
      });

      expect(res.effectiveCogsWithFxRub).toBe(105.0);
      expect(res.simulations.length).toBe(4);
      expect(res.optimalPricePoint).toBeDefined();
      expect(res.optimalPricePoint.beautifulPriceRub % 1).toBeCloseTo(0.9, 1);
      expect(res.optimalPricePoint.grossMarginPercent).toBeGreaterThanOrEqual(15.0);
    });

    it('flags warnings when margin floor is violated on low markup steps', () => {
      const res = UnitEconomicsElasticityHarness.simulate({
        serviceId: 'srv_low',
        serviceName: 'Low margin test',
        baseCogsRub: 100.0,
        fxBufferPercent: 0,
        currentPriceRub: 105.0,
        currentVolume: 500,
        priceElasticityOfDemand: -0.5,
        minMarginFloorPercent: 50.0, // High margin floor
        markupSteps: [0.10, 0.20], // Markups below 50%
      });

      expect(res.warnings.length).toBeGreaterThan(0);
      expect(res.warnings[0]).toContain('CRITICAL: All markup simulation steps breached');
    });
  });

  describe('3. SupplierArbitrageOptimizationHarness', () => {
    it('disqualifies suppliers with high cancellation rates or 0 balance', () => {
      const res = SupplierArbitrageOptimizationHarness.optimize({
        targetServiceCategory: 'Telegram Reactions',
        maxCancellationThreshold: 0.15,
        candidates: [
          {
            providerId: 'p_good',
            providerName: 'FastReliable',
            externalServiceId: '101',
            baseCogsRub: 20.0,
            slaP50Minutes: 5,
            slaP90Minutes: 15,
            cancellationRate: 0.02,
            qualityDropRate: 0.01,
            isActive: true,
            currentUsdBalance: 250,
          },
          {
            providerId: 'p_unreliable',
            providerName: 'HighCancel',
            externalServiceId: '102',
            baseCogsRub: 10.0, // Cheaper but cancels 30%
            slaP50Minutes: 30,
            slaP90Minutes: 120,
            cancellationRate: 0.30,
            qualityDropRate: 0.05,
            isActive: true,
            currentUsdBalance: 500,
          },
          {
            providerId: 'p_empty',
            providerName: 'ZeroBalance',
            externalServiceId: '103',
            baseCogsRub: 15.0,
            slaP50Minutes: 10,
            slaP90Minutes: 20,
            cancellationRate: 0.01,
            qualityDropRate: 0.01,
            isActive: true,
            currentUsdBalance: 0, // Depleted
          },
        ],
      });

      expect(res.selectedPrimaryRoute.providerId).toBe('p_good');
      expect(res.selectedPrimaryRoute.role).toBe('PRIMARY');
      expect(res.disqualifiedRoutes.length).toBe(2);
      expect(res.disqualifiedRoutes.some((r) => r.providerId === 'p_unreliable')).toBe(true);
      expect(res.disqualifiedRoutes.some((r) => r.providerId === 'p_empty')).toBe(true);
    });
  });

  describe('4. ChurnRiskLtvDefenseHarness', () => {
    it('calculates churn probability and recommends bounded compensation within budget', () => {
      const res = ChurnRiskLtvDefenseHarness.evaluate({
        customer: {
          userId: 'usr_high_value',
          accountAgeDays: 180,
          historicalSpendRub: 50000,
          lifetimeMarginRub: 18000,
          monthlyAverageSpendRub: 12000,
          failedOrdersCount30d: 4,
          ticketSupportLagHours: 6,
          recentDropRatePercent: 10,
          customerTier: 'VIP',
        },
        maxAllowedMarginCompensationRate: 0.15, // Max 2700 RUB
        maxAbsoluteCompensationCapRub: 2500,
        expectedCustomerLifespanMonths: 12,
      });

      expect(res.baselineChurnProbability).toBeGreaterThan(0);
      expect(res.estimatedLtvRub).toBeGreaterThan(0);
      expect(res.trustBudgetCeilingRub).toBeLessThanOrEqual(2500);
      expect(res.recommendedCompensation.isWithinBudget).toBe(true);
      expect(res.recommendedCompensation.netEconomicRetainedValueRub).toBeGreaterThan(0);
    });
  });

  describe('5. CashflowLiquidityForecastHarness', () => {
    it('detects provider balance depletion date offset when burn exceeds inflows', () => {
      const res = CashflowLiquidityForecastHarness.forecast({
        forecastHorizonDays: 7,
        currentLiquidBankBalanceRub: 50000,
        currentProviderUsdBalance: 100, // Only $100
        usdToRubExchangeRate: 92.5,
        projectedDailyBurnUsd: 60, // Burns $60/day -> Depletes on Day 1
        minimumProviderSafeBufferUsd: 50,
        gateways: [
          {
            gatewayId: 'yookassa',
            name: 'YooKassa',
            settlementLagDays: 1, // T+1
            processingFeePercent: 3.5,
            holdbackReservePercent: 0,
          },
        ],
        inflowSchedule: [
          { dayOffset: 0, gatewayId: 'yookassa', grossAmountRub: 10000 },
          { dayOffset: 1, gatewayId: 'yookassa', grossAmountRub: 10000 },
        ],
      });

      expect(res.overallStatus).toBe('CRITICAL_SHORTFALL');
      expect(res.estimatedDepletionDayOffset).toBe(1);
      expect(res.requiredUrgentTopUpUsd).toBeGreaterThan(0);
      expect(res.alarms.length).toBeGreaterThan(0);
    });
  });
});
