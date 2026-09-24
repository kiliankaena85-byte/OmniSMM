import { describe, it, expect } from 'vitest';
import { getDripFeedFloorViolation, assertDripFeedFloor } from '@/services/orders/drip-feed-floor';

describe('Drip-Feed Floor Invariant', () => {
  it('passes for non drip-feed orders', () => {
    expect(getDripFeedFloorViolation(10, undefined, 50)).toBeNull();
    expect(getDripFeedFloorViolation(10, 0, 50)).toBeNull();
  });

  it('rejects 100 qty / 10 runs when minQty = 50 (audit case)', () => {
    expect(getDripFeedFloorViolation(100, 10, 50)).toMatch(/\(10\).*\(50\)/);
    expect(() => assertDripFeedFloor(100, 10, 50)).toThrow();
  });

  it('uses floor division at the exact boundary', () => {
    expect(getDripFeedFloorViolation(500, 10, 50)).toBeNull();
    expect(getDripFeedFloorViolation(499, 10, 50)).not.toBeNull();
  });

  it('produces a Smart Drip specific message', () => {
    expect(getDripFeedFloorViolation(60, 3, 50, 'smart')).toContain('Умного Drip-feed');
  });
});
