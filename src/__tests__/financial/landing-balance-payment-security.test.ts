import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { checkoutAction } from '@/actions/order/checkout';
import { verifySession } from '@/lib/session';
import { WalletOps, WalletInsufficientFundsError } from '@/services/financial/wallet-ops';

vi.mock('@/lib/session', () => ({
  verifySession: vi.fn(),
  createSession: vi.fn(),
}));

vi.mock('@/lib/redis', () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  },
}));

vi.mock('@/lib/queue-manager', () => ({
  ordersQueue: {
    add: vi.fn().mockResolvedValue({ id: 'mock-job' }),
  },
  telegramQueue: {
    add: vi.fn().mockResolvedValue({ id: 'mock-job' }),
  },
  emailQueue: {
    add: vi.fn().mockResolvedValue({ id: 'mock-job' }),
  },
  paymentGatewayQueue: {
    add: vi.fn().mockResolvedValue({ id: 'mock-job' }),
  },
  getRedisConnection: vi.fn().mockReturnValue({}),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers({ 'user-agent': 'Vitest Browser', 'x-tenant-id': 'smmplan' })),
  cookies: vi.fn().mockReturnValue({ get: vi.fn() }),
}));

vi.mock('@/utils/ip', () => ({
  getClientIp: vi.fn().mockResolvedValue('127.0.0.1'),
}));

vi.mock('@/services/core/rate-limit.service', () => ({
  RateLimitService: { check: vi.fn().mockResolvedValue(true) },
}));

vi.mock('@/services/financial/wallet-ops', () => ({
  WalletOps: {
    charge: vi.fn().mockResolvedValue({ success: true, balance: BigInt(50000) }),
  },
  WalletInsufficientFundsError: class extends Error {
    readonly code = 'INSUFFICIENT_FUNDS';
    constructor(needed?: number | bigint, got?: number | bigint) {
      super(`Insufficient funds: needed ${needed?.toString() ?? '0'}, got ${got?.toString() ?? '0'}`);
      this.name = 'WalletInsufficientFundsError';
    }
  },
  WalletUserNotFoundError: class extends Error {},
  WalletInvalidAmountError: class extends Error {},
}));

vi.mock('@/services/financial/payment-gateway.service', () => ({
  PaymentGatewayFactory: {
    getGateway: vi.fn().mockReturnValue({
      createPayment: vi.fn().mockResolvedValue({ paymentUrl: 'https://pay.yookassa.ru/mock' }),
    }),
  },
}));

vi.mock('@/services/marketing.service', () => ({
  marketingService: {
    calculatePrice: vi.fn().mockResolvedValue({
      totalCents: 15000, // 150.00 RUB
      basePriceCents: 15000,
      providerCostCents: 8000,
      discountCents: 0,
      appliedTier: 'STANDARD',
    }),
    consumePromoCode: vi.fn(),
  },
}));

vi.mock('@/lib/settings', () => ({
  SettingsManager: {
    isTestMode: vi.fn().mockResolvedValue(true),
    getPaymentSecrets: vi.fn().mockResolvedValue({
      yookassaShopId: 'mock-shop',
      yookassaSecretKey: 'mock-secret',
    }),
    getExchangeRates: vi.fn().mockResolvedValue({ USD: 90 }),
    getEnvironmentMode: vi.fn().mockResolvedValue('sandbox'),
  },
  SettingsProvider: {
    isTestMode: vi.fn().mockResolvedValue(true),
    isMockPaymentEnabled: vi.fn().mockResolvedValue(false),
    getExchangeRateUSD: vi.fn().mockResolvedValue(90),
  },
}));

vi.mock('@/lib/db', () => {
  const mockDb = {
    $transaction: vi.fn(async (cb) => cb(mockDb)),
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    service: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    order: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    payment: {
      create: vi.fn(),
      update: vi.fn(),
    },
    contentItem: {
      findUnique: vi.fn(),
    },
  };
  return { db: mockDb };
});

