import { describe, it, expect } from 'vitest';
import { validateDripFeedLimits, getDripFeedFloor, validateDripFeedDuration } from '@/hooks/useOrderWizard';
import { formatPricePerUnit, formatRubles } from '@/utils/format-price';

describe('Wave 2: Order Wizard CRO & Drip-Feed Floor Invariants', () => {
  describe('Drip-Feed Floor & Limits Invariant (AGENTS.md Rule 4)', () => {
    it('calculates the correct minimum order floor for drip-feed', () => {
      // minQty 100 with 5 runs -> minimum total is 500
      expect(getDripFeedFloor(100, 5)).toBe(500);
      // minQty 50 with 10 runs -> minimum total is 500
      expect(getDripFeedFloor(50, 10)).toBe(500);
      // Safe fallback on zero / negative
      expect(getDripFeedFloor(0, 0)).toBe(1);
    });

    it('rejects drip-feed configurations with fewer than 2 runs', () => {
      const res = validateDripFeedLimits(100, 1, 50, 10000);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('не менее 2');
    });

    it('rejects portion per run that is less than service minQty', () => {
      // portion 40 < minQty 50
      const res = validateDripFeedLimits(40, 5, 50, 10000);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('не может быть меньше минимального (50 шт.)');
    });

    it('rejects total volume (portion * runs) that exceeds service maxQty', () => {
      // portion 600 * 5 runs = 3000 > maxQty 2500
      const res = validateDripFeedLimits(600, 5, 50, 2500);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('превышает максимум услуги (2500 шт.)');
    });

    it('accepts valid portion, runs and within min/max bounds', () => {
      // portion 100 >= minQty 50, total 500 <= maxQty 2500, runs 5 >= 2
      const res = validateDripFeedLimits(100, 5, 50, 2500);
      expect(res.isValid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it('validates drip-feed maximum total duration', () => {
      // 10 runs * 60 min = 600 min <= 43200 min (30 days)
      expect(validateDripFeedDuration(10, 60)).toBe(true);
      // 100 runs * 1440 min = 144000 min > 43200 min
      expect(validateDripFeedDuration(100, 1440)).toBe(false);
    });
  });

  describe('UI Price Formatting & Max 2 Decimals Invariant', () => {
    it('formats price per unit strictly with at most 2 decimals without floating jitter', () => {
      expect(formatPricePerUnit(0.79)).toBe('0.79');
      expect(formatPricePerUnit(5.6)).toBe('5.6');
      expect(formatPricePerUnit(16.4)).toBe('16.4');
      expect(formatPricePerUnit(1)).toBe('1');
      expect(formatPricePerUnit(0.06)).toBe('0.06');
    });

    it('formats rubles totals cleanly with standard Russian currency conventions', () => {
      expect(formatRubles(79)).toContain('79');
      expect(formatRubles(1250.5)).toContain('1');
      expect(formatRubles(0)).toContain('0');
    });
  });
});
