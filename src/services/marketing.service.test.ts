import { describe, it, expect, vi, beforeEach } from 'vitest';
import { marketingService } from './marketing.service';
import { db } from '@/lib/db';
import {
  calculateSafetyFloorCents,
  MAX_TOTAL_DISCOUNT,
  TOTAL_MANDATORY_DEDUCTIONS,
  SAFETY_FLOOR_MARKUP,
  applyBeautifulRounding,
} from '@/lib/financial-constants';

const MOCK_USD_TO_RUB = 95.0;

vi.mock('@/lib/db', () => ({
  db: {
    user: { findUnique: vi.fn() },
    service: { findUnique: vi.fn() },
    promoCode: { findUnique: vi.fn(), update: vi.fn() },
  }
}));

vi.mock('@/lib/settings', () => ({
  SettingsProvider: {
    getExchangeRateUSD: vi.fn().mockResolvedValue(95.0)
  }
}));

describe('MarketingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getVolumeTier', () => {
    it('returns PLATINUM for >= 1,000,000 RUB', () => {
      expect(marketingService.getVolumeTier(100_000_00)).toEqual({ name: 'PLATINUM', discountPercent: 15.0 });
    });
    it('returns GOLD for >= 250,000 RUB', () => {
      expect(marketingService.getVolumeTier(25_000_00)).toEqual({ name: 'GOLD', discountPercent: 10.0 });
    });
    it('returns SILVER for >= 50,000 RUB', () => {
      expect(marketingService.getVolumeTier(5_000_00)).toEqual({ name: 'SILVER', discountPercent: 5.0 });
    });
    it('returns BRONZE for >= 10,000 RUB', () => {
      expect(marketingService.getVolumeTier(1_000_00)).toEqual({ name: 'BRONZE', discountPercent: 2.0 });
    });
    it('returns REGULAR for < 10,000 RUB', () => {
      expect(marketingService.getVolumeTier(500_00)).toEqual({ name: 'REGULAR', discountPercent: 0.0 });
    });
  });

  describe('calculatePrice', () => {
    it('throws if service not found', async () => {
      vi.mocked(db.service.findUnique).mockResolvedValueOnce(null);
      await expect(marketingService.calculatePrice(null, 'srv1', 100)).rejects.toThrow('Service not found');
    });

    it('throws if quantity out of bounds', async () => {
      vi.mocked(db.service.findUnique).mockResolvedValueOnce({ id: 'srv1', minQty: 10, maxQty: 100 } as any);
      await expect(marketingService.calculatePrice(null, 'srv1', 5)).rejects.toThrow('Quantity must be between 10 and 100');
      
      vi.mocked(db.service.findUnique).mockResolvedValueOnce({ id: 'srv1', minQty: 10, maxQty: 100 } as any);
      await expect(marketingService.calculatePrice(null, 'srv1', 101)).rejects.toThrow('Quantity must be between 10 and 100');
    });

    it('calculates default price with no user/discounts', async () => {
      vi.mocked(db.service.findUnique).mockResolvedValueOnce({ id: 'srv1', minQty: 10, maxQty: 100, rate: 1.0, providerCurrency: 'USD', markup: 6.0 } as any);
      const res = await marketingService.calculatePrice(null, 'srv1', 50);
      
      const expectedProviderCostCents = Math.round(((1.0 * MOCK_USD_TO_RUB * 100) / 1000) * 50);
      const rawRetailPer1000Rub = 1.0 * 6.0 * MOCK_USD_TO_RUB;
      const beautifulRetailPer1000Rub = applyBeautifulRounding(rawRetailPer1000Rub);
      const expectedTotal = Math.round((beautifulRetailPer1000Rub * 100 / 1000) * 50);
      
      expect(res.discountPercent).toBe(0);
      expect(res.discountCents).toBe(0);
      expect(res.originalTotalCents).toBe(expectedTotal);
      expect(res.totalCents).toBe(expectedTotal);
      expect(res.tier).toBe('REGULAR');
    });

    it('applies maximum discount and capping at 30%', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValueOnce({ id: 'user1', totalSpent: 100_000_00, personalDiscount: 35.0 } as any);
      vi.mocked(db.service.findUnique).mockResolvedValueOnce({ id: 'srv1', minQty: 10, maxQty: 100, rate: 1.0, providerCurrency: 'USD', markup: 8.0 } as any);

      const res = await marketingService.calculatePrice('user1', 'srv1', 50);
      expect(res.discountPercent).toBe(30.0); // Capped at MAX_TOTAL_DISCOUNT (30)
    });

    it('applies DISCOUNT promo correctly and falls back to safety floor if needed', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValueOnce({ id: 'user1', totalSpent: 0, personalDiscount: 0 } as any);
      vi.mocked(db.service.findUnique).mockResolvedValueOnce({ id: 'srv1', minQty: 10, maxQty: 100, rate: 1.0, providerCurrency: 'USD', markup: 1.5 } as any);
      vi.mocked(db.promoCode.findUnique).mockResolvedValueOnce({ id: 'pr1', code: 'PROMO', isActive: true, maxUses: 0, expiresAt: null, type: 'DISCOUNT', discountPercent: 99.0 } as any);

      const res = await marketingService.calculatePrice('user1', 'srv1', 50, 'PROMO');
      
      // Safety floor check: it handles the huge voucher
      expect(res.totalCents).toBe(res.safetyFloorCents);
      expect(res.totalCents).toBeGreaterThan(0);
    });

    it('does not apply invalid promo code', async () => {
       vi.mocked(db.service.findUnique).mockResolvedValueOnce({ id: 'srv1', minQty: 10, maxQty: 100, rate: 1.0, providerCurrency: 'USD', markup: 3.0 } as any);
       vi.mocked(db.promoCode.findUnique).mockResolvedValueOnce(null);
       const res = await marketingService.calculatePrice(null, 'srv1', 50, 'INVALID');
       expect(res.discountPercent).toBe(0);
    });

    it('enforces a safety floor of 1 cent for micro-priced service with low quantity', async () => {
       vi.mocked(db.service.findUnique).mockResolvedValueOnce({ id: 'srv1', minQty: 1, maxQty: 100, rate: 0.0003, providerCurrency: 'USD', markup: 1.1 } as any);
       const res = await marketingService.calculatePrice(null, 'srv1', 1);
       
       expect(res.originalTotalCents).toBe(1);
       expect(res.providerCostCents).toBe(1);
       expect(res.totalCents).toBe(1); // Break-even floor min(originalTotalCents, rawBreakEvenCents) = 1
    });

    it('enforces a minimum price of 1 cent even with 100% discount on free provider service (capped at MAX_TOTAL_DISCOUNT)', async () => {
       vi.mocked(db.service.findUnique).mockResolvedValueOnce({ id: 'srv1', minQty: 10, maxQty: 100, rate: 0.0, providerCurrency: 'USD', markup: 1.5 } as any);
       vi.mocked(db.promoCode.findUnique).mockResolvedValueOnce({ id: 'pr1', code: 'FREE', isActive: true, maxUses: 0, expiresAt: null, type: 'DISCOUNT', discountPercent: 100.0 } as any);
       
       const res = await marketingService.calculatePrice(null, 'srv1', 10, 'FREE');
       expect(res.totalCents).toBe(7); // 10 original cents - 30% max discount = 7 cents
    });
  });

  describe('consumePromoCode', () => {
    it('does nothing if no code provided', async () => {
      await expect(marketingService.consumePromoCode({} as any, null)).resolves.toBeUndefined();
    });

    it('throws if promo is invalid/inactive', async () => {
      const tx = { promoCode: { findUnique: vi.fn().mockResolvedValueOnce({ isActive: false }) } } as any;
      await expect(marketingService.consumePromoCode(tx, 'CODE')).rejects.toThrow('Промокод недействителен');
    });

    it('throws if promo uses maxed out', async () => {
      const tx = { promoCode: { findUnique: vi.fn().mockResolvedValueOnce({ isActive: true, maxUses: 1, uses: 1 }) } } as any;
      await expect(marketingService.consumePromoCode(tx, 'CODE')).rejects.toThrow('Лимит использований промокода исчерпан');
    });

    it('throws if promo is expired', async () => {
      const tx = { promoCode: { findUnique: vi.fn().mockResolvedValueOnce({ isActive: true, maxUses: 0, expiresAt: new Date(Date.now() - 1000) }) } } as any;
      await expect(marketingService.consumePromoCode(tx, 'CODE')).rejects.toThrow('Срок действия промокода истёк');
    });

    it('updates uses successfully', async () => {
      const tx = { 
        promoCode: { 
          findUnique: vi.fn().mockResolvedValueOnce({ id: 'p1', isActive: true, maxUses: 2, uses: 0, expiresAt: null }),
          updateMany: vi.fn().mockResolvedValueOnce({ count: 1 })
        } 
      } as any;
      await expect(marketingService.consumePromoCode(tx, 'CODE')).resolves.toBeUndefined();
    });

    it('throws if concurrent update maxes out limit unexpectedly', async () => {
      const tx = { 
        promoCode: { 
          findUnique: vi.fn().mockResolvedValueOnce({ id: 'p1', isActive: true, maxUses: 1, uses: 0, expiresAt: null }),
          updateMany: vi.fn().mockResolvedValueOnce({ count: 0 })
        } 
      } as any;
      await expect(marketingService.consumePromoCode(tx, 'CODE')).rejects.toThrow('Лимит использований промокода исчерпан');
    });
  });

  describe('getAPIFormattedServices', () => {
    it('returns mapped array capping rates at safety floor with max discounts', async () => {
      const user = { totalSpent: 100_000_00, personalDiscount: 35.0 }; // Platinum (15%), personal (35%) => Capped at 30%
      const services = [{
        numericId: 1, name: 'S1', rate: 1.0, markup: 8.0, minQty: 10, maxQty: 100, isDripFeedEnabled: false, isRefillEnabled: true, isCancelEnabled: true, category: { name: 'C1' }
      }];
      
      const res = await marketingService.getAPIFormattedServices(user, services);
      expect(res.length).toBe(1);
      expect(res[0].service).toBe(1);
      expect(res[0].rate).toBeDefined();

      const originalRate = 1.0 * 8.0 * MOCK_USD_TO_RUB;
      const expectedDiscounted = originalRate * (1 - 30 / 100);
      expect(Number(res[0].rate)).toBe(Number(expectedDiscounted.toFixed(4)));
    });

    it('applies safety floor if discount pushes API rate too low', async () => {
      const user = { totalSpent: 0, personalDiscount: 30.0 }; // 30% discount
      // Low markup (1.2), discount will drop it below cost+taxes
      const services = [{
        numericId: 2, name: 'S2', rate: 1.0, markup: 1.1, minQty: 10, maxQty: 100, isDripFeedEnabled: false, isRefillEnabled: true, isCancelEnabled: true, category: { name: 'C2' }
      }];
      
      const res = await marketingService.getAPIFormattedServices(user, services);
      
      const safetyFloor = (1.0 * MOCK_USD_TO_RUB * (1 + SAFETY_FLOOR_MARKUP)) / (1 - TOTAL_MANDATORY_DEDUCTIONS);
      expect(Number(res[0].rate)).toBe(Number(safetyFloor.toFixed(4)));
    });
  });
});
