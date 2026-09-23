import { describe, it, expect, vi, beforeEach } from 'vitest';
import orderProcessor from '../../src/workers/processors/order.processor';

const mocks = vi.hoisted(() => {
  const mockCreateOrder = vi.fn();
  const mockOrderDbUpdate = vi.fn();
  return { mockCreateOrder, mockOrderDbUpdate };
});

vi.mock('../../src/lib/db', () => ({
  db: { 
    order: { 
      findUnique: vi.fn(), 
      update: mocks.mockOrderDbUpdate,
      findMany: vi.fn().mockResolvedValue([])
    },
    service: {
      findUnique: vi.fn(),
      update: vi.fn()
    }
  },
}));

vi.mock('../../src/services/providers/provider.service', () => ({
  providerService: {
    getWorkerProviderInstance: vi.fn().mockResolvedValue({
      createOrder: mocks.mockCreateOrder,
    }),
  },
}));

vi.mock('../../src/services/financial/refund-policy.service', () => ({
  RefundPolicyService: {
    processRefund: vi.fn(),
  },
}));

vi.mock('../../src/lib/notifications', () => ({
  sendAdminAlert: vi.fn()
}));

function fakeJob(data: any, attemptsMade = 0, maxAttempts = 3) {
  return { data, attemptsMade, opts: { attempts: maxAttempts } } as any;
}

function mockOrder(overrides: any = {}) {
  return {
    id: 'ord-red-1', userId: 'usr-1', status: 'PENDING',
    link: 'https://t.me/test', quantity: 1000, charge: 5000,
    providerCost: 2000, remains: 1000, runs: null,
    isDripFeed: false, externalId: null, dripExternalIds: [],
    waitingUntil: null, customData: null,
    serviceId: 'srv-1',
    service: {
      name: 'Telegram Followers',
      externalId: '12345',
      provider: { id: 'p1', apiUrl: 'https://api.example.com', apiKey: 'key' },
    },
    ...overrides,
  };
}

describe('Red Team: BullMQ Retry & Partial Failure Safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should trigger Fail-Fast on explicit provider error (500) and terminate immediately', async () => {
    const { db } = await import('../../src/lib/db');
    const { orderService } = await import('../../src/services/core/order.service');
    
    // Mock failOrderTerminalFast
    vi.spyOn(orderService, 'failOrderTerminalFast').mockResolvedValue({} as any);

    const order = mockOrder();
    vi.mocked(db.order.findUnique).mockResolvedValue(order);

    mocks.mockCreateOrder.mockRejectedValueOnce(new Error('Provider HTTP Error 500'));

    await expect(orderProcessor(fakeJob({ orderId: 'ord-red-1' }))).rejects.toThrow('Fail-Fast: Provider HTTP Error 500');

    // Verify CreateOrder was called exactly once
    expect(mocks.mockCreateOrder).toHaveBeenCalledTimes(1);

    // Verify failOrderTerminalFast was called to cancel the order immediately
    expect(orderService.failOrderTerminalFast).toHaveBeenCalledWith('ord-red-1', 'Provider HTTP Error 500');
  });

  it('should trigger Ambiguous Timeout Protection on connection timeout', async () => {
    const { db } = await import('../../src/lib/db');
    
    const order = mockOrder();
    vi.mocked(db.order.findUnique).mockResolvedValue(order);

    mocks.mockCreateOrder.mockRejectedValueOnce(new Error('connect ETIMEDOUT'));

    await expect(orderProcessor(fakeJob({ orderId: 'ord-red-1' }))).rejects.toThrow('Ambiguous Timeout: connect ETIMEDOUT');

    // Verify CreateOrder was called exactly once
    expect(mocks.mockCreateOrder).toHaveBeenCalledTimes(1);

    // Verify DB update sets status to PENDING_CHECK
    expect(mocks.mockOrderDbUpdate).toHaveBeenCalledWith({
      where: { id: 'ord-red-1' },
      data: expect.objectContaining({
        status: 'PENDING_CHECK',
        error: expect.stringContaining('connect ETIMEDOUT')
      })
    });
  });


  it('should detect Partial Failure (Worker crash mid-transaction) using provider-side deduplication', async () => {
    const { db } = await import('../../src/lib/db');
    const order = mockOrder();
    vi.mocked(db.order.findUnique).mockResolvedValue(order);

    // Context: Worker successfully fired to provider, provider created order,
    // BUT worker crashed before db.order.update(). 
    // Now BullMQ retries the job.

    // On retry, we fire the identical payload including the idempotency key (ref: order.id)
    mocks.mockCreateOrder.mockImplementation(async (payload) => {
        // We simulate a provider that uses idempotent "ref" or "custom_id"
        // If it sees the same ref, it returns the existing order ID instead of creating a new one.
        if (payload.ref === order.id || payload.custom_id === order.id) {
            return { order: 'ext-already-exists-555' };
        }
        return { order: 'ext-new-111' };
    });

    await orderProcessor(fakeJob({ orderId: 'ord-red-1' }, 1, 3));

    // The worker should transparently recover the externalId without throwing
    expect(mocks.mockOrderDbUpdate).toHaveBeenCalledWith({
      where: { id: 'ord-red-1' },
      data: expect.objectContaining({
        externalId: 'ext-already-exists-555',
        status: 'IN_PROGRESS'
      })
    });
  });

  it('should propagate database write/transaction failure and not fail-fast or refund customer', async () => {
    const { db } = await import('../../src/lib/db');
    const { orderService } = await import('../../src/services/core/order.service');
    
    const order = mockOrder();
    vi.mocked(db.order.findUnique).mockResolvedValue(order);

    // Mock provider success
    mocks.mockCreateOrder.mockResolvedValueOnce({ order: 'ext-success-123' });

    // Mock db.order.update to throw an error (simulating db write/transaction failure during success path update)
    mocks.mockOrderDbUpdate.mockRejectedValueOnce(new Error('Prisma database connection error'));

    // Spy on failOrderTerminalFast to verify it is NOT called
    const failOrderTerminalFastSpy = vi.spyOn(orderService, 'failOrderTerminalFast');

    // Verify that the order processor propagates the exception, allowing BullMQ to retry the job
    await expect(orderProcessor(fakeJob({ orderId: 'ord-red-1' }))).rejects.toThrow('Prisma database connection error');

    // Ensure failOrderTerminalFast was NOT called (no instant terminal refund/fail)
    expect(failOrderTerminalFastSpy).not.toHaveBeenCalled();
    
    // Restore the spy
    failOrderTerminalFastSpy.mockRestore();
  });
});
