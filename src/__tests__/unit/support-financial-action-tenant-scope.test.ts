import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TENANT_SCOPED_MODELS, createTenantEnforcerExtension } from '@/lib/prisma-tenant-enforcer';
import { createBalanceAdjustmentRequestAction } from '@/actions/admin/balance-adjustments';
import { updateBalanceAction } from '@/actions/admin/users';
import { reviewSupportFinancialAction, getSupportActionsReviewListAction } from '@/actions/admin/support-review';
import { db } from '@/lib/db';
import { requireStaffPermission } from '@/lib/server/rbac';

vi.mock('@/lib/server/rbac', () => ({
  requireStaffPermission: vi.fn(),
  requireAdmin: vi.fn(),
  requireOwner: vi.fn(),
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    supportFinancialAction: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    manualBalanceAdjustment: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    ticket: {
      findUnique: vi.fn(),
    },
    ledgerEntry: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('@/services/admin/balance-policy.service', () => ({
  getEffectiveBalancePolicy: vi.fn().mockResolvedValue({
    enabled: true,
    isActive: true,
    canRequestCredit: true,
    canRequestDebit: true,
    maxCreditPerRequest: BigInt(1000000),
    maxDebitPerRequest: BigInt(1000000),
    allowedCreditReasons: 'GOODWILL,PROMO',
    allowedDebitReasons: 'PENALTY',
    allowedTargetRoles: 'USER',
    requireTicket: false,
    requireOrderForDebit: false,
  }),
  parsePolicyReasonCodes: vi.fn().mockReturnValue({
    allowedCreditReasonCodes: ['GOODWILL', 'PROMO'],
    allowedDebitReasonCodes: ['PENALTY'],
    allowedTargetRoles: ['USER'],
  }),
}));

describe('TEN-01 & TEN-02: Tenant Isolation for Financial Adjustments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('TEN-01: SupportFinancialAction Tenant Scoping & Enforcer Registration', () => {
    it('includes supportFinancialAction in TENANT_SCOPED_MODELS', () => {
      expect(TENANT_SCOPED_MODELS).toContain('supportFinancialAction');
    });

    it('enforces tenantId in query extensions for supportFinancialAction', async () => {
      const extension = createTenantEnforcerExtension();
      expect(extension.query.supportFinancialAction).toBeDefined();

      const mockQuery = vi.fn().mockResolvedValue([]);
      const args = { where: {} as Record<string, any> };

      // Set active tenant mock
      const { runWithTenant } = await import('@/lib/tenant-context');
      await runWithTenant('flux', async () => {
        await extension.query.supportFinancialAction.findMany({ args, query: mockQuery });
        expect(args.where.tenantId).toBe('flux');
      });
    });

    it('scopes getSupportActionsReviewListAction to active tenant', async () => {
      vi.mocked(requireStaffPermission).mockImplementation(async (_sec, _act, callback: any) => {
        return callback({ id: 'staff_1', role: 'SUPPORT', tenantId: 'flux' });
      });

      vi.mocked(db.supportFinancialAction.count).mockResolvedValue(0);
      vi.mocked(db.supportFinancialAction.findMany).mockResolvedValue([]);

      const result = await getSupportActionsReviewListAction();
      expect(result.success).toBe(true);

      expect(db.supportFinancialAction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'flux' }),
        })
      );
    });

    it('blocks cross-tenant review in reviewSupportFinancialAction when admin is not OWNER', async () => {
      vi.mocked(requireStaffPermission).mockImplementation(async (_sec, _act, callback: any) => {
        return callback({ id: 'staff_1', role: 'SUPPORT', tenantId: 'smmplan' });
      });

      vi.mocked(db.supportFinancialAction.findUnique).mockResolvedValue({
        id: 'sfa_flux_1',
        staffUserId: 'staff_flux_1',
        targetUserId: 'user_flux_1',
        reviewStatus: 'PENDING',
        tenantId: 'flux',
      } as any);

      const fd = new FormData();
      fd.append('actionId', 'sfa_flux_1');
      fd.append('reviewStatus', 'APPROVED');
      fd.append('reviewNote', 'Approving this flux action from smmplan staff');

      const result = await reviewSupportFinancialAction(fd);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/принадлежит другому сайту/i);
      }
    });
  });

  describe('TEN-02: Cross-Tenant Protection in Balance Adjustments', () => {
    it('rejects createBalanceAdjustmentRequestAction when target user is from another tenant', async () => {
      vi.mocked(requireStaffPermission).mockImplementation(async (_sec, _act, callback: any) => {
        return callback({ id: 'staff_plan', role: 'SUPPORT', tenantId: 'smmplan' });
      });

      // Target user is in 'flux'
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'usr_flux_victim',
        email: 'victim@flux.ru',
        role: 'USER',
        balance: BigInt(50000),
        isDeleted: false,
        isActive: true,
        tenantId: 'flux',
      } as any);

      const fd = new FormData();
      fd.append('userId', 'usr_flux_victim');
      fd.append('direction', 'CREDIT');
      fd.append('amount', '100.00');
      fd.append('reasonCode', 'GOODWILL');
      fd.append('reasonNote', 'Goodwill credit test for cross-tenant');

      const result = await createBalanceAdjustmentRequestAction(fd);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/целевой пользователь принадлежит сайту 'flux'/i);
      }
    });

    it('rejects updateUserBalanceAction when target user is from another tenant and admin is not OWNER', async () => {
      vi.mocked(requireStaffPermission).mockImplementation(async (_sec, _act, callback: any) => {
        return callback({ id: 'staff_plan', role: 'ADMIN', tenantId: 'smmplan' });
      });

      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'usr_flux_client',
        role: 'USER',
        balance: BigInt(10000),
        tenantId: 'flux',
      } as any);

      const fd = new FormData();
      fd.append('userId', 'usr_flux_client');
      fd.append('amount', '5000');
      fd.append('reason', 'Direct balance credit');

      const result = await updateBalanceAction(fd);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/целевой пользователь принадлежит сайту 'flux'/i);
      }
    });
  });
});
