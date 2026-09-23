/**
 * @file admin-switchers-security.test.ts
 * @description Unit tests for GlobalSiteSwitcher & EnvironmentModeSwitcher security and reactivity.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks
const mockCookieSet = vi.fn();
const mockCookieGet = vi.fn().mockReturnValue(undefined);
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: mockCookieGet,
    set: mockCookieSet,
  }),
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

const mockRevalidatePath = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: mockRevalidatePath,
  revalidateTag: vi.fn(),
  unstable_cache: (fn: any) => fn,
}));

vi.mock('@/lib/redis', () => ({
  redis: {
    status: 'ready',
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  },
}));

let mockSessionUser: { userId: string; role: string; email: string; tenantId: string } | null = {
  userId: 'usr_admin',
  role: 'OWNER',
  email: 'admin@smmplan.pro',
  tenantId: 'smmplan',
};

vi.mock('@/lib/session', () => ({
  verifySession: vi.fn().mockImplementation(async () => {
    if (!mockSessionUser) return null;
    return {
      userId: mockSessionUser.userId,
      role: mockSessionUser.role,
      email: mockSessionUser.email,
      tenantId: mockSessionUser.tenantId,
      expiresAt: new Date(Date.now() + 3600000),
    };
  }),
}));

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: vi.fn().mockImplementation(async () => ({
        id: mockSessionUser?.userId,
        role: mockSessionUser?.role,
        email: mockSessionUser?.email,
        tenantId: mockSessionUser?.tenantId,
        staffRole: null,
      })),
    },
    tenant: {
      findUnique: vi.fn().mockImplementation(async ({ where }: any) => ({ id: where.slug || 'smmplan', slug: where.slug || 'smmplan' })),
      findFirst: vi.fn().mockResolvedValue({ id: 'smmplan', slug: 'smmplan' }),
    },
    systemSettings: {
      upsert: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));

vi.mock('@/lib/admin-audit', () => ({
  auditAdminAwaitable: vi.fn().mockResolvedValue(undefined),
  auditAdmin: vi.fn(),
}));

describe('Admin Switchers Security & Reactivity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionUser = {
      userId: 'usr_admin',
      role: 'OWNER',
      email: 'admin@smmplan.pro',
      tenantId: 'smmplan',
    };
  });

  describe('switchAdminTenantAction', () => {
    it('rejects unauthenticated requests (OWASP A01: Broken Access Control)', async () => {
      mockSessionUser = null;
      const { switchAdminTenantAction } = await import('@/actions/admin/tenants');
      const res = await switchAdminTenantAction('flux');

      expect(res.success).toBe(false);
      expect(res.error).toContain('Необходима авторизация');
      expect(mockCookieSet).not.toHaveBeenCalled();
    });

    it('rejects regular customer users without staff roles', async () => {
      mockSessionUser = {
        userId: 'usr_client',
        role: 'USER',
        email: 'client@example.com',
        tenantId: 'smmplan',
      };
      const { switchAdminTenantAction } = await import('@/actions/admin/tenants');
      const res = await switchAdminTenantAction('flux');

      expect(res.success).toBe(false);
      expect(res.error).toContain('Доступ запрещён');
      expect(mockCookieSet).not.toHaveBeenCalled();
    });

    it('sets x_admin_tenant cookie and revalidates layout for staff', async () => {
      const { switchAdminTenantAction } = await import('@/actions/admin/tenants');
      const res = await switchAdminTenantAction('flux');

      expect(res.success).toBe(true);
      expect(res.tenantId).toBe('flux');
      expect(mockCookieSet).toHaveBeenCalledWith('x_admin_tenant', 'flux', expect.objectContaining({
        path: '/',
        sameSite: 'lax',
      }));
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin', 'layout');
    });

    it('normalizes legacy tenant identifiers like lovable to flux', async () => {
      const { switchAdminTenantAction } = await import('@/actions/admin/tenants');
      const res = await switchAdminTenantAction('lovable');

      expect(res.success).toBe(true);
      expect(res.tenantId).toBe('flux');
      expect(mockCookieSet).toHaveBeenCalledWith('x_admin_tenant', 'flux', expect.anything());
    });
  });

  describe('setEnvironmentModeAction', () => {
    it('rejects invalid environment modes with strict enum check', async () => {
      const { setEnvironmentModeAction } = await import('@/actions/admin/environment-mode');
      const res = await setEnvironmentModeAction({ mode: 'INVALID_MODE' as any });

      expect(res.success).toBe(false);
      expect(res.error).toContain('Некорректный режим окружения');
    });

    it('updates mode, calls revalidatePath on admin layout', async () => {
      const { setEnvironmentModeAction } = await import('@/actions/admin/environment-mode');
      const res = await setEnvironmentModeAction({ mode: 'HYBRID', tenantId: 'flux' });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.mode).toBe('HYBRID');
      }
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin', 'layout');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/', 'layout');
    });
  });
});
