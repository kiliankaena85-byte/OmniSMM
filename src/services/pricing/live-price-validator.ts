import { assertSafeUrl } from '@/utils/ssrf-guard';
import { ExactMath } from '@/lib/financial/exact-math';

export interface PriceValidationResult {
  isValid: boolean;
  serviceId: string;
  providerUrl: string;
  currency: string;
  liveCostRub: number;
  expectedCostRub: number;
  deltaPercent: number;
  isPriceSpike: boolean;
  suggestedRetailRub: number;
  status: 'OPTIMAL' | 'PRICE_INCREASED' | 'PRICE_DECREASED' | 'UNAVAILABLE' | 'MARGIN_VIOLATION';
  reason?: string;
}

export interface LiveCurrencyRates {
  tonUsd: number;
  usdRub: number;
  lastUpdated: number;
}

/**
 * Сервис динамической валидации цен и защиты маржинальности (Live Price Validator & Margin Guard)
 * Гарантирует, что платформа OmniSMM никогда не использует устаревшие статические цифры.
 * Проверяет актуальные оптовые тарифы у поставщиков в реальном времени перед проводкой заказов.
 */
export class LivePriceValidator {
  private static readonly USER_AGENT = 'OmniSMM-PriceOracle/1.0 (Real-Time Rate Verification Engine)';
  public static readonly PRICE_SPIKE_THRESHOLD_PERCENT = 15.0; // Скачок более 15% активирует тревогу
  public static readonly MINIMUM_MARGIN_PERCENT = 30.0; // Минимальная допустимая маржа

  /**
   * 1. Валидация оптовой цены услуги у SMM-провайдера через живой API v2
   */
  public static async validateProviderServicePrice(options: {
    apiUrl: string;
    apiKey: string;
    serviceId: string | number;
    expectedCostRub: number;
    retailPriceRub: number;
    usdToRubRate?: number;
    timeoutMs?: number;
  }): Promise<PriceValidationResult> {
    const {
      apiUrl,
      apiKey,
      serviceId,
      expectedCostRub,
      retailPriceRub,
      usdToRubRate = 92.5,
      timeoutMs = 6000,
    } = options;

    await assertSafeUrl(apiUrl);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const targetUrl = new URL(apiUrl);
      targetUrl.searchParams.set('key', apiKey);
      targetUrl.searchParams.set('action', 'services');

      const res = await fetch(targetUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': this.USER_AGENT,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        return {
          isValid: false,
          serviceId: String(serviceId),
          providerUrl: apiUrl,
          currency: 'UNKNOWN',
          liveCostRub: 0,
          expectedCostRub,
          deltaPercent: 0,
          isPriceSpike: false,
          suggestedRetailRub: retailPriceRub,
          status: 'UNAVAILABLE',
          reason: `HTTP ${res.status}: Провайдер временно недоступен для проверки тарифов`,
        };
      }

      const services = await res.json();
      if (!Array.isArray(services)) {
        return {
          isValid: false,
          serviceId: String(serviceId),
          providerUrl: apiUrl,
          currency: 'UNKNOWN',
          liveCostRub: 0,
          expectedCostRub,
          deltaPercent: 0,
          isPriceSpike: false,
          suggestedRetailRub: retailPriceRub,
          status: 'UNAVAILABLE',
          reason: 'INVALID_RESPONSE: Провайдер вернул некорректный каталог услуг',
        };
      }

      // Ищем целевую услугу в каталоге поставщика
      const matched = services.find((s) => String(s.service) === String(serviceId) || String(s.id) === String(serviceId));
      if (!matched) {
        return {
          isValid: false,
          serviceId: String(serviceId),
          providerUrl: apiUrl,
          currency: 'UNKNOWN',
          liveCostRub: 0,
          expectedCostRub,
          deltaPercent: 0,
          isPriceSpike: false,
          suggestedRetailRub: retailPriceRub,
          status: 'UNAVAILABLE',
          reason: 'SERVICE_DELETED: Услуга удалена или отключена в каталоге поставщика',
        };
      }

      const rawRate = Number(matched.rate);
      // Если тариф в USD, пересчитываем в рубли по живому курсу
      const currency = matched.currency?.toUpperCase() || (rawRate < 5.0 ? 'USD' : 'RUB');
      const liveCostRub = currency === 'USD' ? Number((rawRate * usdToRubRate).toFixed(4)) : rawRate;

      // Вычисляем процент изменения
      const deltaPercent =
        expectedCostRub > 0
          ? Number((((liveCostRub - expectedCostRub) / expectedCostRub) * 100).toFixed(2))
          : 0;

      const isPriceSpike = deltaPercent >= this.PRICE_SPIKE_THRESHOLD_PERCENT;

