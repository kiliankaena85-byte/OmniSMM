import { z } from 'zod';
import Decimal from 'decimal.js';

export const TaxSchemeEnum = z.enum([
  'USN_6_INCOME',          // 6% on gross revenue (Cash method, art. 346.17 Tax Code RF)
  'USN_15_PROFIT',         // 15% on net operating margin
  'VAT_2026_22_PERCENT',   // 22% VAT when revenue exceeds 20M RUB threshold (FZ-176 / FZ-425)
]);

export const TreasurySimulationInputSchema = z.object({
  liquidCashBankRub: z.number().nonnegative().describe('Settled cash balance in company bank account'),
  liquidCashGatewaysRub: z.number().nonnegative().describe('Funds currently in YooKassa / Robokassa merchant balance awaiting settlement'),
  providerBalancesUsd: z.number().nonnegative().describe('Current aggregate balance at SMM providers in USD'),
  usdToRubExchangeRate: z.number().positive().default(92.5),
  totalCustomerWithdrawableDepositsRub: z.number().nonnegative().describe('Sum of all User.balance (Real money owed to customers)'),
  totalCustomerBonusBalancesRub: z.number().nonnegative().default(0).describe('Sum of all User.bonusBalance (Non-withdrawable credits - not counted as debt)'),
  activeUnfulfilledOrdersCostRub: z.number().nonnegative().describe('Expected fulfillment cost for IN_PROGRESS orders'),
  currentQuarterGrossInflowRub: z.number().nonnegative().describe('Total gross payments received this quarter for tax calculations'),
  taxScheme: TaxSchemeEnum.default('USN_6_INCOME'),
  gatewayRollingReservePercent: z.number().min(0).max(20).default(5).describe('5% rolling reserve holdback for chargeback safety'),
  minimumWorkingCapitalBufferRub: z.number().nonnegative().default(100000).describe('Safety buffer for operational expenses'),
});

export type TreasurySimulationInput = z.input<typeof TreasurySimulationInputSchema>;

export interface TreasurySimulationOutput {
  totalLiquidAssetsRub: number;
  totalCustomerEscrowLiabilityRub: number;
  customerRealDepositsRub: number;
  customerBonusCreditsRub: number;
  estimatedQuarterlyTaxDueRub: number;
  gatewayRollingReserveRub: number;
  minimumWorkingCapitalBufferRub: number;
  safeOwnerDrawCapacityRub: number;
  liquidityHealthStatus: 'SOLVENT_GREEN' | 'WARNING_AMBER' | 'INSOLVENT_CRITICAL_RED';
  accountingCausalityBreakdown: string[];
  recommendations: string[];
}

