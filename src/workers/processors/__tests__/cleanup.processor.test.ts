import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runCleanup, runOrphanSweep, runInProgressTTLSweep } from '../cleanup.processor';
import { db } from '../../../lib/db';

vi.mock('../../../lib/db', () => ({
  db: {
    authToken: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }), findMany: vi.fn().mockResolvedValue([]) },
    analyticsEvent: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    rateLimit: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    loginLog: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    providerProxyLog: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    securityEvent: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    payment: { findMany: vi.fn().mockResolvedValue([]) },
    order: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn().mockResolvedValue({ count: 0 }), update: vi.fn(), findUnique: vi.fn() },
    ledgerEntry: { findFirst: vi.fn().mockResolvedValue(null) },
    $transaction: vi.fn(async (cb: any) => cb(db))
  }
}));

vi.mock('@/services/users/loyalty.service', () => ({
  LoyaltyService: {
    reverseCommission: vi.fn(),
    confirmCommission: vi.fn()
  }
}));

vi.mock('@/lib/notifications', () => ({
  sendAdminAlert: vi.fn()
}));

vi.mock('@/lib/smtp', () => ({
  sendOrderCanceledMail: vi.fn().mockResolvedValue(true)
}));

vi.mock('@/services/financial/wallet-ops', () => ({
  WalletOps: {
    refund: vi.fn()
  }
}));

vi.mock('@/utils/refund', () => ({
  calculatePartialRefund: vi.fn().mockReturnValue(50)
}));

vi.mock('../../../lib/queue-manager', () => ({
  ordersQueue: {
    getJob: vi.fn(),
    add: vi.fn()
  }
}));

vi.mock('@/services/core/order.service', () => ({
  orderService: {
    failOrderTerminal: vi.fn()
  }
}));

describe('Cleanup Processor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Zombie cancellation (orders stuck in AWAITING_PAYMENT)', async () => {
    vi.mocked(db.order.findMany)
      .mockResolvedValueOnce([]) // stalePendingCheck
      .mockResolvedValueOnce([{
        id: 'z1',
        numericId: 1,
        paymentId: 'pay1',
        user: { email: 'test@test.com' },
        service: { name: 'S1' }
      }] as any) // zombies
      .mockResolvedValueOnce([]);
    
    vi.mocked(db.order.updateMany).mockResolvedValue({ count: 1 } as any);

    await runCleanup();

    expect(db.order.updateMany).toHaveBeenCalledWith({
      where: { id: 'z1', status: 'AWAITING_PAYMENT' },
      data: {
        status: 'CANCELED',
        error: expect.any(String)
      }
    });
  });

  it('Orphan sweep (orders stuck in PENDING_CHECK / PENDING)', async () => {
    vi.mocked(db.order.findMany).mockResolvedValueOnce([{
      id: 'o1',
      numericId: 1,
      userId: 'u1',
      charge: 100,
      createdAt: new Date(),
      status: 'PENDING'
    }] as any);

    const { ordersQueue } = await import('../../../lib/queue-manager');
    vi.mocked(ordersQueue.getJob).mockResolvedValue(undefined as any);

    await runOrphanSweep();

    expect(ordersQueue.add).toHaveBeenCalledWith('order-dispatch', { orderId: 'o1' }, { jobId: 'dispatch-o1' });
  });

  it('IN_PROGRESS TTL partial refund', async () => {
    vi.mocked(db.order.findMany).mockResolvedValueOnce([{
      id: 'i1',
      numericId: 1,
      userId: 'u1',
      charge: 1000,
      quantity: 100,
      remains: 50,
      serviceId: 's1',
      service: {}
    }] as any).mockResolvedValueOnce([]);
    
    vi.mocked(db.order.updateMany).mockResolvedValue({ count: 1 } as any);

    await runInProgressTTLSweep();

    expect(db.order.updateMany).toHaveBeenCalledWith({
      where: { id: 'i1', status: 'IN_PROGRESS' },
      data: {
        status: 'PARTIAL',
        remains: 50,
        error: "Заказ завершён по таймауту (72ч IN_PROGRESS). Выполнено 50 из 100. Невыполненный остаток возвращён на баланс.",
        updatedAt: expect.any(Date)
      }
    });

    const { WalletOps } = await import('@/services/financial/wallet-ops');
    expect(WalletOps.refund).toHaveBeenCalled();
  });
});
