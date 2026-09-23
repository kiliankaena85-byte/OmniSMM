import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NameTokenizerService } from '@/services/providers/name-tokenizer.service';
import { SmartAnalyzerLogic } from '@/services/providers/smart-analyzer.logic';
import { getServicesByCategoryAction } from '@/actions/order/catalog';
import { db } from '@/lib/db';

vi.mock('@/lib/db', () => ({
  db: {
    service: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/settings', () => ({
  SettingsProvider: {
    getExchangeRateUSD: vi.fn().mockResolvedValue(90.0),
    getSetting: vi.fn().mockResolvedValue(null),
    getCached: vi.fn((fn) => fn),
    isTestEnvironment: vi.fn().mockReturnValue(true),
  },
}));

vi.mock('next/cache', () => ({
  unstable_cache: vi.fn((fn) => fn),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

describe('🛡️ Badge & Warranty Anti-Contradiction Master Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Vector 1: NameTokenizerService Negative vs Positive Refill Patterns', () => {
    const negativeTestCases = [
      'Telegram Подписчики [Без гарантии] [Быстрые] (Live VexBoost)',
      'Instagram Followers [No Refill] [HQ]',
      'VK Likes [0d refill] [Fast]',
      'YouTube Views [Without Warranty] 10k/day',
      'Telegram Members [Без гарантий]',
      'TikTok Followers [non-refill] [Instant]',
      'VK Followers [Без автодокрутки]',
      'Instagram Likes [no drop protection]',
      'Twitter Followers [0 day refill]',
      'Telegram Boosts [без восстановления]',
    ];

    negativeTestCases.forEach((rawName) => {
      it(`correctly recognizes NO refill for: "${rawName}"`, () => {
        const result = NameTokenizerService.tokenize(rawName);
        expect(result.metrics.hasRefill).toBe(false);
      });
    });

    const positiveTestCases = [
      { name: 'Telegram Подписчики [Гарантия 30 дней] [Быстрые]', expectedRefill: true },
      { name: 'Instagram Followers [30d Refill] [HQ]', expectedRefill: true },
      { name: 'YouTube Views [Refill 60d] [Non-Drop]', expectedRefill: true },
      { name: 'VK Likes [Автодокрутка 30 дней]', expectedRefill: true },
      { name: 'TikTok Followers ♻️ 30 days', expectedRefill: true },
      { name: 'Twitter Followers [С гарантией 365 дней]', expectedRefill: true },
    ];

    positiveTestCases.forEach(({ name, expectedRefill }) => {
      it(`correctly recognizes positive refill for: "${name}"`, () => {
        const result = NameTokenizerService.tokenize(name);
        expect(result.metrics.hasRefill).toBe(expectedRefill);
      });
    });
  });

  describe('Vector 2: SmartAnalyzerLogic Warranty & Metric Consistency', () => {
    it('guarantees warranty = 0 and hasRefill = false when name contains "[Без гарантии]"', () => {
      const serviceName = 'Telegram Подписчики [Без гарантии] [Быстрые] (Live VexBoost)';
      const analyzed = SmartAnalyzerLogic.detectSync(serviceName, 'Продвижение Telegram канала', 'SUBSCRIBERS');

      expect(analyzed.warranty).toBe(0);
      expect(analyzed.metrics?.warrantyDays).toBe(0);
      expect(analyzed.metrics?.hasRefill).toBe(false);
      expect(analyzed.speedText).toBe('Быстрая');
    });

    it('guarantees warranty = 30 and hasRefill = true when name contains "[Гарантия 30 дней]"', () => {
      const serviceName = 'Telegram Подписчики [Гарантия 30 дней] [Быстрые]';
      const analyzed = SmartAnalyzerLogic.detectSync(serviceName, 'Качественные подписчики с автодокруткой', 'SUBSCRIBERS');

      expect(analyzed.warranty).toBe(30);
      expect(analyzed.metrics?.warrantyDays).toBe(30);
      expect(analyzed.metrics?.hasRefill).toBe(true);
    });
  });

  describe('Vector 3: Catalog Service Mapper Anti-Contradiction Badge Invariant', () => {
    it('CRITICAL: Never assigns "ГАРАНТИЯ" badge to service with "[Без гарантии]" in name', async () => {
      const mockDbServices = [
        {
          id: 'srv_vex_954',
          numericId: 954,
          slug: 'telegram-subscribers-no-warranty',
          categoryId: 'cat_tg_subs',
          name: 'Telegram Подписчики [Без гарантии] [Быстрые] (Live VexBoost)',
          description: 'Реальная услуга VexBoost ID 1987. Без автодокрутки.',
          rate: 0.009,
          markup: 3.0,
          providerCurrency: 'RUB',
          minQty: 5,
          maxQty: 50000,
          isRefillEnabled: false,
          isDripFeedEnabled: true,
          qualityTier: 'STANDARD',
          targetType: 'CHANNEL',
          customDataType: 'NONE',
          customDataLabel: null,
          features: {
            speedText: '0–1 час',
            startTime: '0–1 час',
            qualityLabel: 'Быстрые',
          },
        },
      ];

      vi.mocked(db.service.findMany).mockResolvedValue(mockDbServices as any);

      const result = await getServicesByCategoryAction('cat_tg_subs', 'smmplan');

      expect(result.length).toBe(1);
      const service = result[0];

      // Anti-Contradiction assertions:
      expect(service.name).toContain('[Без гарантии]');
      expect(service.badge).not.toBe('ГАРАНТИЯ');
      expect(service.badge).toBe('БЫСТРЫЕ'); // Sensible fallback to speed attribute!
      expect(service.isRefillEnabled).toBe(false);
      expect(service.warrantyDays).toBeNull();
    });

    it('assigns "ГАРАНТИЯ" badge only to genuine refillable services with positive warranty', async () => {
      const mockDbServices = [
        {
          id: 'srv_refill_1',
          numericId: 955,
          slug: 'telegram-subscribers-refill-30d',
          categoryId: 'cat_tg_subs',
          name: 'Telegram Подписчики [Гарантия 30 дней] [Премиум]',
          description: 'Качественные подписчики с гарантией.',
          rate: 0.15,
          markup: 3.0,
          providerCurrency: 'RUB',
          minQty: 10,
          maxQty: 100000,
          isRefillEnabled: true,
          isDripFeedEnabled: true,
          qualityTier: 'STANDARD',
          targetType: 'CHANNEL',
          customDataType: 'NONE',
          customDataLabel: null,
          features: {
            warrantyDays: 30,
            hasRefill: true,
            startTime: '0–2 часа',
          },
        },
      ];

      vi.mocked(db.service.findMany).mockResolvedValue(mockDbServices as any);

      const result = await getServicesByCategoryAction('cat_tg_subs', 'smmplan');

      expect(result.length).toBe(1);
      const service = result[0];

      expect(service.badge).toBe('ГАРАНТИЯ');
      expect(service.isRefillEnabled).toBe(true);
      expect(service.warrantyDays).toBe(30);
    });

    it('sanitizes contradictory admin badge override: resets "ГАРАНТИЯ" badge if isRefillEnabled is false', async () => {
      const mockDbServices = [
        {
          id: 'srv_admin_err',
          numericId: 956,
          slug: 'tg-members-err',
          categoryId: 'cat_tg_subs',
          name: 'Telegram Подписчики [Без гарантии] [Быстрые]',
          description: 'Услуга без гарантии',
          rate: 0.05,
          markup: 3.0,
          providerCurrency: 'RUB',
          minQty: 10,
          maxQty: 10000,
          isRefillEnabled: false,
          isDripFeedEnabled: true,
          qualityTier: 'STANDARD',
          targetType: 'CHANNEL',
          customDataType: 'NONE',
          customDataLabel: null,
          features: {
            badge: 'ГАРАНТИЯ', // Admin mistakenly set 'ГАРАНТИЯ' on a no-refill service!
          },
        },
      ];

      vi.mocked(db.service.findMany).mockResolvedValue(mockDbServices as any);

      const result = await getServicesByCategoryAction('cat_tg_subs', 'smmplan');

      expect(result.length).toBe(1);
      const service = result[0];

      // Sanitizer must catch and correct the contradiction:
      expect(service.badge).not.toBe('ГАРАНТИЯ');
      expect(service.badge).toBe('БЫСТРЫЕ');
      expect(service.isRefillEnabled).toBe(false);
    });

    it('respects tier-based badges when tier is explicitly in name or qualityTier', async () => {
      const mockDbServices = [
        {
          id: 'srv_prem',
          numericId: 957,
          slug: 'tg-prem',
          categoryId: 'cat_tg_subs',
          name: 'Telegram Подписчики • Премиум',
          rate: 0.5,
          markup: 3.0,
          providerCurrency: 'RUB',
          minQty: 10,
          maxQty: 1000,
          isRefillEnabled: false,
          isDripFeedEnabled: true,
          qualityTier: 'PREMIUM',
          features: {},
        },
        {
          id: 'srv_econ',
          numericId: 958,
          slug: 'tg-econ',
          categoryId: 'cat_tg_subs',
          name: 'Telegram Подписчики • Эконом',
          rate: 0.01,
          markup: 3.0,
          providerCurrency: 'RUB',
          minQty: 10,
          maxQty: 1000,
          isRefillEnabled: false,
          isDripFeedEnabled: true,
          qualityTier: 'ECONOMY',
          features: {},
        },
      ];

      vi.mocked(db.service.findMany).mockResolvedValue(mockDbServices as any);

      const result = await getServicesByCategoryAction('cat_tg_subs', 'smmplan');

      expect(result[0].badge).toBe('ПРЕМИУМ');
      expect(result[1].badge).toBe('ЭКОНОМ');
    });
  });
});
