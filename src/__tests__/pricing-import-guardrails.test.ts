import { describe, it, expect } from 'vitest';
import { buildCurrencySnapshot, getCostRub } from '@/lib/pricing/currency-invariant';
import { applyAntiNegativeMargin } from '@/lib/pricing/anti-negative-margin';
import { PriceDriftCircuitBreaker } from '@/lib/pricing/drift-circuit-breaker';
import {
  UPPER_SANITY_LIMIT_RUB,
  checkPriceSanityLimit,
  applyPricingLadder,
  applyPricingLadderWithSanity,
  SAFETY_FLOOR_MARKUP
} from '@/lib/financial-constants';

describe('Pricing & Import Engine Guardrails Suite (P0 Invariants)', () => {
  describe('1. Canonical getCostRub & Fail-Closed Invariant (P0-1)', () => {
    it('correctly calculates cost for RUB (1.0 multiplier)', () => {
      expect(getCostRub(15.5, 'RUB', 95.0)).toBe(15.5);
      expect(getCostRub(0, 'RUB', 95.0)).toBe(0);
      expect(getCostRub(100.25, 'rub', 95.0)).toBe(100.25);
    });

    it('correctly calculates cost for USD (usdRate multiplier)', () => {
      expect(getCostRub(1.0, 'USD', 95.0)).toBe(95.0);
      expect(getCostRub(0.5, 'usd', 100.0)).toBe(50.0);
      expect(getCostRub(2.5, 'USD', 92.5)).toBe(231.25);
    });

    it('correctly calculates cost for EUR (1.08 * usdRate)', () => {
      // 10.0 * 1.08 * 100 = 1080.0
      expect(getCostRub(10.0, 'EUR', 100.0)).toBe(1080.0);
      // 2.0 * 1.08 * 95.0 = 205.2
      expect(getCostRub(2.0, 'eur', 95.0)).toBe(205.2);
    });

    it('correctly calculates cost for UAH (0.027 * usdRate)', () => {
      // 1000.0 * 0.027 * 100.0 = 2700.0
      expect(getCostRub(1000.0, 'UAH', 100.0)).toBe(2700.0);
      // 100.0 * 0.027 * 95.0 = 256.5
      expect(getCostRub(100.0, 'uah', 95.0)).toBe(256.5);
    });

    it('correctly calculates cost for KZT (0.0023 * usdRate)', () => {
      // 10000.0 * 0.0023 * 100.0 = 2300.0
      expect(getCostRub(10000.0, 'KZT', 100.0)).toBe(2300.0);
      // 1000.0 * 0.0023 * 95.0 = 218.5
      expect(getCostRub(1000.0, 'kzt', 95.0)).toBe(218.5);
    });

    it('fails closed (throws) on missing, empty, or unsupported currency without fallback', () => {
      expect(() => getCostRub(10, '', 95.0)).toThrow(/CURRENCY_UNSUPPORTED/);
      expect(() => getCostRub(10, null as unknown as string, 95.0)).toThrow(/CURRENCY_UNSUPPORTED/);
      expect(() => getCostRub(10, undefined as unknown as string, 95.0)).toThrow(/CURRENCY_UNSUPPORTED/);
      expect(() => getCostRub(10, 'GBP', 95.0)).toThrow(/CURRENCY_UNSUPPORTED/);
      expect(() => getCostRub(10, 'XYZ_FAKE', 95.0)).toThrow(/CURRENCY_UNSUPPORTED/);
    });

    it('fails closed on negative or invalid rate', () => {
      expect(() => getCostRub(-5, 'RUB', 95.0)).toThrow(/INVALID_RATE/);
      expect(() => getCostRub(NaN, 'USD', 95.0)).toThrow(/INVALID_RATE/);
      expect(() => getCostRub(Infinity, 'USD', 95.0)).toThrow(/INVALID_RATE/);
    });

    it('fails closed on invalid usdRate when converting non-RUB currencies', () => {
      expect(() => getCostRub(10, 'USD', 0)).toThrow(/INVALID_USD_RATE/);
      expect(() => getCostRub(10, 'USD', -95)).toThrow(/INVALID_USD_RATE/);
      expect(() => getCostRub(10, 'EUR', NaN)).toThrow(/INVALID_USD_RATE/);
    });
  });

  describe('2. Currency Snapshot Build (P0-1)', () => {
    it('correctly freezes RUB rate without conversion', async () => {
      const snap = await buildCurrencySnapshot(1.50, 'RUB');
      expect(snap.currency).toBe('RUB');
      expect(snap.rawRate).toBe(1.50);
      expect(snap.costPer1kRub).toBe(1.50);
      expect(snap.usdRateAtCapture).toBeGreaterThan(0);
    });

    it('correctly converts USD rate to RUB with exchange rate', async () => {
      const snap = await buildCurrencySnapshot(0.50, 'USD');
      expect(snap.currency).toBe('USD');
      expect(snap.rawRate).toBe(0.50);
      expect(snap.costPer1kRub).toBeCloseTo(0.50 * snap.usdRateAtCapture, 2);
    });

    it('fails loudly on unsupported currency', async () => {
      await expect(buildCurrencySnapshot(100, 'XYZ_INVALID')).rejects.toThrow(/CURRENCY_UNSUPPORTED/);
    });

    it('fails loudly on negative or zero rate', async () => {
      await expect(buildCurrencySnapshot(-5, 'RUB')).rejects.toThrow(/INVALID_RATE|CURRENCY_CONVERSION_INVALID/);
      await expect(buildCurrencySnapshot(0, 'USD')).rejects.toThrow(/INVALID_RATE|CURRENCY_CONVERSION_INVALID/);
    });
  });

  describe('3. Upper Sanity Limit (500,000 RUB) & Sanity Check', () => {
    it('declares UPPER_SANITY_LIMIT_RUB as exactly 500000', () => {
      expect(UPPER_SANITY_LIMIT_RUB).toBe(500000);
    });

    it('checkPriceSanityLimit flags exceeded limit correctly', () => {
      const normal = checkPriceSanityLimit(499999);
      expect(normal.isExceeded).toBe(false);
      expect(normal.price).toBe(499999);
      expect(normal.limit).toBe(500000);

      const exact = checkPriceSanityLimit(500000);
      expect(exact.isExceeded).toBe(false);

      const exceeded = checkPriceSanityLimit(500000.01);
      expect(exceeded.isExceeded).toBe(true);
      expect(exceeded.clampedPrice).toBe(500000);

      const extreme = checkPriceSanityLimit(750000);
      expect(extreme.isExceeded).toBe(true);
      expect(extreme.clampedPrice).toBe(500000);
    });

    it('applyPricingLadderWithSanity returns sanity check result with pricing ladder', () => {
      const normalResult = applyPricingLadderWithSanity(100);
      expect(normalResult.isSanityLimitExceeded).toBe(false);
      expect(normalResult.retailPrice).toBeGreaterThan(0);

      const hugeResult = applyPricingLadderWithSanity(150000);
      // 150000 * 4 * 1.035 = 621000 > 500000
      expect(hugeResult.isSanityLimitExceeded).toBe(true);
      expect(hugeResult.retailPrice).toBe(621000);
    });
  });

  describe('4. Adaptive Pricing Ladder (applyPricingLadder)', () => {
    it('applies x50 multiplier for micro-costs (< 1 RUB)', () => {
      const cost = 0.50;
      const price = applyPricingLadder(cost);
      // 0.50 * 50 * 1.035 = 25.875
      expect(price).toBeCloseTo(0.50 * 50 * 1.035, 3);
    });

    it('applies x11 multiplier for low costs (1–10 RUB)', () => {
      const cost = 5.0;
      const price = applyPricingLadder(cost);
      // 5.0 * 11 * 1.035 = 56.925
      expect(price).toBeCloseTo(5.0 * 11 * 1.035, 3);
    });

    it('applies x8 multiplier for medium costs (10–50 RUB)', () => {
      const cost = 25.0;
      const price = applyPricingLadder(cost);
      // 25.0 * 8 * 1.035 = 207.0
      expect(price).toBeCloseTo(25.0 * 8 * 1.035, 3);
    });

    it('applies x6 multiplier for high costs (50–150 RUB)', () => {
      const cost = 100.0;
      const price = applyPricingLadder(cost);
      // 100.0 * 6 * 1.035 = 621.0
      expect(price).toBeCloseTo(100.0 * 6 * 1.035, 3);
    });

    it('applies x4 multiplier for enterprise costs (> 150 RUB)', () => {
      const cost = 200.0;
      const price = applyPricingLadder(cost);
      // 200.0 * 4 * 1.035 = 828.0
      expect(price).toBeCloseTo(200.0 * 4 * 1.035, 3);
    });

    it('returns 0 for zero or negative cost', () => {
      expect(applyPricingLadder(0)).toBe(0);
      expect(applyPricingLadder(-10)).toBe(0);
    });
  });

  describe('5. Anti-Negative Margin Guard (P0-3)', () => {
    it('guarantees retail is at least cost + 5% even if rounded down', () => {
      const costPer1k = 10.0;
      const result = applyAntiNegativeMargin(costPer1k, 9.50, 5);
      expect(result.wasFloored).toBe(true);
      expect(result.finalRetailPer1kRub).toBeGreaterThanOrEqual(10.50);
      expect(result.marginPct).toBeGreaterThanOrEqual(5);
    });

    it('preserves valid profitable retail prices without flooring', () => {
      const costPer1k = 10.0;
      const rawRetail = 25.0;
      const result = applyAntiNegativeMargin(costPer1k, rawRetail, 5);
      expect(result.wasFloored).toBe(false);
      expect(result.finalRetailPer1kRub).toBe(30.0);
      expect(result.marginPct).toBe(200);
    });
  });

  describe('6. Price Drift Circuit Breaker (P0-5)', () => {
    it('blocks micro-prices below 0.01 RUB per 1k', async () => {
      const check = await PriceDriftCircuitBreaker.validate('prov-1', 'ext-1', 0.0001);
      expect(check.ok).toBe(false);
      if (!check.ok) {
        expect(check.severity).toBe('BLOCK');
        expect(check.reason).toContain('ниже минимально допустимого порога');
      }
    });

    it('blocks currency explosions above 50,000 RUB per 1k', async () => {
      const check = await PriceDriftCircuitBreaker.validate('prov-1', 'ext-1', 999999);
      expect(check.ok).toBe(false);
      if (!check.ok) {
        expect(check.severity).toBe('BLOCK');
        expect(check.reason).toContain('превышает максимальный лимит');
      }
    });

    it('passes reasonable costs', async () => {
      const check = await PriceDriftCircuitBreaker.validate('prov-nonexistent', 'ext-1', 15.0);
      expect(check.ok).toBe(true);
    });
  });
});
