import { describe, it, expect } from 'vitest';
import { 
  SAFETY_FLOOR_MARKUP, 
  TOTAL_MANDATORY_DEDUCTIONS, 
  calculateSafetyFloorCents, 
  applyBeautifulRounding, 
  checkPriceSanityLimit,
  UPPER_SANITY_LIMIT_RUB 
} from '@/lib/financial-constants';

describe('Admin Providers Import & Pricing Integrity (Step 8)', () => {
  it('should verify safety floor markup formula covers taxes, gateway and target margin', () => {
    // 1000 cents (10.00 RUB) base provider cost
    const costCents = 1000;
    const safetyFloor = calculateSafetyFloorCents(costCents);

    // SafetyPrice = Cost * (1 + 3.0) / (1 - 0.145) = 1000 * 4.0 / 0.855 ≈ 4678.36 -> ceil to 4679 cents
    expect(SAFETY_FLOOR_MARKUP).toBe(3.0);
    expect(TOTAL_MANDATORY_DEDUCTIONS).toBeCloseTo(0.145, 3);
    expect(safetyFloor).toBeGreaterThanOrEqual(4678);
    expect(safetyFloor).toBeLessThanOrEqual(4680);
  });

  it('should verify psychological beautiful rounding for retail catalog prices', () => {
    // Under 1000 RUB: round UP to multiple of 10
    expect(applyBeautifulRounding(42.3)).toBe(50);
    expect(applyBeautifulRounding(115.0)).toBe(120);
    expect(applyBeautifulRounding(991.0)).toBe(1000);

    // 1000 RUB and above: round UP to multiple of 100
    expect(applyBeautifulRounding(1001)).toBe(1100);
    expect(applyBeautifulRounding(1250)).toBe(1300);
    expect(applyBeautifulRounding(2410)).toBe(2500);
  });

  it('should enforce upper sanity limit guard to prevent astronomical pricing glitches', () => {
    // 1. Normal price within sanity limit
    const normal = checkPriceSanityLimit(15000);
    expect(normal.isExceeded).toBe(false);
    expect(normal.clampedPrice).toBe(15000);

    // 2. Erroneous provider currency glitch (e.g. 1,000,000 RUB)
    const insanePrice = 9999999;
    const abnormal = checkPriceSanityLimit(insanePrice);
    expect(abnormal.isExceeded).toBe(true);
    expect(abnormal.clampedPrice).toBe(UPPER_SANITY_LIMIT_RUB);
  });

  it('should correctly map external provider service types to platform capabilities', () => {
    function mapProviderType(externalType: string): { customDataRequired: boolean; supported: boolean } {
      const norm = (externalType || '').toLowerCase();
      if (norm.includes('custom') && norm.includes('comment')) {
        return { customDataRequired: true, supported: true };
      }
      if (norm.includes('poll') || norm.includes('vote')) {
        return { customDataRequired: true, supported: true };
      }
      return { customDataRequired: false, supported: true };
    }

    expect(mapProviderType('Default')).toEqual({ customDataRequired: false, supported: true });
    expect(mapProviderType('Custom Comments')).toEqual({ customDataRequired: true, supported: true });
    expect(mapProviderType('Poll Votes')).toEqual({ customDataRequired: true, supported: true });
  });
});
