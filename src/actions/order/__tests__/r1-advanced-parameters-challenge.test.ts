import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { checkoutAction, calculatePriceAction } from '../checkout';
import { verifySession } from '@/lib/session';
import { getCustomValidator } from '@/validators/link-mutators';

vi.mock('@/services/financial/wallet-ops', () => ({
  WalletOps: {
    charge: vi.fn().mockResolvedValue({ success: true }),
  },
  WalletInsufficientFundsError: class extends Error {
    readonly code = 'INSUFFICIENT_FUNDS';
    constructor() {
      super('Недостаточно средств');
      this.name = 'WalletInsufficientFundsError';
    }
  },
  WalletUserNotFoundError: class extends Error {},
  WalletInvalidAmountError: class extends Error {},
}));

vi.mock('@/services/dripfeed/smart-drip.service', () => ({
  SmartDripService: {
    createCampaign: vi.fn().mockResolvedValue({ id: 'campaign-1' }),
  },
}));

vi.mock('@/lib/db', () => {
  const mockDb = {
    $transaction: vi.fn((cb) => cb(mockDb)),
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    service: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    order: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    payment: {
      create: vi.fn(),
      update: vi.fn(),
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
    securityEvent: {
      create: vi.fn().mockResolvedValue({ id: 'sec-1' }),
    },
  };
  return {
    db: mockDb,
  };
});

vi.mock('@/services/core/rate-limit.service', () => ({
  RateLimitService: {
    check: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('@/lib/settings', () => ({
  SettingsManager: {
    isTestMode: vi.fn().mockResolvedValue(false),
    getPaymentSecrets: vi.fn().mockResolvedValue({}),
  },
  SettingsProvider: {
    getCached: vi.fn().mockResolvedValue({
      isTestMode: false,
      siteName: 'Smmplan',
      globalMarkup: 3.0,
      safetyFloor: 1.0,
      exchangeRateUSD: 90.0,
    }),
    getExchangeRateUSD: vi.fn().mockResolvedValue(90.0),
    getTenantId: vi.fn().mockResolvedValue('smmplan'),
    isTestEnvironment: vi.fn().mockReturnValue(true),
  },
}));

vi.mock('@/lib/session', () => ({
  verifySession: vi.fn(),
  createSession: vi.fn(),
  getEncodedKey: vi.fn().mockReturnValue(new TextEncoder().encode('secretsecretsecretsecretsecretsecretsecret')),
}));

vi.mock('@/services/system/feature-flag.service', () => ({
  featureFlagService: {
    isEnabled: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('@/utils/ip', () => ({
  getClientIp: vi.fn().mockResolvedValue('127.0.0.1'),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn((key) => {
      if (key === 'host') return 'localhost:3000';
      if (key === 'x-forwarded-proto') return 'http';
      if (key === 'user-agent') return 'test-agent';
      return null;
    }),
  }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/smtp', () => ({
  sendOrderPaidMail: vi.fn().mockResolvedValue(true),
  sendOrderBalanceDebitMail: vi.fn().mockResolvedValue(true),
}));

describe('Requirement R1 Empirical Stress Tests & Challenge Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultUser = {
    id: 'user-1',
    email: 'challenger@test.com',
    balance: 50000,
    isActive: true,
    isDeleted: false,
    totalSpent: BigInt(0),
    personalDiscount: 0,
  };

  const defaultService = {
    id: 'service-drip-1',
    name: 'Telegram Subscribers',
    isActive: true,
    externalId: 'ext-drip-1',
    rate: 10.0,
    markup: 2.0,
    providerCurrency: 'RUB',
    minQty: 10,
    maxQty: 10000,
    isDripFeedEnabled: true,
    targetType: 'POST',
    category: { network: { slug: 'tg' } },
  };

  const baseValidOrderData = {
    serviceId: 'service-drip-1',
    link: 'https://t.me/durov',
    quantity: 1000,
    email: 'challenger@test.com',
    gateway: 'balance',
  };

  // ==========================================
  // SECTION 1: runs and interval Edge Cases
  // ==========================================
  describe('1. runs and interval Edge Cases', () => {
    it('1.1 Negative and zero runs/interval are rejected by Zod validation in checkoutAction', async () => {
      const resNegativeRuns = await checkoutAction({
        ...baseValidOrderData,
        runs: -5,
        interval: 10,
      });
      expect(resNegativeRuns.success).toBe(false);

      const resZeroRuns = await checkoutAction({
        ...baseValidOrderData,
        runs: 0,
        interval: 10,
      });
      expect(resZeroRuns.success).toBe(false);

      const resNegativeInterval = await checkoutAction({
        ...baseValidOrderData,
        runs: 5,
        interval: -10,
      });
      expect(resNegativeInterval.success).toBe(false);
    });

    it('1.2 Extreme runs causes per-run quantity to fall below service.minQty', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: 'user-1' } as any);
      vi.mocked(db.user.findUnique).mockResolvedValue(defaultUser as any);
      vi.mocked(db.service.findUnique).mockResolvedValue({
        ...defaultService,
        minQty: 100,
      } as any);

      // Total quantity = 1000, runs = 100 -> runQty = Math.floor(1000/100) = 10 < minQty (100)
      const res = await checkoutAction({
        ...baseValidOrderData,
        quantity: 1000,
        runs: 100,
        interval: 30,
        gateway: 'balance',
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain('не может быть меньше минимального');
      }
    });

    it('1.3 CRITICAL BUG DISCOVERY: checkoutAction creates Order WITHOUT setting isDripFeed: true', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: 'user-1' } as any);
      vi.mocked(db.user.findUnique).mockResolvedValue(defaultUser as any);
      vi.mocked(db.user.findFirst).mockResolvedValue(defaultUser as any);
      vi.mocked(db.service.findUnique).mockResolvedValue(defaultService as any);

      vi.mocked(db.order.create).mockResolvedValue({ id: 'order-drip-1', numericId: 7001 } as any);
      vi.mocked(db.payment.create).mockResolvedValue({ id: 'payment-drip-1' } as any);

      const res = await checkoutAction({
        ...baseValidOrderData,
        quantity: 1000,
        runs: 5,
        interval: 60,
        gateway: 'balance',
      });

      if (!res.success) {
        console.error('DEBUG test 1.3 error:', res.error);
      }
      expect(res.success).toBe(true);
      expect(db.order.create).toHaveBeenCalled();

      // Inspect exact payload passed to tx.order.create
      const orderCreateCall = vi.mocked(db.order.create).mock.calls[0][0];
      const createData = orderCreateCall.data;

      // FIXED: runs and interval are present, and isDripFeed is set to true!
      expect(createData.runs).toBe(5);
      expect(createData.interval).toBe(60);
      expect(createData.isDripFeed).toBe(true);
    });
  });

  // ==========================================
  // SECTION 2: customData and customDataType Validation
  // ==========================================
  describe('2. customData and customDataType Validation', () => {
    it('2.1 BUG DISCOVERY: Server skips customData validation when targetType !== "CUSTOM"', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: 'user-1' } as any);
      vi.mocked(db.user.findUnique).mockResolvedValue(defaultUser as any);

      // Service has customDataType = 'TEXTAREA' (custom comments for a Telegram Post) but targetType = 'POST'
      vi.mocked(db.service.findUnique).mockResolvedValue({
        ...defaultService,
        id: 'service-comment-1',
        targetType: 'POST', // targetType is POST, not CUSTOM
        customDataType: 'TEXTAREA',
      } as any);

      vi.mocked(db.order.create).mockResolvedValue({ id: 'order-comment-1', numericId: 8001 } as any);
      vi.mocked(db.payment.create).mockResolvedValue({ id: 'payment-comment-1' } as any);

      // User sends empty/whitespace customData for a service that requires TEXTAREA customData!
      const res = await checkoutAction({
        ...baseValidOrderData,
        serviceId: 'service-comment-1',
        customData: '   ', // Only spaces
        gateway: 'balance',
      });

      // FIXED: The server now validates customData when customDataType !== 'NONE'!
      expect(res.success).toBe(false);
    });

    it('2.2 BUG DISCOVERY: customValue fallback to link in targetType === "CUSTOM"', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: 'user-1' } as any);
      vi.mocked(db.user.findUnique).mockResolvedValue(defaultUser as any);

      // Service has targetType = 'CUSTOM' and customDataType = 'TEXTAREA'
      vi.mocked(db.service.findUnique).mockResolvedValue({
        ...defaultService,
        id: 'service-custom-1',
        targetType: 'CUSTOM',
        customDataType: 'TEXTAREA',
      } as any);

      vi.mocked(db.order.create).mockResolvedValue({ id: 'order-custom-1', numericId: 8002 } as any);
      vi.mocked(db.payment.create).mockResolvedValue({ id: 'payment-custom-1' } as any);

      // User sends customData: "" (empty string)
      const res = await checkoutAction({
        ...baseValidOrderData,
        serviceId: 'service-custom-1',
        customData: '', // Empty customData!
        gateway: 'balance',
      });

      // FIXED: Empty customData is rejected when required by customDataType
      expect(res.success).toBe(false);
    });

    it('2.3 getCustomValidator behavior on whitespace and empty strings', () => {
      const textareaValidator = getCustomValidator('TEXTAREA');
      const numberValidator = getCustomValidator('NUMBER');

      // Whitespace string trimmed to empty
      const textareaWsResult = textareaValidator.safeParse('   ');
      expect(textareaWsResult.success).toBe(false);
      if (!textareaWsResult.success) {
        expect(textareaWsResult.error.errors[0].message).toBe('Поле не может быть пустым');
      }

      const numberWsResult = numberValidator.safeParse('   ');
      expect(numberWsResult.success).toBe(false);
      if (!numberWsResult.success) {
        expect(numberWsResult.error.errors[0].message).toBe('Значение должно состоять только из цифр');
      }
    });
  });

  // ==========================================
  // SECTION 3: Drip-Feed & Promo Code / Discount Calculation
  // ==========================================
  describe('3. Drip-Feed and Promo Code/Discount Calculations', () => {
    it('3.1 calculatePriceAction ignores runs parameter in price preview', async () => {
      vi.mocked(db.service.findUnique).mockResolvedValue({
        ...defaultService,
        rate: 10.0,
        markup: 2.0,
        providerCurrency: 'USD',
      } as any);

      // Pass quantity = 500, runs = 10 to calculatePriceAction
      const resWithRuns = await calculatePriceAction('service-drip-1', 500, undefined, 10);
      const resWithoutRuns = await calculatePriceAction('service-drip-1', 500, undefined, undefined);

      expect(resWithRuns.success).toBe(true);
      expect(resWithoutRuns.success).toBe(true);
      if (resWithRuns.success && resWithoutRuns.success) {
        // FIXED: Price returned for resWithRuns factors in runs multiplier
        expect(resWithRuns.data?.totalCents).toBe((resWithoutRuns.data?.totalCents || 0) * 10);
      }
    });

    it('3.2 Smart Drip surcharge interaction with Promo Code discount', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: 'user-1' } as any);
      vi.mocked(db.user.findUnique).mockResolvedValue(defaultUser as any);
      vi.mocked(db.user.findFirst).mockResolvedValue(defaultUser as any);
      vi.mocked(db.service.findUnique).mockResolvedValue({
        ...defaultService,
        id: 'service-smart-1',
      } as any);

      vi.mocked(db.serviceSmartConfig.findUnique).mockResolvedValue({
        serviceId: 'service-smart-1',
        isEnabled: true,
        markup: 0.15, // 15% Smart Drip surcharge
      } as any);

      vi.mocked(db.promoCode.findUnique).mockResolvedValue({
        id: 'promo-1',
        code: 'SAVE20',
        discountPercent: 20.0,
        type: 'PERCENT',
        isActive: true,
        maxUses: 100,
        uses: 5,
        expiresAt: null,
      } as any);

      vi.mocked(db.promoCode.updateMany).mockResolvedValue({ count: 1 } as any);
      vi.mocked(db.order.create).mockResolvedValue({ id: 'order-smart-1', numericId: 9001 } as any);
      vi.mocked(db.payment.create).mockResolvedValue({ id: 'payment-smart-1' } as any);

      const res = await checkoutAction({
        ...baseValidOrderData,
        serviceId: 'service-smart-1',
        isSmartDrip: true,
        smartDripDays: 7,
        promoCodeStr: 'SAVE20',
        gateway: 'balance',
      });

      expect(res.success).toBe(true);
      const orderCreateCall = vi.mocked(db.order.create).mock.calls[0][0];
      const data = orderCreateCall.data;

      // Pricing details passed to Order:
      // charge has 15% Smart Drip markup applied.
      // discountCents is saved as raw pricing.discountCents (without Smart Drip markup adjustment).
      expect(data.charge).toBeDefined();
      expect(data.discountCents).toBeDefined();
    });
  });
});
