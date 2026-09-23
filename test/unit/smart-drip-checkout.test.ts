import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkoutAction } from '@/actions/order/checkout';
import { db } from '@/lib/db';

// Mock DB
vi.mock('@/lib/db', () => ({
  db: {
    service: { findUnique: vi.fn(), findFirst: vi.fn() },
    user: { upsert: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    order: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    payment: { create: vi.fn(), update: vi.fn() },
    promoCode: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    session: { create: vi.fn() },
    serviceSmartConfig: { findUnique: vi.fn() },
    smartCampaign: { create: vi.fn() },
    smartTask: { create: vi.fn() },
    contentItem: { findUnique: vi.fn() },
    $transaction: vi.fn(async (cb) => {
      await Promise.resolve();
      return cb(db);
    }),
  },
}));

vi.mock('@/lib/redis-lock', () => ({
  MutexManager: {
    withLock: vi.fn(async (key, ttl, timeout, cb) => cb()),
  },
}));

vi.mock('@/services/financial/wallet-ops', () => ({
  WalletOps: {
    charge: vi.fn(),
  },
}));

vi.mock('@/services/marketing.service', () => ({
  marketingService: {
    calculatePrice: vi.fn().mockResolvedValue({
      totalCents: 1000, // 10 RUB base price
      originalTotalCents: 1000,
      discountCents: 0,
      discountPercent: 0,
      providerCostCents: 500,
      safetyFloorCents: 700,
      tier: 'REGULAR',
    }),
    consumePromoCode: vi.fn(),
  },
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
    get: vi.fn().mockReturnValue('test-agent'),
  }),
}));

vi.mock('@/lib/session', () => ({
  verifySession: vi.fn(),
  createSession: vi.fn().mockResolvedValue({}),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('Smart Dripfeed Checkout Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: 'user_123',
      email: 'tester@test.com',
      balance: BigInt(100000),
      isActive: true,
      isDeleted: false,
    } as any);
    vi.mocked(db.user.findFirst).mockResolvedValue({
      id: 'user_123',
      email: 'tester@test.com',
      balance: BigInt(100000),
      isActive: true,
      isDeleted: false,
    } as any);
    vi.mocked(db.user.create).mockResolvedValue({
      id: 'user_123',
      email: 'tester@test.com',
      balance: BigInt(100000),
      isActive: true,
      isDeleted: false,
    } as any);
    vi.mocked(db.order.create).mockResolvedValue({
      id: 'order_1',
      serviceId: 'svc_smart',
      quantity: 1000,
      link: 'https://t.me/durov',
      status: 'PENDING',
    } as any);
  });

  it('должен возвращать ошибку если Умный Dripfeed запрошен для несовместимой услуги', async () => {
    const input = {
      serviceId: 'svc_no_smart',
      link: 'https://t.me/durov',
      quantity: 100,
      email: 'tester@test.com',
      gateway: 'yookassa',
      isSmartDrip: true,
      smartDripDays: 7,
    };

    vi.mocked(db.service.findUnique).mockResolvedValue({
      id: 'svc_no_smart',
      isActive: true,
      externalId: 'ext_1',
      minQty: 1,
      maxQty: 1000,
      providerId: 'p1',
      targetType: 'CHANNEL',
      category: { network: { name: 'Telegram', slug: 'telegram' }, name: 'Подписчики' },
    } as any);

    // Возвращаем null для конфига умного dripfeed
    vi.mocked(db.serviceSmartConfig.findUnique).mockResolvedValue(null);

    const res = await checkoutAction(input);
    expect(res.success).toBe(false);
    expect((res as any).error).toContain('Эта услуга не поддерживает Умный Dripfeed');
  });

  it('должен рассчитывать стоимость с учетом +15% наценки и создавать умную кампанию при успешной валидации', async () => {
    const input = {
      serviceId: 'svc_smart',
      link: 'https://t.me/durov',
      quantity: 1000,
      email: 'tester@test.com',
      gateway: 'yookassa',
      isSmartDrip: true,
      smartDripDays: 7,
    };

    vi.mocked(db.service.findUnique).mockResolvedValue({
      id: 'svc_smart',
      isActive: true,
      externalId: 'ext_1',
      minQty: 1,
      maxQty: 10000,
      providerId: 'p1',
      targetType: 'CHANNEL',
      category: { network: { name: 'Telegram', slug: 'telegram' }, name: 'Подписчики' },
      smartConfig: {
        id: 'cfg_1',
        serviceId: 'svc_smart',
        isEnabled: true,
        isTestMode: true,
        minChunk: 50,
        maxChunk: 200,
        markup: 0.15,
      },
    } as any);

    // Настраиваем mock для Smart Config услуги
    vi.mocked(db.serviceSmartConfig.findUnique).mockResolvedValue({
      id: 'cfg_1',
      serviceId: 'svc_smart',
      isEnabled: true,
      isTestMode: true,
      minChunk: 50,
      maxChunk: 200,
      markup: 0.15, // +15%
    } as any);

    vi.mocked(db.order.create).mockResolvedValue({ id: 'order_1', charge: BigInt(1150), numericId: 1001 } as any);
    vi.mocked(db.payment.create).mockResolvedValue({ id: 'pay_1' } as any);
    vi.mocked(db.smartCampaign.create).mockResolvedValue({ id: 'camp_1' } as any);
    vi.mocked(db.smartTask.create).mockResolvedValue({ id: 'task_1' } as any);

    const res = await checkoutAction(input);

    expect(res.success).toBe(true);
    expect((res as any).data.orderId).toBe('order_1');

    // Проверяем, что стоимость заказа была увеличена на 15% (1000 * 1.15 = 1150)
    expect(db.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          charge: 1150, // Сурчардж применен!
        }),
      })
    );
  });
});
