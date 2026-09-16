import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { db } from '@/lib/db';
import { verifySession } from '@/lib/session';
import { requestCardRefundAction } from '@/actions/admin/users';
import { 
  approveBalanceAdjustmentAction, 
  rejectBalanceAdjustmentAction, 
  cancelBalanceAdjustmentRequestAction 
} from '@/actions/admin/balance-adjustments';
import { PaymentGatewayFactory } from '@/services/financial/payment-gateway.service';

// Mock headers and cookies for Server Actions
const mockCookieStore = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
const mockHeadersStore = new Headers({ 'x-forwarded-for': '127.0.0.1', 'user-agent': 'vitest-qa-agent' });

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => mockHeadersStore),
  cookies: vi.fn(async () => mockCookieStore),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock('@/lib/session', async (importOriginal: any) => {
  const actual = await importOriginal();
  return {
    ...actual,
    verifySession: vi.fn(),
  };
});

describe('🏆 YooKassa Enterprise QA Test Suite (Dual-Custody, 54-FZ & FinTech Security)', () => {
  let ownerUser: any;
  let financierUser: any;
  let supportStaff: any;
  let clientUser: any;
  let succeededPayment: any;
  let pendingPayment: any;

  beforeEach(async () => {
    // 1. Ensure system settings in test mode
    await db.systemSettings.upsert({
      where: { id: 'smmplan' },
      update: { isTestMode: true, exchangeRateUSD: 100.0 },
      create: { id: 'smmplan', isTestMode: true, exchangeRateUSD: 100.0 },
    });

    const timestamp = Date.now() + Math.random().toString(36).slice(2, 6);

    // 2. Roles Setup
    ownerUser = await db.user.create({
      data: {
        email: `qa_owner_${timestamp}@smmplan.local`,
        role: 'OWNER',
        isActive: true,
        balance: BigInt(0),
      },
    });

    financierUser = await db.user.create({
      data: {
        email: `qa_financier_${timestamp}@smmplan.local`,
        role: 'ADMIN',
        isActive: true,
        balance: BigInt(0),
      },
    });

    supportStaff = await db.user.create({
      data: {
        email: `qa_support_${timestamp}@smmplan.local`,
        role: 'SUPPORT',
        isActive: true,
        balance: BigInt(0),
      },
    });

    clientUser = await db.user.create({
      data: {
        email: `qa_client_${timestamp}@smmplan.local`,
        role: 'USER',
        isActive: true,
        balance: BigInt(200000), // 2 000.00 ₽ initial balance
      },
    });

    // 3. Payments Setup
    succeededPayment = await db.payment.create({
      data: {
        userId: clientUser.id,
        amount: BigInt(150000), // 1 500.00 ₽ payment
        currency: 'RUB',
        status: 'SUCCEEDED',
        gateway: 'yookassa',
        gatewayId: `yoo_test_mock_${timestamp}_succ`,
        tenantId: 'smmplan',
      },
    });

    pendingPayment = await db.payment.create({
      data: {
        userId: clientUser.id,
        amount: BigInt(50000), // 500.00 ₽ pending payment
        currency: 'RUB',
        status: 'PENDING',
        gateway: 'yookassa',
        gatewayId: `yoo_test_mock_${timestamp}_pend`,
        tenantId: 'smmplan',
      },
    });
  });

  afterEach(async () => {
    await db.staffRole.deleteMany({ where: { name: { startsWith: 'Supervisor_' } } }).catch(() => {});
    const userIds = [ownerUser?.id, financierUser?.id, supportStaff?.id, clientUser?.id].filter(Boolean);
    if (userIds.length > 0) {
      await db.manualBalanceAdjustment.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { requestedBy: { in: userIds } }, { approvedBy: { in: userIds } }, { rejectedBy: { in: userIds } }] } }).catch(() => {});
      await db.payment.deleteMany({ where: { userId: { in: userIds } } }).catch(() => {});
      await db.ledgerEntry.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { adminId: { in: userIds } }] } }).catch(() => {});
      await db.adminAuditLog.deleteMany({ where: { adminId: { in: userIds } } }).catch(() => {});
      await db.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => {});
    }
  });

  afterAll(async () => {
    await db.staffRole.deleteMany({ where: { name: { startsWith: 'Supervisor_' } } }).catch(() => {});
  });

  // ==========================================
  // SECTION 1: HAPPY PATH & DUAL CUSTODY FLOWS
  // ==========================================
  describe('1. Happy Path & Dual Custody Approval Flows', () => {
    it('QA-01: Full Lifecycle — Support initiates, Financier approves -> YooKassa executes, 54-FZ receipt attached, 0 double debit', async () => {
      // Step A: Support Operator initiates refund for 1 000 ₽
      (verifySession as any).mockResolvedValue({
        userId: supportStaff.id,
        email: supportStaff.email,
        role: supportStaff.role,
      });

      const fd = new FormData();
      fd.append('userId', clientUser.id);
      fd.append('paymentId', succeededPayment.id);
      fd.append('amountKopecks', '100000'); // 1 000.00 ₽
      fd.append('reason', 'Возврат по обращению тикета #1042');

      const reqRes = await requestCardRefundAction(fd);
      expect(reqRes.success).toBe(true);

      // Invariant: Balance held immediately (2000 - 1000 = 1000 ₽)
      const clientAfterReq = await db.user.findUniqueOrThrow({ where: { id: clientUser.id } });
      expect(clientAfterReq.balance).toBe(BigInt(100000));

      const adj = await db.manualBalanceAdjustment.findFirstOrThrow({
        where: { paymentId: succeededPayment.id, reasonCode: 'REFUND_TO_CARD' },
      });
      expect(adj.status).toBe('PENDING_APPROVAL');
      expect(adj.amount).toBe(BigInt(100000));

      // Step B: Financier approves
      (verifySession as any).mockResolvedValue({
        userId: financierUser.id,
        email: financierUser.email,
        role: financierUser.role,
      });

      const approveFd = new FormData();
      approveFd.append('id', adj.id);

      const approveRes = await approveBalanceAdjustmentAction(approveFd);
      expect(approveRes.success).toBe(true);

      // Invariant: Status becomes EXECUTED
      const adjFinal = await db.manualBalanceAdjustment.findUniqueOrThrow({ where: { id: adj.id } });
      expect(adjFinal.status).toBe('EXECUTED');
      expect(adjFinal.approvedBy).toBe(financierUser.id);

      // Invariant: Double debit check -> Balance remains EXACTLY 1 000 ₽
      const clientFinal = await db.user.findUniqueOrThrow({ where: { id: clientUser.id } });
      expect(clientFinal.balance).toBe(BigInt(100000));

      // Invariant: Payment receives fiscal refundReceiptId
      const paymentFinal = await db.payment.findUniqueOrThrow({ where: { id: succeededPayment.id } });
      expect(paymentFinal.refundReceiptId).toBeDefined();
      expect(paymentFinal.refundReceiptId).toMatch(/^mock_refund_/);
    });

    it('QA-02: Rejection Flow — Financier rejects -> Reserved balance restored to client instantly', async () => {
      (verifySession as any).mockResolvedValue({
        userId: supportStaff.id,
        email: supportStaff.email,
        role: supportStaff.role,
      });

      const fd = new FormData();
      fd.append('userId', clientUser.id);
      fd.append('paymentId', succeededPayment.id);
      fd.append('amountKopecks', '60000'); // 600.00 ₽
      fd.append('reason', 'Клиент запросил возврат');

      await requestCardRefundAction(fd);

      // Balance held: 2000 - 600 = 1400 ₽
      const clientAfterReq = await db.user.findUniqueOrThrow({ where: { id: clientUser.id } });
      expect(clientAfterReq.balance).toBe(BigInt(140000));

      const adj = await db.manualBalanceAdjustment.findFirstOrThrow({
        where: { paymentId: succeededPayment.id, reasonCode: 'REFUND_TO_CARD' },
      });

      // Financier rejects with explanation
      (verifySession as any).mockResolvedValue({
        userId: financierUser.id,
        email: financierUser.email,
        role: financierUser.role,
      });

      const rejectFd = new FormData();
      rejectFd.append('id', adj.id);
      rejectFd.append('rejectionReason', 'Заказ был выполнен в полном объеме, возврат не согласован');

      const rejectRes = await rejectBalanceAdjustmentAction(rejectFd);
      expect(rejectRes.success).toBe(true);

      // Invariant: Balance fully restored to 2 000.00 ₽
      const clientFinal = await db.user.findUniqueOrThrow({ where: { id: clientUser.id } });
      expect(clientFinal.balance).toBe(BigInt(200000));

      const adjFinal = await db.manualBalanceAdjustment.findUniqueOrThrow({ where: { id: adj.id } });
      expect(adjFinal.status).toBe('REJECTED');
      expect(adjFinal.rejectionReason).toContain('Заказ был выполнен');
    });

    it('QA-03: Requester Cancellation — Support cancels own request -> Funds restored immediately', async () => {
      (verifySession as any).mockResolvedValue({
        userId: supportStaff.id,
        email: supportStaff.email,
        role: supportStaff.role,
      });

      const fd = new FormData();
      fd.append('userId', clientUser.id);
      fd.append('paymentId', succeededPayment.id);
      fd.append('amountKopecks', '45000'); // 450.00 ₽
      fd.append('reason', 'Заявка по ошибке');

      await requestCardRefundAction(fd);

      const adj = await db.manualBalanceAdjustment.findFirstOrThrow({
        where: { paymentId: succeededPayment.id, reasonCode: 'REFUND_TO_CARD' },
      });

      // Support cancels own request
      const cancelFd = new FormData();
      cancelFd.append('id', adj.id);

      const cancelRes = await cancelBalanceAdjustmentRequestAction(cancelFd);
      expect(cancelRes.success).toBe(true);

      // Invariant: Balance restored to 2 000.00 ₽
      const clientFinal = await db.user.findUniqueOrThrow({ where: { id: clientUser.id } });
      expect(clientFinal.balance).toBe(BigInt(200000));

      const adjFinal = await db.manualBalanceAdjustment.findUniqueOrThrow({ where: { id: adj.id } });
      expect(adjFinal.status).toBe('CANCELED');
    });
  });

  // ===============================================
  // SECTION 2: ADVERSARIAL & BOUNDARY TESTING (OWASP)
  // ===============================================
  describe('2. Adversarial & Boundary Safety Checks', () => {
    it('QA-04: Ceiling Limit — Cannot request refund exceeding remaining refundable amount of the payment', async () => {
      (verifySession as any).mockResolvedValue({
        userId: supportStaff.id,
        email: supportStaff.email,
        role: supportStaff.role,
      });

      // Payment amount is 1 500.00 ₽. Attempt to refund 1 500.01 ₽ (150001 kopecks) -> MUST FAIL
      const fd = new FormData();
      fd.append('userId', clientUser.id);
      fd.append('paymentId', succeededPayment.id);
      fd.append('amountKopecks', '150001');
      fd.append('reason', 'Попытка овер-возврата');

      const res = await requestCardRefundAction(fd);
      expect(res.success).toBe(false);
      expect(res.error).toContain('превышает доступный остаток');
    });

    it('QA-05: Sliced Multi-Refunds — Allows multiple partial refunds up to exact 100%, blocks the N+1 slice', async () => {
      (verifySession as any).mockResolvedValue({
        userId: supportStaff.id,
        email: supportStaff.email,
        role: supportStaff.role,
      });

      // Succeeded payment is 1 500.00 ₽ (150 000 kopecks)
      // Slice 1: 500 ₽
      const fd1 = new FormData();
      fd1.append('userId', clientUser.id);
      fd1.append('paymentId', succeededPayment.id);
      fd1.append('amountKopecks', '50000');
      fd1.append('reason', 'Частичный возврат 1');
      const res1 = await requestCardRefundAction(fd1);
      expect(res1.success).toBe(true);

      // Slice 2: 700 ₽ (Total pending: 1 200 ₽, remaining available: 300 ₽)
      const fd2 = new FormData();
      fd2.append('userId', clientUser.id);
      fd2.append('paymentId', succeededPayment.id);
      fd2.append('amountKopecks', '70000');
      fd2.append('reason', 'Частичный возврат 2');
      const res2 = await requestCardRefundAction(fd2);
      expect(res2.success).toBe(true);

      // Slice 3: Attempt 301 ₽ (exceeds remaining 300 ₽) -> MUST BE BLOCKED
      const fd3 = new FormData();
      fd3.append('userId', clientUser.id);
      fd3.append('paymentId', succeededPayment.id);
      fd3.append('amountKopecks', '30100');
      fd3.append('reason', 'Превышение остатка');
      const res3 = await requestCardRefundAction(fd3);
      expect(res3.success).toBe(false);
      expect(res3.error).toContain('превышает доступный остаток');

      // Slice 4: Exact remaining 300 ₽ -> MUST SUCCEED
      const fd4 = new FormData();
      fd4.append('userId', clientUser.id);
      fd4.append('paymentId', succeededPayment.id);
      fd4.append('amountKopecks', '30000');
      fd4.append('reason', 'Остаток возврата');
      const res4 = await requestCardRefundAction(fd4);
      expect(res4.success).toBe(true);
    });

    it('QA-06: Overdraft / Insufficient Client Balance — Blocks refund if client already spent their funds', async () => {
      // Set client balance to only 100.00 ₽ (despite payment being 1 500.00 ₽)
      await db.user.update({
        where: { id: clientUser.id },
        data: { balance: BigInt(10000) }, // 100 ₽
      });

      (verifySession as any).mockResolvedValue({
        userId: supportStaff.id,
        email: supportStaff.email,
        role: supportStaff.role,
      });

      const fd = new FormData();
      fd.append('userId', clientUser.id);
      fd.append('paymentId', succeededPayment.id);
      fd.append('amountKopecks', '50000'); // 500 ₽
      fd.append('reason', 'Возврат при нулевом остатке');

      const res = await requestCardRefundAction(fd);
      expect(res.success).toBe(false);
      expect(res.error).toContain('Недостаточно средств на балансе клиента');
    });

    it('QA-07: Payment Status Check — Cannot refund unconfirmed / PENDING payments', async () => {
      (verifySession as any).mockResolvedValue({
        userId: supportStaff.id,
        email: supportStaff.email,
        role: supportStaff.role,
      });

      const fd = new FormData();
      fd.append('userId', clientUser.id);
      fd.append('paymentId', pendingPayment.id); // PENDING payment
      fd.append('amountKopecks', '50000');
      fd.append('reason', 'Возврат неоплаченного');

      const res = await requestCardRefundAction(fd);
      expect(res.success).toBe(false);
      expect(res.error).toContain('успешно оплаченных платежей');
    });

    it('QA-08: Zero and Negative Amounts — Reject invalid input', async () => {
      (verifySession as any).mockResolvedValue({
        userId: supportStaff.id,
        email: supportStaff.email,
        role: supportStaff.role,
      });

      // Zero
      const fdZero = new FormData();
      fdZero.append('userId', clientUser.id);
      fdZero.append('paymentId', succeededPayment.id);
      fdZero.append('amountKopecks', '0');
      fdZero.append('reason', 'Ноль рублей');
      const resZero = await requestCardRefundAction(fdZero);
      expect(resZero.success).toBe(false);
      expect(resZero.error).toContain('больше 0');

      // Negative
      const fdNeg = new FormData();
      fdNeg.append('userId', clientUser.id);
      fdNeg.append('paymentId', succeededPayment.id);
      fdNeg.append('amountKopecks', '-50000');
      fdNeg.append('reason', 'Отрицательная сумма');
      const resNeg = await requestCardRefundAction(fdNeg);
      expect(resNeg.success).toBe(false);
      expect(resNeg.error).toContain('больше 0');
    });

    it('QA-09: Self-Approval Prevention & RBAC — Staff cannot approve their own refund requests', async () => {
      // Step A: Create staff role with both request & approval permissions
      const supervisorRole = await db.staffRole.create({
        data: {
          name: `Supervisor_${Date.now()}`,
          tenantId: 'smmplan',
          permissions: {
            create: [
              { section: 'BALANCE_REQUESTS', canView: true, canEdit: true },
              { section: 'BALANCE_APPROVALS', canView: true, canEdit: true },
            ],
          },
        },
      });

      await db.user.update({
        where: { id: supportStaff.id },
        data: { staffRoleId: supervisorRole.id },
      });

      (verifySession as any).mockResolvedValue({
        userId: supportStaff.id,
        email: supportStaff.email,
        role: supportStaff.role,
      });

      const fd = new FormData();
      fd.append('userId', clientUser.id);
      fd.append('paymentId', succeededPayment.id);
      fd.append('amountKopecks', '30000');
      fd.append('reason', 'Тест само-аппрува саппортом');
      await requestCardRefundAction(fd);

      const adj = await db.manualBalanceAdjustment.findFirstOrThrow({
        where: { paymentId: succeededPayment.id, reasonCode: 'REFUND_TO_CARD', requestedBy: supportStaff.id },
      });

      // Step B: Same Staff tries to approve their own request -> MUST BE BLOCKED BY SELF-APPROVAL INVARIANT
      const approveFd = new FormData();
      approveFd.append('id', adj.id);

      const approveRes = await approveBalanceAdjustmentAction(approveFd);
      expect(approveRes.success).toBe(false);
      expect(approveRes.error).toContain('собственную заявку');

      // Step C: Other authorized user (Owner) can approve it
      (verifySession as any).mockResolvedValue({
        userId: ownerUser.id,
        email: ownerUser.email,
        role: ownerUser.role,
      });

      const ownerApproveRes = await approveBalanceAdjustmentAction(approveFd);
      expect(ownerApproveRes.success).toBe(true);
    });

    it('QA-09B: Sovereign Rights — Owner CAN approve their own refund and balance requests', async () => {
      // Step A: Owner creates a refund request for 250 ₽
      (verifySession as any).mockResolvedValue({
        userId: ownerUser.id,
        email: ownerUser.email,
        role: ownerUser.role,
      });

      const fd = new FormData();
      fd.append('userId', clientUser.id);
      fd.append('paymentId', succeededPayment.id);
      fd.append('amountKopecks', '25000');
      fd.append('reason', 'Возврат, инициированный лично Владельцем');
      const reqRes = await requestCardRefundAction(fd);
      expect(reqRes.success).toBe(true);

      const adj = await db.manualBalanceAdjustment.findFirstOrThrow({
        where: { paymentId: succeededPayment.id, reasonCode: 'REFUND_TO_CARD', requestedBy: ownerUser.id },
      });

      // Step B: Owner directly approves their own request -> MUST SUCCEED
      const approveFd = new FormData();
      approveFd.append('id', adj.id);

      const approveRes = await approveBalanceAdjustmentAction(approveFd);
      expect(approveRes.success).toBe(true);

      const finalAdj = await db.manualBalanceAdjustment.findUniqueOrThrow({ where: { id: adj.id } });
      expect(finalAdj.status).toBe('EXECUTED');
      expect(finalAdj.approvedBy).toBe(ownerUser.id);
    });

    it('QA-10: Idempotency Double-Click — Rapid successive calls with same key do not create duplicate debits', async () => {
      (verifySession as any).mockResolvedValue({
        userId: supportStaff.id,
        email: supportStaff.email,
        role: supportStaff.role,
      });

      const sharedKey = `idemp-race-${Date.now()}`;
      const fd = new FormData();
      fd.append('userId', clientUser.id);
      fd.append('paymentId', succeededPayment.id);
      fd.append('amountKopecks', '20000'); // 200 ₽
      fd.append('reason', 'Проверка двойного клика');
      fd.append('idempotencyKey', sharedKey);

      // First click
      const res1 = await requestCardRefundAction(fd);
      expect(res1.success).toBe(true);

      // Immediate second click with same key
      const res2 = await requestCardRefundAction(fd);
      expect(res2.success).toBe(true);
      if (res2.success) {
        expect(res2.message).toContain('защита от двойного клика');
      }

      // Balance only deducted once: 2000 - 200 = 1800 ₽
      const clientFinal = await db.user.findUniqueOrThrow({ where: { id: clientUser.id } });
      expect(clientFinal.balance).toBe(BigInt(180000));
    });
  });
});