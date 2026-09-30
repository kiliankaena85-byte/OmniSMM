import { z } from 'zod';
import crypto from 'node:crypto';
import { redis } from '@/lib/redis';
import { assertSafeUrl } from '@/utils/ssrf-guard';
import { ExactMath } from '@/lib/financial/exact-math';
import { CANONICAL_NETWORKS, CANONICAL_CATEGORIES } from './ai-catalog-importer';
import directProvidersData from '@/data/providers/smm-direct-providers.json';

// ── Zod Schemas for SMM Panel API v2 ─────────────────────────────────────────

export const RawProviderServiceSchema = z.object({
  service: z.union([z.string(), z.number()]).transform(String),
  name: z.string().optional().default('Unknown Service'),
  category: z.string().optional().default('Unknown Category'),
  rate: z.union([z.string(), z.number()]).transform(String),
  min: z.union([z.string(), z.number()]).transform(String),
  max: z.union([z.string(), z.number()]).transform(String),
  type: z.string().optional().default('Default'),
  dripfeed: z.union([z.number(), z.boolean(), z.string()]).optional(),
  refill: z.union([z.number(), z.boolean(), z.string()]).optional(),
  cancel: z.union([z.number(), z.boolean(), z.string()]).optional(),
}).passthrough();

export const RawProviderServicesListSchema = z.array(RawProviderServiceSchema);

export type RawProviderService = z.input<typeof RawProviderServiceSchema>;

export interface DirectProviderProfile {
  id: string;
  name: string;
  website: string;
  apiUrl: string;
  tier: number;
  currency: 'USD' | 'RUB' | 'EUR';
  supportedMethods: string[];
  primaryNetworks: string[];
  rating: number;
  avgResponseMs: number;
  features: {
    dripfeed: boolean;
    refill: boolean;
    cancel: boolean;
    channelBoosts: boolean;
    autoViews: boolean;
  };
  benchmarkServices: Array<{
    service: string;
    name: string;
    category: string;
    rate: string;
    min: string;
    max: string;
    network: string;
  }>;
}

export interface NormalizedScannedService {
  serviceId: string;
  name: string;
  networkCode: string;
  categoryCode: string;
  rawCategory: string;
  wholesaleRateRubKopecks: bigint;
  wholesaleRatePer1000Rub: number;
  retailBenchmarkPer1000Rub: number;
  potentialMarginPercent: number;
  min: number;
  max: number;
  refill: boolean;
  cancel: boolean;
  dripfeed: boolean;
}

export interface ProviderScanReport {
  providerId: string;
  providerName: string;
  apiUrl: string;
  currency: string;
  totalServices: number;
  scannedAt: string;
  networkBreakdown: Record<string, number>;
  topMarginServices: NormalizedScannedService[];
  catalogHash: string;
  cachedInRedis: boolean;
}

// ── Default Currency Exchange Rates (conservative default for margin safety) ──
const DEFAULT_USD_TO_RUB = 92.5;
const DEFAULT_EUR_TO_RUB = 101.0;

// ── Retail Benchmark Map for OmniSMM (RUB per 1,000 units or per item) ───────
export const RETAIL_BENCHMARK_PRICES_RUB: Record<string, number> = {
  'TELEGRAM:BOOSTS': 45.0, // 45 RUB per boost (1 item)
  'TELEGRAM:SUBSCRIBERS': 149.0, // 149 RUB per 1K members
  'TELEGRAM:VIEWS': 5.5, // 5.5 RUB per 1K views
  'TELEGRAM:REACTIONS': 12.0, // 12 RUB per 1K reactions
  'TELEGRAM:BOTS': 250.0, // 250 RUB per 1K bot starts
  'VK:SUBSCRIBERS': 349.0, // 349 RUB per 1K followers
  'VK:LIKES': 110.0, // 110 RUB per 1K likes
  'VK:VIEWS': 39.0, // 39 RUB per 1K views
  'VK:REPOSTS': 190.0, // 190 RUB per 1K reposts
  'YOUTUBE:VIEWS': 390.0, // 390 RUB per 1K high retention views
  'YOUTUBE:SUBSCRIBERS': 1800.0, // 1800 RUB per 1K subscribers
  'YOUTUBE:LIKES': 95.0, // 95 RUB per 1K likes
  'INSTAGRAM:SUBSCRIBERS': 240.0, // 240 RUB per 1K followers
  'INSTAGRAM:LIKES': 35.0, // 35 RUB per 1K likes
  'INSTAGRAM:VIEWS': 15.0, // 15 RUB per 1K views
  'TIKTOK:VIEWS': 6.0, // 6 RUB per 1K views
  'TIKTOK:SUBSCRIBERS': 380.0, // 380 RUB per 1K followers
  'TIKTOK:LIKES': 95.0, // 95 RUB per 1K likes
  'TWITCH:STREAMS': 490.0, // 490 RUB per stream viewers package
  'TWITCH:SUBSCRIBERS': 350.0, // 350 RUB per 1K followers
  'TWITCH:VIEWS': 490.0, // 490 RUB per stream viewers
  'KICK:STREAMS': 550.0, // 550 RUB per stream viewers package
  'YOUTUBE:STREAMS': 590.0, // 590 RUB per live stream viewers package
  'OK:SUBSCRIBERS': 280.0, // 280 RUB per 1K members
  'RUTUBE:VIEWS': 180.0, // 180 RUB per 1K views
  'DZEN:SUBSCRIBERS': 390.0, // 390 RUB per 1K subscribers
  'DEFAULT': 100.0,
};

