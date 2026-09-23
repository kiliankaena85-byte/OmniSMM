import { describe, it, expect } from 'vitest';
import { calculateVat, formatMoneyCents, parseRublesToCents } from '../money';

describe('Financial Money & VAT Calculation Suite (54-FZ & 2026 Tax Rules)', () => {
  describe('calculateVat', () => {
    it('calculates VAT 22% accurately for standard amounts with ceiling rounding', () => {
      const vat = calculateVat(BigInt(10000), 22);
      expect(vat).toBe(BigInt(1804));
    });

    it('calculates VAT 20% accurately for legacy amounts', () => {
      const vat = calculateVat(BigInt(12000), 20);
      expect(vat).toBe(BigInt(2000));
    });

    it('handles small and edge case amounts without precision loss (10001 cents)', () => {
      const vat = calculateVat(BigInt(10001), 22);
      expect(vat).toBe(BigInt(1804));
    });

    it('returns 0 for zero or negative amounts', () => {
      expect(calculateVat(BigInt(0), 22)).toBe(BigInt(0));
      expect(calculateVat(BigInt(-500), 22)).toBe(BigInt(0));
      expect(calculateVat(BigInt(1000), 0)).toBe(BigInt(0));
    });
  });

  describe('formatMoneyCents', () => {
    it('formats BigInt cents to decimal string correctly', () => {
      expect(formatMoneyCents(BigInt(12345))).toBe('123.45');
      expect(formatMoneyCents(BigInt(5))).toBe('0.05');
      expect(formatMoneyCents(BigInt(100))).toBe('1.00');
      expect(formatMoneyCents(BigInt(0))).toBe('0.00');
      expect(formatMoneyCents(BigInt(-450))).toBe('-4.50');
    });
  });

  describe('parseRublesToCents', () => {
    it('parses number or string rubles into BigInt cents', () => {
      expect(parseRublesToCents('150.50')).toBe(BigInt(15050));
      expect(parseRublesToCents('99')).toBe(BigInt(9900));
      expect(parseRublesToCents(250.75)).toBe(BigInt(25075));
    });

    it('throws error on invalid formats', () => {
      expect(() => parseRublesToCents('abc')).toThrow('INVALID_AMOUNT_FORMAT');
      expect(() => parseRublesToCents(NaN)).toThrow('INVALID_AMOUNT');
    });
  });
});
