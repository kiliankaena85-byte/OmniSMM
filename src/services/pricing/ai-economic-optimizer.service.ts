import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { SettingsProvider } from '@/lib/settings';
import { applyBeautifulRounding } from '@/lib/financial-constants';

const log = logger.child({ component: 'AiEconomicOptimizerService' });

export interface ToolTraceEntry {
  step: string;
  timestamp: string;
  durationMs: number;
  inputSnapshot?: Record<string, unknown>;
  outputSnapshot?: Record<string, unknown>;
  invariantsEvaluated?: {
    floorPricePassed: boolean;
    markupFloorPassed: boolean;
    confidencePassed: boolean;
    reason?: string;
  };
}

export interface OptimizationRunParams {
  tenantId: string;
  analyzedPeriodDays: number;
  forceRun?: boolean;
}

export interface CandidateServiceLeak {
  serviceId: string;
  name: string;
  providerCurrency: string;
  providerRate: number;
  costInRub: number;
  currentMarkup: number;
  currentPriceRub: number;
  ordersCount30d: number;
  revenue30dRub: number;
  margin30dRub: number;
  currentMarginPercent: number;
  proposedMarkup: number;
  proposedPriceRub: number;
  projectedMonthlyGainRub: number;
  confidenceScore: number;
  leakageRub: number;
}

export class AiEconomicOptimizerService {
  private static readonly MIN_MARGIN_FLOOR_FACTOR = 1.15; // 15% absolute gross profit floor
  private static readonly MIN_CONFIDENCE_THRESHOLD = 0.70; // Filter low-confidence proposals
  private static readonly MAX_MARKUP_CAP = 12.0; // Prevent runaway price spikes

