import { z } from 'zod';
import {
  SAFETY_FLOOR_MARKUP,
  applyPricingLadder,
  applyBeautifulRounding,
} from '@/lib/financial-constants';

// ── Canonical Networks Definition ──────────────────────────────────────────

export interface CanonicalNetworkDefinition {
  code: string;
  name: string;
  slug: string;
  sortOrder: number;
  keywords: string[];
}

export const CANONICAL_NETWORKS: CanonicalNetworkDefinition[] = [
  { code: 'TELEGRAM', name: 'Telegram', slug: 'telegram', sortOrder: 10, keywords: ['telegram', 'тг', 'телеграм', 'телеграмм', 'tg'] },
  { code: 'INSTAGRAM', name: 'Instagram', slug: 'instagram', sortOrder: 20, keywords: ['instagram', 'инстаграм', 'инста', 'ig', 'insta'] },
  { code: 'VK', name: 'ВКонтакте', slug: 'vk', sortOrder: 30, keywords: ['vk', 'vkontakte', 'вконтакте', 'вк'] },
  { code: 'YOUTUBE', name: 'YouTube', slug: 'youtube', sortOrder: 40, keywords: ['youtube', 'ютуб', 'ютубе', 'yt'] },
  { code: 'TIKTOK', name: 'TikTok', slug: 'tiktok', sortOrder: 50, keywords: ['tiktok', 'тикток', 'тик-ток', 'tt'] },
  { code: 'TWITCH', name: 'Twitch', slug: 'twitch', sortOrder: 60, keywords: ['twitch', 'твич'] },
  { code: 'DISCORD', name: 'Discord', slug: 'discord', sortOrder: 70, keywords: ['discord', 'дискорд'] },
  { code: 'TWITTER', name: 'Twitter (X)', slug: 'twitter', sortOrder: 80, keywords: ['twitter', 'твиттер', 'x.com'] },
  { code: 'RUTUBE', name: 'Rutube', slug: 'rutube', sortOrder: 90, keywords: ['rutube', 'рутуб'] },
  { code: 'DZEN', name: 'Дзен', slug: 'dzen', sortOrder: 100, keywords: ['dzen', 'дзен', 'yandex dzen'] },
  { code: 'OTHER', name: 'Другое', slug: 'other', sortOrder: 999, keywords: [] },
];

// ── Canonical Categories Definition ────────────────────────────────────────

export interface CanonicalCategoryDefinition {
  code: string;
  name: string;
  sortOrder: number;
  targetType: string;
  keywords: string[];
}

export const CANONICAL_CATEGORIES: CanonicalCategoryDefinition[] = [
  {
    code: 'SUBSCRIBERS',
    name: 'Подписчики',
    sortOrder: 10,
    targetType: 'CHANNEL',
    keywords: ['subscriber', 'member', 'follow', 'participant', 'reader', 'подписчик', 'участник', 'фолловер', 'читател']
  },
  {
    code: 'LIKES',
    name: 'Лайки',
    sortOrder: 20,
    targetType: 'POST',
    keywords: ['like', 'fav', 'heart', 'лайк', 'сердечк', 'классы', 'мне нравится']
  },
  {
    code: 'VIEWS',
    name: 'Просмотры',
    sortOrder: 30,
    targetType: 'POST',
    keywords: ['view', 'eye', 'watch', 'просмотр', 'гляделок', 'глаз', 'охват', 'показ', 'impressions']
  },
  {
    code: 'REACTIONS',
    name: 'Реакции',
    sortOrder: 40,
    targetType: 'POST',
    keywords: ['reaction', 'emoji', 'реакци', 'эмодзи', 'смайл']
  },
  {
    code: 'COMMENTS',
    name: 'Комментарии',
    sortOrder: 50,
    targetType: 'COMMENTS',
    keywords: ['comment', 'review', 'коммент', 'отзыв']
  },
  {
    code: 'REPOSTS',
    name: 'Репосты',
    sortOrder: 60,
    targetType: 'POST',
    keywords: ['repost', 'share', 'репост', 'поделиться', 'ретвит']
  },
  {
    code: 'STORIES',
    name: 'Истории',
    sortOrder: 70,
    targetType: 'STORY',
    keywords: ['story', 'stories', 'сторис', 'истори']
  },
  {
    code: 'BOOSTS',
    name: 'Бусты',
    sortOrder: 80,
    targetType: 'CHANNEL',
    keywords: ['boost', 'буст', 'level', 'уровень', 'голос в канал']
  },
  {
    code: 'STREAMS',
    name: 'Стримы',
    sortOrder: 90,
    targetType: 'STREAM',
    keywords: ['stream', 'viewer', 'зрител', 'трансляци', 'стрим', 'online']
  },
  {
    code: 'AUTO_SERVICES',
    name: 'Авто-услуги',
    sortOrder: 100,
    targetType: 'CHANNEL_POSTS',
    keywords: ['auto', 'авто', 'подписка на', 'будущ', 'subscription']
  },
  {
    code: 'OTHER',
    name: 'Другое',
    sortOrder: 999,
    targetType: 'CUSTOM',
    keywords: []
  },
];

