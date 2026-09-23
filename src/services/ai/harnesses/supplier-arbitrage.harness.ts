import { z } from 'zod';
import Decimal from 'decimal.js';

export const SupplierCandidateSchema = z.object({
  providerId: z.string().min(1),
  providerName: z.string().min(1),
  externalServiceId: z.string().min(1),
  baseCogsRub: z.number().positive().describe('Supplier rate in RUB per 1k units'),
  slaP50Minutes: z.number().nonnegative().describe('Median order fulfillment latency in minutes'),
  slaP90Minutes: z.number().nonnegative().describe('90th percentile latency in minutes'),
  cancellationRate: z.number().min(0).max(1).describe('Historical order cancellation rate (0.0 to 1.0)'),
  qualityDropRate: z.number().min(0).max(1).describe('Historical follower/view drop rate (0.0 to 1.0)'),
  isActive: z.boolean().default(true),
  currentUsdBalance: z.number().default(100),
});

export const SupplierArbitrageInputSchema = z.object({
  targetServiceCategory: z.string().min(1),
  maxCancellationThreshold: z.number().min(0).max(1).default(0.15).describe('Filter out suppliers with cancellation > 15%'),
  maxDropThreshold: z.number().min(0).max(1).default(0.20),
  weights: z.object({
    cost: z.number().min(0).default(0.40),
    reliability: z.number().min(0).default(0.30),
    speed: z.number().min(0).default(0.20),
    quality: z.number().min(0).default(0.10),
  }).default({ cost: 0.40, reliability: 0.30, speed: 0.20, quality: 0.10 }),
  candidates: z.array(SupplierCandidateSchema).min(1),
});

export type SupplierCandidate = z.input<typeof SupplierCandidateSchema>;
export type SupplierArbitrageInput = z.input<typeof SupplierArbitrageInputSchema>;

export interface ScoredSupplierRoute {
  providerId: string;
  providerName: string;
  externalServiceId: string;
  baseCogsRub: number;
  riskAdjustedCogsRub: number;
  compositeLatencyScore: number;
  cancellationRate: number;
  qualityDropRate: number;
  overallArbitrageScore: number;
  rank: number;
  role: 'PRIMARY' | 'SECONDARY_FALLBACK' | 'EMERGENCY_RESERVE' | 'DISQUALIFIED';
  disqualificationReason?: string;
}

export interface SupplierArbitrageOutput {
  category: string;
  selectedPrimaryRoute: ScoredSupplierRoute;
  fallbackCascade: ScoredSupplierRoute[];
  disqualifiedRoutes: ScoredSupplierRoute[];
}

