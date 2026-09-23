import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { verifySession } from '@/lib/session';
import { requestCardRefundAction } from '@/actions/admin/users';
import { 
  approveBalanceAdjustmentAction, 
  getBalanceAdjustmentsAction 
} from '@/actions/admin/balance-adjustments';
import { CBRRateService } from '@/services/system/cbr-rate.service';
import { SettingsManager } from '@/lib/settings';

const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

const mockHeadersStore = new Headers({
  'x-forwarded-for': '127.0.0.1',
  'user-agent': 'vitest-step3-agent',
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

describe('Pre-Production Step 3: Robokassa Card Refund Guard & CBR Fallback Suite', () => {
  let ownerUser: any;
  let supportStaff: any;
  let clientUser: any;
  let roboPayment: any;

  beforeEach(async () => {
    await db.systemSettings.upsert({
      where: { id: 'smmplan' },
      update: { isTestMode: true, exchangeRateUSD: 100.0 },
      create: { id: 'smmplan', isTestMode: true, exchangeRateUSD: 100.0 },
    });

    const timestamp = Date.now() + Math.random().toString(36).slice(2, 6);

    ownerUser = await db.user.create({
      data: {
        email: `owner_step3_${timestamp}@smmplan.local`,
        role: 'OWNER',
        isActive: true,
        balance: BigInt(0),
      },
    });

    supportStaff = await db.user.create({
      data: {
        email: `support_step3_${timestamp}@smmplan.local`,
        role: 'SUPPORT',
        isActive: true,
        balance: BigInt(0),
        supportLimitCents: 500000,
        supportSpentTodayCents: 0,
      },
    });

    clientUser = await db.user.create({
      data: {
        email: `client_step3_${timestamp}@smmplan.local`,
        role: 'USER',
        isActive: true,
        balance: BigInt(100000), // 1 000.00 ₽ initial balance
      },
    });

    roboPayment = await db.payment.create({
      data: {
        userId: clientUser.id,
        amount: BigInt(100000), // 1 000.00 ₽ payment
        currency: 'RUB',
        status: 'SUCCEEDED',
        gateway: 'robokassa',
        gatewayId: `robo_test_mock_${timestamp}`,
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

  it('blocks Robokassa card refund approval if manual confirmation is missing and leaves request in PENDING_APPROVAL', async () => {
    // 1. Support creates refund request for 400 ₽ on a Robokassa payment
    (verifySession as any).mockResolvedValue({
      userId: supportStaff.id,
      email: supportStaff.email,
      role: supportStaff.role,
    });

    const fd = new FormData();
    fd.append('userId', clientUser.id);
    fd.append('paymentId', roboPayment.id);
    fd.append('amountKopecks', '40000');
    fd.append('reason', 'Возврат через Робокассу по запросу');

    const reqRes = await requestCardRefundAction(fd);
    expect(reqRes.success).toBe(true);
    if (!reqRes.success) throw new Error('Failed to request card refund');
    expect(reqRes.message).toContain('ROBOKASSA');

    // Balance held immediately: 1000 - 400 = 600 ₽
    const clientAfterReq = await db.user.findUniqueOrThrow({ where: { id: clientUser.id } });
    expect(clientAfterReq.balance).toBe(BigInt(60000));

    const adj = await db.manualBalanceAdjustment.findFirstOrThrow({
      where: { paymentId: roboPayment.id, reasonCode: 'REFUND_TO_CARD' },
    });
    expect(adj.status).toBe('PENDING_APPROVAL');

    // 2. Owner attempts approval without manual confirmation
    (verifySession as any).mockResolvedValue({
      userId: ownerUser.id,
      email: ownerUser.email,
      role: ownerUser.role,
    });

    const approveFd = new FormData();
    approveFd.append('id', adj.id);

    const approveRes = await approveBalanceAdjustmentAction(approveFd);
    expect(approveRes.success).toBe(false);
    expect((approveRes as any).requiresManualRefund).toBe(true);
    expect(approveRes.error).toContain('ROBOKASSA не поддерживает автоматический возврат');

    // 3. Verify status did NOT get stuck in APPROVED or EXECUTED; remains PENDING_APPROVAL
    const adjAfterFailed = await db.manualBalanceAdjustment.findUniqueOrThrow({ where: { id: adj.id } });
    expect(adjAfterFailed.status).toBe('PENDING_APPROVAL');
    expect(adjAfterFailed.approvedBy).toBeNull();
  });

  it('executes Robokassa card refund when manual confirmation flag is provided', async () => {
    // 1. Support creates refund request for 500 ₽
    (verifySession as any).mockResolvedValue({
      userId: supportStaff.id,
      email: supportStaff.email,
      role: supportStaff.role,
    });

    const fd = new FormData();
    fd.append('userId', clientUser.id);
    fd.append('paymentId', roboPayment.id);
    fd.append('amountKopecks', '50000');
    fd.append('reason', 'Подтвержденный возврат через Робокассу');

    const reqRes = await requestCardRefundAction(fd);
    expect(reqRes.success).toBe(true);

    const adj = await db.manualBalanceAdjustment.findFirstOrThrow({
      where: { paymentId: roboPayment.id, reasonCode: 'REFUND_TO_CARD' },
    });

    // 2. Owner approves WITH manualConfirmed = "true"
    (verifySession as any).mockResolvedValue({
      userId: ownerUser.id,
      email: ownerUser.email,
      role: ownerUser.role,
    });

    const approveFd = new FormData();
    approveFd.append('id', adj.id);
    approveFd.append('manualConfirmed', 'true');

    const approveRes = await approveBalanceAdjustmentAction(approveFd);
    expect(approveRes.success).toBe(true);
    if (!approveRes.success) throw new Error('Failed to approve refund');
    expect(approveRes.status).toBe('EXECUTED');

    // 3. Verify DB state: adjustment is EXECUTED, payment received manual receipt id
    const adjFinal = await db.manualBalanceAdjustment.findUniqueOrThrow({ where: { id: adj.id } });
    expect(adjFinal.status).toBe('EXECUTED');
    expect(adjFinal.approvedBy).toBe(ownerUser.id);

    const paymentFinal = await db.payment.findUniqueOrThrow({ where: { id: roboPayment.id } });
    expect(paymentFinal.refundReceiptId).toBeDefined();
    expect(paymentFinal.refundReceiptId).toMatch(/^MANUAL_ROBOKASSA_/);

    // 4. Verify client balance has no double-debit (held 500 ₽, remains 500 ₽)
    const clientFinal = await db.user.findUniqueOrThrow({ where: { id: clientUser.id } });
    expect(clientFinal.balance).toBe(BigInt(50000));
  });

  it('serializes payment information in getBalanceAdjustmentsAction', async () => {
    (verifySession as any).mockResolvedValue({
      userId: supportStaff.id,
      email: supportStaff.email,
      role: supportStaff.role,
    });

    const fd = new FormData();
    fd.append('userId', clientUser.id);
    fd.append('paymentId', roboPayment.id);
    fd.append('amountKopecks', '25000');
    fd.append('reason', 'Проверка сериализации шлюза');

    await requestCardRefundAction(fd);

    (verifySession as any).mockResolvedValue({
      userId: ownerUser.id,
      email: ownerUser.email,
      role: ownerUser.role,
    });

    const listFd = new FormData();
    listFd.append('reasonCode', 'REFUND_TO_CARD');
    const listRes = await getBalanceAdjustmentsAction(listFd);

    expect(listRes.success).toBe(true);
    if (!listRes.success) throw new Error('Failed to list balance adjustments');
    const item = listRes.items?.find((i: any) => i.paymentId === roboPayment.id);
    expect(item).toBeDefined();
    expect(item?.payment).toBeDefined();
    expect(item?.payment?.gateway).toBe('robokassa');
  });

  it('CBRRateService.getLiveCrossRates safely falls back to default without throwing if USD rate is missing', async () => {
    const spy = vi.spyOn(SettingsManager, 'getExchangeRateUSD').mockResolvedValue(0 as any);

    const crossRates = await CBRRateService.getLiveCrossRates('smmplan');
    expect(crossRates).toBeDefined();
    expect(crossRates.usdToRub).toBe(95.0);
    expect(crossRates.eurToUsd).toBe(1.08);

    spy.mockRestore();
  });
});
