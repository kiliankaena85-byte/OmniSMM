import { z } from 'zod';
import Decimal from 'decimal.js';

export const RoundingStrategyEnum = z.enum([
  'CHARM_90',       // Round to integer .90 (e.g. 149.90)
  'CHARM_99',       // Round to integer .99 (e.g. 149.99)
  'INTEGER_RUBLE',   // Round to nearest integer (e.g. 150.00)
  'PREMIUM_STEP_10',// Round to multiples of 10.00 (e.g. 150.00)
  'RAW',            // No psychological adjustment
]);

export const ElasticityModelEnum = z.enum([
  'LINEAR',         // Q(P) = Q0 * (1 + e * (P - P0)/P0)
  'ISOELASTIC',     // Q(P) = Q0 * (P / P0)^e
]);

export const ElasticitySimulationInputSchema = z.object({
  serviceId: z.string().min(1).describe('Unique ID of the catalog service'),
  serviceName: z.string().min(1).describe('Display title of the service'),
  baseCogsRub: z.number().positive().describe('Supplier base COGS in RUB per unit or 1k units'),
  fxBufferPercent: z.number().min(0).max(50).default(5).describe('Currency volatility buffer (default 5%)'),
  currentPriceRub: z.number().positive().describe('Current baseline retail selling price'),
  currentVolume: z.number().nonnegative().describe('Current baseline order volume at currentPriceRub'),
  priceElasticityOfDemand: z.number().max(0).describe('Demand elasticity coefficient (negative float, e.g. -1.4)'),
  elasticityModel: ElasticityModelEnum.default('LINEAR'),
  minMarginFloorPercent: z.number().min(0).max(90).default(15).describe('Hard margin floor boundary (e.g. 15%)'),
  markupSteps: z.array(z.number().positive()).default([0.15, 0.25, 0.40, 0.60, 0.80, 1.00, 1.50, 2.00]),
  roundingStrategy: RoundingStrategyEnum.default('CHARM_90'),
});

export type ElasticitySimulationInput = z.input<typeof ElasticitySimulationInputSchema>;

export interface PriceSimulationPoint {
  markupPercent: number;
  rawPriceRub: number;
  beautifulPriceRub: number;
  projectedVolume: number;
  projectedRevenueRub: number;
  effectiveCogsRub: number;
  totalCostRub: number;
  projectedGrossProfitRub: number;
  grossMarginPercent: number;
  isMarginFloorViolated: boolean;
}

export interface ElasticitySimulationOutput {
  serviceId: string;
  effectiveCogsWithFxRub: number;
  optimalPricePoint: PriceSimulationPoint;
  simulations: PriceSimulationPoint[];
  warnings: string[];
}

export class UnitEconomicsElasticityHarness {
  public static roundToBeautifulPrice(price: Decimal, strategy: z.infer<typeof RoundingStrategyEnum>): Decimal {
    if (strategy === 'RAW') {
      return price.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }

    if (strategy === 'INTEGER_RUBLE') {
      return price.round();
    }

    if (strategy === 'PREMIUM_STEP_10') {
      return price.dividedBy(10).round().times(10);
    }

    if (strategy === 'CHARM_90') {
      const floored = price.floor();
      return floored.plus(0.9);
    }

    if (strategy === 'CHARM_99') {
      const floored = price.floor();
      return floored.plus(0.99);
    }

    return price.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }

  public static simulate(input: ElasticitySimulationInput): ElasticitySimulationOutput {
    const validated = ElasticitySimulationInputSchema.parse(input);
    const warnings: string[] = [];

    const baseCogs = new Decimal(validated.baseCogsRub);
    const fxMultiplier = new Decimal(1).plus(new Decimal(validated.fxBufferPercent).dividedBy(100));
    const effectiveCogs = baseCogs.times(fxMultiplier);

    const p0 = new Decimal(validated.currentPriceRub);
    const q0 = new Decimal(validated.currentVolume);
    const epsilon = new Decimal(validated.priceElasticityOfDemand);
    const marginFloor = new Decimal(validated.minMarginFloorPercent);

    const simulations: PriceSimulationPoint[] = [];

    for (const markup of validated.markupSteps) {
      const markupDec = new Decimal(markup);
      const rawPrice = effectiveCogs.times(new Decimal(1).plus(markupDec));
      const beautifulPrice = this.roundToBeautifulPrice(rawPrice, validated.roundingStrategy);

      let projectedQ = new Decimal(0);

      if (q0.isZero()) {
        projectedQ = new Decimal(0);
      } else if (validated.elasticityModel === 'LINEAR') {
        const deltaPRel = beautifulPrice.minus(p0).dividedBy(p0);
        const qFactor = new Decimal(1).plus(epsilon.times(deltaPRel));
        projectedQ = Decimal.max(0, q0.times(qFactor));
      } else {
        const priceRatio = beautifulPrice.dividedBy(p0);
        if (priceRatio.isPositive()) {
          const factor = Decimal.pow(priceRatio, epsilon);
          projectedQ = Decimal.max(0, q0.times(factor));
        }
      }

      const projectedRevenue = beautifulPrice.times(projectedQ);
      const totalCost = effectiveCogs.times(projectedQ);
      const grossProfit = projectedRevenue.minus(totalCost);

      const marginPercent = beautifulPrice.isPositive()
        ? beautifulPrice.minus(effectiveCogs).dividedBy(beautifulPrice).times(100)
        : new Decimal(0);

      const isFloorViolated = marginPercent.lessThan(marginFloor);

      simulations.push({
        markupPercent: markup * 100,
        rawPriceRub: rawPrice.toDecimalPlaces(2).toNumber(),
        beautifulPriceRub: beautifulPrice.toDecimalPlaces(2).toNumber(),
        projectedVolume: projectedQ.round().toNumber(),
        projectedRevenueRub: projectedRevenue.toDecimalPlaces(2).toNumber(),
        effectiveCogsRub: effectiveCogs.toDecimalPlaces(2).toNumber(),
        totalCostRub: totalCost.toDecimalPlaces(2).toNumber(),
        projectedGrossProfitRub: grossProfit.toDecimalPlaces(2).toNumber(),
        grossMarginPercent: marginPercent.toDecimalPlaces(2).toNumber(),
        isMarginFloorViolated: isFloorViolated,
      });
    }

    const compliantPoints = simulations.filter((s) => !s.isMarginFloorViolated);

    if (compliantPoints.length === 0) {
      warnings.push(`CRITICAL: All markup simulation steps breached the hard margin floor of ${validated.minMarginFloorPercent}%.`);
    }

    const eligiblePool = compliantPoints.length > 0 ? compliantPoints : simulations;
    const optimalPoint = eligiblePool.reduce((max, curr) =>
      curr.projectedGrossProfitRub > max.projectedGrossProfitRub ? curr : max
    );

    return {
      serviceId: validated.serviceId,
      effectiveCogsWithFxRub: effectiveCogs.toDecimalPlaces(2).toNumber(),
      optimalPricePoint: optimalPoint,
      simulations,
      warnings,
    };
  }
}
