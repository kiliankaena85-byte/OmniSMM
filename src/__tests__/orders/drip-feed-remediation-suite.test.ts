import { describe, it, expect, vi, beforeEach } from 'vitest';
import syncProcessor from '@/workers/processors/sync.processor';
import orderProcessor from '@/workers/processors/order.processor';
import { runInProgressTTLSweep, runCleanup } from '@/workers/processors/cleanup.processor';
import { SmartDripService } from '@/services/dripfeed/smart-drip.service';
import { parseProviderBoolean, parseProviderBooleanOptional } from '@/services/admin/catalog.service';
import { db } from '@/lib/db';
import { providerService } from '@/services/providers/provider.service';
import { RefundPolicyService } from '@/services/financial/refund-policy.service';
import { checkoutAction } from '@/actions/order/checkout';
import { featureFlagService } from '@/services/system/feature-flag.service';

vi.mock('@/lib/db', () => {
  const createModelMock = () => ({
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: 'gen-id' }),
    createMany: vi.fn().mockResolvedValue({ count: 0 }),
    update: vi.fn().mockResolvedValue({ id: 'gen-id' }),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    delete: vi.fn().mockResolvedValue({ id: 'gen-id' }),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    count: vi.fn().mockResolvedValue(0),
    aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
  });

  const rawDb: any = {
    $transaction: vi.fn(async (cb: any) => (typeof cb === 'function' ? cb(mockDb) : cb)),
    provider: { findMany: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    order: {
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 'ord-created-1', numericId: 'ORD-100', totalPrice: 50 }),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ id: 'u1', email: 'customer@test.pro' }),
      findFirst: vi.fn().mockResolvedValue({ id: 'u1', email: 'customer@test.pro' }),
      create: vi.fn().mockResolvedValue({ id: 'u1', email: 'customer@test.pro' }),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    service: { findUnique: vi.fn(), findMany: vi.fn() },
    smartCampaign: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 'camp-created-1' }),
    },
    smartTask: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn().mockImplementation((args) => Promise.resolve({ id: 'task-1', ...args.data })),
      createMany: vi.fn(),
    },
    payment: {
      create: vi.fn().mockResolvedValue({ id: 'pay-123', paymentUrl: 'https://yookassa.ru/test-pay' }),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      findUnique: vi.fn(),
    },
    adminAuditLog: { create: vi.fn(), deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
  };

  const mockDb: any = new Proxy(rawDb, {
    get(target, prop) {
      if (typeof prop === 'string' && !(prop in target)) {
        target[prop] = createModelMock();
      }
      return target[prop];
    },
  });

  return { db: mockDb };
});

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
    refund: vi.fn().mockResolvedValue({ success: true }),
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

