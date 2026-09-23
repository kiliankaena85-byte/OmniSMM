import { ProviderServiceDto } from './base-provider';

export interface ServiceComparisonInput {
  id: string;
  name: string;
  rate: number;
  providerCurrency?: string | null;
  minQty: number;
  maxQty: number;
  isRefillEnabled?: boolean;
  isCancelEnabled?: boolean;
  description?: string | null;
  providerServiceType?: string | null;
}

export type MutationVerdict = 
  | 'SAFE'
  | 'SAFE_PRICE_ONLY'
  | 'MUTATED_PARAMS'
  | 'SERVICE_REPLACED'
  | 'NOT_FOUND_AT_PROVIDER';

export interface ParamDiffItem<T> {
  oldValue: T;
  newValue: T;
  changed: boolean;
  worsened?: boolean;
}

export interface ServiceMutationResult {
  serviceId: string;
  externalId: string;
  verdict: MutationVerdict;
  shouldDeactivate: boolean;
  isPriceSpike: boolean;
  isParamMutated: boolean;
  nameSimilarity: number;
  reasons: string[];
  summary: string;
  diff: {
    name: ParamDiffItem<string>;
    rate: ParamDiffItem<number> & {
      oldCostRub: number;
      newCostRub: number;
      deltaPercent: number;
      currency: string;
    };
    minQty: ParamDiffItem<number>;
    maxQty: ParamDiffItem<number>;
    refill: ParamDiffItem<boolean>;
    cancel: ParamDiffItem<boolean>;
    type: ParamDiffItem<string>;
  };
}

const CRITICAL_PLATFORMS = [
  'telegram', 'tg', 'vk', 'vkontakte', 'instagram', 'insta', 'ig', 
  'youtube', 'yt', 'tiktok', 'tt', 'twitter', 'x', 'facebook', 'fb',
  'rutube', 'discord', 'twitch', 'threads', 'ok'
];

const ACTIVITY_KEYWORDS: Record<string, string[]> = {
  followers: ['подписчики', 'subscribers', 'followers', 'members', 'участники', 'фолловеры'],
  likes: ['лайки', 'likes', 'hearts', 'реакции', 'reactions'],
  views: ['просмотры', 'views', 'охват', 'reach', 'impressions'],
  comments: ['комментарии', 'comments', 'отзывы', 'reviews'],
  reposts: ['репосты', 'reposts', 'shares', 'поделиться'],
  votes: ['голоса', 'votes', 'опросы', 'poll'],
  boosts: ['бусты', 'boosts', 'boost']
};

/**
 * Normalizes text for comparison: removes punctuation, brackets, emojis and extra spaces
 */
export function normalizeTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1)
  );
}

function detectActivity(tokens: Set<string>): string | null {
  for (const [activity, words] of Object.entries(ACTIVITY_KEYWORDS)) {
    if (words.some(w => tokens.has(w))) {
      return activity;
    }
  }
  return null;
}

/**
 * Calculates Token Jaccard Similarity between two service names
 */
export function calculateNameSimilarity(nameA: string, nameB: string): number {
  const tokensA = normalizeTokens(nameA);
  const tokensB = normalizeTokens(nameB);

  if (tokensA.size === 0 && tokensB.size === 0) return 1.0;
  if (tokensA.size === 0 || tokensB.size === 0) return 0.0;

  // 1. Check for critical platform keyword mismatch (e.g., Telegram vs TikTok)
  const platformA = CRITICAL_PLATFORMS.filter(p => tokensA.has(p));
  const platformB = CRITICAL_PLATFORMS.filter(p => tokensB.has(p));

  if (platformA.length > 0 && platformB.length > 0) {
    const hasCommonPlatform = platformA.some(p => platformB.includes(p));
    if (!hasCommonPlatform) {
      return 0.05; // Different platform completely
    }
  }

  // 2. Check for critical activity mismatch (e.g., Followers vs Likes)
  const activityA = detectActivity(tokensA);
  const activityB = detectActivity(tokensB);
  if (activityA && activityB && activityA !== activityB) {
    return 0.1; // Different service type completely
  }

  let intersectionCount = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      intersectionCount++;
    }
  }

  const unionCount = new Set([...tokensA, ...tokensB]).size;
  const baseJaccard = unionCount === 0 ? 1.0 : intersectionCount / unionCount;

  // If both share platform and activity, give semantic boost
  if (activityA && activityB && activityA === activityB) {
    return Math.max(baseJaccard, 0.5);
  }

  return baseJaccard;
}

