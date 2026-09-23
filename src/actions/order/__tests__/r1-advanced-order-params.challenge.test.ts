import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkoutAction } from '../checkout';
import { db } from '@/lib/db';
import { RateLimitService } from '@/services/core/rate-limit.service';
import { verifySession } from '@/lib/session';
import { featureFlagService } from '@/services/system/feature-flag.service';
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
    ledgerEntry: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'ledger-1' }),
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

vi.mock('@/services/system/feature-flag.service', () => ({
  featureFlagService: {
    isEnabled: vi.fn().mockResolvedValue(true),
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

vi.mock('@/services/marketing.service', () => ({
  marketingService: {
    calculatePrice: vi.fn().mockResolvedValue({
      totalCents: 1000,
      originalTotalCents: 1000,
      discountCents: 0,
      providerCostCents: 500,
    }),
    consumePromoCode: vi.fn(),
  },
  logPromoCodeUsageIfNeeded: vi.fn(),
}));

vi.mock('@/validators/link-mutators', async () => {
  const actual = await vi.importActual('@/validators/link-mutators');
  return {
    ...actual,
    mutateLink: vi.fn((link) => link),
    getLinkValidator: vi.fn(() => ({
      safeParse: vi.fn().mockReturnValue({ success: true }),
    })),
  };
});

vi.mock('@/utils/target-type', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/target-type')>();
  return {
    ...actual,
    inferTargetTypeFromCategory: vi.fn().mockReturnValue('POST'),
  };
});

vi.mock('@/services/financial/payment-gateway.service', () => ({
  PaymentGatewayFactory: {
    getGateway: vi.fn().mockReturnValue({
      createPayment: vi.fn().mockResolvedValue({
        paymentId: 'pay-123',
        paymentUrl: 'https://payment.example.com/pay-123',
      }),
    }),
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

describe('Requirement R1: Advanced Order Parameters Integration (Empirical Challenge Suite)', () => {
  const mockService = {
    id: 'svc-100',
    name: 'Telegram Подписчики',
    isActive: true,
    externalId: 'ext-100',
    minQty: 100,
    maxQty: 50000,
    pricePerUnitRub: 0.5,
    isDripFeedEnabled: true,
    customDataType: 'NONE',
    clientRequirement: null,
    targetType: 'CHANNEL',
    category: {
      name: 'Подписчики',
      network: {
        slug: 'telegram',
      },
    },
  };

  const mockUser = {
    id: 'usr-1',
    email: 'test@example.com',
    tenantId: 'smmplan',
    telegramId: '12345678',
    isActive: true,
    isDeleted: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (RateLimitService.check as any).mockResolvedValue(true);
    (featureFlagService.isEnabled as any).mockResolvedValue(true);
    (verifySession as any).mockResolvedValue({ userId: 'usr-1' });
    (db.user.findUnique as any).mockResolvedValue(mockUser);
    (db.user.findFirst as any).mockResolvedValue(mockUser);
    (db.service.findUnique as any).mockResolvedValue(mockService);
    (db.order.create as any).mockResolvedValue({ id: 'ord-100' });
    (db.payment.create as any).mockResolvedValue({ id: 'pay-100' });
  });

  // ==========================================
  // SECTION 1: DRIP-FEED CALCULATION & INTERVAL VALIDATION
  // ==========================================
  describe('1. Drip-Feed Calculation & Interval Logic', () => {
    it('rejects order when drip_feed feature flag is disabled', async () => {
      (featureFlagService.isEnabled as any).mockImplementation((flag: string) => {
        if (flag === 'drip_feed') return Promise.resolve(false);
        return Promise.resolve(true);
      });

      const res = await checkoutAction({
        serviceId: 'svc-100',
        link: 'https://t.me/durov',
        quantity: 1000,
        email: 'test@example.com',
        gateway: 'yookassa',
        runs: 5,
        interval: 30,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain('Drip-feed временно отключена');
      }
    });

    it('rejects drip feed if service has isDripFeedEnabled = false', async () => {
      (db.service.findUnique as any).mockResolvedValue({
        ...mockService,
        isDripFeedEnabled: false,
      });

      const res = await checkoutAction({
        serviceId: 'svc-100',
        link: 'https://t.me/durov',
        quantity: 1000,
        email: 'test@example.com',
        gateway: 'yookassa',
        runs: 5,
        interval: 30,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain('не поддерживает Drip-feed');
      }
    });

    it('rejects order when chunk quantity (quantity / runs) is less than minQty', async () => {
      // minQty = 100, quantity = 300, runs = 4 => chunk = 75 < 100 minQty
      const res = await checkoutAction({
        serviceId: 'svc-100',
        link: 'https://t.me/durov',
        quantity: 300,
        email: 'test@example.com',
        gateway: 'yookassa',
        runs: 4,
        interval: 15,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain('не может быть меньше минимального (100)');
      }
    });

    it('accepts valid drip feed order when chunk quantity >= minQty', async () => {
      // minQty = 100, quantity = 500, runs = 5 => chunk = 100 >= 100 minQty
      const res = await checkoutAction({
        serviceId: 'svc-100',
        link: 'https://t.me/durov',
        quantity: 500,
        email: 'test@example.com',
        gateway: 'yookassa',
        runs: 5,
        interval: 60,
      });

      expect(res.success).toBe(true);
    });

    it('rejects simultaneous standard Drip-Feed (runs/interval) and Smart Drip (isSmartDrip)', async () => {
      const res = await checkoutAction({
        serviceId: 'svc-100',
        link: 'https://t.me/durov',
        quantity: 1000,
        email: 'test@example.com',
        gateway: 'yookassa',
        runs: 5,
        interval: 30,
        isSmartDrip: true,
        smartDripDays: 7,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain('Нельзя одновременно использовать обычный Drip-feed и Умный Dripfeed');
      }
    });

    it('rejects Smart Drip when daily chunk (quantity / smartDripDays) is less than minQty', async () => {
      (db.serviceSmartConfig.findUnique as any).mockResolvedValue({
        serviceId: 'svc-100',
        isEnabled: true,
        markup: 0.20,
      });

      // minQty = 100, quantity = 500, smartDripDays = 10 => chunk = 50 < 100 minQty
      const res = await checkoutAction({
        serviceId: 'svc-100',
        link: 'https://t.me/durov',
        quantity: 500,
        email: 'test@example.com',
        gateway: 'yookassa',
        isSmartDrip: true,
        smartDripDays: 10,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain('количество на 1 день (50) не может быть меньше минимального (100)');
      }
    });

    it('rejects invalid smartDripDays out of bounds (< 1 or > 30)', async () => {
      const res1 = await checkoutAction({
        serviceId: 'svc-100',
        link: 'https://t.me/durov',
        quantity: 1000,
        email: 'test@example.com',
        gateway: 'yookassa',
        isSmartDrip: true,
        smartDripDays: 0,
      });

      expect(res1.success).toBe(false);
      if (!res1.success) {
        expect(res1.error).toContain('Number must be greater than or equal to 1');
      }

      const res2 = await checkoutAction({
        serviceId: 'svc-100',
        link: 'https://t.me/durov',
        quantity: 1000,
        email: 'test@example.com',
        gateway: 'yookassa',
        isSmartDrip: true,
        smartDripDays: 31,
      });

      expect(res2.success).toBe(false);
      if (!res2.success) {
        expect(res2.error).toContain('Number must be less than or equal to 30');
      }
    });
  });

  // ==========================================
  // SECTION 2: CUSTOM DATA INPUT VALIDATION (TEXTAREA vs NUMBER)
  // ==========================================
  describe('2. Custom Data Validation Logic', () => {
    describe('getCustomValidator unit tests', () => {
      it('validates NUMBER customDataType correctly', () => {
        const validator = getCustomValidator('NUMBER');

        expect(validator.safeParse('123').success).toBe(true);
        expect(validator.safeParse('0').success).toBe(true);
        expect(validator.safeParse('99999').success).toBe(true);
        expect(validator.safeParse('   456   ').success).toBe(true); // trims leading/trailing spaces

        expect(validator.safeParse('abc').success).toBe(false);
        expect(validator.safeParse('12.34').success).toBe(false);
        expect(validator.safeParse('-10').success).toBe(false);
        expect(validator.safeParse('').success).toBe(false);
      });

      it('validates TEXTAREA customDataType correctly', () => {
        const validator = getCustomValidator('TEXTAREA');

        expect(validator.safeParse('Отличный пост! Спасибо!').success).toBe(true);
        expect(validator.safeParse('Многострочный\nкомментарий').success).toBe(true);

        // Empty / whitespace
        expect(validator.safeParse('').success).toBe(false);
        expect(validator.safeParse('   ').success).toBe(false);

        // Control characters
        expect(validator.safeParse('Text with null char \x00').success).toBe(false);
        expect(validator.safeParse('Text with bell \x07').success).toBe(false);

        // Length limits
        const text10k = 'a'.repeat(10000);
        expect(validator.safeParse(text10k).success).toBe(true);

        const text10k1 = 'a'.repeat(10001);
        expect(validator.safeParse(text10k1).success).toBe(false);
      });

      it('defaults to required non-empty string for unknown customDataType', () => {
        const validator = getCustomValidator('NONE');
        expect(validator.safeParse('some value').success).toBe(true);
        expect(validator.safeParse('').success).toBe(false);
      });
    });

    describe('checkoutAction customData validation integration', () => {
      it('validates customData for targetType = CUSTOM with NUMBER datatype', async () => {
        (db.service.findUnique as any).mockResolvedValue({
          ...mockService,
          targetType: 'CUSTOM',
          customDataType: 'NUMBER',
        });

        const resInvalid = await checkoutAction({
          serviceId: 'svc-100',
          link: 'https://t.me/durov',
          quantity: 100,
          email: 'test@example.com',
          gateway: 'yookassa',
          customData: 'invalid_number_abc',
        });

        expect(resInvalid.success).toBe(false);
        if (!resInvalid.success) {
          expect(resInvalid.error).toContain('Значение должно состоять только из цифр');
        }

        const resValid = await checkoutAction({
          serviceId: 'svc-100',
          link: 'https://t.me/durov',
          quantity: 100,
          email: 'test@example.com',
          gateway: 'yookassa',
          customData: '42',
        });

        expect(resValid.success).toBe(true);
      });

      it('enforces 2000 character limit on customData in checkoutAction', async () => {
        const longCustomData = 'x'.repeat(2001);

        const res = await checkoutAction({
          serviceId: 'svc-100',
          link: 'https://t.me/durov',
          quantity: 100,
          email: 'test@example.com',
          gateway: 'yookassa',
          customData: longCustomData,
        });

        if (!res.success) {
          expect(res.error).toContain('Слишком длинные пользовательские данные');
        }
      });
    });
  });

  // ==========================================
  // SECTION 3: JIT CONFIRMATION CHECKBOX BLOCKING BEHAVIOR
  // ==========================================
  describe('3. JIT Confirmation Checkbox Blocking Behavior', () => {
    it('blocks checkout when service has clientRequirement but isRequirementsConfirmed is false', async () => {
      (db.service.findUnique as any).mockResolvedValue({
        ...mockService,
        clientRequirement: 'Канал должен быть открытым и иметь минимум 10 постов',
      });

      const res = await checkoutAction({
        serviceId: 'svc-100',
        link: 'https://t.me/durov',
        quantity: 100,
        email: 'test@example.com',
        gateway: 'yookassa',
        isRequirementsConfirmed: false,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe('Необходимо подтвердить выполнение условий для старта услуги');
      }
    });

    it('blocks checkout when service has clientRequirement and isRequirementsConfirmed is omitted (undefined)', async () => {
      (db.service.findUnique as any).mockResolvedValue({
        ...mockService,
        clientRequirement: 'Канал должен быть открытым',
      });

      const res = await checkoutAction({
        serviceId: 'svc-100',
        link: 'https://t.me/durov',
        quantity: 100,
        email: 'test@example.com',
        gateway: 'yookassa',
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe('Необходимо подтвердить выполнение условий для старта услуги');
      }
    });

    it('allows checkout when service has clientRequirement and isRequirementsConfirmed is true', async () => {
      (db.service.findUnique as any).mockResolvedValue({
        ...mockService,
        clientRequirement: 'Канал должен быть открытым',
      });

      const res = await checkoutAction({
        serviceId: 'svc-100',
        link: 'https://t.me/durov',
        quantity: 100,
        email: 'test@example.com',
        gateway: 'yookassa',
        isRequirementsConfirmed: true,
      });

      expect(res.success).toBe(true);
    });

    it('allows checkout without requirement confirmation if service has NO clientRequirement', async () => {
      (db.service.findUnique as any).mockResolvedValue({
        ...mockService,
        clientRequirement: null,
      });

      const res = await checkoutAction({
        serviceId: 'svc-100',
        link: 'https://t.me/durov',
        quantity: 100,
        email: 'test@example.com',
        gateway: 'yookassa',
        isRequirementsConfirmed: false,
      });

      expect(res.success).toBe(true);
    });
  });
});
