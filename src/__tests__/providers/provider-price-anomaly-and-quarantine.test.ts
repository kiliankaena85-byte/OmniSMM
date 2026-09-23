import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { adminCatalogService } from '@/services/admin/catalog.service';
import { providerService } from '@/services/providers/provider.service';

// Mock verifySession to control roles per test
vi.mock('@/lib/session', async (importOriginal: any) => {
  const actual = await importOriginal();
  return {
    ...actual,
    verifySession: vi.fn(),
  };
});

// Mock provider instance
const mockGetServices = vi.fn();
vi.mock('@/services/providers/provider.service', () => ({
  providerService: {
    getProviderInstance: vi.fn().mockImplementation(() => ({
      getServices: mockGetServices,
    })),
    getDefaultProvider: vi.fn().mockImplementation(() => ({
      getServices: mockGetServices,
    })),
    getServicesWithCache: vi.fn().mockImplementation(async (config: any, providerInstance: any) => {
      return providerInstance.getServices();
    }),
  },
}));

vi.mock('@/lib/notifications', () => ({
  sendAdminAlert: vi.fn(),
}));

describe.sequential('Provider Price Anomaly Detector & Active Quarantine Enforcement (Phase 1)', () => {
  let adminUser: { id: string; email: string; role: string };
  let provider: any;
  let network: any;
  let category: any;
  let serviceA: any;
  let serviceB: any;

  beforeEach(async () => {
    adminUser = {
      id: 'admin-anomaly-tester',
      email: 'admin_anomaly@smmplan.pro',
      role: 'SUPERADMIN',
    };

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
      data: { name: `Telegram ${ts}`, slug: `tg-anomaly-${ts}` },
    });

    category = await db.category.create({
      data: { name: `TG Channel Subscribers ${ts}`, networkId: network.id },
    });

    provider = await db.provider.create({
      data: {
        name: `Anomaly Provider ${ts}`,
        apiUrl: `http://localhost/api/sync-${ts}`,
        apiKey: `key-sync-${ts}`,
        balanceCurrency: 'USD',
        isActive: true,
        syncLock: false,
      },
    });

    // Pre-create curated services
    // Service A: USD currency, rate = $1.00 USD/1k (100 RUB/1k cost), markup = 3.0, retail = 300 RUB
    serviceA = await db.service.create({
      data: {
        name: `Telegram Subscribers Real A ${ts}`,
        categoryId: category.id,
        providerId: provider.id,
        providerCurrency: 'USD',
        rate: 1.00,
        costPer1kRub: 100.0,
        markup: 3.0,
        pricePer1000Cents: 30000,
        minQty: 100,
        maxQty: 50000,
        externalId: `ext-tg-100-${ts}`,
        isActive: true,
        isQuarantined: false,
      },
    });

    // Service B: USD currency, rate = 0.50 USD/1k (50 RUB/1k cost), markup = 4.0, retail = 200 RUB
    serviceB = await db.service.create({
      data: {
        name: `Telegram Views Instant B ${ts}`,
        categoryId: category.id,
        providerId: provider.id,
        providerCurrency: 'USD',
        rate: 0.50,
        costPer1kRub: 50.0,
        markup: 4.0,
        pricePer1000Cents: 20000,
        minQty: 100,
        maxQty: 100000,
        externalId: `ext-tg-200-${ts}`,
        isActive: true,
        isQuarantined: false,
      },
    });

    vi.clearAllMocks();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  it('1. Active Quarantine on Price Spike > 50%: automatically takes off storefront and sets quarantineReason in RUB', async () => {
    // Provider raises price from $1.00 to $1.60 (+60% spike)
    mockGetServices.mockResolvedValue([
      { service: serviceA.externalId, name: 'Telegram Subscribers Real', rate: '1.60', min: '100', max: '50000', category: 'Subscribers' },
      { service: serviceB.externalId, name: 'Telegram Views Instant', rate: '0.50', min: '100', max: '100000', category: 'Views' },
    ]);

    const res = await adminCatalogService.syncProviderCatalog(provider.id, adminUser);
    expect(res.priceAnomalies).toBe(1);

    const updatedServiceA = await db.service.findUniqueOrThrow({ where: { id: serviceA.id } });
    expect(updatedServiceA.isActive).toBe(false);
    expect(updatedServiceA.isQuarantined).toBe(true);
    expect(updatedServiceA.pendingRate).toBe(1.60);
    expect(updatedServiceA.quarantinedAt).toBeInstanceOf(Date);
    // Verified quarantine reason uses ruble cost format and real currency
    expect(updatedServiceA.quarantineReason).toContain('Price Spike (+60%)');
    expect(updatedServiceA.quarantineReason).toContain('100.00 ₽ до 160.00 ₽/1k');
    expect(updatedServiceA.quarantineReason).toContain('1 USD → 1.6 USD');
  });

  it('2. Active Quarantine on UPPER_SANITY_LIMIT_RUB breach (> 500,000 ₽/1k)', async () => {
    // Provider returns an insane rate of $6000/1k = 600,000 RUB/1k (exceeding UPPER_SANITY_LIMIT_RUB of 500,000 ₽)
    mockGetServices.mockResolvedValue([
      { service: serviceA.externalId, name: 'Telegram Subscribers Real', rate: '6000.00', min: '100', max: '50000', category: 'Subscribers' },
      { service: serviceB.externalId, name: 'Telegram Views Instant', rate: '0.50', min: '100', max: '100000', category: 'Views' },
    ]);

    const res = await adminCatalogService.syncProviderCatalog(provider.id, adminUser);
    expect(res.priceAnomalies).toBe(1);

    const updatedServiceA = await db.service.findUniqueOrThrow({ where: { id: serviceA.id } });
    expect(updatedServiceA.isActive).toBe(false);
    expect(updatedServiceA.isQuarantined).toBe(true);
    expect(updatedServiceA.quarantineReason).toContain('Upper Sanity Limit Exceeded');
    expect(updatedServiceA.quarantineReason).toContain('6000 USD');
    expect(updatedServiceA.quarantineReason).toMatch(/(570000|600000)\.00 ₽\/1k/);
  });

  it('3. Currency Flip Resilience (USD -> RUB): does NOT trigger false price spike when normalized cost in RUB is unchanged', async () => {
    // Provider switches balanceCurrency from USD to RUB.
    // Service A was $1.00 USD (100.00 ₽). Provider now returns 102.00 RUB (+2% change in rubles).
    await db.provider.update({
      where: { id: provider.id },
      data: { balanceCurrency: 'RUB' },
    });

    mockGetServices.mockResolvedValue([
      { service: serviceA.externalId, name: 'Telegram Subscribers Real', rate: '102.00', min: '100', max: '50000', category: 'Subscribers' },
      { service: serviceB.externalId, name: 'Telegram Views Instant', rate: '51.00', min: '100', max: '100000', category: 'Views' },
    ]);

    const res = await adminCatalogService.syncProviderCatalog(provider.id, adminUser);
    // Should NOT be flagged as price anomaly because 100 ₽ -> 102 ₽ is only +2%
    expect(res.priceAnomalies).toBe(0);
    expect(res.priceUpdatedSilent).toBe(2);

    const updatedServiceA = await db.service.findUniqueOrThrow({ where: { id: serviceA.id } });
    expect(updatedServiceA.isQuarantined).toBe(false);
    expect(updatedServiceA.isActive).toBe(true);
    expect(updatedServiceA.providerCurrency).toBe('RUB');
    expect(updatedServiceA.rate).toBe(102.00);
  });

  it('4. Currency Flip Spike Detection (RUB -> USD): correctly detects real +80% spike in RUB when currency switches', async () => {
    // Service B was 50.00 RUB/1k.
    // Provider is in USD. Provider returns $0.90 USD/1k = 90.00 RUB/1k (+80% jump from 50 ₽ to 90 ₽).
    mockGetServices.mockResolvedValue([
      { service: serviceA.externalId, name: 'Telegram Subscribers Real', rate: '1.00', min: '100', max: '50000', category: 'Subscribers' },
      { service: serviceB.externalId, name: 'Telegram Views Instant', rate: '0.90', min: '100', max: '100000', category: 'Views' },
    ]);

    const res = await adminCatalogService.syncProviderCatalog(provider.id, adminUser);
    expect(res.priceAnomalies).toBe(1); // Service B quarantined for real ruble spike

    const updatedServiceB = await db.service.findUniqueOrThrow({ where: { id: serviceB.id } });
    expect(updatedServiceB.isQuarantined).toBe(true);
    expect(updatedServiceB.isActive).toBe(false);
    expect(updatedServiceB.pendingRate).toBe(0.90);
    expect(updatedServiceB.quarantineReason).toContain('Price Spike (+80%)');
    expect(updatedServiceB.quarantineReason).toContain('50.00 ₽ до 90.00 ₽/1k');
  });

  it('5. detectAnomalies() Enforcement: automatically isolates services with price anomalies in DB', async () => {
    const oldRates = new Map<string, number | { rate: number; currency?: string; costRub?: number }>([
      [serviceA.id, { rate: 1.00, currency: 'USD', costRub: 100.00 }],
      [serviceB.id, { rate: 50.00, currency: 'RUB', costRub: 50.00 }],
    ]);

    // Service A spikes +70% (100 ₽ -> 170 ₽)
    // Service B drops -10% (50 ₽ -> 45 ₽, normal drift)
    const newRates = new Map<string, number | { rate: number; currency?: string; costRub?: number }>([
      [serviceA.id, { rate: 1.70, currency: 'USD', costRub: 170.00 }],
      [serviceB.id, { rate: 45.00, currency: 'RUB', costRub: 45.00 }],
    ]);

    const anomalyMessages = await adminCatalogService.detectAnomalies(oldRates, newRates);
    expect(anomalyMessages.length).toBeGreaterThan(0);
    expect(anomalyMessages[0]).toContain('100.00 ₽');
    expect(anomalyMessages[0]).toContain('170.00 ₽');

    // Service A must be in quarantine in DB!
    const dbServiceA = await db.service.findUniqueOrThrow({ where: { id: serviceA.id } });
    expect(dbServiceA.isQuarantined).toBe(true);
    expect(dbServiceA.isActive).toBe(false);
    expect(dbServiceA.quarantineReason).toContain('Price Spike (+70%)');
    expect(dbServiceA.quarantineReason).toContain('100.00 ₽ до 170.00 ₽/1k');

    // Service B must NOT be in quarantine
    const dbServiceB = await db.service.findUniqueOrThrow({ where: { id: serviceB.id } });
    expect(dbServiceB.isQuarantined).toBe(false);
  });
});
