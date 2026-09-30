import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DirectProviderScannerService,
  RawProviderServiceSchema,
  RawProviderServicesListSchema,
} from '@/services/providers/direct-provider-scanner';
import { ExactMath } from '@/lib/financial/exact-math';
import { redis } from '@/lib/redis';

// Mock redis for isolated unit testing
vi.mock('@/lib/redis', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn().mockResolvedValue('OK'),
  },
}));

describe('DirectProviderScannerService (SMM Panel API v2 Wholesale Sourcing)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Provider Registry Integrity', () => {
    it('should return at least 45 verified direct providers including screenshot and forum platforms', () => {
      const providers = DirectProviderScannerService.getKnownDirectProviders();
      expect(providers.length).toBeGreaterThanOrEqual(45);

      const providerIds = new Set(providers.map((p) => p.id));
      // Screenshot items
      expect(providerIds.has('partnersoc')).toBe(true);
      expect(providerIds.has('smmpanelus')).toBe(true);
      expect(providerIds.has('websmm')).toBe(true);
      expect(providerIds.has('smmpanel_ru')).toBe(true);
      expect(providerIds.has('ssmm')).toBe(true);
      expect(providerIds.has('socrocket')).toBe(true);
      expect(providerIds.has('likedrom')).toBe(true);
      expect(providerIds.has('streampromotion')).toBe(true);
      expect(providerIds.has('streampromotion_com')).toBe(true);
      expect(providerIds.has('tntsmm')).toBe(true);
      expect(providerIds.has('karandash')).toBe(true);
      expect(providerIds.has('boostlike')).toBe(true);
      expect(providerIds.has('toplike')).toBe(true);
      expect(providerIds.has('smmrise')).toBe(true);
      expect(providerIds.has('vexboost')).toBe(true);
      expect(providerIds.has('smmprime')).toBe(true);
      expect(providerIds.has('looksmm')).toBe(true);
      expect(providerIds.has('prm4u')).toBe(true);
      expect(providerIds.has('prosmm_shop')).toBe(true);
      // Telegram / forum discoveries
      expect(providerIds.has('tgpanel')).toBe(true);
      expect(providerIds.has('cheapsmm')).toBe(true);
      expect(providerIds.has('socbox')).toBe(true);
      expect(providerIds.has('nakrutkacc')).toBe(true);
      expect(providerIds.has('piar4you')).toBe(true);
      expect(providerIds.has('foxsmm')).toBe(true);
    });

    it('should cover all required target networks including Telegram, VK, YouTube, Instagram, TikTok and Streaming', () => {
      const providers = DirectProviderScannerService.getKnownDirectProviders();
      const allNetworks = new Set(providers.flatMap((p) => p.primaryNetworks));

      expect(allNetworks.has('TELEGRAM')).toBe(true);
      expect(allNetworks.has('VK')).toBe(true);
      expect(allNetworks.has('YOUTUBE')).toBe(true);
      expect(allNetworks.has('INSTAGRAM')).toBe(true);
      expect(allNetworks.has('TIKTOK')).toBe(true);
      expect(allNetworks.has('TWITCH')).toBe(true);
      expect(allNetworks.has('KICK')).toBe(true);
    });

    it('should validate that all providers support SMM Panel API v2 methods', () => {
      const providers = DirectProviderScannerService.getKnownDirectProviders();
      for (const p of providers) {
        expect(p.apiUrl).toMatch(/^https:\/\/.+/);
        expect(p.supportedMethods).toContain('services');
        expect(p.supportedMethods).toContain('add');
        expect(p.supportedMethods).toContain('status');
        expect(p.supportedMethods).toContain('balance');
        expect(['USD', 'RUB', 'EUR']).toContain(p.currency);
        expect(p.rating).toBeGreaterThan(8.0);
      }
    });
  });

  describe('2. Network and Category Detection', () => {
    it('should accurately detect Telegram channel boosts', () => {
      const net = DirectProviderScannerService.detectNetwork(
        'Telegram Channel Boosts [Level Unlock] - 7 Days',
        'Telegram - Boosts'
      );
      const cat = DirectProviderScannerService.detectCategory(
        'Telegram Channel Boosts [Level Unlock] - 7 Days',
        'Telegram - Boosts'
      );

      expect(net).toBe('TELEGRAM');
      expect(cat).toBe('BOOSTS');
    });

    it('should accurately detect VKontakte group followers and likes', () => {
      const net = DirectProviderScannerService.detectNetwork(
        'ВКонтакте Подписчики в сообщество [Живые офферы]',
        'ВКонтакте - Подписчики'
      );
      const cat = DirectProviderScannerService.detectCategory(
        'ВКонтакте Подписчики в сообщество [Живые офферы]',
        'ВКонтакте - Подписчики'
      );

      expect(net).toBe('VK');
      expect(cat).toBe('SUBSCRIBERS');
    });

    it('should accurately detect YouTube views and TikTok followers', () => {
      expect(
        DirectProviderScannerService.detectNetwork('YouTube High Retention Views', 'YouTube - Views')
      ).toBe('YOUTUBE');
      expect(
        DirectProviderScannerService.detectCategory('YouTube High Retention Views', 'YouTube - Views')
      ).toBe('VIEWS');

      expect(
        DirectProviderScannerService.detectNetwork('TikTok Video Followers', 'TikTok - Followers')
      ).toBe('TIKTOK');
      expect(
        DirectProviderScannerService.detectCategory('TikTok Video Followers', 'TikTok - Followers')
      ).toBe('SUBSCRIBERS');
    });

    it('should accurately detect Twitch and Kick live streams and followers', () => {
      expect(
        DirectProviderScannerService.detectNetwork('Twitch Зрители на прямой эфир онлайн', 'Twitch - Стримы')
      ).toBe('TWITCH');
      expect(
        DirectProviderScannerService.detectCategory('Twitch Зрители на прямой эфир онлайн', 'Twitch - Стримы')
      ).toBe('STREAMS');

      expect(
        DirectProviderScannerService.detectNetwork('Kick Зрители на трансляцию 60 минут', 'Kick - Стримы')
      ).toBe('KICK');
      expect(
        DirectProviderScannerService.detectCategory('Kick Зрители на трансляцию 60 минут', 'Kick - Стримы')
      ).toBe('STREAMS');

      expect(
        DirectProviderScannerService.detectNetwork('Одноклассники Вступления в группу', 'Одноклассники - Подписчики')
      ).toBe('OK');
      expect(
        DirectProviderScannerService.detectCategory('Одноклассники Вступления в группу', 'Одноклассники - Подписчики')
      ).toBe('SUBSCRIBERS');
    });
  });

  describe('3. Financial & Margin Calculations (ExactMath)', () => {
    it('should convert USD rate to RUB kopecks without float drift', () => {
      // 0.15 USD * 92.5 = 13.875 RUB -> 1387n kopecks (or 1388n Banker's rounding)
      const pricing = DirectProviderScannerService.calculatePricingMetrics(
        '0.15',
        'USD',
        'TELEGRAM',
        'BOOSTS'
      );

      expect(typeof pricing.wholesaleRateRubKopecks).toBe('bigint');
      expect(pricing.wholesaleRateRubKopecks).toBeGreaterThan(1300n);
      expect(pricing.wholesaleRateRubKopecks).toBeLessThan(1400n);
      expect(pricing.retailBenchmarkPer1000Rub).toBe(45.0);
      expect(pricing.potentialMarginPercent).toBeGreaterThan(200); // wholesale ~13.88 RUB vs retail 45 RUB = >200% margin
    });

    it('should handle RUB currency without unnecessary currency conversion', () => {
      const pricing = DirectProviderScannerService.calculatePricingMetrics(
        '195.00',
        'RUB',
        'VK',
        'SUBSCRIBERS'
      );

      expect(pricing.wholesaleRateRubKopecks).toBe(19500n);
      expect(pricing.wholesaleRatePer1000Rub).toBe(195.0);
      expect(pricing.retailBenchmarkPer1000Rub).toBe(349.0);
      expect(pricing.potentialMarginPercent).toBe(79); // (349 - 195) / 195 = ~79% margin
    });
  });

  describe('4. SMM Panel API v2 Schema & Normalization', () => {
    it('should validate standard SMM Panel API v2 JSON response structure', () => {
      const sampleApiResponse = [
        {
          service: '1042',
          name: 'Telegram Boosts for Channel [Level Unlock] - 7 Days',
          type: 'Default',
          category: 'Telegram - Boosts',
          rate: '0.18',
          min: '1',
          max: '500',
          refill: 1,
          cancel: 0,
          dripfeed: 0,
        },
      ];

      const parsed = RawProviderServicesListSchema.safeParse(sampleApiResponse);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data[0].service).toBe('1042');
        expect(parsed.data[0].rate).toBe('0.18');
      }
    });

    it('should correctly normalize raw services into structured format with boolean flags', () => {
      const rawServices = [
        {
          service: '99',
          name: 'Telegram Real Followers',
          category: 'Telegram - Members',
          rate: '0.45',
          min: '50',
          max: '10000',
          type: 'Default',
          refill: true,
          cancel: false,
          dripfeed: 1,
        },
      ];

      const normalized = DirectProviderScannerService.normalizeServices(rawServices, 'USD');
      expect(normalized.length).toBe(1);
      expect(normalized[0].networkCode).toBe('TELEGRAM');
      expect(normalized[0].categoryCode).toBe('SUBSCRIBERS');
      expect(normalized[0].refill).toBe(true);
      expect(normalized[0].cancel).toBe(false);
      expect(normalized[0].dripfeed).toBe(true);
      expect(normalized[0].min).toBe(50);
      expect(normalized[0].max).toBe(10000);
    });
  });

  describe('5. Shadow Catalog Redis Buffering & Deduplication', () => {
    it('should generate SHA-256 catalog hash and buffer to Redis', async () => {
      const rawServices = [
        {
          service: '1',
          name: 'Service 1',
          category: 'Cat 1',
          rate: '1.0',
          min: '10',
          max: '1000',
        },
      ];

      vi.mocked(redis.get).mockResolvedValueOnce(null);

      const result = await DirectProviderScannerService.bufferShadowCatalog('test_prov', rawServices);

      expect(result.catalogHash).toHaveLength(64); // SHA-256 hex string
      expect(result.cached).toBe(false);
      expect(redis.set).toHaveBeenCalledTimes(2);
      expect(redis.set).toHaveBeenCalledWith(
        'provider:test_prov:catalog',
        JSON.stringify(rawServices),
        'EX',
        86400
      );
      expect(redis.set).toHaveBeenCalledWith(
        'provider:test_prov:catalog:hash',
        result.catalogHash,
        'EX',
        86400
      );
    });

    it('should skip Redis re-write if catalog hash matches (deduplication)', async () => {
      const rawServices = [
        {
          service: '1',
          name: 'Service 1',
          category: 'Cat 1',
          rate: '1.0',
          min: '10',
          max: '1000',
        },
      ];

      // Calculate expected hash
      const crypto = await import('node:crypto');
      const expectedHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(rawServices))
        .digest('hex');

      vi.mocked(redis.get).mockResolvedValueOnce(expectedHash);

      const result = await DirectProviderScannerService.bufferShadowCatalog('test_prov', rawServices);

      expect(result.catalogHash).toBe(expectedHash);
      expect(result.cached).toBe(true);
      // set should not be called because hash matched
      expect(redis.set).not.toHaveBeenCalled();
    });
  });
});
