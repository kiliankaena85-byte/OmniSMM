import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { db } from '@/lib/db';
import { verifySession } from '@/lib/session';
import { redis } from '@/lib/redis';
import { fetchPaginatedExternalServices, fetchExternalServices, importSelectedServices } from '../import-cherry-pick';
import { providerService } from '@/services/providers/provider.service';

// Mock cookies and headers
const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

const mockHeadersStore = new Headers({
  'x-forwarded-for': '127.0.0.1',
  'user-agent': 'vitest',
});

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => mockHeadersStore),
  cookies: vi.fn(async () => mockCookieStore),
}));

// Mock verifySession to control roles per test
vi.mock('@/lib/session', async (importOriginal: any) => {
  const actual = await importOriginal();
  return {
    ...actual,
    verifySession: vi.fn(),
  };
});

// Mock redis
vi.mock('@/lib/redis', () => {
  const mockPipeline = {
    del: vi.fn().mockReturnThis(),
    hset: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  };
  return {
    redis: {
      get: vi.fn(),
      set: vi.fn(),
      setex: vi.fn(),
      hget: vi.fn(),
      hmget: vi.fn(),
      pipeline: vi.fn(() => mockPipeline),
    }
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

describe('Cherry-Pick Service Import & Shadow Catalog Tests', () => {
  let adminUser: any;
  let regularUser: any;
  let providerA: any;
  let providerB: any;
  let category: any;

  beforeEach(async () => {
    // 1. Clean database tables
    await db.ledgerEntry.deleteMany().catch(() => {});
    await db.payment.deleteMany().catch(() => {});
    await db.order.deleteMany().catch(() => {});
    await db.serviceRoute.deleteMany().catch(() => {});
    await db.routingAuditLog.deleteMany().catch(() => {});
    await db.service.deleteMany().catch(() => {});
    await db.category.deleteMany().catch(() => {});
    await db.network.deleteMany().catch(() => {});
    await db.provider.deleteMany().catch(() => {});
    await db.user.deleteMany().catch(() => {});

    // 2. Setup systemSettings with exchange rates
    await db.systemSettings.upsert({
      where: { id: 'global' },
      update: { isTestMode: true, exchangeRateUSD: 100.0 },
      create: { id: 'global', isTestMode: true, exchangeRateUSD: 100.0 },
    });

    // 3. Create Admin and Regular User
    adminUser = await db.user.create({
      data: {
        email: 'admin_import@smmplan.local',
        role: 'OWNER',
        isActive: true,
      },
    });

    regularUser = await db.user.create({
      data: {
        email: 'user_import@smmplan.local',
        role: 'USER',
        isActive: true,
      },
    });

    // 4. Create providers
    providerA = await db.provider.create({
      data: {
        name: 'Import Provider USD',
        apiUrl: 'http://localhost/api/import_usd',
        apiKey: 'key-usd',
        balanceCurrency: 'USD',
        isActive: true
      }
    });

    providerB = await db.provider.create({
      data: {
        name: 'Import Provider RUB',
        apiUrl: 'http://localhost/api/import_rub',
        apiKey: 'key-rub',
        balanceCurrency: 'RUB',
        isActive: true
      }
    });

    // 5. Create social network and category
    const network = await db.network.create({
      data: { name: 'Telegram', slug: 'telegram' }
    });

    category = await db.category.create({
      data: { name: 'TG Subscribers', networkId: network.id }
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fail with Forbidden error if queried by a regular user', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: regularUser.id });

    const result = await fetchPaginatedExternalServices(providerA.id, {}, 1, 10);
    const failureResult = result as { success: false; error: string };
    expect(failureResult.success).toBe(false);
    expect(failureResult.error).toContain('Forbidden: Administrator/Staff context required');
  });

  it('should successfully sync and fetch external services from provider and cache them in shadow catalog', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });

    // Simulate provider returning 2 external services
    mockGetServices.mockResolvedValue([
      { service: '101', name: 'Telegram Subscribers Fast', rate: '0.50', min: '10', max: '5000', category: 'Telegram Subscribers' },
      { service: '102', name: 'Instagram Likes HQ', rate: '0.15', min: '50', max: '2000', category: 'Instagram Likes' }
    ]);

    const result = await fetchExternalServices(providerA.id, true);
    const successResult = result as { success: true; count: number; source: string };
    expect(successResult.success).toBe(true);
    expect(successResult.count).toBe(2);
    expect(successResult.source).toBe('api');

    // Verify DB entries
    const shadowServices = await db.shadowService.findMany({
      where: { providerId: providerA.id }
    });
    expect(shadowServices.length).toBe(2);
    expect(shadowServices.find(s => s.externalId === '101')).toBeDefined();
    expect(shadowServices.find(s => s.externalId === '102')).toBeDefined();
  });

  it('should filter, paginate, sort, and convert currencies correctly in paginated external shadow services', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });

    // Seed DB with shadow services (with AI normalization metrics already set)
    await db.shadowService.createMany({
      data: [
        {
          providerId: providerA.id,
          externalId: '101',
          name: 'Telegram Subscribers Fast',
          type: 'default',
          category: 'Telegram Subscribers',
          rate: 0.50,
          rateRub: 50.0,
          min: 10,
          max: 5000,
          cleanName: 'Subscribers Fast',
          platform: 'telegram',
          normalizedCategory: 'SUBSCRIBERS',
          targetType: 'CHANNEL',
          anomalyScore: 0.1,
          refill: false,
          cancel: false,
          dripfeed: false
        },
        {
          providerId: providerA.id,
          externalId: '102',
          name: 'Instagram Likes HQ',
          type: 'default',
          category: 'Instagram Likes',
          rate: 0.15,
          rateRub: 15.0,
          min: 50,
          max: 2000,
          cleanName: 'Likes HQ',
          platform: 'instagram',
          normalizedCategory: 'LIKES',
          targetType: 'POST',
          anomalyScore: 0.0,
          refill: false,
          cancel: false,
          dripfeed: false
        }
      ]
    });

    // Page 1, Size 10
    const result = await fetchPaginatedExternalServices(providerA.id, { sortBy: 'price_asc' }, 1, 10);
    expect(result.success).toBe(true);
    const paginated = result as { success: true; data: any[]; platformCounts: any };
    expect(paginated.data.length).toBe(2);

    const item102 = paginated.data.find(x => x.service === '102');
    const item101 = paginated.data.find(x => x.service === '101');

    // USD to RUB conversion: USD 0.15 * 100 = 15.0 RUB per 1k procurement
    expect(item102.rateRub).toBe(15.0);
    expect(item102.pricePerUnitProcurementRub).toBe(0.015); // 15.0 / 1000

    // platformCounts should be mapped correctly
    expect(paginated.platformCounts.telegram).toBe(1);
    expect(paginated.platformCounts.instagram).toBe(1);
  });

  it('should successfully cherry-pick import services with auto-pricing and safety floor controls, preventing cache poisoning', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });

    // Seed DB with shadow service
    await db.shadowService.create({
      data: {
        providerId: providerA.id,
        externalId: '101',
        name: 'Telegram Subscribers Fast',
        type: 'default',
        category: 'Telegram Subscribers',
        rate: 0.50,
        rateRub: 50.0,
        min: 10,
        max: 5000,
        cleanName: 'Subscribers Fast',
        platform: 'telegram',
        normalizedCategory: 'SUBSCRIBERS',
        targetType: 'CHANNEL',
        anomalyScore: 0.1,
        refill: false,
        cancel: false,
        dripfeed: false
      }
    });

    // Live check api mock - return live prices to ensure no cache poisoning occurs
    mockGetServices.mockResolvedValue([
      { service: '101', name: 'Telegram Subscribers Fast', rate: '0.60', min: '10', max: '5000', category: 'Telegram Subscribers' } // Price spiked from 0.50 to 0.60!
    ]);

    // Import service 101 with default markup 3.0
    const importRes = await importSelectedServices(['101'], category.id, 3.0, providerA.id);
    const successImport = importRes as { success: true; imported: number };
    expect(successImport.success).toBe(true);
    expect(successImport.imported).toBe(1);

    // Verify DB entry
    const importedService = await db.service.findFirst({
      where: { providerId: providerA.id, externalId: '101' }
    });

    expect(importedService).toBeDefined();
    expect(importedService?.name).toBe('Subscribers Fast'); // Using the cached clean name
    expect(importedService?.rate).toBe(0.60); // Using the live check rate (0.60), NOT the cached one (0.50)! Prevents Cache Poisoning!
    expect(importedService?.markup).toBe(3.0);
    
    // Price per 1k in cents: 0.60 USD * 3.0 markup * 100 exchange rate = 180.00 RUB -> 18000 cents
    expect(importedService?.pricePer1000Cents).toBe(18000);
    expect(importedService?.targetType).toBe('CHANNEL'); // Normalized from smart analyzer metrics!
  });

  it('should support partial ID searching in shadow services', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });

    // Seed DB with shadow services
    await db.shadowService.createMany({
      data: [
        {
          providerId: providerA.id,
          externalId: '101',
          name: 'Telegram Subscribers Fast',
          type: 'default',
          category: 'Telegram Subscribers',
          rate: 0.50,
          rateRub: 50.0,
          min: 10,
          max: 5000,
          cleanName: 'Subscribers Fast',
          platform: 'telegram',
          normalizedCategory: 'SUBSCRIBERS',
          targetType: 'CHANNEL',
          anomalyScore: 0.1,
          refill: false,
          cancel: false,
          dripfeed: false
        },
        {
          providerId: providerA.id,
          externalId: '202',
          name: 'Instagram Likes HQ',
          type: 'default',
          category: 'Instagram Likes',
          rate: 0.15,
          rateRub: 15.0,
          min: 50,
          max: 2000,
          cleanName: 'Likes HQ',
          platform: 'instagram',
          normalizedCategory: 'LIKES',
          targetType: 'POST',
          anomalyScore: 0.0,
          refill: false,
          cancel: false,
          dripfeed: false
        }
      ]
    });

    // Search for partial ID '10' -> matches '101'
    const result1 = await fetchPaginatedExternalServices(providerA.id, { search: '10' }, 1, 10);
    expect(result1.success).toBe(true);
    const paginated1 = result1 as { success: true; data: any[] };
    expect(paginated1.data.length).toBe(1);
    expect(paginated1.data[0].service).toBe('101');

    // Search for common digit '2' -> matches '202'
    const result2 = await fetchPaginatedExternalServices(providerA.id, { search: '2' }, 1, 10);
    expect(result2.success).toBe(true);
    const paginated2 = result2 as { success: true; data: any[] };
    expect(paginated2.data.length).toBe(1);
    expect(paginated2.data[0].service).toBe('202');
  });

  it('should return a transparency report: skip reasons, slug dedup and safety floor (AUD-04/13)', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });

    // Shadow: 101 (valid), 103 (duplicate clean name of 101 -> slug collision), 102 (broken live rate)
    await db.shadowService.createMany({
      data: [
        {
          providerId: providerA.id,
          externalId: '101',
          name: 'Telegram Subscribers Fast',
          type: 'default',
          category: 'Telegram Subscribers',
          rate: 0.50,
          rateRub: 50.0,
          min: 10,
          max: 5000,
          cleanName: 'Subscribers Fast',
          platform: 'telegram',
          normalizedCategory: 'SUBSCRIBERS',
          targetType: 'CHANNEL',
          anomalyScore: 0.1,
          refill: false,
          cancel: false,
          dripfeed: false
        },
        {
          providerId: providerA.id,
          externalId: '103',
          name: 'Telegram Subscribers Fast v2',
          type: 'default',
          category: 'Telegram Subscribers',
          rate: 0.55,
          rateRub: 55.0,
          min: 10,
          max: 5000,
          cleanName: 'Subscribers Fast', // same clean name -> slug collision with 101
          platform: 'telegram',
          normalizedCategory: 'SUBSCRIBERS',
          targetType: 'CHANNEL',
          anomalyScore: 0.1,
          refill: false,
          cancel: false,
          dripfeed: false
        },
        {
          providerId: providerA.id,
          externalId: '102',
          name: 'Instagram Likes HQ',
          type: 'default',
          category: 'Instagram Likes',
          rate: 0.15,
          rateRub: 15.0,
          min: 50,
          max: 2000,
          cleanName: 'Likes HQ',
          platform: 'instagram',
          normalizedCategory: 'LIKES',
          targetType: 'POST',
          anomalyScore: 0.0,
          refill: false,
          cancel: false,
          dripfeed: false
        }
      ]
    });

    // Live: 101 OK, 103 OK (same name, different extId), 102 has invalid rate, 999 requested but absent everywhere
    mockGetServices.mockResolvedValue([
      { service: '101', name: 'Telegram Subscribers Fast', rate: '0.60', min: '10', max: '5000', category: 'Telegram Subscribers' },
      { service: '103', name: 'Telegram Subscribers Fast v2', rate: '0.65', min: '10', max: '5000', category: 'Telegram Subscribers' },
      { service: '102', name: 'Instagram Likes HQ', rate: '0', min: '50', max: '2000', category: 'Instagram Likes' } // invalid rate!
    ]);

    // Markup 1.5 (150%) is below the safety floor -> must be raised to 3.0 with an adjustment entry
    const importRes = await importSelectedServices(['101', '103', '102', '999'], category.id, 1.5, providerA.id);
    const res = importRes as { success: true; imported: number; report: any };

    expect(res.success).toBe(true);
    expect(res.imported).toBe(2); // 101 + 103 imported; 102 invalid rate; 999 not in shadow

    // AUD-04: transparency report is present and accurate
    expect(res.report.usedLivePrices).toBe(true);
    expect(res.report.skipped.length).toBe(2);
    expect(res.report.skipped.find((s: any) => s.externalId === '102')?.reason).toBe('INVALID_RATE');
    expect(res.report.skipped.find((s: any) => s.externalId === '999')?.reason).toBe('NOT_IN_SHADOW_CATALOG');

    // AUD-13: safety floor adjustment is reported, not silent
    expect(res.report.markupAdjustments.length).toBe(2);
    expect(res.report.markupAdjustments[0]).toMatchObject({ requestedMarkup: 1.5, appliedMarkup: 3.0 });

    // AUD-04 (2.2): slug dedup — two services with the same clean name BOTH exist with distinct slugs
    const services = await db.service.findMany({
      where: { providerId: providerA.id },
      select: { externalId: true, slug: true, markup: true }
    });
    expect(services.length).toBe(2); // no silent skipDuplicates drop
    const slugs = services.map(s => s.slug);
    expect(new Set(slugs).size).toBe(2);
    expect(services.every(s => s.markup === 3.0)).toBe(true); // bumped to safety floor
  });

  it('should report ALREADY_EXISTS when re-importing the same service (AUD-04)', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });

    await db.shadowService.create({
      data: {
        providerId: providerA.id,
        externalId: '101',
        name: 'Telegram Subscribers Fast',
        type: 'default',
        category: 'Telegram Subscribers',
        rate: 0.50,
        rateRub: 50.0,
        min: 10,
        max: 5000,
        cleanName: 'Subscribers Fast',
        platform: 'telegram',
        normalizedCategory: 'SUBSCRIBERS',
        targetType: 'CHANNEL',
        anomalyScore: 0.1,
        refill: false,
        cancel: false,
        dripfeed: false
      }
    });

    mockGetServices.mockResolvedValue([
      { service: '101', name: 'Telegram Subscribers Fast', rate: '0.60', min: '10', max: '5000', category: 'Telegram Subscribers' }
    ]);

    const first = await importSelectedServices(['101'], category.id, 3.0, providerA.id);
    expect((first as { success: true; imported: number }).imported).toBe(1);

    // Re-import the same service -> skipped with an explicit reason instead of a silent "success 0"
    const second = await importSelectedServices(['101'], category.id, 3.0, providerA.id);
    const secondRes = second as { success: true; imported: number; report: any };
    expect(secondRes.imported).toBe(0);
    expect(secondRes.report.skipped.length).toBe(1);
    expect(secondRes.report.skipped[0]).toMatchObject({ externalId: '101', reason: 'ALREADY_EXISTS' });
  });

  it('should fall back to the fresh shadow catalog when the provider API is unavailable (AUD-11)', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });

    await db.shadowService.create({
      data: {
        providerId: providerA.id,
        externalId: '101',
        name: 'Telegram Subscribers Fast',
        type: 'default',
        category: 'Telegram Subscribers',
        rate: 0.50,
        rateRub: 50.0,
        min: 10,
        max: 5000,
        cleanName: 'Subscribers Fast',
        platform: 'telegram',
        normalizedCategory: 'SUBSCRIBERS',
        targetType: 'CHANNEL',
        anomalyScore: 0.1,
        refill: false,
        cancel: false,
        dripfeed: false
      }
    });

    // Provider API is down
    mockGetServices.mockRejectedValue(new Error('ECONNREFUSED network down'));

    const importRes = await importSelectedServices(['101'], category.id, 3.0, providerA.id);
    const res = importRes as { success: true; imported: number; report: any };

    expect(res.success).toBe(true);
    expect(res.imported).toBe(1);

    // AUD-11: fallback is reported instead of failing the import
    expect(res.report.usedLivePrices).toBe(false);
    expect(res.report.shadowCatalogAgeHours).not.toBeNull();
    expect(res.report.shadowCatalogAgeHours).toBeLessThan(1);
    expect(res.report.warnings.some((w: string) => w.includes('теневого каталога'))).toBe(true);

    // Imported with the SHADOW rate (0.50), since no live rate is available
    const importedService = await db.service.findFirst({
      where: { providerId: providerA.id, externalId: '101' }
    });
    expect(importedService?.rate).toBe(0.50);
  });

  it('keeps the old shadow catalog intact when the sync transaction fails (AUD-11)', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });

    // Old catalog: 2 valid rows
    await db.shadowService.createMany({
      data: [
        {
          providerId: providerA.id,
          externalId: '101',
          name: 'Telegram Subscribers Fast',
          type: 'default',
          category: 'Telegram Subscribers',
          rate: 0.50,
          rateRub: 50.0,
          min: 10,
          max: 5000,
          cleanName: 'Subscribers Fast',
          platform: 'telegram',
          normalizedCategory: 'SUBSCRIBERS',
          targetType: 'CHANNEL',
          anomalyScore: 0.1,
          refill: false,
          cancel: false,
          dripfeed: false
        },
        {
          providerId: providerA.id,
          externalId: '102',
          name: 'Instagram Likes HQ',
          type: 'default',
          category: 'Instagram Likes',
          rate: 0.15,
          rateRub: 15.0,
          min: 50,
          max: 2000,
          cleanName: 'Likes HQ',
          platform: 'instagram',
          normalizedCategory: 'LIKES',
          targetType: 'POST',
          anomalyScore: 0.0,
          refill: false,
          cancel: false,
          dripfeed: false
        }
      ]
    });

    // Fresh catalog from the API contains a row that overflows the Int column
    // (min: 99999999999 > int4 max) -> the INSERT inside the transaction fails
    mockGetServices.mockResolvedValue([
      { service: '101', name: 'Telegram Subscribers Fast', rate: '0.60', min: '99999999999', max: '5000', category: 'Telegram Subscribers' }
    ]);

    const result = await fetchExternalServices(providerA.id, true);
    expect(result.success).toBe(false); // sync failed

    // AUD-11 (4.3): atomicity — the transaction rolled back and the OLD
    // catalog survived intact (no half-synced state, shrink-guard not tripped)
    const shadowRows = await db.shadowService.findMany({
      where: { providerId: providerA.id },
      select: { externalId: true }
    });
    expect(shadowRows.length).toBe(2);
    expect(shadowRows.map(r => r.externalId).sort()).toEqual(['101', '102']);
  });
});
