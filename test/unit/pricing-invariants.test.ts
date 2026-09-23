import { describe, it, expect, vi } from 'vitest';
import {
  UPPER_SANITY_LIMIT_RUB,
  SAFETY_FLOOR_MARKUP,
  TOTAL_MANDATORY_DEDUCTIONS,
  calculateSafetyFloorCents,
  checkPriceSanityLimit,
} from '@/lib/financial-constants';
import { applyAntiNegativeMargin } from '@/lib/pricing/anti-negative-margin';
import { getCostRub } from '@/lib/pricing/currency-invariant';
import { PriceDriftCircuitBreaker, DEFAULT_DRIFT_CONFIG } from '@/lib/pricing/drift-circuit-breaker';
import { CBRRateService } from '@/services/system/cbr-rate.service';

describe('Pricing Engine Invariants & Safety Guardrails', () => {
  describe('1. Global Constants & Safety Thresholds', () => {
    it('enforces UPPER_SANITY_LIMIT_RUB as exactly 500,000 RUB/1k (500 RUB/unit)', () => {
      expect(UPPER_SANITY_LIMIT_RUB).toBe(500000);
      const under = checkPriceSanityLimit(499999);
      expect(under.isExceeded).toBe(false);
      expect(under.clampedPrice).toBe(499999);

      const exact = checkPriceSanityLimit(500000);
      expect(exact.isExceeded).toBe(false);

      const over = checkPriceSanityLimit(500000.01);
      expect(over.isExceeded).toBe(true);
      expect(over.clampedPrice).toBe(500000);
    });

    it('enforces SAFETY_FLOOR_MARKUP as exactly 3.0 (200% margin floor)', () => {
      expect(SAFETY_FLOOR_MARKUP).toBe(3.0);
    });

    it('calculates safety floor cents correctly with mandatory deductions', () => {
      // Cost = 100 RUB (10000 cents)
      // Multiplier = 1 + 3.0 = 4.0
      // Deductions = 0.145 (14.5%)
      // Denominator = 1 - 0.145 = 0.855
      // Expected = ceil(10000 * 4.0 / 0.855) = ceil(40000 / 0.855) = ceil(46783.625) = 46784 cents = 467.84 RUB
      const floorCents = calculateSafetyFloorCents(10000);
      expect(floorCents).toBe(46784);
      expect(floorCents / 100).toBeCloseTo(467.84, 2);
    });
  });

  describe('2. Anti-Negative Margin Protection', () => {
    it('elevates retail price if nominal margin drops below safety threshold', () => {
      const costPer1kRub = 100;
      const nominalRetail = 80; // below cost
      const guard = applyAntiNegativeMargin(costPer1kRub, nominalRetail, 5);

      expect(guard.wasFloored).toBe(true);
      expect(guard.finalRetailPer1kRub).toBe(105);
    });

    it('preserves healthy retail price when above safety threshold', () => {
      const costPer1kRub = 100;
      const nominalRetail = 300; // 300 RUB (+200% margin)
      const guard = applyAntiNegativeMargin(costPer1kRub, nominalRetail, 5);

      expect(guard.wasFloored).toBe(false);
      expect(guard.finalRetailPer1kRub).toBe(300);
    });
  });

  describe('3. Multi-Currency Normalization Invariant', () => {
    it('normalizes RUB directly with zero drift', () => {
      const cost = getCostRub(100, 'RUB', 90);
      expect(cost).toBe(100);
    });

    it('normalizes USD via usdRate', () => {
      const cost = getCostRub(1.5, 'USD', 95);
      expect(cost).toBe(142.5);
    });

    it('normalizes EUR via cross rates', () => {
      const crossRates = {
        usdToRub: 100,
        eurToUsd: 1.10,
        uahToUsd: 0.025,
        kztToUsd: 0.002,
        updatedAt: new Date()
      };
      // 10 EUR -> 10 * 1.10 USD = 11 USD -> 11 * 100 RUB = 1100 RUB
      const cost = getCostRub(10, 'EUR', 100, crossRates);
      expect(cost).toBe(1100);
    });

    it('throws fail-closed error for unknown or invalid currencies', () => {
      expect(() => getCostRub(10, 'BITCOIN', 100)).toThrow(/CURRENCY_UNSUPPORTED/);
      expect(() => getCostRub(-5, 'USD', 100)).toThrow(/INVALID_RATE/);
    });
  });

  describe('4. Drift Circuit Breaker & Bounds Protection', () => {
    it('blocks micro-price anomaly (< 0.01 RUB/1k)', async () => {
      const check = await PriceDriftCircuitBreaker.validate(
        'mock-provider',
        'ext-123',
        0.005, // 0.005 RUB per 1k
        DEFAULT_DRIFT_CONFIG
      );
      expect(check.ok).toBe(false);
      if (!check.ok) {
        expect(check.severity).toBe('BLOCK');
        expect(check.reason).toContain('ниже минимально допустимого порога');
      }
    });

    it('accepts valid price within boundaries', async () => {
      const check = await PriceDriftCircuitBreaker.validate(
        'mock-provider',
        'ext-123',
        50.0,
        DEFAULT_DRIFT_CONFIG
      );
      expect(check.ok).toBe(true);
    });
  });

  describe('5. CBR Rate Service Fail-Closed Behavior', () => {
    it('throws INVALID_USD_RATE when exchange rate is unconfigured or zero', async () => {
      const { SettingsManager } = await import('@/lib/settings');
      const getSpy = vi.spyOn(SettingsManager, 'getExchangeRateUSD').mockResolvedValueOnce(0);

      await expect(CBRRateService.getLiveCrossRates('smmplan')).rejects.toThrow('INVALID_USD_RATE');
      getSpy.mockRestore();
    });
  });
});
