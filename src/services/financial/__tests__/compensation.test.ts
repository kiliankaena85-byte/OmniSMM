import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { logManualCompensation } from '@/actions/support/compensation';
import { WalletOps } from '../wallet-ops';

// Helper to create FormData mock
function createCompensationFormData(params: {
  ticketId: string;
  costRub: string;
  note: string;
  topUpBalance: string;
  clientOperationToken?: string;
}): FormData {
  const fd = new FormData();
  fd.append('ticketId', params.ticketId);
  fd.append('costRub', params.costRub);
  fd.append('note', params.note);
  fd.append('topUpBalance', params.topUpBalance);
  if (params.clientOperationToken) {
    fd.append('clientOperationToken', params.clientOperationToken);
  }
  return fd;
}

// Mock the permission handler wrapper since RBAC requires session context
vi.mock('@/lib/server/rbac', () => {
  return {
    requireStaffPermission: vi.fn().mockImplementation(async (permission, action, fn) => {
      // Find the mocked staff user
      const user = await db.user.findFirst({
        where: { role: { in: ['SUPPORT', 'MANAGER', 'OWNER'] } },
      });
      if (!user) throw new Error('No staff user found for test context');
      return fn(user);
    }),
  };
});

describe('Compensation Service Unit Tests', () => {
  let staffUser: any;
  let targetUser: any;
  let ticket: any;

  beforeEach(async () => {
    // Upsert tenant
    

    staffUser = await db.user.create({
      data: {
        email: 'support@example.com',
        role: 'SUPPORT',
        supportLimitCents: 5000, // 50.00 RUB budget limit
        preferredDashboard: 'CLASSIC',
      },
    });

    targetUser = await db.user.create({
      data: {
        email: 'client@example.com',
        role: 'USER',
        preferredDashboard: 'CLASSIC',
      },
    });

    ticket = await db.ticket.create({
      data: {
        userId: targetUser.id,
        subject: 'Support request',
        status: 'OPEN',
      },
    });

    // Accept legal consent for staff
    await db.employeeResponsibilityConsent.create({
      data: {
        userId: staffUser.id,
        status: 'ACTIVE',
        acceptedIp: '127.0.0.1',
        acceptedUserAgent: 'test',
        documentHash: 'test-hash',
      },
    });

    // Active Global Policy
    await db.balanceAdjustmentPolicy.create({
      data: {
        scopeType: 'GLOBAL',
        isActive: true,
        enabled: true,
        canRequestCredit: true,
        allowedCreditReasonCodes: JSON.stringify(['COMPENSATION_BALANCE', 'COMPENSATION_REFILL']),
        allowedDebitReasonCodes: JSON.stringify([]),
        allowedTargetRoles: JSON.stringify(['USER']),
        requireTicket: true,
      },
    });
  });

  it('logManualCompensation creates WalletOps.credit when topUpBalance is true', async () => {
    const fd = createCompensationFormData({
      ticketId: ticket.id,
      costRub: '15.00',
      note: 'Compensation for connection failure',
      topUpBalance: 'true',
    });

    const res = await logManualCompensation(fd);
    expect(res.success).toBe(true);

    const user = await db.user.findUniqueOrThrow({ where: { id: targetUser.id } });
    expect(user.balance).toBe(BigInt(1500)); // 15.00 RUB credited

    // Verify SupportFinancialAction is created
    const financialAction = await db.supportFinancialAction.findFirst({
      where: { staffUserId: staffUser.id, targetUserId: targetUser.id },
    });
    expect(financialAction).toBeDefined();
    expect(financialAction?.amountCents).toBe(BigInt(1500));
    expect(financialAction?.status).toBe('EXECUTED');
  });

  it('logManualCompensation limits check blocks exceeding supportLimitCents budget limit', async () => {
    const fd = createCompensationFormData({
      ticketId: ticket.id,
      costRub: '60.00', // Exceeds staffUser's 50.00 RUB budget limit
      note: 'Compensation exceeding budget limits',
      topUpBalance: 'true',
    });

    const res = await logManualCompensation(fd);
    expect(res.success).toBe(false);
    expect(res.error).toContain('бюджет');

    const user = await db.user.findUniqueOrThrow({ where: { id: targetUser.id } });
    expect(user.balance).toBe(BigInt(0)); // Balance remains 0
  });

  it('idempotencyKey prevents double compensation payout', async () => {
    const fd = createCompensationFormData({
      ticketId: ticket.id,
      costRub: '10.00',
      note: 'Compensation for connection failure',
      topUpBalance: 'true',
      clientOperationToken: 'token-idem-123',
    });

    const res1 = await logManualCompensation(fd);
    expect(res1.success).toBe(true);

    const res2 = await logManualCompensation(fd);
    // Second attempt with same token is blocked by unique constraint on idempotencyKey
    // The action catches the DB error and returns success: false — this is correct behavior,
    // preventing double-payout. The credit is NOT duplicated.
    expect(res2.success).toBe(false);

    const user = await db.user.findUniqueOrThrow({ where: { id: targetUser.id } });
    expect(user.balance).toBe(BigInt(1000)); // Only credited once!
  });
});