describe('Landing Page Balance Payment & Zero-Trust Anti-Impersonation Guard', () => {
  const mockService = {
    id: 'srv-telegram-views',
    name: 'Telegram Просмотры',
    minQty: 100,
    maxQty: 10000,
    pricePerUnitRub: 0.15,
    isActive: true,
    externalId: 'ext-101',
    providerId: 'prov-1',
    customDataType: 'NONE',
    tenantId: 'smmplan',
    category: {
      network: {
        slug: 'TELEGRAM',
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(db.service.findUnique).mockResolvedValue(mockService as any);
    vi.mocked(db.contentItem.findUnique).mockResolvedValue({ updatedAt: new Date() } as any);
    vi.mocked(db.order.findUnique).mockResolvedValue(null);
    vi.mocked(db.order.create).mockResolvedValue({
      id: 'ord-12345',
      numericId: 12345,
      status: 'PENDING',
    } as any);
    vi.mocked(db.payment.create).mockResolvedValue({
      id: 'pay-12345',
      status: 'SUCCEEDED',
    } as any);
    vi.mocked(db.order.update).mockResolvedValue({} as any);
  });

  it('1. Authenticated user with sufficient balance successfully pays from balance with instant dashboard redirect', async () => {
    vi.mocked(verifySession).mockResolvedValue({
      userId: 'user-auth-1',
      role: 'USER',
      tenantId: 'smmplan',
    });

    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: 'user-auth-1',
      email: 'client@example.com',
      isActive: true,
      isDeleted: false,
      balance: BigInt(100000), // 1,000.00 RUB
    } as any);

    vi.mocked(db.user.findFirst).mockResolvedValue({
      id: 'user-auth-1',
      email: 'client@example.com',
      isActive: true,
      isDeleted: false,
      balance: BigInt(100000),
    } as any);

    const result = await checkoutAction({
      serviceId: 'srv-telegram-views',
      link: 'https://t.me/mychannel/100',
      quantity: 1000,
      email: 'client@example.com',
      gateway: 'balance',
    });

    expect(result.success).toBe(true);
    if (result.success && result.data) {
      expect(result.data.orderId).toBe('ord-12345');
      expect(result.data.paymentUrl).toBeNull();
      expect(result.data.redirectUrl).toBe('/dashboard/orders?success=1&orderId=ord-12345&payment=balance');
    }
    expect(WalletOps.charge).toHaveBeenCalledTimes(1);
  });

  it('2. Anti-Impersonation Guard: Unauthenticated guest entering a registered user email CANNOT pay from balance', async () => {
    // Guest has NO session
    vi.mocked(verifySession).mockResolvedValue(null);

    // Victim exists in DB with 50,000 RUB balance
    vi.mocked(db.user.findFirst).mockResolvedValue({
      id: 'victim-user',
      email: 'victim@vip.ru',
      isActive: true,
      isDeleted: false,
      balance: BigInt(5000000),
    } as any);

    const result = await checkoutAction({
      serviceId: 'srv-telegram-views',
      link: 'https://t.me/hacker_channel/1',
      quantity: 1000,
      email: 'victim@vip.ru',
      gateway: 'balance',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Оплата с баланса доступна только авторизованным пользователям');
    }
    // Balance must NOT be charged
    expect(WalletOps.charge).not.toHaveBeenCalled();
    expect(db.order.create).not.toHaveBeenCalled();
  });

  it('3. Anti-Impersonation Guard: Authenticated user entering someone else email CANNOT drain their balance', async () => {
    // Logged in as attacker
    vi.mocked(verifySession).mockResolvedValue({
      userId: 'attacker-id',
      role: 'USER',
      tenantId: 'smmplan',
    });

    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: 'attacker-id',
      email: 'attacker@evil.ru',
      isActive: true,
      isDeleted: false,
      balance: BigInt(1000),
    } as any);

    // Attacker tries to target victim's email
    const result = await checkoutAction({
      serviceId: 'srv-telegram-views',
      link: 'https://t.me/hacker_channel/1',
      quantity: 1000,
      email: 'victim@vip.ru',
      gateway: 'balance',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Оплата с баланса доступна только авторизованным пользователям');
    }
    expect(WalletOps.charge).not.toHaveBeenCalled();
  });

  it('4. Insufficient balance returns clear error and rolls back transaction', async () => {
    vi.mocked(verifySession).mockResolvedValue({
      userId: 'user-broke',
      role: 'USER',
      tenantId: 'smmplan',
    });

    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: 'user-broke',
      email: 'broke@example.com',
      isActive: true,
      isDeleted: false,
      balance: BigInt(5000), // 50.00 RUB, but order is 150.00 RUB
    } as any);

    vi.mocked(db.user.findFirst).mockResolvedValue({
      id: 'user-broke',
      email: 'broke@example.com',
      isActive: true,
      isDeleted: false,
      balance: BigInt(5000),
    } as any);

    vi.mocked(WalletOps.charge).mockRejectedValueOnce(new WalletInsufficientFundsError(BigInt(15000), BigInt(5000)));

    const result = await checkoutAction({
      serviceId: 'srv-telegram-views',
      link: 'https://t.me/mychannel/100',
      quantity: 1000,
      email: 'broke@example.com',
      gateway: 'balance',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Недостаточно средств на балансе');
    }
  });

  it('5. Guest Exemption: Unauthenticated guest CAN pay via external acquiring (YooKassa) without touching balances', async () => {
    vi.mocked(verifySession).mockResolvedValue(null);

    // User without passwordHash (regular guest ordering)
    vi.mocked(db.user.findFirst).mockResolvedValue(null);
    vi.mocked(db.user.create).mockResolvedValue({
      id: 'new-guest-user',
      email: 'guest@example.com',
      balance: BigInt(0),
    } as any);

    const result = await checkoutAction({
      serviceId: 'srv-telegram-views',
      link: 'https://t.me/mychannel/100',
      quantity: 1000,
      email: 'guest@example.com',
      gateway: 'yookassa',
    });

    expect(result.success).toBe(true);
    if (result.success && result.data) {
      expect(result.data.paymentUrl).toBe('https://pay.yookassa.ru/mock');
    }
    // WalletOps.charge is NOT invoked for acquiring payments
    expect(WalletOps.charge).not.toHaveBeenCalled();
  });
});
