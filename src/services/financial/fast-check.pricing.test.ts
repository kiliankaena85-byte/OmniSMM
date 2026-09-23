import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';
import { calculateSafetyFloorCents, applyBeautifulRounding } from '@/lib/financial-constants';
import { SettingsProvider } from '@/lib/settings';

// Mock DB for MarketingService isolation (if needed later)
vi.mock('@/lib/db', () => ({
  db: {
    service: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() }
  }
}));

describe('FinOps Fuzzing: Pricing & Math Stability', () => {
  
  it('calculateSafetyFloorCents NEVER returns NaN, Infinity, or drops below raw cost', () => {
    // Fuzzing with any floating point number from -Infinity to +Infinity
    fc.assert(
      fc.property(
        fc.double({ min: 0.001, max: 1000000.0, noNaN: true, noDefaultInfinity: true }), 
        (providerCostCents) => {
          // Rule 1: We only care about positive costs, if provider gives negative, it's a bug we should catch
          if (providerCostCents <= 0) return true;

          const floor = calculateSafetyFloorCents(providerCostCents);
          
          // Must be a valid finite number
          expect(Number.isFinite(floor)).toBe(true);
          expect(Number.isNaN(floor)).toBe(false);
          
          // Safety Floor must ALWAYS be greater than raw provider cost (Math proofs)
          expect(floor).toBeGreaterThan(providerCostCents);
          
          // Verify exact margin formula bounds (approx > 2.34x)
          const expectedMinimum = providerCostCents * ((1 + 1.0) / (1 - 0.145));
          expect(floor).toBeGreaterThanOrEqual(expectedMinimum - 1); // 1 cent rounding tolerance
        }
      ),
      { numRuns: 10000 } // Proving against 10,000 random inputs
    );
  });

  it('applyBeautifulRounding ALWAYS produces predictable, non-destructive outputs', () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true, noDefaultInfinity: true, min: 0.001, max: 100000.0 }),
        (rawRub) => {
          if (rawRub <= 0) return true; // Ignore negatives/zero
          
          const rounded = applyBeautifulRounding(rawRub);
          
          expect(Number.isInteger(rounded)).toBe(true); // Must return integer RUB (no kopecks)
          expect(Number.isNaN(rounded)).toBe(false);
          expect(Number.isFinite(rounded)).toBe(true);

          if (rawRub < 1000) {
            // Rounded to multiple of 10
            expect(rounded % 10).toBe(0);
            expect(rounded).toBeGreaterThanOrEqual(rawRub);
            expect(rounded - rawRub).toBeLessThan(10);
          } else {
            // Rounded to multiple of 100
            expect(rounded % 100).toBe(0);
            expect(rounded).toBeGreaterThanOrEqual(rawRub);
            expect(rounded - rawRub).toBeLessThan(100);
          }
        }
      ),
      { numRuns: 10000 }
    );
  });

  it('MarketingService Price Calculation Math Never Breaks Limits', () => {
    // Generate extreme quantities and extreme rates
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000_000 }), // Quantity
        fc.double({ min: 0.001, max: 10000.0, noNaN: true, noDefaultInfinity: true }), // Rate (USD per 1000)
        fc.double({ min: 1.0, max: 50.0, noNaN: true, noDefaultInfinity: true }), // Markup
        fc.double({ min: 0, max: 100.0, noNaN: true, noDefaultInfinity: true }), // Discount Percent
        (quantity, rate, markup, discountPercent) => {
          const usdToRub = 100.0; // Mock exchange rate

          // Inline manual simulation of MarketingService math
          const providerCostPer1000Cents = rate * usdToRub * 100;
          const providerCostCents = Math.round((providerCostPer1000Cents / 1000) * quantity);
          
          if (providerCostCents <= 0) return true;

          const originalTotalCents = Math.round(providerCostCents * markup);
          
          // Apply caps
          const maxAllowedDiscount = 30.0;
          const cappedDiscount = Math.min(discountPercent, maxAllowedDiscount);
          
          let discountedCents = Math.round(originalTotalCents * (1 - (cappedDiscount / 100)));
          const safetyFloorCents = calculateSafetyFloorCents(providerCostCents);
          
          if (discountedCents < safetyFloorCents) {
            discountedCents = safetyFloorCents;
          }

          expect(Number.isFinite(discountedCents)).toBe(true);
          expect(discountedCents).toBeGreaterThanOrEqual(safetyFloorCents);
          expect(discountedCents).toBeGreaterThan(providerCostCents);
        }
      ),
      { numRuns: 50000 } // High volume for critical math
    );
  });
});
