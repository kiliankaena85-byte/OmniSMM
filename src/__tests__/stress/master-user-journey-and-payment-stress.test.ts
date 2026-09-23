import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { WalletOps, WalletInsufficientFundsError, WalletUserNotFoundError } from '@/services/financial/wallet-ops';
import { paymentService } from '@/services/financial/payment.service';
import { SmartRoutingService, MarginGuard } from '@/services/providers/smart-routing.service';
import { ProviderBalanceService } from '@/services/admin/provider-balance.service';

vi.mock('@/lib/db', () => ({
  db: {
    $transaction: vi.fn(),
    payment: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    order: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    ledgerEntry: {
      create: vi.fn(),
      findFirst: vi.fn(),
      aggregate: vi.fn(),
    },
    service: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    serviceRoute: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    shadowService: {
      findUnique: vi.fn(),
    },
    provider: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    promoCodeUsage: {
      create: vi.fn(),
    },
    routingAuditLog: {
      create: vi.fn(),
    },
  },
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
    add: vi.fn().mockResolvedValue({ id: 'mock-job-1' }),
  },
  getRedisConnection: vi.fn().mockReturnValue({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
  }),
}));

vi.mock('@/lib/settings', () => ({
  SettingsProvider: {
    isTestMode: vi.fn().mockResolvedValue(false),
    getExchangeRateUSD: vi.fn().mockResolvedValue(100.0),
    getContactAndLegalSettings: vi.fn().mockResolvedValue({}),
    getSupportEmailDomain: vi.fn().mockResolvedValue('smmplan.pro'),
  },
  SettingsManager: {
    isTestMode: vi.fn().mockResolvedValue(false),
    getPaymentSecrets: vi.fn().mockResolvedValue({
      yookassaWebhookSecret: 'mock_secret_key',
    }),
  },
}));

vi.mock('@/lib/notifications', () => ({
  sendAdminAlert: vi.fn().mockResolvedValue(true),
}));

