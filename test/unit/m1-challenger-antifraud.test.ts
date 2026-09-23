/**
 * CHALLENGER M1-2: Empirical Stress Test Suite for Anti-Fraud & Payment Limits
 * Verifies strict distinction between verified and unverified users across YooKassa and CryptoBot:
 * - YooKassa card limit ($20 / 180,000 cents) enforcement based on telegramId
 * - CryptoBot crypto limit (15,000 RUB / 1,500,000 cents) fiscal 54-FZ enforcement
 * - Micro-order minimum acquiring limits (10 RUB / 1000 cents)
 * - Both Pay-Per-Order (checkoutAction) and Balance Top-Up (createTopUpPaymentAction) flows
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTopUpPaymentAction } from '@/actions/user/top-up.action';
import { checkoutAction } from '@/actions/order/checkout';
import { db } from '@/lib/db';
import { verifySession } from '@/lib/session';
import { marketingService } from '@/services/marketing.service';

vi.mock('@/lib/db', () => ({
  db: {
    service: { findUnique: vi.fn() },
    user: { upsert: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    order: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    payment: { create: vi.fn(), update: vi.fn(), aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }) },
    promoCode: { findUnique: vi.fn(), update: vi.fn() },
    session: { create: vi.fn() },
    systemSettings: { findUnique: vi.fn() },
    contentItem: { findUnique: vi.fn() },
    tenant: {
      findUnique: vi.fn().mockResolvedValue({ id: 'tenant-1', slug: 'smmplan' }),
      findFirst: vi.fn().mockResolvedValue({ id: 'tenant-1', slug: 'smmplan' }),
    },
    featureFlag: {
      findUnique: vi.fn().mockResolvedValue({ state: 'ON' }),
    },
    $transaction: vi.fn(async (cb) => cb(db)),
  }
}));

vi.mock('@/services/core/rate-limit.service', () => ({
  RateLimitService: {
    check: vi.fn().mockResolvedValue(true),
  }
}));

vi.mock('@/lib/settings', () => ({
  SettingsManager: {
    isTestMode: vi.fn().mockResolvedValue(false),
    getPaymentSecrets: vi.fn().mockResolvedValue({
      yookassaShopId: 'shop123',
      yookassaSecretKey: 'key123',
      cryptoBotToken: 'token123'
    })
  },
  SettingsProvider: {
    isTestMode: vi.fn().mockResolvedValue(false),
    getSupportEmailDomain: vi.fn().mockResolvedValue('smmplan.local'),
    getContactAndLegalSettings: vi.fn().mockResolvedValue({ COMPANY_NAME: 'SMMplan' }),
    getExchangeRateUSD: vi.fn().mockResolvedValue(100),
  }
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue('test-agent')
  })
}));

vi.mock('@/utils/ip', () => ({
  getClientIp: vi.fn().mockResolvedValue('127.0.0.1')
}));

vi.mock('@/lib/session', () => ({
  verifySession: vi.fn(),
  createSession: vi.fn().mockResolvedValue({ sessionToken: 'tok', expiresAt: new Date() }),
  getEncodedKey: vi.fn().mockReturnValue(new TextEncoder().encode('secretsecretsecretsecretsecretsecretsecret')),
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

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('🔒 CHALLENGER M1-2: Anti-Fraud & Payment Limits Empirical Stress Test', () => {
  const TELEGRAM_LIMIT_MESSAGE = 'Для совершения платежей свыше $20 картой, пожалуйста, привяжите ваш Telegram-аккаунт в личном кабинете. Либо воспользуйтесь криптовалютой (без ограничений)';
  const CRYPTO_54FZ_LIMIT_MESSAGE = 'Криптовалюта доступна для пополнений до 15 000 ₽. Для больших сумм используйте карту.';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.user.findFirst).mockImplementation((args?: any) => {
      return (db.user.findUnique as any)(args);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Top-Up Action Anti-Fraud Limits (createTopUpPaymentAction)', () => {
    it('blocks unverified user (telegramId=null) for YooKassa amount > $20 (180,001 cents)', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: 'usr_unverified' });
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'usr_unverified',
        telegramId: null,
        email: 'user@test.pro'
      } as any);

      // 1800.01 RUB = 180,001 cents -> above 180,000 threshold
      await expect(createTopUpPaymentAction(1800.01, 'yookassa')).rejects.toThrow(TELEGRAM_LIMIT_MESSAGE);
    });

    it('blocks unverified user (telegramId="") for YooKassa amount > $20 (2500 RUB)', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: 'usr_unverified_empty' });
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'usr_unverified_empty',
        telegramId: '',
        email: 'user2@test.pro'
      } as any);

      await expect(createTopUpPaymentAction(2500, 'yookassa')).rejects.toThrow(TELEGRAM_LIMIT_MESSAGE);
    });

    it('allows unverified user for YooKassa amount exactly at $20 boundary (1800 RUB = 180,000 cents)', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: 'usr_unverified' });
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'usr_unverified',
        telegramId: null,
        email: 'user@test.pro'
      } as any);
      vi.mocked(db.payment.create).mockResolvedValue({ id: 'pay_boundary' } as any);
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'yk_1800', confirmation: { confirmation_url: 'https://yookassa.ru/confirm/1800' } })
      }));

      const res = await createTopUpPaymentAction(1800, 'yookassa');
      expect(res.success).toBe(true);
      expect(res.paymentUrl).toBe('https://yookassa.ru/confirm/1800');
    });

    it('allows verified user (telegramId="987654321") for large YooKassa top-up (50,000 RUB)', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: 'usr_verified' });
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'usr_verified',
        telegramId: '987654321',
        email: 'verified@test.pro'
      } as any);
      vi.mocked(db.payment.create).mockResolvedValue({ id: 'pay_large' } as any);
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'yk_50000', confirmation: { confirmation_url: 'https://yookassa.ru/confirm/50000' } })
      }));

      const res = await createTopUpPaymentAction(50000, 'yookassa');
      expect(res.success).toBe(true);
      expect(res.paymentUrl).toBe('https://yookassa.ru/confirm/50000');
    });

    it('allows unverified user (telegramId=null) for CryptoBot top-up > $20 (5000 RUB)', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: 'usr_unverified' });
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'usr_unverified',
        telegramId: null,
        email: 'user@test.pro'
      } as any);
      vi.mocked(db.payment.create).mockResolvedValue({ id: 'pay_crypto' } as any);
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, result: { invoice_id: 999, pay_url: 'https://t.me/CryptoBot?start=pay999' } })
      }));

      const res = await createTopUpPaymentAction(5000, 'cryptobot');
      expect(res.success).toBe(true);
      expect(res.paymentUrl).toBe('https://t.me/CryptoBot?start=pay999');
    });

    it('rejects top-up amounts below minimum 10 RUB (9.99 RUB)', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: 'usr_1' });
      await expect(createTopUpPaymentAction(9.99, 'yookassa')).rejects.toThrow('Минимальная сумма пополнения — 10 ₽');
    });

    it('rejects top-up for banned or deleted users', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: 'usr_banned' });
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'usr_banned',
        isDeleted: true,
        isActive: false
      } as any);

      await expect(createTopUpPaymentAction(100, 'yookassa')).rejects.toThrow('Ваш аккаунт заблокирован или удален');
    });
  });

  describe('2. Checkout Flow Anti-Fraud & 54-FZ Limits (checkoutAction)', () => {
    beforeEach(() => {
      vi.mocked(db.service.findUnique).mockResolvedValue({
        id: 'svc_limits',
        isActive: true,
        externalId: 'ext_limits',
        minQty: 1,
        maxQty: 100000,
        providerId: 'p1',
        targetType: 'CHANNEL',
        category: { network: { name: 'Telegram', slug: 'telegram' } }
      } as any);
    });

    it('blocks YooKassa checkout > $20 (180,001 cents) when user does NOT have telegramId', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'usr_guest',
        telegramId: null,
        email: 'guest@test.pro'
      } as any);

      vi.mocked(marketingService.calculatePrice).mockResolvedValue({
        totalCents: 180001,
        originalTotalCents: 180001,
        discountCents: 0,
        discountPercent: 0,
        providerCostCents: 500,
        safetyFloorCents: 700,
        tier: 'REGULAR'
      });

      const res = await checkoutAction({
        serviceId: 'svc_limits',
        link: 'https://t.me/mychannel',
        quantity: 100,
        email: 'guest@test.pro',
        gateway: 'yookassa'
      });

      expect(res.success).toBe(false);
      expect((res as any).error).toContain(TELEGRAM_LIMIT_MESSAGE);
    });

    it('allows YooKassa checkout > $20 (185,000 cents) when user has telegramId', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'usr_verified',
        telegramId: '123456789',
        email: 'verified@test.pro'
      } as any);
      vi.mocked(db.order.create).mockResolvedValue({ id: 'ord_yk', charge: BigInt(185000) } as any);
      vi.mocked(db.payment.create).mockResolvedValue({ id: 'pay_yk' } as any);
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'yk_order_pay', confirmation: { confirmation_url: 'https://yookassa.ru/confirm/order' } })
      }));

      vi.mocked(marketingService.calculatePrice).mockResolvedValue({
        totalCents: 185000,
        originalTotalCents: 185000,
        discountCents: 0,
        discountPercent: 0,
        providerCostCents: 500,
        safetyFloorCents: 700,
        tier: 'REGULAR'
      });

      const res = await checkoutAction({
        serviceId: 'svc_limits',
        link: 'https://t.me/mychannel',
        quantity: 100,
        email: 'verified@test.pro',
        gateway: 'yookassa'
      });

      expect(res.success).toBe(true);
      expect((res as any).data.paymentUrl).toBe('https://yookassa.ru/confirm/order');
    });

    it('allows CryptoBot checkout > $20 (500,000 cents) without telegramId', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'usr_crypto_guest',
        telegramId: null,
        email: 'cryptoguest@test.pro'
      } as any);
      vi.mocked(db.order.create).mockResolvedValue({ id: 'ord_crypto', charge: BigInt(500000) } as any);
      vi.mocked(db.payment.create).mockResolvedValue({ id: 'pay_crypto' } as any);
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, result: { invoice_id: 111, pay_url: 'https://t.me/CryptoBot?start=inv111' } })
      }));

      vi.mocked(marketingService.calculatePrice).mockResolvedValue({
        totalCents: 500000,
        originalTotalCents: 500000,
        discountCents: 0,
        discountPercent: 0,
        providerCostCents: 500,
        safetyFloorCents: 700,
        tier: 'REGULAR'
      });

      const res = await checkoutAction({
        serviceId: 'svc_limits',
        link: 'https://t.me/mychannel',
        quantity: 100,
        email: 'cryptoguest@test.pro',
        gateway: 'cryptobot'
      });

      expect(res.success).toBe(true);
      expect((res as any).data.paymentUrl).toBe('https://t.me/CryptoBot?start=inv111');
    });

    it('strictly blocks CryptoBot checkout exceeding 54-FZ limit (> 15,000 RUB / 1,500,000 cents)', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'usr_crypto_whale',
        telegramId: '123456789',
        email: 'whale@test.pro'
      } as any);

      // 15,001 RUB = 1,500,100 cents (> 1,500,000 cents)
      vi.mocked(marketingService.calculatePrice).mockResolvedValue({
        totalCents: 1500100,
        originalTotalCents: 1500100,
        discountCents: 0,
        discountPercent: 0,
        providerCostCents: 500,
        safetyFloorCents: 700,
        tier: 'REGULAR'
      });

      const res = await checkoutAction({
        serviceId: 'svc_limits',
        link: 'https://t.me/mychannel',
        quantity: 1000,
        email: 'whale@test.pro',
        gateway: 'cryptobot'
      });

      expect(res.success).toBe(false);
      expect((res as any).error).toContain(CRYPTO_54FZ_LIMIT_MESSAGE);
    });

    it('allows CryptoBot checkout exactly at 15,000 RUB boundary (1,500,000 cents)', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'usr_crypto_bound',
        telegramId: null,
        email: 'bound@test.pro'
      } as any);
      vi.mocked(db.order.create).mockResolvedValue({ id: 'ord_crypto_bound', charge: BigInt(1500000) } as any);
      vi.mocked(db.payment.create).mockResolvedValue({ id: 'pay_crypto_bound' } as any);
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, result: { invoice_id: 222, pay_url: 'https://t.me/CryptoBot?start=inv222' } })
      }));

      vi.mocked(marketingService.calculatePrice).mockResolvedValue({
        totalCents: 1500000,
        originalTotalCents: 1500000,
        discountCents: 0,
        discountPercent: 0,
        providerCostCents: 500,
        safetyFloorCents: 700,
        tier: 'REGULAR'
      });

      const res = await checkoutAction({
        serviceId: 'svc_limits',
        link: 'https://t.me/mychannel',
        quantity: 1000,
        email: 'bound@test.pro',
        gateway: 'cryptobot'
      });

      expect(res.success).toBe(true);
      expect((res as any).data.paymentUrl).toBe('https://t.me/CryptoBot?start=inv222');
    });

    it('handles micro-orders (< 1000 cents / 10 RUB) by converting to 10 RUB minimum deposit', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'usr_micro',
        telegramId: null,
        email: 'micro@test.pro'
      } as any);
      vi.mocked(db.order.create).mockResolvedValue({ id: 'ord_micro', charge: BigInt(500) } as any);
      vi.mocked(db.payment.create).mockResolvedValue({ id: 'pay_micro' } as any);
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'yk_micro', confirmation: { confirmation_url: 'https://yookassa.ru/confirm/micro' } })
      }));

      // 5 RUB micro order
      vi.mocked(marketingService.calculatePrice).mockResolvedValue({
        totalCents: 500,
        originalTotalCents: 500,
        discountCents: 0,
        discountPercent: 0,
        providerCostCents: 200,
        safetyFloorCents: 300,
        tier: 'REGULAR'
      });

      const res = await checkoutAction({
        serviceId: 'svc_limits',
        link: 'https://t.me/mychannel',
        quantity: 10,
        email: 'micro@test.pro',
        gateway: 'yookassa'
      });

      expect(res.success).toBe(true);
      expect((res as any).data.paymentUrl).toBe('https://yookassa.ru/confirm/micro');
    });
  });
});