export interface ProviderComparisonInput {
  service?: string | number;
  externalId?: string | number;
  name: string;
  rate: string | number;
  min?: string | number;
  max?: string | number;
  minQty?: number;
  maxQty?: number;
  refill?: boolean | number;
  isRefillEnabled?: boolean;
  cancel?: boolean | number;
  isCancelEnabled?: boolean;
  type?: string | null;
  desc?: string | null;
  [key: string]: any;
}

export class ServiceMutationDetector {
  /**
   * Analyzes an existing service against its fresh provider API DTO or ShadowService
   */
  static detect(
    service: ServiceComparisonInput,
    providerDto: ProviderComparisonInput | null | undefined,
    exchangeRate: number = 1.0,
    priceSpikeThreshold: number = 0.30
  ): ServiceMutationResult {
    const externalId = providerDto?.service 
      ? String(providerDto.service) 
      : (providerDto?.externalId ? String(providerDto.externalId) : '');

    // Case 1: Provider deleted or dropped the service completely
    if (!providerDto) {
      return {
        serviceId: service.id,
        externalId,
        verdict: 'NOT_FOUND_AT_PROVIDER',
        shouldDeactivate: true,
        isPriceSpike: false,
        isParamMutated: true,
        nameSimilarity: 0,
        reasons: ['Услуга отсутствует в ответе API поставщика (возможно удалена или отключена)'],
        summary: 'Услуга не найдена у поставщика',
        diff: {
          name: { oldValue: service.name, newValue: 'УДАЛЕНА У ПРОВАЙДЕРА', changed: true, worsened: true },
          rate: { oldValue: service.rate, newValue: 0, changed: true, oldCostRub: 0, newCostRub: 0, deltaPercent: 0, currency: service.providerCurrency || 'RUB' },
          minQty: { oldValue: service.minQty, newValue: 0, changed: true },
          maxQty: { oldValue: service.maxQty, newValue: 0, changed: true },
          refill: { oldValue: !!service.isRefillEnabled, newValue: false, changed: true, worsened: !!service.isRefillEnabled },
          cancel: { oldValue: !!service.isCancelEnabled, newValue: false, changed: true },
          type: { oldValue: service.providerServiceType || 'Default', newValue: 'NONE', changed: true }
        }
      };
    }

    const providerCurrency = service.providerCurrency || 'USD';
    const oldCostRub = providerCurrency === 'RUB' ? service.rate : service.rate * exchangeRate;
    const newRate = typeof providerDto.rate === 'number' 
      ? providerDto.rate 
      : (parseFloat(String(providerDto.rate)) || 0);
    const newCostRub = providerCurrency === 'RUB' ? newRate : newRate * exchangeRate;
    const deltaPercent = oldCostRub > 0 ? (newCostRub - oldCostRub) / oldCostRub : 0;
    const isPriceSpike = deltaPercent > priceSpikeThreshold;

    const rawMin = providerDto.min ?? providerDto.minQty;
    const rawMax = providerDto.max ?? providerDto.maxQty;
    const newMin = rawMin !== undefined ? (parseInt(String(rawMin), 10) || service.minQty) : service.minQty;
    const newMax = rawMax !== undefined ? (parseInt(String(rawMax), 10) || service.maxQty) : service.maxQty;
    const newRefill = Boolean(providerDto.refill ?? providerDto.isRefillEnabled);
    const newCancel = Boolean(providerDto.cancel ?? providerDto.isCancelEnabled);
    const newType = providerDto.type || 'Default';

    const similarity = calculateNameSimilarity(service.name, providerDto.name);
    const isNameReplaced = similarity < 0.40;

    const isMinChanged = newMin !== service.minQty;
    const isMaxChanged = newMax !== service.maxQty;
    const isLimitsChanged = isMinChanged || isMaxChanged;

    const oldRefill = Boolean(service.isRefillEnabled);
    const isRefillStripped = oldRefill && !newRefill;

    const oldCancel = Boolean(service.isCancelEnabled);
    const isCancelChanged = oldCancel !== newCancel;

    const oldType = service.providerServiceType || 'Default';
    const isTypeChanged = !!service.providerServiceType && oldType.toLowerCase() !== newType.toLowerCase();

    const reasons: string[] = [];

    if (isNameReplaced) {
      reasons.push(`Подмена названия: сходство ${(similarity * 100).toFixed(0)}% («${providerDto.name}»)`);
    }

    if (isRefillStripped) {
      reasons.push('Провайдер снял гарантию восстановления (refill: false)');
    }

    if (isLimitsChanged) {
      const minText = isMinChanged ? `min: ${service.minQty} → ${newMin}` : '';
      const maxText = isMaxChanged ? `max: ${service.maxQty} → ${newMax}` : '';
      const parts = [minText, maxText].filter(Boolean).join(', ');
      reasons.push(`Изменение лимитов объема (${parts})`);
    }

    if (isTypeChanged) {
      reasons.push(`Смена типа услуги: ${oldType} → ${newType}`);
    }

    if (isPriceSpike) {
      reasons.push(`Рост себестоимости +${(deltaPercent * 100).toFixed(0)}% (${oldCostRub.toFixed(2)} ₽ → ${newCostRub.toFixed(2)} ₽/1k)`);
    }

    const isParamMutated = isNameReplaced || isLimitsChanged || isRefillStripped || isTypeChanged;

    let verdict: MutationVerdict = 'SAFE';
    let shouldDeactivate = false;

    if (isNameReplaced) {
      verdict = 'SERVICE_REPLACED';
      shouldDeactivate = true;
    } else if (isParamMutated) {
      verdict = 'MUTATED_PARAMS';
      shouldDeactivate = true;
    } else if (isPriceSpike) {
      verdict = 'SAFE_PRICE_ONLY';
      shouldDeactivate = false;
    }

    let summary = 'Параметры услуги в норме';
    if (verdict === 'SERVICE_REPLACED') {
      summary = 'Критично: возможно подменена услуга у поставщика!';
    } else if (verdict === 'MUTATED_PARAMS') {
      summary = 'Внимание: изменились условия/лимиты поставщика (услуга автоотключена)';
    } else if (verdict === 'SAFE_PRICE_ONLY') {
      summary = 'Только цена: параметры идентичны, изменился тариф';
    }

    return {
      serviceId: service.id,
      externalId,
      verdict,
      shouldDeactivate,
      isPriceSpike,
      isParamMutated,
      nameSimilarity: similarity,
      reasons,
      summary,
      diff: {
        name: {
          oldValue: service.name,
          newValue: providerDto.name,
          changed: service.name !== providerDto.name,
          worsened: isNameReplaced
        },
        rate: {
          oldValue: service.rate,
          newValue: newRate,
          changed: service.rate !== newRate,
          oldCostRub,
          newCostRub,
          deltaPercent,
          currency: providerCurrency,
          worsened: isPriceSpike
        },
        minQty: {
          oldValue: service.minQty,
          newValue: newMin,
          changed: isMinChanged,
          worsened: newMin > service.minQty
        },
        maxQty: {
          oldValue: service.maxQty,
          newValue: newMax,
          changed: isMaxChanged,
          worsened: newMax < service.maxQty
        },
        refill: {
          oldValue: oldRefill,
          newValue: newRefill,
          changed: oldRefill !== newRefill,
          worsened: isRefillStripped
        },
        cancel: {
          oldValue: oldCancel,
          newValue: newCancel,
          changed: oldCancel !== newCancel,
          worsened: oldCancel && !newCancel
        },
        type: {
          oldValue: oldType,
          newValue: newType,
          changed: isTypeChanged
        }
      }
    };
  }
}
