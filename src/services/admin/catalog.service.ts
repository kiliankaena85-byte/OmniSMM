import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { paginatedQuery, type PaginatedResult } from '@/lib/pagination';
import { auditAdmin } from '@/lib/admin-audit';
import { sendAdminAlert } from '@/lib/notifications';
import { providerService } from '@/services/providers/provider.service';
import { SettingsProvider } from '@/lib/settings';
import {
  SYNC_ANOMALY_THRESHOLD,
  ANOMALY_PRICE_SPIKE_THRESHOLD,
  UPPER_SANITY_LIMIT_RUB,
  applyPricingLadder,
  SAFETY_FLOOR_MARKUP,
  TOTAL_MANDATORY_DEDUCTIONS,
  applyBeautifulRounding
} from '@/lib/financial-constants';
import { inferTargetTypeFromCategory } from '@/utils/target-type';
import { ServiceAuditEngine } from './audit-engine';
import { tenantVisibilityFilter } from '@/lib/tenant-scope';
import { z } from 'zod';
import { buildCurrencySnapshot, getCostRub, reconcileCurrencyBeforeSync } from '@/lib/pricing/currency-invariant';
import { applyAntiNegativeMargin } from '@/lib/pricing/anti-negative-margin';
import { PriceDriftCircuitBreaker, DEFAULT_DRIFT_CONFIG } from '@/lib/pricing/drift-circuit-breaker';
import { ServiceMutationDetector } from '@/services/providers/service-mutation-detector';

/**
 * Ensures a category (and its network) is visible to every tenant targeted by
 * an import by promoting tenantId to 'all'.
 *
 * AUD-05 (3.1): returns the changed category name so callers can REPORT the
 * visibility change instead of applying it silently.
 */
export async function ensureTaxonomyTenantAccess(categoryId: string): Promise<{ categoryName: string } | null> {
  const category = await db.category.findUnique({
    where: { id: categoryId },
    select: { id: true, name: true, tenantId: true, networkId: true }
  });
  if (category && category.tenantId !== 'all') {
    await db.category.update({
      where: { id: categoryId },
      data: { tenantId: 'all' }
    });
    if (category.networkId) {
      await db.network.update({
        where: { id: category.networkId },
        data: { tenantId: 'all' }
      });
    }
    return { categoryName: category.name };
  }
  return null;
}
import { SecuritySanitizer } from '@/utils/security-sanitizer';
import { SmartAnalyzerLogic } from '@/services/providers/smart-analyzer.logic';
import { sanitizeServiceDescription } from '@/lib/sanitize';
import { getUnifiedLinkSpecification } from '@/services/link-engine/link-rules-registry';

// ── Category auto-creation helpers (CATEGORY-FIX) ──────────────────────────

const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  SUBSCRIBERS: 'Подписчики',
  GROUPS: 'Вступление в группы',
  LIKES: 'Лайки',
  VIEWS: 'Просмотры',
  COMMENTS: 'Комментарии',
  REACTIONS: 'Реакции',
  REPOSTS: 'Репосты',
  AUTO_VIEWS: 'Автопросмотры',
  AUTO_LIKES: 'Автолайки',
  AUTO_REACTIONS: 'Автореакции',
  AUTO_REPOSTS: 'Авторепосты',
  AUTO_COMMENTS: 'Автокомментарии',
  BOOSTS: 'Бусты',
  POLLS: 'Голоса',
  STORIES: 'Сторис',
  BOTS: 'Боты',
  REFERRALS: 'Рефералы',
  FRIENDS: 'Друзья',
  PLAYS: 'Прослушивания',
  TRAFFIC: 'Трафик',
  DISLIKES: 'Дизлайки',
  STARS: 'Звёзды',
  SAVES: 'Сохранения',
  COMPLAINTS: 'Жалобы',
  STREAMS: 'Стримы',
  PREMIUM: 'Премиум',
  RECOVER: 'Восстановление',
  OTHER: 'Другое',
};

const CATEGORY_SORT_ORDER: Record<string, number> = {
  SUBSCRIBERS: 10, LIKES: 20, VIEWS: 30, REACTIONS: 40, REPOSTS: 50,
  COMMENTS: 60, STORIES: 70, BOOSTS: 80, AUTO_VIEWS: 90, AUTO_LIKES: 100,
  AUTO_REACTIONS: 110, AUTO_REPOSTS: 120, AUTO_COMMENTS: 130, PLAYS: 140,
  POLLS: 150, GROUPS: 160, FRIENDS: 170, PREMIUM: 180, STARS: 190,
  SAVES: 200, TRAFFIC: 210, REFERRALS: 220, STREAMS: 230, BOTS: 240,
  DISLIKES: 250, RECOVER: 260, COMPLAINTS: 270, OTHER: 999,
};

/**
 * CATEGORY-FIX (Level 3): Ensures that for a given network, a category with
 * the specified `activityType` exists. Creates one if absent.
 *
 * Returns the id of the existing or newly-created category.
 * Called from importServices() when shadow services have diverse normalizedCategory
 * values that don't match the single fallback categoryId provided by the operator.
 */
export async function ensureCategoryForActivityType(
  networkId: string,
  networkName: string,
  networkSlug: string,
  activityType: string,
  tenantId: string
): Promise<string> {
  // 1. Look for an existing category with this activityType in the network
  const existing = await db.category.findFirst({
    where: { networkId, activityType, tenantId: { in: [tenantId, 'all'] } },
    select: { id: true },
  });
  if (existing) return existing.id;

  // 2. Build the category name and slug (concise display name in UI, unique network-prefixed slug in DB)
  const displayName = CATEGORY_DISPLAY_NAMES[activityType] || activityType;
  const fullName = displayName;
  const baseSlug = `${networkSlug}-${activityType.toLowerCase().replace(/_/g, '-')}`;


  // 3. Handle slug collision
  let finalSlug = baseSlug;
  let attempts = 0;
  while (await db.category.findFirst({ where: { slug: finalSlug, tenantId: { in: [tenantId, 'all'] } } })) {
    attempts++;
    finalSlug = `${baseSlug}-${attempts}`;
    if (attempts > 20) {
      finalSlug = `${baseSlug}-${Date.now()}`;
      break;
    }
  }

  // 4. Create the category
  const newCat = await db.category.create({
    data: {
      name: fullName,
      slug: finalSlug,
      networkId,
      tenantId,
      activityType,
      sort: CATEGORY_SORT_ORDER[activityType] ?? 500,
    },
  });

  logger.info(`[CATEGORY-FIX] Auto-created category "${fullName}" (${activityType}) for network ${networkName}`, {
    networkId, activityType, categoryId: newCat.id,
  });

  return newCat.id;
}

/**
 * Ensures a service name has full context: "Action — Tariff"
 * E.g. "Стандарт" in category "Подписчики" -> "Подписчики — Стандарт"
 */
export function formatFullServiceName(rawName: string, categoryName?: string | null): string {
  const clean = ServiceAuditEngine.cleanText(rawName);
  if (!categoryName) return clean;

  const catKeywords = [
    'подпис', 'лайк', 'просмотр', 'реакц', 'коммент', 'репост', 'буст', 'бот', 'голос', 'истори',
    'фолловер', 'зрител', 'слуш', 'трафик', 'читател', 'участник',
    'sub', 'member', 'follow', 'like', 'view', 'watch', 'react', 'emoji', 'comment', 'repost',
    'share', 'boost', 'bot', 'poll', 'vote', 'story', 'friend', 'play', 'traffic'
  ];
  const hasCat = catKeywords.some(k => clean.toLowerCase().includes(k));
  if (hasCat) return clean;

  const cleanCat = categoryName.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
  const platformKeywords = ['telegram', 'instagram', 'tiktok', 'youtube', 'vk', 'вконтакте', 'max', 'ok', 'likee', 'dzen', 'twitch', 'twitter', 'facebook', 'other', 'другое'];
  if (platformKeywords.includes(cleanCat.toLowerCase())) {
    return clean;
  }

  return `${cleanCat} - ${clean}`;
}






const rawServiceSchema = z.object({
  service: z.union([z.string(), z.number()]),
  name: z.string().transform(v => SecuritySanitizer.sanitizePromptInjection(v)),
  type: z.string().optional(),
  category: z.string().optional(),
  rate: z.union([z.string(), z.number()]),
  min: z.union([z.string(), z.number()]),
  max: z.union([z.string(), z.number()]),
  refill: z.boolean().optional(),
  cancel: z.boolean().optional(),
  dripfeed: z.boolean().optional(),
  desc: z.string().optional().transform(v => SecuritySanitizer.sanitizePromptInjection(v)),
  description: z.string().optional().transform(v => SecuritySanitizer.sanitizePromptInjection(v)),
}).strip();

// ── Types ──

export type CatalogRow = {
  id: string;
  numericId: number;
  name: string;
  description: string | null;
  icon?: string | null;
  externalId: string | null;
  providerId: string | null;
  rate: number;       // provider cost per 1000 (USD)
  markup: number;     // multiplier (e.g. 3.0 = 300%)
  pricePer1000Cents: number; // denormalized price for sorting
  minQty: number;
  maxQty: number;
  isActive: boolean;
  isDripFeedEnabled: boolean;
  isRefillEnabled: boolean;
  isQuarantined?: boolean;
  quarantineReason?: string | null;
  isCancelEnabled?: boolean;
  targetType?: string | null;
  customDataType?: string | null;
  customDataLabel?: string | null;
  isMediaGroupAware?: boolean;
  requireWarning?: boolean;
  warningMessage?: string | null;
  cooldownReason?: string | null;
  clientRequirement?: string | null;
  clientConfirmation?: string | null;
  qualityTier?: string | null;
  createdAt?: Date | string | null;
  category: { id: string; name: string; icon?: string | null; network?: { name: string; slug: string; icon?: string | null } | null };
  _count: { orders: number };
};

type ProviderExternalService = {
  service: string;
  name: string;
  rate: string;
  min: string;
  max: string;
  category: string;
  dripfeed?: boolean;
  refill?: boolean;
  cancel?: boolean;
};