export class DirectProviderScannerService {
  /**
   * Returns the list of pre-configured direct providers from registry
   */
  public static getKnownDirectProviders(): DirectProviderProfile[] {
    return directProvidersData as DirectProviderProfile[];
  }

  /**
   * Detect canonical network code from name and category strings
   */
  public static detectNetwork(serviceName: string, categoryName: string): string {
    const combined = `${serviceName} ${categoryName}`.toLowerCase();

    // 1. Check primary brand names first with strict word boundaries
    const priorityChecks: Array<{ code: string; patterns: RegExp[] }> = [
      { code: 'TELEGRAM', patterns: [/(?:^|[^a-z0-9а-яё])(telegram|телеграм|телеграмм|тг)(?:$|[^a-z0-9а-яё])/i] },
      { code: 'TIKTOK', patterns: [/(?:^|[^a-z0-9а-яё])(tiktok|тикток|тик-ток|tt)(?:$|[^a-z0-9а-яё])/i] },
      { code: 'YOUTUBE', patterns: [/(?:^|[^a-z0-9а-яё])(youtube|ютуб|ютубе|yt)(?:$|[^a-z0-9а-яё])/i] },
      { code: 'VK', patterns: [/(?:^|[^a-z0-9а-яё])(vkontakte|вконтакте|вк|vk)(?:$|[^a-z0-9а-яё])/i] },
      { code: 'INSTAGRAM', patterns: [/(?:^|[^a-z0-9а-яё])(instagram|инстаграм|инста|ig)(?:$|[^a-z0-9а-яё])/i] },
      { code: 'TWITCH', patterns: [/(?:^|[^a-z0-9а-яё])(twitch|твич)(?:$|[^a-z0-9а-яё])/i] },
      { code: 'KICK', patterns: [/(?:^|[^a-z0-9а-яё])(kick|кик)(?:$|[^a-z0-9а-яё])/i] },
      { code: 'TROVO', patterns: [/(?:^|[^a-z0-9а-яё])(trovo|трово)(?:$|[^a-z0-9а-яё])/i] },
      { code: 'DISCORD', patterns: [/(?:^|[^a-z0-9а-яё])(discord|дискорд)(?:$|[^a-z0-9а-яё])/i] },
      { code: 'TWITTER', patterns: [/(?:^|[^a-z0-9а-яё])(twitter|твиттер|x\.com)(?:$|[^a-z0-9а-яё])/i] },
      { code: 'RUTUBE', patterns: [/(?:^|[^a-z0-9а-яё])(rutube|рутуб)(?:$|[^a-z0-9а-яё])/i] },
      { code: 'DZEN', patterns: [/(?:^|[^a-z0-9а-яё])(dzen|дзен)(?:$|[^a-z0-9а-яё])/i] },
      { code: 'OK', patterns: [/(?:^|[^a-z0-9а-яё])(одноклассники|ok\.ru)(?:$|[^a-z0-9а-яё])/i] },
      { code: 'FACEBOOK', patterns: [/(?:^|[^a-z0-9а-яё])(facebook|fb|фейсбук)(?:$|[^a-z0-9а-яё])/i] },
    ];

    for (const check of priorityChecks) {
      for (const pat of check.patterns) {
        if (pat.test(combined)) {
          return check.code;
        }
      }
    }

    // Fallback: check canonical networks with word boundary
    for (const net of CANONICAL_NETWORKS) {
      if (net.code === 'OTHER') continue;
      for (const kw of net.keywords) {
        const regex = new RegExp(`(?:^|[^a-z0-9а-яё])${kw}(?:$|[^a-z0-9а-яё])`, 'i');
        if (regex.test(combined)) {
          return net.code;
        }
      }
    }

    return 'OTHER';
  }

