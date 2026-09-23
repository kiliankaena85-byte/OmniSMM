import { z } from 'zod';
import type { GeminiToolClient } from './gemini-tool-client';
import { GeminiToolDefinition } from './types';
import {
  UnitEconomicsElasticityHarness,
  ElasticitySimulationInputSchema,
  ElasticitySimulationOutput,
} from './harnesses/unit-economics-elasticity.harness';
import {
  SupplierArbitrageOptimizationHarness,
  SupplierArbitrageInputSchema,
  SupplierArbitrageOutput,
} from './harnesses/supplier-arbitrage.harness';
import {
  CustomerLiabilityTreasuryHarness,
  TreasurySimulationInputSchema,
  TreasurySimulationOutput,
} from './harnesses/customer-liability-treasury.harness';
import {
  CashflowLiquidityForecastHarness,
  CashflowForecastInputSchema,
  CashflowForecastOutput,
} from './harnesses/cashflow-forecast.harness';
import {
  ChurnRiskLtvDefenseHarness,
  ChurnDefenseInputSchema,
  ChurnDefenseOutput,
} from './harnesses/churn-risk-ltv.harness';

/**
 * 1. Unit Economics & Price Elasticity Tool
 */
export const unitEconomicsElasticityTool: GeminiToolDefinition<
  typeof ElasticitySimulationInputSchema,
  ElasticitySimulationOutput
> = {
  name: 'simulate_unit_economics',
  description:
    'Simulates retail price elasticity of demand, markup steps, psychological charm rounding (.90, .99), gross margins, and warns if margin floors are violated.',
  schema: ElasticitySimulationInputSchema,
  handler: (args) => {
    return UnitEconomicsElasticityHarness.simulate(args);
  },
};

/**
 * 2. Supplier Arbitrage & Route Optimization Tool
 */
export const supplierArbitrageTool: GeminiToolDefinition<
  typeof SupplierArbitrageInputSchema,
  SupplierArbitrageOutput
> = {
  name: 'optimize_supplier_arbitrage',
  description:
    'Ranks and scores SMM service suppliers based on COGS, SLA latency (P50/P90), cancellation rates, and quality drops. Selects optimal primary and fallback routes.',
  schema: SupplierArbitrageInputSchema,
  handler: (args) => {
    return SupplierArbitrageOptimizationHarness.optimize(args);
  },
};

/**
 * 3. Customer Liability & Treasury Audit Tool
 */
export const customerLiabilityTreasuryTool: GeminiToolDefinition<
  typeof TreasurySimulationInputSchema,
  TreasurySimulationOutput
> = {
  name: 'evaluate_customer_liability_treasury',
  description:
    'Audits liquid cash assets against customer balance liabilities, order fulfillment escrow, Russian tax reserves (USN 6%/15%, VAT 22%), and calculates safe owner draw capacity.',
  schema: TreasurySimulationInputSchema,
  handler: (args) => {
    return CustomerLiabilityTreasuryHarness.evaluate(args);
  },
};

/**
 * 4. Cashflow & Gateway Liquidity Forecast Tool
 */
export const cashflowForecastTool: GeminiToolDefinition<
  typeof CashflowForecastInputSchema,
  CashflowForecastOutput
> = {
  name: 'forecast_cashflow_liquidity',
  description:
    'Simulates multi-day cash inflows and outflows taking gateway settlement lags (T+0/T+1/T+2) and provider burn into account. Predicts runway shortfall and depletion dates.',
  schema: CashflowForecastInputSchema,
  handler: (args) => {
    return CashflowLiquidityForecastHarness.forecast(args);
  },
};

/**
 * 5. Churn Risk & LTV Trust Defense Tool
 */
export const churnRiskLtvTool: GeminiToolDefinition<
  typeof ChurnDefenseInputSchema,
  ChurnDefenseOutput
> = {
  name: 'calculate_churn_risk_ltv',
  description:
    'Predicts customer churn probability from support latency and quality drops, calculates lifetime value at risk, and bounds compensation options within margin budget.',
  schema: ChurnDefenseInputSchema,
  handler: (args) => {
    return ChurnRiskLtvDefenseHarness.evaluate(args);
  },
};

/**
 * All core deterministic economic harness tools
 */
export const allEconomicHarnessTools: GeminiToolDefinition<z.ZodTypeAny, unknown>[] = [
  unitEconomicsElasticityTool as unknown as GeminiToolDefinition<z.ZodTypeAny, unknown>,
  supplierArbitrageTool as unknown as GeminiToolDefinition<z.ZodTypeAny, unknown>,
  customerLiabilityTreasuryTool as unknown as GeminiToolDefinition<z.ZodTypeAny, unknown>,
  cashflowForecastTool as unknown as GeminiToolDefinition<z.ZodTypeAny, unknown>,
  churnRiskLtvTool as unknown as GeminiToolDefinition<z.ZodTypeAny, unknown>,
];

/**
 * Registers all economic harness tools into the given GeminiToolClient instance.
 */
export function registerEconomicHarnesses(client: GeminiToolClient): GeminiToolClient {
  for (const tool of allEconomicHarnessTools) {
    client.registerTool(tool);
  }
  return client;
}
