/**
 * @file multitenant-staff-isolation.test.ts
 * @description Comprehensive unit tests for multi-tenant isolation, RBAC boundaries,
 * and support ticket cross-brand shielding according to ISO 29148 and NIST SP 800-162.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveAdminTenantContext, isTenantAllowedForUser } from '@/utils/admin-tenant';
import { registerValidTenant, VALID_TENANTS, normalizeTenantId } from '@/lib/tenant-resolver-edge';

// Mocks for Server Action testing
const mockCookieSet = vi.fn();
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn(),
    set: mockCookieSet,
  }),
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
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

let mockCurrentUser: {
  id: string;
  email: string;
  role: string;
  tenantId: string | null;
  allowedTenants: string[];
} | null = null;

vi.mock('@/lib/session', () => ({
  verifySession: vi.fn().mockImplementation(async () => {
    if (!mockCurrentUser) return null;
    return {
      userId: mockCurrentUser.id,
      role: mockCurrentUser.role,
      email: mockCurrentUser.email,
      tenantId: mockCurrentUser.tenantId || 'smmplan',
      expiresAt: new Date(Date.now() + 3600000),
    };
  }),
}));

const mockTicketCount = vi.fn().mockResolvedValue(1);
const mockTicketFindMany = vi.fn().mockResolvedValue([]);
const mockTicketFindFirst = vi.fn().mockResolvedValue(null);

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: vi.fn().mockImplementation(async () => mockCurrentUser),
    },
    ticket: {
      count: (...args: any[]) => mockTicketCount(...args),
      findMany: (...args: any[]) => mockTicketFindMany(...args),
      findFirst: (...args: any[]) => mockTicketFindFirst(...args),
    },
    adminAuditLog: {
      create: vi.fn().mockResolvedValue({ id: 'log_1' }),
    },
  },
}));

vi.mock('@/lib/admin-audit', () => ({
  auditAdminAwaitable: vi.fn().mockResolvedValue({ id: 'log_1' }),
}));

describe('Multi-Tenant Staff Isolation & RBAC Boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. resolveAdminTenantContext', () => {
    it('gives OWNER access across all tenants ("all" only if explicitly requested, otherwise fallback to cookie or tenantId)', () => {
      const owner = { id: 'usr_owner', role: 'OWNER', tenantId: 'smmplan', allowedTenants: ['smmplan', 'flux'] };
      expect(resolveAdminTenantContext(owner)).toBe('smmplan');
      expect(resolveAdminTenantContext(owner, null, 'flux')).toBe('flux');
      expect(resolveAdminTenantContext(owner, 'flux')).toBe('flux');
      expect(resolveAdminTenantContext(owner, 'smmplan')).toBe('smmplan');
      expect(resolveAdminTenantContext(owner, 'all')).toBe('all');
    });

    it('strictly restricts ADMIN to allowedTenants (cannot access "all")', () => {
      const adminPlanOnly = { id: 'usr_admin', role: 'ADMIN', tenantId: 'smmplan', allowedTenants: ['smmplan'] };
      // No param: returns their default allowed tenant
      expect(resolveAdminTenantContext(adminPlanOnly)).toBe('smmplan');
      // Attempting to select "all" -> fails closed to smmplan
      expect(resolveAdminTenantContext(adminPlanOnly, 'all')).toBe('smmplan');
      // Attempting to select unauthorized brand "flux" -> fails closed to smmplan
      expect(resolveAdminTenantContext(adminPlanOnly, 'flux')).toBe('smmplan');
      // Explicit allowed selection
      expect(resolveAdminTenantContext(adminPlanOnly, 'smmplan')).toBe('smmplan');
    });

    it('allows multi-brand ADMIN to toggle only between assigned allowedTenants', () => {
      const multiAdmin = { id: 'usr_admin_2', role: 'ADMIN', tenantId: 'smmplan', allowedTenants: ['smmplan', 'flux'] };
      expect(resolveAdminTenantContext(multiAdmin, 'flux')).toBe('flux');
      expect(resolveAdminTenantContext(multiAdmin, 'smmplan')).toBe('smmplan');
      // Attempting "all" is strictly blocked for non-owners
      expect(resolveAdminTenantContext(multiAdmin, 'all')).toBe('smmplan');
    });

    it('strictly restricts SUPPORT to their assigned brand', () => {
      const supportFlux = { id: 'usr_sup_1', role: 'SUPPORT', tenantId: 'flux', allowedTenants: ['flux'] };
      expect(resolveAdminTenantContext(supportFlux)).toBe('flux');
      expect(resolveAdminTenantContext(supportFlux, 'smmplan')).toBe('flux');
      expect(resolveAdminTenantContext(supportFlux, 'all')).toBe('flux');
      expect(resolveAdminTenantContext(supportFlux, 'flux')).toBe('flux');
    });

    it('handles null/undefined user safely with fail-closed fallback', () => {
      expect(resolveAdminTenantContext(null)).toBe('smmplan');
      expect(resolveAdminTenantContext({ role: 'SUPPORT', tenantId: null, allowedTenants: [] })).toBe('smmplan');
    });
  });

  describe('2. isTenantAllowedForUser', () => {
    it('validates OWNER permissions', () => {
      const owner = { id: 'u1', role: 'OWNER', allowedTenants: ['smmplan', 'flux'] };
      expect(isTenantAllowedForUser(owner, 'smmplan')).toBe(true);
      expect(isTenantAllowedForUser(owner, 'flux')).toBe(true);
      expect(isTenantAllowedForUser(owner, 'any_custom_tenant')).toBe(true);
      expect(isTenantAllowedForUser(owner, 'all')).toBe(false); // 'all' is a meta-scope, not a tenant
    });

    it('validates SUPPORT permissions', () => {
      const support = { id: 'u2', role: 'SUPPORT', tenantId: 'smmplan', allowedTenants: ['smmplan'] };
      expect(isTenantAllowedForUser(support, 'smmplan')).toBe(true);
      expect(isTenantAllowedForUser(support, 'flux')).toBe(false);
      expect(isTenantAllowedForUser(support, 'all')).toBe(false);
    });
  });

  describe('3. switchAdminTenantAction', () => {
    it('blocks non-staff users', async () => {
      mockCurrentUser = { id: 'usr_client', role: 'USER', email: 'client@test.com', tenantId: 'smmplan', allowedTenants: [] };
      const { switchAdminTenantAction } = await import('@/actions/admin/tenants');
      const res = await switchAdminTenantAction('flux');
      expect(res.success).toBe(false);
      expect(res.error).toContain('требуется роль сотрудника');
    });

    it('blocks SUPPORT from switching to an unauthorized tenant', async () => {
      mockCurrentUser = { id: 'usr_sup', role: 'SUPPORT', email: 'support@smmplan.pro', tenantId: 'smmplan', allowedTenants: ['smmplan'] };
      const { switchAdminTenantAction } = await import('@/actions/admin/tenants');
      const res = await switchAdminTenantAction('flux');
      expect(res.success).toBe(false);
      expect(res.error).toContain('ограничен настройками вашей роли');
    });

    it('allows SUPPORT with multi-brand access to switch to permitted tenant', async () => {
      mockCurrentUser = { id: 'usr_sup_multi', role: 'SUPPORT', email: 'multi@smmplan.pro', tenantId: 'smmplan', allowedTenants: ['smmplan', 'flux'] };
      const { switchAdminTenantAction } = await import('@/actions/admin/tenants');
      const res = await switchAdminTenantAction('flux');
      expect(res.success).toBe(true);
      expect(res.tenantId).toBe('flux');
      expect(mockCookieSet).toHaveBeenCalledWith('x_admin_tenant', 'flux', expect.any(Object));
    });

    it('allows OWNER to switch to any valid brand', async () => {
      mockCurrentUser = { id: 'usr_owner', role: 'OWNER', email: 'owner@smmplan.pro', tenantId: 'smmplan', allowedTenants: ['smmplan', 'flux'] };
      const { switchAdminTenantAction } = await import('@/actions/admin/tenants');
      const res = await switchAdminTenantAction('flux');
      expect(res.success).toBe(true);
      expect(res.tenantId).toBe('flux');
    });
  });

  describe('4. Support Ticket Tenant Filtering & Anti-IDOR', () => {
    it('attaches tenantId filter when querying ticket list', async () => {
      const { adminTicketService } = await import('@/services/admin/ticket.service');
      await adminTicketService.listTickets({
        tenantId: 'flux',
      });

      expect(mockTicketCount).toHaveBeenCalledWith({
        where: expect.objectContaining({ tenantId: 'flux' }),
      });
      expect(mockTicketFindMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'flux' }),
      }));
    });

    it('attaches allowedTenants array filter when tenantId is not specified', async () => {
      const { adminTicketService } = await import('@/services/admin/ticket.service');
      await adminTicketService.listTickets({
        allowedTenants: ['smmplan', 'flux'],
      });

      expect(mockTicketCount).toHaveBeenCalledWith({
        where: expect.objectContaining({ tenantId: { in: ['smmplan', 'flux'] } }),
      });
    });

    it('shields ticket details from cross-tenant access via allowedTenants guard', async () => {
      const { adminTicketService } = await import('@/services/admin/ticket.service');
      await adminTicketService.getTicketDetails('tkt_123', ['flux']);

      expect(mockTicketFindFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'tkt_123', tenantId: { in: ['flux'] } },
      }));
    });
  });

  describe('5. Dynamic Tenant Registration', () => {
    it('registers new tenant slug into runtime validation set', () => {
      expect(VALID_TENANTS.has('smmstar')).toBe(false);
      expect(normalizeTenantId('smmstar')).toBe('smmplan'); // Falls back prior to registration

      registerValidTenant('smmstar');
      expect(VALID_TENANTS.has('smmstar')).toBe(true);
      expect(normalizeTenantId('smmstar')).toBe('smmstar'); // Recognized after registration
    });
  });
});
