import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { adminCatalogService } from '@/services/admin/catalog.service';
import { checkoutAction } from '@/actions/order/checkout';

const mockGetServices = vi.fn();
vi.mock('@/services/providers/provider.service', () => ({
  providerService: {
    getProviderInstance: vi.fn().mockImplementation(() => ({
      getServices: mockGetServices,
      getBalance: vi.fn().mockResolvedValue({ balance: 10000, currency: 'RUB' }),
      order: vi.fn().mockResolvedValue({ order: '12345' }),
      status: vi.fn().mockResolvedValue({ status: 'Completed', remains: 0 }),
    })),
  },
}));

let currentMockUser: { id: string; email: string } | null = null;
vi.mock('@/lib/session', () => ({
  verifySession: vi.fn().mockImplementation(async () => currentMockUser),
}));

describe('E2E Pricing Time-Travel & Multi-Currency Stability Test Suite (Day 0 → Day 90)', () => {
  let adminUser: { id: string; email: string; role: 'SUPERADMIN' };
  let network: any;
  let category: any;
  let providerA: any; // RUB provider (e.g. Vexboost)
  let providerB: any; // USD provider (e.g. SMMKings)
  let serviceRu: any; // RU Service (1.50 RUB/1k)
  let serviceUsd: any; // USD Service ($1.00 USD/1k)

  beforeEach(async () => {
    adminUser = {
      id: 'admin-timetravel-tester',
      email: 'timetravel@smmplan.pro',
      role: 'SUPERADMIN',
    };

    // Initialize System Settings with exchange rate = 100.0 RUB/USD
    await db.systemSettings.upsert({
      where: { id: 'smmplan' },
      update: { isTestMode: true, exchangeRateUSD: 100.0, quarantineThreshold: 0.50 },
      create: { id: 'smmplan', isTestMode: true, exchangeRateUSD: 100.0, quarantineThreshold: 0.50 },
    });
    await db.systemSettings.upsert({
      where: { id: 'global' },
      update: { isTestMode: true, exchangeRateUSD: 100.0, quarantineThreshold: 0.50 },
      create: { id: 'global', isTestMode: true, exchangeRateUSD: 100.0, quarantineThreshold: 0.50 },
    });

    const ts = Date.now() + Math.floor(Math.random() * 1000000);

    network = await db.network.create({
      data: { name: `Telegram TT ${ts}`, slug: `tg-tt-${ts}` },
    });

    category = await db.category.create({
      data: { name: `Telegram Views TT ${ts}`, networkId: network.id },
    });

    // Provider A: Native RUB Provider
    providerA = await db.provider.create({
      data: {
        name: `Vexboost RU Provider ${ts}`,
        apiUrl: `http://localhost/api/prov-ru-${ts}`,
        apiKey: `key-ru-${ts}`,
        balanceCurrency: 'RUB',
        isActive: true,
        syncLock: false,
      },
    });

    // Provider B: Global USD Provider
    providerB = await db.provider.create({
      data: {
        name: `Global USD Provider ${ts}`,
        apiUrl: `http://localhost/api/prov-usd-${ts}`,
        apiKey: `key-usd-${ts}`,
        balanceCurrency: 'USD',
        isActive: true,
        syncLock: false,
      },
    });

    // Pre-create Service RU (Rate: 1.50 RUB/1k, cost: 1.50 RUB, ladder markup x11 -> 16.5 RUB -> rounded 20 RUB = 2000 cents)
    serviceRu = await db.service.create({
      data: {
        name: `Telegram Fast Views RU ${ts}`,
        categoryId: category.id,
        providerId: providerA.id,
        providerCurrency: 'RUB',
        rate: 1.50,
        costPer1kRub: 1.50,
        markup: 11.0,
        pricePer1000Cents: 2000,
        minQty: 100,
        maxQty: 100000,
        externalId: `ext-ru-101-${ts}`,
        isActive: true,
        isQuarantined: false,
      },
    });

    // Pre-create Service USD (Rate: $1.00 USD/1k, cost: 100.0 RUB, curated markup x2.5 -> 250 RUB = 25000 cents)
    serviceUsd = await db.service.create({
      data: {
        name: `Telegram HQ Subscribers USD ${ts}`,
        categoryId: category.id,
        providerId: providerB.id,
        providerCurrency: 'USD',
        rate: 1.00,
        costPer1kRub: 100.0,
        markup: 2.5,
        pricePer1000Cents: 25000,
        minQty: 100,
        maxQty: 50000,
        externalId: `ext-usd-201-${ts}`,
        isActive: true,
        isQuarantined: false,
      },
    });

    vi.clearAllMocks();
  });

  afterEach(async () => {
    currentMockUser = null;
    vi.restoreAllMocks();
  });

  it('Day 0 (Baseline Verification): Initial imports preserve distinct currencies and correct price per 1k', async () => {
    const sRu = await db.service.findUniqueOrThrow({ where: { id: serviceRu.id } });
    const sUsd = await db.service.findUniqueOrThrow({ where: { id: serviceUsd.id } });

    expect(sRu.providerCurrency).toBe('RUB');
    expect(sRu.rate).toBe(1.50);
    expect(sRu.costPer1kRub).toBe(1.50);
    expect(sRu.pricePer1000Cents).toBe(2000); // 20.00 RUB/1k

    expect(sUsd.providerCurrency).toBe('USD');
    expect(sUsd.rate).toBe(1.00);
    expect(sUsd.costPer1kRub).toBe(100.0);
    expect(sUsd.pricePer1000Cents).toBe(25000); // 250.00 RUB/1k
  });

  it('Day 1 (Routine Sync 24h Later): Currencies stay frozen and curated markup does NOT jump silently', async () => {
    // 24 hours later: routine cron runs syncProviderCatalog
    mockGetServices.mockResolvedValue([
      { service: serviceRu.externalId, name: 'Telegram Fast Views RU', rate: '1.50', min: '100', max: '100000', category: 'Views' },
    ]);

    const resRu = await adminCatalogService.syncProviderCatalog(providerA.id, adminUser);
    expect(resRu.priceAnomalies).toBe(0);
    expect(resRu.zombiesDisabled).toBe(0);

    const sRuAfter = await db.service.findUniqueOrThrow({ where: { id: serviceRu.id } });
    expect(sRuAfter.providerCurrency).toBe('RUB'); // Currency remains strictly RUB
    expect(sRuAfter.rate).toBe(1.50);
    expect(sRuAfter.markup).toBe(11.0); // Preserves ladder markup
    expect(sRuAfter.pricePer1000Cents).toBe(2000); // Retail unchanged (NOT 15000 or 150000!)
    expect(sRuAfter.isQuarantined).toBe(false);

    // Sync USD Provider
    mockGetServices.mockResolvedValue([
      { service: serviceUsd.externalId, name: 'Telegram HQ Subscribers USD', rate: '1.00', min: '100', max: '50000', category: 'Subscribers' },
    ]);

    const resUsd = await adminCatalogService.syncProviderCatalog(providerB.id, adminUser);
    expect(resUsd.priceAnomalies).toBe(0);

    const sUsdAfter = await db.service.findUniqueOrThrow({ where: { id: serviceUsd.id } });
    expect(sUsdAfter.providerCurrency).toBe('USD');
    expect(sUsdAfter.markup).toBe(2.5); // Curated 2.5 markup PRESERVED (did NOT force jump to 3.0!)
    expect(sUsdAfter.pricePer1000Cents).toBe(25000);
    expect(sUsdAfter.isQuarantined).toBe(false);
  });

  it('Day 7 (Minor Fluctuations & Exchange Rate Shifts): Prices update silently without false quarantine or 100x bug', async () => {
    // 7 days later: Exchange rate shifts from 100.0 to 102.0
    await db.systemSettings.update({
      where: { id: 'smmplan' },
      data: { exchangeRateUSD: 102.0 },
    });

    // Provider A slightly raises rate by +2% (1.50 -> 1.53 RUB)
    mockGetServices.mockResolvedValue([
      { service: serviceRu.externalId, name: 'Telegram Fast Views RU', rate: '1.53', min: '100', max: '100000', category: 'Views' },
    ]);

    const resRu = await adminCatalogService.syncProviderCatalog(providerA.id, adminUser);
    expect(resRu.priceAnomalies).toBe(0); // Minor drift, no quarantine
    expect(resRu.priceUpdatedSilent).toBe(1);

    const sRuDay7 = await db.service.findUniqueOrThrow({ where: { id: serviceRu.id } });
    expect(sRuDay7.providerCurrency).toBe('RUB');
    expect(sRuDay7.rate).toBe(1.53);
    // 1.53 * 11.0 = 16.83 -> rounded 20.00 RUB = 2000 cents
    expect(sRuDay7.pricePer1000Cents).toBe(2000);
    expect(sRuDay7.isQuarantined).toBe(false);

    // Provider B slightly lowers rate by -2% ($1.00 -> $0.98 USD)
    mockGetServices.mockResolvedValue([
      { service: serviceUsd.externalId, name: 'Telegram HQ Subscribers USD', rate: '0.98', min: '100', max: '50000', category: 'Subscribers' },
    ]);

    const resUsd = await adminCatalogService.syncProviderCatalog(providerB.id, adminUser);
    expect(resUsd.priceAnomalies).toBe(0);
    expect(resUsd.priceUpdatedSilent).toBe(1);

    const sUsdDay7 = await db.service.findUniqueOrThrow({ where: { id: serviceUsd.id } });
    expect(sUsdDay7.providerCurrency).toBe('USD');
    expect(sUsdDay7.rate).toBe(0.98);
    // Cost in RUB: 0.98 * 102.0 = 99.96 RUB -> 99.96 * 2.5 = 249.9 -> beautiful rounded to 250 RUB = 25000 cents
    expect(sUsdDay7.pricePer1000Cents).toBe(25000);
    expect(sUsdDay7.isQuarantined).toBe(false);
  });

  it('Day 30 (Currency Flip Chaos & Active Quarantine Enforcement): Resilient to harmless flips, isolates real spikes', async () => {
    // Scenario 4A: Harmless Currency Flip
    // USD Provider switches balance to RUB and returns 102.00 RUB for serviceUsd ($1.00 USD = 102.00 RUB)
    await db.provider.update({
      where: { id: providerB.id },
      data: { balanceCurrency: 'RUB' },
    });

    mockGetServices.mockResolvedValue([
      { service: serviceUsd.externalId, name: 'Telegram HQ Subscribers USD', rate: '102.00', min: '100', max: '50000', category: 'Subscribers' },
    ]);

    const resFlip = await adminCatalogService.syncProviderCatalog(providerB.id, adminUser);
    expect(resFlip.priceAnomalies).toBe(0); // 0 anomalies because cost in RUB is stable!

    const sUsdFlipped = await db.service.findUniqueOrThrow({ where: { id: serviceUsd.id } });
    expect(sUsdFlipped.providerCurrency).toBe('RUB');
    expect(sUsdFlipped.rate).toBe(102.00);
    expect(sUsdFlipped.isQuarantined).toBe(false);

    // Scenario 4B: Real Dangerous Price Spike (> 50%)
    // Provider A raises price from 1.50 RUB to 3.00 RUB (+100% spike)
    mockGetServices.mockResolvedValue([
      { service: serviceRu.externalId, name: 'Telegram Fast Views RU', rate: '3.00', min: '100', max: '100000', category: 'Views' },
    ]);

    const resSpike = await adminCatalogService.syncProviderCatalog(providerA.id, adminUser);
    expect(resSpike.priceAnomalies).toBe(1); // Active Quarantine triggers!

    const sRuSpiked = await db.service.findUniqueOrThrow({ where: { id: serviceRu.id } });
    expect(sRuSpiked.isQuarantined).toBe(true);
    expect(sRuSpiked.isActive).toBe(false); // Taken off storefront!
    expect(sRuSpiked.quarantineReason).toContain('Price Spike');
    expect(sRuSpiked.quarantineReason).toContain('3.00 ₽/1k');

    // Scenario 4C: UPPER_SANITY_LIMIT_RUB Breach (> 500,000 ₽)
    mockGetServices.mockResolvedValue([
      { service: serviceUsd.externalId, name: 'Telegram HQ Subscribers USD', rate: '600000.00', min: '100', max: '50000', category: 'Subscribers' },
    ]);

    const resInsane = await adminCatalogService.syncProviderCatalog(providerB.id, adminUser);
    expect(resInsane.priceAnomalies).toBe(1);

    const sUsdInsane = await db.service.findUniqueOrThrow({ where: { id: serviceUsd.id } });
    expect(sUsdInsane.isQuarantined).toBe(true);
    expect(sUsdInsane.isActive).toBe(false);
    expect(sUsdInsane.quarantineReason).toContain('Upper Sanity Limit Exceeded');
  });

  it('Day 90 (End-to-End Storefront Checkout Smoke Invariant): Clean checkout calculation without negative margins', async () => {
    // Create a fresh clean service for Storefront checkout
    const checkoutService = await db.service.create({
      data: {
        name: 'Telegram Storefront Checkout Service',
        categoryId: category.id,
        providerId: providerA.id,
        providerCurrency: 'RUB',
        rate: 2.00,
        costPer1kRub: 2.00,
        markup: 11.0,
        pricePer1000Cents: 3000, // 30.00 RUB/1k
        minQty: 100,
        maxQty: 10000,
        externalId: `ext-checkout-${Date.now()}`,
        isActive: true,
        isQuarantined: false,
      },
    });

    const mockUser = await db.user.create({
      data: {
        email: `client-tt-${Date.now()}@example.com`,
        balance: BigInt(50000), // 500.00 RUB in kopecks
        tenantId: 'smmplan',
      },
    });

    // Client orders 1,000 views (Cost: 30.00 RUB = 3000 kopecks)
    const checkoutResult = await checkoutAction({
      serviceId: checkoutService.id,
      quantity: 1000,
      link: 'https://t.me/smmplan_channel/123',
      gateway: 'yookassa',
      email: mockUser.email,
      tenantId: 'smmplan',
    });

    // Verified checkout success
    expect(checkoutResult.success).toBe(true);
    if (!checkoutResult.success) {
      throw new Error(`Checkout failed: ${checkoutResult.error}`);
    }
    expect(checkoutResult.data.orderId).toBeDefined();

    const createdOrder = await db.order.findUniqueOrThrow({
      where: { id: checkoutResult.data.orderId },
    });

    // Charge must be exactly 3000 kopecks (30.00 RUB)
    expect(createdOrder.charge).toBe(BigInt(3000));
    expect(createdOrder.status).toBe('AWAITING_PAYMENT');
  });
});