  /**
   * Detect canonical category code from name and category strings
   */
  public static detectCategory(serviceName: string, categoryName: string): string {
    const combined = `${serviceName} ${categoryName}`.toLowerCase();

    // 1. Check specific Telegram boosts first
    if (combined.includes('boost') || combined.includes('буст')) {
      return 'BOOSTS';
    }

    // 2. Check live streams before regular post views (to prevent "viewers" matching "views")
    if (
      combined.includes('stream') ||
      combined.includes('стрим') ||
      combined.includes('трансляци') ||
      combined.includes('зрител') ||
      combined.includes('прямой эфир') ||
      combined.includes('live viewers')
    ) {
      return 'STREAMS';
    }

    for (const cat of CANONICAL_CATEGORIES) {
      for (const kw of cat.keywords) {
        if (combined.includes(kw)) {
          return cat.code;
        }
      }
    }
    return 'OTHER';
  }

  /**
   * Converts raw rate to RUB kopecks BigInt and calculates margin
   */
  public static calculatePricingMetrics(
    rawRate: string,
    currency: string,
    networkCode: string,
    categoryCode: string
  ): {
    wholesaleRateRubKopecks: bigint;
    wholesaleRatePer1000Rub: number;
    retailBenchmarkPer1000Rub: number;
    potentialMarginPercent: number;
  } {
    const numericRate = parseFloat(rawRate) || 0;
    let rateInRub = numericRate;

    if (currency.toUpperCase() === 'USD') {
      rateInRub = numericRate * DEFAULT_USD_TO_RUB;
    } else if (currency.toUpperCase() === 'EUR') {
      rateInRub = numericRate * DEFAULT_EUR_TO_RUB;
    }

    const wholesaleRateRubKopecks = ExactMath.rublesToKopecks(Math.max(0, rateInRub));
    const wholesaleRatePer1000Rub = ExactMath.kopecksToRubles(wholesaleRateRubKopecks);

    const lookupKey = `${networkCode}:${categoryCode}`;
    const retailBenchmarkPer1000Rub =
      RETAIL_BENCHMARK_PRICES_RUB[lookupKey] ??
      RETAIL_BENCHMARK_PRICES_RUB['DEFAULT'] ??
      100.0;

    let potentialMarginPercent = 0;
    if (wholesaleRatePer1000Rub > 0) {
      potentialMarginPercent = Math.round(
        ((retailBenchmarkPer1000Rub - wholesaleRatePer1000Rub) / wholesaleRatePer1000Rub) * 100
      );
    }

    return {
      wholesaleRateRubKopecks,
      wholesaleRatePer1000Rub,
      retailBenchmarkPer1000Rub,
      potentialMarginPercent,
    };
  }

  /**
   * Normalizes raw services from a provider into structured format
   */
  public static normalizeServices(
    rawServices: RawProviderService[],
    currency: string
  ): NormalizedScannedService[] {
    return rawServices.map((raw) => {
      const name = raw.name ?? 'Unknown Service';
      const category = raw.category ?? 'Unknown Category';
      const rateStr = String(raw.rate);

      const networkCode = this.detectNetwork(name, category);
      const categoryCode = this.detectCategory(name, category);
      const pricing = this.calculatePricingMetrics(rateStr, currency, networkCode, categoryCode);

      const minVal = parseInt(String(raw.min), 10);
      const maxVal = parseInt(String(raw.max), 10);

      const isRefill = Boolean(
        raw.refill === 1 || raw.refill === true || raw.refill === '1' || raw.refill === 'true'
      );
      const isCancel = Boolean(
        raw.cancel === 1 || raw.cancel === true || raw.cancel === '1' || raw.cancel === 'true'
      );
      const isDripfeed = Boolean(
        raw.dripfeed === 1 || raw.dripfeed === true || raw.dripfeed === '1' || raw.dripfeed === 'true'
      );

      return {
        serviceId: String(raw.service),
        name,
        networkCode,
        categoryCode,
        rawCategory: category,
        wholesaleRateRubKopecks: pricing.wholesaleRateRubKopecks,
        wholesaleRatePer1000Rub: pricing.wholesaleRatePer1000Rub,
        retailBenchmarkPer1000Rub: pricing.retailBenchmarkPer1000Rub,
        potentialMarginPercent: pricing.potentialMarginPercent,
        min: Number.isFinite(minVal) ? minVal : 1,
        max: Number.isFinite(maxVal) ? maxVal : 100000,
        refill: isRefill,
        cancel: isCancel,
        dripfeed: isDripfeed,
      };
    });
  }