export class SupplierArbitrageOptimizationHarness {
  public static optimize(input: SupplierArbitrageInput): SupplierArbitrageOutput {
    const validated = SupplierArbitrageInputSchema.parse(input);
    const scoredRoutes: ScoredSupplierRoute[] = [];
    const disqualifiedRoutes: ScoredSupplierRoute[] = [];

    // Step 1: Qualification Filtering
    const qualifiedCandidates: SupplierCandidate[] = [];
    for (const c of validated.candidates) {
      if (!c.isActive) {
        disqualifiedRoutes.push(this.formatDisqualified(c, 'Provider is marked INACTIVE in settings'));
        continue;
      }
      if (c.currentUsdBalance <= 0) {
        disqualifiedRoutes.push(this.formatDisqualified(c, 'Provider USD balance is 0.00 (Depleted)'));
        continue;
      }
      if (c.cancellationRate > validated.maxCancellationThreshold) {
        disqualifiedRoutes.push(
          this.formatDisqualified(
            c,
            `Cancellation rate ${(c.cancellationRate * 100).toFixed(1)}% exceeds threshold of ${(
              validated.maxCancellationThreshold * 100
            ).toFixed(1)}%`
          )
        );
        continue;
      }
      if (c.qualityDropRate > validated.maxDropThreshold) {
        disqualifiedRoutes.push(
          this.formatDisqualified(
            c,
            `Quality drop rate ${(c.qualityDropRate * 100).toFixed(1)}% exceeds threshold`
          )
        );
        continue;
      }
      qualifiedCandidates.push(c);
    }

    if (qualifiedCandidates.length === 0) {
      throw new Error(
        `[SupplierArbitrageHarness] All supplier candidates disqualified for category '${validated.targetServiceCategory}'`
      );
    }

    // Step 2: Risk-Adjusted COGS and Latency Computations
    const maxCogs = Math.max(...qualifiedCandidates.map((c) => c.baseCogsRub));
    const maxLatency = Math.max(
      ...qualifiedCandidates.map((c) => 0.4 * c.slaP50Minutes + 0.6 * c.slaP90Minutes),
      1
    );

    const evaluated = qualifiedCandidates.map((c) => {
      const compositeLatency = new Decimal(0.4).times(c.slaP50Minutes).plus(new Decimal(0.6).times(c.slaP90Minutes));

      const riskMultiplier = new Decimal(1)
        .plus(new Decimal(1.5).times(c.cancellationRate))
        .plus(new Decimal(1.0).times(c.qualityDropRate));

      const riskAdjustedCogs = new Decimal(c.baseCogsRub).times(riskMultiplier);

      const costScore = new Decimal(1).minus(new Decimal(c.baseCogsRub).dividedBy(maxCogs || 1));
      const relScore = new Decimal(1).minus(c.cancellationRate);
      const speedScore = new Decimal(1).minus(compositeLatency.dividedBy(maxLatency));
      const qualScore = new Decimal(1).minus(c.qualityDropRate);

      const totalScore = new Decimal(validated.weights.cost)
        .times(costScore)
        .plus(new Decimal(validated.weights.reliability).times(relScore))
        .plus(new Decimal(validated.weights.speed).times(speedScore))
        .plus(new Decimal(validated.weights.quality).times(qualScore));

      return {
        candidate: c,
        riskAdjustedCogs: riskAdjustedCogs.toDecimalPlaces(2).toNumber(),
        compositeLatency: compositeLatency.toDecimalPlaces(1).toNumber(),
        totalScore: totalScore.toDecimalPlaces(4).toNumber(),
      };
    });

    // Step 3: Pareto / Total Score Ranking
    evaluated.sort((a, b) => b.totalScore - a.totalScore);

    evaluated.forEach((item, index) => {
      let role: ScoredSupplierRoute['role'] = 'EMERGENCY_RESERVE';
      if (index === 0) role = 'PRIMARY';
      else if (index === 1) role = 'SECONDARY_FALLBACK';

      scoredRoutes.push({
        providerId: item.candidate.providerId,
        providerName: item.candidate.providerName,
        externalServiceId: item.candidate.externalServiceId,
        baseCogsRub: item.candidate.baseCogsRub,
        riskAdjustedCogsRub: item.riskAdjustedCogs,
        compositeLatencyScore: item.compositeLatency,
        cancellationRate: item.candidate.cancellationRate,
        qualityDropRate: item.candidate.qualityDropRate,
        overallArbitrageScore: item.totalScore,
        rank: index + 1,
        role,
      });
    });

    return {
      category: validated.targetServiceCategory,
      selectedPrimaryRoute: scoredRoutes[0],
      fallbackCascade: scoredRoutes.slice(1),
      disqualifiedRoutes,
    };
  }

  private static formatDisqualified(c: SupplierCandidate, reason: string): ScoredSupplierRoute {
    return {
      providerId: c.providerId,
      providerName: c.providerName,
      externalServiceId: c.externalServiceId,
      baseCogsRub: c.baseCogsRub,
      riskAdjustedCogsRub: c.baseCogsRub,
      compositeLatencyScore: 0.4 * c.slaP50Minutes + 0.6 * c.slaP90Minutes,
      cancellationRate: c.cancellationRate,
      qualityDropRate: c.qualityDropRate,
      overallArbitrageScore: 0,
      rank: 999,
      role: 'DISQUALIFIED',
      disqualificationReason: reason,
    };
  }
}
