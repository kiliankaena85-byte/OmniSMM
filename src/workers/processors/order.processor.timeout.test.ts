import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import orderProcessor from './order.processor';
import { db } from '../../lib/db';
import { Job, UnrecoverableError } from 'bullmq';

// Mock DB and Notification
vi.mock('../../lib/db', () => ({
  db: {
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(async (cb) => cb({
      order: {
        findUnique: vi.fn().mockResolvedValue({ id: 'order_123', status: 'PENDING', charge: 0, user: { email: 'test@test.com' } }),
        update: vi.fn(),
      },
      ledgerEntry: {
        findFirst: vi.fn().mockResolvedValue(null)
      },
      commission: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn()
      },
      user: {
        update: vi.fn()
      }
    }))
  }
}));

vi.mock('@/lib/notifications', () => ({
  sendAdminAlert: vi.fn(),
  sendAdminAlertSync: vi.fn()
}));

vi.mock('@/services/providers/quarantine.service', () => ({
  QuarantineService: {
    evaluateTriggerA: vi.fn()
  }
}));

describe('Worker Order Processor: Timeout & Failure Simulation', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('throws a transient error and does NOT trigger quarantine when a timeout occurs', async () => {
    // 1. Setup mock order
    const mockOrder = {
      id: 'order_123',
      status: 'PENDING',
      quantity: 1000,
      link: 'https://test.com',
      service: {
        name: 'test service',
        provider: {
          apiUrl: 'https://api.timeout.com/v2',
          apiKey: 'secret_key'
        }
      }
    };

    vi.mocked(db.order.findUnique).mockResolvedValue(mockOrder as any);

    // 2. Mock global.fetch to simulate a network timeout (fetch rejection)
    global.fetch = vi.fn().mockRejectedValue(new Error('Provider Request Timeout: fetch failed'));

    // 3. Setup mock BullMQ job
    const mockJob = {
      data: { orderId: 'order_123' },
      attemptsMade: 3, // Final attempt
      opts: { attempts: 3 }
    } as unknown as Job<any>;

    // 4. Run processor and assert it throws the original error
    await expect(orderProcessor(mockJob)).rejects.toThrow('Provider Request Timeout');

    // Assert order status is updated to PENDING_CHECK in database
    expect(db.order.update).toHaveBeenCalledWith({
      where: { id: 'order_123' },
      data: {
        status: 'PENDING_CHECK',
        error: 'Сетевой таймаут при отправке: Provider Request Timeout: fetch failed'
      }
    });

    // 5. Assert Quarantine was NOT triggered
    const { QuarantineService } = await import('@/services/providers/quarantine.service');
    expect(QuarantineService.evaluateTriggerA).not.toHaveBeenCalled();
  });

  it('throws UnrecoverableError and triggers quarantine on fatal API response (e.g. Invalid link)', async () => {
    // 1. Setup mock order
    const mockOrder = {
      id: 'order_123',
      status: 'PENDING',
      quantity: 1000,
      link: 'bad_link',
      service: {
        name: 'test service',
        provider: {
          apiUrl: 'https://api.fatal.com/v2',
          apiKey: 'secret_key'
        }
      }
    };

    vi.mocked(db.order.findUnique).mockResolvedValue(mockOrder as any);

    // 2. Mock global.fetch to return a fatal API error
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ error: 'Incorrect Link format' }),
      text: async () => JSON.stringify({ error: 'Incorrect Link format' })
    } as any);

    // 3. Setup mock BullMQ job
    const mockJob = {
      data: { orderId: 'order_123' },
      attemptsMade: 3, // Final attempt
      opts: { attempts: 3 }
    } as unknown as Job<any>;

    // 4. Run processor and assert it throws UnrecoverableError
    await expect(orderProcessor(mockJob)).rejects.toThrowError(UnrecoverableError);

    // 5. Assert Quarantine WAS triggered
    const { QuarantineService } = await import('@/services/providers/quarantine.service');
    expect(QuarantineService.evaluateTriggerA).toHaveBeenCalledWith(undefined, 'Incorrect Link format');
  });
});
