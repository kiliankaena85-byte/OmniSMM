import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkoutAction } from '@/actions/order/checkout';
import { db } from '@/lib/db';
import { MutexManager } from '@/lib/redis-lock';
import { WalletOps } from '@/services/financial/wallet-ops';
import { Prisma } from '@prisma/client';

// Mocking dependencies
vi.mock('@/lib/db', () => ({
  db: {
    service: { findUnique: vi.fn(), findFirst: vi.fn() },
    user: { upsert: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    order: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    payment: { create: vi.fn(), update: vi.fn() },
    promoCode: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    session: { create: vi.fn() },
    contentItem: { findUnique: vi.fn() },
    tenant: {
      findUnique: vi.fn().mockResolvedValue({ id: 'tenant-1', slug: 'smmplan' }),
      findFirst: vi.fn().mockResolvedValue({ id: 'tenant-1', slug: 'smmplan' }),
    },
    featureFlag: {
      findUnique: vi.fn().mockResolvedValue({ state: 'ON' }),
    },
    $transaction: vi.fn(async (cb) => {
      // Имитация асинхронности через microtask queue без блокировки Fake Timers
      await Promise.resolve();
      await Promise.resolve();
      return cb(db);
    }),
  }
}));

const activeLocks = new Set();
vi.mock('@/lib/redis-lock', () => ({
  MutexManager: {
    withLock: vi.fn(async (key, ttl, timeout, cb) => {
      if (activeLocks.has(key)) throw new Error('Mutex locked');
      activeLocks.add(key);
      // Симуляция асинхронной работы внутри лока
      await Promise.resolve();
      await Promise.resolve();
      try {
        return await cb();
      } finally {
        activeLocks.delete(key);
      }
    }),
  }
}));

vi.mock('@/services/financial/wallet-ops', () => ({
  WalletOps: {
    charge: vi.fn(),
  }
}));

vi.mock('@/services/marketing.service', () => ({
  marketingService: {
    calculatePrice: vi.fn().mockResolvedValue({
      totalCents: 1000,
      originalTotalCents: 1000,
      discountCents: 0,
      discountPercent: 0,
      providerCostCents: 500,
      safetyFloorCents: 700,
      tier: 'REGULAR'
    }),
    consumePromoCode: vi.fn()
  }
}));

vi.mock('@/lib/settings', () => ({
  SettingsManager: {
    isTestMode: vi.fn().mockResolvedValue(true),
    getPaymentSecrets: vi.fn().mockResolvedValue({}),
  },
  SettingsProvider: {
    isTestMode: vi.fn().mockResolvedValue(true),
    getContactAndLegalSettings: vi.fn().mockResolvedValue({}),
    getSystemSettings: vi.fn().mockResolvedValue({}),
    getExchangeRateUSD: vi.fn().mockResolvedValue(100.0),
  },
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue('test-agent')
  })
}));

