import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { manualApprovePaymentAction } from '@/actions/admin/finance/payments';
import { assignShiftAction, swapShiftAction } from '@/actions/admin/shifts';
import { verifySession } from '@/lib/session';

vi.mock('@/lib/session', () => ({
  verifySession: vi.fn(),
  decryptSessionToken: vi.fn(),
  encryptSessionToken: vi.fn(),
}));

describe('🛡️ OWASP Top 10:2026 & Application Pentest Immunity Tests', () => {
  let ownerUser: { id: string; email: string };
  let adminUser: { id: string; email: string };
  let supportUser: { id: string; email: string; supportLimitCents: number };
  let regularCustomer: { id: string; email: string };
  let bannedUser: { id: string; email: string };

  beforeEach(async () => {
    // 1. Owner
    const owner = await db.user.create({
      data: {
        email: `owasp_owner_${Date.now()}_${Math.random()}@smmplan.pro`,
        role: 'OWNER',
        balance: BigInt(0),
        tenantId: 'smmplan',
      },
    });
    ownerUser = { id: owner.id, email: owner.email };

    // 2. Admin
    const admin = await db.user.create({
      data: {
        email: `owasp_admin_${Date.now()}_${Math.random()}@smmplan.pro`,
        role: 'ADMIN',
        balance: BigInt(0),
        tenantId: 'smmplan',
      },
    });
    adminUser = { id: admin.id, email: admin.email };

    // 3. Support with 3 000 RUB (300 000 cents) limit
    const support = await db.user.create({
      data: {
        email: `owasp_support_${Date.now()}_${Math.random()}@smmplan.pro`,
        role: 'SUPPORT',
        supportLimitCents: 300000,
        balance: BigInt(0),
        tenantId: 'smmplan',
      },
    });
    supportUser = { 
      id: support.id, 
      email: support.email, 
      supportLimitCents: support.supportLimitCents 
    };

    // 4. Regular Customer (USER)
    const customer = await db.user.create({
      data: {
        email: `owasp_cust_${Date.now()}_${Math.random()}@example.com`,
        role: 'USER',
        balance: BigInt(100000), // 1000 RUB
        tenantId: 'smmplan',
      },
    });
    regularCustomer = { id: customer.id, email: customer.email };

    // 5. Banned User
    const banned = await db.user.create({
      data: {
        email: `owasp_banned_${Date.now()}_${Math.random()}@badactor.com`,
        role: 'BANNED',
        balance: BigInt(0),
        tenantId: 'smmplan',
      },
    });
    bannedUser = { id: banned.id, email: banned.email };
  });

  describe('1. A01:2026 Broken Access Control & IDOR Defense', () => {
    it('Blocks regular USER from invoking manual payment approval Server Action', async () => {
      const payment = await db.payment.create({
        data: {
          userId: regularCustomer.id,
          amount: BigInt(100000),
          status: 'PENDING',
          gateway: 'yookassa',
          tenantId: 'smmplan',
        },
      });

      vi.mocked(verifySession).mockResolvedValue({
        userId: regularCustomer.id,
        email: regularCustomer.email,
        role: 'USER',
        tenantId: 'smmplan',
      } as any);

      const res = await manualApprovePaymentAction({
        paymentId: payment.id,
        gatewayTransactionId: `attack-tx-${Date.now()}`,
        notes: 'Malicious attempt by regular user',
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Forbidden|Unauthorized/i);
    });

    it('Blocks BANNED user from executing any admin staff actions', async () => {
      vi.mocked(verifySession).mockResolvedValue({
        userId: bannedUser.id,
        email: bannedUser.email,
        role: 'BANNED',
        tenantId: 'smmplan',
      } as any);

      const res = await assignShiftAction({
        userId: bannedUser.id,
        dateStr: '2026-09-12',
        shiftType: 'DAY',
        status: 'PLANNED',
        rateRubles: 2000,
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Forbidden|Unauthorized/i);
    });

    it('Enforces Grant Ceiling: Support cannot approve amounts exceeding their 3000 RUB limit', async () => {
      const payment = await db.payment.create({
        data: {
          userId: regularCustomer.id,
          amount: BigInt(300100), // 3 001.00 RUB (exceeds limit by 1 RUB)
          status: 'PENDING',
          gateway: 'yookassa',
          tenantId: 'smmplan',
        },
      });

      vi.mocked(verifySession).mockResolvedValue({
        userId: supportUser.id,
        email: supportUser.email,
        role: 'SUPPORT',
        tenantId: 'smmplan',
      } as any);

      const res = await manualApprovePaymentAction({
        paymentId: payment.id,
        gatewayTransactionId: `tampered-tx-${Date.now()}`,
        notes: 'Attempting to approve payment 1 RUB above limit',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('превышает ваш лимит ручного подтверждения');
    });

    it('Blocks Support from assigning shifts to arbitrary third parties (Self-Scheduling only)', async () => {
      vi.mocked(verifySession).mockResolvedValue({
        userId: supportUser.id,
        email: supportUser.email,
        role: 'SUPPORT',
        tenantId: 'smmplan',
      } as any);

      const res = await assignShiftAction({
        userId: regularCustomer.id, // Support trying to assign shift to someone else
        dateStr: '2026-09-12',
        shiftType: 'DAY',
        status: 'PLANNED',
        rateRubles: 2000,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('Вы можете выставлять смены только для себя');
    });
  });

  describe('2. A03:2026 Injection & CSV Sanitization Defense', () => {
    it('Accepts notes with potential CSV symbols safely without crashing or SQL injection', async () => {
      const payment = await db.payment.create({
        data: {
          userId: regularCustomer.id,
          amount: BigInt(50000), // 500 RUB
          status: 'PENDING',
          gateway: 'yookassa',
          tenantId: 'smmplan',
        },
      });

      vi.mocked(verifySession).mockResolvedValue({
        userId: ownerUser.id,
        email: ownerUser.email,
        role: 'OWNER',
        tenantId: 'smmplan',
      } as any);

      const ddePayload = "=cmd|'/C calc'!A0; ' OR '1'='1; --";
      const gatewayTxId = `sanitized-tx-${Date.now()}-${Math.random()}`;

      const res = await manualApprovePaymentAction({
        paymentId: payment.id,
        gatewayTransactionId: gatewayTxId,
        notes: ddePayload,
      });

      expect(res.success).toBe(true);

      // Verify DB stored note safely and did not execute SQL injection
      const updatedPayment = await db.payment.findUniqueOrThrow({ where: { id: payment.id } });
      expect(updatedPayment.status).toBe('SUCCEEDED');
      expect(updatedPayment.gatewayId).toBe(gatewayTxId);
    });
  });

  describe('3. A09:2026 Security Logging and Non-Repudiation', () => {
    it('Creates an immutable audit log with operator details on every manual payment approval', async () => {
      const payment = await db.payment.create({
        data: {
          userId: regularCustomer.id,
          amount: BigInt(150000), // 1 500 RUB
          status: 'PENDING',
          gateway: 'yookassa',
          tenantId: 'smmplan',
        },
      });

      vi.mocked(verifySession).mockResolvedValue({
        userId: adminUser.id,
        email: adminUser.email,
        role: 'ADMIN',
        tenantId: 'smmplan',
      } as any);

      const txId = `audit-log-tx-${Date.now()}-${Math.random()}`;
      const res = await manualApprovePaymentAction({
        paymentId: payment.id,
        gatewayTransactionId: txId,
        notes: 'Проверка фиксации аудита',
      });

      expect(res.success).toBe(true);

      // Check adminAuditLog table for entry
      const auditEntry = await db.adminAuditLog.findFirst({
        where: {
          target: payment.id,
          action: 'UPDATE_USER_BALANCE',
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(auditEntry).not.toBeNull();
      expect(auditEntry?.adminId).toBe(adminUser.id);
      expect(auditEntry?.adminEmail).toBe(adminUser.email);
      expect(auditEntry?.targetType).toBe('PAYMENT_MANUAL_APPROVE');
    });
  });
});
