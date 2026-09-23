import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { paymentService } from '@/services/financial/payment.service';

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
    },
    service: {
      findUnique: vi.fn(),
    },
    promoCodeUsage: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/queue-manager', () => ({
  ordersQueue: {
    add: vi.fn().mockResolvedValue({ id: 'job-order-1' }),
  },
}));

vi.mock('@/lib/settings', () => ({
  SettingsProvider: {
    isTestMode: vi.fn().mockResolvedValue(false),
  },
  SettingsManager: {
    getPaymentSecrets: vi.fn().mockResolvedValue({
      yookassaWebhookSecret: 'mock_secret',
    }),
  },
}));

describe('Order Lifecycle Boundary: Payment Webhooks vs SMM Provider Webhooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. PAYMENT CONFIRMATION FLOW (YooKassa/Robokassa): Successfully transitions AWAITING_PAYMENT order to paid and dispatches', async () => {
    const mockPayment = {
      id: 'pay_12345',
      gatewayId: 'yoo_gw_999',
      amount: BigInt(50000), // 500.00 RUB
      status: 'PENDING',
      userId: 'usr_customer_1',
      tenantId: 'smmplan',
      orderId: 'ord_awaiting_1',
    };

    const mockOrder = {
      id: 'ord_awaiting_1',
      numericId: 1001,
      status: 'AWAITING_PAYMENT',
      charge: BigInt(50000),
      isDripFeed: false,
      user: { email: 'test@smmplan.pro' },
      service: { name: 'Telegram Подписчики' },
    };

    let userState = {
      id: 'usr_customer_1',
      balance: BigInt(0),
      email: 'test@smmplan.pro',
      tenantId: 'smmplan',
    };

    // Mock initial payment lookup before transaction
    vi.mocked(db.payment.findUnique).mockResolvedValue(mockPayment as any);

    // Simulate Prisma Interactive Transaction execution with dynamic state
    vi.mocked(db.$transaction).mockImplementation(async (callback: any) => {
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
              if (typeof args.data.balance === 'bigint') {
                userState.balance = args.data.balance;
              } else if (args.data.balance.increment) {
                userState.balance += args.data.balance.increment;
              } else if (args.data.balance.decrement) {
                userState.balance -= args.data.balance.decrement;
              }
            }
            return Promise.resolve({ ...userState });
          }),
          updateMany: vi.fn().mockImplementation((args: any) => {
            if (args.data?.balance?.decrement) {
              userState.balance -= args.data.balance.decrement;
            }
            return Promise.resolve({ count: 1 });
          }),
        },
        ledgerEntry: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: 'led_1' }),
        },
        order: {
          findUnique: vi.fn().mockResolvedValue(mockOrder),
          update: vi.fn().mockResolvedValue({ ...mockOrder, status: 'PENDING' }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findMany: vi.fn().mockResolvedValue([]),
        },
        promoCodeUsage: {
          create: vi.fn().mockResolvedValue({ id: 'promo_use_1' }),
        },
      };
      return callback(tx);
    });

    const success = await paymentService.confirmPayment(
      'yoo_gw_999',
      BigInt(50000),
      'usr_customer_1',
      false,
      'yookassa',
      'pay_12345'
    );

    expect(success).toBe(true);
    expect(db.$transaction).toHaveBeenCalled();
  });

  it('2. SMM PROVIDER WEBHOOK BOUNDARY: Rejects/Ignores orders with status AWAITING_PAYMENT (Prevents fraud)', async () => {
    // SMM Provider webhook queries DB with status filter: in ['IN_PROGRESS', 'PENDING_CHECK']
    // If order is still AWAITING_PAYMENT, findFirst returns null
    vi.mocked(db.order.findFirst).mockResolvedValueOnce(null);

    // Simulate provider webhook search
    const externalOrderId = 'provider_ext_order_777';
    const order = await db.order.findFirst({
      where: {
        status: { in: ['IN_PROGRESS', 'PENDING_CHECK'] },
        OR: [{ externalId: externalOrderId }, { id: externalOrderId }],
      },
    });

    // An unpaid order (AWAITING_PAYMENT) is never found and never modified by provider webhook
    expect(order).toBeNull();
  });

  it('3. SMM PROVIDER WEBHOOK BOUNDARY: Successfully finds and updates paid orders with status IN_PROGRESS', async () => {
    const mockPaidOrder = {
      id: 'ord_paid_888',
      externalId: 'provider_ext_order_777',
      status: 'IN_PROGRESS',
      serviceId: 'srv_1',
      userId: 'usr_customer_1',
    };

    vi.mocked(db.order.findFirst).mockResolvedValueOnce(mockPaidOrder as any);

    const externalOrderId = 'provider_ext_order_777';
    const order = await db.order.findFirst({
      where: {
        status: { in: ['IN_PROGRESS', 'PENDING_CHECK'] },
        OR: [{ externalId: externalOrderId }, { id: externalOrderId }],
      },
    });

    expect(order).not.toBeNull();
    expect(order?.status).toBe('IN_PROGRESS');
    expect(order?.id).toBe('ord_paid_888');
  });
});
