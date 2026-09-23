import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { db } from '@/lib/db';
import { verifySession } from '@/lib/session';
import { redis } from '@/lib/redis';
import { createProvider, deleteProviderAction } from '../crud';
import { importSelectedServices } from '../import-cherry-pick';
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

// Mock SSRF guard: real DNS resolution is unavailable for test hostnames
vi.mock('@/utils/ssrf-guard', () => ({
  assertSafeUrl: vi.fn().mockResolvedValue(undefined),
}));

// Mock provider instance (live catalog for the import path)
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

/**
 * AUD-09 (4.1) regression matrix:
 * - staff with `providers:edit` manages providers but CANNOT import services (catalog)
 * - staff with `catalog:edit` imports services but CANNOT manage providers
 * - OWNER bypasses everything
 */
describe('RBAC matrix: providers vs catalog sections', () => {
  let ownerUser: any;
  let providersOnlyUser: any;
  let catalogOnlyUser: any;
  let providerA: any;
  let category: any;

  beforeEach(async () => {
    // 1. Clean database tables
    await db.ledgerEntry.deleteMany().catch(() => {});
    await db.payment.deleteMany().catch(() => {});
    await db.order.deleteMany().catch(() => {});
    await db.serviceRoute.deleteMany().catch(() => {});
    await db.routingAuditLog.deleteMany().catch(() => {});
    await db.service.deleteMany().catch(() => {});
    await db.shadowService.deleteMany().catch(() => {});
    await db.category.deleteMany().catch(() => {});
    await db.network.deleteMany().catch(() => {});
    await db.provider.deleteMany().catch(() => {});
    await db.staffPermission.deleteMany().catch(() => {});
    await db.staffRole.deleteMany().catch(() => {});
    await db.user.deleteMany().catch(() => {});

    // 2. System settings
    await db.systemSettings.upsert({
      where: { id: 'global' },
      update: { isTestMode: true, exchangeRateUSD: 100.0 },
      create: { id: 'global', isTestMode: true, exchangeRateUSD: 100.0 },
    });

    // 3. OWNER (bypasses RBAC)
    ownerUser = await db.user.create({
      data: { email: 'owner-rbac@smmplan.local', role: 'OWNER', isActive: true },
    });

    // 4. Staff roles: one permission section each
    const providersRole = await db.staffRole.create({
      data: {
        name: 'RBAC Providers Manager',
        permissions: { create: { section: 'providers', canView: true, canEdit: true } },
      },
    });
    const catalogRole = await db.staffRole.create({
      data: {
        name: 'RBAC Catalog Manager',
        permissions: { create: { section: 'catalog', canView: true, canEdit: true } },
      },
    });

    providersOnlyUser = await db.user.create({
      data: {
        email: 'staff-providers@smmplan.local',
        role: 'MANAGER',
        isActive: true,
        staffRoleId: providersRole.id,
      },
    });

    catalogOnlyUser = await db.user.create({
      data: {
        email: 'staff-catalog@smmplan.local',
        role: 'MANAGER',
        isActive: true,
        staffRoleId: catalogRole.id,
      },
    });

    // 5. Provider + taxonomy + shadow service (import prerequisites)
    providerA = await db.provider.create({
      data: {
        name: 'RBAC Matrix Provider',
        apiUrl: 'http://localhost/api/rbac',
        apiKey: 'key-rbac',
        balanceCurrency: 'USD',
        isActive: true,
      },
    });

    const network = await db.network.create({
      data: { name: 'Telegram', slug: 'telegram' },
    });
    category = await db.category.create({
      data: { name: 'TG Subscribers RBAC', networkId: network.id },
    });

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
        dripfeed: false,
      },
    });

    mockGetServices.mockResolvedValue([
      { service: '101', name: 'Telegram Subscribers Fast', rate: '0.60', min: '10', max: '5000', category: 'Telegram Subscribers' },
    ]);

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('staff with providers:edit can create/delete providers but NOT import services', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: providersOnlyUser.id });

    // Can create a provider
    const createRes = await createProvider({
      name: 'RBAC Created Panel',
      apiUrl: 'https://panel.example.com/api/v2',
      apiKey: 'sk-rbac',
      isActive: false,
      balanceCurrency: 'USD',
    });
    expect(createRes.success).toBe(true);
    const created = await db.provider.findUnique({ where: { name: 'RBAC Created Panel' } });
    expect(created).not.toBeNull();

    // Can delete it back
    const deleteRes = await deleteProviderAction(created!.id);
    expect(deleteRes.success).toBe(true);

    // CANNOT import services (catalog section)
    const importRes = await importSelectedServices(['101'], category.id, 3.0, providerA.id);
    expect(importRes.success).toBe(false);
    expect((importRes as { error: string }).error).toContain('Forbidden');
    expect((importRes as { error: string }).error).toContain('catalog');
  });

  it('staff with catalog:edit can import services but NOT manage providers', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: catalogOnlyUser.id });

    // Can import services
    const importRes = await importSelectedServices(['101'], category.id, 3.0, providerA.id);
    expect(importRes.success).toBe(true);
    expect((importRes as { imported: number }).imported).toBe(1);

    // CANNOT create a provider
    const createRes = await createProvider({
      name: 'RBAC Forbidden Panel',
      apiUrl: 'https://panel.example.com/api/v2',
      apiKey: 'sk-rbac',
      isActive: false,
      balanceCurrency: 'USD',
    });
    expect(createRes.success).toBe(false);
    expect((createRes as { error: string }).error).toContain('Forbidden');
    expect((createRes as { error: string }).error).toContain('providers');

    // CANNOT delete an existing provider
    const deleteRes = await deleteProviderAction(providerA.id);
    expect(deleteRes.success).toBe(false);
    expect((deleteRes as { error: string }).error).toContain('Forbidden');

    // Provider is still there
    const stillExists = await db.provider.findUnique({ where: { id: providerA.id } });
    expect(stillExists).not.toBeNull();
  });

  it('OWNER bypasses both sections', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: ownerUser.id });

    const importRes = await importSelectedServices(['101'], category.id, 3.0, providerA.id);
    expect(importRes.success).toBe(true);

    const createRes = await createProvider({
      name: 'RBAC Owner Panel',
      apiUrl: 'https://panel.example.com/api/v2',
      apiKey: 'sk-rbac',
      isActive: false,
      balanceCurrency: 'USD',
    });
    expect(createRes.success).toBe(true);
  });
});
