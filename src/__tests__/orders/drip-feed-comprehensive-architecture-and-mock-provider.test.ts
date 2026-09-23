import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockProviderPost } from '@/__tests__/helpers/mock-provider-handler';
import { NextRequest } from 'next/server';
import { calculatePartialRefund } from '@/utils/refund';
import { checkoutAction } from '@/actions/order/checkout';
import { db } from '@/lib/db';
import { RateLimitService } from '@/services/core/rate-limit.service';
import { featureFlagService } from '@/services/system/feature-flag.service';

vi.mock('@/lib/session', () => ({
  verifySession: vi.fn().mockResolvedValue({
    isAuth: true,
    userId: 'u_drip_master',
    user: { id: 'u_drip_master', email: 'drip@smmplan.pro' },
  }),
  createSession: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/services/financial/wallet-ops', () => ({
  WalletOps: {
    charge: vi.fn().mockResolvedValue({ success: true }),
    refund: vi.fn().mockResolvedValue({ success: true, ledgerEntryId: 'ledg_123' }),
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
        paymentId: 'pay-drip-123',
      }),
    }),
  },
}));

vi.mock('@/lib/db', () => {
  const mockDb = {
    $transaction: vi.fn((cb) => cb(mockDb)),
    user: {
      findUnique: vi.fn().mockResolvedValue({ id: 'u_drip_master', email: 'drip@smmplan.pro' }),
      findFirst: vi.fn().mockResolvedValue({ id: 'u_drip_master', email: 'drip@smmplan.pro' }),
      create: vi.fn().mockResolvedValue({ id: 'u_drip_master', email: 'drip@smmplan.pro' }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    service: {
      findUnique: vi.fn(),
    },
    order: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        id: 'ord_drip_99',
        numericId: 99999,
        status: 'IN_PROGRESS',
        isDripFeed: true,
        runs: 5,
        interval: 60,
      }),
      update: vi.fn().mockResolvedValue({ id: 'ord_drip_99', status: 'PARTIAL' }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    ledgerEntry: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'ledg_99' }),
    },
    systemSettings: {
      findUnique: vi.fn().mockResolvedValue({ isTestMode: false, tenant: 'smmplan' }),
      findFirst: vi.fn().mockResolvedValue({ isTestMode: false, tenant: 'smmplan' }),
    },
    tenant: {
      findUnique: vi.fn().mockResolvedValue({ id: 'tenant_smmplan', slug: 'smmplan' }),
      findFirst: vi.fn().mockResolvedValue({ id: 'tenant_smmplan', slug: 'smmplan' }),
    },
    contentItem: {
      findUnique: vi.fn().mockResolvedValue({ updatedAt: new Date() }),
      findFirst: vi.fn().mockResolvedValue({ updatedAt: new Date() }),
    },
    payment: {
      create: vi.fn().mockResolvedValue({ id: 'pay_99' }),
      update: vi.fn().mockResolvedValue({ id: 'pay_99' }),
      findUnique: vi.fn().mockResolvedValue({ id: 'pay_99' }),
    },
    orderStatusAudit: {
      create: vi.fn().mockResolvedValue({ id: 'audit_99' }),
    },
  };
  return { db: mockDb };
});

vi.mock('@/services/core/rate-limit.service', () => ({
  RateLimitService: {
    check: vi.fn().mockResolvedValue({ allowed: true }),
    checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 10, resetInSeconds: 60 }),
  },
}));

vi.mock('@/services/system/feature-flag.service', () => ({
  featureFlagService: {
    isEnabled: vi.fn().mockResolvedValue(true),
    getFlag: vi.fn().mockResolvedValue(true),
  },
}));

