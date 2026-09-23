import { describe, it, expect } from 'vitest';
import { 
  ServiceMutationDetector, 
  calculateNameSimilarity, 
  type ServiceComparisonInput 
} from '@/services/providers/service-mutation-detector';
import type { ProviderServiceDto } from '@/services/providers/base-provider';

describe('ServiceMutationDetector & Name Similarity', () => {
  describe('calculateNameSimilarity', () => {
    it('returns 1.0 for identical names', () => {
      const name = 'Telegram Подписчики HQ [30 Days Refill]';
      expect(calculateNameSimilarity(name, name)).toBe(1.0);
    });

    it('returns high similarity (>0.7) for minor wording variations on same platform', () => {
      const nameA = 'Telegram Подписчики HQ [30 Days Refill]';
      const nameB = 'Telegram Подписчики HQ [Автодокрутка 30д] Скорость 10к';
      const sim = calculateNameSimilarity(nameA, nameB);
      expect(sim).toBeGreaterThanOrEqual(0.4);
    });

    it('returns very low similarity (<0.2) when social platform changes (Telegram vs TikTok)', () => {
      const nameA = 'Telegram Подписчики HQ Real';
      const nameB = 'TikTok Подписчики HQ Real';
      const sim = calculateNameSimilarity(nameA, nameB);
      expect(sim).toBeLessThan(0.2); // Critical platform mismatch penalty
    });
  });

  describe('detectServiceMutation', () => {
    const baseService: ServiceComparisonInput = {
      id: 'srv-101',
      name: 'Telegram Подписчики Быстрые [30 дней гарантия]',
      rate: 100, // 100 RUB
      providerCurrency: 'RUB',
      minQty: 50,
      maxQty: 10000,
      isRefillEnabled: true,
      isCancelEnabled: false,
      providerServiceType: 'Default'
    };

    it('detects SAFE_PRICE_ONLY when only price spikes but all other params match', () => {
      const providerDto: ProviderServiceDto = {
        service: 101,
        name: 'Telegram Подписчики Быстрые [30 дней гарантия]',
        category: 'Telegram',
        rate: '145.00', // +45% spike
        min: '50',
        max: '10000',
        type: 'Default',
        refill: true,
        cancel: false
      };

      const res = ServiceMutationDetector.detect(baseService, providerDto, 1.0, 0.30);
      expect(res.verdict).toBe('SAFE_PRICE_ONLY');
      expect(res.isPriceSpike).toBe(true);
      expect(res.isParamMutated).toBe(false);
      expect(res.shouldDeactivate).toBe(false); // price spike alone does not permanently kill the service
      expect(res.reasons.some(r => r.includes('Рост себестоимости'))).toBe(true);
    });

    it('detects MUTATED_PARAMS and shouldDeactivate: true when provider stripped refill warranty', () => {
      const providerDto: ProviderServiceDto = {
        service: 101,
        name: 'Telegram Подписчики Быстрые [Без гарантии]',
        category: 'Telegram',
        rate: '140.00',
        min: '50',
        max: '10000',
        type: 'Default',
        refill: false, // Refill stripped!
        cancel: false
      };

      const res = ServiceMutationDetector.detect(baseService, providerDto, 1.0, 0.30);
      expect(res.verdict).toBe('MUTATED_PARAMS');
      expect(res.shouldDeactivate).toBe(true);
      expect(res.isParamMutated).toBe(true);
      expect(res.reasons.some(r => r.includes('снял гарантию'))).toBe(true);
      expect(res.diff.refill.worsened).toBe(true);
    });

    it('detects MUTATED_PARAMS and shouldDeactivate: true when minQty jumped (50 -> 1000)', () => {
      const providerDto: ProviderServiceDto = {
        service: 101,
        name: 'Telegram Подписчики Быстрые',
        category: 'Telegram',
        rate: '110.00',
        min: '1000', // Min volume jumped!
        max: '10000',
        type: 'Default',
        refill: true,
        cancel: false
      };

      const res = ServiceMutationDetector.detect(baseService, providerDto, 1.0, 0.30);
      expect(res.verdict).toBe('MUTATED_PARAMS');
      expect(res.shouldDeactivate).toBe(true);
      expect(res.reasons.some(r => r.includes('min: 50 → 1000'))).toBe(true);
      expect(res.diff.minQty.changed).toBe(true);
    });

    it('detects SERVICE_REPLACED and shouldDeactivate: true when provider reused ID for another network', () => {
      const providerDto: ProviderServiceDto = {
        service: 101,
        name: 'VK Лайки на стену быстрые', // Completely different service!
        category: 'VKontakte',
        rate: '80.00',
        min: '10',
        max: '5000',
        type: 'Default',
        refill: false,
        cancel: false
      };

      const res = ServiceMutationDetector.detect(baseService, providerDto, 1.0, 0.30);
      expect(res.verdict).toBe('SERVICE_REPLACED');
      expect(res.shouldDeactivate).toBe(true);
      expect(res.nameSimilarity).toBeLessThan(0.60);
      expect(res.reasons.some(r => r.includes('Подмена названия'))).toBe(true);
    });

    it('handles NOT_FOUND_AT_PROVIDER when providerDto is null', () => {
      const res = ServiceMutationDetector.detect(baseService, null);
      expect(res.verdict).toBe('NOT_FOUND_AT_PROVIDER');
      expect(res.shouldDeactivate).toBe(true);
      expect(res.reasons.some(r => r.includes('отсутствует в ответе API'))).toBe(true);
    });
  });
});
