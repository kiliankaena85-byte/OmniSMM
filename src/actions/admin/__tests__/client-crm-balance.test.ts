import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { db } from '@/lib/db';
import { verifySession } from '@/lib/session';
import { 
  updateBalanceAction, 
  requestCardRefundAction, 
  updateUserApiAction 
} from '../users';

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

describe('Client CRM & FinTech Balance Safety Test Suite (Get Shit Done)', () => {
  let ownerUser: any;
  let supportStaff: any;
  let clientUser: any;
  let testPayment: any;

  beforeEach(async () => {
    // 1. Setup system settings
    await db.systemSettings.upsert({
      where: { id: 'smmplan' },
      update: { isTestMode: true, exchangeRateUSD: 100.0 },
      create: { id: 'smmplan', isTestMode: true, exchangeRateUSD: 100.0 },
    });

    const timestamp = Date.now() + Math.random().toString(36).slice(2, 6);

    // 2. Create Owner, Support, and Client Users
    ownerUser = await db.user.create({
      data: {
        email: `owner_${timestamp}@smmplan.local`,
        role: 'OWNER',
        isActive: true,
        balance: BigInt(0),
      },
    });

    supportStaff = await db.user.create({
      data: {
        email: `support_${timestamp}@smmplan.local`,
        role: 'SUPPORT',
        isActive: true,
        balance: BigInt(0),
        supportLimitCents: 500000, // 5 000 ₽ limit (Int)
        supportSpentTodayCents: 0,
      },
    });

    clientUser = await db.user.create({
      data: {
        email: `client_${timestamp}@smmplan.local`,
        role: 'USER',
        isActive: true,
        balance: BigInt(100000), // 1 000.00 ₽ in kopecks
      },
    });

    // 3. Create a successful test payment
    testPayment = await db.payment.create({
      data: {
        userId: clientUser.id,
        amount: BigInt(100000), // 1 000.00 ₽
        currency: 'RUB',
        status: 'SUCCEEDED',
        gateway: 'yookassa',
        gatewayId: `yoo_pay_${timestamp}`,
      }
    });
  });

  afterEach(async () => {
    // Cleanup created test records
    try {
      if (testPayment) await db.payment.deleteMany({ where: { id: testPayment.id } });
      if (clientUser) {
        await db.manualBalanceAdjustment.deleteMany({ where: { userId: clientUser.id } });
        await db.supportFinancialAction.deleteMany({ where: { targetUserId: clientUser.id } });
        await db.ledgerEntry.deleteMany({ where: { userId: clientUser.id } });
        await db.apiConfig.deleteMany({ where: { userId: clientUser.id } });
        await db.user.deleteMany({ where: { id: clientUser.id } });
      }
      if (supportStaff) await db.user.deleteMany({ where: { id: supportStaff.id } });
      if (ownerUser) await db.user.deleteMany({ where: { id: ownerUser.id } });
    } catch {}
  });

  // TEST 1: CREDIT BALANCE (GOODWILL)
  it('should successfully credit balance and update ledger atomically', async () => {
    (verifySession as any).mockResolvedValue({
      userId: ownerUser.id,
      email: ownerUser.email,
      role: ownerUser.role,
    });

    const fd = new FormData();
    fd.append('userId', clientUser.id);
    fd.append('amount', '15000'); // +150.00 ₽
    fd.append('reason', 'Компенсация за задержку заказа #104');
    fd.append('idempotencyKey', `credit-test-${Date.now()}`);

    const res = await updateBalanceAction(fd);
    expect(res.success).toBe(true);

    const updatedUser = await db.user.findUniqueOrThrow({ where: { id: clientUser.id } });
    expect(updatedUser.balance).toBe(BigInt(115000)); // 1 000 + 150 = 1 150.00 ₽
  });

  // TEST 2: DEBIT BALANCE (CORRECTION)
  it('should successfully debit balance when funds are sufficient', async () => {
    (verifySession as any).mockResolvedValue({
      userId: ownerUser.id,
      email: ownerUser.email,
      role: ownerUser.role,
    });

    const fd = new FormData();
    fd.append('userId', clientUser.id);
    fd.append('amount', '-25000'); // -250.00 ₽
    fd.append('reason', 'Корректировка ошибочного начисления');
    fd.append('idempotencyKey', `debit-test-${Date.now()}`);

    const res = await updateBalanceAction(fd);
    expect(res.success).toBe(true);

    const updatedUser = await db.user.findUniqueOrThrow({ where: { id: clientUser.id } });
    expect(updatedUser.balance).toBe(BigInt(75000)); // 1 000 - 250 = 750.00 ₽
  });

  // TEST 3: OVERDRAFT PROTECTION (DEBIT > BALANCE)
  it('should reject debit when amount exceeds current user balance', async () => {
    (verifySession as any).mockResolvedValue({
      userId: ownerUser.id,
      email: ownerUser.email,
      role: ownerUser.role,
    });

    const fd = new FormData();
    fd.append('userId', clientUser.id);
    fd.append('amount', '-200000'); // -2 000.00 ₽ (balance is only 1 000.00 ₽)
    fd.append('reason', 'Списание превышающей суммы');

    const res = await updateBalanceAction(fd);
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();

    // Balance remains untouched
    const userCheck = await db.user.findUniqueOrThrow({ where: { id: clientUser.id } });
    expect(userCheck.balance).toBe(BigInt(100000));
  });

  // TEST 4: ANTI-DOUBLE-CLICK & IDEMPOTENCY LOCK
  it('should prevent double credit on repeated clicks with same idempotencyKey', async () => {
    (verifySession as any).mockResolvedValue({
      userId: ownerUser.id,
      email: ownerUser.email,
      role: ownerUser.role,
    });

    const sharedKey = `double-click-lock-${Date.now()}`;

    const fd1 = new FormData();
    fd1.append('userId', clientUser.id);
    fd1.append('amount', '5000'); // +50.00 ₽
    fd1.append('reason', 'Первое нажатие кнопки');
    fd1.append('idempotencyKey', sharedKey);

    const res1 = await updateBalanceAction(fd1);
    expect(res1.success).toBe(true);

    // Second immediate click with identical idempotencyKey
    const fd2 = new FormData();
    fd2.append('userId', clientUser.id);
    fd2.append('amount', '5000');
    fd2.append('reason', 'Второе случайное нажатие кнопки');
    fd2.append('idempotencyKey', sharedKey);

    const res2 = await updateBalanceAction(fd2);
    expect(res2.success).toBe(true); // Graceful idempotent response
    if (res2.success) {
      expect(res2.message).toContain('защита от двойного клика');
    }

    // Balance should only be credited ONCE (+50.00 ₽, not +100.00 ₽)
    const userCheck = await db.user.findUniqueOrThrow({ where: { id: clientUser.id } });
    expect(userCheck.balance).toBe(BigInt(105000)); // 1 000 + 50 = 1 050.00 ₽
  });

  // TEST 5: STAFF SECURITY BOUNDARY (BLOCK SELF-BALANCE ADJUSTMENT)
  it('should block non-owner staff from modifying their own balance', async () => {
    const adminStaff = await db.user.create({
      data: {
        email: `admin_staff_${Date.now()}@smmplan.local`,
        role: 'ADMIN',
        isActive: true,
        balance: BigInt(0),
      },
    });

    (verifySession as any).mockResolvedValue({
      userId: adminStaff.id,
      email: adminStaff.email,
      role: adminStaff.role,
    });

    const fd = new FormData();
    fd.append('userId', adminStaff.id);
    fd.append('amount', '10000');
    fd.append('reason', 'Попытка начислить себе денег');

    const res = await updateBalanceAction(fd);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain('собственный баланс');
    }

    await db.user.delete({ where: { id: adminStaff.id } });
  });

  // TEST 6: TWO-STEP CARD REFUND GATEWAY
  it('should hold client balance immediately and create refund request for financier', async () => {
    (verifySession as any).mockResolvedValue({
      userId: ownerUser.id,
      email: ownerUser.email,
      role: ownerUser.role,
    });

    const refundKey = `refund-gate-test-${Date.now()}`;
    const fd = new FormData();
    fd.append('userId', clientUser.id);
    fd.append('paymentId', testPayment.id);
    fd.append('amountKopecks', '40000'); // 400.00 ₽ refund to card
    fd.append('reason', 'Клиент передумал, возврат на карту');
    fd.append('idempotencyKey', refundKey);

    const res = await requestCardRefundAction(fd);
    expect(res.success).toBe(true);

    // 1. Balance must be instantly debited in client account (Double-spend protection)
    const userCheck = await db.user.findUniqueOrThrow({ where: { id: clientUser.id } });
    expect(userCheck.balance).toBe(BigInt(60000)); // 1 000 - 400 = 600.00 ₽

    // 2. Pending adjustment must be created for financier with paymentId linked
    const adj = await db.manualBalanceAdjustment.findFirst({
      where: { paymentId: testPayment.id, reasonCode: 'REFUND_TO_CARD' }
    });
    expect(adj).toBeDefined();
    expect(adj?.amount).toBe(BigInt(40000));
    expect(adj?.status).toBe('PENDING_APPROVAL');

    // 3. Repeated click with same key should be blocked idempotently
    const resDuplicate = await requestCardRefundAction(fd);
    expect(resDuplicate.success).toBe(true);
    if (resDuplicate.success) {
      expect(resDuplicate.message).toContain('защита от двойного клика');
    }

    // Balance still 600.00 ₽ (not debited twice)
    const userCheck2 = await db.user.findUniqueOrThrow({ where: { id: clientUser.id } });
    expect(userCheck2.balance).toBe(BigInt(60000));
  });

  // TEST 7: API CONFIGURATION
  it('should update API details, INN, KPP, and Priority Support', async () => {
    (verifySession as any).mockResolvedValue({
      userId: ownerUser.id,
      email: ownerUser.email,
      role: ownerUser.role,
    });

    const fd = new FormData();
    fd.append('userId', clientUser.id);
    fd.append('isApiEnabled', 'true');
    fd.append('prioritySupport', 'true');
    fd.append('companyName', 'ООО «Технологии Продвижения»');
    fd.append('inn', '7701234567');
    fd.append('kpp', '770101001');
    fd.append('legalAddress', 'г. Москва, ул. Арбат, 10');
    fd.append('webhookUrl', 'https://api.tech.ru/smm-webhook');

    const res = await updateUserApiAction(fd);
    expect(res.success).toBe(true);

    const updatedUser = await db.user.findUniqueOrThrow({
      where: { id: clientUser.id },
      include: { apiConfig: true }
    });

    expect(updatedUser.companyName).toBe('ООО «Технологии Продвижения»');
    expect(updatedUser.inn).toBe('7701234567');
    expect(updatedUser.apiConfig?.isApiEnabled).toBe(true);
    expect(updatedUser.apiConfig?.prioritySupport).toBe(true);
    expect(updatedUser.apiConfig?.webhookUrl).toBe('https://api.tech.ru/smm-webhook');
  });

  // TEST 8: 1,000,000 RUB DEBIT (EXACT ISSUE REPORTED BY USER)
  it('should allow OWNER to debit 1,000,000 RUB without hitting safety cap or schema limit', async () => {
    (verifySession as any).mockResolvedValue({
      userId: ownerUser.id,
      email: ownerUser.email,
      role: ownerUser.role,
    });

    // Credit client with 1,500,000 RUB first
    await db.user.update({
      where: { id: clientUser.id },
      data: { balance: BigInt(150_000_000) } // 1,500,000.00 ₽ in kopecks
    });

    const fd = new FormData();
    fd.append('userId', clientUser.id);
    fd.append('amount', '-100000000'); // -1,000,000.00 ₽ in kopecks
    fd.append('reason', 'Крупная корректировка по акту сверки за квартал');
    fd.append('idempotencyKey', `debit-1m-${Date.now()}`);

    const res = await updateBalanceAction(fd);
    expect(res.success).toBe(true);

    const userCheck = await db.user.findUniqueOrThrow({ where: { id: clientUser.id } });
    expect(userCheck.balance).toBe(BigInt(50_000_000)); // 500,000.00 ₽ remaining
  });

  // TEST 9: ZERO AMOUNT REJECTION
  it('should reject zero amount adjustment with specific error message', async () => {
    (verifySession as any).mockResolvedValue({
      userId: ownerUser.id,
      email: ownerUser.email,
      role: ownerUser.role,
    });

    const fd = new FormData();
    fd.append('userId', clientUser.id);
    fd.append('amount', '0');
    fd.append('reason', 'Корректировка нулевой суммы');

    const res = await updateBalanceAction(fd);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toBe('Сумма изменения баланса не может быть равна нулю');
    }
  });

  // TEST 10: UNMASKED ZOD VALIDATION ERROR
  it('should return unmasked Zod validation issue instead of generic message', async () => {
    (verifySession as any).mockResolvedValue({
      userId: ownerUser.id,
      email: ownerUser.email,
      role: ownerUser.role,
    });

    const fd = new FormData();
    fd.append('userId', clientUser.id);
    fd.append('amount', '5000');
    fd.append('reason', 'ok'); // Too short (min 5 chars)

    const res = await updateBalanceAction(fd);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain('не менее 5 символов');
    }
  });
});
