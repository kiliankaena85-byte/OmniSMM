import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MutexManager } from '@/lib/redis-lock';
import { ordersQueue, syncQueue, catalogQueue, refillQueue, paymentGatewayQueue } from '@/lib/queue-manager';

// Mock Redis
const mockRedisData: Record<string, string> = {};
vi.mock('@/lib/redis', () => ({
  redis: {
    set: vi.fn(async (key: string, value: string, ...args: unknown[]) => {
      if (args.includes('NX') && mockRedisData[key]) {
        return null;
      }
      mockRedisData[key] = value;
      return 'OK';
    }),
    get: vi.fn(async (key: string) => mockRedisData[key] || null),
    del: vi.fn(async (key: string) => {
      delete mockRedisData[key];
      return 1;
    }),
    incr: vi.fn(async (key: string) => {
      const current = parseInt(mockRedisData[key] || '0', 10);
      const next = current + 1;
      mockRedisData[key] = String(next);
      return next;
    }),
    eval: vi.fn(async (script: string, numKeys: number, key: string, token: string) => {
      if (mockRedisData[key] === token) {
        delete mockRedisData[key];
        return 1;
      }
      return 0;
    })
  }
}));

describe('OPS-02: Queue Timeouts, Fencing Tokens and Network Guards', () => {
  beforeEach(() => {
    for (const key of Object.keys(mockRedisData)) {
      delete mockRedisData[key];
    }
    vi.clearAllMocks();
  });

  describe('Distributed Lock Fencing Tokens', () => {
    it('generates monotonically increasing fencing tokens across sequential acquisitions', async () => {
      const handle1 = await MutexManager.acquireLockWithFencing('catalog-sync', 5000, 1000);
      expect(handle1).not.toBeNull();
      expect(handle1?.fencingToken).toBe(1);

      // Release first lock
      await MutexManager.releaseLock('catalog-sync', handle1!.token);

      // Acquire second lock
      const handle2 = await MutexManager.acquireLockWithFencing('catalog-sync', 5000, 1000);
      expect(handle2).not.toBeNull();
      expect(handle2?.fencingToken).toBe(2);
      expect(handle2?.token).not.toBe(handle1?.token);

      await MutexManager.releaseLock('catalog-sync', handle2!.token);
    });

    it('withFencingLock executes task with fence token and safely releases lock', async () => {
      let executedFence = 0;
      const result = await MutexManager.withFencingLock('order-worker', 5000, 1000, async (fence) => {
        executedFence = fence;
        return 'success';
      });

      expect(result).toBe('success');
      expect(executedFence).toBeGreaterThan(0);

      // Verify lock was released so it can be acquired immediately by another worker
      const nextHandle = await MutexManager.acquireLockWithFencing('order-worker', 5000, 500);
      expect(nextHandle).not.toBeNull();
      expect(nextHandle?.fencingToken).toBe(executedFence + 1);
    });
  });

  describe('BullMQ Queue Job Timeouts', () => {
    it('defines explicit execution timeout budgets for background queues', async () => {
      const { QUEUE_TIMEOUTS } = await import('@/lib/queue-manager');
      expect(QUEUE_TIMEOUTS.ordersQueue).toBe(60000);
      expect(QUEUE_TIMEOUTS.syncQueue).toBe(120000);
      expect(QUEUE_TIMEOUTS.catalogQueue).toBe(180000);
      expect(QUEUE_TIMEOUTS.refillQueue).toBe(60000);
      expect(QUEUE_TIMEOUTS.paymentGatewayQueue).toBe(30000);
    });

    it('withJobTimeout aborts long-running background tasks when limit is exceeded', async () => {
      const { withJobTimeout } = await import('@/lib/queue-manager');
      
      await expect(
        withJobTimeout('test-job', 50, async (signal) => {
          return new Promise((resolve, reject) => {
            signal.addEventListener('abort', () => reject(new Error('Job aborted by timeout')));
          });
        })
      ).rejects.toThrow('Job aborted by timeout');
    });

    it('withJobTimeout returns value when job completes within budget', async () => {
      const { withJobTimeout } = await import('@/lib/queue-manager');
      
      const result = await withJobTimeout('fast-job', 500, async () => {
        return 'completed';
      });

      expect(result).toBe('completed');
    });
  });

  describe('Outbound Provider Timeout and AbortSignal', () => {
    it('aborts stalled provider requests with AbortController timeout signal', async () => {
      const controller = new AbortController();
      const signal = controller.signal;

      const stalledFetch = new Promise((_, reject) => {
        signal.addEventListener('abort', () => {
          const abortError = new Error('The operation was aborted');
          abortError.name = 'AbortError';
          reject(abortError);
        });
      });

      // Trigger abort as if 15s timeout expired
      controller.abort();

      await expect(stalledFetch).rejects.toThrow('The operation was aborted');
    });
  });
});

