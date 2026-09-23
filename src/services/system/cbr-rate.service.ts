import { SettingsManager } from "@/lib/settings";

export interface LiveCrossRates {
  usdToRub: number;
  eurToUsd: number;
  uahToUsd: number;
  kztToUsd: number;
  updatedAt: Date;
}

/**
 * Service for fetching and syncing exchange rates from the Central Bank of Russia (CBR).
 */
export class CBRRateService {
  private static readonly CBR_OFFICIAL_XML_URL = "https://www.cbr.ru/scripts/XML_daily.asp";
  private static readonly CBR_JSON_MIRROR_URL = "https://www.cbr-xml-daily.ru/daily_json.js";
  private static readonly GLOBAL_FX_API_URL = "https://open.er-api.com/v6/latest/USD";
  private static readonly SPREAD_MULTIPLIER = 1.03; // +3% Margin Safety Net (PB-003)

  /**
   * Fetches raw currency rates from CBR with multi-tiered fallback.
   */
  private static async fetchRawRates(): Promise<{
    usdRate: number;
    eurRate: number | null;
    uahRate: number | null;
    kztRate: number | null;
    source: string;
  }> {
    const parseVal = (str: string) => parseFloat(str.replace(',', '.'));

    // Tier 1: Official CBR XML API
    try {
      const response = await fetch(this.CBR_OFFICIAL_XML_URL, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) OmniSMM/1.0' },
        signal: AbortSignal.timeout(6000),
        next: { revalidate: 3600 }
      });
      if (response.ok) {
        const text = await response.text();
        const usdMatch = text.match(/<Valute ID="R01235">[\s\S]*?<Value>([\d,]+)<\/Value>/);
        const eurMatch = text.match(/<Valute ID="R01239">[\s\S]*?<Value>([\d,]+)<\/Value>/);
        const uahMatch = text.match(/<Valute ID="R01720">[\s\S]*?<Nominal>(\d+)<\/Nominal>[\s\S]*?<Value>([\d,]+)<\/Value>/);
        const kztMatch = text.match(/<Valute ID="R01335">[\s\S]*?<Nominal>(\d+)<\/Nominal>[\s\S]*?<Value>([\d,]+)<\/Value>/);

        const usd = usdMatch ? parseVal(usdMatch[1]) : null;
        if (usd && !isNaN(usd) && usd > 0) {
          const eur = eurMatch ? parseVal(eurMatch[1]) : null;
          const uah = uahMatch ? parseVal(uahMatch[2]) / parseInt(uahMatch[1], 10) : null;
          const kzt = kztMatch ? parseVal(kztMatch[2]) / parseInt(kztMatch[1], 10) : null;
          return { usdRate: usd, eurRate: eur, uahRate: uah, kztRate: kzt, source: 'CBR_OFFICIAL_XML' };
        }
      }
    } catch (err: unknown) {
      console.warn("[CBRRateService] Tier 1 (CBR Official XML) fetch error:", (err instanceof Error ? err.message : String(err)));
    }

    // Tier 2: CBR JSON Mirror
    try {
      const response = await fetch(this.CBR_JSON_MIRROR_URL, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) OmniSMM/1.0' },
        signal: AbortSignal.timeout(6000),
        next: { revalidate: 3600 }
      });
      if (response.ok) {
        const data = await response.json();
        const usd = data?.Valute?.USD?.Value;
        if (typeof usd === 'number' && !isNaN(usd) && usd > 0) {
          const eur = data?.Valute?.EUR?.Value ?? null;
          const uahNominal = data?.Valute?.UAH?.Nominal || 10;
          const uahVal = data?.Valute?.UAH?.Value;
          const uah = uahVal ? uahVal / uahNominal : null;
          const kztNominal = data?.Valute?.KZT?.Nominal || 100;
          const kztVal = data?.Valute?.KZT?.Value;
          const kzt = kztVal ? kztVal / kztNominal : null;
          return { usdRate: usd, eurRate: eur, uahRate: uah, kztRate: kzt, source: 'CBR_JSON_MIRROR' };
        }
      }
    } catch (err: unknown) {
      console.warn("[CBRRateService] Tier 2 (CBR JSON Mirror) fetch error:", (err instanceof Error ? err.message : String(err)));
    }

    // Tier 3: Global FX API Fallback
    try {
      const response = await fetch(this.GLOBAL_FX_API_URL, {
        signal: AbortSignal.timeout(6000),
        next: { revalidate: 3600 }
      });
      if (response.ok) {
        const data = await response.json();
        const rub = data?.rates?.RUB;
        if (typeof rub === 'number' && !isNaN(rub) && rub > 0) {
          const eur = data?.rates?.EUR ? 1 / data.rates.EUR : null;
          const uah = data?.rates?.UAH ? rub / data.rates.UAH : null;
          const kzt = data?.rates?.KZT ? rub / data.rates.KZT : null;
          return { usdRate: rub, eurRate: eur, uahRate: uah, kztRate: kzt, source: 'GLOBAL_FX_API' };
        }
      }
    } catch (err: unknown) {
      console.warn("[CBRRateService] Tier 3 (Global FX API) fetch error:", (err instanceof Error ? err.message : String(err)));
    }

    throw new Error('All exchange rate providers (CBR Official, Mirror, Global FX) are unreachable');
  }

  /**
   * Fetches the latest USD, EUR, UAH, KZT exchange rates from CBR, applies a 3% safety spread, 
   * and updates SystemSettings & Redis FX cache. If network fails, leaves the old rate.
   * 
   * @returns The combined payload: nominal rate, system rate (with spread), and update status.
   */
  static async syncCBRExchangeRate(tenantId?: string): Promise<{
    nominalRate: number;
    systemRate: number;
    crossRates: LiveCrossRates;
    updated: boolean;
    source?: string;
  }> {
    try {
      let usdRate: number | null = null;
      let eurRate: number | null = null;
      let uahRate: number | null = null;
      let kztRate: number | null = null;
      let source = 'CBR_OFFICIAL_XML';

      try {
        const fetched = await this.fetchRawRates();
        usdRate = fetched.usdRate;
        eurRate = fetched.eurRate;
        uahRate = fetched.uahRate;
        kztRate = fetched.kztRate;
        source = fetched.source;
      } catch (err: unknown) {
        console.warn("[CBRRateService] Rate fetch error:", (err instanceof Error ? err.message : String(err)));
      }

      if (typeof usdRate !== 'number' || isNaN(usdRate) || usdRate <= 0) {
        // Fallback to existing settings on failure
        const existingRate = await SettingsManager.getExchangeRateUSD(tenantId);
        const fallbackCrossRates: LiveCrossRates = {
          usdToRub: existingRate || 95.0,
          eurToUsd: 1.08,
          uahToUsd: 0.027,
          kztToUsd: 0.0023,
          updatedAt: new Date()
        };
        return { nominalRate: existingRate, systemRate: existingRate, crossRates: fallbackCrossRates, updated: false };
      }

      // [PB-003] Apply 3% spread to protect CFO margins during RUB volatility
      const systemRate = parseFloat((usdRate * this.SPREAD_MULTIPLIER).toFixed(2));

      // Calculate USD-relative cross rates
      const eurToUsd = (eurRate && usdRate) ? parseFloat((eurRate / usdRate).toFixed(4)) : 1.08;
      const uahToUsd = (uahRate && usdRate) ? parseFloat((uahRate / usdRate).toFixed(6)) : 0.027;
      const kztToUsd = (kztRate && usdRate) ? parseFloat((kztRate / usdRate).toFixed(7)) : 0.0023;

      const crossRates: LiveCrossRates = {
        usdToRub: systemRate,
        eurToUsd,
        uahToUsd,
        kztToUsd,
        updatedAt: new Date()
      };

      // Cache cross-rates in Redis if available
      try {
        const { redis } = await import('@/lib/redis');
        await redis.set('fx:cross_rates', JSON.stringify(crossRates), 'EX', 86400);
      } catch {
        // Non-blocking cache update
      }

      // Update in DB with the spread-adjusted system rate
      await SettingsManager.setExchangeRateUSD(systemRate, tenantId);

      return { nominalRate: usdRate, systemRate, crossRates, updated: true };
    } catch (error: unknown) {
      console.error("[CBRRateService] CBR sync failed:", (error instanceof Error ? error.message : String(error)));
      const existingRate = await SettingsManager.getExchangeRateUSD(tenantId);
      const fallbackCrossRates: LiveCrossRates = {
        usdToRub: existingRate || 95.0,
        eurToUsd: 1.08,
        uahToUsd: 0.027,
        kztToUsd: 0.0023,
        updatedAt: new Date()
      };
      return { nominalRate: existingRate, systemRate: existingRate, crossRates: fallbackCrossRates, updated: false };
    }
  }

  /**
   * Retrieves cached live cross rates or falls back to system settings defaults.
   */
  static async getLiveCrossRates(tenantId?: string): Promise<LiveCrossRates> {
    try {
      const { redis } = await import('@/lib/redis');
      const cached = await redis.get('fx:cross_rates');
      if (cached) {
        const parsed = JSON.parse(cached);
        parsed.updatedAt = new Date(parsed.updatedAt);
        return parsed;
      }
    } catch {
      // Non-blocking redis read
    }

    let usdRate: number | null = null;
    try {
      usdRate = await SettingsManager.getExchangeRateUSD(tenantId);
    } catch (err) {
      console.warn('[CBRRateService] Failed to read USD exchange rate from settings:', err instanceof Error ? err.message : String(err));
    }

    const safeUsdRate = (usdRate && Number.isFinite(usdRate) && usdRate > 0) ? usdRate : 95.0;

    return {
      usdToRub: safeUsdRate,
      eurToUsd: 1.08,
      uahToUsd: 0.027,
      kztToUsd: 0.0023,
      updatedAt: new Date()
    };
  }
}

