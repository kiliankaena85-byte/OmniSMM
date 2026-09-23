import { describe, it, expect } from 'vitest';
import { 
  ServiceMutationDetector, 
  calculateNameSimilarity, 
  normalizeTokens 
} from '@/services/providers/service-mutation-detector';

describe('Admin Quarantine & Service Mutation Integrity (Step 5)', () => {
  it('should detect SAFE_PRICE_ONLY when only rate increases above threshold with identical name and params', () => {
    const service = {
      id: 'srv-1',
      name: 'Telegram Подписчики на канал быстрые',
      rate: 100,
      providerCurrency: 'RUB',
      minQty: 100,
      maxQty: 50000,
      isRefillEnabled: true,
      isCancelEnabled: false,
      providerServiceType: 'Default',
    };

    const providerDto = {
      service: 'ext-1',
      name: 'Telegram Подписчики на канал быстрые',
      rate: 140,
      min: 100,
      max: 50000,
      refill: true,
      cancel: false,
      type: 'Default',
    };

    const result = ServiceMutationDetector.detect(service, providerDto, 1.0, 0.30);

    expect(result.verdict).toBe('SAFE_PRICE_ONLY');
    expect(result.isPriceSpike).toBe(true);
    expect(result.isParamMutated).toBe(false);
    expect(result.shouldDeactivate).toBe(false);
    expect(result.diff.rate.changed).toBe(true);
    expect(result.diff.rate.deltaPercent).toBeCloseTo(0.40, 2);
    expect(result.reasons.some(r => r.includes('Рост себестоимости'))).toBe(true);
  });

  it('should detect MUTATED_PARAMS when provider modifies limits or strips refill warranty', () => {
    const service = {
      id: 'srv-2',
      name: 'ВКонтакте Лайки на пост с гарантией',
      rate: 50,
      providerCurrency: 'RUB',
      minQty: 50,
      maxQty: 10000,
      isRefillEnabled: true,
      isCancelEnabled: true,
      providerServiceType: 'Default',
    };

    const providerDto = {
      service: 'ext-2',
      name: 'ВКонтакте Лайки на пост с гарантией',
      rate: 50,
      min: 100,
      max: 5000,
      refill: false,
      cancel: true,
      type: 'Default',
    };

    const result = ServiceMutationDetector.detect(service, providerDto, 1.0, 0.30);

    expect(result.verdict).toBe('MUTATED_PARAMS');
    expect(result.shouldDeactivate).toBe(true);
    expect(result.isParamMutated).toBe(true);
    expect(result.diff.refill.worsened).toBe(true);
    expect(result.diff.minQty.changed).toBe(true);
    expect(result.diff.maxQty.changed).toBe(true);
    expect(result.reasons.some(r => r.includes('гарантию'))).toBe(true);
  });

  it('should detect SERVICE_REPLACED when provider assigns existing ID to a different platform or activity', () => {
    const service = {
      id: 'srv-3',
      name: 'Telegram Просмотры на пост',
      rate: 10,
      providerCurrency: 'RUB',
      minQty: 100,
      maxQty: 100000,
      isRefillEnabled: false,
      isCancelEnabled: false,
      providerServiceType: 'Default',
    };

    const providerDto = {
      service: 'ext-3',
      name: 'TikTok Подписчики живые быстрые',
      rate: 150,
      min: 100,
      max: 10000,
      refill: false,
      cancel: false,
      type: 'Default',
    };

    const result = ServiceMutationDetector.detect(service, providerDto, 1.0, 0.30);

    expect(result.verdict).toBe('SERVICE_REPLACED');
    expect(result.shouldDeactivate).toBe(true);
    expect(result.nameSimilarity).toBeLessThan(0.40);
    expect(result.reasons.some(r => r.includes('Подмена названия'))).toBe(true);
  });

  it('should detect NOT_FOUND_AT_PROVIDER when service is missing in provider catalog response', () => {
    const service = {
      id: 'srv-4',
      name: 'YouTube Просмотры видео',
      rate: 200,
      providerCurrency: 'RUB',
      minQty: 1000,
      maxQty: 1000000,
      isRefillEnabled: true,
      isCancelEnabled: false,
      providerServiceType: 'Default',
    };

    const result = ServiceMutationDetector.detect(service, null, 1.0, 0.30);

    expect(result.verdict).toBe('NOT_FOUND_AT_PROVIDER');
    expect(result.shouldDeactivate).toBe(true);
    expect(result.nameSimilarity).toBe(0);
    expect(result.diff.name.newValue).toBe('УДАЛЕНА У ПРОВАЙДЕРА');
  });

  it('should verify calculateNameSimilarity semantics for identical, similar, and mismatched services', () => {
    expect(calculateNameSimilarity('Telegram Подписчики', 'Telegram Подписчики')).toBe(1.0);

    const simHigh = calculateNameSimilarity(
      'Telegram Подписчики канал быстрые без списаний',
      'Telegram Подписчики канал быстрый старт'
    );
    expect(simHigh).toBeGreaterThanOrEqual(0.4);

    const simDiffPlatform = calculateNameSimilarity(
      'Telegram Подписчики',
      'TikTok Подписчики'
    );
    expect(simDiffPlatform).toBeLessThanOrEqual(0.1);

    const simDiffActivity = calculateNameSimilarity(
      'VK Подписчики в группу',
      'VK Лайки на запись'
    );
    expect(simDiffActivity).toBeLessThanOrEqual(0.1);
  });
});
