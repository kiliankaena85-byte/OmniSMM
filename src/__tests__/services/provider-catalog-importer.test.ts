import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CANONICAL_NETWORKS,
  CANONICAL_CATEGORIES,
  resolveCanonicalNetwork,
  resolveCanonicalCategory,
  computeServiceSortOrder,
  calculateImportPrice,
  shouldTriggerHitlReview,
  SessionClassificationMemory,
  MultiFactorSorter,
  isMeaninglessCategory,
  auditServiceQuality,
} from '@/services/providers/ai-catalog-importer';

describe('Provider Catalog AI Importer & Taxonomy Engine', () => {
  describe('Canonical Taxonomy Registry', () => {
    it('should have Telegram, Instagram, VK, YouTube, TikTok at the top of networks', () => {
      const topNetworks = CANONICAL_NETWORKS.slice(0, 5).map(n => n.code);
      expect(topNetworks).toEqual(['TELEGRAM', 'INSTAGRAM', 'VK', 'YOUTUBE', 'TIKTOK']);
    });

    it('should order canonical categories according to the conversion funnel', () => {
      const expectedCodes = [
        'SUBSCRIBERS',
        'LIKES',
        'VIEWS',
        'REACTIONS',
        'COMMENTS',
        'REPOSTS',
        'STORIES',
        'BOOSTS',
        'STREAMS',
        'AUTO_SERVICES',
        'OTHER'
      ];
      const actualCodes = CANONICAL_CATEGORIES.map(c => c.code);
      expect(actualCodes).toEqual(expectedCodes);
    });

    it('should resolve canonical network code case-insensitively', () => {
      expect(resolveCanonicalNetwork('telegram')?.code).toBe('TELEGRAM');
      expect(resolveCanonicalNetwork('TG')?.code).toBe('TELEGRAM');
      expect(resolveCanonicalNetwork('Instagram Reels')?.code).toBe('INSTAGRAM');
      expect(resolveCanonicalNetwork('вконтакте')?.code).toBe('VK');
      expect(resolveCanonicalNetwork('UnknownNetwork')?.code).toBe('OTHER');
    });

    it('should resolve canonical category from keyword matches or codes', () => {
      expect(resolveCanonicalCategory('SUBSCRIBERS')?.code).toBe('SUBSCRIBERS');
      expect(resolveCanonicalCategory('Качественные подписчики')?.code).toBe('SUBSCRIBERS');
      expect(resolveCanonicalCategory('Лайки на публикации')?.code).toBe('LIKES');
      expect(resolveCanonicalCategory('Просмотры видео')?.code).toBe('VIEWS');
      expect(resolveCanonicalCategory('Случайные смайлы реакции')?.code).toBe('REACTIONS');
      expect(resolveCanonicalCategory('Непонятная услуга')?.code).toBe('OTHER');
    });
  });

  describe('Multi-Factor Sorting Engine', () => {
    it('should prioritize VIP and guaranteed services over economy bots', () => {
      const vipOrder = computeServiceSortOrder({
        qualityTier: 'VIP',
        warrantyDays: 30,
        pricePerUnitRub: 0.15,
        priceRankIndex: 1
      });

      const guaranteeOrder = computeServiceSortOrder({
        qualityTier: 'STANDARD',
        warrantyDays: 30,
        pricePerUnitRub: 0.10,
        priceRankIndex: 2
      });

      const standardOrder = computeServiceSortOrder({
        qualityTier: 'STANDARD',
        warrantyDays: 0,
        pricePerUnitRub: 0.08,
        priceRankIndex: 3
      });

      const economyOrder = computeServiceSortOrder({
        qualityTier: 'ECONOMY',
        warrantyDays: 0,
        pricePerUnitRub: 0.02,
        priceRankIndex: 4
      });

      // VIP must be first (lowest sortOrder)
      expect(vipOrder).toBeLessThan(guaranteeOrder);
      expect(guaranteeOrder).toBeLessThan(standardOrder);
      expect(standardOrder).toBeLessThan(economyOrder);
    });

    it('should sort services inside category: VIP/Guarantee first, then by price within tier', () => {
      const services = [
        { id: '1', name: 'Cheap Bots', qualityTier: 'ECONOMY', warrantyDays: 0, pricePerUnitRub: 0.01 },
        { id: '2', name: 'Standard Views', qualityTier: 'STANDARD', warrantyDays: 0, pricePerUnitRub: 0.05 },
        { id: '3', name: 'Standard Views Cheap', qualityTier: 'STANDARD', warrantyDays: 0, pricePerUnitRub: 0.03 },
        { id: '4', name: 'VIP Real Subscribers', qualityTier: 'VIP', warrantyDays: 30, pricePerUnitRub: 0.50 },
        { id: '5', name: 'VIP Fast Subscribers', qualityTier: 'VIP', warrantyDays: 30, pricePerUnitRub: 0.40 },
        { id: '6', name: 'Refill Guarantee 30d', qualityTier: 'STANDARD', warrantyDays: 30, pricePerUnitRub: 0.10 },
      ];

      const sorted = MultiFactorSorter.sortServices(services);

      // VIP tier sorted by price
      expect(sorted[0].id).toBe('5'); // VIP 0.40
      expect(sorted[1].id).toBe('4'); // VIP 0.50

      // Guarantee tier
      expect(sorted[2].id).toBe('6'); // Refill 0.10

      // Standard tier sorted by price
      expect(sorted[3].id).toBe('3'); // Standard 0.03
      expect(sorted[4].id).toBe('2'); // Standard 0.05

      // Economy tier
      expect(sorted[5].id).toBe('1'); // Economy 0.01
    });
  });

  describe('Adaptive Pricing & Margin Floor Calculator', () => {
    it('should calculate retail price using pricing ladder and apply safety floor markup >= 3.0x', () => {
      // Cost: 10 RUB per 1000 items (0.01 RUB/item)
      const pricing = calculateImportPrice({
        rawRate: 10,
        providerCurrency: 'RUB',
        usdRate: 90
      });

      expect(pricing.costPer1kRub).toBe(10);
      expect(pricing.effectiveMarkup).toBeGreaterThanOrEqual(3.0);
      expect(pricing.pricePer1000Rub).toBeGreaterThanOrEqual(30);
      // Price per 1000 in kopecks
      expect(pricing.pricePer1000Cents).toBeGreaterThanOrEqual(3000);
    });

    it('should convert USD rates to RUB using exchange rate before calculating ladder', () => {
      // 0.50 USD per 1000 at 90 USD/RUB = 45 RUB per 1000
      const pricing = calculateImportPrice({
        rawRate: 0.50,
        providerCurrency: 'USD',
        usdRate: 90
      });

      expect(pricing.costPer1kRub).toBe(45);
      expect(pricing.effectiveMarkup).toBeGreaterThanOrEqual(3.0);
      expect(pricing.pricePer1000Rub).toBeGreaterThanOrEqual(135);
    });
  });

  describe('Human-in-the-Loop Clarification Gate', () => {
    it('should trigger review if confidence is lower than 0.85', () => {
      const decision = shouldTriggerHitlReview({
        networkCode: 'TELEGRAM',
        canonicalCategoryCode: 'SUBSCRIBERS',
        confidence: 0.72,
        needsHumanReview: false
      });

      expect(decision.triggered).toBe(true);
      expect(decision.reason).toContain('Низкая уверенность');
    });

    it('should trigger review if category or network is OTHER', () => {
      const decisionOtherCat = shouldTriggerHitlReview({
        networkCode: 'TELEGRAM',
        canonicalCategoryCode: 'OTHER',
        confidence: 0.95,
        needsHumanReview: false
      });
      expect(decisionOtherCat.triggered).toBe(true);

      const decisionOtherNet = shouldTriggerHitlReview({
        networkCode: 'OTHER',
        canonicalCategoryCode: 'LIKES',
        confidence: 0.95,
        needsHumanReview: false
      });
      expect(decisionOtherNet.triggered).toBe(true);
    });

    it('should NOT trigger review if confidence >= 0.85 and category/network are canonical', () => {
      const decision = shouldTriggerHitlReview({
        networkCode: 'TELEGRAM',
        canonicalCategoryCode: 'SUBSCRIBERS',
        confidence: 0.92,
        needsHumanReview: false
      });

      expect(decision.triggered).toBe(false);
    });

    it('should cache operator choices in session memory and reuse them for identical raw patterns', () => {
      const memory = new SessionClassificationMemory();
      const rawCategory = 'Special Custom TG Engagement [Server 5]';

      expect(memory.has(rawCategory)).toBe(false);

      memory.set(rawCategory, {
        networkCode: 'TELEGRAM',
        canonicalCategoryCode: 'REACTIONS'
      });

      expect(memory.has(rawCategory)).toBe(true);
      const recalled = memory.get(rawCategory);
      expect(recalled?.networkCode).toBe('TELEGRAM');
      expect(recalled?.canonicalCategoryCode).toBe('REACTIONS');
    });
  });

  describe('Service Quality & Garbage Gatekeeper', () => {
    it('should correctly identify meaningless or empty categories', () => {
      expect(isMeaninglessCategory(null)).toBe(true);
      expect(isMeaninglessCategory(undefined)).toBe(true);
      expect(isMeaninglessCategory('')).toBe(true);
      expect(isMeaninglessCategory('   ')).toBe(true);
      expect(isMeaninglessCategory('Без категории')).toBe(true);
      expect(isMeaninglessCategory('No Category')).toBe(true);
      expect(isMeaninglessCategory('Uncategorized')).toBe(true);
      expect(isMeaninglessCategory('Default')).toBe(true);
      expect(isMeaninglessCategory('-')).toBe(true);

      expect(isMeaninglessCategory('Telegram Subscribers')).toBe(false);
      expect(isMeaninglessCategory('Лайки')).toBe(false);
    });

    it('should REJECT dead, broken and test services', () => {
      const testService = auditServiceQuality({
        service: '101',
        name: '[TEST] Do Not Order - QA Only',
        category: 'Telegram',
        rate: 5,
        min: 10,
        max: 1000
      });
      expect(testService.status).toBe('REJECT');
      expect(testService.rejectCategory).toBe('GARBAGE');

      const notWorkingService = auditServiceQuality({
        service: '102',
        name: 'Instagram Likes [NOT WORKING / DISABLED]',
        category: 'Instagram',
        rate: 12,
        min: 10,
        max: 1000
      });
      expect(notWorkingService.status).toBe('REJECT');
      expect(notWorkingService.rejectCategory).toBe('GARBAGE');

      const deadRu = auditServiceQuality({
        service: '103',
        name: 'Подписчики ВК [НЕ ЗАКАЗЫВАТЬ - СЛОМАНО]',
        category: 'VK',
        rate: 15,
        min: 10,
        max: 1000
      });
      expect(deadRu.status).toBe('REJECT');
    });

    it('should REJECT services with invalid technical invariants', () => {
      // Zero or negative rate
      const zeroRate = auditServiceQuality({
        service: '201',
        name: 'TikTok Views Real',
        category: 'TikTok',
        rate: 0,
        min: 10,
        max: 1000
      });
      expect(zeroRate.status).toBe('REJECT');
      expect(zeroRate.rejectCategory).toBe('INVALID_PARAMS');

      // min > max
      const brokenRange = auditServiceQuality({
        service: '202',
        name: 'YouTube Views High Retention',
        category: 'YouTube',
        rate: 50,
        min: 5000,
        max: 1000
      });
      expect(brokenRange.status).toBe('REJECT');
      expect(brokenRange.rejectCategory).toBe('INVALID_PARAMS');

      // max is 0
      const zeroMax = auditServiceQuality({
        service: '203',
        name: 'YouTube Shorts Likes',
        category: 'YouTube',
        rate: 20,
        min: 10,
        max: 0
      });
      expect(zeroMax.status).toBe('REJECT');
    });

    it('should REJECT meaningless orphan services without category AND without network in name', () => {
      const orphan = auditServiceQuality({
        service: '301',
        name: 'Server 4 - Fast Speed HQ',
        category: 'Без категории',
        rate: 10,
        min: 10,
        max: 1000
      });
      expect(orphan.status).toBe('REJECT');
      expect(orphan.rejectCategory).toBe('ORPHAN');
    });

    it('should allow recovery (NEEDS_REVIEW) for services with empty category if social network is clearly in name', () => {
      const recoverable = auditServiceQuality({
        service: '302',
        name: 'Telegram Подписчики на закрытый канал',
        category: '',
        rate: 30,
        min: 10,
        max: 1000
      });
      expect(recoverable.status).toBe('NEEDS_REVIEW');
      expect(recoverable.reason).toContain('Восстановление категории');
    });

    it('should REJECT toxic and banned services (complaints, channel takedowns)', () => {
      const toxic = auditServiceQuality({
        service: '401',
        name: 'Снос Telegram канала конкурента через жалобы',
        category: 'Telegram',
        rate: 500,
        min: 1,
        max: 10
      });
      expect(toxic.status).toBe('REJECT');
      expect(toxic.rejectCategory).toBe('TOXIC');
    });

    it('should APPROVE clean and healthy provider services', () => {
      const healthy = auditServiceQuality({
        service: '501',
        name: 'Telegram Подписчики Реальные [30 Дней Гарантия] ♻️',
        category: 'Telegram Members',
        rate: 45,
        min: 50,
        max: 20000
      });
      expect(healthy.status).toBe('APPROVED');
    });
  });
});
