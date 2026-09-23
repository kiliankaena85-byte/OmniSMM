import { describe, it, expect, vi, beforeEach } from 'vitest';
import { switchAdminTenantAction } from '@/actions/admin/tenants';

vi.mock('@/lib/session', () => ({
  verifySession: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'staff-456',
        email: 'staff@smmplan.pro',
        role: 'ADMIN',
        allowedTenants: ['smmplan', 'flux'],
        tenantId: 'smmplan',
      }),
    },
  },
}));

vi.mock('@/lib/redis', () => ({
  redis: {
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue('smmplan'),
  },
}));

vi.mock('@/lib/admin-audit', () => ({
  auditAdminAwaitable: vi.fn().mockResolvedValue({ id: 'audit-1' }),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    set: vi.fn(),
    get: vi.fn(),
  }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { verifySession } from '@/lib/session';
import { redis } from '@/lib/redis';
import { auditAdminAwaitable } from '@/lib/admin-audit';

describe('Admin Tenant Switcher Server-Side Session & Audit (P1-8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthorized unauthenticated callers', async () => {
    vi.mocked(verifySession).mockResolvedValue(null);
    const result = await switchAdminTenantAction('flux');
    expect(result.success).toBe(false);
  });

  it('rejects non-staff user roles from switching tenant', async () => {
    vi.mocked(verifySession).mockResolvedValue({
      userId: 'user-123',
      role: 'USER',
    });
    const result = await switchAdminTenantAction('flux');
    expect(result.success).toBe(false);
    expect(result.error).toContain('требуется роль сотрудника');
  });

  it('persists active tenant in server session and writes audit log for staff', async () => {
    vi.mocked(verifySession).mockResolvedValue({
      userId: 'staff-456',
      role: 'ADMIN',
    });

    const result = await switchAdminTenantAction('flux');
    expect(result.success).toBe(true);
    expect(result.tenantId).toBe('flux');
    expect(redis.set).toHaveBeenCalledWith('staff:staff-456:active_tenant', 'flux', 'EX', 86400 * 30);
    expect(auditAdminAwaitable).toHaveBeenCalledWith(expect.objectContaining({
      action: 'TENANT_SWITCH',
      target: 'flux',
    }));
  });
});