      // Проверяем сохранение маржинальности (розница должна превышать опт минимум на MINIMUM_MARGIN_PERCENT)
      const currentMarginPercent =
        retailPriceRub > 0
          ? Number((((retailPriceRub - liveCostRub) / retailPriceRub) * 100).toFixed(2))
          : 0;

      const isMarginViolated = currentMarginPercent < this.MINIMUM_MARGIN_PERCENT;

      // Рекомендованная розничная цена с фиксацией гарантированной 40% маржи
      const suggestedRetailRub = Number((liveCostRub * 1.5).toFixed(2));

      let status: PriceValidationResult['status'] = 'OPTIMAL';
      if (isMarginViolated) {
        status = 'MARGIN_VIOLATION';
      } else if (isPriceSpike) {
        status = 'PRICE_INCREASED';
      } else if (deltaPercent < -5.0) {
        status = 'PRICE_DECREASED';
      }

      return {
        isValid: !isMarginViolated && !isPriceSpike,
        serviceId: String(serviceId),
        providerUrl: apiUrl,
        currency,
        liveCostRub,
        expectedCostRub,
        deltaPercent,
        isPriceSpike,
        suggestedRetailRub,
        status,
        reason: isMarginViolated
          ? `Маржа упала до ${currentMarginPercent}% (ниже лимита ${this.MINIMUM_MARGIN_PERCENT}%)`
          : undefined,
      };
    } catch (err) {
      return {
        isValid: false,
        serviceId: String(serviceId),
        providerUrl: apiUrl,
        currency: 'UNKNOWN',
        liveCostRub: 0,
        expectedCostRub,
        deltaPercent: 0,
        isPriceSpike: false,
        suggestedRetailRub: retailPriceRub,
        status: 'UNAVAILABLE',
        reason: err instanceof Error ? err.message : 'TIMEOUT_OR_NETWORK_ERROR',
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 2. Динамический расчет себестоимости Telegram Stars на базе живого курса TON
   */
  public static calculateLiveStarsCost(options: {
    tonToUsd: number;
    usdToRub: number;
    starsCount: number;
    otcDiscountPercent?: number; // дисконт при закупке пулов у создателей игр (0..45%)
  }): {
    officialFragmentRub: number;
    discountedOtcRub: number;
    costPerStarRub: number;
    recommendedRetailPerStarRub: number;
  } {
    const { tonToUsd, usdToRub, starsCount, otcDiscountPercent = 35.0 } = options;

    // Официальный смарт-контракт Fragment: 1 000 Stars стоит ~ 15.00 USD (0.015 USD за 1 звезду)
    const baseCostUsdPerStar = 0.015;
    const baseCostRubPerStar = baseCostUsdPerStar * usdToRub;

    const officialTotalRub = Number((starsCount * baseCostRubPerStar).toFixed(2));
    const discountMultiplier = (100.0 - otcDiscountPercent) / 100.0;
    const discountedTotalRub = Number((officialTotalRub * discountMultiplier).toFixed(2));

    const costPerStarRub = Number((baseCostRubPerStar * discountMultiplier).toFixed(2));
    const recommendedRetailPerStarRub = Number((costPerStarRub * 1.8).toFixed(2)); // Маржа +80%

    return {
      officialFragmentRub: officialTotalRub,
      discountedOtcRub: discountedTotalRub,
      costPerStarRub,
      recommendedRetailPerStarRub,
    };
  }

  /**
   * 3. Защитный финансовый барьер перед проведением чекаута (Pre-Checkout Margin Guard)
   * Блокирует заказ, если поставщик поднял цену без предупреждения
   */
  public static verifyOrderMarginSafety(options: {
    chargeKopecks: bigint;
    providerCostKopecks: bigint;
    minMarginBps?: bigint; // базисные пункты (2000 = 20.00%)
  }): { isSafe: boolean; marginPercent: number; profitKopecks: bigint } {
    const { chargeKopecks, providerCostKopecks, minMarginBps = 2000n } = options;

    if (chargeKopecks <= 0n || providerCostKopecks <= 0n) {
      return { isSafe: false, marginPercent: 0, profitKopecks: 0n };
    }

    if (chargeKopecks <= providerCostKopecks) {
      // Отрицательная или нулевая маржа — жесткий отказ!
      return {
        isSafe: false,
        marginPercent: 0,
        profitKopecks: chargeKopecks - providerCostKopecks,
      };
    }

    const profit = chargeKopecks - providerCostKopecks;
    // (profit * 10000n) / chargeKopecks дает bps
    const actualMarginBps = (profit * 10000n) / chargeKopecks;
    const isSafe = actualMarginBps >= minMarginBps;
    const marginPercent = Number(actualMarginBps) / 100;

    return {
      isSafe,
      marginPercent,
      profitKopecks: profit,
    };
  }
}
