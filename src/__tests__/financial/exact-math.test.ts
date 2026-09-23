import { describe, it, expect } from 'vitest';
import { ExactMath } from '@/lib/financial/exact-math';

describe('ExactMath Financial Precision Engine', () => {
  describe('rublesToKopecks & kopecksToRubles', () => {
    it('converts standard ruble floats without drift', () => {
      expect(ExactMath.rublesToKopecks(10.5)).toBe(BigInt(1050));
      expect(ExactMath.rublesToKopecks('12.34')).toBe(BigInt(1234));
      expect(ExactMath.rublesToKopecks(0.01)).toBe(BigInt(1));
    });

    it('throws on invalid or negative inputs', () => {
      expect(() => ExactMath.rublesToKopecks(-5)).toThrow(/Negative monetary/);
      expect(() => ExactMath.rublesToKopecks(NaN)).toThrow(/Invalid monetary/);
    });

    it('converts kopecks to rubles accurately', () => {
      expect(ExactMath.kopecksToRubles(BigInt(1050))).toBe(10.5);
      expect(ExactMath.kopecksToRubles(BigInt(1))).toBe(0.01);
      expect(ExactMath.kopecksToRubles(BigInt(0))).toBe(0);
    });
  });

  describe('Micro-Pricing & Minimum Floor Charge', () => {
    it('never charges 0 for positive quantity (anti-zero-charge exploit)', () => {
      const cost = ExactMath.calculateOrderCostKopecks(1, BigInt(12), BigInt(0), BigInt(1));
      expect(cost).toBe(BigInt(1));
    });

    it('calculates exact cost for bulk orders with margin', () => {
      const cost = ExactMath.calculateOrderCostKopecks(10000, BigInt(120), BigInt(1550));
      expect(cost).toBe(BigInt(1386));
    });

    it('applies Banker\'s Rounding (Half-Even) properly', () => {
      expect(ExactMath.roundHalfEven(BigInt(25000), BigInt(10000))).toBe(BigInt(2));
      expect(ExactMath.roundHalfEven(BigInt(35000), BigInt(10000))).toBe(BigInt(4));
      expect(ExactMath.roundHalfEven(BigInt(25001), BigInt(10000))).toBe(BigInt(3));
      expect(ExactMath.roundHalfEven(BigInt(24999), BigInt(10000))).toBe(BigInt(2));
    });
  });

  describe('Partial Refund Calculations', () => {
    it('calculates exact 50% refund when half remains', () => {
      const refund = ExactMath.calculatePartialRefund(BigInt(1000), 100, 50);
      expect(refund).toBe(BigInt(500));
    });

    it('calculates full refund when all items remain', () => {
      const refund = ExactMath.calculatePartialRefund(BigInt(1234), 500, 500);
      expect(refund).toBe(BigInt(1234));
    });

    it('calculates 0 refund when 0 remains', () => {
      const refund = ExactMath.calculatePartialRefund(BigInt(1234), 500, 0);
      expect(refund).toBe(BigInt(0));
    });

    it('handles fractional remains with Banker\'s Rounding without cents drift', () => {
      expect(ExactMath.calculatePartialRefund(BigInt(100), 3, 1)).toBe(BigInt(33));
      expect(ExactMath.calculatePartialRefund(BigInt(100), 3, 2)).toBe(BigInt(67));
    });
  });
});
