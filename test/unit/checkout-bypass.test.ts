import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkoutAction } from '@/actions/order/checkout';
import { db } from '@/lib/db';

// Mocking dependencies
vi.mock('@/lib/db', () => ({
  db: {
    service: { findUnique: vi.fn() },
    user: { upsert: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    order: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
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
      await Promise.resolve();
      return cb(db);
    }),
  }
}));

vi.mock('@/lib/redis-lock', () => ({
  MutexManager: {
    withLock: vi.fn(async (key, ttl, timeout, cb) => {
      await Promise.resolve();
      return await cb();
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
    getPaymentSecrets: vi.fn().mockResolvedValue({})
  },
  SettingsProvider: {
    isTestMode: vi.fn().mockResolvedValue(true),
    getContactAndLegalSettings: vi.fn().mockResolvedValue({ COMPANY_NAME: 'SMMplan' }),
    getExchangeRateUSD: vi.fn().mockResolvedValue(100),
  }
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

describe('Checkout Validation Bypass Override', () => {
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

  it('BYPASS-001: Should fail validation if link is invalid and isLinkOverridden is false', async () => {
    const input = {
      serviceId: 'svc_123',
      link: 'https://invalid-format-for-platform',
      quantity: 100,
      email: 'bypass@test.com',
      gateway: 'yookassa',
      isLinkOverridden: false
    };

    vi.mocked(db.service.findUnique).mockResolvedValue({ 
      id: 'svc_123', isActive: true, externalId: 'ext_1', minQty: 1, maxQty: 1000, providerId: 'p1',
      targetType: 'POST',
      category: { network: { name: 'Telegram', slug: 'telegram' }, name: 'Просмотры' }
    } as any);

    const res = await checkoutAction(input);
    expect(res.success).toBe(false);
    expect((res as any).error).toMatch(/неверный формат|укажите ссылку/i);
  });

  it('BYPASS-002: Should pass validation if link is invalid but isLinkOverridden is true', async () => {
    const input = {
      serviceId: 'svc_123',
      link: 'https://new-format-social-network.com/p/123',
      quantity: 100,
      email: 'bypass@test.com',
      gateway: 'yookassa',
      isLinkOverridden: true
    };

    vi.mocked(db.service.findUnique).mockResolvedValue({ 
      id: 'svc_123', isActive: true, externalId: 'ext_1', minQty: 1, maxQty: 1000, providerId: 'p1',
      targetType: 'POST',
      category: { network: { name: 'Telegram', slug: 'telegram' }, name: 'Просмотры' }
    } as any);

    vi.mocked(db.order.create).mockResolvedValue({ id: 'order_new', charge: BigInt(1000), numericId: 1001 } as any);
    vi.mocked(db.payment.create).mockResolvedValue({ id: 'pay_new' } as any);
    vi.mocked(db.user.create).mockResolvedValue({ id: 'user_123' } as any);
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: 'user_123',
      email: 'bypass@test.com',
      role: 'OWNER',
      isActive: true,
      isDeleted: false,
    } as any);

    const res = await checkoutAction(input);
    expect(res.success).toBe(true);
    expect((res as any).data.orderId).toBe('order_new');
    expect(db.order.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        isLinkOverridden: true,
        link: 'https://new-format-social-network.com/p/123'
      })
    }));
  });

  it('BYPASS-003: Should still fail even if isLinkOverridden is true if the link has no valid domain/protocol', async () => {
    const input = {
      serviceId: 'svc_123',
      link: 'just-random-garbage-without-protocol-or-dot',
      quantity: 100,
      email: 'bypass@test.com',
      gateway: 'yookassa',
      isLinkOverridden: true
    };

    vi.mocked(db.service.findUnique).mockResolvedValue({ 
      id: 'svc_123', isActive: true, externalId: 'ext_1', minQty: 1, maxQty: 1000, providerId: 'p1',
      targetType: 'POST',
      category: { network: { name: 'Telegram', slug: 'telegram' }, name: 'Просмотры' }
    } as any);

    const res = await checkoutAction(input);
    expect(res.success).toBe(false);
    expect((res as any).error).toContain('Ссылка в обход валидации должна быть корректным URL');
  });
});
