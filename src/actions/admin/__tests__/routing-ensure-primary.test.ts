import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { verifySession } from '@/lib/session';
import { ensurePrimaryRouteAction } from '@/actions/admin/routing.actions';

// Mock headers and cookies
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

// Mock verifySession
vi.mock('@/lib/session', async (importOriginal: any) => {
  const actual = await importOriginal();
  return {
    ...actual,
    verifySession: vi.fn(),
  };
});

describe('Routing ensurePrimaryRouteAction (Stage C ADM-14)', () => {
  let adminUser: any;
  let supportUser: any;
  let provider: any;
  let network: any;
  let category: any;

  beforeEach(async () => {
    // 1. Clean DB
    await db.routingAuditLog.deleteMany().catch(() => {});
    await db.serviceRoute.deleteMany().catch(() => {});
    await db.order.deleteMany().catch(() => {});
    await db.service.deleteMany().catch(() => {});
    await db.category.deleteMany().catch(() => {});
    await db.network.deleteMany().catch(() => {});
    await db.provider.deleteMany().catch(() => {});
    await db.session.deleteMany().catch(() => {});
    await db.auditLog.deleteMany().catch(() => {});
    await db.user.deleteMany().catch(() => {});
    await db.staffPermission.deleteMany().catch(() => {});
    await db.staffRole.deleteMany().catch(() => {});

    const suffix = `${Date.now()}_${Math.floor(Math.random() * 1000000)}`;

    // 2. Roles
    const catalogRole = await db.staffRole.create({
      data: {
        name: `CatalogAdmin_${suffix}`,
        isSystem: true,
        permissions: {
          create: [{ section: 'catalog', canView: true, canEdit: true }]
        }
      }
    });

    const supportRole = await db.staffRole.create({
      data: {
        name: `Support_${suffix}`,
        isSystem: true,
        permissions: {
          create: [{ section: 'tickets', canView: true, canEdit: true }]
        }
      }
    });

    // 3. Users
    adminUser = await db.user.create({
      data: {
        email: `admin_${suffix}@test.com`,
        passwordHash: 'hashed_pw',
        role: 'ADMIN',
        staffRoleId: catalogRole.id,
        balance: BigInt(0),
      }
    });

    supportUser = await db.user.create({
      data: {
        email: `support_${suffix}@test.com`,
        passwordHash: 'hashed_pw',
        role: 'SUPPORT',
        staffRoleId: supportRole.id,
        balance: BigInt(0),
      }
    });

    // 4. Base Domain Data
    provider = await db.provider.create({
      data: {
        name: `Test Provider ${suffix}`,
        apiUrl: 'https://api.example.com',
        apiKey: 'secret_key',
        providerType: 'SMM_PANEL',
        isActive: true,
      }
    });

    network = await db.network.create({
      data: {
        name: `Telegram_${suffix}`,
        slug: `tg_${suffix}`,
      }
    });

    category = await db.category.create({
      data: {
        name: `Members_${suffix}`,
        slug: `members_${suffix}`,
        networkId: network.id,
      }
    });
  });

  it('creates primary route when none exists and provider info is present', async () => {
    (verifySession as any).mockResolvedValue({ userId: adminUser.id, role: adminUser.role });

    const service = await db.service.create({
      data: {
        name: 'TG Subscribers Hot-Swap Test',
        categoryId: category.id,
        providerId: provider.id,
        externalId: 'ext_9988',
        rate: 1.5,
        minQty: 10,
        maxQty: 10000,
        isActive: true,
      }
    });

    const res = await ensurePrimaryRouteAction(service.id);

    expect(res.success).toBe(true);
    if (!res.success) throw new Error('ensurePrimaryRouteAction failed');
    expect(res.created).toBe(true);
    expect(res.routeId).toBeDefined();

    // Verify DB
    const route = await db.serviceRoute.findUnique({
      where: { id: res.routeId }
    });
    expect(route).toBeDefined();
    expect(route?.isPrimary).toBe(true);
    expect(route?.providerId).toBe(provider.id);
    expect(route?.providerServiceId).toBe('ext_9988');
  });

  it('does not create a duplicate route if one already exists (idempotent)', async () => {
    (verifySession as any).mockResolvedValue({ userId: adminUser.id, role: adminUser.role });

    const service = await db.service.create({
      data: {
        name: 'TG Subscribers Existing Route Test',
        categoryId: category.id,
        providerId: provider.id,
        externalId: 'ext_1122',
        rate: 1.5,
        minQty: 10,
        maxQty: 10000,
        isActive: true,
      }
    });

    const existingRoute = await db.serviceRoute.create({
      data: {
        serviceId: service.id,
        providerId: provider.id,
        providerServiceId: 'ext_1122',
        isPrimary: true,
        isActive: true,
        priority: 0,
      }
    });

    const res = await ensurePrimaryRouteAction(service.id);

    expect(res.success).toBe(true);
    if (!res.success) throw new Error('ensurePrimaryRouteAction failed');
    expect(res.created).toBe(false);
    expect(res.routeId).toBe(existingRoute.id);

    const totalRoutes = await db.serviceRoute.count({ where: { serviceId: service.id } });
    expect(totalRoutes).toBe(1);
  });

  it('returns error when service has no providerId or externalId', async () => {
    (verifySession as any).mockResolvedValue({ userId: adminUser.id, role: adminUser.role });

    const service = await db.service.create({
      data: {
        name: 'Manual Service No Provider',
        categoryId: category.id,
        rate: 2.0,
        minQty: 10,
        maxQty: 1000,
        isActive: true,
      }
    });

    const res = await ensurePrimaryRouteAction(service.id);

    expect(res.success).toBe(false);
    if (res.success) throw new Error('Should have failed');
    expect(res.error).toContain('не задан провайдер или внешний ID');
  });

  it('blocks non-catalog staff from ensuring primary route', async () => {
    (verifySession as any).mockResolvedValue({ userId: supportUser.id, role: supportUser.role });

    const service = await db.service.create({
      data: {
        name: 'Protected Service',
        categoryId: category.id,
        providerId: provider.id,
        externalId: 'ext_777',
        rate: 1.0,
        minQty: 10,
        maxQty: 1000,
        isActive: true,
      }
    });

    const res = await ensurePrimaryRouteAction(service.id);

    expect(res.success).toBe(false);
    if (res.success) throw new Error('Should have failed');
    expect(res.error).toBeDefined();
  });
});
