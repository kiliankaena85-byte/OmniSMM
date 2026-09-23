import { describe, it, expect, vi, beforeEach } from 'vitest';
import syncProcessor from '../sync.processor';
import { db } from '../../../lib/db';
import { orderService } from '../../../services/core/order.service';

vi.mock('../../../lib/db', () => ({
  db: {
    provider: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
    order: {
      findMany: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(async (cb: any) => cb(db)),
  }
}));

vi.mock('@/lib/notifications', () => ({
  sendAdminAlert: vi.fn().mockResolvedValue(true)
}));

vi.mock('../smart-feedback-loop.processor', () => ({
  SmartFeedbackLoopProcessor: {
    runSmartFeedbackLoopTick: vi.fn().mockResolvedValue(undefined)
  }
}));

vi.mock('@/services/providers/balance-autoflush.service', () => ({
  BalanceAutoFlushService: {
    sweepAllProviders: vi.fn().mockResolvedValue([]),
    isBalanceRelatedError: vi.fn().mockReturnValue(true),
  }
}));

vi.mock('@/services/providers/quarantine.service', () => ({
  QuarantineService: {
    restoreExpiredQuarantines: vi.fn().mockResolvedValue(true),
    evaluateTriggerC: vi.fn().mockResolvedValue(true),
  }
}));

vi.mock('../../../services/core/order.service', () => ({
  orderService: {
    failOrderTerminal: vi.fn().mockResolvedValue(true)
  }
}));

describe('WRK-02: Delayed Order Lifecycle in Sync Processor', () => {
  const mockJob = { name: 'sync-tick' } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.provider.findMany).mockResolvedValue([{
      id: 'prov-1',
      isActive: true,
      apiUrl: 'http://test.local',
      apiKey: 'key-1'
    }] as any);
  });

  it('keeps IN_PROGRESS orders active without mutating status to PENDING_CHECK or canceling', async () => {
    const delayedOrder = {
      id: 'order-zs-1',
      numericId: 2001,
      serviceId: 'svc-1',
      quantity: 100,
      remains: 100,
      createdAt: new Date(Date.now() - 50 * 60 * 60 * 1000), // 50h ago
    };

    // 1st findMany (provider active orders) -> empty
    // 2nd findMany (orphans) -> empty
    // 3rd findMany (slow orders monitor) -> returns delayedOrder
    vi.mocked(db.order.findMany)
      .mockResolvedValueOnce([]) // provider active orders
      .mockResolvedValueOnce([]) // orphanOrders
      .mockResolvedValueOnce([delayedOrder] as any); // slowOrders

    await syncProcessor(mockJob);

    // Assert: status is NOT mutated to PENDING_CHECK / CANCELED
    expect(db.order.update).not.toHaveBeenCalled();
    expect(orderService.failOrderTerminal).not.toHaveBeenCalled();
  });

  it('does NOT escalate or cancel orders when progress is made', async () => {
    const inProgressOrderWithProgress = {
      id: 'order-progress-1',
      numericId: 2002,
      serviceId: 'svc-1',
      quantity: 100,
      remains: 40,
      createdAt: new Date(Date.now() - 50 * 60 * 60 * 1000),
    };

    vi.mocked(db.order.findMany)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([inProgressOrderWithProgress] as any);

    await syncProcessor(mockJob);

    expect(db.order.update).not.toHaveBeenCalled();
  });
});
