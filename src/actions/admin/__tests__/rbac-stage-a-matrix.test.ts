import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { verifySession } from '@/lib/session';
import { changeTicketStatus, adminReplyTicket } from '@/actions/support/ticket';
import { banUserAction, updateBalanceAction, loginAsAction } from '@/actions/admin/users';
import { approveBalanceAdjustmentAction, rejectBalanceAdjustmentAction } from '@/actions/admin/balance-adjustments';
import { BALANCE_ADJUSTMENT_STATUS, BALANCE_ADJUSTMENT_DIRECTION } from '@/constants/balance-adjustments';
import { enforceSectionAccess, enforceAnySectionAccess } from '@/lib/server/rbac';

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

describe('RBAC Stage A Matrix: Support, Manager, Cashier, Owner permissions', () => {
  let ownerUser: any;
  let supportUser: any;
  let managerUser: any;
  let cashierUser: any;
  let targetUser: any;
  let testTicket: any;
  let testAdjustment: any;

  beforeEach(async () => {
    // 1. Clean DB tables in foreign key order
    await db.ticketMessage.deleteMany().catch(() => {});
    await db.ticket.deleteMany().catch(() => {});
    await db.manualBalanceAdjustment.deleteMany().catch(() => {});
    await db.balanceAdjustmentPolicy.deleteMany().catch(() => {});
    await db.ledgerEntry.deleteMany().catch(() => {});
    await db.payment.deleteMany().catch(() => {});
    await db.order.deleteMany().catch(() => {});
    await db.session.deleteMany().catch(() => {});
    await db.staffPermission.deleteMany().catch(() => {});
    await db.user.deleteMany().catch(() => {});
    await db.staffRole.deleteMany().catch(() => {});

    // 2. Create Roles
    const supportRole = await db.staffRole.create({
      data: {
        name: 'Support',
        description: 'Support staff',
        isSystem: true,
        permissions: {
          create: [
            { section: 'tickets', canView: true, canEdit: true },
            { section: 'dashboard', canView: true, canEdit: false },
            { section: 'orders', canView: true, canEdit: false },
            { section: 'clients', canView: true, canEdit: false },
          ]
        }
      }
    });

    const managerRole = await db.staffRole.create({
      data: {
        name: 'Manager',
        description: 'Manager staff',
        isSystem: true,
        permissions: {
          create: [
            { section: 'clients', canView: true, canEdit: true },
            { section: 'orders', canView: true, canEdit: true },
            { section: 'catalog', canView: true, canEdit: true },
            { section: 'providers', canView: true, canEdit: true },
            { section: 'tickets', canView: true, canEdit: true },
            { section: 'content', canView: true, canEdit: true },
            { section: 'dashboard', canView: true, canEdit: false },
          ]
        }
      }
    });

    const cashierRole = await db.staffRole.create({
      data: {
        name: 'Cashier',
        description: 'Cashier staff',
        isSystem: true,
        permissions: {
          create: [
            { section: 'balance_requests', canView: true, canEdit: true },
            { section: 'balance_approvals', canView: true, canEdit: true },
            { section: 'balance_stats', canView: true, canEdit: false },
            { section: 'dashboard', canView: true, canEdit: false },
          ]
        }
      }
    });

    const suffix = `${Date.now()}_${Math.floor(Math.random() * 1000000)}`;

    // 3. Create Users
    ownerUser = await db.user.create({
      data: {
        email: `owner_${suffix}@smmplan.local`,
        passwordHash: 'hashed_pw',
        role: 'OWNER',
        balance: BigInt(100000),
      }
    });

    supportUser = await db.user.create({
      data: {
        email: `support_${suffix}@smmplan.local`,
        passwordHash: 'hashed_pw',
        role: 'SUPPORT',
        staffRoleId: supportRole.id,
        balance: BigInt(0),
      }
    });

    managerUser = await db.user.create({
      data: {
        email: `manager_${suffix}@smmplan.local`,
        passwordHash: 'hashed_pw',
        role: 'MANAGER',
        staffRoleId: managerRole.id,
        balance: BigInt(0),
      }
    });

    cashierUser = await db.user.create({
      data: {
        email: `cashier_${suffix}@smmplan.local`,
        passwordHash: 'hashed_pw',
        role: 'SUPPORT', // or custom staff role
        staffRoleId: cashierRole.id,
        balance: BigInt(0),
      }
    });

    // Configure cashier policy so getEffectiveBalancePolicy allows approvals
    await db.balanceAdjustmentPolicy.create({
      data: {
        scopeType: 'USER',
        userId: cashierUser.id,
        isActive: true,
        enabled: true,
        canApprove: true,
        canReject: true,
        maxApprovalPerRequest: BigInt(500000),
        allowedCreditReasonCodes: ['GOODWILL_LOYALTY', 'DIRECT_CREDIT', 'MANUAL_ADJUSTMENT'],
        allowedDebitReasonCodes: ['DIRECT_DEBIT', 'CHARGEBACK_PENALTY'],
        allowedTargetRoles: ['USER', 'CLIENT']
      }
    });

    targetUser = await db.user.create({
      data: {
        email: `client_${suffix}@example.com`,
        passwordHash: 'hashed_pw',
        role: 'USER',
        balance: BigInt(50000),
      }
    });

    testTicket = await db.ticket.create({
      data: {
        userId: targetUser.id,
        subject: 'Problem with payment',
        status: 'OPEN',
        tenantId: 'smmplan',
        source: 'WEB',
      }
    });

    testAdjustment = await db.manualBalanceAdjustment.create({
      data: {
        userId: targetUser.id,
        requestedBy: managerUser.id,
        direction: BALANCE_ADJUSTMENT_DIRECTION.CREDIT,
        amount: BigInt(5000),
        reasonCode: 'GOODWILL_LOYALTY',
        reasonNote: 'Compensation for delay in processing',
        status: BALANCE_ADJUSTMENT_STATUS.PENDING_APPROVAL,
        idempotencyKey: `adjust-test-key-${Date.now()}-${Math.random()}`,
      }
    });

    vi.clearAllMocks();
  });

  describe('Support role permissions', () => {
    it('can change ticket status and reply to ticket (ADM-01)', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: supportUser.id });

      const statusForm = new FormData();
      statusForm.append('ticketId', testTicket.id);
      statusForm.append('status', 'PENDING');

      const statusRes = await changeTicketStatus(statusForm);
      // Successful execution produces undefined or object without error
      expect((statusRes as any)?.error).toBeUndefined();

      const updatedTicket = await db.ticket.findUnique({ where: { id: testTicket.id } });
      expect(updatedTicket?.status).toBe('PENDING');

      const replyForm = new FormData();
      replyForm.append('ticketId', testTicket.id);
      replyForm.append('message', 'Hello, we are investigating your request.');
      replyForm.append('isInternal', 'false');

      const replyRes = await adminReplyTicket(replyForm);
      expect((replyRes as any)?.error).toBeUndefined();

      const messages = await db.ticketMessage.findMany({ where: { ticketId: testTicket.id } });
      expect(messages.length).toBeGreaterThan(0);
    });

    it('cannot ban users without clients:edit permission', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: supportUser.id });

      const banForm = new FormData();
      banForm.append('userId', targetUser.id);

      const res = await banUserAction(banForm);
      expect(res.success).toBe(false);
      expect((res as any).error).toContain('Forbidden');
    });
  });

  describe('Manager role permissions', () => {
    it('can ban user (ADM-02: clients:edit)', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: managerUser.id });

      const banForm = new FormData();
      banForm.append('userId', targetUser.id);

      const res = await banUserAction(banForm);
      expect(res.success).toBe(true);

      const updatedUser = await db.user.findUnique({ where: { id: targetUser.id } });
      expect(updatedUser?.role).toBe('BANNED');
    });

    it('cannot update user balance directly (finance:edit)', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: managerUser.id });

      const form = new FormData();
      form.append('userId', targetUser.id);
      form.append('amount', '1000');
      form.append('reason', 'Direct credit test');

      const res = await updateBalanceAction(form);
      expect(res.success).toBe(false);
      expect((res as any).error).toContain('Forbidden');
    });

    it('cannot approve balance adjustment (balance_approvals:edit)', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: managerUser.id });

      const form = new FormData();
      form.append('id', testAdjustment.id);

      const res = await approveBalanceAdjustmentAction(form);
      expect(res.success).toBe(false);
      expect((res as any).error).toContain('Forbidden');
    });
  });

  describe('Cashier role permissions', () => {
    it('can approve balance adjustment requests (ADM-03: balance_approvals:edit)', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: cashierUser.id });

      const form = new FormData();
      form.append('id', testAdjustment.id);

      const res = await approveBalanceAdjustmentAction(form);
      expect(res.success).toBe(true);

      const updated = await db.manualBalanceAdjustment.findUnique({ where: { id: testAdjustment.id } });
      expect(['APPROVED', 'EXECUTED']).toContain(updated?.status);
    });

    it('cannot ban user without clients permission', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: cashierUser.id });

      const banForm = new FormData();
      banForm.append('userId', targetUser.id);

      const res = await banUserAction(banForm);
      expect(res.success).toBe(false);
      expect((res as any).error).toContain('Forbidden');
    });

    it('Cashier UI access: opens balance-requests but is blocked from finance main dashboard (ADM-03 patch 0006)', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: cashierUser.id });

      // 1. Passes Finance Layout coarse gate
      const layoutUser = await enforceAnySectionAccess(['finance', 'balance_requests', 'balance_stats']);
      expect(layoutUser.id).toBe(cashierUser.id);

      // 2. Passes /admin/finance/balance-requests page gate
      const balanceRequestsUser = await enforceSectionAccess('balance_requests');
      expect(balanceRequestsUser.id).toBe(cashierUser.id);

      // 3. Passes /admin/finance/balance-requests/stats page gate
      const statsUser = await enforceSectionAccess('balance_stats');
      expect(statsUser.id).toBe(cashierUser.id);

      // 4. Blocked from /admin/finance (main dashboard)
      await expect(enforceSectionAccess('finance')).rejects.toThrow();

      // 5. Blocked from /admin/finance/support-review
      await expect(enforceSectionAccess('finance')).rejects.toThrow();
    });
  });

  describe('loginAs impersonation security', () => {
    it('MANAGER cannot login as user (restricted to OWNER/ADMIN)', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: managerUser.id });

      const form = new FormData();
      form.append('userId', targetUser.id);

      const res = await loginAsAction(form);
      expect(res.success).toBe(false);
      expect((res as any).error).toContain('Forbidden');
    });

    it('OWNER can login as user', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: ownerUser.id });

      const form = new FormData();
      form.append('userId', targetUser.id);

      const res = await loginAsAction(form);
      expect(res.success).toBe(true);
    });
  });
});