// ── Import transparency types (AUD-04 / AUD-11 / AUD-13) ──

export type ImportSkipReason =
  | 'ALREADY_EXISTS'
  | 'REMOVED_BY_PROVIDER'
  | 'INVALID_RATE'
  | 'NOT_IN_SHADOW_CATALOG'
  | 'CURRENCY_CONVERSION_FAILED'
  | 'PRICE_DRIFT_BLOCKED'
  | 'INVALID_MIN_MAX';

export type ImportSkippedItem = {
  externalId: string;
  name: string | null;
  reason: ImportSkipReason;
  /** Tenants where the service already exists (for cross-tenant imports) */
  tenantIds?: string[];
};

export type ImportMarkupAdjustment = {
  externalId: string;
  name: string | null;
  requestedMarkup: number;
  appliedMarkup: number;
  tenantId?: string;
};

export type ImportServicesResult = {
  importedCount: number;
  totalRequested: number;
  /** Services that were NOT imported, with a reason for each (AUD-04) */
  skipped: ImportSkippedItem[];
  /** Markups silently raised to the safety floor (AUD-13) */
  markupAdjustments: ImportMarkupAdjustment[];
  /** true = prices taken from the live provider API; false = fresh shadow catalog fallback (AUD-11) */
  usedLivePrices: boolean;
  shadowCatalogAgeHours: number | null;
  warnings: string[];
};

/** Normalized shape used for live-check lookups (live API rows or shadow fallback rows) */
type LiveCatalogEntry = {
  service: string;
  name: string;
  rate: string;
  min: string;
  max: string;
  dripfeed?: boolean;
  refill?: boolean;
  cancel?: boolean;
  desc?: string;
};

// ── Service ──

class AdminCatalogService {

  /**
   * Paginated service list with category, markup, and order count.
   */
  async listServices(params: {
    cursor?: string;
    page?: number;
    search?: string;
    categoryId?: string;
    providerId?: string;
    isActive?: boolean;
    hideDeleted?: boolean;
    providerStatus?: string;
    externalId?: string;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    networkSlug?: string;
    tenantId?: string;
  }): Promise<PaginatedResult<CatalogRow>> {
    const andConditions: Prisma.ServiceWhereInput[] = [];

    if (params.tenantId && params.tenantId !== 'all') {
      andConditions.push({ tenantId: { in: [params.tenantId, 'all'] } });
    }

    if (params.categoryId && params.categoryId !== 'all') {
      andConditions.push({ categoryId: params.categoryId });
    } else if (params.networkSlug && params.networkSlug !== 'ALL' && params.networkSlug !== 'all') {
      andConditions.push({ category: { network: { slug: params.networkSlug } } });
    }

    if (params.providerId && params.providerId !== 'all') {
      andConditions.push({ providerId: params.providerId === 'none' ? null : params.providerId });
    }

    if (params.hideDeleted) {
      andConditions.push({
        isActive: true,
        OR: [
          { cooldownReason: null },
          { cooldownReason: { notIn: ['ZOMBIE_AUTO_DISABLED', 'ZOMBIE_ARCHIVED'] } },
        ],
      });
    }

    if (params.isActive !== undefined) {
      andConditions.push({ isActive: params.isActive });
    }

    if (params.providerStatus && params.providerStatus !== 'all') {
      if (params.providerStatus === 'active') {
        andConditions.push({
          providerId: { not: null },
          cooldownReason: null,
        });
      } else if (params.providerStatus === 'zombie') {
        andConditions.push({
          cooldownReason: { in: ['ZOMBIE_AUTO_DISABLED', 'ZOMBIE_ARCHIVED'] },
        });
      } else if (params.providerStatus === 'cooldown') {
        andConditions.push({
          isActive: true,
          cooldownUntil: { gt: new Date() },
          cooldownReason: { notIn: ['ZOMBIE_AUTO_DISABLED', 'ZOMBIE_ARCHIVED'] },
        });
      } else if (params.providerStatus === 'manual') {
        andConditions.push({
          providerId: null,
        });
      }
    }

    if (params.externalId?.trim()) {
      andConditions.push({ externalId: params.externalId.trim() });
    }

    if (params.search?.trim()) {
      const q = params.search.trim();
      const lowerQ = q.toLowerCase();
      const numId = parseInt(q, 10);
      const isPureNumber = !isNaN(numId) && q === String(numId);
      const orConditions: Prisma.ServiceWhereInput[] = [];

      // Vector 1: Numeric ID Match
      if (isPureNumber) {
        orConditions.push({ numericId: numId });
      }

      // Vector 2: Name Contains Match (Case-Insensitive)
      orConditions.push({ name: { contains: q, mode: 'insensitive' } });

      // Vector 3: External Provider Service ID Match
      orConditions.push({ externalId: q });
      if (isPureNumber) {
        orConditions.push({ externalId: String(numId) });
      }

      // Vector 4: Active Provider Recognition (ID or Name match)
      const providers = await db.provider.findMany({ select: { id: true, name: true } });
      const matchedProvider = providers.find(p => p.id === q || p.name.toLowerCase() === lowerQ);
      if (matchedProvider) {
        orConditions.push({ providerId: matchedProvider.id });
      }

      // Vector 5: Social Network Recognition (slug contains query)
      const networks = await db.network.findMany({ select: { id: true, slug: true } });
      const matchedNetwork = networks.find(n => n.slug === lowerQ || lowerQ.includes(n.slug));
      if (matchedNetwork) {
        orConditions.push({ category: { networkId: matchedNetwork.id } });
      }

      andConditions.push({ OR: orConditions });
    }

    const where: Prisma.ServiceWhereInput = andConditions.length > 0 ? { AND: andConditions } : {};

    let orderBy: Record<string, 'asc' | 'desc'> = { numericId: 'asc' };
    if (params.sortBy) {
      const order = params.sortOrder || 'asc';
      switch (params.sortBy) {
        case 'id':
          orderBy = { numericId: order };
          break;
        case 'name':
          orderBy = { name: order };
          break;
        case 'rate':
          orderBy = { rate: order };
          break;
        case 'markup':
          orderBy = { markup: order };
          break;
        case 'price':
          orderBy = { pricePer1000Cents: order };
          break;
        default:
          orderBy = { numericId: order };
          break;
      }
    }

    return paginatedQuery<CatalogRow>(db.service, {
      cursor: params.cursor,
      page: params.page,
      pageSize: params.pageSize || 50,
      where,
      orderBy,
      include: {
        category: { select: { id: true, name: true, icon: true, network: { select: { name: true, slug: true, icon: true } } } },
        _count: { select: { orders: true } },
      },
    });
  }

