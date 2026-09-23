import { describe, it, expect } from 'vitest';
import { calculatePartialRefund } from '../../src/utils/refund';

describe('calculatePartialRefund', () => {
  it('calculates proportional refund correctly', () => {
    expect(calculatePartialRefund({ remains: 500, quantity: 1000, charge: 10000 })).toBe(5000);
  });

  it('handles zero quantity (prevents division by zero)', () => {
    expect(calculatePartialRefund({ remains: 500, quantity: 0, charge: 10000 })).toBe(0);
  });

  it('handles zero remains', () => {
    expect(calculatePartialRefund({ remains: 0, quantity: 1000, charge: 10000 })).toBe(0);
  });

  it('handles zero charge', () => {
    expect(calculatePartialRefund({ remains: 500, quantity: 1000, charge: 0 })).toBe(0);
  });

  it('floors the result (no fractional cents)', () => {
    // 333 / 1000 * 9999 = 3329.667 → floor → 3329
    expect(calculatePartialRefund({ remains: 333, quantity: 1000, charge: 9999 })).toBe(3329);
  });

  it('handles bigint charge', () => {
    expect(calculatePartialRefund({ remains: 500, quantity: 1000, charge: BigInt(10000) })).toBe(5000);
  });

  it('handles negative remains', () => {
    expect(calculatePartialRefund({ remains: -10, quantity: 1000, charge: 10000 })).toBe(0);
  });

  it('clamps refund to charge when remains exceeds quantity (overflow safeguard)', () => {
    expect(calculatePartialRefund({ remains: 1200, quantity: 1000, charge: 10000 })).toBe(10000);
  });
});
