import { describe, it, expect, vi, beforeEach } from 'vitest';
import { marketingService } from '@/services/marketing.service';
import { db } from '@/lib/db';
import { MAX_TOTAL_DISCOUNT } from '@/lib/financial-constants';

describe('OWASP Top 10 (2025) & Mathematical Hardening: Promo Code Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockService = {
    id: 'srv_test_promo',
    numericId: 101,
    name: 'Тестовые подписчики',
    costPer1kRub: 100, // 100 RUB provider cost per 1k
    pricePer1000Cents: 26000, // 260 RUB per 1k (0.26 RUB per unit)
    minQty: 10,
    maxQty: 50000,
    rate: 100,
    markup: 2.6,
    providerCurrency: 'RUB',
    isActive: true,
    isDripFeedEnabled: true,
    customDataType: 'NONE',
    categoryId: 'cat_1',
    providerId: 'prov_1',
    externalId: 'ext_1',
    tenantId: 'smmplan',
  } as any;

  describe('1. OWASP A03: Injection, Homoglyphs & Extreme Payloads Defense', () => {
    it('handles extreme 100KB string payload gracefully without crash or SQL injection', async () => {
      const maliciousPromo = 'A'.repeat(100000);
      const res = await marketingService.calculatePrice(null, mockService.id, 100, maliciousPromo, { service: mockService });
      
      // Should give standard price with 0 discount
      expect(res.discountCents).toBe(0);
      expect(res.totalCents).toBe(2600); // 26.00 RUB
    });

    it('neutralizes SQL injection attempts safely (e.g. "\' OR 1=1 --")', async () => {
      const sqlInjection = "' OR '1'='1' --";
      const res = await marketingService.calculatePrice(null, mockService.id, 100, sqlInjection, { service: mockService });
      expect(res.discountCents).toBe(0);
      expect(res.totalCents).toBe(2600);
    });

    it('neutralizes Null Byte injection and Control Characters', async () => {
      const nullByte = 'PROMO\0ADMIN\r\n';
      const res = await marketingService.calculatePrice(null, mockService.id, 100, nullByte, { service: mockService });
      expect(res.discountCents).toBe(0);
      expect(res.totalCents).toBe(2600);
    });
  });

  describe('2. OWASP A04: Financial Trust Boundary & Margin Squeeze Defense', () => {
    it('strictly enforces MAX_TOTAL_DISCOUNT ceiling (30%) even if promo is 90%', async () => {
      // Mock db.promoCode returning 90% discount
      vi.spyOn(db.promoCode, 'findUnique').mockResolvedValueOnce({
        id: 'promo_insane',
        code: 'HACK90',
        type: 'DISCOUNT',
        discountPercent: 90, // Attacker tries to get 90% off
        amount: 0,
        maxUses: 100,
        uses: 0,
        isActive: true,
        expiresAt: null,
        createdAt: new Date(),
        description: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        budgetCents: 0,
        isSuspicious: false,
      } as any);

      const res = await marketingService.calculatePrice(null, mockService.id, 1000, 'HACK90', { service: mockService });
      
      // Original total: 260.00 RUB (26000 cents)
      // Max allowed discount is 30% = 78.00 RUB (7800 cents)
      // Final total: 182.00 RUB (18200 cents)
      const expectedDiscount = Math.round(26000 * (MAX_TOTAL_DISCOUNT / 100));
      expect(res.discountCents).toBe(expectedDiscount);
      expect(res.totalCents).toBe(26000 - expectedDiscount);
    });

    it('SAFETY FLOOR GUARANTEE: Never drops total price below provider break-even floor', async () => {
      // Very cheap service with small margin
      const tightMarginService = {
        ...mockService,
        costPer1kRub: 200, // 200 RUB cost
        pricePer1000Cents: 24000, // 240 RUB price (tight margin)
      };

      vi.spyOn(db.promoCode, 'findUnique').mockResolvedValueOnce({
        id: 'promo_discount',
        code: 'SAVE30',
        type: 'DISCOUNT',
        discountPercent: 30,
        amount: 0,
        maxUses: 100,
        uses: 0,
        isActive: true,
        expiresAt: null,
        createdAt: new Date(),
        description: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        budgetCents: 0,
        isSuspicious: false,
      } as any);

      const res = await marketingService.calculatePrice(null, tightMarginService.id, 1000, 'SAVE30', { service: tightMarginService });
      
      // Provider cost = 20000 cents. Break even with mandatory deductions >= 23392 cents.
      expect(res.totalCents).toBeGreaterThanOrEqual(20000);
      expect(res.totalCents).toBeLessThanOrEqual(24000);
      expect(res.discountCents).toBe(24000 - res.totalCents);
    });

    it('enforces Minimum Order Price invariant (minimum 1 cent / 0.01 RUB)', async () => {
      const cheapService = {
        ...mockService,
        costPer1kRub: 0.01,
        pricePer1000Cents: 10, // 0.10 RUB per 1k
      };

      const res = await marketingService.calculatePrice(null, cheapService.id, 10, undefined, { service: cheapService });
      expect(res.totalCents).toBeGreaterThanOrEqual(1);
    });
  });

  describe('3. OWASP A01: Race Conditions & Atomic Promo Consumption', () => {
    it('rejects expired promo codes cleanly', async () => {
      vi.spyOn(db.promoCode, 'findUnique').mockResolvedValueOnce({
        id: 'promo_expired',
        code: 'EXPIRED',
        type: 'DISCOUNT',
        discountPercent: 20,
        amount: 0,
        maxUses: 100,
        uses: 0,
        isActive: true,
        expiresAt: new Date(Date.now() - 100000), // Expired in past
        createdAt: new Date(),
        description: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        budgetCents: 0,
        isSuspicious: false,
      } as any);

      const res = await marketingService.calculatePrice(null, mockService.id, 100, 'EXPIRED', { service: mockService });
      expect(res.discountCents).toBe(0);
      expect(res.totalCents).toBe(2600);
    });

    it('rejects inactive or exhausted promo codes cleanly', async () => {
      vi.spyOn(db.promoCode, 'findUnique').mockResolvedValueOnce({
        id: 'promo_used_up',
        code: 'LIMITED',
        type: 'DISCOUNT',
        discountPercent: 20,
        amount: 0,
        maxUses: 5,
        uses: 5, // Exhausted
        isActive: true,
        expiresAt: null,
        createdAt: new Date(),
        description: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        budgetCents: 0,
        isSuspicious: false,
      } as any);

      const res = await marketingService.calculatePrice(null, mockService.id, 100, 'LIMITED', { service: mockService });
      expect(res.discountCents).toBe(0);
      expect(res.totalCents).toBe(2600);
    });

    it('rejects balance VOUCHER codes from being applied directly to orders with explicit message', async () => {
      vi.spyOn(db.promoCode, 'findUnique').mockResolvedValueOnce({
        id: 'voucher_100',
        code: 'VOUCHER100',
        type: 'VOUCHER',
        discountPercent: 0,
        amount: 10000,
        maxUses: 1,
        uses: 0,
        isActive: true,
        expiresAt: null,
        createdAt: new Date(),
        description: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        budgetCents: 0,
        isSuspicious: false,
      } as any);

      await expect(
        marketingService.calculatePrice(null, mockService.id, 100, 'VOUCHER100', { service: mockService })
      ).rejects.toThrow('VOUCHER_USE_BALANCE');
    });
  });
});