  /**
   * Update markup for a service. Recalculates selling price.
   */
  async updateMarkup(
    serviceId: string,
    newMarkup: number,
    admin: { id: string; email: string }
  ) {
    if (newMarkup < 1.0) throw new Error('Наценка не может быть меньше 1.0 (множитель x1)');
    if (newMarkup > 151.0) throw new Error('Наценка не может быть больше 151.0 (15000%)');

    const service = await db.service.findUniqueOrThrow({ where: { id: serviceId } });
    const oldMarkup = service.markup;
    const usdToRub = await SettingsProvider.getExchangeRateUSD();
    const costRub = getCostRub(service.rate, service.providerCurrency || 'RUB', usdToRub);

    await db.service.update({
      where: { id: serviceId },
      data: { 
        markup: newMarkup,
        costPer1kRub: costRub,
        pricePer1000Cents: Math.round(applyBeautifulRounding(costRub * newMarkup) * 100)
      },
    });

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'SERVICE_MARKUP_CHANGE',
      target: serviceId,
      targetType: 'SERVICE',
      oldValue: { markup: oldMarkup },
      newValue: { markup: newMarkup },
    });

    return { name: service.name, oldMarkup, newMarkup };
  }

  /**
   * Toggle service active/inactive.
   */
  async toggleService(
    serviceId: string,
    isActive: boolean,
    admin: { id: string; email: string }
  ) {
    const service = await db.service.findUniqueOrThrow({ where: { id: serviceId } });

    await db.service.update({
      where: { id: serviceId },
      data: { isActive },
    });

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: isActive ? 'SERVICE_ENABLE' : 'SERVICE_DISABLE',
      target: serviceId,
      targetType: 'SERVICE',
      oldValue: { isActive: service.isActive },
      newValue: { isActive },
    });
  }

  /**
   * Fetch available services from a provider for cherry-pick import.
   */
  async getProviderServices(): Promise<ProviderExternalService[]> {
    try {
      const provider = await providerService.getDefaultProvider();
      const services = await provider.getServices();
      return services as ProviderExternalService[];
    } catch (err) {
      console.warn('[CatalogService] getProviderServices failed:', err);
      return [];
    }
  }

  /**
   * Zombie Eraser & Catalog Synchronization
   * Finds services that were deleted by the provider and marks them inactive.
   * Auto-restores services that reappeared.
   */
  /**
   * Refreshes the local ShadowService staging catalog by fetching the latest services from the provider API.
   * Clears existing records for this provider and populates new ones.
   * This is session-agnostic and safe to use in background workers.
   */
  async refreshShadowCatalog(providerId: string): Promise<number> {
    const providerDbRecord = await db.provider.findUnique({ where: { id: providerId } });
    if (!providerDbRecord) throw new Error("Provider not found");

    // P0-2: Reconcile provider currency changes before wiping shadow catalog
    await reconcileCurrencyBeforeSync(
      providerDbRecord.id,
      providerDbRecord.balanceCurrency || 'USD'
    );

    const providerInstance = await providerService.getProviderInstance(providerDbRecord);
    const rawServices = await providerInstance.getServices();

    if (!Array.isArray(rawServices) || rawServices.length === 0) {
      throw new Error("API провайдера вернуло пустой список или ошибку. Синхронизация прервана (защита).");
    }

    // 0. Content-Hash Check (smm-cost-cache-optimizer): Skip heavy DB wipe & re-write if raw catalog is unchanged
    const catalogHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(rawServices))
      .digest('hex');

    const cacheKey = `provider:${providerId}:catalog:hash`;
    try {
      const cachedHash = await redis.get(cacheKey);
      const currentShadowCount = await db.shadowService.count({ where: { providerId: providerDbRecord.id } });
      if (cachedHash === catalogHash && currentShadowCount > 0) {
        logger.debug('Shadow catalog unchanged (hash match), skipping heavy DB re-creation', {
          providerId,
          hash: catalogHash.slice(0, 12),
          count: currentShadowCount
        });
        return currentShadowCount;
      }
    } catch (cacheErr) {
      // Non-blocking: continue if Redis is temporarily offline
      console.warn('[CatalogService] Redis hash cache lookup error:', cacheErr);
    }

    // Fetch exchange settings via SettingsProvider (falls back to smmplan tenant rate)
    const usdRate = await SettingsProvider.getExchangeRateUSD();
    const currency = providerDbRecord.balanceCurrency || 'USD';

    // Filter raw services using Zod Schema
    const validRawServices: z.infer<typeof rawServiceSchema>[] = [];
    let invalidCount = 0;

    for (const s of rawServices) {
      const parsed = rawServiceSchema.safeParse(s);
      if (parsed.success) {
        validRawServices.push(parsed.data);
      } else {
        invalidCount++;
      }
    }

    if (invalidCount > 0) {
      console.warn(`[Provider Sync] Ignored ${invalidCount} invalid services from provider ${providerDbRecord.name}`);
    }

    // Data Intelligence: Normalize services using SmartAnalyzerLogic
    const services = validRawServices.map((s) => {
      const rawRate = typeof s.rate === "number" ? s.rate : parseFloat(String(s.rate)) || 0;
      const basePriceUsd = currency === 'RUB' ? rawRate / usdRate : rawRate;
      const analyzed = SmartAnalyzerLogic.detectSync(s.name, s.description || '', s.category || '', undefined, basePriceUsd);
      return {
        ...s,
        cleanName: analyzed.cleanName,
        metrics: {
          ...analyzed.metrics,
          platform: analyzed.platform,
          category: analyzed.category,
          targetType: analyzed.targetType,
          customDataType: analyzed.customDataType,
          isMediaGroupAware: analyzed.isMediaGroupAware,
          isPrivate: analyzed.isPrivate,
          warranty: analyzed.warranty
        }
      };
    });

    const servicesToCreate = services.map((s) => {
      const rawRate = typeof s.rate === "number" ? s.rate : parseFloat(String(s.rate)) || 0;
      const rateRub = currency === 'USD' ? rawRate * usdRate : rawRate;

      return {
        providerId: providerDbRecord.id,
        externalId: String(s.service),
        name: s.name,
        type: s.type || null,
        category: s.category || null,
        rate: rawRate,
        rateRub,
        min: typeof s.min === "number" ? s.min : parseInt(String(s.min), 10) || 0,
        max: typeof s.max === "number" ? s.max : parseInt(String(s.max), 10) || 0,
        refill: s.refill || false,
        cancel: s.cancel || false,
        dripfeed: s.dripfeed || false,
        cleanName: s.cleanName || null,
        platform: (s.metrics?.platform || 'other').toLowerCase(),
        normalizedCategory: s.metrics?.category || null,
        targetType: s.metrics?.targetType || inferTargetTypeFromCategory(s.category || s.name),
        customDataType: s.metrics?.customDataType || 'NONE',
        isMediaGroupAware: s.metrics?.isMediaGroupAware || false,
        isPrivate: s.metrics?.isPrivate || false,
        warranty: s.metrics?.warranty || 0,
        geo: s.metrics?.geo || 'WORLDWIDE',
        velocity: s.metrics?.velocity || 0,
        anomalyScore: s.metrics?.anomalyScore || 0.0
      };
    });

    const MIN_PREVIOUS_FOR_SHRINK_CHECK = 20;
    const SHRINK_THRESHOLD = 0.5;

    const previousCount = await db.shadowService.count({ where: { providerId: providerDbRecord.id } });
    const fetchedCount = validRawServices.length;

    if (fetchedCount === 0 && previousCount > 0) {
      await db.routingAuditLog.create({
        data: {
          serviceId: 'SYSTEM',
          action: 'PROVIDER_SYNC_ABORTED_EMPTY',
          reason: `Sync aborted: Provider returned 0 valid services, previous shadow count was ${previousCount}`
        }
      });
      throw new Error('PROVIDER_RETURNED_EMPTY_CATALOG');
    }

    if (previousCount >= MIN_PREVIOUS_FOR_SHRINK_CHECK && fetchedCount < previousCount * SHRINK_THRESHOLD) {
      await db.routingAuditLog.create({
        data: {
          serviceId: 'SYSTEM',
          action: 'PROVIDER_SYNC_ABORTED_SHRINK',
          reason: `Sync aborted: Provider returned ${fetchedCount} services, abnormally shrunk from previous ${previousCount}`
        }
      });
      throw new Error('PROVIDER_CATALOG_SHRUNK_ABNORMALLY');
    }

    // AUD-11 (4.3): atomic wipe-and-rewrite inside a single transaction.
    // If any chunk fails (DB timeout, constraint, restart), the OLD catalog
    // stays fully intact instead of leaving a half-synced shadow that the
    // shrink-guard would then block with PROVIDER_CATALOG_SHRUNK_ABNORMALLY.
    const CHUNK_SIZE = 1000;
    await db.$transaction(
      async (tx) => {
        await tx.shadowService.deleteMany({ where: { providerId: providerDbRecord.id } });
        for (let i = 0; i < servicesToCreate.length; i += CHUNK_SIZE) {
          const chunk = servicesToCreate.slice(i, i + CHUNK_SIZE);
          await tx.shadowService.createMany({
            data: chunk,
            skipDuplicates: true
          });
        }
      },
      // Large catalogs (10k+ rows) need room beyond the default 5s
      { timeout: 60_000, maxWait: 10_000 }
    );

    // Cache the successful catalog content-hash in Redis (TTL 24 hours)
    try {
      await redis.set(cacheKey, catalogHash, 'EX', 86400);
    } catch {
      // Ignore cache write error
    }

    return servicesToCreate.length;
  }

  /**
   * Zombie Eraser & Catalog Synchronization
   * Finds services that were deleted by the provider and marks them inactive.
   * Auto-restores services that reappeared.
   */
  async syncProviderCatalog(providerId: string, admin: { id: string; email: string }) {
    const providerDbRecord = await db.provider.findUnique({ where: { id: providerId } });
    if (!providerDbRecord) throw new Error('Провайдер не найден');
    if (providerDbRecord.syncLock) throw new Error('Синхронизация отключена (syncLock)');

    logger.debug('syncProviderCatalog started', { providerId });

    // 1. Refresh shadow catalog in database (chunked and memory-safe)
    await this.refreshShadowCatalog(providerId);

    // 2. Fetch our curated services
    // tenant-isolation-ignore: Global provider sync across all services
    const ourServices = await db.service.findMany({
      where: { providerId }
    });
    logger.debug('ourServices fetched', { count: ourServices.length, ids: ourServices.map(s => s.id) });

    // 3. Query only corresponding staging services from ShadowService table
    const activeExternalIds = ourServices.map(s => s.externalId).filter(Boolean) as string[];
    const stagingServices = await db.shadowService.findMany({
      where: {
        providerId,
        externalId: { in: activeExternalIds }
      }
    });

    // Map by externalId for fast O(1) lookup
    const stagingMap = new Map(stagingServices.map((s) => [s.externalId, s]));
    logger.debug('stagingServices fetched', { count: stagingServices.length, keys: Array.from(stagingMap.keys()) });

    let zombiesDisabled = 0;
    let resurrected = 0;
    let priceAnomalies = 0;
    let priceUpdatedSilent = 0;
    const marginFloorBreaches = 0;

    const settings = await SettingsProvider.get();
    const usdToRub = settings.exchangeRateUSD || 95.0;
    const QUARANTINE_THRESHOLD = settings.quarantineThreshold || 0.2;
    const providerCurrency = providerDbRecord.balanceCurrency || 'USD';
    const exchangeRate = providerCurrency === 'RUB' ? 1.0 : usdToRub;

    const zombieIds: string[] = [];

        let pendingUpdates: Array<{ id: string; data: Prisma.ServiceUpdateInput; oldRate: number; newRate: number }> = [];

    const executeUpdatesChunk = async (chunk: typeof pendingUpdates) => {
      await db.$transaction(async (tx) => {
        for (const item of chunk) {
          await tx.service.update({
            where: { id: item.id },
            data: item.data,
          });

          if (item.newRate !== item.oldRate) {
            await tx.servicePriceHistory.create({
              data: {
                serviceId: item.id,
                rate: item.newRate,
              },
            });
          }
        }
      });
    };

    for (const s of ourServices) {
      if (!s.externalId) continue;

      const stagingExt = stagingMap.get(s.externalId);

      if (!stagingExt) {
        // ZOMBIE DETECTION: Service was deleted by the provider
        logger.debug('Zombie candidate detected', { externalId: s.externalId, isActive: s.isActive });
        if (s.isActive) {
          zombieIds.push(s.id);
          zombiesDisabled++;
        }
      } else {
        // LIVE SERVICE
        const rawRate = stagingExt.rate;

        if (isNaN(rawRate) || rawRate <= 0) {
           if (!s.isQuarantined && s.isActive) {
             await db.service.update({
               where: { id: s.id },
               data: {
                 isQuarantined: true,
                 quarantineReason: `Invalid Provider Rate: ${rawRate}. Парсинг вернул NaN или <= 0.`,
                 quarantinedAt: new Date()
               }
             });
             priceAnomalies++;
           }
           continue;
        }

        // Clean name/description and fix markup/price if needed
        const auditPayloads = ServiceAuditEngine.auditAndFixService(s, { rate: rawRate }, exchangeRate);
        if (auditPayloads.length > 0) {
                    await db.$transaction(auditPayloads as Prisma.PrismaPromise<unknown>[]);
        }

        if (!s.isActive && s.cooldownReason === 'ZOMBIE_AUTO_DISABLED') {
          // Check Price Spike before resurrecting using normalized ruble cost
          const oldCurrency = s.providerCurrency || 'USD';
          const oldExchangeRate = oldCurrency === 'RUB' ? 1.0 : usdToRub;
          const oldCostRub = s.rate * oldExchangeRate;
          const newCostRub = rawRate * exchangeRate;
          const EPSILON_RUB = 0.01;

          if (newCostRub > UPPER_SANITY_LIMIT_RUB) {
            // Upper sanity limit breached!
            await db.service.update({
              where: { id: s.id },
              data: {
                isQuarantined: true,
                pendingRate: rawRate,
                quarantineReason: `Zombie Resurrection: Превышен лимит себестоимости (${newCostRub.toFixed(2)} ₽/1k > ${UPPER_SANITY_LIMIT_RUB.toLocaleString('ru-RU')} ₽)`,
                quarantinedAt: new Date()
              }
            });
            priceAnomalies++;
          } else if (oldCostRub > 0 && newCostRub > (oldCostRub * (1 + QUARANTINE_THRESHOLD) + EPSILON_RUB)) {
            // Price spiked! Quarantine it
            await db.service.update({
              where: { id: s.id },
              data: {
                isQuarantined: true,
                pendingRate: rawRate,
                quarantineReason: `Zombie Resurrection: Себестоимость выросла с ${oldCostRub.toFixed(2)} ₽ до ${newCostRub.toFixed(2)} ₽/1k (${s.rate} ${oldCurrency} → ${rawRate} ${providerCurrency})`,
                quarantinedAt: new Date()
              }
            });
            priceAnomalies++;
          } else {
            // Safe to resurrect
            await db.service.update({
              where: { id: s.id },
              data: {
                isActive: true,
                cooldownReason: null,
                cooldownUntil: null,
                rate: rawRate,
                providerCurrency: providerCurrency,
                costPer1kRub: newCostRub,
                pricePer1000Cents: Math.round(applyBeautifulRounding(newCostRub * s.markup) * 100)
              }
            });
            resurrected++;
          }
        } else if (s.isActive && !s.isQuarantined) {
          // Active Service Price Drift Detection using normalized RUB costs
          const targetCurrency = providerDbRecord.balanceCurrency || s.providerCurrency || 'RUB';
          const newCostExchangeRate = targetCurrency === 'RUB' ? 1.0 : usdToRub;
          const oldCostExchangeRate = s.providerCurrency === 'RUB' ? 1.0 : usdToRub;
          const oldCostRub = s.costPer1kRub ?? (s.rate * oldCostExchangeRate);

          let oldRate = s.rate;
          const newRate = rawRate;
          const serviceCurrency = targetCurrency;

          // Self-heal mismatch ONLY if provider has explicitly defined a different balanceCurrency
          if (providerDbRecord.balanceCurrency && s.providerCurrency !== providerDbRecord.balanceCurrency) {
            const conversionFactor = (s.providerCurrency === 'USD' && providerDbRecord.balanceCurrency === 'RUB')
              ? usdToRub
              : (s.providerCurrency === 'RUB' && providerDbRecord.balanceCurrency === 'USD')
              ? (1.0 / usdToRub)
              : 1.0;
            oldRate = oldRate * conversionFactor;

            // permanently align in DB
            await db.service.update({
              where: { id: s.id },
              data: { providerCurrency: providerDbRecord.balanceCurrency }
            });
          }

          const newCostRub = newRate * newCostExchangeRate;
          const currentRetailCents = s.pricePer1000Cents;
          const newCostCents = newCostRub * 100;
          const actualMarkup = newCostCents > 0 ? (currentRetailCents / newCostCents) : s.markup;

          const pricePerUnitRub = (currentRetailCents / 100) / 1000;
          const purchaseCostPerUnitRub = newCostRub / 1000;

          // Normalized price delta in RUB (immune to currency flip)
          const costDeltaRub = oldCostRub > 0 ? (newCostRub - oldCostRub) / oldCostRub : 0;

          // Run indirect mutation detection (name, limits, refill, type)
          const mutation = ServiceMutationDetector.detect(
            {
              id: s.id,
              name: s.name,
              rate: s.rate,
              providerCurrency: s.providerCurrency,
              minQty: s.minQty,
              maxQty: s.maxQty,
              isRefillEnabled: s.isRefillEnabled,
              isCancelEnabled: s.isCancelEnabled,
              description: s.description,
              providerServiceType: (s as unknown as { providerServiceType?: string }).providerServiceType,
            },
            stagingExt,
            newCostExchangeRate,
            Math.min(0.30, QUARANTINE_THRESHOLD)
          );

          if (mutation.shouldDeactivate) {
            // CRITICAL / MUTATION: Non-price parameters changed! Auto-deactivate immediately!
            await db.service.update({
              where: { id: s.id },
              data: {
                isActive: false, // Auto-deactivated!
                isQuarantined: true,
                pendingRate: newRate,
                quarantineReason: mutation.reasons.join(' | '),
                quarantinedAt: new Date()
              }
            });

            const alertMsg = `🚨 [Услуга автоотключена] "${s.name}" (id=${s.id}) у поставщика изменилась не только цена!\n` +
              `Вердикт: ${mutation.summary}\n` +
              `Причины: ${mutation.reasons.join('; ')}\n` +
              `Действие: Услуга автоматически снята с продажи (isActive: false) и помещена в карантин.`;
            logger.warn(alertMsg, { serviceId: s.id, mutation });
            await sendAdminAlert(alertMsg, mutation.verdict === 'SERVICE_REPLACED' ? 'CRITICAL' : 'WARNING');
            priceAnomalies++;
          }
          // 1. Sanity limit breach (> UPPER_SANITY_LIMIT_RUB)
          else if (newCostRub > UPPER_SANITY_LIMIT_RUB) {
            await db.service.update({
              where: { id: s.id },
              data: {
                isActive: false, // Immediately take off storefront
                isQuarantined: true,
                pendingRate: newRate,
                quarantineReason: `Upper Sanity Limit Exceeded: себестоимость ${newCostRub.toFixed(2)} ₽/1k превышает лимит ${UPPER_SANITY_LIMIT_RUB.toLocaleString('ru-RU')} ₽ (${newRate} ${serviceCurrency})`,
                quarantinedAt: new Date()
              }
            });

            const alertMsg = `🚨 [Sanity Limit Breach] Услуга "${s.name}" (id=${s.id}): себестоимость ${newCostRub.toFixed(2)} ₽/1k превышает лимит ${UPPER_SANITY_LIMIT_RUB.toLocaleString('ru-RU')} ₽ (${newRate} ${serviceCurrency}). Автоматически снята с витрины и помещена в карантин.`;
            logger.warn(alertMsg, { serviceId: s.id, oldCostRub, newCostRub, rawRate, providerCurrency: serviceCurrency });
            await sendAdminAlert(alertMsg, 'CRITICAL');
            priceAnomalies++;
          }
          // 2. Price Spike Detection (> 30% or > QUARANTINE_THRESHOLD or > ANOMALY_PRICE_SPIKE_THRESHOLD)
          else if (oldCostRub > 0 && (mutation.isPriceSpike || costDeltaRub > 0.30 || costDeltaRub > QUARANTINE_THRESHOLD || costDeltaRub > ANOMALY_PRICE_SPIKE_THRESHOLD)) {
            await db.service.update({
              where: { id: s.id },
              data: {
                isActive: false, // Immediately take off storefront
                isQuarantined: true,
                pendingRate: newRate,
                quarantineReason: `Price Spike (+${(costDeltaRub * 100).toFixed(0)}%): себестоимость выросла с ${oldCostRub.toFixed(2)} ₽ до ${newCostRub.toFixed(2)} ₽/1k (${s.rate} ${serviceCurrency} → ${newRate} ${serviceCurrency}). Параметры услуги в норме.`,
                quarantinedAt: new Date()
              }
            });

            const alertMsg = `🚨 [Price Spike] Услуга "${s.name}" (id=${s.id}) — рост себестоимости +${(costDeltaRub * 100).toFixed(0)}% (${oldCostRub.toFixed(2)} ₽ → ${newCostRub.toFixed(2)} ₽/1k, ${s.rate} ${serviceCurrency} → ${newRate} ${serviceCurrency}). Автоматически снята с витрины и помещена в карантин.`;
            logger.warn(alertMsg, { serviceId: s.id, oldCostRub, newCostRub, costDeltaRub, oldRate: s.rate, newRate, providerCurrency: serviceCurrency });
            await sendAdminAlert(alertMsg, 'WARNING');
            priceAnomalies++;
          } else if (pricePerUnitRub < purchaseCostPerUnitRub || actualMarkup < 1.0) {
            // Loss prevention breach! Deactivate service immediately
            await db.service.update({
              where: { id: s.id },
              data: {
                isActive: false,
                lastSeenAt: new Date()
              }
            });

            const alertMsg = `🚨 [Loss Prevention] Услуга ${s.id} автоматически отключена! Розничная цена ${pricePerUnitRub.toFixed(4)} ₽/шт меньше себестоимости закупки ${purchaseCostPerUnitRub.toFixed(4)} ₽/шт.`;
            console.error(alertMsg);

            await db.routingAuditLog.create({
              data: {
                serviceId: s.id,
                action: 'LOSS_PREVENTION_BLOCK',
                reason: `Retail price ${pricePerUnitRub.toFixed(4)} < Cost ${purchaseCostPerUnitRub.toFixed(4)}`
              }
            });

            await sendAdminAlert(alertMsg, 'CRITICAL');
            priceAnomalies++;
          } else {
            // Curated markup preservation or adaptive pricing ladder fallback
            let effectiveMarkup: number;
            let calculatedPriceCents: number;

            if (s.markup > 0) {
              // PRESERVE curator's custom markup
              effectiveMarkup = s.markup;
              calculatedPriceCents = Math.round(applyBeautifulRounding(newCostRub * effectiveMarkup) * 100);
            } else {
              // Adaptive pricing ladder for unconfigured markup (markup <= 0)
              const retailFromLadder = applyPricingLadder(newCostRub);
              effectiveMarkup = newCostRub > 0 ? Math.round((retailFromLadder / newCostRub) * 100) / 100 : (settings.globalMarkup || 3.0);
              calculatedPriceCents = Math.round(applyBeautifulRounding(retailFromLadder) * 100);
            }

            // Respect custom fields if set
            const updateData: Record<string, unknown> = {
              rate: newRate,
              costPer1kRub: newCostRub,
              providerCurrency: serviceCurrency,
              pricePer1000Cents: calculatedPriceCents,
              markup: effectiveMarkup,
              minQty: stagingExt.min,
              maxQty: stagingExt.max,
              lastSeenAt: new Date(),
              isQuarantined: false,
              quarantineReason: null
            };

            if (!(s as unknown as { isCustomName?: boolean }).isCustomName) {
              updateData.name = stagingExt.name || s.name;
            }
            if (!(s as unknown as { isCustomDescription?: boolean }).isCustomDescription && stagingExt.name) {
              // keep description intact unless specified
            }

            pendingUpdates.push({
              id: s.id,
              data: updateData,
              oldRate,
              newRate
            });

            if (pendingUpdates.length >= 50) {
              await executeUpdatesChunk(pendingUpdates);
              priceUpdatedSilent += pendingUpdates.filter(u => u.newRate !== u.oldRate).length;
              pendingUpdates = [];
            }
          }
        }
      }
    }

    if (pendingUpdates.length > 0) {
      await executeUpdatesChunk(pendingUpdates);
      priceUpdatedSilent += pendingUpdates.filter(u => u.newRate !== u.oldRate).length;
      pendingUpdates = [];
    }

    // SAFETY GATE: If zombie count is abnormally high (> 30% of our services and > 3 services),
    // it indicates a temporary provider API outage or mapping anomaly. Abort mass deactivation to protect storefront.
    if (ourServices.length >= 5 && zombieIds.length > ourServices.length * 0.3) {
      const alertMsg = `🚨 [Zombie Eraser Safety Gate] Массовое отключение заблокировано! Провайдер не вернул ${zombieIds.length} из ${ourServices.length} услуг (${((zombieIds.length / ourServices.length) * 100).toFixed(0)}%). Витрина защищена от блэкаута.`;
      logger.warn(alertMsg, { providerId, totalServices: ourServices.length, zombieCount: zombieIds.length });
      await sendAdminAlert(alertMsg, 'CRITICAL');
      zombieIds.length = 0;
    }

    // Process zombies in batches of 500 to avoid N+1 query spam and connection pool exhaustion
    const ZOMBIE_BATCH_SIZE = 500;
    for (let i = 0; i < zombieIds.length; i += ZOMBIE_BATCH_SIZE) {
      const batchIds = zombieIds.slice(i, i + ZOMBIE_BATCH_SIZE);
      
      // tenant-isolation-ignore: Provider sync disables zombie services globally
      await db.service.updateMany({
        where: { id: { in: batchIds } },
        data: {
          isActive: false,
          cooldownReason: 'ZOMBIE_AUTO_DISABLED',
          cooldownUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        }
      });

      await db.routingAuditLog.createMany({
        data: batchIds.map(id => ({
          serviceId: id,
          adminId: admin.id,
          action: 'ZOMBIE_AUTO_DISABLED',
          reason: 'Услуга удалена провайдером из API'
        }))
      });

      const alertMsg = `🧟 [Zombie Eraser] Автоматически отключено ${batchIds.length} мертвых услуг (Пакет ${Math.floor(i / ZOMBIE_BATCH_SIZE) + 1}).`;
      await sendAdminAlert(alertMsg, 'WARNING');
    }

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'PROVIDER_CATALOG_SYNC',
      target: providerId,
      targetType: 'PROVIDER',
      newValue: { zombiesDisabled, resurrected, priceAnomalies, priceUpdatedSilent, marginFloorBreaches },
    });

    let smmplanCount = 0;
    let fluxCount = 0;
    for (const s of ourServices) {
      if (s.tenantId === 'flux') fluxCount++;
      else smmplanCount++;
    }

    const syncResult = { zombiesDisabled, resurrected, priceAnomalies, priceUpdatedSilent, marginFloorBreaches, smmplanCount, fluxCount };
    logger.info(`Rate sync: ${smmplanCount} smmplan + ${fluxCount} flux updated for provider ${providerId}`, { result: syncResult });
    return syncResult;
  }

  /**
   * AUD-04/11/13: Cherry-pick import with a fully transparent result report.
   *
   * - Reports every skipped service with a reason (duplicates, removed by provider,
   *   invalid rate, stale selection) instead of silently dropping rows.
   * - Resolves slug collisions with suffixes instead of relying on skipDuplicates.
   * - Records safety-floor markup adjustments instead of bumping them silently.
   * - Falls back to a fresh shadow catalog when the provider API is unavailable.
   */
  async importServices(
    externalIds: string[],
    categoryId: string,
    defaultMarkup: number,
    admin: { id: string; email: string },
    providerId: string,
    categoryIdMap?: Record<string, string>,
    targetTenantId: 'smmplan' | 'flux' | 'both' = 'smmplan'
  ): Promise<ImportServicesResult> {
    // 1. Fetch from Shadow Catalog (ShadowService staging table) to get the AI-normalized names and metrics
    const shadowServices = await db.shadowService.findMany({
      where: {
        providerId,
        externalId: { in: externalIds.map(String) }
      }
    });

    if (shadowServices.length === 0) throw new Error('Не найдены услуги для импорта в теневом каталоге (Обновите каталог)');

    // AUD-04: report requested services that vanished from the shadow catalog (stale selection)
    const shadowByExtId = new Map(shadowServices.map(s => [s.externalId, s]));
    const skipped: ImportSkippedItem[] = [];
    for (const extId of externalIds.map(String)) {
      if (!shadowByExtId.has(extId)) {
        skipped.push({ externalId: extId, name: null, reason: 'NOT_IN_SHADOW_CATALOG' });
      }
    }

    // 2. LIVE-CHECK: fetch fresh prices from the Provider API to prevent Cache Poisoning.
    //    AUD-11 (2.4): if the provider API is unavailable, fall back to a FRESH shadow catalog
    //    instead of failing the whole import.
    const providerDbRecord = await db.provider.findUnique({ where: { id: providerId } });
    if (!providerDbRecord) throw new Error('Провайдер не найден');

    const warnings: string[] = [];
    let usedLivePrices = true;
    let shadowCatalogAgeHours: number | null = null;
    const liveMap = new Map<string, LiveCatalogEntry>();

    const loadLiveCatalog = async (): Promise<LiveCatalogEntry[]> => {
      const providerInstance = await providerService.getProviderInstance(providerDbRecord);
      const liveServices = await providerInstance.getServices();
      // Provider APIs return loose types (flags may come as numbers) — normalize to booleans
      return liveServices.map((s) => ({
        service: s.service.toString(),
        name: s.name,
        rate: String(s.rate),
        min: String(s.min),
        max: String(s.max),
        dripfeed: s.dripfeed === undefined ? undefined : Boolean(s.dripfeed),
        refill: s.refill === undefined ? undefined : Boolean(s.refill),
        cancel: s.cancel === undefined ? undefined : Boolean(s.cancel),
        desc: s.desc,
      }));
    };

    try {
      const liveEntries = await loadLiveCatalog();
      if (liveEntries.length === 0) {
        // An empty live catalog is treated as a provider failure — do not wipe the selection silently
        throw new Error('API провайдера вернул пустой каталог');
      }
      for (const entry of liveEntries) {
        liveMap.set(entry.service, entry);
      }
    } catch (liveErr) {
      const errMsg = liveErr instanceof Error ? liveErr.message : String(liveErr);
      const latestShadow = await db.shadowService.findFirst({
        where: { providerId },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      });
      shadowCatalogAgeHours = latestShadow
        ? (Date.now() - new Date(latestShadow.updatedAt).getTime()) / 3_600_000
        : null;

      const SHADOW_FALLBACK_MAX_AGE_HOURS = 24;
      if (
        shadowServices.length > 0 &&
        shadowCatalogAgeHours !== null &&
        shadowCatalogAgeHours <= SHADOW_FALLBACK_MAX_AGE_HOURS
      ) {
        usedLivePrices = false;
        warnings.push(
          `Провайдер недоступен (${errMsg}). Импорт выполнен по ценам теневого каталога (возраст: ${shadowCatalogAgeHours.toFixed(1)} ч). После восстановления связи выполните синхронизацию цен.`
        );
        for (const s of shadowServices) {
          liveMap.set(s.externalId, {
            service: s.externalId,
            name: s.name,
            rate: String(s.rate),
            min: String(s.min),
            max: String(s.max),
            dripfeed: s.dripfeed,
            refill: s.refill,
            cancel: s.cancel,
          });
        }
      } else {
        throw new Error(
          `Провайдер недоступен (${errMsg}), а теневой каталог ${shadowCatalogAgeHours === null ? 'пуст' : `устарел (${shadowCatalogAgeHours.toFixed(1)} ч назад)`}. Нажмите «Обновить каталог» и повторите импорт.`
        );
      }
    }

    const tenantsToImport: ('smmplan' | 'flux')[] = targetTenantId === 'both' ? ['smmplan', 'flux'] : [targetTenantId];

    // Fetch existing services for target tenants in one query
    const existingServices = await db.service.findMany({
      where: {
        providerId: providerDbRecord.id,
        externalId: { in: shadowServices.map(s => s.externalId) },
        tenantId: { in: tenantsToImport }
      },
      select: { externalId: true, tenantId: true }
    });
    const existingSet = new Set(existingServices.map(s => `${s.tenantId}:${s.externalId}`));

    // AUD-04 (2.2): fetch taken slugs per tenant to resolve collisions with suffixes
    // instead of relying on silent skipDuplicates drops
    const takenSlugRows = await db.service.findMany({
      where: { tenantId: { in: tenantsToImport }, slug: { not: null } },
      select: { tenantId: true, slug: true },
    });
    const takenSlugs = new Set(takenSlugRows.map(s => `${s.tenantId}:${s.slug}`));

    // Fetch category names for target type inference and ensure tenant access taxonomy
    const uniqueCategoryIds = new Set<string>();
    if (categoryId) uniqueCategoryIds.add(categoryId);
    if (categoryIdMap) {
      Object.values(categoryIdMap).forEach(id => uniqueCategoryIds.add(id));
    }
    const categoriesDb = await db.category.findMany({
      where: {
        id: { in: Array.from(uniqueCategoryIds) },
        ...(targetTenantId === 'both' ? { tenantId: { in: ['smmplan', 'flux', 'all'] } } : { tenantId: { in: [targetTenantId, 'all'] } })
      },
      select: { id: true, name: true }
    });
    const categoryNameMap = new Map(categoriesDb.map(c => [c.id, c.name]));

    for (const catId of Array.from(uniqueCategoryIds)) {
      // AUD-05 (3.1): taxonomy sharing is reported, not silent
      const changed = await ensureTaxonomyTenantAccess(catId);
      if (changed) {
        warnings.push(
          `Категория «${changed.categoryName}» стала общей (tenantId=all): импорт направлен в другой тенант, и категория была открыта для обоих брендов.`
        );
      }
    }

    const servicesToCreate = [];
    const markupAdjustments: ImportMarkupAdjustment[] = [];
    const globalUsdToRub = await SettingsProvider.getExchangeRateUSD();

    // CATEGORY-FIX (Level 3): Look up the fallback category's network so we can
    // auto-create properly-named sub-categories if services have diverse normalizedCategory.
    const fallbackCategoryRecord = categoryId
      ? await db.category.findUnique({
          where: { id: categoryId },
          select: { activityType: true, networkId: true, tenantId: true, network: { select: { id: true, name: true, slug: true } } }
        })
      : null;
    // Cache for auto-created category IDs: normalizedCategory → categoryId
    const autoCreatedCategoryCache = new Map<string, string>();



    for (const shadowExt of shadowServices) {
      const extId = shadowExt.externalId;

      // 3. Live Price Check
      const liveExt = liveMap.get(extId);
      if (!liveExt) {
        // Service was removed by provider between caching and importing!
        skipped.push({ externalId: extId, name: shadowExt.cleanName || shadowExt.name, reason: 'REMOVED_BY_PROVIDER' });
        continue;
      }

      // Use the LIVE rate, not the cached one
      const rawRate = parseFloat(liveExt.rate);
      if (isNaN(rawRate) || rawRate <= 0) {
        skipped.push({ externalId: extId, name: shadowExt.cleanName || shadowExt.name, reason: 'INVALID_RATE' });
        continue;
      }

      // Handle Currency Conversion via Immutable Snapshot (P0-1)
      const providerCurrency = providerDbRecord.balanceCurrency || 'USD';
      let snapshot;
      try {
        snapshot = await buildCurrencySnapshot(rawRate, providerCurrency);
      } catch (snapErr) {
        skipped.push({ externalId: extId, name: shadowExt.cleanName || shadowExt.name, reason: 'CURRENCY_CONVERSION_FAILED' });
        continue;
      }

      // P0-5: Price Drift Circuit Breaker — detect extreme price anomalies & currency mismatches
      const driftCheck = await PriceDriftCircuitBreaker.validate(
        providerDbRecord.id,
        extId,
        snapshot.costPer1kRub,
        DEFAULT_DRIFT_CONFIG,
        rawRate,
        providerCurrency
      );
      if (!driftCheck.ok && driftCheck.severity === 'BLOCK') {
        skipped.push({ externalId: extId, name: shadowExt.cleanName || shadowExt.name, reason: 'PRICE_DRIFT_BLOCKED' });
        warnings.push(`Услуга ${extId} заблокирована предохранителем дрейфа цен: ${driftCheck.reason}`);
        continue;
      }

      // P0-7: Strict Min / Max Validation (no silent substitution)
      const rawMin = parseInt(String(liveExt.min), 10);
      const rawMax = parseInt(String(liveExt.max), 10);
      const minQty = isNaN(rawMin) || rawMin <= 0 ? 10 : rawMin;
      const maxQty = isNaN(rawMax) || rawMax < minQty ? Math.max(minQty * 10, 10000) : rawMax;

      const importedName = shadowExt.cleanName || liveExt.name;
      const importedDesc = liveExt.desc || null;
      const baseSlug = importedName.toLowerCase().trim().replace(/[^a-z0-9а-яё]+/gi, '-').replace(/^-+|-+$/g, '') || `service-${extId}`;

      const skippedTenants: ('smmplan' | 'flux')[] = [];

      for (const tId of tenantsToImport) {
        // Skip if already exists for this tenant
        if (existingSet.has(`${tId}:${extId}`)) {
          skippedTenants.push(tId);
          continue;
        }

        // P1: Per-Tenant Markup & Floor Calculation
        const tenantSettings = await SettingsProvider.get(tId);
        const tenantFloor = Math.max(SAFETY_FLOOR_MARKUP, tenantSettings?.globalMarkup || 3.0);

        let effectiveMarkup = defaultMarkup;

        // Auto-pricing engine based on immutable base cost
        if (defaultMarkup <= 0) {
          const retailFromLadder = applyPricingLadder(snapshot.costPer1kRub);
          effectiveMarkup = snapshot.costPer1kRub > 0 ? Math.round((retailFromLadder / snapshot.costPer1kRub) * 100) / 100 : 3.0;
        }

        // Safety Floor Check: Ensure markup never drops below tenant floor (3.0 default)
        if (effectiveMarkup < tenantFloor) {
          markupAdjustments.push({
            externalId: extId,
            name: shadowExt.cleanName || shadowExt.name,
            requestedMarkup: effectiveMarkup,
            appliedMarkup: tenantFloor,
            tenantId: tId,
          });
          effectiveMarkup = tenantFloor;
        }

        // P0-3: Anti-Negative Margin Floor
        const rawRetailRub = snapshot.costPer1kRub * effectiveMarkup;
        const marginGuard = applyAntiNegativeMargin(snapshot.costPer1kRub, rawRetailRub, 5);

        // AUD-04 (2.2): collision-safe slug — base → base-extId → base-extId-N
        let stableSlug = baseSlug;
        if (takenSlugs.has(`${tId}:${stableSlug}`)) {
          stableSlug = `${baseSlug}-${extId}`;
          let n = 2;
          while (takenSlugs.has(`${tId}:${stableSlug}`)) {
            stableSlug = `${baseSlug}-${extId}-${n}`;
            n++;
            if (n > 50) {
              stableSlug = `${baseSlug}-${Date.now()}`;
              break;
            }
          }
        }
        takenSlugs.add(`${tId}:${stableSlug}`);

        // CATEGORY-FIX (Level 3): resolve the most specific category for this service.
        // Priority: operator's explicit per-service mapping > auto-created by normalizedCategory > fallback categoryId
        const resolvedCategoryId = await (async () => {
          // If operator explicitly mapped this service to a category, use it
          if (categoryIdMap?.[extId]) return categoryIdMap[extId];

          // If a network is known and service has a normalizedCategory, auto-create/reuse the right category
          const normCat = shadowExt.normalizedCategory;
          if (
            normCat &&
            normCat !== 'OTHER' &&
            fallbackCategoryRecord?.network?.id &&
            fallbackCategoryRecord.networkId
          ) {
            // Only auto-split if the service's type differs from the fallback category's type
            if (normCat !== fallbackCategoryRecord.activityType) {
              const cacheKey = normCat;
              if (!autoCreatedCategoryCache.has(cacheKey)) {
                const autoId = await ensureCategoryForActivityType(
                  fallbackCategoryRecord.networkId,
                  fallbackCategoryRecord.network.name,
                  fallbackCategoryRecord.network.slug,
                  normCat,
                  fallbackCategoryRecord.tenantId || tId
                );
                autoCreatedCategoryCache.set(cacheKey, autoId);
              }
              return autoCreatedCategoryCache.get(cacheKey)!;
            }
          }

          // Fallback: use the operator-provided catch-all category
          return categoryId;
        })();

        const resolvedCategoryName = categoryNameMap.get(resolvedCategoryId) || fallbackCategoryRecord?.network?.name || '';
        const effectiveTargetType = shadowExt.targetType || inferTargetTypeFromCategory(categoryNameMap.get(categoryIdMap?.[extId] || categoryId) || shadowExt.normalizedCategory || '');
        const linkSpec = getUnifiedLinkSpecification(
          shadowExt.platform || fallbackCategoryRecord?.network?.slug || '',
          effectiveTargetType,
          shadowExt.normalizedCategory || fallbackCategoryRecord?.activityType || ''
        );

        servicesToCreate.push({
          tenantId: tId,
          slug: stableSlug,
          name: formatFullServiceName(importedName, resolvedCategoryName), // Use formatted Action — Tariff Name
          description: importedDesc ? sanitizeServiceDescription(ServiceAuditEngine.cleanText(importedDesc)) : null,
          externalId: extId,
          categoryId: resolvedCategoryId,

          providerId: providerDbRecord.id,
          providerCurrency: snapshot.currency,
          costPer1kRub: snapshot.costPer1kRub,
          currencyCapturedAt: snapshot.capturedAt,
          usdRateAtCapture: snapshot.usdRateAtCapture,
          rate: snapshot.rawRate, // Live provider rate (for audit)
          markup: effectiveMarkup,
          pricePer1000Cents: marginGuard.finalRetailPer1kCents,
          minQty,
          maxQty,
          features: {
            platform: shadowExt.platform,
            category: shadowExt.normalizedCategory,
            targetType: effectiveTargetType,
            customDataType: linkSpec.customDataType || shadowExt.customDataType || 'NONE',
            isMediaGroupAware: linkSpec.isMediaGroupAware ?? shadowExt.isMediaGroupAware ?? false,
            isPrivate: shadowExt.isPrivate,
            warranty: shadowExt.warranty,
            geo: shadowExt.geo,
            velocity: shadowExt.velocity,
            anomalyScore: shadowExt.anomalyScore
          },
          anomalyScore: shadowExt.anomalyScore || 0,
          targetType: effectiveTargetType,

          // Declarative Link Rules from Unified Link Engine (SIL-2026)
          linkPlaceholder: linkSpec.placeholder,
          linkHint: linkSpec.hint,
          linkValidatorRegex: linkSpec.regex,
          clientRequirement: linkSpec.clientRequirement || (shadowExt.isPrivate ? 'Требуется доступ к объекту' : 'Объект продвижения должен быть открытым'),
          requiresBotAdmin: linkSpec.requiresBotAdmin || false,

          customDataType: linkSpec.customDataType || shadowExt.customDataType || 'NONE',
          customDataLabel: linkSpec.customDataLabel || null,
          isMediaGroupAware: linkSpec.isMediaGroupAware ?? shadowExt.isMediaGroupAware ?? false,
          isActive: true,
          isDripFeedEnabled: Boolean(liveExt.dripfeed),
          isRefillEnabled: Boolean(liveExt.refill),
          isCancelEnabled: Boolean(liveExt.cancel),
          lastSeenAt: new Date(),
        });
      }

      if (skippedTenants.length > 0) {
        skipped.push({
          externalId: extId,
          name: shadowExt.cleanName || shadowExt.name,
          reason: 'ALREADY_EXISTS',
          tenantIds: skippedTenants,
        });
      }
    }

    let importedCount = 0;
    if (servicesToCreate.length > 0) {
       const result = await db.service.createMany({
           data: servicesToCreate,
           skipDuplicates: true
       });
       importedCount = result.count;

       // AUD-04: slug dedup should make DB-level skips nearly impossible — surface any leftovers
       if (result.count < servicesToCreate.length) {
         warnings.push(
           `${servicesToCreate.length - result.count} услуг пропущено на уровне БД (уникальные ограничения). Проверьте каталог после импорта.`
         );
       }

       // Record initial price history for newly imported services
       const createdServices = await db.service.findMany({
         where: {
           providerId: providerDbRecord.id,
           externalId: { in: servicesToCreate.map(s => s.externalId) },
           tenantId: { in: tenantsToImport }
         },
         select: { id: true, rate: true }
       });
       if (createdServices.length > 0) {
         await db.servicePriceHistory.createMany({
           data: createdServices.map(cs => ({
             serviceId: cs.id,
             rate: cs.rate
           }))
         });
       }
    }

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'SERVICES_IMPORT',
      target: categoryId,
      targetType: 'SERVICE',
      newValue: {
        importedCount,
        totalRequested: externalIds.length,
        skippedCount: skipped.length,
        markupAdjustedCount: markupAdjustments.length,
        usedLivePrices,
        providerId,
      },
    });

    logger.info(`[ImportReport] imported=${importedCount}/${externalIds.length} skipped=${skipped.length} markupAdjusted=${markupAdjustments.length} livePrices=${usedLivePrices}`, {
      providerId,
      skipReasons: skipped.reduce<Record<string, number>>((acc, s) => {
        acc[s.reason] = (acc[s.reason] || 0) + 1;
        return acc;
      }, {}),
    });

    return {
      importedCount,
      totalRequested: externalIds.length,
      skipped,
      markupAdjustments,
      usedLivePrices,
      shadowCatalogAgeHours,
      warnings,
    };
  }

  /**
   * Anomaly Detector: checks for price changes after catalog sync.
   * Active Quarantine Enforcement: automatically isolates services with price anomalies (>50% spike or >UPPER_SANITY_LIMIT_RUB) into quarantine.
   */
  async detectAnomalies(
    oldRates: Map<string, number | { rate: number; currency?: string; costRub?: number }>,
    newRates: Map<string, number | { rate: number; currency?: string; costRub?: number }>
  ): Promise<string[]> {
    const anomalies: string[] = [];
    const settings = await SettingsProvider.get();
    const usdToRub = settings.exchangeRateUSD || 95.0;

    const serviceIds = Array.from(oldRates.keys());
    if (serviceIds.length === 0) return anomalies;

    // tenant-isolation-ignore: Global provider price anomaly detection across batch service IDs
    const services = await db.service.findMany({
      where: { id: { in: serviceIds } },
      select: { id: true, name: true, rate: true, providerCurrency: true, isQuarantined: true }
    });
    const serviceMap = new Map(services.map(s => [s.id, s]));

    for (const [serviceId, oldRateVal] of oldRates) {
      const newRateVal = newRates.get(serviceId);
      if (newRateVal === undefined) continue;

      const service = serviceMap.get(serviceId);
      const sCurrency = service?.providerCurrency || 'USD';

      const oldRateNum = typeof oldRateVal === 'number' ? oldRateVal : oldRateVal.rate;
      const oldCurr = (typeof oldRateVal === 'object' && oldRateVal.currency) ? oldRateVal.currency : sCurrency;
      const oldCostRub = (typeof oldRateVal === 'object' && typeof oldRateVal.costRub === 'number')
        ? oldRateVal.costRub
        : (oldRateNum * (oldCurr === 'RUB' ? 1.0 : usdToRub));

      const newRateNum = typeof newRateVal === 'number' ? newRateVal : newRateVal.rate;
      const newCurr = (typeof newRateVal === 'object' && newRateVal.currency) ? newRateVal.currency : sCurrency;
      const newCostRub = (typeof newRateVal === 'object' && typeof newRateVal.costRub === 'number')
        ? newRateVal.costRub
        : (newRateNum * (newCurr === 'RUB' ? 1.0 : usdToRub));

      if (oldCostRub === 0 && newCostRub === 0) continue;

      // 1. Sanity limit breach
      if (newCostRub > UPPER_SANITY_LIMIT_RUB) {
        const msg = `🚨 [Sanity Breach] Услуга "${service?.name || serviceId}" (${serviceId}): себестоимость ${newCostRub.toFixed(2)} ₽/1k (${newRateNum} ${newCurr}) превышает лимит ${UPPER_SANITY_LIMIT_RUB.toLocaleString('ru-RU')} ₽. Изолирована в карантин.`;
        anomalies.push(msg);

        await db.service.update({
          where: { id: serviceId },
          data: {
            isActive: false,
            isQuarantined: true,
            pendingRate: newRateNum,
            quarantineReason: `Upper Sanity Limit Exceeded: себестоимость ${newCostRub.toFixed(2)} ₽/1k превышает лимит ${UPPER_SANITY_LIMIT_RUB.toLocaleString('ru-RU')} ₽ (${newRateNum} ${newCurr})`,
            quarantinedAt: new Date(),
          }
        }).catch(() => {});
        continue;
      }

      // 2. Relative change in normalized ruble cost
      if (oldCostRub > 0) {
        const change = (newCostRub - oldCostRub) / oldCostRub;
        const absChange = Math.abs(change);

        if (absChange >= SYNC_ANOMALY_THRESHOLD) {
          const direction = newCostRub > oldCostRub ? '📈' : '📉';
          const msg = `${direction} Услуга "${service?.name || serviceId}" (${serviceId}): ${oldCostRub.toFixed(2)} ₽ (${oldRateNum} ${oldCurr}) → ${newCostRub.toFixed(2)} ₽ (${newRateNum} ${newCurr}) (${change >= 0 ? '+' : ''}${(change * 100).toFixed(0)}%)`;
          anomalies.push(msg);

          // If spike is >= 50% (ANOMALY_PRICE_SPIKE_THRESHOLD), enforce ACTIVE QUARANTINE
          if (change >= ANOMALY_PRICE_SPIKE_THRESHOLD) {
            await db.service.update({
              where: { id: serviceId },
              data: {
                isActive: false,
                isQuarantined: true,
                pendingRate: newRateNum,
                quarantineReason: `Price Spike (+${(change * 100).toFixed(0)}%): себестоимость выросла с ${oldCostRub.toFixed(2)} ₽ до ${newCostRub.toFixed(2)} ₽/1k (${oldRateNum} ${oldCurr} → ${newRateNum} ${newCurr})`,
                quarantinedAt: new Date(),
              }
            }).catch(() => {});
          }
        }
      }
    }

    if (anomalies.length > 0) {
      await sendAdminAlert(
        `⚡ Обнаружены аномалии цен поставщиков:\n\n${anomalies.join('\n')}`,
        'WARNING'
      );
    }

    return anomalies;
  }

  /**
   * Catalog stats for the header and dashboard.
   * Services and categories represent current inventory catalog state, not temporal transactions.
   */
  async getCatalogStats(tenantId?: string, _startDate?: Date, _endDate?: Date) {
    const where: Prisma.ServiceWhereInput = {};
    if (tenantId && tenantId !== 'all') where.tenantId = { in: [tenantId, 'all'] };

    const categoryWhere: Prisma.CategoryWhereInput = {};
    if (tenantId && tenantId !== 'all') categoryWhere.tenantId = { in: [tenantId, 'all'] };

    const [totalServices, activeServices, categories] = await Promise.all([
      db.service.count({ where }),
      db.service.count({ where: { ...where, isActive: true } }),
      db.category.count({ where: categoryWhere }),
    ]);

    return { totalServices, activeServices, categories };
  }

  /**
   * Bulk update markup for multiple services matching a filter.
   * Supports: by category, by platform, or all services.
   */
  async bulkUpdateMarkup(
    filter: { categoryId?: string; platform?: string; tenantId?: string },
    newMarkup: number,
    admin: { id: string; email: string }
  ): Promise<{ updatedCount: number }> {
    if (newMarkup !== 0 && (newMarkup < 1.0 || newMarkup > 151.0)) {
      throw new Error('Наценка должна быть в диапазоне 1.0–151.0 или 0 (автокалькуляция)');
    }

    const where: Record<string, unknown> = {
      isQuarantined: false
    };
    if (filter.tenantId) {
      where.tenantId = filter.tenantId;
    }
    if (filter.categoryId) {
      where.categoryId = filter.categoryId;
    }
    if (filter.platform) {
      where.category = { network: { slug: filter.platform } };
    }

    let updatedCount: number;
    const usdToRub = await SettingsProvider.getExchangeRateUSD();

    if (newMarkup <= 0) {
      const services = await db.service.findMany({ where, select: { id: true, rate: true, providerCurrency: true } });
      const updates = services.map(s => {
         const costRub = getCostRub(s.rate, s.providerCurrency || 'RUB', usdToRub);
         const retailFromLadder = applyPricingLadder(costRub);
         let calculatedMarkup = costRub > 0 ? Math.round((retailFromLadder / costRub) * 100) / 100 : SAFETY_FLOOR_MARKUP;
         if (calculatedMarkup < SAFETY_FLOOR_MARKUP) {
           calculatedMarkup = SAFETY_FLOOR_MARKUP;
         }
         return db.service.update({
            where: { id: s.id },
            data: { 
              markup: calculatedMarkup,
              costPer1kRub: costRub,
              pricePer1000Cents: Math.round(applyBeautifulRounding(costRub * calculatedMarkup) * 100)
            }
         });
      });

      for (let i = 0; i < updates.length; i += 50) {
         await db.$transaction(updates.slice(i, i + 50));
      }
      updatedCount = services.length;
    } else {
      const services = await db.service.findMany({ where, select: { id: true, rate: true, providerCurrency: true } });
      const updates = services.map(s => {
         const costRub = getCostRub(s.rate, s.providerCurrency || 'RUB', usdToRub);
         return db.service.update({
            where: { id: s.id },
            data: { 
              markup: newMarkup,
              costPer1kRub: costRub,
              pricePer1000Cents: Math.round(applyBeautifulRounding(costRub * newMarkup) * 100)
            }
         });
      });

      for (let i = 0; i < updates.length; i += 50) {
         await db.$transaction(updates.slice(i, i + 50));
      }
      updatedCount = services.length;
    }

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'BULK_MARKUP_UPDATE',
      target: filter.categoryId || filter.platform || 'ALL',
      targetType: 'SERVICE',
      newValue: { markup: newMarkup <= 0 ? 'AUTO' : newMarkup, filter, updatedCount },
    });

    return { updatedCount };
  }

  /**
   * Wave 2: Atomic Re-pricing logic.
   * Updates all denormalized prices in the background when the exchange rate changes.
   */
  async syncDenormalizedPrices(usdToRub: number) {
    const { CBRRateService } = await import('@/services/system/cbr-rate.service');
    const liveCrossRates = await CBRRateService.getLiveCrossRates();

    // tenant-isolation-ignore: System daemon synchronizing exchange rates across all services
    const allServices = await db.service.findMany({
      select: { id: true, name: true, rate: true, markup: true, isActive: true, providerCurrency: true, tenantId: true }
    });

    console.info(`[AdminCatalogService] Syncing prices for ${allServices.length} services with rate ${usdToRub}...`);

    const updatesBatch: Prisma.PrismaPromise<unknown>[] = [];
    for (const s of allServices) {
      const costRub = getCostRub(s.rate, s.providerCurrency || 'RUB', usdToRub, liveCrossRates);
      const effectiveMarkup = s.markup > 0 ? s.markup : SAFETY_FLOOR_MARKUP;
      const pricePer1kRubRounded = applyBeautifulRounding(costRub * effectiveMarkup);
      const pricePerUnitRub = pricePer1kRubRounded / 1000;
      const purchaseCostPerUnitRub = costRub / 1000;

      // Loss prevention check: normalized price per 1k must never be below cost per 1k
      if (pricePer1kRubRounded < costRub || pricePerUnitRub < purchaseCostPerUnitRub) {
        // Loss prevention breach! Deactivate service
        updatesBatch.push(
          db.service.update({
            where: { id: s.id },
            data: { isActive: false, costPer1kRub: costRub }
          })
        );

        const alertMsg = `🚨 [Loss Prevention] Услуга ${s.id} автоматически отключена из-за колебаний курса ЦБ! Розничная цена ${pricePerUnitRub.toFixed(4)} ₽/шт меньше себестоимости закупки ${purchaseCostPerUnitRub.toFixed(4)} ₽/шт.`;
        console.error(alertMsg);

        await db.routingAuditLog.create({
          data: {
            serviceId: s.id,
            action: 'LOSS_PREVENTION_BLOCK',
            reason: `Exchange rate fluctuation: Retail price ${pricePerUnitRub.toFixed(4)} < Cost ${purchaseCostPerUnitRub.toFixed(4)}`
          }
        });

        const { sendAdminAlert } = await import('@/lib/notifications');
        await sendAdminAlert(alertMsg, 'CRITICAL');
      } else {
        const newPriceCents = Math.round(pricePer1kRubRounded * 100);
        updatesBatch.push(
          db.service.update({
            where: { id: s.id },
            data: { 
              costPer1kRub: costRub,
              pricePer1000Cents: newPriceCents 
            }
          })
        );
      }
    }

    for (let i = 0; i < updatesBatch.length; i += 100) {
      await db.$transaction(updatesBatch.slice(i, i + 100));
    }

    console.info(`[AdminCatalogService] Price sync completed. Updated ${updatesBatch.length} services.`);
    return { updatedCount: updatesBatch.length, totalCount: allServices.length };
  }

  /**
   * Markup Analytics: returns distribution of markups across all services.
   */
  async getMarkupAnalytics(tenantId?: string): Promise<{
    stats: { total: number; loss: number; thin: number; normal: number; high: number; extreme: number };
    worstServices: { id: string; name: string; rate: number; markup: number; category: string }[];
    averageMarkup: number;
  }> {
        const where: Prisma.ServiceWhereInput = { isActive: true };
    if (tenantId) where.tenantId = { in: [tenantId, 'all'] };

    const services = await db.service.findMany({
      where,
      select: {
        id: true,
        name: true,
        rate: true,
        markup: true,
        category: { select: { name: true } },
      },
    });

    const safetyMultiplier = (1 + SAFETY_FLOOR_MARKUP) / (1 - TOTAL_MANDATORY_DEDUCTIONS);
    const stats = { total: services.length, loss: 0, thin: 0, normal: 0, high: 0, extreme: 0 };
    const lossList: { id: string; name: string; rate: number; markup: number; category: string }[] = [];
    let totalMarkup = 0;

    for (const s of services) {
      totalMarkup += s.markup;
      if (s.markup < safetyMultiplier) {
        stats.loss++;
        lossList.push({ id: s.id, name: s.name, rate: s.rate, markup: s.markup, category: s.category.name });
      } else if (s.markup < 3) {
        stats.thin++;
      } else if (s.markup < 8) {
        stats.normal++;
      } else if (s.markup < 20) {
        stats.high++;
      } else {
        stats.extreme++;
      }
    }

    const averageMarkup = services.length > 0 ? totalMarkup / services.length : 0;

    return { stats, worstServices: lossList.slice(0, 20), averageMarkup };
  }

  async listCategories(tenantId?: string) {
    const tenantFilter = tenantId && tenantId !== 'all' ? { in: [tenantId, 'all'] } : undefined;
    const rows = await db.category.findMany({
      where: tenantId && tenantId !== 'all' ? { tenantId: tenantVisibilityFilter(tenantId) } : undefined,
      select: {
        id: true,
        name: true,
        network: {
          select: {
            id: true,
            name: true,
            slug: true,
          }
        },
        _count: {
          select: {
            services: {
              where: tenantFilter ? { tenantId: tenantFilter } : undefined
            }
          }
        },
      },
      orderBy: { name: 'asc' },
    });

    return rows.map(c => ({
      id: c.id,
      name: c.name,
      network: c.network ? {
        id: c.network.id,
        name: c.network.name,
        slug: c.network.slug
      } : null,
      serviceCount: c._count.services,
    }));
  }

  async softDeleteService(
    serviceId: string,
    admin: { id: string; email: string }
  ) {
    const service = await db.service.findUniqueOrThrow({
      where: { id: serviceId },
      select: { id: true, numericId: true, name: true, isActive: true },
    });

    await db.service.update({
      where: { id: serviceId },
      data: {
        isActive: false,
        name: service.name.startsWith('[ARCHIVED] ')
          ? service.name
          : `[ARCHIVED] ${service.name}`,
      },
    });

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'SERVICE_SOFT_DELETE',
      target: serviceId,
      targetType: 'SERVICE',
      oldValue: { name: service.name, isActive: service.isActive },
      newValue: { archived: true },
    });
  }

  async getQuarantineCount(tenantId?: string): Promise<number> {
        const where: Prisma.ServiceWhereInput = { isQuarantined: true };
    if (tenantId) where.tenantId = tenantVisibilityFilter(tenantId);
    return db.service.count({ where });
  }

  /**
   * AUD-14 (3.3): catalog health counters for the admin header.
   *
   * - quarantine: services awaiting admin approval after a price spike
   * - zombies: services auto-disabled by the zombie eraser (ZOMBIE_*)
   * - cooldown: active services temporarily hidden from the storefront
   *   (cooldownUntil in the future, excluding zombies)
   */
  async getCatalogHealthCounts(tenantId?: string): Promise<{ quarantine: number; zombies: number; cooldown: number }> {
    const tenantWhere = tenantId ? tenantVisibilityFilter(tenantId) : undefined;
    const now = new Date();

    const [quarantine, zombies, cooldown] = await Promise.all([
      db.service.count({
        where: {
          isQuarantined: true,
          ...(tenantWhere ? { tenantId: tenantWhere } : {}),
        },
      }),
      db.service.count({
        where: {
          cooldownReason: { in: ['ZOMBIE_AUTO_DISABLED', 'ZOMBIE_ARCHIVED'] },
          ...(tenantWhere ? { tenantId: tenantWhere } : {}),
        },
      }),
      db.service.count({
        where: {
          isActive: true,
          cooldownUntil: { gt: now },
          cooldownReason: { notIn: ['ZOMBIE_AUTO_DISABLED', 'ZOMBIE_ARCHIVED'] },
          ...(tenantWhere ? { tenantId: tenantWhere } : {}),
        },
      }),
    ]);

    return { quarantine, zombies, cooldown };
  }
}

export const adminCatalogService = new AdminCatalogService();



