import { z } from 'zod';
import Decimal from 'decimal.js';

export const CustomerRiskProfileSchema = z.object({
  userId: z.string().min(1),
  accountAgeDays: z.number().nonnegative(),
  historicalSpendRub: z.number().nonnegative(),
  lifetimeMarginRub: z.number().nonnegative(),
  monthlyAverageSpendRub: z.number().nonnegative(),
  failedOrdersCount30d: z.number().nonnegative(),
  ticketSupportLagHours: z.number().nonnegative().default(0),
  recentDropRatePercent: z.number().nonnegative().default(0),
  customerTier: z.enum(['VIP', 'REGULAR', 'NEW']).default('REGULAR'),
});

export const ChurnDefenseInputSchema = z.object({
  customer: CustomerRiskProfileSchema,
  maxAllowedMarginCompensationRate: z.number().min(0).max(0.5).default(0.15).describe('Max 15% of lifetime margin can be spent on compensation'),
  maxAbsoluteCompensationCapRub: z.number().positive().default(2500),
  expectedCustomerLifespanMonths: z.number().positive().default(12),
});

export type CustomerRiskProfile = z.input<typeof CustomerRiskProfileSchema>;
export type ChurnDefenseInput = z.input<typeof ChurnDefenseInputSchema>;

export interface CompensationOption {
  strategy: 'BONUS_BALANCE' | 'DIRECT_REFUND' | 'DISCOUNT_VOUCHER' | 'NONE';
  compensationCostRub: number;
  voucherPercentDiscount?: number;
  expectedChurnReductionPercent: number;
  netEconomicRetainedValueRub: number;
  isWithinBudget: boolean;
}

export interface ChurnDefenseOutput {
  userId: string;
  baselineChurnProbability: number;
  estimatedLtvRub: number;
  ltvAtRiskRub: number;
  trustBudgetCeilingRub: number;
  recommendedCompensation: CompensationOption;
  alternativeOptions: CompensationOption[];
}

export class ChurnRiskLtvDefenseHarness {
  public static calculateChurnProbability(profile: CustomerRiskProfile): Decimal {
    const beta0 = new Decimal(-1.2);
    const beta1 = new Decimal(0.45).times(profile.failedOrdersCount30d);
    const beta2 = new Decimal(0.08).times(profile.ticketSupportLagHours || 0);
    const beta3 = new Decimal(0.05).times(profile.recentDropRatePercent || 0);
    const beta4 = new Decimal(0.25).times(Decimal.ln(new Decimal(1).plus(profile.accountAgeDays)));
    const beta5 = new Decimal(0.30).times(Decimal.ln(new Decimal(1).plus(profile.historicalSpendRub)));

    const z = beta0.plus(beta1).plus(beta2).plus(beta3).minus(beta4).minus(beta5);

    const expNegZ = Decimal.exp(z.negated());
    const prob = new Decimal(1).dividedBy(new Decimal(1).plus(expNegZ));

    return Decimal.min(0.99, Decimal.max(0.01, prob));
  }

  public static evaluate(input: ChurnDefenseInput): ChurnDefenseOutput {
    const validated = ChurnDefenseInputSchema.parse(input);
    const profile = validated.customer;

    // 1. Churn Probability
    const churnProb = this.calculateChurnProbability(profile);

    // 2. LTV Computation: MonthlySpend * MarginRate (approx 35%) * ExpectedLifespan
    const monthlySpend = new Decimal(profile.monthlyAverageSpendRub);
    const marginRate = profile.historicalSpendRub > 0
      ? new Decimal(profile.lifetimeMarginRub).dividedBy(profile.historicalSpendRub)
      : new Decimal(0.35);
    const ltv = monthlySpend.times(marginRate).times(validated.expectedCustomerLifespanMonths);
    const ltvAtRisk = ltv.times(churnProb);

    // 3. Trust Budget Ceiling Clamp
    const marginBasedCap = new Decimal(profile.lifetimeMarginRub).times(validated.maxAllowedMarginCompensationRate);
    const trustBudget = Decimal.min(validated.maxAbsoluteCompensationCapRub, Decimal.max(100, marginBasedCap));

    // 4. Candidate Compensation Packages
    const options: CompensationOption[] = [];

    // Candidate A: Bonus Balance
    const bonusCost = Decimal.min(trustBudget, new Decimal(500));
    const bonusReduction = new Decimal(0.25);
    const bonusRetainedValue = ltv.times(churnProb.times(bonusReduction)).minus(bonusCost);
    options.push({
      strategy: 'BONUS_BALANCE',
      compensationCostRub: bonusCost.toDecimalPlaces(2).toNumber(),
      expectedChurnReductionPercent: bonusReduction.times(100).toNumber(),
      netEconomicRetainedValueRub: bonusRetainedValue.toDecimalPlaces(2).toNumber(),
      isWithinBudget: bonusCost.lessThanOrEqualTo(trustBudget),
    });

    // Candidate B: Direct Partial Refund
    const refundCost = Decimal.min(trustBudget, new Decimal(profile.failedOrdersCount30d).times(300));
    const refundReduction = new Decimal(0.40);
    const refundRetainedValue = ltv.times(churnProb.times(refundReduction)).minus(refundCost);
    options.push({
      strategy: 'DIRECT_REFUND',
      compensationCostRub: refundCost.toDecimalPlaces(2).toNumber(),
      expectedChurnReductionPercent: refundReduction.times(100).toNumber(),
      netEconomicRetainedValueRub: refundRetainedValue.toDecimalPlaces(2).toNumber(),
      isWithinBudget: refundCost.lessThanOrEqualTo(trustBudget),
    });

    // Candidate C: 20% Discount Voucher
    const voucherCost = new Decimal(150);
    const voucherReduction = new Decimal(0.15);
    const voucherRetainedValue = ltv.times(churnProb.times(voucherReduction)).minus(voucherCost);
    options.push({
      strategy: 'DISCOUNT_VOUCHER',
      compensationCostRub: voucherCost.toNumber(),
      voucherPercentDiscount: 20,
      expectedChurnReductionPercent: voucherReduction.times(100).toNumber(),
      netEconomicRetainedValueRub: voucherRetainedValue.toDecimalPlaces(2).toNumber(),
      isWithinBudget: voucherCost.lessThanOrEqualTo(trustBudget),
    });

    // Candidate D: No Intervention
    options.push({
      strategy: 'NONE',
      compensationCostRub: 0,
      expectedChurnReductionPercent: 0,
      netEconomicRetainedValueRub: 0,
      isWithinBudget: true,
    });

    const validOptions = options.filter((o) => o.isWithinBudget);
    const bestOption = validOptions.reduce((best, curr) =>
      curr.netEconomicRetainedValueRub > best.netEconomicRetainedValueRub ? curr : best
    );

    return {
      userId: profile.userId,
      baselineChurnProbability: churnProb.toDecimalPlaces(4).toNumber(),
      estimatedLtvRub: ltv.toDecimalPlaces(2).toNumber(),
      ltvAtRiskRub: ltvAtRisk.toDecimalPlaces(2).toNumber(),
      trustBudgetCeilingRub: trustBudget.toDecimalPlaces(2).toNumber(),
      recommendedCompensation: bestOption,
      alternativeOptions: options.filter((o) => o !== bestOption),
    };
  }
}
