import { describe, it, expect, vi, beforeEach } from 'vitest';
import { marketingService } from '../../src/services/marketing.service';
import { calculateSafetyFloorCents, MAX_TOTAL_DISCOUNT } from '../../src/lib/financial-constants';

// Mock DB and Settings to isolate mathematical logic
vi.mock('@/lib/db', () => ({
  db: {
    user: { findUnique: vi.fn() },
    service: { findUnique: vi.fn() },
    promoCode: { findUnique: vi.fn() }
  }
}));

import { db } from '@/lib/db';
import { SettingsProvider } from '@/lib/settings';

describe('Pricing Invariants & Property Tests', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(SettingsProvider, 'getExchangeRateUSD').mockResolvedValue(100);
  });

  const setupMocks = (
    userTotalSpent: number,
    userPersonalDiscount: number,
    serviceRate: number,
    promoType: string | null = null,
    promoDiscount: number = 0,
    serviceMarkup: number = 100
  ) => {
    // @ts-expect-error: override for testing
    db.user.findUnique.mockResolvedValue({
      id: 'test-user',
      totalSpent: BigInt(userTotalSpent),
      personalDiscount: userPersonalDiscount
    });

    // @ts-expect-error: override for testing
    db.service.findUnique.mockResolvedValue({
      id: 'test-service',
      rate: serviceRate,
      markup: serviceMarkup,
      minQty: 10,
      maxQty: 100000
    });

    if (promoType) {
      // @ts-expect-error: override for testing
      db.promoCode.findUnique.mockResolvedValue({
        code: 'TESTPROMO',
        isActive: true,
        maxUses: 0,
        uses: 0,
        type: promoType,
        discountPercent: promoType === 'PERCENTAGE' ? promoDiscount : 0,
        amount: promoType === 'VOUCHER' ? promoDiscount : 0
      });
    } else {
      // @ts-expect-error: override for testing
      db.promoCode.findUnique.mockResolvedValue(null);
    }
  };

  it('Invariant 1: Discount must never exceed MAX_TOTAL_DISCOUNT (30%)', async () => {
    // 50% personal discount, 50% promo code -> Should cap at MAX_TOTAL_DISCOUNT
    setupMocks(0, 50, 1.0, 'PERCENTAGE', 50);

    const result = await marketingService.calculatePrice('test-user', 'test-service', 1000, 'TESTPROMO');
    
    expect(result.discountPercent).toBeLessThanOrEqual(MAX_TOTAL_DISCOUNT);
  });

  it('Invariant 2: Final price never drops below Safety Floor', async () => {
    // Service Rate: $1.0 = 100 RUB = 10,000 cents per 1000 items
    // Qty: 1000 -> Provider Cost = 10,000 cents
    // Markup is very low (1.1) to trigger safety floor
    setupMocks(0, 0, 1.0, 'PERCENTAGE', 30, 1.1);

    const result = await marketingService.calculatePrice('test-user', 'test-service', 1000, 'TESTPROMO');
    
    expect(result.totalCents).toBeGreaterThanOrEqual(result.safetyFloorCents);
    // Even though the voucher is huge, the math adjusts discountCents to respect the floor
    expect(result.totalCents).toBe(result.safetyFloorCents);
  });

  it('Invariant 3: Discount percentage correctly recalculates if Safety Floor triggered', async () => {
    // Markup is very low (1.1) to trigger safety floor
    setupMocks(0, 0, 1.0, 'PERCENTAGE', 30, 1.1); // Massive discount to trigger floor

    const result = await marketingService.calculatePrice('test-user', 'test-service', 1000, 'TESTPROMO');
    
    // originalTotalCents is cost (10,000) * markup (1.1) = 11,000 cents.
    // safetyFloorCents = Math.ceil((10000 * 2) / 0.855) = 23392 cents.
    
    expect(result.totalCents).toBe(result.safetyFloorCents);
    expect(result.discountPercent).toBeLessThanOrEqual(100);
    // True discount applied: original - total
    expect(result.discountCents).toBe(Math.max(0, result.originalTotalCents - result.totalCents));
  });

  // Fuzzy test simulating property-based testing
  it('Fuzzy Test: Random inputs always respect financial boundaries', async () => {
    const RUNS = 100;
    
    for (let i = 0; i < RUNS; i++) {
      const rate = Math.random() * 10; // $0 to $10
      const markup = Math.floor(Math.random() * 200) + 10; // 10% to 210%
      const qty = Math.floor(Math.random() * 50000) + 10;
      const personalDiscount = Math.random() * 100;
      const totalSpent = Math.floor(Math.random() * 200000000); // Up to 2m RUB
      
      // Setup dynamic mock for each run
      // @ts-expect-error: override for testing
      db.user.findUnique.mockResolvedValue({ totalSpent: BigInt(totalSpent), personalDiscount });
      // @ts-expect-error: override for testing
      db.service.findUnique.mockResolvedValue({ rate, markup, minQty: 1, maxQty: 1000000 });

      const result = await marketingService.calculatePrice('test-user', 'test-service', qty);
      
      // Post-conditions
      expect(result.totalCents).toBeGreaterThanOrEqual(0);
      expect(result.totalCents).toBeGreaterThanOrEqual(result.safetyFloorCents);
      expect(result.discountPercent).toBeLessThanOrEqual(MAX_TOTAL_DISCOUNT);
      expect(result.originalTotalCents).toBe(result.totalCents + result.discountCents);
    }
  });
});
