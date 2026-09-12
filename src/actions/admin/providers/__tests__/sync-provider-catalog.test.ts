import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { db } from '@/lib/db';
import { adminCatalogService } from '@/services/admin/catalog.service';
import { providerService } from '@/services/providers/provider.service';
import { SettingsProvider } from '@/lib/settings';

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
      getServices: mockGetServices
    })),
    getDefaultProvider: vi.fn().mockImplementation(() => ({
      getServices: mockGetServices
    })),
    getServicesWithCache: vi.fn().mockImplementation(async (config: any, providerInstance: any) => {
      return providerInstance.getServices();
    })
  }
}));

describe.sequential('Zombie Eraser & Pricing Auto-recalculation / Quarantine Tests', () => {
  let adminUser: any;
  let provider: any;
  let category: any;
  let serviceA: any;
  let serviceB: any;

  beforeEach(async () => {
    // 1. Ensure tenant exists
    await db.tenant.upsert({
      where: { id: 'smmplan' },
      update: {},
      create: { id: 'smmplan', name: 'SMMplan', slug: 'smmplan', domain: 'smmplan.local', vaultSalt: 'test-salt' },
    });

    // 2. Setup systemSettings with exchange rates
    await db.systemSettings.upsert({
      where: { id: 'smmplan' },
      update: { isTestMode: true, exchangeRateUSD: 100.0 },
      create: { id: 'smmplan', isTestMode: true, exchangeRateUSD: 100.0 },
    });

    // 3. Create Admin
    adminUser = {
      id: 'admin-id',
      email: 'admin_sync@smmplan.local',
      role: 'SUPERADMIN',
    };

    const ts = Date.now() + Math.floor(Math.random() * 100000);

    // 4. Create provider
    provider = await db.provider.create({
      data: {
        name: `Sync Test Provider ${ts}`,
        apiUrl: `http://localhost/api/sync-${ts}`,
        apiKey: `key-sync-${ts}`,
        balanceCurrency: 'USD',
        isActive: true,
        syncLock: false
      }
    });

    // 5. Create social network and category with unique slug
    const network = await db.network.create({
      data: { name: `Telegram ${ts}`, slug: `tg-sync-${ts}` }
    });

    category = await db.category.create({
      data: { name: `TG Views ${ts}`, networkId: network.id }
    });

    // 6. Pre-create active services
    // Service A: rate = 0.50 USD/1k, markup = 6.0 (x6), retail price = 300 RUB
    serviceA = await db.service.create({
      data: {
        name: `TG Views Fast ${ts}`,
        categoryId: category.id,
        providerId: provider.id,
        rate: 0.50,
        markup: 6.0,
        pricePer1000Cents: 30000, // 0.5 * 6 * 100 * 100
        minQty: 10,
        maxQty: 10000,
        externalId: 'ext-303',
        isActive: true
      }
    });

    // Service B: rate = 1.00 USD/1k, markup = 1.2 (very low markup), retail price = 120 RUB
    serviceB = await db.service.create({
      data: {
        name: `TG Views High Quality ${ts}`,
        categoryId: category.id,
        providerId: provider.id,
        rate: 1.00,
        markup: 1.2,
        pricePer1000Cents: 12000, // 1 * 1.2 * 100 * 100
        minQty: 10,
        maxQty: 10000,
        externalId: 'ext-404',
        isActive: true
      }
    });

    vi.clearAllMocks();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    // Cleanup all test-created DB records to prevent ghost data in catalog
    try {
      if (provider?.id) {
        await db.service.deleteMany({ where: { providerId: provider.id } }).catch(() => {});
      }
      if (serviceA?.id) await db.service.deleteMany({ where: { id: serviceA.id } }).catch(() => {});
      if (serviceB?.id) await db.service.deleteMany({ where: { id: serviceB.id } }).catch(() => {});
      await db.service.deleteMany({ where: { category: { network: { slug: { startsWith: 'tg-sync-' } } } } }).catch(() => {});
      if (category?.id) await db.category.deleteMany({ where: { id: category.id } }).catch(() => {});
      await db.category.deleteMany({ where: { network: { slug: { startsWith: 'tg-sync-' } } } }).catch(() => {});
      if (provider?.id) {
        await db.network.deleteMany({ where: { slug: { startsWith: 'tg-sync-' } } }).catch(() => {});
        await db.provider.deleteMany({ where: { id: provider.id } }).catch(() => {});
      }
    } catch { /* ignore cleanup errors */ }
  });

  it('should mark services deleted by the provider as inactive (Zombie Eraser)', async () => {
    // Provider catalog does NOT contain ext-303 (Service A is now a Zombie!)
    // But does contain ext-404
    mockGetServices.mockResolvedValue([
      { service: 'ext-404', name: 'TG Views High Quality', rate: '1.00', min: '10', max: '10000', category: 'TG Views' }
    ]);

    const res = await adminCatalogService.syncProviderCatalog(provider.id, adminUser);
    expect(res.zombiesDisabled).toBe(1);
    expect(res.resurrected).toBe(0);

    // Verify Service A (Zombie) is deactivated in DB
    const serviceADb = await db.service.findUnique({ where: { id: serviceA.id } });
    expect(serviceADb?.isActive).toBe(false);
    expect(serviceADb?.cooldownReason).toBe('ZOMBIE_AUTO_DISABLED');

    // Service B should remain active
    const serviceBDb = await db.service.findUnique({ where: { id: serviceB.id } });
    expect(serviceBDb?.isActive).toBe(true);
  });

  it('should preserve curator markup (markup = 1.2) during routine sync and NOT force jump to 3.0', async () => {
    // Provider catalog contains ext-404 with price unchanged $1.00
    // With rate = $1.00, markup = 1.2, retail price should remain 120 RUB (12000 cents)
    // and markup should remain 1.2 (NOT overridden to 3.0 or 5.0)
    mockGetServices.mockResolvedValue([
      { service: 'ext-303', name: 'TG Views Fast', rate: '0.50', min: '10', max: '10000', category: 'TG Views' },
      { service: 'ext-404', name: 'TG Views High Quality', rate: '1.00', min: '10', max: '10000', category: 'TG Views' }
    ]);

    const res = await adminCatalogService.syncProviderCatalog(provider.id, adminUser);
    expect(res.marginFloorBreaches).toBe(0);
    expect(res.priceAnomalies).toBe(0);

    // Service B should remain active with original curator markup 1.2
    const serviceBDb = await db.service.findUnique({ where: { id: serviceB.id } });
    expect(serviceBDb?.isActive).toBe(true);
    expect(serviceBDb?.isQuarantined).toBe(false);
    expect(serviceBDb?.markup).toBe(1.2);
    expect(serviceBDb?.pricePer1000Cents).toBe(12000);
  });

  it('should apply adaptive pricing ladder when service.markup is 0', async () => {
    // Set Service A markup to 0 (auto-pricing)
    await db.service.update({
      where: { id: serviceA.id },
      data: { markup: 0, pricePer1000Cents: 0 }
    });

    // Provider rate = $0.50 -> cost in RUB = 50.0 RUB (by 100 USD/RUB)
    // Pricing ladder for 50 RUB: multiplier 6 -> retail = 50 * 6 * 1.035 = 310.5 -> rounded to 320 RUB (32000 cents)
    mockGetServices.mockResolvedValue([
      { service: 'ext-303', name: 'TG Views Fast', rate: '0.50', min: '10', max: '10000', category: 'TG Views' },
      { service: 'ext-404', name: 'TG Views High Quality', rate: '1.00', min: '10', max: '10000', category: 'TG Views' }
    ]);

    await adminCatalogService.syncProviderCatalog(provider.id, adminUser);

    const serviceADb = await db.service.findUnique({ where: { id: serviceA.id } });
    expect(serviceADb?.isActive).toBe(true);
    expect(serviceADb?.markup).toBeGreaterThan(5.0);
    expect(serviceADb?.pricePer1000Cents).toBe(32000);
  });

  it('should detect a price spike anomaly (>20% increase) and quarantine the service safely', async () => {
    // Provider catalog contains ext-303, but price hiked from $0.50 to $0.65 (+30% increase)
    mockGetServices.mockResolvedValue([
      { service: 'ext-303', name: 'TG Views Fast', rate: '0.65', min: '10', max: '10000', category: 'TG Views' },
      { service: 'ext-404', name: 'TG Views High Quality', rate: '1.00', min: '10', max: '10000', category: 'TG Views' }
    ]);

    const res = await adminCatalogService.syncProviderCatalog(provider.id, adminUser);
    expect(res.priceAnomalies).toBe(1);

    // Service A should be quarantined for price spike!
    const serviceADb = await db.service.findUnique({ where: { id: serviceA.id } });
    expect(serviceADb?.isQuarantined).toBe(true);
    expect(serviceADb?.quarantineReason).toContain('Price Spike');
    expect(serviceADb?.pendingRate).toBe(0.65);
  });

  it('should safely auto-update pricing silently if price drift is minor and positive', async () => {
    // Provider catalog contains ext-303, price drift is minor: $0.50 to $0.53 (+6% increase, below 20% anomaly threshold)
    mockGetServices.mockResolvedValue([
      { service: 'ext-303', name: 'TG Views Fast', rate: '0.53', min: '10', max: '10000', category: 'TG Views' },
      { service: 'ext-404', name: 'TG Views High Quality', rate: '1.00', min: '10', max: '10000', category: 'TG Views' }
    ]);

    const res = await adminCatalogService.syncProviderCatalog(provider.id, adminUser);
    expect(res.priceUpdatedSilent).toBe(1);

    // Service A price should be silently updated: rate = 0.53, retail price: 0.53 * 6.0 * 100 = 318 -> beautiful rounding to 320 RUB -> 32000 cents
    const serviceADb = await db.service.findUnique({ where: { id: serviceA.id } });
    expect(serviceADb?.rate).toBe(0.53);
    expect(serviceADb?.pricePer1000Cents).toBe(32000);
    expect(serviceADb?.isQuarantined).toBe(false);
  });

  it('should preserve providerCurrency = RUB and calculate prices without USD multiplication', async () => {
    // Update provider and service to RUB
    await db.provider.update({
      where: { id: provider.id },
      data: { balanceCurrency: 'RUB' }
    });
    await db.service.update({
      where: { id: serviceA.id },
      data: { providerCurrency: 'RUB', rate: 10.0, markup: 2.0, pricePer1000Cents: 2000 }
    });

    mockGetServices.mockResolvedValue([
      { service: 'ext-303', name: 'TG Views Fast', rate: '10.50', min: '10', max: '10000', category: 'TG Views' },
      { service: 'ext-404', name: 'TG Views High Quality', rate: '1.00', min: '10', max: '10000', category: 'TG Views' }
    ]);

    const res = await adminCatalogService.syncProviderCatalog(provider.id, adminUser);
    expect(res.priceUpdatedSilent).toBeGreaterThanOrEqual(1);

    const serviceADb = await db.service.findUnique({ where: { id: serviceA.id } });
    expect(serviceADb?.providerCurrency).toBe('RUB');
    expect(serviceADb?.rate).toBe(10.50);
    // 10.50 * 2.0 * 1.0 = 21.0 RUB -> beautiful rounded to 30 RUB -> 3000 cents (NOT 210000 cents from 100x USD conversion)
    expect(serviceADb?.pricePer1000Cents).toBe(3000);
    expect(serviceADb?.markup).toBe(2.0);
  });
});