// ── Resolvers ──────────────────────────────────────────────────────────────

export function resolveCanonicalNetwork(input: string): CanonicalNetworkDefinition {
  const normalized = String(input || '').trim().toLowerCase();
  if (!normalized) {
    return CANONICAL_NETWORKS.find(n => n.code === 'OTHER')!;
  }

  // Exact code match
  const exact = CANONICAL_NETWORKS.find(n => n.code.toLowerCase() === normalized);
  if (exact) return exact;

  // Keyword match
  for (const net of CANONICAL_NETWORKS) {
    if (net.keywords.some(k => {
      const rex = new RegExp(`\\b${k}\\b`, 'i');
      return rex.test(normalized) || normalized.includes(k);
    })) {
      return net;
    }
  }

  return CANONICAL_NETWORKS.find(n => n.code === 'OTHER')!;
}

export function resolveCanonicalCategory(input: string): CanonicalCategoryDefinition {
  const normalized = String(input || '').trim().toLowerCase();
  if (!normalized) {
    return CANONICAL_CATEGORIES.find(c => c.code === 'OTHER')!;
  }

  // Exact code match
  const exact = CANONICAL_CATEGORIES.find(c => c.code.toLowerCase() === normalized);
  if (exact) return exact;

  // Check auto-services first if contains auto / future
  if (
    (normalized.includes('auto') || normalized.includes('авто')) &&
    (normalized.includes('view') || normalized.includes('like') || normalized.includes('просмотр') || normalized.includes('лайк'))
  ) {
    return CANONICAL_CATEGORIES.find(c => c.code === 'AUTO_SERVICES')!;
  }

  // Keyword match
  for (const cat of CANONICAL_CATEGORIES) {
    if (cat.keywords.some(k => normalized.includes(k))) {
      return cat;
    }
  }

  return CANONICAL_CATEGORIES.find(c => c.code === 'OTHER')!;
}

// ── Multi-Factor Sorting ───────────────────────────────────────────────────

export interface SortOrderParams {
  qualityTier?: string;
  warrantyDays?: number;
  pricePerUnitRub?: number;
  priceRankIndex?: number;
}

export function computeServiceSortOrder(params: SortOrderParams): number {
  const tier = params.qualityTier || 'STANDARD';
  const warranty = params.warrantyDays || 0;
  const priceRank = params.priceRankIndex || 0;

  let tierWeight = 3; // Standard default
  if (tier === 'VIP' || tier === 'PREMIUM') {
    tierWeight = 1;
  } else if (warranty > 0) {
    tierWeight = 2;
  } else if (tier === 'ECONOMY') {
    tierWeight = 4;
  }

  return tierWeight * 1000 + priceRank;
}

export class MultiFactorSorter {
  static sortServices<T extends { qualityTier?: string; warrantyDays?: number; pricePerUnitRub?: number }>(
    services: T[]
  ): T[] {
    return [...services].sort((a, b) => {
      const getTier = (s: T) => {
        if (s.qualityTier === 'VIP' || s.qualityTier === 'PREMIUM') return 1;
        if ((s.warrantyDays || 0) > 0) return 2;
        if (s.qualityTier === 'ECONOMY') return 4;
        return 3;
      };

      const tierA = getTier(a);
      const tierB = getTier(b);

      if (tierA !== tierB) {
        return tierA - tierB;
      }

      // Inside same tier, sort by pricePerUnitRub ascending
      const priceA = a.pricePerUnitRub || 0;
      const priceB = b.pricePerUnitRub || 0;
      return priceA - priceB;
    });
  }
}

// ── Adaptive Pricing Calculator ────────────────────────────────────────────

export interface PriceCalcInput {
  rawRate: number;
  providerCurrency: string;
  usdRate: number;
}

export interface PriceCalcResult {
  costPer1kRub: number;
  effectiveMarkup: number;
  pricePer1000Rub: number;
  pricePer1000Cents: number;
  pricePerUnitRub: number;
}