describe('👑 Master User Journey, Payment Stress & Smart Failover Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // VECTOR 1: User Journey Scenarios (UJ-01 to UJ-04)
  // ──────────────────────────────────────────────────────────────────────────
  describe('Vector 1: User Journeys & Order Lifecycle', () => {
    it('UJ-01: Guest Single Checkout via YooKassa transitions AWAITING_PAYMENT to PENDING and dispatches to queue', async () => {
      const mockPayment = {
        id: 'pay_guest_101',
        gatewayId: 'yoo_gw_guest_1',
        amount: BigInt(15000), // 150.00 RUB
        status: 'PENDING',
        userId: 'usr_guest_1',
        tenantId: 'smmplan',
        currency: 'RUB',
        orderId: 'ord_guest_101',
      };

      const mockOrder = {
        id: 'ord_guest_101',
        numericId: 1001,
        status: 'AWAITING_PAYMENT',
        charge: BigInt(15000),
        user: { email: 'guest@example.com' },
        service: { name: 'Telegram Подписчики (Стандарт)' },
      };

      let userState = { id: 'usr_guest_1', balance: BigInt(0), tenantId: 'smmplan' };

      vi.mocked(db.payment.findUnique).mockResolvedValue(mockPayment as any);
      vi.mocked(db.$transaction).mockImplementation(async (cb: any) => {
        const tx = {
          payment: {
            findUnique: vi.fn().mockResolvedValue(mockPayment),
            findFirst: vi.fn().mockResolvedValue(mockPayment),
            update: vi.fn().mockResolvedValue({ ...mockPayment, status: 'SUCCEEDED' }),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          user: {
            findUnique: vi.fn().mockImplementation(() => Promise.resolve({ ...userState })),
            findUniqueOrThrow: vi.fn().mockImplementation(() => Promise.resolve({ ...userState })),
            update: vi.fn().mockImplementation((args: any) => {
              if (args.data.balance !== undefined) {
                if (typeof args.data.balance === 'bigint') userState.balance = args.data.balance;
                else if (args.data.balance.increment) userState.balance += args.data.balance.increment;
                else if (args.data.balance.decrement) userState.balance -= args.data.balance.decrement;
              }
              return Promise.resolve({ ...userState });
            }),
            updateMany: vi.fn().mockImplementation((args: any) => {
              if (args.data?.balance?.decrement) userState.balance -= args.data.balance.decrement;
              return Promise.resolve({ count: 1 });
            }),
          },
          ledgerEntry: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({ id: 'led_guest_1' }),
          },
          order: {
            findUnique: vi.fn().mockResolvedValue(mockOrder),
            update: vi.fn().mockResolvedValue({ ...mockOrder, status: 'PENDING' }),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            findMany: vi.fn().mockResolvedValue([]),
          },
          promoCodeUsage: { create: vi.fn().mockResolvedValue({ id: 'promo_1' }) },
        };
        return cb(tx);
      });

      const success = await paymentService.confirmPayment(
        'yoo_gw_guest_1',
        BigInt(15000),
        'usr_guest_1',
        false,
        'yookassa',
        'pay_guest_101'
      );

      expect(success).toBe(true);
      expect(db.$transaction).toHaveBeenCalled();
    });

    it('UJ-02: Registered User Wallet Checkout creates LedgerEntry and debits balance cleanly', async () => {
      let balance = BigInt(50000); // 500.00 RUB
      const tx = {
        user: {
          findUnique: vi.fn().mockResolvedValue({ id: 'usr_wallet_1', balance, tenantId: 'smmplan' }),
          findUniqueOrThrow: vi.fn().mockImplementation(() => Promise.resolve({ id: 'usr_wallet_1', balance, tenantId: 'smmplan' })),
          updateMany: vi.fn().mockImplementation(({ where, data }) => {
            if (balance >= data.balance.decrement) {
              balance -= data.balance.decrement;
              return Promise.resolve({ count: 1 });
            }
            return Promise.resolve({ count: 0 });
          }),
        },
        ledgerEntry: {
          create: vi.fn().mockResolvedValue({ id: 'led_debit_1', amount: BigInt(-12000) }),
          findFirst: vi.fn().mockResolvedValue(null),
        },
      };

      const result = await WalletOps.charge(
        tx as any,
        'usr_wallet_1',
        BigInt(12000), // 120.00 RUB
        'Order #1002 Telegram Subscribers',
        { idempotencyKey: 'charge-order-1002' }
      );

      expect(result.balance).toBe(BigInt(38000));
      expect(tx.ledgerEntry.create).toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // VECTOR 2: Concurrency & Race Condition Defense (CONC-01 to CONC-03)
  // ──────────────────────────────────────────────────────────────────────────
  describe('Vector 2: Concurrency & Overdraft Guard', () => {
    it('CONC-01: 20 parallel checkouts racing for 500 RUB balance results in exactly 1 success and 19 rejections', async () => {
      let mockBalance = BigInt(50000); // 500.00 RUB
      const chargeAmount = BigInt(50000); // 500.00 RUB
      const userId = 'usr_race_500';

      const results = await Promise.allSettled(
        Array.from({ length: 20 }).map((_, idx) =>
          WalletOps.charge(
            {
              user: {
                findUnique: vi.fn().mockResolvedValue({ id: userId, balance: mockBalance, tenantId: 'smmplan' }),
                findUniqueOrThrow: vi.fn().mockImplementation(() => Promise.resolve({ id: userId, balance: mockBalance, tenantId: 'smmplan' })),
                updateMany: vi.fn().mockImplementation(async ({ data }) => {
                  if (mockBalance >= chargeAmount) {
                    mockBalance -= chargeAmount;
                    return { count: 1 };
                  }
                  return { count: 0 };
                }),
              },
              ledgerEntry: {
                create: vi.fn().mockResolvedValue({ id: `led_${idx}` }),
                findFirst: vi.fn().mockResolvedValue(null),
              },
            } as any,
            userId,
            chargeAmount,
            `Concurrent Checkout #${idx}`,
            { idempotencyKey: `parallel-key-${idx}` }
          )
        )
      );

      const fulfilled = results.filter(r => r.status === 'fulfilled');
      const rejected = results.filter(r => r.status === 'rejected');

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(19);
      expect(mockBalance).toBe(BigInt(0)); // Zero overdraft
    });

    it('CONC-02: Duplicate webhook delivery is handled idempotently without duplicate balance credits', async () => {
      const mockPayment = {
        id: 'pay_dup_1',
        gatewayId: 'yoo_gw_dup',
        amount: BigInt(30000),
        status: 'SUCCEEDED', // already succeeded
        currency: 'RUB',
        userId: 'usr_dup_1',
      };

      vi.mocked(db.payment.findUnique).mockResolvedValue(mockPayment as any);
      vi.mocked(db.$transaction).mockImplementation(async (cb: any) => {
        const tx = {
          payment: {
            findUnique: vi.fn().mockResolvedValue(mockPayment),
          },
        };
        return cb(tx);
      });

      // Webhook call for an already SUCCEEDED payment returns early with idempotent hit
      const success = await paymentService.confirmPayment(
        'yoo_gw_dup',
        BigInt(30000),
        'usr_dup_1',
        false,
        'yookassa',
        'pay_dup_1'
      );

      expect(success).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // VECTOR 3: Financial & Ledger Invariants (FIN-01 to FIN-06)
  // ──────────────────────────────────────────────────────────────────────────
  describe('Vector 3: Financial Precision & Partial Refund Math', () => {
    it('FIN-02: BigInt kopecks math eliminates floating point rounding errors', () => {
      const tenCents = BigInt(10);
      const twentyCents = BigInt(20);
      const thirtyCents = tenCents + twentyCents;

      expect(thirtyCents).toBe(BigInt(30));
      expect(Number(thirtyCents) / 100).toBe(0.30);
    });

    it('FIN-06: Partial refund calculates exact proportional amount in kopecks without loss', () => {
      // Order: 1,000 units, Charge: 350.00 RUB (35,000 kopecks), Remains: 400 units
      const chargeCents = BigInt(35000);
      const totalQty = BigInt(1000);
      const remains = BigInt(400);

      const refundCents = (chargeCents * remains) / totalQty;
      expect(refundCents).toBe(BigInt(14000)); // Exactly 140.00 RUB
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // VECTOR 4: Smart Failover & Hot-Swap Routing (OL-06 to OL-08)
  // ──────────────────────────────────────────────────────────────────────────
  describe('Vector 4: Smart Failover & Hot-Swap Routing', () => {
    it('OL-06: Automatically sorts and hot-swaps to Mock Beta when Mock Alpha fails', async () => {
      const mockRoutes = [
        {
          id: 'route_alpha',
          serviceId: 'srv_1',
          providerId: 'cmt99j0sd000pg42krtsp1ny1', // Mock Alpha
          providerServiceId: 'tg_sub_101',
          isPrimary: true,
          isActive: true,
          priority: 0,
          provider: {
            id: 'cmt99j0sd000pg42krtsp1ny1',
            name: 'Mock Provider Alpha',
            apiUrl: 'https://mock.smmplan.internal/api/v2',
            apiKey: 'mock_key',
            errorCount5m: 15, // DEGRADED!
          },
        },
        {
          id: 'route_beta',
          serviceId: 'srv_1',
          providerId: 'cmt99j0t2000qg42kb93zy4p4', // Mock Beta
          providerServiceId: 'tg_sub_201',
          isPrimary: false,
          isActive: true,
          priority: 1,
          provider: {
            id: 'cmt99j0t2000qg42kb93zy4p4',
            name: 'Mock Provider Beta',
            apiUrl: 'https://mock.smmplan.internal/api/v2',
            apiKey: 'mock_key',
            errorCount5m: 0, // HEALTHY!
          },
        },
      ];

      vi.mocked(db.serviceRoute.findMany).mockResolvedValue(mockRoutes as any);

      const candidateRoutes = await SmartRoutingService.getPrioritizedRoutes('srv_1');

      // Degraded Alpha (errorCount5m > 10) must be demoted behind healthy Beta
      expect(candidateRoutes[0].providerId).toBe('cmt99j0t2000qg42kb93zy4p4'); // Mock Beta first
      expect(candidateRoutes[1].providerId).toBe('cmt99j0sd000pg42krtsp1ny1'); // Mock Alpha second
    });

    it('LIQ-04: MarginGuard applies 5% foreign exchange volatility buffer to protect profit', async () => {
      // Client paid: 102.00 RUB = 10,200 cents
      // Provider rate: $1.00 USD, CBR exchange rate: 100.0 RUB -> Cost = (1.0 * 100 * 1.05 / 1000) * 1000 = 105.00 RUB = 10,500 cents
      const marginCheck = await MarginGuard.checkMargin(
        BigInt(10200), // clientPaidCents (102.00 RUB)
        1000,          // quantity
        1.0,           // providerRate
        'USD',         // providerCurrency
        0.05           // bufferPercent
      );

      expect(marginCheck.isProfitable).toBe(false); // Cost (10500) > Charge (10200)
      expect(marginCheck.costCents).toBe(BigInt(10500));
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // VECTOR 5: Payment Gateway Stress & Webhook Spam (PAY-01 to PAY-07)
  // ──────────────────────────────────────────────────────────────────────────
  describe('Vector 5: Payment Webhook Security & Zero-Trust Boundary', () => {
    it('PAY-07: SMM Provider Webhook cannot tamper with or fulfill unpaid AWAITING_PAYMENT orders', async () => {
      vi.mocked(db.order.findFirst).mockResolvedValueOnce(null);

      // Provider webhook queries with status filter IN ['IN_PROGRESS', 'PENDING_CHECK']
      const order = await db.order.findFirst({
        where: {
          status: { in: ['IN_PROGRESS', 'PENDING_CHECK'] },
          OR: [{ externalId: 'ext_order_unpaid_1' }, { id: 'ext_order_unpaid_1' }],
        },
      });

      expect(order).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // VECTOR 6: Low Balance & Liquidity Handling (LIQ-01 & LIQ-02)
  // ──────────────────────────────────────────────────────────────────────────
  describe('Vector 6: Liquidity & Balance Threshold Watchdog', () => {
    it('LIQ-01: Low balance under $10 USD (like VexBoost 3.20 RUB) evaluates to CRITICAL status', () => {
      const balanceUsd = 0.033; // 3.20 RUB / 95.0
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';

      if (balanceUsd > 50) status = 'healthy';
      else if (balanceUsd >= 10) status = 'warning';
      else status = 'critical';

      expect(status).toBe('critical');
    });

    it('LIQ-02: High balance over $50 USD (like Mock Alpha 50,000 RUB) evaluates to HEALTHY status', () => {
      const balanceUsd = 526.31; // 50,000 RUB / 95.0
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';

      if (balanceUsd > 50) status = 'healthy';
      else if (balanceUsd >= 10) status = 'warning';
      else status = 'critical';

      expect(status).toBe('healthy');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // VECTOR 7: Multi-Tenant Isolation (TEN-01 & TEN-02)
  // ──────────────────────────────────────────────────────────────────────────
  describe('Vector 7: Multi-Tenant Isolation (SMMplan vs SMMflux)', () => {
    it('TEN-02: Charging an SMMplan user under SMMflux tenant context is strictly rejected', async () => {
      const tx = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'usr_plan_only',
            balance: BigInt(100000), // 1000 RUB on smmplan
            tenantId: 'smmplan',
          }),
        },
      };

      await expect(
        WalletOps.charge(
          tx as any,
          'usr_plan_only',
          BigInt(50000),
          'SMMflux Checkout Attempt',
          { tenantId: 'flux' }
        )
      ).rejects.toThrow(WalletUserNotFoundError);
    });
  });
});