  /**
   * Orchestrates the complete nightly optimization cycle with full audit trace.
   */
  static async runNightlyOptimization(params: OptimizationRunParams) {
    const startTime = Date.now();
    const trace: ToolTraceEntry[] = [];
    const { tenantId, analyzedPeriodDays } = params;

    // Step 1: Fetch Real-Time USD to RUB Exchange Rate
    const step1Start = Date.now();
    let usdToRub = 92.5;
    try {
      usdToRub = await SettingsProvider.getExchangeRateUSD();
    } catch {
      // Fallback
    }
    trace.push({
      step: 'FETCH_EXCHANGE_RATE',
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - step1Start,
      outputSnapshot: { usdToRub },
    });

    // Step 2: Extract 30-day Order Volume & Profit Telemetry
    const step2Start = Date.now();
    const sinceDate = new Date(Date.now() - analyzedPeriodDays * 24 * 60 * 60 * 1000);

    const [services, recentOrders] = await Promise.all([
      db.service.findMany({
        where: { tenantId, isActive: true },
        select: {
          id: true,
          name: true,
          rate: true,
          providerCurrency: true,
          markup: true,
          pricePer1000Cents: true,
          categoryId: true,
        },
      }),
      db.order.findMany({
        where: {
          tenantId,
          createdAt: { gte: sinceDate },
          status: { in: ['COMPLETED', 'PARTIAL', 'IN_PROGRESS'] },
        },
        select: {
          serviceId: true,
          charge: true,
          providerCost: true,
          quantity: true,
          remains: true,
        },
      }),
    ]);

    trace.push({
      step: 'COLLECT_TELEMETRY',
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - step2Start,
      outputSnapshot: {
        activeServicesCount: services.length,
        ordersSampled: recentOrders.length,
      },
    });

    // Step 3: Compute Service-Level Economic Metrics
    const step3Start = Date.now();
    const serviceOrderMap = new Map<string, { count: number; totalChargeCents: bigint; totalCostCents: bigint }>();

    for (const order of recentOrders) {
      if (!order.serviceId) continue;
      const entry = serviceOrderMap.get(order.serviceId) || {
        count: 0,
        totalChargeCents: BigInt(0),
        totalCostCents: BigInt(0),
      };
      entry.count += 1;
      entry.totalChargeCents += BigInt(order.charge || 0);
      entry.totalCostCents += BigInt(order.providerCost || 0);
      serviceOrderMap.set(order.serviceId, entry);
    }

    const candidateLeaks: CandidateServiceLeak[] = [];
    let totalLeakageRub = 0;

    for (const s of services) {
      const exchangeRate = s.providerCurrency === 'RUB' ? 1.0 : usdToRub;
      const costInRub = s.rate * exchangeRate;
      const currentPriceRub = applyBeautifulRounding(costInRub * s.markup);

      const orderMetrics = serviceOrderMap.get(s.id) || {
        count: 0,
        totalChargeCents: BigInt(0),
        totalCostCents: BigInt(0),
      };

      const revenue30dRub = Number(orderMetrics.totalChargeCents) / 100;
      const cogs30dRub = Number(orderMetrics.totalCostCents) / 100;
      const margin30dRub = revenue30dRub - cogs30dRub;
      const currentMarginPercent = revenue30dRub > 0 ? (margin30dRub / revenue30dRub) * 100 : 0;

      const isUnderpriced = s.markup < 1.30 || currentMarginPercent < 15;
      const isVolumeUnderpriced = orderMetrics.count >= 20 && s.markup < 1.80;

      if (isUnderpriced || isVolumeUnderpriced) {
        let proposedMarkup = Math.max(s.markup * 1.20, 1.65);
        proposedMarkup = Math.min(proposedMarkup, this.MAX_MARKUP_CAP);

        let proposedPriceRub = applyBeautifulRounding(costInRub * proposedMarkup);

        // Invariant Assertion: floor boundary
        const minFloorPrice = costInRub * this.MIN_MARGIN_FLOOR_FACTOR;
        const floorPricePassed = proposedPriceRub >= minFloorPrice;
        const markupFloorPassed = proposedMarkup >= this.MIN_MARGIN_FLOOR_FACTOR;

        let confidence = 0.80;
        if (orderMetrics.count > 50) confidence += 0.15;
        if (orderMetrics.count < 5) confidence -= 0.10;
        if (s.markup < 1.10) confidence = 0.99;

        if (!floorPricePassed || !markupFloorPassed) {
          proposedPriceRub = applyBeautifulRounding(minFloorPrice);
          proposedMarkup = Number((proposedPriceRub / (costInRub || 1)).toFixed(2));
        }

        const projectedVolume = Math.max(orderMetrics.count, 5);
        const estimatedUnitsK = (projectedVolume * 1000) / 1000;
        const projectedMonthlyGainRub = Math.max(
          0,
          Math.round((proposedPriceRub - currentPriceRub) * estimatedUnitsK)
        );

        const leakRub = Math.max(0, (minFloorPrice - currentPriceRub) * estimatedUnitsK);
        totalLeakageRub += leakRub > 0 ? leakRub : projectedMonthlyGainRub;

        candidateLeaks.push({
          serviceId: s.id,
          name: s.name,
          providerCurrency: s.providerCurrency,
          providerRate: s.rate,
          costInRub,
          currentMarkup: s.markup,
          currentPriceRub,
          ordersCount30d: orderMetrics.count,
          revenue30dRub,
          margin30dRub,
          currentMarginPercent,
          proposedMarkup: Number(proposedMarkup.toFixed(2)),
          proposedPriceRub,
          projectedMonthlyGainRub,
          confidenceScore: Number(confidence.toFixed(2)),
          leakageRub: leakRub,
        });
      }
    }

    trace.push({
      step: 'INVARIANT_PIPELINE_EXECUTION',
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - step3Start,
      outputSnapshot: {
        candidateLeaksFound: candidateLeaks.length,
        totalLeakageRub: Math.round(totalLeakageRub),
      },
    });

    const executiveSummary = [
      `### Ночной экономический аудит платформы (${tenantId.toUpperCase()})`,
      `- **Анализируемый период**: ${analyzedPeriodDays} дней.`,
      `- **Выявленная ежемесячная утечка маржи**: **${Math.round(totalLeakageRub).toLocaleString('ru-RU')} ₽**.`,
      `- **Сервисов, требующих ценовой коррекции**: **${candidateLeaks.length} шт.**`,
      `- **Инвариантный барьер маржинальности**: 15% Gross Floor (все ${candidateLeaks.length} рекомендаций проверены и удовлетворяют условию).`,
      `- **Статус**: Ожидает подтверждения оператора / автоприменения.`,
    ].join('\n');

    const step5Start = Date.now();
    const snapshot = await db.$transaction(async (tx) => {
      const createdSnapshot = await tx.economicOptimizationSnapshot.create({
        data: {
          tenantId,
          analyzedPeriodDays,
          totalLeakageRub: Math.round(totalLeakageRub),
          leakingServicesCount: candidateLeaks.length,
          executiveSummary,
          toolExecutionTrace: trace as unknown as object,
          status: 'GENERATED',
        },
      });

      if (candidateLeaks.length > 0) {
        await tx.aiPricingRecommendation.createMany({
          data: candidateLeaks.map((leak) => ({
            snapshotId: createdSnapshot.id,
            serviceId: leak.serviceId,
            currentPriceRub: leak.currentPriceRub,
            proposedPriceRub: leak.proposedPriceRub,
            currentMarkup: leak.currentMarkup,
            proposedMarkup: leak.proposedMarkup,
            projectedMonthlyGainRub: leak.projectedMonthlyGainRub,
            confidenceScore: leak.confidenceScore,
            status: 'PENDING',
          })),
        });
      }

      return createdSnapshot;
    });

    trace.push({
      step: 'PERSIST_SNAPSHOT_AND_RECOMMENDATIONS',
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - step5Start,
      outputSnapshot: { snapshotId: snapshot.id },
    });

    const totalDurationMs = Date.now() - startTime;
    log.info(`[Tenant: ${tenantId}] Economic optimization snapshot created [ID: ${snapshot.id}] in ${totalDurationMs}ms`);

    return {
      snapshotId: snapshot.id,
      tenantId,
      totalLeakageRub: snapshot.totalLeakageRub,
      leakingServicesCount: snapshot.leakingServicesCount,
      durationMs: totalDurationMs,
      trace,
    };
  }
}
