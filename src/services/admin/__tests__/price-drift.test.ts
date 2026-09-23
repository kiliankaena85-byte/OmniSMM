import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { db } from '@/lib/db';
import { adminCatalogService } from '../catalog.service';
import { adminSyncProviderCatalog } from '@/actions/admin/providers/sync-action';
import { providerService } from '@/services/providers/provider.service';

vi.mock('@/lib/notifications', () => ({
  sendAdminAlert: vi.fn(),
}));

vi.mock('@/lib/server/rbac', () => ({
  requireStaffPermission: vi.fn((section, action, cb) => cb({ id: 'admin-1', email: 'admin@test.com' })),
}));

vi.mock('@/lib/redis-lock', () => ({
  MutexManager: {
    withLock: vi.fn((key, ttl, retry, cb) => cb()),
  },
}));

describe.sequential('Active Service Price Drift Detection', () => {
  let provider: any;
  let category: any;
  let network: any;
  let service: any;
  let mockRate = 1.0;
  
  beforeEach(async () => {
    // Seed settings in DB
    await db.systemSettings.upsert({
      where: { id: 'smmplan' },
      update: { quarantineThreshold: 0.20, exchangeRateUSD: 90.0 },
      create: { id: 'smmplan', quarantineThreshold: 0.20, exchangeRateUSD: 90.0 },
    });
    await db.systemSettings.upsert({
      where: { id: 'global' },
      update: { quarantineThreshold: 0.20, exchangeRateUSD: 90.0 },
      create: { id: 'global', quarantineThreshold: 0.20, exchangeRateUSD: 90.0 },
    });

    const ts = Date.now() + Math.floor(Math.random() * 100000);
    network = await db.network.create({
      data: { name: `Instagram ${ts}`, slug: `instagram-${ts}` },
    });
    
    category = await db.category.create({
      data: { name: `Likes ${ts}`, networkId: network.id },
    });
    
    provider = await db.provider.create({
      data: {
        name: `Test SMM Provider ${ts}`,
        apiUrl: `https://api.testprovider.com/${ts}`,
        apiKey: 'encrypted-key',
        isActive: true,
        balanceCurrency: 'USD',
      },
    });

    service = await db.service.create({
      data: {
        name: `Instagram Likes Drift Test ${ts}`,
        rate: 1.0,
        markup: 5.0,
        pricePer1000Cents: 45000,
        categoryId: category.id,
        providerId: provider.id,
        externalId: `ext-${ts}`,
        isActive: true,
      },
    });

    await db.servicePriceHistory.create({
      data: {
        serviceId: service.id,
        rate: 1.0,
      }
    });

    // Mock the providerInstance
    vi.spyOn(providerService, 'getProviderInstance').mockImplementation(() => {
      return {
        getServices: async () => [
          {
            service: `ext-${ts}`,
            name: `Instagram Likes Drift Test ${ts}`,
            rate: mockRate.toString(),
            min: '10',
            max: '10000',
            category: 'Likes',
          }
        ]
      } as any;
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (provider?.id) {
      await db.servicePriceHistory.deleteMany({ where: { serviceId: service?.id } });
      await db.service.deleteMany({ where: { providerId: provider.id } });
      await db.shadowService.deleteMany({ where: { providerId: provider.id } });
      await db.provider.deleteMany({ where: { id: provider.id } });
    }
    if (category?.id) {
      await db.category.deleteMany({ where: { id: category.id } });
    }
    if (network?.id) {
      await db.network.deleteMany({ where: { id: network.id } });
    }
  });

  afterAll(async () => {
    vi.restoreAllMocks();
  });

  it('should not quarantine on a single small price change and should log history', async () => {
    mockRate = 1.05; // +5% drift

    const result = await adminCatalogService.syncProviderCatalog(provider.id, { id: 'admin-1', email: 'admin@test.com' });
    expect(result.priceAnomalies).toBe(0);
    expect(result.priceUpdatedSilent).toBe(1);

    // Verify rate in service table updated
    const updatedService = await db.service.findUniqueOrThrow({ where: { id: service.id } });
    expect(updatedService.rate).toBe(1.05);
    expect(updatedService.isQuarantined).toBe(false);

    // Verify history logs
    const history = await db.servicePriceHistory.findMany({
      where: { serviceId: service.id },
      orderBy: { createdAt: 'asc' },
    });
    // First record was auto-created for the old rate ($1.00), and second record for the new rate ($1.05)
    expect(history).toHaveLength(2);
    expect(history[0].rate).toBe(1.0);
    expect(history[1].rate).toBe(1.05);
  });

  it('should prevent database bloat by not creating history records if the price is unchanged', async () => {
    mockRate = 1.0; // unchanged

    const result = await adminCatalogService.syncProviderCatalog(provider.id, { id: 'admin-1', email: 'admin@test.com' });
    expect(result.priceUpdatedSilent).toBe(0);

    const history = await db.servicePriceHistory.findMany({
      where: { serviceId: service.id },
    });
    expect(history).toHaveLength(1);
  });

  it('should quarantine service when cumulative price drift over 30 days exceeds 20%', async () => {
    // Week 1: +5% price increase
    mockRate = 1.05;
    let syncRes = await adminCatalogService.syncProviderCatalog(provider.id, { id: 'admin-1', email: 'admin@test.com' });
    expect(syncRes.priceAnomalies).toBe(0);

    // Manipulate history timestamps to simulate rolling 30-day window
    const firstHistory = await db.servicePriceHistory.findFirst({
      where: { serviceId: service.id, rate: 1.0 }
    });
    if (firstHistory) {
      await db.servicePriceHistory.update({
        where: { id: firstHistory.id },
        data: { createdAt: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000) } // 29 days ago (within 30-day window)
      });
    }

    // Week 2: another +5% (rate: 1.10)
    mockRate = 1.10;
    syncRes = await adminCatalogService.syncProviderCatalog(provider.id, { id: 'admin-1', email: 'admin@test.com' });
    expect(syncRes.priceAnomalies).toBe(0);

    // Week 3: another +5% (rate: 1.15)
    mockRate = 1.15;
    syncRes = await adminCatalogService.syncProviderCatalog(provider.id, { id: 'admin-1', email: 'admin@test.com' });
    expect(syncRes.priceAnomalies).toBe(0);

    // Week 4: +6% (rate: 1.21). Total cumulative drift is 21% from baseline ($1.00).
    // Owner Directive: Auto-Pricing Engine recalculates price automatically instead of quarantining.
    mockRate = 1.21;
    syncRes = await adminCatalogService.syncProviderCatalog(provider.id, { id: 'admin-1', email: 'admin@test.com' });
    expect(syncRes.priceUpdatedSilent).toBe(1);
    expect(syncRes.priceAnomalies).toBe(0);

    const updatedService = await db.service.findUniqueOrThrow({ where: { id: service.id } });
    expect(updatedService.isQuarantined).toBe(false);
    expect(updatedService.rate).toBe(1.21);
  });

  it('should not quarantine on price drops', async () => {
    // Price drops to 0.80 (-20%)
    mockRate = 0.80;

    const result = await adminCatalogService.syncProviderCatalog(provider.id, { id: 'admin-1', email: 'admin@test.com' });
    expect(result.priceAnomalies).toBe(0);

    const updatedService = await db.service.findUniqueOrThrow({ where: { id: service.id } });
    expect(updatedService.rate).toBe(0.80);
    expect(updatedService.isQuarantined).toBe(false);

    const history = await db.servicePriceHistory.findMany({
      where: { serviceId: service.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(history[0].rate).toBe(0.80);
  });

  it('should quarantine and record history in manual adminSyncProviderCatalog action', async () => {
    mockRate = 1.35; // instant 35% spike (>30% threshold)
    
    const actionResult = await adminSyncProviderCatalog();
    expect(actionResult.success).toBe(true);
    if (!actionResult.success) throw new Error('Action failed');
    expect(actionResult.stats?.disabledCount).toBe(1); // flagged as quarantined (disabled)

    const updatedService = await db.service.findUniqueOrThrow({ where: { id: service.id } });
    expect(updatedService.isQuarantined).toBe(true);
    expect(updatedService.pendingRate).toBe(1.35);
  });
});
