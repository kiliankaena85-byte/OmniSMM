import { z } from 'zod';
import Decimal from 'decimal.js';

export const PaymentGatewayConfigSchema = z.object({
  gatewayId: z.string().min(1),
  name: z.string().min(1),
  settlementLagDays: z.number().int().min(0).describe('T+0 for instant crypto/SBP, T+1 for YooKassa, T+2 for Tinkoff/PayAnyWay'),
  processingFeePercent: z.number().min(0).max(20).describe('Gateway merchant fee percentage'),
  holdbackReservePercent: z.number().min(0).max(20).default(0).describe('Rolling reserve / chargeback holdback'),
});

export const DailyGatewayInflowSchema = z.object({
  dayOffset: z.number().int().min(0).describe('0 = today, 1 = tomorrow, etc.'),
  gatewayId: z.string().min(1),
  grossAmountRub: z.number().nonnegative(),
});

export const CashflowForecastInputSchema = z.object({
  forecastHorizonDays: z.number().int().min(3).max(30).default(7),
  currentLiquidBankBalanceRub: z.number().nonnegative(),
  currentProviderUsdBalance: z.number().nonnegative(),
  usdToRubExchangeRate: z.number().positive().default(92.5),
  projectedDailyBurnUsd: z.number().positive().describe('Daily order COGS sent to API providers in USD'),
  minimumProviderSafeBufferUsd: z.number().nonnegative().default(500),
  gateways: z.array(PaymentGatewayConfigSchema).min(1),
  inflowSchedule: z.array(DailyGatewayInflowSchema),
  plannedTopUpsUsd: z.array(
    z.object({
      dayOffset: z.number().int().min(0),
      amountUsd: z.number().positive(),
    })
  ).default([]),
});

export type CashflowForecastInput = z.input<typeof CashflowForecastInputSchema>;

export interface DailyCashflowPoint {
  dayOffset: number;
  dateStr: string;
  projectedGrossInflowRub: number;
  settledNetInflowRub: number;
  providerUsdBalance: number;
  liquidBankBalanceRub: number;
  isProviderDepleted: boolean;
  isRunwayCritical: boolean;
}

export interface CashflowForecastOutput {
  forecastHorizonDays: number;
  initialProviderUsdBalance: number;
  finalProjectedProviderUsdBalance: number;
  estimatedDepletionDayOffset: number | null;
  overallStatus: 'HEALTHY' | 'WARNING_BUFFER' | 'CRITICAL_SHORTFALL';
  requiredUrgentTopUpUsd: number;
  dailyTimeline: DailyCashflowPoint[];
  alarms: string[];
}

export class CashflowLiquidityForecastHarness {
  public static forecast(input: CashflowForecastInput): CashflowForecastOutput {
    const validated = CashflowForecastInputSchema.parse(input);
    const alarms: string[] = [];
    const timeline: DailyCashflowPoint[] = [];

    const gatewayMap = new Map<string, z.infer<typeof PaymentGatewayConfigSchema>>();
    for (const g of validated.gateways) {
      gatewayMap.set(g.gatewayId, g);
    }

    let runningProviderUsd = new Decimal(validated.currentProviderUsdBalance);
    let runningBankRub = new Decimal(validated.currentLiquidBankBalanceRub);
    const dailyBurnUsd = new Decimal(validated.projectedDailyBurnUsd);
    const fxRate = new Decimal(validated.usdToRubExchangeRate);
    const safeBufferUsd = new Decimal(validated.minimumProviderSafeBufferUsd);

    let depletionDayOffset: number | null = null;
    let maxTopUpDeficitUsd = new Decimal(0);

    for (let day = 0; day < validated.forecastHorizonDays; day++) {
      const dayDate = new Date(Date.now() + day * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      let grossInflowToday = new Decimal(0);
      let settledInflowToday = new Decimal(0);

      for (const item of validated.inflowSchedule) {
        const gw = gatewayMap.get(item.gatewayId);
        if (!gw) continue;

        if (item.dayOffset === day) {
          grossInflowToday = grossInflowToday.plus(item.grossAmountRub);
        }

        if (item.dayOffset + gw.settlementLagDays === day) {
          const gross = new Decimal(item.grossAmountRub);
          const feeFactor = new Decimal(1).minus(new Decimal(gw.processingFeePercent).dividedBy(100));
          const reserveFactor = new Decimal(1).minus(new Decimal(gw.holdbackReservePercent).dividedBy(100));
          const net = gross.times(feeFactor).times(reserveFactor);
          settledInflowToday = settledInflowToday.plus(net);
        }
      }

      runningBankRub = runningBankRub.plus(settledInflowToday);

      const plannedTopUps = validated.plannedTopUpsUsd.filter((t) => t.dayOffset === day);
      for (const topUp of plannedTopUps) {
        const topUpUsd = new Decimal(topUp.amountUsd);
        const costRub = topUpUsd.times(fxRate);
        runningBankRub = runningBankRub.minus(costRub);
        runningProviderUsd = runningProviderUsd.plus(topUpUsd);
      }

      runningProviderUsd = runningProviderUsd.minus(dailyBurnUsd);

      const isDepleted = runningProviderUsd.lessThanOrEqualTo(0);
      const isCritical = runningProviderUsd.lessThan(safeBufferUsd);

      if (isDepleted && depletionDayOffset === null) {
        depletionDayOffset = day;
      }

      if (runningProviderUsd.lessThan(safeBufferUsd)) {
        const deficit = safeBufferUsd.minus(runningProviderUsd);
        if (deficit.greaterThan(maxTopUpDeficitUsd)) {
          maxTopUpDeficitUsd = deficit;
        }
      }

      timeline.push({
        dayOffset: day,
        dateStr: dayDate,
        projectedGrossInflowRub: grossInflowToday.toDecimalPlaces(2).toNumber(),
        settledNetInflowRub: settledInflowToday.toDecimalPlaces(2).toNumber(),
        providerUsdBalance: runningProviderUsd.toDecimalPlaces(2).toNumber(),
        liquidBankBalanceRub: runningBankRub.toDecimalPlaces(2).toNumber(),
        isProviderDepleted: isDepleted,
        isRunwayCritical: isCritical,
      });
    }

    let overallStatus: CashflowForecastOutput['overallStatus'] = 'HEALTHY';

    if (depletionDayOffset !== null) {
      overallStatus = 'CRITICAL_SHORTFALL';
      alarms.push(`CRITICAL: Provider balances deplete to $0 on Day ${depletionDayOffset}. Urgent top-up of $${maxTopUpDeficitUsd.toFixed(2)} required.`);
    } else if (maxTopUpDeficitUsd.greaterThan(0)) {
      overallStatus = 'WARNING_BUFFER';
      alarms.push(`WARNING: Provider balances breach safe buffer threshold ($${safeBufferUsd.toFixed(2)}). Recommended top-up: $${maxTopUpDeficitUsd.toFixed(2)}.`);
    }

    return {
      forecastHorizonDays: validated.forecastHorizonDays,
      initialProviderUsdBalance: validated.currentProviderUsdBalance,
      finalProjectedProviderUsdBalance: runningProviderUsd.toDecimalPlaces(2).toNumber(),
      estimatedDepletionDayOffset: depletionDayOffset,
      overallStatus,
      requiredUrgentTopUpUsd: maxTopUpDeficitUsd.toDecimalPlaces(2).toNumber(),
      dailyTimeline: timeline,
      alarms,
    };
  }
}