export class CustomerLiabilityTreasuryHarness {
  public static evaluate(input: TreasurySimulationInput): TreasurySimulationOutput {
    const validated = TreasurySimulationInputSchema.parse(input);
    const accountingCausality: string[] = [];
    const recommendations: string[] = [];

    // 1. Total Liquid Assets
    const bankCash = new Decimal(validated.liquidCashBankRub);
    const gatewayCash = new Decimal(validated.liquidCashGatewaysRub);
    const fxRate = new Decimal(validated.usdToRubExchangeRate);
    const providerRub = new Decimal(validated.providerBalancesUsd).times(fxRate);
    const totalLiquidAssets = bankCash.plus(gatewayCash).plus(providerRub);

    // 2. Customer Liabilities & Escrow
    const realDeposits = new Decimal(validated.totalCustomerWithdrawableDepositsRub);
    const bonusCredits = new Decimal(validated.totalCustomerBonusBalancesRub);
    const activeOrdersEscrow = new Decimal(validated.activeUnfulfilledOrdersCostRub);
    const totalCustomerEscrow = realDeposits.plus(activeOrdersEscrow);

    accountingCausality.push(
      `Кредиторская задолженность перед клиентами: ${realDeposits.toFixed(2)} ₽ (непотраченные балансы) + ${activeOrdersEscrow.toFixed(2)} ₽ (заказы в очереди).`
    );
    accountingCausality.push(
      `Бонусный баланс пользователей (${bonusCredits.toFixed(2)} ₽) исключен из денежных обязательств, так как является невыводимым маркетинговым кредитом.`
    );

    // 3. Tax Reserve Computation (Cash method: art. 346.17 Tax Code RF)
    let taxRateDecimal = new Decimal(0.06); // 6% default
    if (validated.taxScheme === 'VAT_2026_22_PERCENT') {
      taxRateDecimal = new Decimal(0.22);
    } else if (validated.taxScheme === 'USN_15_PROFIT') {
      taxRateDecimal = new Decimal(0.15);
    }

    const estimatedTaxDue = new Decimal(validated.currentQuarterGrossInflowRub).times(taxRateDecimal);
    accountingCausality.push(
      `Налоговый резерв за текущий квартал (${(taxRateDecimal.toNumber() * 100).toFixed(0)}% по кассовому методу): ${estimatedTaxDue.toFixed(2)} ₽.`
    );

    // 4. Gateway Rolling Reserve
    const rollingReserve = gatewayCash.times(new Decimal(validated.gatewayRollingReservePercent).dividedBy(100));

    // 5. Operational Safety Buffer
    const safetyBuffer = new Decimal(validated.minimumWorkingCapitalBufferRub);

    // 6. Safe Owner Draw Formula:
    // TotalLiquidAssets - TotalCustomerEscrow - EstimatedTaxDue - GatewayRollingReserve - SafetyBuffer
    const requiredRestrictedFunds = totalCustomerEscrow
      .plus(estimatedTaxDue)
      .plus(rollingReserve)
      .plus(safetyBuffer);

    const netFreeCash = totalLiquidAssets.minus(requiredRestrictedFunds);
    const safeOwnerDraw = Decimal.max(0, netFreeCash);

    // 7. Liquidity Health Status
    let status: TreasurySimulationOutput['liquidityHealthStatus'] = 'SOLVENT_GREEN';

    if (totalLiquidAssets.lessThan(totalCustomerEscrow.plus(estimatedTaxDue))) {
      status = 'INSOLVENT_CRITICAL_RED';
      accountingCausality.push(
        `КРИТИЧЕСКИЙ РИСК: Текущая ликвидность меньше обязательств перед клиентами и налоговой. Вывод средств категорически запрещен!`
      );
      recommendations.push('Срочно пополнить расчетный счет для покрытия клиентского эскроу и налогового резерва.');
    } else if (netFreeCash.lessThanOrEqualTo(0)) {
      status = 'WARNING_AMBER';
      accountingCausality.push(
        `ВНИМАНИЕ: Свободная ликвидность исчерпана до минимального рабочего буфера. Вывод дивидендов временно приостановлен.`
      );
      recommendations.push('Дождаться завершения расчетов с эквайрингом (T+1/T+2) перед выводом прибыли.');
    } else {
      accountingCausality.push(
        `Финансовое здоровье в норме: доступно к безопасному выводу ${safeOwnerDraw.toFixed(2)} ₽ без риска для операционной деятельности.`
      );
      recommendations.push(`Максимальная безопасная сумма к распределению: ${safeOwnerDraw.toFixed(2)} ₽.`);
    }

    return {
      totalLiquidAssetsRub: totalLiquidAssets.toDecimalPlaces(2).toNumber(),
      totalCustomerEscrowLiabilityRub: totalCustomerEscrow.toDecimalPlaces(2).toNumber(),
      customerRealDepositsRub: realDeposits.toDecimalPlaces(2).toNumber(),
      customerBonusCreditsRub: bonusCredits.toDecimalPlaces(2).toNumber(),
      estimatedQuarterlyTaxDueRub: estimatedTaxDue.toDecimalPlaces(2).toNumber(),
      gatewayRollingReserveRub: rollingReserve.toDecimalPlaces(2).toNumber(),
      minimumWorkingCapitalBufferRub: safetyBuffer.toDecimalPlaces(2).toNumber(),
      safeOwnerDrawCapacityRub: safeOwnerDraw.toDecimalPlaces(2).toNumber(),
      liquidityHealthStatus: status,
      accountingCausalityBreakdown: accountingCausality,
      recommendations,
    };
  }
}
