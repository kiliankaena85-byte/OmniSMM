import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { adminCatalogService } from '@/services/admin/catalog.service';
import { createServiceAction, updateServiceAction } from '../services';
import { verifySession } from '@/lib/session';

// Mock headers and cookies for staff permission check
const mockCookieStore = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
const mockHeadersStore = new Headers({ 'x-forwarded-for': '127.0.0.1', 'user-agent': 'vitest' });

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => mockHeadersStore),
  cookies: vi.fn(async () => mockCookieStore),
}));

vi.mock('@/lib/session', async (importOriginal: any) => {
  const actual = await importOriginal();
  return {
    ...actual,
    verifySession: vi.fn(),
  };
});

describe('Multi-Tenant Catalog Administration (P0)', () => {
  let adminUser: any;
  let category: any;

  beforeEach(async () => {
    await db.systemSettings.upsert({
      where: { id: 'global' },
      update: { isTestMode: true, exchangeRateUSD: 100.0 },
      create: { id: 'global', isTestMode: true, exchangeRateUSD: 100.0 },
    });

    adminUser = await db.user.create({
      data: {
        email: `admin_mt_${Date.now()}@smmplan.local`,
        role: 'OWNER',
        isActive: true,
      },
    });

    const network = await db.network.create({
      data: { name: 'Telegram MultiTenant', slug: `tg-mt-${Date.now()}`, tenantId: 'smmplan' }
    });

    category = await db.category.create({
      data: { name: 'Подписчики MT', networkId: network.id, tenantId: 'smmplan' }
    });

    vi.clearAllMocks();
    vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. listServices filters strictly by tenantId', async () => {
    await db.service.createMany({
      data: [
        { tenantId: 'smmplan', slug: `mt-svc-1-${Date.now()}`, name: 'SMMplan Service 1', categoryId: category.id, rate: 10, markup: 2.0, pricePer1000Cents: 2000, minQty: 10, maxQty: 1000 },
        { tenantId: 'smmplan', slug: `mt-svc-2-${Date.now()}`, name: 'SMMplan Service 2', categoryId: category.id, rate: 10, markup: 2.0, pricePer1000Cents: 2000, minQty: 10, maxQty: 1000 },
        { tenantId: 'flux', slug: `mt-svc-3-${Date.now()}`, name: 'Flux Service 1', categoryId: category.id, rate: 15, markup: 2.5, pricePer1000Cents: 3750, minQty: 10, maxQty: 1000 },
      ]
    });

    const smmplanList = await adminCatalogService.listServices({ tenantId: 'smmplan', pageSize: 50 });
    const fluxList = await adminCatalogService.listServices({ tenantId: 'flux', pageSize: 50 });

    const smmplanIds = smmplanList.items.map((s: any) => s.tenantId);
    const fluxIds = fluxList.items.map((s: any) => s.tenantId);

    expect(smmplanIds.every((t: string) => t === 'smmplan')).toBe(true);
    expect(fluxIds.every((t: string) => t === 'flux')).toBe(true);
  });

  it('2. createServiceAction assigns specified tenantId and marks Category/Network as tenantId="all"', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });

    const createPayload = {
      tenantId: 'flux',
      name: `Flux Custom Service ${Date.now()}`,
      categoryId: category.id,
      rate: 5.0,
      markup: 2.0,
      minQty: 10,
      maxQty: 5000,
    };

    const res = await createServiceAction(createPayload);
    expect(res.success).toBe(true);
    if (!res.success) return;

    const created = await db.service.findUnique({ where: { id: res.serviceId } });
    expect(created?.tenantId).toBe('flux');

    // Taxonomy check: Category & Network must be updated to 'all'
    const updatedCategory = await db.category.findUnique({
      where: { id: category.id },
      include: { network: true }
    });
    expect(updatedCategory?.tenantId).toBe('all');
    expect(updatedCategory?.network?.tenantId).toBe('all');
  });

  it('3. updateServiceAction locks tenantId from being mutated', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });

    const original = await db.service.create({
      data: {
        tenantId: 'smmplan',
        slug: `original-tenant-slug-${Date.now()}`,
        name: 'Original SMMplan Service',
        categoryId: category.id,
        rate: 10,
        markup: 2.0,
        pricePer1000Cents: 2000,
        minQty: 10,
        maxQty: 1000
      }
    });

    // Try passing tenantId: 'flux' in edit payload
    const editPayload = {
      tenantId: 'flux',
      name: 'Renamed SMMplan Service',
      categoryId: category.id,
      rate: 12,
      markup: 2.0,
      minQty: 10,
      maxQty: 1000
    };

    const res = await updateServiceAction(original.id, editPayload);
    expect(res.success).toBe(true);

    const updated = await db.service.findUnique({ where: { id: original.id } });
    expect(updated?.name).toBe('Renamed SMMplan Service');
    expect(updated?.tenantId).toBe('smmplan'); // locked!
  });

  it('4. bulkUpdateMarkup with tenantId filter affects only the targeted tenant', async () => {
    const slugSuffix = Date.now();
    const smmplanSvc = await db.service.create({
      data: { tenantId: 'smmplan', slug: `bulk-mt-1-${slugSuffix}`, name: 'SMMplan Bulk Target', categoryId: category.id, rate: 10, markup: 2.0, pricePer1000Cents: 2000, minQty: 10, maxQty: 1000 }
    });
    const fluxSvc = await db.service.create({
      data: { tenantId: 'flux', slug: `bulk-mt-2-${slugSuffix}`, name: 'Flux Bulk Target', categoryId: category.id, rate: 10, markup: 2.0, pricePer1000Cents: 2000, minQty: 10, maxQty: 1000 }
    });

    await adminCatalogService.bulkUpdateMarkup(
      { tenantId: 'flux', categoryId: category.id },
      3.0,
      { id: adminUser.id, email: adminUser.email }
    );

    const updatedSmmplan = await db.service.findUnique({ where: { id: smmplanSvc.id } });
    const updatedFlux = await db.service.findUnique({ where: { id: fluxSvc.id } });

    expect(updatedSmmplan?.markup).toBe(2.0); // unchanged
    expect(updatedFlux?.markup).toBe(3.0); // updated
  });

  it('5. getCatalogHealthCounts reports quarantine / zombies / cooldown per tenant (AUD-14)', async () => {
    const slugSuffix = Date.now();
    const future = new Date(Date.now() + 60 * 60 * 1000);

    await db.service.createMany({
      data: [
        // smmplan: one quarantined, one zombie, one on cooldown
        { tenantId: 'smmplan', slug: `health-q-${slugSuffix}`, name: 'SMM Quarantined', categoryId: category.id, rate: 10, markup: 2.0, pricePer1000Cents: 2000, minQty: 10, maxQty: 1000, isQuarantined: true, isActive: true },
        { tenantId: 'smmplan', slug: `health-z-${slugSuffix}`, name: 'SMM Zombie', categoryId: category.id, rate: 10, markup: 2.0, pricePer1000Cents: 2000, minQty: 10, maxQty: 1000, isActive: false, cooldownReason: 'ZOMBIE_AUTO_DISABLED' },
        { tenantId: 'smmplan', slug: `health-c-${slugSuffix}`, name: 'SMM Cooldown', categoryId: category.id, rate: 10, markup: 2.0, pricePer1000Cents: 2000, minQty: 10, maxQty: 1000, isActive: true, cooldownUntil: future, cooldownReason: 'API_ERROR' },
        // flux: one zombie (must NOT leak into smmplan counts)
        { tenantId: 'flux', slug: `health-zf-${slugSuffix}`, name: 'Flux Zombie', categoryId: category.id, rate: 10, markup: 2.0, pricePer1000Cents: 2000, minQty: 10, maxQty: 1000, isActive: false, cooldownReason: 'ZOMBIE_ARCHIVED' },
      ]
    });

    try {
      const smmplanHealth = await adminCatalogService.getCatalogHealthCounts('smmplan');
      expect(smmplanHealth.quarantine).toBe(1);
      expect(smmplanHealth.zombies).toBe(1);          // flux zombie NOT counted
      expect(smmplanHealth.cooldown).toBe(1);         // zombie is not on cooldown

      // Tenant isolation: flux sees only its own zombie
      const fluxHealth = await adminCatalogService.getCatalogHealthCounts('flux');
      expect(fluxHealth.zombies).toBe(1);
      expect(fluxHealth.quarantine).toBe(0);
      expect(fluxHealth.cooldown).toBe(0);
    } finally {
      await db.service.deleteMany({ where: { slug: { in: [`health-q-${slugSuffix}`, `health-z-${slugSuffix}`, `health-c-${slugSuffix}`, `health-zf-${slugSuffix}`] } } });
    }
  });
});
