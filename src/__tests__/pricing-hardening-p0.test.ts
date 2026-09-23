import { describe, it, expect } from 'vitest';
import { getCostRub } from '@/lib/pricing/currency-invariant';
import { applyAntiNegativeMargin } from '@/lib/pricing/anti-negative-margin';
import { PriceDriftCircuitBreaker } from '@/lib/pricing/drift-circuit-breaker';

describe('P0 Hardening: Currency Invariants, Dynamic FX & Anti-Negative Margin', () => {
  describe('1. Dynamic Cross-Currency FX Engine', () => {
    it('calculates USD cost correctly', () => {
      const cost = getCostRub(10, 'USD', 95.0);
      expect(cost).toBe(950);
    });

    it('calculates EUR cost with default and custom dynamic cross-rates', () => {
      const defaultCost = getCostRub(10, 'EUR', 95.0);
      expect(defaultCost).toBe(1026);

      const dynamicCost = getCostRub(10, 'EUR', 95.0, { eurToUsd: 1.095 });
      expect(dynamicCost).toBe(1040.25);
    });

    it('calculates UAH cost with dynamic cross-rates', () => {
      const defaultCost = getCostRub(1000, 'UAH', 95.0);
      expect(defaultCost).toBe(2565);

      const dynamicCost = getCostRub(1000, 'UAH', 95.0, { uahToUsd: 0.0244 });
      expect(dynamicCost).toBe(2318);
    });

    it('calculates KZT cost with dynamic cross-rates', () => {
      const defaultCost = getCostRub(10000, 'KZT', 95.0);
      expect(defaultCost).toBe(2185);

      const dynamicCost = getCostRub(10000, 'KZT', 95.0, { kztToUsd: 0.00196 });
      expect(dynamicCost).toBe(1862);
    });

    it('throws fail-closed error on unknown or unsupported currency', () => {
      expect(() => getCostRub(10, 'GBP', 95.0)).toThrow('CURRENCY_UNSUPPORTED: GBP');
      expect(() => getCostRub(10, '', 95.0)).toThrow('CURRENCY_UNSUPPORTED');
    });

    it('throws fail-closed error on negative or non-finite rate', () => {
      expect(() => getCostRub(-5, 'USD', 95.0)).toThrow('INVALID_RATE');
      expect(() => getCostRub(NaN, 'USD', 95.0)).toThrow('INVALID_RATE');
      expect(() => getCostRub(Infinity, 'USD', 95.0)).toThrow('INVALID_RATE');
      });
  });

  describe('2. Anti-Negative-Margin & Exact Kopeck Precision', () => {
    it('prevents margin loss and floors at cost + 5%', () => {
      const res = applyAntiNegativeMargin(100, 80, 5);
      expect(res.wasFloored).toBe(true);
      expect(res.finalRetailPer1kRub).toBe(105);
      expect(res.finalRetailPer1kCents).toBe(10500);
      expect(res.marginPct).toBe(5);
    });

    it('preserves healthy margins without flooring', () => {
      const res = applyAntiNegativeMargin(100, 300, 5);
      expect(res.wasFloored).toBe(false);
      expect(res.finalRetailPer1kRub).toBe(300);
      expect(res.finalRetailPer1kCents).toBe(30000);
      expect(res.marginPct).toBe(200);
    });

    it('throws explicit error on non-positive or corrupted costPer1kRub', () => {
      expect(() => applyAntiNegativeMargin(0, 100)).toThrow('[AntiNegativeMargin] Invalid costPer1kRub');
      expect(() => applyAntiNegativeMargin(-10, 100)).toThrow('[AntiNegativeMargin] Invalid costPer1kRub');
      expect(() => applyAntiNegativeMargin(NaN, 100)).toThrow('[AntiNegativeMargin] Invalid costPer1kRub');
    });
  });

  describe('3. Price Drift Circuit Breaker & Ratio Limits', () => {
    it('blocks micro-price glitch below MIN_REASONABLE_COST_RUB', async () => {
      const res = await PriceDriftCircuitBreaker.validate('prov-1', 'srv-1', 0.0001);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.severity).toBe('BLOCK');
      }
    });

    it('blocks upper sanity limit breach above 500,000 RUB', async () => {
      const res = await PriceDriftCircuitBreaker.validate('prov-1', 'srv-1', 500001);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.severity).toBe('BLOCK');
      }
    });

    it('blocks ratio explosion if exchange rate was misconfigured (e.g. 900x for USD)', async () => {
      const res = await PriceDriftCircuitBreaker.validate(
        'prov-1',
        'srv-1',
        9000,
        undefined,
        1.0,
        'USD'
      );
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.severity).toBe('BLOCK');
        expect(res.reason).toContain('превышает безопасный коэффициент');
      }
    });
  });
});