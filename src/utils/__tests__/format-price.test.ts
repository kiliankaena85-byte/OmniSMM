import { describe, it, expect } from 'vitest';
import { formatPricePerUnit, formatRubles } from '../format-price';

describe('Russian Pricing Psychology Formatters', () => {
  describe('formatPricePerUnit (₽ / шт)', () => {
    it('should format zero as "0"', () => {
      expect(formatPricePerUnit(0)).toBe('0');
      expect(formatPricePerUnit(-0)).toBe('0');
    });

    it('should format whole numbers without trailing .00', () => {
      expect(formatPricePerUnit(1)).toBe('1');
      expect(formatPricePerUnit(2.0)).toBe('2');
      expect(formatPricePerUnit(15.00)).toBe('15');
    });

    it('should strip trailing zeroes from decimals', () => {
      expect(formatPricePerUnit(0.50)).toBe('0.5');
      expect(formatPricePerUnit(0.1500)).toBe('0.15');
      expect(formatPricePerUnit(1.20)).toBe('1.2');
      expect(formatPricePerUnit(0.410)).toBe('0.41');
    });

    it('should accurately display micro-prices for views/reactions', () => {
      expect(formatPricePerUnit(0.005)).toBe('0.005');
      expect(formatPricePerUnit(0.02)).toBe('0.02');
      expect(formatPricePerUnit(0.0015)).toBe('0.0015');
    });
  });

  describe('formatRubles (₽)', () => {
    it('should format zero as "0 ₽"', () => {
      expect(formatRubles(0)).toBe('0 ₽');
    });

    it('should format whole rubles with space separator and NO trailing decimals', () => {
      expect(formatRubles(50)).toBe('50 ₽');
      expect(formatRubles(410)).toBe('410 ₽');
      expect(formatRubles(1000)).toBe('1 000 ₽');
      expect(formatRubles(2500000)).toBe('2 500 000 ₽');
    });

    it('should format fractional rubles cleanly', () => {
      expect(formatRubles(142.5)).toBe('142,5 ₽');
      expect(formatRubles(142.55)).toBe('142,55 ₽');
    });

    it('should handle negative numbers', () => {
      expect(formatRubles(-500)).toBe('-500 ₽');
      expect(formatRubles(-1250.5)).toBe('-1 250,5 ₽');
    });
  });
});
