/**
 * Provider Currency & Intelligent Pricing Engine (DPC-Engine)
 * Architecture: SIL-2026 / AAA-2026 Standards
 * 
 * Provides:
 * 1. Direct probe currency mismatch detection.
 * 2. Statistical shift detection across raw catalog batches (USD <-> RUB shifts).
 * 3. Dynamic price evaluation with negative margin protection.
 * 4. Automatic provider & service healing without false quarantine.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { auditAdmin } from '@/lib/admin-audit';
import {
  UPPER_SANITY_LIMIT_RUB,
  ANOMALY_PRICE_SPIKE_THRESHOLD,
  applyBeautifulRounding
} from '@/lib/financial-constants';

export interface ExistingServicePricingData {
  id: string;
  externalId: string;
  rate: number;
  providerCurrency: string;
  costPer1kRub: number | null;
  markup: number;
  pricePer1000Cents: number;
}

export interface StagingServicePricingData {
  externalId: string;
  rate: number;
}

export interface CurrencyShiftDetectionResult {
  isShiftDetected: boolean;
  detectedCurrency: 'USD' | 'RUB' | null;
  previousCurrency: string;
  confidence: number;
  reason: string;
  affectedServiceCount: number;
}

export interface ServicePriceEvaluation {
  action: 'UPDATE_SILENT' | 'QUARANTINE_PRICE_SPIKE' | 'QUARANTINE_SANITY_LIMIT' | 'KEEP_UNCHANGED';
  oldRate: number;
  newRate: number;
  oldCostRub: number;
  newCostRub: number;
  newRetailPriceCents: number;
  rawRateChangePct: number;
  rubCostChangePct: number;
  quarantineReason?: string;
}

export class ProviderCurrencyEngine {
  public static readonly MIN_SERVICES_FOR_BATCH_CHECK = 3;
  public static readonly SHIFT_CONFIDENCE_THRESHOLD = 0.70; // 70%

  /**
   * 1. Direct Probe Currency Detection
   * Evaluates whether the provider explicitly reported a different currency in /balance
   */
  public static detectShiftFromProbe(
    storedCurrency: string,
    probeCurrency?: string | null
  ): CurrencyShiftDetectionResult {
    const normStored = (storedCurrency || 'USD').toUpperCase().trim();
    if (!probeCurrency || typeof probeCurrency !== 'string') {
      return {
        isShiftDetected: false,
        detectedCurrency: null,
        previousCurrency: normStored,
        confidence: 0,
        reason: 'Probe currency not provided',
        affectedServiceCount: 0
      };
    }

    const normProbe = probeCurrency.toUpperCase().trim();
    if (normProbe === normStored) {
      return {
        isShiftDetected: false,
        detectedCurrency: null,
        previousCurrency: normStored,
        confidence: 1.0,
        reason: 'Probe currency matches stored currency',
        affectedServiceCount: 0
      };
    }

    if (normProbe === 'RUB' || normProbe === 'USD') {
      return {
        isShiftDetected: true,
        detectedCurrency: normProbe,
        previousCurrency: normStored,
        confidence: 1.0,
        reason: `Provider /balance explicitly returned ${normProbe}, while database stored ${normStored}`,
        affectedServiceCount: 0
      };
    }

    return {
      isShiftDetected: false,
      detectedCurrency: null,
      previousCurrency: normStored,
      confidence: 0,
      reason: `Unsupported probe currency: ${probeCurrency}`,
      affectedServiceCount: 0
    };
  }

  /**
   * 2. Statistical Shift Detection across Catalog (Batch Heuristic)
   * Detects if the provider flipped their account currency (USD <-> RUB) by comparing
   * new rates with existing rates across all active services.
   */
  public static detectShiftFromCatalog(
    storedCurrency: string,
    currentServices: ExistingServicePricingData[],
    incomingStaging: StagingServicePricingData[],
    usdRate: number
  ): CurrencyShiftDetectionResult {
    const normStored = (storedCurrency || 'USD').toUpperCase().trim();
    const stagingMap = new Map(incomingStaging.map(s => [String(s.externalId), s.rate]));

    const pairs: Array<{ oldRate: number; newRate: number; ratio: number }> = [];

    for (const cur of currentServices) {
      if (!cur.externalId || cur.rate <= 0) continue;
      const newRate = stagingMap.get(String(cur.externalId));
      if (newRate !== undefined && newRate > 0) {
        pairs.push({
          oldRate: cur.rate,
          newRate,
          ratio: newRate / cur.rate
        });
      }
    }

    if (pairs.length < this.MIN_SERVICES_FOR_BATCH_CHECK) {
      return {
        isShiftDetected: false,
        detectedCurrency: null,
        previousCurrency: normStored,
        confidence: 0,
        reason: `Insufficient overlapping services for statistical detection (${pairs.length} < ${this.MIN_SERVICES_FOR_BATCH_CHECK})`,
        affectedServiceCount: 0
      };
    }

    // Check USD -> RUB: rates should multiply by ~usdRate
    // e.g. for usdRate = 90, ratio between 0.65 * 90 (58.5) and 1.35 * 90 (121.5)
    const usdToRubMin = 0.65 * usdRate;
    const usdToRubMax = 1.35 * usdRate;
    const usdToRubMatches = pairs.filter(p => p.ratio >= usdToRubMin && p.ratio <= usdToRubMax).length;
    const usdToRubShare = usdToRubMatches / pairs.length;

    if (usdToRubShare >= this.SHIFT_CONFIDENCE_THRESHOLD) {
      return {
        isShiftDetected: true,
        detectedCurrency: 'RUB',
        previousCurrency: normStored,
        confidence: Math.round(usdToRubShare * 100) / 100,
        reason: `Statistical shift detected: ${usdToRubMatches}/${pairs.length} (${Math.round(usdToRubShare * 100)}%) rates shifted by ~${usdRate.toFixed(1)}x factor (USD -> RUB switch)`,
        affectedServiceCount: usdToRubMatches
      };
    }

    // Check RUB -> USD: rates should divide by ~usdRate (multiply by ~1/usdRate)
    // e.g. for usdRate = 90, ratio between 0.65 / 90 (0.0072) and 1.35 / 90 (0.015)
    const rubToUsdMin = 0.65 / usdRate;
    const rubToUsdMax = 1.35 / usdRate;
    const rubToUsdMatches = pairs.filter(p => p.ratio >= rubToUsdMin && p.ratio <= rubToUsdMax).length;
    const rubToUsdShare = rubToUsdMatches / pairs.length;

    if (rubToUsdShare >= this.SHIFT_CONFIDENCE_THRESHOLD) {
      return {
        isShiftDetected: true,
        detectedCurrency: 'USD',
        previousCurrency: normStored,
        confidence: Math.round(rubToUsdShare * 100) / 100,
        reason: `Statistical shift detected: ${rubToUsdMatches}/${pairs.length} (${Math.round(rubToUsdShare * 100)}%) rates dropped by ~${usdRate.toFixed(1)}x factor (RUB -> USD switch)`,
        affectedServiceCount: rubToUsdMatches
      };
    }

    return {
      isShiftDetected: false,
      detectedCurrency: null,
      previousCurrency: normStored,
      confidence: 0,
      reason: 'No uniform multi-service currency shift detected',
      affectedServiceCount: 0
    };
  }

  /**
   * 3. Intelligent Dynamic Price & Quarantine Evaluator
   * Isolates genuine provider spikes from harmless exchange rate movements.
   */
  public static evaluateServicePriceChange(
    service: ExistingServicePricingData,
    newRawRate: number,
    providerCurrency: string,
    usdRate: number,
    options?: { isResurrection?: boolean; quarantineThreshold?: number }
  ): ServicePriceEvaluation {
    const normProviderCurr = (providerCurrency || 'USD').toUpperCase().trim();
    const normServiceCurr = (service.providerCurrency || normProviderCurr).toUpperCase().trim();

    // 1. Calculate Old Normalized RUB Cost
    let oldCostRub = service.costPer1kRub ?? 0;
    if (oldCostRub <= 0) {
      oldCostRub = normServiceCurr === 'RUB' ? service.rate : service.rate * usdRate;
    }

    // 2. Calculate New Normalized RUB Cost
    const newCostRub = normProviderCurr === 'RUB' ? newRawRate : newRawRate * usdRate;

    // 3. Calculate Rate Change in Provider's Current Native Currency
    let realOldRateInCurrentCurr: number;
    if (normServiceCurr === normProviderCurr) {
      realOldRateInCurrentCurr = service.rate;
    } else if (normProviderCurr === 'RUB') {
      // service was stored in USD, but current currency is RUB
      realOldRateInCurrentCurr = service.rate * usdRate;
    } else {
      // service was stored in RUB, but current currency is USD
      realOldRateInCurrentCurr = service.rate / usdRate;
    }

    let rawRateChangePct = realOldRateInCurrentCurr > 0
      ? (newRawRate - realOldRateInCurrentCurr) / realOldRateInCurrentCurr
      : 0;

    let rubCostChangePct = oldCostRub > 0
      ? (newCostRub - oldCostRub) / oldCostRub
      : 0;

    if (Math.abs(rawRateChangePct) < 1e-6) rawRateChangePct = 0;
    if (Math.abs(rubCostChangePct) < 1e-6) rubCostChangePct = 0;

    // Check 1: Upper Sanity Limit Breach (> 100,000 ₽ / 1k)
    if (newCostRub > UPPER_SANITY_LIMIT_RUB) {
      return {
        action: 'QUARANTINE_SANITY_LIMIT',
        oldRate: service.rate,
        newRate: newRawRate,
        oldCostRub,
        newCostRub,
        newRetailPriceCents: service.pricePer1000Cents,
        rawRateChangePct,
        rubCostChangePct,
        quarantineReason: `Upper Sanity Limit Exceeded: себестоимость ${newCostRub.toFixed(2)} ₽/1k превышает лимит ${UPPER_SANITY_LIMIT_RUB.toLocaleString('ru-RU')} ₽ (${newRawRate} ${normProviderCurr})`
      };
    }

    // Check 2: Genuine Provider Price Spike (>= threshold in provider's native currency)
    const spikeThreshold = options?.quarantineThreshold ?? ANOMALY_PRICE_SPIKE_THRESHOLD;
    if (rawRateChangePct >= spikeThreshold) {
      const spikePct = Math.round(rawRateChangePct * 100);
      const prefix = options?.isResurrection ? 'Price Spike on Resurrection' : 'Price Spike';
      return {
        action: 'QUARANTINE_PRICE_SPIKE',
        oldRate: service.rate,
        newRate: newRawRate,
        oldCostRub,
        newCostRub,
        newRetailPriceCents: service.pricePer1000Cents,
        rawRateChangePct,
        rubCostChangePct,
        quarantineReason: `${prefix} (+${spikePct}%): себестоимость выросла с ${oldCostRub.toFixed(2)} ₽ до ${newCostRub.toFixed(2)} ₽/1k (${realOldRateInCurrentCurr} ${normProviderCurr} → ${newRawRate} ${normProviderCurr})`
      };
    }

    // Check 3: Dynamic Price Calculation with Margin Protection
    const calculatedRetailRub = applyBeautifulRounding(newCostRub * service.markup);
    let newRetailPriceCents = Math.round(calculatedRetailRub * 100);

    // Negative Margin Floor Guard: retail price must never be below cost
    const minSafeRetailCents = Math.round(newCostRub * 1.10 * 100);
    if (newRetailPriceCents < minSafeRetailCents) {
      newRetailPriceCents = minSafeRetailCents;
    }

    return {
      action: 'UPDATE_SILENT',
      oldRate: service.rate,
      newRate: newRawRate,
      oldCostRub,
      newCostRub,
      newRetailPriceCents,
      rawRateChangePct,
      rubCostChangePct
    };
  }

  /**
   * 4. Auto-Heal Provider Services
   * Atomically updates provider currency and reconciles all service currencies & cost snapshots.
   * Can also heal individual mismatched services when provider currency is already set.
   */
  public static async autoHealProviderServices(
    providerId: string,
    newCurrency: 'USD' | 'RUB',
    usdRate: number,
    admin?: { id: string; email: string },
    options?: { forceReconcileAll?: boolean }
  ): Promise<{ updatedCount: number; previousCurrency: string }> {
    const provider = await db.provider.findUnique({
      where: { id: providerId },
      select: { id: true, name: true, balanceCurrency: true }
    });

    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    const previousCurrency = provider.balanceCurrency || 'USD';
    const isProviderCurrencyChanging = previousCurrency !== newCurrency;

    if (isProviderCurrencyChanging) {
      // 1. Update Provider balanceCurrency
      await db.provider.update({
        where: { id: providerId },
        data: { balanceCurrency: newCurrency }
      });
    }

    // 2. Fetch services for this provider that need healing:
    // If provider currency changed or forceReconcileAll: heal all services for this provider.
    // If provider currency is already newCurrency: heal services whose providerCurrency is mismatched.
    const services = await db.service.findMany({
      where: {
        providerId,
        ...(isProviderCurrencyChanging || options?.forceReconcileAll
          ? {}
          : {
              OR: [
                { providerCurrency: { not: newCurrency } },
                { costPer1kRub: null },
                { isQuarantined: true, quarantineReason: { contains: 'Anomaly' } },
                { isQuarantined: true, quarantineReason: { contains: 'Currency' } },
                { isQuarantined: true, quarantineReason: { contains: 'Shift' } }
              ]
            })
      },
      select: { id: true, rate: true, markup: true, providerCurrency: true }
    });

    if (services.length === 0 && !isProviderCurrencyChanging) {
      return { updatedCount: 0, previousCurrency };
    }

    logger.info('[ProviderCurrencyEngine] Healing provider services', {
      providerId,
      providerName: provider.name,
      previousCurrency,
      newCurrency,
      serviceCountToHeal: services.length,
      usdRate
    });

    // 3. Batch update services
    const CHUNK_SIZE = 100;
    let updatedCount = 0;

    for (let i = 0; i < services.length; i += CHUNK_SIZE) {
      const chunk = services.slice(i, i + CHUNK_SIZE);
      await db.$transaction(async (tx) => {
        for (const svc of chunk) {
          const costPer1kRub = newCurrency === 'RUB' ? svc.rate : svc.rate * usdRate;

          // Upper Sanity Limit Guard (> 50,000 ₽ / 1k)
          if (costPer1kRub > UPPER_SANITY_LIMIT_RUB) {
            await tx.service.update({
              where: { id: svc.id },
              data: {
                providerCurrency: newCurrency,
                costPer1kRub,
                currencyCapturedAt: new Date(),
                usdRateAtCapture: usdRate,
                isActive: false,
                isQuarantined: true,
                quarantineReason: `[UPPER_SANITY_LIMIT] Cost per 1k (${costPer1kRub.toFixed(2)} ₽) exceeds sanity limit (${UPPER_SANITY_LIMIT_RUB} ₽)`
              }
            });
            continue;
          }

          const markup = svc.markup && svc.markup > 0 ? svc.markup : 3.0;
          const retailRub = applyBeautifulRounding(costPer1kRub * markup);
          // Hard clamp to prevent PostgreSQL INT4 (32-bit signed) overflow (max 2,147,483,647)
          const pricePer1000Cents = Math.min(Math.round(retailRub * 100), 2_000_000_000);

          await tx.service.update({
            where: { id: svc.id },
            data: {
              providerCurrency: newCurrency,
              costPer1kRub,
              currencyCapturedAt: new Date(),
              usdRateAtCapture: usdRate,
              pricePer1000Cents,
              isQuarantined: false,
              quarantineReason: null
            }
          });
        }
      });
      updatedCount += chunk.length;
    }

    if (admin) {
      auditAdmin({
        adminId: admin.id,
        adminEmail: admin.email,
        action: 'PROVIDER_CURRENCY_SHIFT_HEALED',
        target: providerId,
        targetType: 'PROVIDER',
        newValue: {
          previousCurrency,
          newCurrency,
          updatedServicesCount: updatedCount,
          usdRate
        }
      });
    }

    return { updatedCount, previousCurrency };
  }
}