vi.mock('@/services/financial/refund-policy.service', () => ({
  RefundPolicyService: {
    processRefund: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('@/lib/smtp', () => ({
  sendOrderCompletedMail: vi.fn().mockResolvedValue(true),
  sendOrderCanceledMail: vi.fn().mockResolvedValue(true),
  sendOrderBalanceDebitMail: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/services/providers/quarantine.service', () => ({
  QuarantineService: {
    restoreExpiredQuarantines: vi.fn().mockResolvedValue(true),
    evaluateTriggerC: vi.fn().mockResolvedValue(true),
    evaluateTriggerA: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('@/services/core/order.service', () => ({
  orderService: {
    failOrderTerminal: vi.fn().mockResolvedValue(true),
    processStatusUpdate: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('@/services/financial/compensation.service', () => ({
  CompensationService: {
    trackCompensation: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/notifications', () => ({
  sendAdminAlert: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/services/providers/provider.service', () => ({
  providerService: {
    getWorkerProviderInstance: vi.fn(),
    getProviderInstance: vi.fn(),
  },
}));

vi.mock('@/lib/queue-manager', () => ({
  ordersQueue: {
    add: vi.fn().mockResolvedValue(true),
    getJob: vi.fn().mockResolvedValue(null),
  },
  getRedisConnection: vi.fn().mockReturnValue({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  }),
}));

vi.mock('@/lib/redis-lock', () => ({
  MutexManager: {
    withLock: vi.fn().mockImplementation((key, ttl, wait, fn) => fn()),
    acquireLock: vi.fn().mockResolvedValue('token-123'),
    releaseLock: vi.fn().mockResolvedValue(true),
    extendLock: vi.fn().mockResolvedValue(true),
  },
}));

describe('Drip-Feed Remediation Suite (SPEC-2026-09-18)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.order.findUnique).mockReset().mockResolvedValue(null);
    vi.mocked(db.order.findMany).mockReset().mockResolvedValue([]);
    vi.mocked(db.order.update).mockReset().mockResolvedValue({ id: 'gen-id' } as any);
    vi.mocked(db.order.updateMany).mockReset().mockResolvedValue({ count: 1 } as any);
    vi.mocked(db.smartCampaign.findMany).mockReset().mockResolvedValue([]);
    vi.mocked(db.smartCampaign.update).mockReset().mockResolvedValue({ id: 'camp-gen' } as any);
    vi.mocked(db.smartTask.updateMany).mockReset().mockResolvedValue({ count: 0 } as any);
    vi.mocked(RefundPolicyService.processRefund).mockClear();
  });

  describe('1. Sync Processor: Native Drip-Feed External ID & Refund Handling', () => {
    it('polls order.externalId when order.isDripFeed is true and dripExternalIds is empty', async () => {
      vi.mocked(db.provider.findMany).mockResolvedValue([
        { id: 'p1', isActive: true, apiUrl: 'https://api.test', apiKey: 'key1' } as any,
      ]);

      vi.mocked(db.order.findMany)
        .mockResolvedValueOnce([{ id: 'drip-ord-1' }] as any) // activeOrderIds
        .mockResolvedValueOnce([
          {
            id: 'drip-ord-1',
            isDripFeed: true,
            dripExternalIds: [], // Native single-order Drip-Feed
            externalId: 'ext-native-100',
            charge: BigInt(50000),
            quantity: 1000,
            remains: 1000,
            status: 'IN_PROGRESS',
            userId: 'u1',
            tenantId: 'smmplan',
            user: { email: 'client@test.pro' },
            service: { name: 'TG Subs Drip' },
          },
        ] as any) // ordersBatch
        .mockResolvedValueOnce([]) // orphanOrders
        .mockResolvedValueOnce([]); // slowOrders

      const providerMock = {
        getMultiOrderStatus: vi.fn().mockResolvedValue({
          'ext-native-100': { status: 'In progress', remains: '800' },
        }),
      };
      vi.mocked(providerService.getWorkerProviderInstance).mockResolvedValue(providerMock as any);

      await syncProcessor({ name: 'sync-all' } as any);

      // Verify that provider was queried with ext-native-100
      expect(providerMock.getMultiOrderStatus).toHaveBeenCalledWith(['ext-native-100']);

      // Order should NOT be marked COMPLETED while provider reports In progress
      expect(db.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'drip-ord-1' },
          data: expect.objectContaining({ remains: 800 }),
        })
      );
    });

    it('invokes RefundPolicyService.processRefund for native Drip-Feed when provider returns PARTIAL', async () => {
      vi.mocked(db.provider.findMany).mockResolvedValue([
        { id: 'p1', isActive: true, apiUrl: 'https://api.test', apiKey: 'key1' } as any,
      ]);

      vi.mocked(db.order.findUnique).mockResolvedValue({
        id: 'drip-ord-2',
        status: 'IN_PROGRESS',
      } as any);

      vi.mocked(db.order.findMany)
        .mockResolvedValueOnce([{ id: 'drip-ord-2' }] as any)
        .mockResolvedValueOnce([
          {
            id: 'drip-ord-2',
            isDripFeed: true,
            dripExternalIds: [],
            externalId: 'ext-native-200',
            charge: BigInt(60000),
            quantity: 1000,
            remains: 1000,
            status: 'IN_PROGRESS',
            userId: 'u1',
            tenantId: 'smmplan',
            user: { email: 'client@test.pro' },
            service: { name: 'TG Subs Drip' },
          },
        ] as any)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      vi.mocked(db.order.update).mockResolvedValue({
        id: 'drip-ord-2',
        status: 'PARTIAL',
      } as any);

      const providerMock = {
        getMultiOrderStatus: vi.fn().mockResolvedValue({
          'ext-native-200': { status: 'Partial', remains: '400' },
        }),
      };
      vi.mocked(providerService.getWorkerProviderInstance).mockResolvedValue(providerMock as any);

      await syncProcessor({ name: 'sync-all' } as any);

      // Verify safeUpdateOrderStatus updated to PARTIAL
      expect(db.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'drip-ord-2' },
          data: expect.objectContaining({ status: 'PARTIAL', remains: 400 }),
        })
      );

      // Verify RefundPolicyService.processRefund was called with remains: 400
      expect(RefundPolicyService.processRefund).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'drip-ord-2',
          status: 'PARTIAL',
          remains: 400,
        }),
        expect.any(String),
        expect.anything()
      );
    });

    it('handles multi-task Drip-Feed when a sub-task is Partial and all tasks are terminal', async () => {
      vi.mocked(db.provider.findMany).mockResolvedValue([
        { id: 'prov-1', name: 'MultiProvider', apiUrl: 'https://api.test', apiKey: 'key1', errorCount5m: 0, avgResponseMs: 100 },
      ] as any);

      vi.mocked(db.order.findUnique).mockResolvedValue({
        id: 'drip-multi-1',
        status: 'IN_PROGRESS',
      } as any);

      vi.mocked(db.order.findMany)
        .mockResolvedValueOnce([{ id: 'drip-multi-1' }] as any)
        .mockResolvedValueOnce([
          {
            id: 'drip-multi-1',
            isDripFeed: true,
            dripExternalIds: ['ext-multi-1', 'ext-multi-2'],
            externalId: 'ext-multi-1',
            charge: BigInt(100000),
            quantity: 1000,
            remains: 1000,
            status: 'IN_PROGRESS',
            userId: 'u1',
            tenantId: 'smmplan',
            user: { email: 'client@test.pro' },
            service: { name: 'TG Subs Multi Drip' },
          },
        ] as any)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      vi.mocked(db.order.update).mockResolvedValue({
        id: 'drip-multi-1',
        status: 'PARTIAL',
      } as any);

      const providerMock = {
        getMultiOrderStatus: vi.fn().mockResolvedValue({
          'ext-multi-1': { status: 'Completed', remains: '0' },
          'ext-multi-2': { status: 'Partial', remains: '250' },
        }),
      };
      vi.mocked(providerService.getWorkerProviderInstance).mockResolvedValue(providerMock as any);

      await syncProcessor({ name: 'sync-all' } as any);

      expect(db.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'drip-multi-1' },
          data: expect.objectContaining({ status: 'PARTIAL', remains: 250 }),
        })
      );

      expect(RefundPolicyService.processRefund).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'drip-multi-1',
          status: 'PARTIAL',
          remains: 250,
        }),
        expect.any(String),
        expect.anything()
      );
    });
  });

  describe('2. Cleanup Processor: Smart Drip TTL Extension & Cascading Cancellation', () => {
    it('extends TTL for active Smart Drip orders in runInProgressTTLSweep', async () => {
      // Order created 80 hours ago (> standard 72h TTL) with 7-day active smartCampaign
      // Expected dynamic TTL: 7 * 24 + 48 = 216 hours
      const eightyHoursAgo = new Date(Date.now() - 80 * 60 * 60 * 1000);

      vi.mocked(db.order.findMany).mockResolvedValueOnce([
        {
          id: 'smart-ord-1',
          numericId: 1001,
          userId: 'u1',
          charge: BigInt(10000),
          quantity: 1000,
          remains: 1000,
          serviceId: 'srv-1',
          externalId: null,
          runs: null,
          interval: null,
          createdAt: eightyHoursAgo,
          tenantId: 'smmplan',
          service: { provider: null },
          smartCampaign: {
            id: 'camp-1',
            status: 'RUNNING',
            totalDays: 7,
          },
        },
      ] as any);

      await runInProgressTTLSweep();

      // Order should NOT be transitioned to ERROR or refunded because 80h < 216h
      expect(db.order.updateMany).not.toHaveBeenCalled();
    });

    it('cascades cancellation to SmartCampaign and SmartTasks when runInProgressTTLSweep terminates expired campaign order', async () => {
      const twoHundredFiftyHoursAgo = new Date(Date.now() - 250 * 60 * 60 * 1000);

      vi.mocked(db.order.findMany).mockResolvedValueOnce([
        {
          id: 'smart-ord-expired',
          numericId: 1002,
          userId: 'u1',
          charge: BigInt(10000),
          quantity: 1000,
          remains: 1000,
          serviceId: 'srv-1',
          externalId: null,
          runs: null,
          interval: null,
          createdAt: twoHundredFiftyHoursAgo,
          tenantId: 'smmplan',
          service: { provider: null },
          smartCampaign: {
            id: 'camp-expired',
            status: 'RUNNING',
            totalDays: 7,
          },
        },
      ] as any);

      vi.mocked(db.order.updateMany).mockResolvedValue({ count: 1 } as any);
      vi.mocked(db.smartCampaign.update).mockResolvedValue({ id: 'camp-expired' } as any);
      vi.mocked(db.smartTask.updateMany).mockResolvedValue({ count: 5 } as any);

      await runInProgressTTLSweep();

      expect(db.order.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'smart-ord-expired', status: 'IN_PROGRESS' },
          data: expect.objectContaining({ status: 'ERROR' }),
        })
      );

      expect(db.smartCampaign.update).toHaveBeenCalledWith({
        where: { id: 'camp-expired' },
        data: { status: 'ERROR' },
      });

      expect(db.smartTask.updateMany).toHaveBeenCalledWith({
        where: { campaignId: 'camp-expired', status: 'PLANNED' },
        data: { status: 'ERROR', error: 'Заказ завершен по таймауту TTL' },
      });
    });

    it('cascades cancellation to SmartCampaign and SmartTasks when AWAITING_PAYMENT zombie expires', async () => {
      let awaitingPaymentCalled = false;
      (db.order.findMany as any).mockImplementation(async (args: any) => {
        if (args?.where?.status === 'AWAITING_PAYMENT' && !awaitingPaymentCalled) {
          awaitingPaymentCalled = true;
          return [
            {
              id: 'zombie-smart-order',
              numericId: 2002,
              paymentId: 'pay-zombie',
              promoCodeId: null,
              tenantId: 'smmplan',
              user: { email: 'zombie@test.pro' },
              service: { name: 'Smart TG' },
            },
          ];
        }
        return [];
      });

      vi.mocked(db.order.updateMany).mockResolvedValue({ count: 1 } as any);
      vi.mocked(db.smartCampaign.findMany).mockResolvedValue([{ id: 'camp-zombie' }] as any);
      vi.mocked(db.smartCampaign.update).mockResolvedValue({ id: 'camp-zombie' } as any);
      vi.mocked(db.smartTask.updateMany).mockResolvedValue({ count: 5 } as any);

      await runCleanup();

      // Verify order was canceled
      expect(db.order.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'zombie-smart-order', status: 'AWAITING_PAYMENT' },
          data: expect.objectContaining({ status: 'CANCELED' }),
        })
      );

      // Verify SmartCampaign was updated to ERROR
      expect(db.smartCampaign.update).toHaveBeenCalledWith({
        where: { id: 'camp-zombie' },
        data: { status: 'ERROR' },
      });

      // Verify planned SmartTasks were updated to ERROR
      expect(db.smartTask.updateMany).toHaveBeenCalledWith({
        where: { campaignId: 'camp-zombie', status: 'PLANNED' },
        data: { status: 'ERROR', error: 'Заказ отменен по таймауту оплаты' },
      });
    });
  });

  describe('3. Order Processor: Zombie Execution Prevention', () => {
    it('does NOT activate SmartCampaign if parent order was canceled while waiting in queue', async () => {
      vi.mocked(db.order.findUnique).mockResolvedValueOnce({
        id: 'ord-canceled-smart',
        status: 'CANCELED', // Canceled before processing
        smartCampaign: {
          id: 'camp-do-not-revive',
          status: 'PLANNED',
        },
      } as any);

      await orderProcessor({
        id: 'job-1',
        data: { orderId: 'ord-canceled-smart' },
      } as any);

      // Must not update order to IN_PROGRESS or campaign to RUNNING
      expect(db.smartCampaign.update).not.toHaveBeenCalled();
      expect(db.order.update).not.toHaveBeenCalled();
    });
  });

  describe('4. Checkout Action: Mutual Exclusion Invariant', () => {
    it('forces isDripFeed: false, runs: null, interval: null when isSmartDrip is true', async () => {
      vi.mocked(featureFlagService.isEnabled).mockResolvedValue(true);
      vi.mocked(db.service.findUnique).mockResolvedValue({
        id: 'srv-smart-exclusive',
        name: 'Smart Exclusive Service',
        isActive: true,
        targetType: 'CHANNEL',
        providerId: 'p1',
        externalId: 'ext-srv-1',
        minQty: 10,
        maxQty: 10000,
        pricePerUnitRub: 0.1,
        smartConfig: {
          isEnabled: true,
          markup: 0.15,
          minChunk: 10,
          maxChunk: 50,
          isTestMode: false,
          useInviteBuffer: false,
        },
        category: { network: { name: 'Telegram' } },
      } as any);

      vi.mocked(db.order.create).mockResolvedValue({
        id: 'ord-smart-created',
        numericId: 3003,
      } as any);

      vi.mocked(db.smartCampaign.create).mockResolvedValue({
        id: 'camp-smart-created',
      } as any);

      vi.mocked(db.smartTask.createMany).mockResolvedValue({ count: 7 } as any);
      vi.mocked(db.serviceSmartConfig.findUnique).mockResolvedValue({
        id: 'sc-1',
        serviceId: 'srv-smart-exclusive',
        isEnabled: true,
        markup: 0.15,
        minChunk: 10,
        maxChunk: 50,
      } as any);

      (db.order.findUnique as any).mockResolvedValue(null);

      const result = await checkoutAction({
        serviceId: 'srv-smart-exclusive',
        link: 'https://t.me/testchannel',
        quantity: 100,
        email: 'customer@test.pro',
        gateway: 'balance',
        isSmartDrip: true,
        smartDripDays: 7,
        runs: 5,
        interval: 60,
      });

      expect(result.success).toBe(true);

      // Verify that Order was created with isDripFeed: false, runs: null, interval: null
      expect(db.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isDripFeed: false,
            runs: null,
            interval: null,
          }),
        })
      );
    });
  });

  describe('5. Smart Drip Service: Floor Invariant', () => {
    it('guarantees that all distributed tasks have quantity >= service.minQty', async () => {
      const mockTx = {
        service: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'srv-high-min',
            isActive: true,
            minQty: 50, // High minimum
            smartConfig: {
              isEnabled: true,
              minChunk: 10, // Attempted lower chunk in config
              maxChunk: 100,
              useInviteBuffer: true,
              isTestMode: false,
            },
          }),
        },
        smartCampaign: {
          create: vi.fn().mockResolvedValue({
            id: 'camp-floor-test',
          }),
        },
        smartTask: {
          create: vi.fn().mockImplementation((args) => Promise.resolve({ id: 'task-1', ...args.data })),
          createMany: vi.fn().mockResolvedValue({ count: 5 }),
        },
      } as any;

      await SmartDripService.createCampaign(mockTx, {
        userId: 'u1',
        serviceId: 'srv-high-min',
        link: 'https://t.me/testchannel',
        quantity: 250,
        days: 5,
      });

      expect(mockTx.smartTask.create).toHaveBeenCalled();
      const passedTasks = mockTx.smartTask.create.mock.calls.map((call: any) => call[0].data);

      // Assert every generated task has quantity >= service.minQty (50)
      for (const task of passedTasks) {
        expect(task.quantity).toBeGreaterThanOrEqual(50);
      }
    });
  });

  describe('6. Catalog Service: Boolean Flag Parsing', () => {
    it('correctly maps string "0" and "false" to false without Boolean("0") leak', () => {
      expect(parseProviderBoolean('0')).toBe(false);
      expect(parseProviderBoolean(0)).toBe(false);
      expect(parseProviderBoolean('false')).toBe(false);
      expect(parseProviderBoolean(false)).toBe(false);
      expect(parseProviderBoolean(null)).toBe(false);
      expect(parseProviderBoolean(undefined)).toBe(false);

      expect(parseProviderBoolean('1')).toBe(true);
      expect(parseProviderBoolean(1)).toBe(true);
      expect(parseProviderBoolean('true')).toBe(true);
      expect(parseProviderBoolean(true)).toBe(true);
    });

    it('correctly handles optional boolean parsing', () => {
      expect(parseProviderBooleanOptional(undefined)).toBe(undefined);
      expect(parseProviderBooleanOptional(null)).toBe(undefined);
      expect(parseProviderBooleanOptional('0')).toBe(false);
      expect(parseProviderBooleanOptional('1')).toBe(true);
    });
  });
});
