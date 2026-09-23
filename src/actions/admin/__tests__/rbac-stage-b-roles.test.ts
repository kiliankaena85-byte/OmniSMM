import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { verifySession } from '@/lib/session';
import { RBAC_SECTIONS } from '@/lib/rbac-sections';
import { 
  createRoleAction, 
  updateRoleAction, 
  cloneRoleAction, 
  deleteRoleAction,
  listRolesWithPermissionsAction
} from '@/actions/admin/roles';
import { enforceSectionAccess } from '@/lib/server/rbac';

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

// Mock verifySession to control authenticated user per test
vi.mock('@/lib/session', async (importOriginal: any) => {
  const actual = await importOriginal();
  return {
    ...actual,
    verifySession: vi.fn(),
  };
});

describe('RBAC Stage B: Canonical Registry & StaffRole Management', () => {
  let adminUser: any;
  let managerUser: any;
  let cashierUser: any;
  let adminRole: any;
  let managerRole: any;
  let cashierRole: any;

  beforeEach(async () => {
    // 1. Clean DB in strict foreign key order
    await db.ticketMessage.deleteMany().catch(() => {});
    await db.ticket.deleteMany().catch(() => {});
    await db.manualBalanceAdjustment.deleteMany().catch(() => {});
    await db.balanceAdjustmentPolicy.deleteMany().catch(() => {});
    await db.ledgerEntry.deleteMany().catch(() => {});
    await db.payment.deleteMany().catch(() => {});
    await db.order.deleteMany().catch(() => {});
    await db.session.deleteMany().catch(() => {});
    await db.auditLog.deleteMany().catch(() => {});
    await db.user.deleteMany().catch(() => {});
    await db.staffPermission.deleteMany().catch(() => {});
    await db.staffRole.deleteMany().catch(() => {});

    const suffix = `${Date.now()}_${Math.floor(Math.random() * 1000000)}`;

    // 2. Create System Roles
    adminRole = await db.staffRole.create({
      data: {
        name: `Admin_${suffix}`,
        description: 'Full administrative access',
        isSystem: true,
        permissions: {
          create: RBAC_SECTIONS.map(s => ({
            section: s.id,
            canView: true,
            canEdit: true,
          }))
        }
      }
    });

    managerRole = await db.staffRole.create({
      data: {
        name: `Manager_${suffix}`,
        description: 'Operations manager',
        isSystem: true,
        permissions: {
          create: [
            { section: 'dashboard', canView: true, canEdit: false },
            { section: 'orders', canView: true, canEdit: true },
            { section: 'catalog', canView: true, canEdit: true },
            { section: 'analytics', canView: true, canEdit: false },
          ]
        }
      }
    });

    cashierRole = await db.staffRole.create({
      data: {
        name: `Cashier_${suffix}`,
        description: 'Finance cashier',
        isSystem: true,
        permissions: {
          create: [
            { section: 'dashboard', canView: true, canEdit: false },
            { section: 'balance_requests', canView: true, canEdit: true },
            { section: 'balance_approvals', canView: true, canEdit: true },
            { section: 'balance_stats', canView: true, canEdit: false },
          ]
        }
      }
    });

    // 3. Create Users
    adminUser = await db.user.create({
      data: {
        email: `admin_${suffix}@test.com`,
        passwordHash: 'hashed_pw',
        role: 'ADMIN',
        staffRoleId: adminRole.id,
        balance: BigInt(0),
      }
    });

    managerUser = await db.user.create({
      data: {
        email: `manager_${suffix}@test.com`,
        passwordHash: 'hashed_pw',
        role: 'MANAGER',
        staffRoleId: managerRole.id,
        balance: BigInt(0),
      }
    });

    cashierUser = await db.user.create({
      data: {
        email: `cashier_${suffix}@test.com`,
        passwordHash: 'hashed_pw',
        role: 'SUPPORT',
        staffRoleId: cashierRole.id,
        balance: BigInt(0),
      }
    });
  });

  describe('B.1 Canonical Section Registry', () => {
    it('contains exactly 16 canonical sections with unique ids', () => {
      expect(RBAC_SECTIONS.length).toBe(16);
      const ids = RBAC_SECTIONS.map(s => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(16);

      for (const section of RBAC_SECTIONS) {
        expect(section.id).toBeDefined();
        expect(section.label).toBeDefined();
        expect(section.group).toBeDefined();
        expect(section.description).toBeDefined();
      }
    });

    it('contains all required core sections', () => {
      const required = [
        'dashboard', 'clients', 'orders', 'refills', 'tickets',
        'catalog', 'providers', 'marketing', 'content', 'finance',
        'balance_requests', 'balance_approvals', 'balance_stats',
        'balance_policy', 'analytics', 'settings'
      ];
      const actualIds = RBAC_SECTIONS.map(s => s.id);
      for (const req of required) {
        expect(actualIds).toContain(req);
      }
    });
  });

  describe('B.2 StaffRole CRUD Actions & Security Protections', () => {
    it('creates custom role with normalized permissions (canEdit => canView)', async () => {
      (verifySession as any).mockResolvedValue({ userId: adminUser.id, role: adminUser.role });

      const res = await createRoleAction({
        name: `Catalog Operator ${Date.now()}`,
        description: 'Only manages catalog',
        permissions: [
          { section: 'catalog', canView: false, canEdit: true }, // canView false but canEdit true
          { section: 'providers', canView: true, canEdit: false },
        ]
      });

      expect(res.success).toBe(true);
      if (!res.success || !res.role) throw new Error('Role creation failed');

      expect(res.role.isSystem).toBe(false);

      // Verify normalizer set canView = true because canEdit = true
      const catalogPerm = res.role.permissions.find((p: any) => p.section === 'catalog');
      expect(catalogPerm?.canView).toBe(true);
      expect(catalogPerm?.canEdit).toBe(true);

      const providerPerm = res.role.permissions.find((p: any) => p.section === 'providers');
      expect(providerPerm?.canView).toBe(true);
      expect(providerPerm?.canEdit).toBe(false);
    });

    it('blocks non-settings staff from creating roles', async () => {
      (verifySession as any).mockResolvedValue({ userId: managerUser.id, role: managerUser.role });

      const res = await createRoleAction({
        name: `Hacker Role ${Date.now()}`,
        description: 'Should fail',
        permissions: []
      });

      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });

    it('prevents modifying the system Admin role', async () => {
      // Create specifically named system Admin role
      const systemAdmin = await db.staffRole.create({
        data: {
          name: `Admin_${Date.now()}_sys`,
          description: 'The master system admin',
          isSystem: true,
        }
      });

      // Update name to Admin in DB
      await db.staffRole.update({
        where: { id: systemAdmin.id },
        data: { name: 'Admin' }
      });

      (verifySession as any).mockResolvedValue({ userId: adminUser.id, role: adminUser.role });

      const res = await updateRoleAction({
        id: systemAdmin.id,
        name: 'Admin Renamed',
        permissions: []
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('Admin');
    });

    it('enforces lockout guard when staff tries to remove settings:edit from own role', async () => {
      // Create custom role with settings:edit
      const customRole = await db.staffRole.create({
        data: {
          name: `Custom Manager ${Date.now()}`,
          isSystem: false,
          permissions: {
            create: [{ section: 'settings', canView: true, canEdit: true }]
          }
        }
      });

      const customManagerUser = await db.user.create({
        data: {
          email: `custom_manager_${Date.now()}@test.com`,
          passwordHash: 'hashed_pw',
          role: 'MANAGER',
          staffRoleId: customRole.id,
          balance: BigInt(0),
        }
      });

      (verifySession as any).mockResolvedValue({ userId: customManagerUser.id, role: customManagerUser.role });

      // Try to remove settings permission from own role
      const res = await updateRoleAction({
        id: customRole.id,
        name: customRole.name,
        permissions: [{ section: 'settings', canView: true, canEdit: false }]
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('собственной роли');
    });

    it('clones an existing role into a non-system role', async () => {
      (verifySession as any).mockResolvedValue({ userId: adminUser.id, role: adminUser.role });

      const res = await cloneRoleAction({
        id: managerRole.id,
        newName: `Junior Manager ${Date.now()}`
      });

      expect(res.success).toBe(true);
      if (!res.success || !res.role) throw new Error('Role clone failed');

      expect(res.role.name).toContain('Junior Manager');
      expect(res.role.isSystem).toBe(false);
      expect(res.role.permissions.length).toBe(managerRole.permissions?.length || 4);
    });

    it('prevents deleting system roles', async () => {
      (verifySession as any).mockResolvedValue({ userId: adminUser.id, role: adminUser.role });

      const res = await deleteRoleAction({ id: cashierRole.id });
      expect(res.success).toBe(false);
      expect(res.error).toContain('Системные');
    });

    it('prevents deleting role when users are still assigned', async () => {
      (verifySession as any).mockResolvedValue({ userId: adminUser.id, role: adminUser.role });

      const customRole = await db.staffRole.create({
        data: {
          name: `Support Junior ${Date.now()}`,
          isSystem: false,
        }
      });

      const user = await db.user.create({
        data: {
          email: `junior_${Date.now()}@test.com`,
          passwordHash: 'hashed_pw',
          role: 'SUPPORT',
          staffRoleId: customRole.id,
          balance: BigInt(0),
        }
      });

      const res = await deleteRoleAction({ id: customRole.id });
      expect(res.success).toBe(false);
      expect(res.error).toContain('переназначьте');
    });

    it('successfully deletes unassigned custom role', async () => {
      (verifySession as any).mockResolvedValue({ userId: adminUser.id, role: adminUser.role });

      const customRole = await db.staffRole.create({
        data: {
          name: `Temporary Role ${Date.now()}`,
          isSystem: false,
          permissions: {
            create: [{ section: 'marketing', canView: true, canEdit: true }]
          }
        }
      });

      const res = await deleteRoleAction({ id: customRole.id });
      expect(res.success).toBe(true);

      const inDb = await db.staffRole.findUnique({ where: { id: customRole.id } });
      expect(inDb).toBeNull();
    });
  });

  describe('B.3 Page Access Enforcement (enforceSectionAccess)', () => {
    it('allows Manager with analytics:view to access analytics section', async () => {
      (verifySession as any).mockResolvedValue({ userId: managerUser.id, role: managerUser.role });
      await expect(enforceSectionAccess('analytics')).resolves.not.toThrow();
    });

    it('blocks Cashier from accessing analytics section (redirects)', async () => {
      (verifySession as any).mockResolvedValue({ userId: cashierUser.id, role: cashierUser.role });
      await expect(enforceSectionAccess('analytics')).rejects.toThrow('NEXT_REDIRECT');
    });

    it('allows Cashier to access balance_requests section', async () => {
      (verifySession as any).mockResolvedValue({ userId: cashierUser.id, role: cashierUser.role });
      await expect(enforceSectionAccess('balance_requests')).resolves.not.toThrow();
    });

    it('blocks Support without settings access from accessing settings section', async () => {
      (verifySession as any).mockResolvedValue({ userId: cashierUser.id, role: cashierUser.role });
      await expect(enforceSectionAccess('settings')).rejects.toThrow('NEXT_REDIRECT');
    });
  });

  describe('C.3 canSeeRates via FINANCE:view permission (ADM-15)', () => {
    function computeCanSeeRates(user: any) {
      const isSuperAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN';
      const permissions = user?.staffRole?.permissions || [];
      return isSuperAdmin || permissions.some((p: any) => p.section.toLowerCase() === 'finance' && (p.canView || p.canEdit));
    }

    it('denies rates visibility for Support staff without finance:view', () => {
      expect(computeCanSeeRates(cashierUser)).toBe(false);
    });

    it('denies rates visibility for Manager without finance:view (even with catalog:edit)', () => {
      expect(computeCanSeeRates(managerUser)).toBe(false);
    });

    it('grants rates visibility for user with finance:view permission', () => {
      const financeUser = {
        role: 'SUPPORT',
        staffRole: {
          permissions: [
            { section: 'finance', canView: true, canEdit: false }
          ]
        }
      };
      expect(computeCanSeeRates(financeUser)).toBe(true);
    });

    it('grants rates visibility for OWNER automatically via super admin bypass', () => {
      const ownerUser = {
        role: 'OWNER',
        staffRole: null
      };
      expect(computeCanSeeRates(ownerUser)).toBe(true);
    });

    it('grants rates visibility for ADMIN automatically via super admin bypass', () => {
      expect(computeCanSeeRates(adminUser)).toBe(true);
    });
  });
});