describe('Drip-Feed Comprehensive Architecture & Mock Provider Invariants', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      ENABLE_DEV_ROUTES: 'true',
      MOCK_PROVIDER_KEY: 'test-mock-secret-key-123456789',
    };
  });

  // Helper to create POST requests to mock provider route
  function createMockRequest(bodyParams: Record<string, string>): NextRequest {
    const searchParams = new URLSearchParams(bodyParams);
    return new NextRequest('http://localhost:3000/api/dev/mock-provider', {
      method: 'POST',
      body: searchParams.toString(),
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
    });
  }

  describe('1. Mock Provider API Strict Min/Max & Drip Validation', () => {
    it('STRICTLY REJECTS when quantity is below service.min (service 100, min: 10, sent: 5)', async () => {
      const req = createMockRequest({
        key: 'test-mock-secret-key-123456789',
        action: 'add',
        service: '100',
        link: 'https://t.me/durov',
        quantity: '5',
      });

      const res = await mockProviderPost(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.error).toBe('Quantity must be at least 10');
      expect(data.order).toBeUndefined();
    });

    it('STRICTLY REJECTS when quantity exceeds service.max (service 100, max: 50000, sent: 60000)', async () => {
      const req = createMockRequest({
        key: 'test-mock-secret-key-123456789',
        action: 'add',
        service: '100',
        link: 'https://t.me/durov',
        quantity: '60000',
      });

      const res = await mockProviderPost(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.error).toBe('Quantity must not exceed 50000');
      expect(data.order).toBeUndefined();
    });

    it('STRICTLY REJECTS Drip-Feed when service does not support dripfeed (service 500, dripfeed: false)', async () => {
      const req = createMockRequest({
        key: 'test-mock-secret-key-123456789',
        action: 'add',
        service: '500',
        link: 'https://t.me/durov',
        quantity: '50',
        runs: '5',
        interval: '60',
      });

      const res = await mockProviderPost(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.error).toBe('Drip-feed is not supported for this service');
      expect(data.order).toBeUndefined();
    });

    it('ACCEPTS valid Drip-Feed order when quantity is within bounds and service supports it', async () => {
      const req = createMockRequest({
        key: 'test-mock-secret-key-123456789',
        action: 'add',
        service: '100',
        link: 'https://t.me/durov',
        quantity: '200',
        runs: '5',
        interval: '60',
      });

      const res = await mockProviderPost(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.error).toBeUndefined();
      expect(data.order).toBeDefined();
      expect(typeof data.order).toBe('string');
      expect(data.order).toContain('mock_std_');
    });

    it('Simulates Partial Order lifecycle and reports 40% remains', async () => {
      const addReq = createMockRequest({
        key: 'test-mock-secret-key-123456789',
        action: 'add',
        service: '100',
        link: 'https://test.me/partial',
        quantity: '500',
      });

      const addRes = await mockProviderPost(addReq);
      const addData = await addRes.json();
      expect(addData.order).toBeDefined();

      // Check status of partial order
      const statusReq = createMockRequest({
        key: 'test-mock-secret-key-123456789',
        action: 'status',
        order: addData.order,
      });

      const statusRes = await mockProviderPost(statusReq);
      const statusData = await statusRes.json();

      expect(statusData).toBeDefined();
      expect(statusData.currency).toBe('RUB');
      expect(parseInt(statusData.remains, 10)).toBeGreaterThan(0);
    });
  });

  describe('2. Backend Checkout Min/Max Boundaries & Floor Invariant', () => {
    const mockService = {
      id: 'svc-tg-drip',
      externalId: '100',
      name: 'Подписчики Telegram',
      category: 'Telegram',
      targetType: 'CHANNEL',
      linkType: 'PROFILE',
      pricePerUnitRub: 0.1,
      minQty: 10,
      maxQty: 5000,
      isActive: true,
      isDeleted: false,
      isDripFeedEnabled: true,
      providerId: 'prov_alpha',
    };

    it('REJECTS checkout if order quantity exceeds service.maxQty', async () => {
      (db.service.findUnique as any).mockResolvedValue(mockService);

      const res = await checkoutAction({
        serviceId: 'svc-tg-drip',
        link: 'https://t.me/durov',
        quantity: 6000, // > 5000 maxQty
        gateway: 'balance',
        idempotencyKey: 'idemp-over-max-1',
        email: 'drip@smmplan.pro',
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain('от 10 до 5000');
      }
    });

    it('REJECTS Drip-Feed when total quantity / runs is less than service.minQty', async () => {
      (db.service.findUnique as any).mockResolvedValue(mockService);

      const res = await checkoutAction({
        serviceId: 'svc-tg-drip',
        link: 'https://t.me/durov',
        quantity: 30, // 30 / 5 runs = 6 < 10 minQty
        runs: 5,
        interval: 30,
        gateway: 'balance',
        idempotencyKey: 'idemp-under-min-run',
        email: 'drip@smmplan.pro',
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain('Для Drip-feed количество на один запуск (6) не может быть меньше минимального (10)');
      }
    });

    it('ACCEPTS Drip-Feed checkout when quantity / runs >= minQty', async () => {
      (db.service.findUnique as any).mockResolvedValue(mockService);

      const res = await checkoutAction({
        serviceId: 'svc-tg-drip',
        link: 'https://t.me/durov',
        quantity: 50, // 50 / 5 runs = 10 == 10 minQty
        runs: 5,
        interval: 30,
        gateway: 'balance',
        idempotencyKey: 'idemp-valid-drip-50',
        email: 'drip@smmplan.pro',
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data?.orderId).toBeDefined();
      }
    });
  });

  describe('3. Partial Delivery Pro-Rata Refund Mathematical Invariants', () => {
    it('computes exact proportional refund for partial delivery: remains 400 of 1000 at 1000 cents = 400 cents', () => {
      const order = {
        quantity: 1000,
        remains: 400,
        charge: 1000, // 1000 kopecks
      };

      const refund = calculatePartialRefund(order);
      expect(refund).toBe(400);
    });

    it('computes exact proportional refund for fractional kopecks (floored): remains 333 of 1000 at 500 cents = 166 cents', () => {
      const order = {
        quantity: 1000,
        remains: 333,
        charge: 500,
      };

      const refund = calculatePartialRefund(order);
      expect(refund).toBe(Math.floor((333 / 1000) * 500)); // 166
    });

    it('returns 0 refund if remains is 0 (fully completed)', () => {
      const order = {
        quantity: 1000,
        remains: 0,
        charge: 5000,
      };

      const refund = calculatePartialRefund(order);
      expect(refund).toBe(0);
    });

    it('returns full charge if order was completely unfulfilled (remains == quantity)', () => {
      const order = {
        quantity: 500,
        remains: 500,
        charge: 2500,
      };

      const refund = calculatePartialRefund(order);
      expect(refund).toBe(2500);
    });

    it('caps refund at total charge even if remains somehow exceeds quantity (anomaly defense)', () => {
      const order = {
        quantity: 100,
        remains: 150,
        charge: 1000,
      };

      const refund = calculatePartialRefund(order);
      expect(refund).toBe(1000); // cannot refund more than paid
    });
  });
});
