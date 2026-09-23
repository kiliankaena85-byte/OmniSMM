// tenant-isolation-ignore: Unit test for tenant deletion registry cleanup
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DomainRegistryService } from '@/services/tenant/domain-registry.service';
import { isValidTenant, registerValidTenant } from '@/lib/tenant-resolver-edge';

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    tenant: {
      findUnique: vi.fn(),
      delete: vi.fn().mockResolvedValue({ id: 'doomed-tenant' }),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ email: 'owner@smmplan.pro' }),
    },
  };
  return { mockDb };
});

vi.mock('@/lib/db', () => ({
  db: mockDb,
}));

vi.mock('@/lib/redis', () => {
  const pipelineMock = {
    hset: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  };
  return {
    redis: {
      hdel: vi.fn().mockResolvedValue(1),
      pipeline: vi.fn(() => pipelineMock),
    },
  };
});

vi.mock('@/lib/session', () => ({
  verifySession: vi.fn().mockResolvedValue({ userId: 'owner-1', role: 'OWNER' }),
}));

vi.mock('@/lib/admin-audit', () => ({
  auditAdminAwaitable: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { deleteTenantAction } from '@/actions/admin/tenants';

describe('Tenant Deletion Domain Cleanup Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    DomainRegistryService.invalidateCache();
  });

  it('evicts domains from DomainRegistryService and unregisters slug when tenant is deleted', async () => {
    // 1. Setup tenant in registry
    registerValidTenant('doomed-tenant');
    await DomainRegistryService.registerDomain({
      slug: 'doomed-tenant',
      domain: 'doomed.com',
      customDomain: 'api.doomed.com',
      isActive: true,
    });

    expect(isValidTenant('doomed-tenant')).toBe(true);
    expect(DomainRegistryService.isKnownInMemory('doomed.com')).toBe(true);

    // 2. Mock DB findUnique returning the tenant
    mockDb.tenant.findUnique.mockResolvedValueOnce({
      id: 'doomed-tenant',
      slug: 'doomed-tenant',
      domain: 'doomed.com',
      customDomain: 'api.doomed.com',
      isActive: true,
    });

    // 3. Execute deleteTenantAction
    const result = await deleteTenantAction('doomed-tenant');

    expect(result.success).toBe(true);
    expect(mockDb.tenant.delete).toHaveBeenCalledWith({ where: { id: 'doomed-tenant' } });

    // 4. Domains must be evicted from memory registry and slug unregistered
    expect(DomainRegistryService.isKnownInMemory('doomed.com')).toBe(false);
    expect(DomainRegistryService.isKnownInMemory('api.doomed.com')).toBe(false);
    expect(isValidTenant('doomed-tenant')).toBe(false);
  });
});
