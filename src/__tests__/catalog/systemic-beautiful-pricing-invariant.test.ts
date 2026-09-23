import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyBeautifulRounding, calculateSafetyFloorCents } from '@/lib/financial-constants';
import { applyAntiNegativeMargin } from '@/lib/pricing/anti-negative-margin';
import { ServiceAuditEngine } from '@/services/admin/audit-engine';
import { getServicesByCategoryAction, getServiceBySlugAction } from '@/actions/order/catalog';
import { formatUnitRub } from '@/lib/money';
import { db } from '@/lib/db';

vi.mock('@/lib/db', () => ({
  db: {
    service: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    network: {
      findMany: vi.fn(),
    },
    settings: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('@/lib/settings', () => ({
  SettingsProvider: {
    getExchangeRateUSD: vi.fn().mockResolvedValue(95),
    isTestEnvironment: vi.fn().mockReturnValue(true),
    get: vi.fn().mockResolvedValue({ globalMarkup: 3.0 }),
  },
  SettingsManager: {
    getExchangeRateUSD: vi.fn().mockResolvedValue(95),
    get: vi.fn().mockResolvedValue({ globalMarkup: 3.0 }),
  },
}));

describe('🛡️ Systemic Beautiful Pricing & Zero-Ugly-Fractions Invariant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Beautiful Rounding Mathematical Precision', () => {
    it('rounds sub-1000 prices up to nearest 10 RUB', () => {
      expect(applyBeautifulRounding(258.72)).toBe(260);
      expect(applyBeautifulRounding(359.04)).toBe(360);
      expect(applyBeautifulRounding(242.55)).toBe(250);
      expect(applyBeautifulRounding(1.05)).toBe(10);
      expect(applyBeautifulRounding(9.99)).toBe(10);
      expect(applyBeautifulRounding(11.01)).toBe(20);
    });

    it('rounds 1000+ RUB prices up to nearest 100 RUB', () => {
      expect(applyBeautifulRounding(1123.44)).toBe(1200);
      expect(applyBeautifulRounding(1045.44)).toBe(1100);
      expect(applyBeautifulRounding(3803.02)).toBe(3900);
      expect(applyBeautifulRounding(7799.89)).toBe(7800);
    });

    it('handles zero and negative rates gracefully', () => {
      expect(applyBeautifulRounding(0)).toBe(0);
      expect(applyBeautifulRounding(-50)).toBe(0);
    });
  });

  describe('2. Anti-Negative-Margin with Guaranteed Beautiful Floor', () => {
    it('applies beautiful rounding to regular margin calculation', () => {
      const res = applyAntiNegativeMargin(161.7, 161.7 * 1.6);
      expect(res.finalRetailPer1kRub).toBe(260);
      expect(res.finalRetailPer1kCents).toBe(26000);
      expect(res.wasFloored).toBe(false);
    });

    it('applies beautiful rounding even when price is floored to safe cost or min margin', () => {
      // cost 161.70, requested retail 50 -> must floor and round up beautifully
      const res = applyAntiNegativeMargin(161.7, 50, 5);
      expect(res.wasFloored).toBe(true);
      expect(res.finalRetailPer1kRub).toBe(170); // 161.7 * 1.05 = 169.785 -> rounded up to 170
      expect(res.finalRetailPer1kCents).toBe(17000);
    });
  });

  describe('3. ServiceAuditEngine Markup & Pricing Normalization', () => {
    it('corrects ugly unrounded prices during audit regardless of markup value', () => {
      const service = {
        id: 'svc_vk_sub',
        name: 'VK Подписчики Стандарт',
        description: 'Без списаний',
        markup: 1.6,
        pricePer1000Cents: 25872, // Raw unrounded price
        isQuarantined: false,
        quarantineReason: null,
        quarantinedAt: null,
      };

      const external = { rate: 161.7 };
      const exchangeRate = 1.0; // RUB

      const payloads = ServiceAuditEngine.auditAndFixService(service, external, exchangeRate);
      expect(payloads.length).toBe(1);
      expect(service.pricePer1000Cents).toBe(26000); // Corrected to 260.00 RUB
    });
  });

  describe('4. Storefront DTO Layer Guarantee (No unrounded floats leak to frontend)', () => {
    it('sanitizes legacy unrounded DB prices in getServicesByCategoryAction', async () => {
      (vi.mocked(db.service.findMany) as any).mockResolvedValue([
        {
          id: 'svc_legacy_1',
          numericId: 101,
          slug: 'vk-subs-1',
          categoryId: 'cat_vk_subs',
          name: 'VK Подписчики Стандарт',
          description: 'Описание',
          minQty: 100,
          maxQty: 10000,
          isDripFeedEnabled: false,
          isRefillEnabled: true,
          targetType: 'CHANNEL',
          qualityTier: 'STANDARD',
          customDataType: null,
          customDataLabel: null,
          clientRequirement: null,
          clientConfirmation: null,
          features: {},
          cooldownUntil: null,
          etaP50Seconds: 300,
          etaP90Seconds: 600,
          etaSpeedClass: 'Быстрая',
          requireWarning: false,
          warningMessage: null,
          providerCurrency: 'RUB',
          costPer1kRub: 161.7,
          pricePer1000Cents: 25872, // Unrounded raw DB value
          markup: 1.6,
          rate: 161.7,
          smartConfig: null,
        },
        {
          id: 'svc_legacy_2',
          numericId: 102,
          slug: 'vk-clips-1',
          categoryId: 'cat_vk_clips',
          name: 'VK Просмотры Клипы',
          description: 'Быстрые',
          minQty: 500,
          maxQty: 50000,
          isDripFeedEnabled: false,
          isRefillEnabled: false,
          targetType: 'POST',
          qualityTier: 'ECONOMY',
          customDataType: null,
          customDataLabel: null,
          clientRequirement: null,
          clientConfirmation: null,
          features: {},
          cooldownUntil: null,
          etaP50Seconds: 60,
          etaP90Seconds: 120,
          etaSpeedClass: 'Мгновенная',
          requireWarning: false,
          warningMessage: null,
          providerCurrency: 'RUB',
          costPer1kRub: 2.91,
          pricePer1000Cents: 582, // Unrounded 5.82 RUB / 1k -> 0.00582 / unit
          markup: 2.0,
          rate: 2.91,
          smartConfig: null,
        }
      ]);

      const services = await getServicesByCategoryAction('cat_vk_subs', 'smmplan');
      expect(services).toHaveLength(2);

      // Service 1: 258.72 -> Beautifully rounded to 260.00 RUB -> 0.26 RUB / unit
      expect(services[0].pricePer1kRub).toBe(260);
      expect(services[0].pricePerUnitRub).toBe(0.26);

      // Service 2: 5.82 -> Beautifully rounded to 10.00 RUB -> 0.01 RUB / unit (NO 0.00582!)
      expect(services[1].pricePer1kRub).toBe(10);
      expect(services[1].pricePerUnitRub).toBe(0.01);
    });

    it('sanitizes legacy unrounded DB prices in getServiceBySlugAction', async () => {
      (vi.mocked(db.service.findFirst) as any).mockResolvedValue({
        id: 'svc_legacy_3',
        numericId: 103,
        slug: 'vk-sub-vip',
        categoryId: 'cat_vk_subs',
        name: 'VK Подписчики VIP',
        description: 'Премиум качество',
        minQty: 100,
        maxQty: 10000,
        rate: 702.15,
        markup: 1.6,
        costPer1kRub: 702.15,
        providerCurrency: 'RUB',
        pricePer1000Cents: 112344, // Unrounded 1123.44 RUB
        category: {
          network: { isActive: true }
        },
        provider: { name: 'Prov 1', ticketUrl: null }
      });

      const service = await getServiceBySlugAction('vk-sub-vip', 'smmplan');
      expect(service).not.toBeNull();
      // 1123.44 -> Beautifully rounded to 1200.00 RUB -> 1.20 RUB / unit
      expect(service!.pricePer1kRub).toBe(1200);
      expect(service!.pricePerUnitRub).toBe(1.2);
    });
  });

  describe('5. Unit Price Formatting Helper (formatUnitRub)', () => {
    it('formats unit prices cleanly without floating point tail garbage', () => {
      expect(formatUnitRub(0.26)).toBe('0,26');
      expect(formatUnitRub(1.2)).toBe('1,20');
      expect(formatUnitRub(0.01)).toBe('0,01');
      expect(formatUnitRub(0.005)).toBe('0,005');
      expect(formatUnitRub(null)).toBe('0 ₽');
    });
  });
});
