import { describe, it, expect, vi } from 'vitest';
import {
  resolveCanonicalNetwork,
  resolveCanonicalCategory,
  calculateImportPrice,
  auditServiceQuality,
  shouldTriggerHitlReview,
} from '@/services/providers/ai-catalog-importer';
import { resolveImportCategory, type CategoryResolutionContext } from '@/services/admin/catalog/catalog-import-category-resolver';
import { formatFullServiceName } from '@/services/admin/catalog/catalog-taxonomy.service';
import { resolveServiceTargetType, TargetTypeEnum } from '@/utils/target-type-mapper';
import { PriceDriftCircuitBreaker } from '@/lib/pricing/drift-circuit-breaker';
import { assertValidServiceRoute, ServiceRouteValidationError } from '@/lib/validators/service-route-validator';
import { db } from '@/lib/db';

describe('Catalog Import & Service Lifecycle SDD-TDD 2026', () => {
  // ── Block 1: Ingestion Authority & Zero-Unknown-Platform Guard ──────────
  describe('Block 1: Ingestion Authority (Priority 1 vs Priority 2)', () => {
    it('Priority 1: Operator explicit category mapping is absolute and ignores auto-split', async () => {
      const explicitCategoryId = 'cat-admin-custom-999';
      const ctx: CategoryResolutionContext = {
        categoryIdMap: { 'ext-404': explicitCategoryId },
        categoryActivityTypeMap: new Map([['cat-admin-custom-999', 'SUBSCRIBERS']]),
        categoryNameMap: new Map([['cat-admin-custom-999', 'Эксклюзивные подписчики']]),
        categoryNetworkMap: new Map([
          ['cat-admin-custom-999', { id: 'net-tg', name: 'Telegram', slug: 'telegram' }]
        ]),
        networkBySlug: new Map([
          ['telegram', { id: 'net-tg', name: 'Telegram', slug: 'telegram' }],
          ['vk', { id: 'net-vk', name: 'ВКонтакте', slug: 'vk' }]
        ]),
        fallbackCategoryRecord: null,
        autoCreatedCategoryCache: new Map()
      };

      // Even if shadow service claims VK or other, admin explicitly mapped to cat-admin-custom-999
      const shadowService = {
        cleanName: 'VK Лайки быстрые',
        name: 'VK Likes fast',
        normalizedCategory: 'VK',
        targetType: 'POST',
        platform: 'vk'
      };

      const result = await resolveImportCategory('ext-404', shadowService, 'fallback-cat-id', 'smmplan', ctx);

      expect(result.resolvedCategoryId).toBe(explicitCategoryId);
      expect(result.effectiveServiceNetwork?.slug).toBe('telegram');
    });

    it('Priority 2: Auto-import rejects services with unknown platform (Zero-Unknown-Platform Guard)', () => {
      // 1. Service with no platform in name or category
      const net = resolveCanonicalNetwork('Mystery Promo Boost 2026');
      expect(net.code).toBe('OTHER');

      // 2. Audit quality flags orphan / unknown
      const audit = auditServiceQuality({
        service: '101',
        name: 'Super Secret Boost without platform',
        category: '',
        rate: 5.5,
        min: 10,
        max: 1000
      });

      expect(audit.status).toBe('REJECT');
      expect(audit.rejectCategory).toBe('ORPHAN');
    });

    it('Audit gatekeeper rejects toxic services and broken technical parameters', () => {
      // Toxic
      const toxicAudit = auditServiceQuality({
        service: '666',
        name: 'Снос канала конкурента жалобы',
        category: 'Telegram',
        rate: 100,
        min: 1,
        max: 10
      });
      expect(toxicAudit.status).toBe('REJECT');
      expect(toxicAudit.rejectCategory).toBe('TOXIC');

      // Dead / maintenance
      const garbageAudit = auditServiceQuality({
        service: '777',
        name: 'Telegram подписчики [TEST ONLY] не заказывать',
        category: 'Telegram',
        rate: 50,
        min: 10,
        max: 1000
      });
      expect(garbageAudit.status).toBe('REJECT');
      expect(garbageAudit.rejectCategory).toBe('GARBAGE');

      // Broken rate <= 0
      const brokenRateAudit = auditServiceQuality({
        service: '888',
        name: 'Telegram подписчики',
        category: 'Telegram',
        rate: 0,
        min: 10,
        max: 1000
      });
      expect(brokenRateAudit.status).toBe('REJECT');
      expect(brokenRateAudit.rejectCategory).toBe('INVALID_PARAMS');

      // Inverted interval min > max
      const invertedMinMax = auditServiceQuality({
        service: '999',
        name: 'Telegram подписчики',
        category: 'Telegram',
        rate: 10,
        min: 500,
        max: 100
      });
      expect(invertedMinMax.status).toBe('REJECT');
      expect(invertedMinMax.rejectCategory).toBe('INVALID_PARAMS');
    });
  });

  // ── Block 2: Platform Branding & Windows Flag Emoji Normalization ───────
  describe('Block 2: Platform Branding & Windows Flag Emoji Normalization', () => {
    it('prepends canonical platform prefix to service name if recognized and missing', () => {
      const formatted = formatFullServiceName('🇷🇺 Подписчики быстрые без списаний', 'Подписчики', 'Telegram');
      expect(formatted).toBe('Telegram 🇷🇺 Подписчики быстрые без списаний');

      // Does not double-prefix if already present
      const alreadyPrefixed = formatFullServiceName('Telegram Подписчики живые', 'Подписчики', 'Telegram');
      expect(alreadyPrefixed).toBe('Telegram Подписчики живые');
    });

    it('correctly classifies canonical networks across 10+ platforms', () => {
      expect(resolveCanonicalNetwork('ТГ просмотры постов').code).toBe('TELEGRAM');
      expect(resolveCanonicalNetwork('ВК накрутка друзей').code).toBe('VK');
      expect(resolveCanonicalNetwork('Ютуб подписчики канал').code).toBe('YOUTUBE');
      expect(resolveCanonicalNetwork('Рутуб просмотры видео').code).toBe('RUTUBE');
      expect(resolveCanonicalNetwork('Дзен дочитывания').code).toBe('DZEN');
      expect(resolveCanonicalNetwork('TikTok followers live').code).toBe('TIKTOK');
    });
  });

  // ── Block 3: Search Query Normalization ──────────────────────────────────
  describe('Block 3: Search Query Normalization (#ID, №ID, ID: ID)', () => {
    function normalizeCatalogSearch(q: string) {
      const normalizedNumericQ = q.replace(/^[#№\s]+/, '').replace(/^id[\s:]*/i, '').trim();
      const numId = parseInt(normalizedNumericQ, 10);
      const isPureNumber = !isNaN(numId) && normalizedNumericQ === String(numId);
      return { normalizedNumericQ, numId, isPureNumber };
    }

    it('extracts exact numericId from various prefix permutations', () => {
      const testCases = ['1643', '#1643', '№1643', 'ID: 1643', 'id 1643', '# 1643', '№  1643', 'ID:   1643'];
      for (const input of testCases) {
        const result = normalizeCatalogSearch(input);
        expect(result.isPureNumber).toBe(true);
        expect(result.numId).toBe(1643);
      }
    });

    it('does not falsely classify text containing numbers or words as numericId', () => {
      expect(normalizeCatalogSearch('Telegram 1000 подписчиков').isPureNumber).toBe(false);
      expect(normalizeCatalogSearch('ID: promo').isPureNumber).toBe(false);
      expect(normalizeCatalogSearch('№ 2500 рублей').isPureNumber).toBe(false);
    });
  });

  // ── Block 4: TargetType Semantic Resolution ─────────────────────────────
  describe('Block 4: TargetType Semantic Resolution (Channel vs Post)', () => {
    it('overrides DB default "POST" when service name indicates Channel or Bot', () => {
      // DB has default POST
      const channelService = {
        name: 'Telegram Подписчики в закрытый канал',
        targetType: 'POST',
      };
      expect(resolveServiceTargetType(channelService)).toBe(TargetTypeEnum.CHANNEL);

      const botService = {
        name: 'Telegram Запуск бота (Старты рефералов)',
        targetType: 'POST',
      };
      expect(resolveServiceTargetType(botService)).toBe(TargetTypeEnum.BOT);

      const pollService = {
        name: 'Telegram Голоса в опросы и викторины',
        targetType: 'POST',
      };
      expect(resolveServiceTargetType(pollService)).toBe(TargetTypeEnum.POLL);

      const storyService = {
        name: 'Telegram Просмотры историй сторис',
        targetType: 'POST',
      };
      expect(resolveServiceTargetType(storyService)).toBe(TargetTypeEnum.STORY);
    });

    it('preserves POST when service name genuinely relates to post interactions', () => {
      const postService = {
        name: 'Telegram Лайки и реакции на пост',
        targetType: 'POST',
      };
      expect(resolveServiceTargetType(postService)).toBe(TargetTypeEnum.POST);
    });
  });

  // ── Block 5: Drip-Feed Floor Invariant ──────────────────────────────────
  describe('Block 5: Drip-Feed Floor Invariant', () => {
    function validateDripFeedFloor(totalQty: number, runs: number, minQty: number) {
      if (runs <= 1) {
        return { valid: totalQty >= minQty, perRun: totalQty };
      }
      const perRun = Math.floor(totalQty / runs);
      const valid = perRun >= minQty && totalQty >= minQty * runs;
      return { valid, perRun, requiredMinTotal: minQty * runs };
    }

    it('accepts valid drip feed where volume per run >= minQty', () => {
      // minQty = 100, 5 runs -> requires >= 500 total
      const result = validateDripFeedFloor(1000, 5, 100);
      expect(result.valid).toBe(true);
      expect(result.perRun).toBe(200);
    });

    it('rejects drip feed where volume per run drops below minQty', () => {
      // minQty = 100, 10 runs, totalQty = 500 -> 50 per run < 100 minQty
      const result = validateDripFeedFloor(500, 10, 100);
      expect(result.valid).toBe(false);
      expect(result.perRun).toBe(50);
      expect(result.requiredMinTotal).toBe(1000);
    });
  });

  // ── Block 6: ServiceRoute Validator & Failover Hot-Swap ──────────────────
  describe('Block 6: ServiceRoute Invariants & Collision Protection', () => {
    it('throws NUMERIC_ID_COLLISION if providerServiceId mistakenly matches internal numericId', async () => {
      const mockService = {
        id: 'srv-uuid-1',
        name: 'Telegram Просмотры',
        numericId: 1315,
        externalId: 'ext-98765',
        providerId: 'prov-vexboost'
      };

      vi.spyOn(db.service, 'findFirst').mockResolvedValue(mockService as any);

      await expect(
        assertValidServiceRoute({
          serviceId: 'srv-uuid-1',
          providerId: 'prov-vexboost',
          providerServiceId: '1315', // Accidental internal numericId!
        })
      ).rejects.toThrowError(ServiceRouteValidationError);

      vi.restoreAllMocks();
    });

    it('passes validation when providerServiceId is legitimate externalId', async () => {
      const mockService = {
        id: 'srv-uuid-2',
        name: 'Telegram Подписчики',
        numericId: 1400,
        externalId: 'ext-8888',
        providerId: 'prov-vexboost'
      };

      vi.spyOn(db.service, 'findFirst').mockResolvedValue(mockService as any);

      const result = await assertValidServiceRoute({
        serviceId: 'srv-uuid-2',
        providerId: 'prov-vexboost',
        providerServiceId: 'ext-8888',
      });

      expect(result.valid).toBe(true);
      expect(result.serviceName).toBe('Telegram Подписчики');

      vi.restoreAllMocks();
    });
  });

  // ── Block 7: Price Drift & Quarantine Circuit Breaker ────────────────────
  describe('Block 7: Price Drift Circuit Breaker', () => {
    it('blocks pricing when cost drops below minimal micro-threshold (0.01 RUB)', async () => {
      const result = await PriceDriftCircuitBreaker.validate(
        'prov-1',
        'ext-1',
        0.0005 // Micro-price anomaly
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.severity).toBe('BLOCK');
        expect(result.reason).toContain('микро-цены');
      }
    });

    it('blocks pricing when currency exchange ratio explodes (e.g. 500x ratio)', async () => {
      const result = await PriceDriftCircuitBreaker.validate(
        'prov-1',
        'ext-1',
        90000,
        undefined,
        100, // rawRate
        'USD'
      );
      // 90000 / 100 = 900x ratio > 250x limit for USD
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.severity).toBe('BLOCK');
        expect(result.reason).toContain('безопасный коэффициент');
      }
    });

    it('approves normal pricing within safety margins', async () => {
      const result = await PriceDriftCircuitBreaker.validate(
        'prov-1',
        'ext-1',
        150.0, // 150 RUB per 1k
        undefined,
        1.5, // rawRate 1.5 USD * ~95 = 142.5 RUB
        'USD'
      );
      expect(result.ok).toBe(true);
    });
  });
});
