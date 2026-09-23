import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { marketingService } from '@/services/marketing.service';
import { db } from '@/lib/db';
import { SettingsProvider } from '@/lib/settings';
import { calculateSafetyFloorCents, MAX_TOTAL_DISCOUNT } from '@/lib/financial-constants';

vi.mock('@/lib/db', () => ({
  db: {
    user: { findUnique: vi.fn() },
    service: { findUnique: vi.fn() },
    promoCode: { findUnique: vi.fn() }
  }
}));

vi.mock('@/lib/settings', () => ({
  SettingsProvider: {
    getExchangeRateUSD: vi.fn()
  }
}));

describe('PricingService Property-Based Tests (Fast-Check)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-13T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Инвариант: Итоговая цена никогда не должна быть ниже Safety Floor (защита от убытков)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.double({ min: 0.01, max: 100.0, noNaN: true }), // rate (USD/1000)
        fc.double({ min: 1.0, max: 10.0, noNaN: true }),    // markup (multiplier)
        fc.integer({ min: 100, max: 10000 }), // quantity
        fc.double({ min: 0, max: 100.0, noNaN: true }),    // personalDiscount (%)
        fc.double({ min: 0, max: 100.0, noNaN: true }),    // promoDiscount (%)
        fc.double({ min: 80, max: 120.0, noNaN: true }),   // exchangeRate (RUB/USD)
        fc.constant('PERCENT'),                            // promoType
        fc.integer({ min: 0, max: 1000000 }),              // promoFixedAmount (Cents)
        async (rate, markup, quantity, personalDiscount, promoDiscount, exchangeRate, promoType, promoFixedAmount) => {
          // Setup mocks
          vi.mocked(db.service.findUnique).mockResolvedValue({
            id: 'svc_1',
            rate,
            markup,
            minQty: 1,
            maxQty: 1000000,
            isActive: true
          } as any);

          vi.mocked(db.user.findUnique).mockResolvedValue({
            id: 'user_1',
            personalDiscount,
            totalSpent: BigInt(0),
            balance: BigInt(0),
            quarantineBalance: BigInt(0)
          } as any);

          vi.mocked(db.promoCode.findUnique).mockResolvedValue({
            code: 'PROMO',
            isActive: true,
            discountPercent: promoDiscount,
            amount: promoFixedAmount,
            type: promoType,
            maxUses: 0,
            uses: 0
          } as any);

          vi.mocked(SettingsProvider.getExchangeRateUSD).mockResolvedValue(exchangeRate);

          const result = await marketingService.calculatePrice('user_1', 'svc_1', quantity, 'PROMO');

          // Assertions
          expect(result.totalCents).toBeGreaterThanOrEqual(result.safetyFloorCents);
          expect(result.totalCents).toBeGreaterThanOrEqual(result.providerCostCents);

          // Для ПРОЦЕНТНЫХ скидок — 30% лимит применяется
          if (promoType === 'PERCENT') {
            expect(result.discountPercent).toBeLessThanOrEqual(MAX_TOTAL_DISCOUNT);
          }
          // Для ВАУЧЕРОВ — единственный лимит это Safety Floor
          // discountPercent может превышать 30% — это намеренное бизнес-решение (см. ARCH-1 в BACKLOG.md)
          // (он проверяется выше: result.totalCents >= result.safetyFloorCents)
          
          // Проверка формулы: totalCents = originalTotalCents - discountCents (с учетом Safety Floor)
          if (result.totalCents > result.originalTotalCents) {
            expect(result.totalCents).toBe(result.safetyFloorCents);
            expect(result.discountCents).toBe(0);
          } else {
            expect(result.totalCents + result.discountCents).toBe(result.originalTotalCents);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Инвариант: Скидка не может быть отрицательной и не может превышать оригинал', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.double({ min: 0.1, max: 50.0, noNaN: true }),   // rate
        fc.integer({ min: 100, max: 5000 }), // quantity
        fc.double({ min: 0, max: 100, noNaN: true }),      // promo discount
        async (rate, quantity, promoDiscount) => {
          vi.mocked(db.service.findUnique).mockResolvedValue({
            id: 'svc_2', rate, markup: 3.0, minQty: 1, maxQty: 100000, isActive: true
          } as any);
          vi.mocked(db.user.findUnique).mockResolvedValue(null);
          vi.mocked(db.promoCode.findUnique).mockResolvedValue({
            code: 'P', isActive: true, discountPercent: promoDiscount, type: 'PERCENT', uses: 0, maxUses: 0
          } as any);
          vi.mocked(SettingsProvider.getExchangeRateUSD).mockResolvedValue(100);

          const result = await marketingService.calculatePrice(null, 'svc_2', quantity, 'P');

          expect(result.discountCents).toBeGreaterThanOrEqual(0);
          expect(result.discountCents).toBeLessThanOrEqual(result.originalTotalCents);
          expect(result.totalCents).toBeGreaterThanOrEqual(result.safetyFloorCents);
          if (result.totalCents > result.originalTotalCents) {
            expect(result.totalCents).toBe(result.safetyFloorCents);
          } else {
            expect(result.totalCents).toBeLessThanOrEqual(result.originalTotalCents);
          }
        }
      )
    );
  });
});
