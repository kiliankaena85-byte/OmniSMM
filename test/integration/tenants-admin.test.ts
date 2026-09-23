import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/session', async (importOriginal: any) => {
  const actual = await importOriginal();
  return {
    ...actual,
    verifySession: vi.fn().mockResolvedValue({
      userId: 'test-admin-id',
      email: 'admin@smmplan.pro',
      role: 'OWNER',
      tenantId: 'smmplan',
      preferredDashboard: 'CLASSIC'
    })
  };
});

import { 
  listTenantsAction, 
  createTenantAction, 
  updateTenantAction, 
  toggleTenantStatusAction, 
  deleteTenantAction 
} from '@/actions/admin/tenants';
import { db } from '@/lib/db';

describe('Admin Tenants Management (White-Label) Integration Tests', () => {
  it('should list existing tenants', async () => {
    const res = await listTenantsAction();
    expect(res.success).toBe(true);
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data.length).toBeGreaterThanOrEqual(2);
  });

  it('should create a new tenant with dedicated SystemSettings', async () => {
    const testSlug = `test-boost-${Date.now()}`;
    const testDomain = `${testSlug}.pro`;

    const res = await createTenantAction({
      name: 'Test Boost Brand',
      slug: testSlug,
      domain: testDomain,
      customDomain: null,
      themeVariant: 'classic'
    });

    expect(res.success).toBe(true);
    expect(res.data?.id).toBe(testSlug);

    // Verify DB
    const saved = await db.tenant.findUnique({
      where: { id: testSlug },
      include: { systemSettings: true }
    });
    expect(saved).not.toBeNull();
    expect(saved?.name).toBe('Test Boost Brand');
    expect(saved?.systemSettings?.siteName).toBe('Test Boost Brand');

    // Clean up
    await db.tenant.delete({ where: { id: testSlug } });
  });

  it('should prevent deleting system base brands (smmplan / flux)', async () => {
    const smmplanDel = await deleteTenantAction('smmplan');
    expect(smmplanDel.success).toBe(false);
    expect(smmplanDel.error).toContain('Запрещено удалять системные базовые бренды');

    const fluxDel = await deleteTenantAction('flux');
    expect(fluxDel.success).toBe(false);
    expect(fluxDel.error).toContain('Запрещено удалять системные базовые бренды');
  });

  it('should toggle tenant active status', async () => {
    const testSlug = `test-toggle-${Date.now()}`;
    await db.tenant.create({
      data: {
        id: testSlug,
        slug: testSlug,
        name: 'Toggle Test',
        domain: `${testSlug}.com`,
        isActive: true,
        systemSettings: { create: { siteName: 'Toggle Test' } }
      }
    });

    const toggleRes = await toggleTenantStatusAction(testSlug, false);
    expect(toggleRes.success).toBe(true);
    expect(toggleRes.data?.isActive).toBe(false);

    // Clean up
    await db.tenant.delete({ where: { id: testSlug } });
  });
});
