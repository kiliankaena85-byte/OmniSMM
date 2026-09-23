import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { db } from '@/lib/db';
import { verifySession } from '@/lib/session';
import { requestCardRefundAction } from '@/actions/admin/users';
import { 
  approveBalanceAdjustmentAction, 
  rejectBalanceAdjustmentAction, 
  cancelBalanceAdjustmentRequestAction 
} from '@/actions/admin/balance-adjustments';

// Mock cookies and headers
const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

const mockHeadersStore = new Headers({
  'x-forwarded-for': '127.0.0.1',
  'user-agent': 'vitest-agent',
});

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

describe('Dual-Custody YooKassa Automated Refund Suite', () => {
  let ownerUser: any;
  let supportStaff: any;
  let clientUser: any;
  let testPayment: any;

  beforeEach(async () => {
    await db.systemSettings.upsert({
      where: { id: 'smmplan' },
      update: { isTestMode: true, exchangeRateUSD: 100.0 },
      create: { id: 'smmplan', isTestMode: true, exchangeRateUSD: 100.0 },
    });

    const timestamp = Date.now() + Math.random().toString(36).slice(2, 6);

    ownerUser = await db.user.create({
      data: {
        email: `owner_fin_${timestamp}@smmplan.local`,
        role: 'OWNER',
        isActive: true,
        balance: BigInt(0),
      },
    });

    supportStaff = await db.user.create({
      data: {
        email: `support_fin_${timestamp}@smmplan.local`,
        role: 'SUPPORT',
        isActive: true,
        balance: BigInt(0),
        supportLimitCents: 500000,
        supportSpentTodayCents: 0,
      },
    });

    clientUser = await db.user.create({
      data: {
        email: `client_fin_${timestamp}@smmplan.local`,
        role: 'USER',
        isActive: true,
        balance: BigInt(100000), // 1 000.00 ₽ initial balance
      },
    });

    testPayment = await db.payment.create({
      data: {
        userId: clientUser.id,
        amount: BigInt(100000), // 1 000.00 ₽ payment
        currency: 'RUB',
        status: 'SUCCEEDED',
        gateway: 'yookassa',
        gatewayId: `yoo_test_mock_${timestamp}`,
        tenantId: 'smmplan',
      },
    });
  });

  afterEach(async () => {
    const userIds = [ownerUser?.id, supportStaff?.id, clientUser?.id].filter(Boolean);
    if (userIds.length > 0) {
      await db.manualBalanceAdjustment.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { requestedBy: { in: userIds } }, { approvedBy: { in: userIds } }, { rejectedBy: { in: userIds } }] } }).catch(() => {});
      await db.payment.deleteMany({ where: { userId: { in: userIds } } }).catch(() => {});
      await db.ledgerEntry.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { adminId: { in: userIds } }] } }).catch(() => {});
      await db.adminAuditLog.deleteMany({ where: { adminId: { in: userIds } } }).catch(() => {});
      await db.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => {});
    }
  });

  // TEST 1: End-to-End Approval with Mock Gateway Execution
  it('support requests refund -> balance held -> owner approves -> executed via YooKassa without double debit', async () => {
    // 1. Support creates refund request for 400 ₽
    (verifySession as any).mockResolvedValue({
      userId: supportStaff.id,
      email: supportStaff.email,
      role: supportStaff.role,
    });

    const refundKey = `refund-e2e-${Date.now()}`;
    const fd = new FormData();
    fd.append('userId', clientUser.id);
    fd.append('paymentId', testPayment.id);
    fd.append('amountKopecks', '40000'); // 400.00 ₽
    fd.append('reason', 'Возврат по запросу клиента');
    fd.append('idempotencyKey', refundKey);

    const reqRes = await requestCardRefundAction(fd);
    expect(reqRes.success).toBe(true);

    // Balance held immediately: 1000 - 400 = 600 ₽
    const clientAfterReq = await db.user.findUniqueOrThrow({ where: { id: clientUser.id } });
    expect(clientAfterReq.balance).toBe(BigInt(60000));

    const adj = await db.manualBalanceAdjustment.findFirstOrThrow({
      where: { paymentId: testPayment.id, reasonCode: 'REFUND_TO_CARD' },
    });
    expect(adj.status).toBe('PENDING_APPROVAL');

    // 2. Owner approves the refund request
    (verifySession as any).mockResolvedValue({
      userId: ownerUser.id,
      email: ownerUser.email,
      role: ownerUser.role,
    });

    const approveFd = new FormData();
    approveFd.append('id', adj.id);

    const approveRes = await approveBalanceAdjustmentAction(approveFd); if (!approveRes.success) console.log('APPROVE_ERROR:', approveRes);
    expect(approveRes.success).toBe(true);

    // 3. Verify final state
    const adjFinal = await db.manualBalanceAdjustment.findUniqueOrThrow({ where: { id: adj.id } });
    expect(adjFinal.status).toBe('EXECUTED');
    expect(adjFinal.approvedBy).toBe(ownerUser.id);

    // Verify balance remains 600 ₽ (NO DOUBLE DEBIT)
    const clientAfterApprove = await db.user.findUniqueOrThrow({ where: { id: clientUser.id } });
    expect(clientAfterApprove.balance).toBe(BigInt(60000));

    // Verify Payment received refund receipt id
    const paymentFinal = await db.payment.findUniqueOrThrow({ where: { id: testPayment.id } });
    expect(paymentFinal.refundReceiptId).toBeDefined();
    expect(paymentFinal.refundReceiptId).not.toBeNull();
  });

  // TEST 2: Rejection refunds held funds back to client balance
  it('support requests refund -> balance held -> owner rejects -> funds restored to balance', async () => {
    // 1. Support creates refund request for 300 ₽
    (verifySession as any).mockResolvedValue({
      userId: supportStaff.id,
      email: supportStaff.email,
      role: supportStaff.role,
    });

    const fd = new FormData();
    fd.append('userId', clientUser.id);
    fd.append('paymentId', testPayment.id);
    fd.append('amountKopecks', '30000'); // 300.00 ₽
    fd.append('reason', 'Запрос на возврат 300 руб');

    const reqRes = await requestCardRefundAction(fd);
    expect(reqRes.success).toBe(true);

    const clientAfterReq = await db.user.findUniqueOrThrow({ where: { id: clientUser.id } });
    expect(clientAfterReq.balance).toBe(BigInt(70000)); // 1000 - 300 = 700 ₽

    const adj = await db.manualBalanceAdjustment.findFirstOrThrow({
      where: { paymentId: testPayment.id, reasonCode: 'REFUND_TO_CARD' },
    });

    // 2. Owner rejects the request
    (verifySession as any).mockResolvedValue({
      userId: ownerUser.id,
      email: ownerUser.email,
      role: ownerUser.role,
    });

    const rejectFd = new FormData();
    rejectFd.append('id', adj.id);
    rejectFd.append('rejectionReason', 'Услуга уже оказана в полном объеме');

    const rejectRes = await rejectBalanceAdjustmentAction(rejectFd);
    expect(rejectRes.success).toBe(true);

    // 3. Balance restored to 1 000.00 ₽
    const clientAfterReject = await db.user.findUniqueOrThrow({ where: { id: clientUser.id } });
    expect(clientAfterReject.balance).toBe(BigInt(100000));

    const adjFinal = await db.manualBalanceAdjustment.findUniqueOrThrow({ where: { id: adj.id } });
    expect(adjFinal.status).toBe('REJECTED');
    expect(adjFinal.rejectionReason).toBe('Услуга уже оказана в полном объеме');
  });

  // TEST 3: Cancellation by support requester returns funds to balance
  it('support requests refund -> cancels own request -> funds restored to balance', async () => {
    (verifySession as any).mockResolvedValue({
      userId: supportStaff.id,
      email: supportStaff.email,
      role: supportStaff.role,
    });

    const fd = new FormData();
    fd.append('userId', clientUser.id);
    fd.append('paymentId', testPayment.id);
    fd.append('amountKopecks', '50000'); // 500.00 ₽
    fd.append('reason', 'Ошибочно создал заявку');

    await requestCardRefundAction(fd);

    const clientAfterReq = await db.user.findUniqueOrThrow({ where: { id: clientUser.id } });
    expect(clientAfterReq.balance).toBe(BigInt(50000)); // 1000 - 500 = 500 ₽

    const adj = await db.manualBalanceAdjustment.findFirstOrThrow({
      where: { paymentId: testPayment.id, reasonCode: 'REFUND_TO_CARD' },
    });

    // Cancel own request
    const cancelFd = new FormData();
    cancelFd.append('id', adj.id);

    const cancelRes = await cancelBalanceAdjustmentRequestAction(cancelFd);
    expect(cancelRes.success).toBe(true);

    // Balance restored to 1000 ₽
    const clientAfterCancel = await db.user.findUniqueOrThrow({ where: { id: clientUser.id } });
    expect(clientAfterCancel.balance).toBe(BigInt(100000));
  });

  // TEST 4: Cumulative Refund Ceiling Enforcement
  it('blocks refund requests exceeding remaining refundable amount of the payment', async () => {
    (verifySession as any).mockResolvedValue({
      userId: supportStaff.id,
      email: supportStaff.email,
      role: supportStaff.role,
    });

    // First refund request for 700 ₽ (Payment is 1000 ₽) -> Succeeds
    const fd1 = new FormData();
    fd1.append('userId', clientUser.id);
    fd1.append('paymentId', testPayment.id);
    fd1.append('amountKopecks', '70000');
    fd1.append('reason', 'Первая часть возврата');

    const res1 = await requestCardRefundAction(fd1);
    expect(res1.success).toBe(true);

    // Second refund request for 400 ₽ (Remaining is only 300 ₽) -> Blocked!
    const fd2 = new FormData();
    fd2.append('userId', clientUser.id);
    fd2.append('paymentId', testPayment.id);
    fd2.append('amountKopecks', '40000');
    fd2.append('reason', 'Вторая часть возврата');

    const res2 = await requestCardRefundAction(fd2);
    expect(res2.success).toBe(false);
    expect(res2.error).toContain('превышает доступный остаток');
  });
});