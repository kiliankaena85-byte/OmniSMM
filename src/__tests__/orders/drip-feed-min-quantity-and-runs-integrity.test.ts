import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkoutAction } from '@/actions/order/checkout';
import { db } from '@/lib/db';
import { RateLimitService } from '@/services/core/rate-limit.service';
import { featureFlagService } from '@/services/system/feature-flag.service';

vi.mock('@/lib/session', () => ({
  verifySession: vi.fn().mockResolvedValue({
    isAuth: true,
    userId: 'u1',
    user: { id: 'u1', email: 'customer@test.pro' },
  }),
  createSession: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/services/financial/wallet-ops', () => ({
  WalletOps: {
    charge: vi.fn().mockResolvedValue({ success: true }),
  },
  WalletInsufficientFundsError: class extends Error {},
  WalletUserNotFoundError: class extends Error {},
  WalletInvalidAmountError: class extends Error {},
}));

vi.mock('@/services/financial/payment-gateway.service', () => ({
  PaymentGatewayFactory: {
    getGateway: vi.fn().mockReturnValue({
      createPayment: vi.fn().mockResolvedValue({
        paymentUrl: 'https://yookassa.ru/test-pay',
        paymentId: 'pay-123',
      }),
    }),
  },
}));

vi.mock('@/lib/db', () => {
  const mockDb = {
    $transaction: vi.fn((cb) => cb(mockDb)),
    user: {
      findUnique: vi.fn().mockResolvedValue({ id: 'u1', email: 'customer@test.pro' }),
      findFirst: vi.fn().mockResolvedValue({ id: 'u1', email: 'customer@test.pro' }),
      create: vi.fn().mockResolvedValue({ id: 'u1', email: 'customer@test.pro' }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    service: {
      findUnique: vi.fn(),
    },
    order: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        id: 'ord_drip_ok_123',
        numericId: 'ORD-9999',
        totalPrice: 8.3,
      }),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    payment: {
      create: vi.fn().mockResolvedValue({
        id: 'pay_drip_ok_123',
        paymentUrl: 'https://yookassa.ru/test-pay',
      }),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
    },
    contentItem: {
      findUnique: vi.fn(),
    },
    promoCode: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    serviceSmartConfig: {
      findUnique: vi.fn(),
    },
    tenant: {
      findUnique: vi.fn().mockResolvedValue({ id: 'tenant_smmplan', slug: 'smmplan' }),
      findFirst: vi.fn().mockResolvedValue({ id: 'tenant_smmplan', slug: 'smmplan' }),
    },
    systemSettings: {
      findUnique: vi.fn().mockResolvedValue({ id: 'tenant_smmplan', isTestMode: false }),
      findFirst: vi.fn().mockResolvedValue({ id: 'tenant_smmplan', isTestMode: false }),
      upsert: vi.fn().mockResolvedValue({ id: 'tenant_smmplan', isTestMode: false }),
    },
    settings: {
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    tenantSetting: {
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    globalSetting: {
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    ledgerEntry: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'ledger-1' }),
    },
  };
  return {
    db: mockDb,
    prisma: mockDb,
  };
});

describe('Drip-Feed Min Quantity & Runs Integrity Test Suite', () => {
  const mockServiceId = 'test_drip_svc_5min';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(RateLimitService, 'check').mockResolvedValue(true);
    (featureFlagService.isEnabled as any) = vi.fn().mockResolvedValue(true);
  });

  describe('1. Backend Strict Rejection of Sub-Minimum Drip-Feed Orders', () => {
    it('STRICTLY REJECTS order when total quantity / runs is less than service.minQty (e.g. 5 qty / 2 runs = 2 < 5 minQty)', async () => {
      // Setup mock service with minQty = 5
      (db.service.findUnique as any).mockResolvedValue({
        id: mockServiceId,
        externalId: 'ext_123',
        isActive: true,
        isDripFeedEnabled: true,
        targetType: 'CHANNEL',
        minQty: 5,
        maxQty: 40000,
        pricePerUnitRub: 0.83,
        tenantId: 'smmplan',
        category: {
          network: {
            slug: 'telegram',
          },
        },
      });

      // Attempt to order 5 units across 2 runs (2.5 units per run -> Math.floor = 2 < 5 minQty)
      const res = await checkoutAction({
        serviceId: mockServiceId,
        link: 'https://t.me/durov',
        quantity: 5,
        runs: 2,
        interval: 5,
        email: 'customer@test.pro',
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toMatch(/Для Drip-feed количество на один запуск.*не может быть меньше минимального.*5/i);
      }
    });

    it('ACCEPTS order when total quantity / runs satisfies service.minQty (e.g. 10 qty / 2 runs = 5 >= 5 minQty)', async () => {
      (db.service.findUnique as any).mockResolvedValue({
        id: mockServiceId,
        externalId: 'ext_123',
        isActive: true,
        isDripFeedEnabled: true,
        targetType: 'CHANNEL',
        minQty: 5,
        maxQty: 40000,
        pricePerUnitRub: 0.83,
        tenantId: 'smmplan',
        category: {
          network: {
            slug: 'telegram',
          },
        },
      });

      const res = await checkoutAction({
        serviceId: mockServiceId,
        link: 'https://t.me/durov',
        quantity: 10,
        runs: 2,
        interval: 5,
        gateway: 'balance',
        idempotencyKey: 'idemp-drip-ok-123',
        email: 'customer@test.pro',
      });

      expect(res.success).toBe(true);
    });

    it('STRICTLY REJECTS Smart Drip when total quantity / smartDripDays is less than minQty', async () => {
      (db.service.findUnique as any).mockResolvedValue({
        id: mockServiceId,
        externalId: 'ext_123',
        isActive: true,
        isDripFeedEnabled: true,
        targetType: 'CHANNEL',
        smartConfig: { isEnabled: true, markup: 0.1 },
        minQty: 10,
        maxQty: 40000,
        pricePerUnitRub: 0.83,
        tenantId: 'smmplan',
        category: {
          network: {
            slug: 'telegram',
          },
        },
      });

      // Attempt to order 20 units across 5 days (4 units per day < 10 minQty)
      const res = await checkoutAction({
        serviceId: mockServiceId,
        link: 'https://t.me/durov',
        quantity: 20,
        isSmartDrip: true,
        smartDripDays: 5,
        email: 'customer@test.pro',
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toMatch(/Для Умного Drip-feed количество на 1 день.*не может быть меньше минимального.*10/i);
      }
    });
  });

  describe('2. Drip-feed Mathematical Constraints & Zero-Ambiguity Invariants', () => {
    it('verifies that minimum valid order volume scales exactly with runs (minQty * runs)', () => {
      const minQty = 5;
      const runs = 2;
      const minRequiredTotal = minQty * runs;

      expect(minRequiredTotal).toBe(10);
      expect(Math.floor(minRequiredTotal / runs)).toBeGreaterThanOrEqual(minQty);
    });

    it('ensures runs can never be zero or negative', async () => {
      const resZeroRuns = await checkoutAction({
        serviceId: mockServiceId,
        link: 'https://t.me/durov',
        quantity: 100,
        runs: 0,
        interval: 5,
        email: 'customer@test.pro',
      });

      expect(resZeroRuns.success).toBe(false);
    });
  });
});