export function calculateImportPrice(input: PriceCalcInput): PriceCalcResult {
  const isUsd = input.providerCurrency.toUpperCase() === 'USD';
  const costPer1kRub = isUsd ? input.rawRate * input.usdRate : input.rawRate;

  // Apply Adaptive Pricing Ladder
  const retailFromLadder = applyPricingLadder(costPer1kRub);
  let effectiveMarkup = costPer1kRub > 0 ? retailFromLadder / costPer1kRub : SAFETY_FLOOR_MARKUP;

  // Safety floor markup check (>= 3.0x default)
  if (effectiveMarkup < SAFETY_FLOOR_MARKUP) {
    effectiveMarkup = SAFETY_FLOOR_MARKUP;
  }

  const rawRetailRub = costPer1kRub * effectiveMarkup;
  const roundedPricePer1000Rub = applyBeautifulRounding(rawRetailRub);
  const pricePer1000Cents = Math.round(roundedPricePer1000Rub * 100);
  const pricePerUnitRub = roundedPricePer1000Rub / 1000;

  return {
    costPer1kRub,
    effectiveMarkup,
    pricePer1000Rub: roundedPricePer1000Rub,
    pricePer1000Cents,
    pricePerUnitRub,
  };
}

// ── Human-in-the-Loop Clarification Gate ───────────────────────────────────

export interface HitlReviewCheckParams {
  networkCode: string;
  canonicalCategoryCode: string;
  confidence: number;
  needsHumanReview?: boolean;
}

export interface HitlReviewDecision {
  triggered: boolean;
  reason?: string;
}

export function shouldTriggerHitlReview(params: HitlReviewCheckParams): HitlReviewDecision {
  if (params.needsHumanReview) {
    return { triggered: true, reason: 'Явный флаг рецензии от AI-модели' };
  }

  if (params.confidence < 0.85) {
    return {
      triggered: true,
      reason: `Низкая уверенность классификации (${(params.confidence * 100).toFixed(0)}% < 85%)`
    };
  }

  if (params.networkCode === 'OTHER') {
    return { triggered: true, reason: 'Социальная сеть не распознана (отнесена в OTHER)' };
  }

  if (params.canonicalCategoryCode === 'OTHER') {
    return { triggered: true, reason: 'Категория услуги не сопоставлена с канонической (отнесена в OTHER)' };
  }

  return { triggered: false };
}

// ── Session Classification Memory ──────────────────────────────────────────

export interface CachedClassification {
  networkCode: string;
  canonicalCategoryCode: string;
}

export class SessionClassificationMemory {
  private memory = new Map<string, CachedClassification>();

  private normalizeKey(raw: string): string {
    return raw.trim().toLowerCase();
  }

  has(raw: string): boolean {
    return this.memory.has(this.normalizeKey(raw));
  }

  get(raw: string): CachedClassification | undefined {
    return this.memory.get(this.normalizeKey(raw));
  }

  set(raw: string, classification: CachedClassification): void {
    this.memory.set(this.normalizeKey(raw), classification);
  }

  clear(): void {
    this.memory.clear();
  }

  size(): number {
    return this.memory.size;
  }
}

// ── AI Analyzed Schema ─────────────────────────────────────────────────────

export const AiAnalyzedServiceSchema = z.object({
  externalId: z.string(),
  networkCode: z.string(),
  networkName: z.string(),
  canonicalCategoryCode: z.string(),
  categoryName: z.string(),
  cleanName: z.string().min(3),
  description: z.string().optional(),
  targetType: z.string().default('POST'),
  qualityTier: z.enum(['VIP', 'PREMIUM', 'STANDARD', 'ECONOMY']).default('STANDARD'),
  geo: z.string().default('WORLDWIDE'),
  warrantyDays: z.number().int().min(0).default(0),
  speedText: z.string().default('Стандартная'),
  isPrivateAware: z.boolean().default(false),
  confidence: z.number().min(0).max(1),
  needsHumanReview: z.boolean().default(false),
  reviewReason: z.string().optional(),
  isGarbage: z.boolean().default(false),
  garbageReason: z.string().optional(),
});

export type AiAnalyzedService = z.infer<typeof AiAnalyzedServiceSchema>;

// ── Service Quality & Garbage Gatekeeper ───────────────────────────────────

