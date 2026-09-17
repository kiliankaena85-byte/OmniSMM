import { describe, it, expect } from 'vitest';
import { GeminiToolClient } from '@/services/ai/gemini-tool-client';
import {
  registerEconomicHarnesses,
  allEconomicHarnessTools,
  unitEconomicsElasticityTool,
  supplierArbitrageTool,
  customerLiabilityTreasuryTool,
  cashflowForecastTool,
  churnRiskLtvTool,
} from '@/services/ai/harness-bridge';
import { ElasticitySimulationOutput } from '@/services/ai/harnesses/unit-economics-elasticity.harness';
import { SupplierArbitrageOutput } from '@/services/ai/harnesses/supplier-arbitrage.harness';
import { TreasurySimulationOutput } from '@/services/ai/harnesses/customer-liability-treasury.harness';

describe('Dual-Engine Bridge: Deterministic Economic Harnesses -> Gemini ReAct Tool Client', () => {
  it('exports all 5 deterministic financial and economic harness tools', () => {
    expect(allEconomicHarnessTools.length).toBe(5);
    const names = allEconomicHarnessTools.map((t) => t.name);
    expect(names).toContain('simulate_unit_economics');
    expect(names).toContain('optimize_supplier_arbitrage');
    expect(names).toContain('evaluate_customer_liability_treasury');
    expect(names).toContain('forecast_cashflow_liquidity');
    expect(names).toContain('calculate_churn_risk_ltv');
  });

  it('registers all economic harnesses on GeminiToolClient instance', () => {
    const client = new GeminiToolClient();
    expect(client.getRegisteredToolNames().length).toBe(0);

    client.registerEconomicHarnesses();
    expect(client.getRegisteredToolNames().length).toBe(5);
    expect(client.getRegisteredToolNames()).toEqual([
      'simulate_unit_economics',
      'optimize_supplier_arbitrage',
      'evaluate_customer_liability_treasury',
      'forecast_cashflow_liquidity',
      'calculate_churn_risk_ltv',
    ]);
  });

  it('automatically registers harnesses when autoRegisterEconomicHarnesses option is true', () => {
    const client = new GeminiToolClient({ autoRegisterEconomicHarnesses: true });
    expect(client.getRegisteredToolNames().length).toBe(5);
    expect(client.getTool('simulate_unit_economics')).toBeDefined();
    expect(client.getTool('optimize_supplier_arbitrage')).toBeDefined();
  });

  it('compiles valid Gemini OpenAPI function declarations for all registered tools', () => {
    const client = new GeminiToolClient();
    registerEconomicHarnesses(client);

    const declarations = client.getFunctionDeclarations();
    expect(declarations.length).toBe(5);

    for (const decl of declarations) {
      expect(decl.name).toBeDefined();
      expect(decl.description.length).toBeGreaterThan(10);
      expect(decl.parameters.type).toBe('OBJECT');
      expect(decl.parameters.properties).toBeDefined();
      expect(Object.keys(decl.parameters.properties!).length).toBeGreaterThan(0);
    }

    const unitEconDecl = declarations.find((d) => d.name === 'simulate_unit_economics');
    expect(unitEconDecl?.parameters.properties?.baseCogsRub?.type).toBe('NUMBER');
    expect(unitEconDecl?.parameters.required).toContain('serviceId');

    const treasuryDecl = declarations.find((d) => d.name === 'evaluate_customer_liability_treasury');
    expect(treasuryDecl?.parameters.properties?.liquidCashBankRub?.type).toBe('NUMBER');
    expect(treasuryDecl?.parameters.required).toContain('liquidCashBankRub');
  });

  it('executes simulate_unit_economics tool directly with deterministic mathematical precision', async () => {
    const client = new GeminiToolClient();
    client.registerEconomicHarnesses();

    const output = (await client.executeToolDirectly('simulate_unit_economics', {
      serviceId: 'srv_vk_100',
      serviceName: 'VK Followers HQ',
      baseCogsRub: 50.0,
      fxBufferPercent: 10.0, // 55 RUB effective COGS
      currentPriceRub: 90.0,
      currentVolume: 2000,
      priceElasticityOfDemand: -1.5,
      elasticityModel: 'LINEAR',
      minMarginFloorPercent: 20.0,
      markupSteps: [0.30, 0.60, 1.00],
      roundingStrategy: 'CHARM_90',
    })) as ElasticitySimulationOutput;

    expect(output.serviceId).toBe('srv_vk_100');
    expect(output.effectiveCogsWithFxRub).toBe(55.0);
    expect(output.simulations.length).toBe(3);
    expect(output.optimalPricePoint).toBeDefined();
    expect(output.optimalPricePoint.grossMarginPercent).toBeGreaterThanOrEqual(20.0);
  });

  it('executes optimize_supplier_arbitrage tool directly and resolves primary and fallback routes', async () => {
    const client = new GeminiToolClient();
    client.registerEconomicHarnesses();

    const output = (await client.executeToolDirectly('optimize_supplier_arbitrage', {
      targetServiceCategory: 'Telegram Members',
      maxCancellationThreshold: 0.10,
      candidates: [
        {
          providerId: 'prov_fast',
          providerName: 'FastProvider',
          externalServiceId: 'tg_1',
          baseCogsRub: 45.0,
          slaP50Minutes: 8,
          slaP90Minutes: 20,
          cancellationRate: 0.03,
          qualityDropRate: 0.02,
          isActive: true,
          currentUsdBalance: 500,
        },
        {
          providerId: 'prov_cheap_unreliable',
          providerName: 'CheapUnreliable',
          externalServiceId: 'tg_2',
          baseCogsRub: 25.0,
          slaP50Minutes: 60,
          slaP90Minutes: 300,
          cancellationRate: 0.25, // Disqualified
          qualityDropRate: 0.05,
          isActive: true,
          currentUsdBalance: 100,
        },
      ],
    })) as SupplierArbitrageOutput;

    expect(output.category).toBe('Telegram Members');
    expect(output.selectedPrimaryRoute.providerId).toBe('prov_fast');
    expect(output.selectedPrimaryRoute.role).toBe('PRIMARY');
    expect(output.disqualifiedRoutes.length).toBe(1);
    expect(output.disqualifiedRoutes[0].providerId).toBe('prov_cheap_unreliable');
  });

  it('executes evaluate_customer_liability_treasury tool and audits safe owner draw capacity', async () => {
    const client = new GeminiToolClient();
    client.registerEconomicHarnesses();

    const output = (await client.executeToolDirectly('evaluate_customer_liability_treasury', {
      liquidCashBankRub: 500000,
      liquidCashGatewaysRub: 150000,
      providerBalancesUsd: 2000,
      usdToRubExchangeRate: 95.0, // 190,000 RUB -> Total assets = 840,000 RUB
      totalCustomerWithdrawableDepositsRub: 200000,
      totalCustomerBonusBalancesRub: 50000,
      activeUnfulfilledOrdersCostRub: 60000,
      currentQuarterGrossInflowRub: 1000000,
      taxScheme: 'USN_6_INCOME', // 60,000 RUB tax
      gatewayRollingReservePercent: 5, // 7,500 RUB
      minimumWorkingCapitalBufferRub: 100000,
    })) as TreasurySimulationOutput;

    expect(output.totalLiquidAssetsRub).toBe(840000);
    expect(output.totalCustomerEscrowLiabilityRub).toBe(260000);
    expect(output.customerBonusCreditsRub).toBe(50000);
    expect(output.estimatedQuarterlyTaxDueRub).toBe(60000);
    expect(output.safeOwnerDrawCapacityRub).toBeGreaterThan(0);
    expect(output.liquidityHealthStatus).toBe('SOLVENT_GREEN');
    expect(output.accountingCausalityBreakdown.length).toBeGreaterThan(0);
  });

  it('rejects execution of an unregistered tool with descriptive error', async () => {
    const client = new GeminiToolClient();
    await expect(client.executeToolDirectly('non_existent_tool', {})).rejects.toThrow(
      /Tool 'non_existent_tool' is not registered/
    );
  });

  it('validates tool arguments with Zod schema and throws on invalid inputs', async () => {
    const client = new GeminiToolClient();
    client.registerEconomicHarnesses();

    await expect(
      client.executeToolDirectly('simulate_unit_economics', {
        serviceId: 'srv_1',
        // missing required fields
      })
    ).rejects.toThrow();
  });
});
