import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LivePriceValidator } from '@/services/pricing/live-price-validator';

vi.mock('@/utils/ssrf-guard', () => ({
  assertSafeUrl: vi.fn().mockResolvedValue(undefined),
}));

describe('LivePriceValidator (Real-Time Rate Verification & Margin Guard)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. validateProviderServicePrice', () => {
    it('должен подтверждать валидность цены при оптимальном тарифе', async () => {
      const mockServices = [
        { service: '101', name: 'Telegram Members', rate: '0.50', currency: 'USD' },
      ];
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockServices),
      }));

      // Ожидали 46.25 руб (0.50 * 92.5), розница 85.00 руб
      const result = await LivePriceValidator.validateProviderServicePrice({
        apiUrl: 'https://api.provider.com/v2',
        apiKey: 'test_key',
        serviceId: '101',
        expectedCostRub: 46.25,
        retailPriceRub: 85.00,
        usdToRubRate: 92.5,
      });

      expect(result.isValid).toBe(true);
      expect(result.status).toBe('OPTIMAL');
      expect(result.liveCostRub).toBe(46.25);
      expect(result.deltaPercent).toBe(0);
      expect(result.isPriceSpike).toBe(false);
    });

    it('должен фиксировать скачок цены (Price Spike > 15%)', async () => {
      const mockServices = [
        { service: '101', name: 'Telegram Members', rate: '0.65', currency: 'USD' }, // Выросла с 0.50 до 0.65 (+30%)
      ];
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockServices),
      }));

      const result = await LivePriceValidator.validateProviderServicePrice({
        apiUrl: 'https://api.provider.com/v2',
        apiKey: 'test_key',
        serviceId: '101',
        expectedCostRub: 46.25,
        retailPriceRub: 120.00,
        usdToRubRate: 92.5,
      });

      expect(result.isPriceSpike).toBe(true);
      expect(result.deltaPercent).toBeGreaterThan(15.0);
      expect(result.status).toBe('PRICE_INCREASED');
      expect(result.isValid).toBe(false);
    });

    it('должен блокировать заказ при нарушении минимальной маржи (Margin Violation)', async () => {
      const mockServices = [
        { service: '202', name: 'VK Likes', rate: '75.0', currency: 'RUB' },
      ];
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockServices),
      }));

      // Розничная цена 80.0 руб при себестоимости 75.0 руб (маржа всего 6.25% < 30%)
      const result = await LivePriceValidator.validateProviderServicePrice({
        apiUrl: 'https://api.provider.com/v2',
        apiKey: 'test_key',
        serviceId: '202',
        expectedCostRub: 75.0,
        retailPriceRub: 80.0,
      });

      expect(result.isValid).toBe(false);
      expect(result.status).toBe('MARGIN_VIOLATION');
      expect(result.reason).toContain('Маржа упала');
    });

    it('должен возвращать статус UNAVAILABLE при удалении услуги поставщиком', async () => {
      const mockServices = [
        { service: '999', name: 'Other Service', rate: '10.0' },
      ];
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockServices),
      }));

      const result = await LivePriceValidator.validateProviderServicePrice({
        apiUrl: 'https://api.provider.com/v2',
        apiKey: 'test_key',
        serviceId: 'missing_id',
        expectedCostRub: 10.0,
        retailPriceRub: 25.0,
      });

      expect(result.isValid).toBe(false);
      expect(result.status).toBe('UNAVAILABLE');
      expect(result.reason).toContain('SERVICE_DELETED');
    });
  });

  describe('2. calculateLiveStarsCost (Fragment TON & OTC Arbitrage)', () => {
    it('должен динамически рассчитывать себестоимость Stars по курсу доллара и OTC дисконту', () => {
      const result = LivePriceValidator.calculateLiveStarsCost({
        tonToUsd: 5.5,
        usdToRub: 92.0,
        starsCount: 1000,
        otcDiscountPercent: 35.0, // 35% скидка на OTC
      });

      // 1000 Stars = $15 * 92 = 1380 руб официальный
      expect(result.officialFragmentRub).toBe(1380);
      // С 35% дисконтом = 1380 * 0.65 = 897 руб
      expect(result.discountedOtcRub).toBe(897);
      // 0.90 руб за 1 звезду
      expect(result.costPerStarRub).toBe(0.9);
      expect(result.recommendedRetailPerStarRub).toBe(1.62);
    });
  });

  describe('3. verifyOrderMarginSafety (Pre-Checkout ExactMath BigInt Guard)', () => {
    it('должен пропускать безопасные заказы с маржой >= 20%', () => {
      const check = LivePriceValidator.verifyOrderMarginSafety({
        chargeKopecks: 10000n, // 100.00 руб
        providerCostKopecks: 5000n, // 50.00 руб
        minMarginBps: 2000n, // 20.00%
      });

      expect(check.isSafe).toBe(true);
      expect(check.marginPercent).toBe(50);
      expect(check.profitKopecks).toBe(5000n);
    });

    it('должен блокировать заказ при убыточной или нулевой марже', () => {
      const check = LivePriceValidator.verifyOrderMarginSafety({
        chargeKopecks: 4000n, // Клиент платит 40 руб
        providerCostKopecks: 6000n, // Поставщик спишет 60 руб
      });

      expect(check.isSafe).toBe(false);
      expect(check.marginPercent).toBe(0);
      expect(check.profitKopecks).toBe(-2000n);
    });
  });
});