export const GARBAGE_STOP_PATTERNS = [
  /\[test\]/i,
  /\btest\s+only\b/i,
  /\bdo\s+not\s+order\b/i,
  /\bdon'?t\s+(?:use|order)\b/i,
  /\bnot\s+working\b/i,
  /\bdisabled\b/i,
  /\bdown\b/i,
  /\bpaused\b/i,
  /\btemporarily\s+unavailable\b/i,
  /\bunder\s+maintenance\b/i,
  /\bout\s+of\s+order\b/i,
  /\bdead\b/i,
  /\bbroken\b/i,
  /\bdeprecated\b/i,
  /\bbug\b/i,
  /не\s+заказывать/i,
  /(?:^|[\s,.[\]()_-])тест(?:[\s,.[\]()_-]|$)/i,
  /не\s+работает/i,
  /отключен[оаы]/i,
  /(?:^|[\s,.[\]()_-])пауза(?:[\s,.[\]()_-]|$)/i,
  /(?:^|[\s,.[\]()_-])стоп(?:[\s,.[\]()_-]|$)/i,
  /техрас?боты|техобслуживан/i,
  /временно\s+не\s+работает/i,
  /сломан[оаы]/i,
  /не\s+актуальн[оы]/i,
];

export const TOXIC_STOP_PATTERNS = [
  /снос.*канал/i,
  /бан.*конкурент/i,
  /жалоб/i,
  /\breport\s+account\b/i,
  /\bclaim\s+attack\b/i,
  /порнограф/i,
  /насили/i,
  /1\s*звезд.*бан/i,
];

export const MEANINGLESS_CATEGORY_VALUES = new Set([
  '',
  '0',
  '-',
  'без категории',
  'no category',
  'uncategorized',
  'default',
  'other',
  'category',
  'none',
  'null',
  'undefined',
  'test',
]);

export function isMeaninglessCategory(cat?: string | null): boolean {
  if (!cat) return true;
  const normalized = cat.trim().toLowerCase();
  if (normalized.length === 0) return true;
  return MEANINGLESS_CATEGORY_VALUES.has(normalized);
}

export interface RawServiceAuditInput {
  service: string | number;
  name: string;
  category?: string | null;
  rate: number | string;
  min: number | string;
  max: number | string;
}

export interface QualityAuditResult {
  status: 'APPROVED' | 'REJECT' | 'NEEDS_REVIEW';
  reason?: string;
  rejectCategory?: 'GARBAGE' | 'INVALID_PARAMS' | 'ORPHAN' | 'TOXIC';
}

export function auditServiceQuality(service: RawServiceAuditInput): QualityAuditResult {
  const name = String(service.name || '');
  const cat = String(service.category || '');
  const combined = `${name} ${cat}`.trim();

  // 1. Toxic / Forbidden Services Check
  for (const pat of TOXIC_STOP_PATTERNS) {
    if (pat.test(combined)) {
      return {
        status: 'REJECT',
        rejectCategory: 'TOXIC',
        reason: `Обнаружены признаки токсичной/запрещенной услуги (${pat.source})`,
      };
    }
  }

  // 2. Dead / Test / Deprecated Stop-Words Check
  for (const pat of GARBAGE_STOP_PATTERNS) {
    if (pat.test(combined)) {
      return {
        status: 'REJECT',
        rejectCategory: 'GARBAGE',
        reason: `Обнаружен маркер нерабочей/тестовой услуги (${pat.source})`,
      };
    }
  }

  // 3. Technical Invariants Check
  const rateNum = typeof service.rate === 'number' ? service.rate : parseFloat(String(service.rate));
  if (isNaN(rateNum) || rateNum <= 0) {
    return {
      status: 'REJECT',
      rejectCategory: 'INVALID_PARAMS',
      reason: `Невалидный тариф (rate <= 0): ${service.rate}`,
    };
  }

  const minNum = typeof service.min === 'number' ? service.min : parseInt(String(service.min), 10);
  const maxNum = typeof service.max === 'number' ? service.max : parseInt(String(service.max), 10);

  if (isNaN(minNum) || isNaN(maxNum) || minNum <= 0 || maxNum <= 0 || minNum > maxNum) {
    return {
      status: 'REJECT',
      rejectCategory: 'INVALID_PARAMS',
      reason: `Сломанный интервал объемов (min=${service.min}, max=${service.max})`,
    };
  }

  if (minNum > 500000) {
    return {
      status: 'REJECT',
      rejectCategory: 'INVALID_PARAMS',
      reason: `Заведомо нереалистичный минимальный порог: ${minNum} > 500 000`,
    };
  }

  // 4. Orphan / Meaningless Category Check
  if (isMeaninglessCategory(service.category)) {
    const net = resolveCanonicalNetwork(name);
    if (net.code === 'OTHER') {
      return {
        status: 'REJECT',
        rejectCategory: 'ORPHAN',
        reason: 'Бессмысленная услуга: отсутствует категория и не распознана соцсеть в названии',
      };
    } else {
      return {
        status: 'NEEDS_REVIEW',
        reason: `Восстановление категории: категория провайдера отсутствует, но распознана сеть ${net.name}`,
      };
    }
  }

  return { status: 'APPROVED' };
}