  /**
   * Safely probes live SMM API v2 endpoint for services catalog
   */
  public static async probeLiveServices(
    apiUrl: string,
    apiKey: string,
    timeoutMs = 12000
  ): Promise<RawProviderService[]> {
    await assertSafeUrl(apiUrl);

    const params = new URLSearchParams();
    params.append('key', apiKey);
    params.append('action', 'services');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'OmniSMM-DirectScanner/2.0',
        },
        body: params.toString(),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`PROVIDER_HTTP_ERROR_${response.status}: ${response.statusText}`);
      }

      const json = await response.json();
      const parsed = RawProviderServicesListSchema.safeParse(json);
      if (!parsed.success) {
        throw new Error(`INVALID_PROVIDER_CATALOG_SCHEMA: ${parsed.error.message}`);
      }

      return parsed.data;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Ingests catalog into Redis Shadow Catalog buffer with SHA-256 deduplication
   */
  public static async bufferShadowCatalog(
    providerId: string,
    rawServices: RawProviderService[],
    forceRefresh = false
  ): Promise<{ catalogHash: string; cached: boolean }> {
    const rawJson = JSON.stringify(rawServices);
    const catalogHash = crypto.createHash('sha256').update(rawJson).digest('hex');

    const cacheKey = `provider:${providerId}:catalog`;
    const hashKey = `provider:${providerId}:catalog:hash`;

    // Fast return if redis client is not connected
    if (redis && 'status' in redis && (redis as unknown as { status?: string }).status !== 'ready') {
      return { catalogHash, cached: false };
    }

    try {
      if (!forceRefresh) {
        const existingHash = await redis.get(hashKey);
        if (existingHash === catalogHash) {
          return { catalogHash, cached: true };
        }
      }

      await redis.set(cacheKey, rawJson, 'EX', 86400); // 24h
      await redis.set(hashKey, catalogHash, 'EX', 86400);
      return { catalogHash, cached: false };
    } catch (err) {
      console.warn(`[DirectProviderScanner] Redis buffer write warning for ${providerId}:`, err);
      return { catalogHash, cached: false };
    }
  }

  /**
   * Generates comprehensive scan report for a provider profile
   */
  public static async generateReportForProfile(
    profile: DirectProviderProfile,
    customRawServices?: RawProviderService[]
  ): Promise<ProviderScanReport> {
    const rawServices: RawProviderService[] =
      customRawServices ??
      profile.benchmarkServices.map((bs) => ({
        service: bs.service,
        name: bs.name,
        category: bs.category,
        rate: bs.rate,
        min: bs.min,
        max: bs.max,
        type: 'Default',
      }));

    const normalized = this.normalizeServices(rawServices, profile.currency);

    const networkBreakdown: Record<string, number> = {};
    for (const item of normalized) {
      networkBreakdown[item.networkCode] = (networkBreakdown[item.networkCode] || 0) + 1;
    }

    const sortedByMargin = [...normalized].sort(
      (a, b) => b.potentialMarginPercent - a.potentialMarginPercent
    );

    const shadowResult = await this.bufferShadowCatalog(profile.id, rawServices);

    return {
      providerId: profile.id,
      providerName: profile.name,
      apiUrl: profile.apiUrl,
      currency: profile.currency,
      totalServices: normalized.length,
      scannedAt: new Date().toISOString(),
      networkBreakdown,
      topMarginServices: sortedByMargin.slice(0, 5),
      catalogHash: shadowResult.catalogHash,
      cachedInRedis: shadowResult.cached,
    };
  }
}