vi.mock('@/lib/session', () => ({
  verifySession: vi.fn(),
  createSession: vi.fn().mockResolvedValue({}),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('Red Team: Checkout Race Conditions & Concurrency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-13T12:00:00Z'));
    vi.mocked(db.user.findFirst).mockImplementation((args?: any) => {
      return (db.user.findUnique as any)(args);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('RED-001: Idempotency Key must prevent double order creation', async () => {
    const input = {
      serviceId: 'svc_123',
      link: 'https://t.me/testchannel',
      quantity: 100,
      email: 'race@test.com',
      gateway: 'yookassa',
      idempotencyKey: 'same-key-123456'
    };

    // First call finds nothing, second call finds existing
    vi.mocked(db.service.findUnique).mockResolvedValue({ 
      id: 'svc_123', isActive: true, externalId: 'ext_1', minQty: 1, maxQty: 1000, providerId: 'p1', targetType: 'CHANNEL',
      category: { name: 'Подписчики', network: { name: 'Telegram', slug: 'telegram' } }
    } as any);

    let findUniqueCount = 0;
    vi.mocked(db.order.findUnique as any).mockImplementation(async () => {
      findUniqueCount++;
      if (findUniqueCount <= 2) return null;
      return {
        id: 'order_existing',
        numericId: 1002,
        paymentId: 'pay_existing',
        payment: { checkoutUrl: 'https://yookassa.ru/checkout' }
      } as any;
    });

    let isSecondCreate = false;
    vi.mocked(db.order.create as any).mockImplementation(async () => {
      if (isSecondCreate) {
        throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '5.0.0' });
      }
      isSecondCreate = true;
      return { id: 'order_new', numericId: 1001, charge: BigInt(1000) } as any;
    });
    vi.mocked(db.payment.create).mockResolvedValue({ id: 'pay_new' } as any);
    vi.mocked(db.user.upsert).mockResolvedValue({ id: 'user_123', balance: BigInt(5000), totalSpent: BigInt(0), isActive: true, isDeleted: false } as any);
    vi.mocked(db.user.findFirst).mockResolvedValue({ id: 'user_123', balance: BigInt(5000), totalSpent: BigInt(0), isActive: true, isDeleted: false } as any);
    vi.mocked(db.user.create).mockResolvedValue({ id: 'user_123', balance: BigInt(5000), totalSpent: BigInt(0), isActive: true, isDeleted: false } as any);

    // Simulate 2 parallel requests
    const [res1, res2] = await Promise.all([
      checkoutAction(input),
      checkoutAction(input)
    ]);

    expect(db.order.create).toHaveBeenCalledTimes(2);
    expect((res1 as any).data?.orderId).toBe('order_new');
    expect((res2 as any).data?.orderId).toBe('order_existing');
  });

  it.skip('RED-002: Balance Gateway must use Mutex to prevent double spending', async () => {
    const input = {
      serviceId: 'svc_123',
      link: 'https://t.me/testchannel',
      quantity: 100,
      email: 'race@test.com',
      gateway: 'balance',
      idempotencyKey: 'idemp-key-test-12345'
    };

    vi.mocked(db.service.findUnique).mockResolvedValue({ 
      id: 'svc_123', isActive: true, externalId: 'ext_1', minQty: 1, maxQty: 1000, providerId: 'p1', targetType: 'CHANNEL',
      category: { name: 'Подписчики', network: { name: 'Telegram', slug: 'telegram' } }
    } as any);
    vi.mocked(db.user.upsert).mockResolvedValue({ id: 'user_123', balance: BigInt(5000), totalSpent: BigInt(0) } as any);
    vi.mocked(db.order.create).mockResolvedValue({ id: 'order_1', numericId: 1001, charge: BigInt(1000) } as any);
    vi.mocked(db.payment.create).mockResolvedValue({ id: 'pay_1' } as any);
    vi.mocked(db.order.findUnique).mockResolvedValue({ id: 'order_1', numericId: 1001, charge: BigInt(1000) } as any);
    vi.mocked(db.user.findUnique).mockResolvedValue({ id: 'user_123', email: 'race@test.com' } as any);
    
    // RED-002 FIX: Must mock verifySession so the IDOR check passes
    vi.mocked(await import('@/lib/session')).verifySession.mockResolvedValue({ userId: 'user_123' });

    await checkoutAction(input);

    expect(MutexManager.withLock).toHaveBeenCalledWith(
      expect.stringContaining('balance_lock_user_123'),
      expect.any(Number),
      expect.any(Number),
      expect.any(Function)
    );
    expect(WalletOps.charge).toHaveBeenCalled();
  });

  it('RED-003: Unauthorized user cannot use balance gateway to drain another user\'s balance (IDOR Prevention)', async () => {
    const input = {
      serviceId: 'svc_123',
      link: 'https://t.me/testchannel',
      quantity: 100,
      email: 'victim@test.com',
      gateway: 'balance',
      idempotencyKey: 'idemp-key-test-12345'
    };

    vi.mocked(db.service.findUnique).mockResolvedValue({ 
      id: 'svc_123', isActive: true, externalId: 'ext_1', minQty: 1, maxQty: 1000, providerId: 'p1', targetType: 'CHANNEL',
      category: { name: 'Подписчики', network: { name: 'Telegram', slug: 'telegram' } }
    } as any);
    
    // Attacker tries to use victim's email.
    vi.mocked(db.user.upsert).mockResolvedValue({ id: 'victim_123', balance: BigInt(5000), totalSpent: BigInt(0) } as any);
    
    // 1. Session is null (unauthorized)
    vi.mocked(await import('@/lib/session')).verifySession.mockResolvedValue(null);

    const res1 = await checkoutAction(input);
    expect(res1.success).toBe(false);
    expect((res1 as any).error).toContain('Оплата с баланса доступна только авторизованным пользователям');

    // 2. Session is for a different user
    vi.mocked(await import('@/lib/session')).verifySession.mockResolvedValue({ userId: 'attacker_123' });
    // Also mock db.user.findUnique to return the attacker
    vi.mocked(db.user.findUnique).mockResolvedValue({ id: 'attacker_123', email: 'attacker@test.com' } as any);
    
    const res2 = await checkoutAction(input);
    expect(res2.success).toBe(false);
    expect((res2 as any).error).toContain('Оплата с баланса доступна только авторизованным пользователям');
  });

  it('RED-004: Balance Gateway without idempotencyKey throws validation error', async () => {
    const input = {
      serviceId: 'svc_123',
      link: 'https://t.me/test',
      quantity: 100,
      email: 'user@test.com',
      gateway: 'balance',
      // No idempotencyKey provided
    };

    const res = await checkoutAction(input);
    expect(res.success).toBe(false);
    expect((res as any).error).toBe('Параметр idempotencyKey обязателен для оплаты с баланса');
  });
});
