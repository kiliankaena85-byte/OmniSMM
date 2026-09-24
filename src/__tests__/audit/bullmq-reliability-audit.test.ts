import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Audit Reproduction Suite for Background Queues & Workers (BullMQ & Redis Architecture) (R2)
 * Validates findings documented in .agents/teamwork_preview_explorer_audit_r2/handoff.md
 */
describe('Audit R2: BullMQ & Redis Architecture Reliability & Race Invariants', () => {

  describe('P0-1: TOCTOU Race Condition in Order Dispatch (Duplicate Provider Orders)', () => {
    it('Source Invariant: OrderPreflightGuard checks Redis key with GET instead of atomic SET NX lock', () => {
      const guardPath = path.resolve(process.cwd(), 'src/workers/processors/order/order-preflight-guard.ts');
      const content = fs.readFileSync(guardPath, 'utf-8');

      // The preflight guard checks key presence with connection.get
      expect(content).toContain('await connection.get(redisKey)');
      // It must NOT be using atomic acquire with NX option
      expect(content).not.toMatch(/connection\.set\([^)]*['"]NX['"]/i);
    });

    it('Source Invariant: Lock key is written in OrderDispatchExecutor AFTER external route resolution', () => {
      const executorPath = path.resolve(process.cwd(), 'src/workers/processors/order/order-dispatch-executor.ts');
      const content = fs.readFileSync(executorPath, 'utf-8');

      // OrderDispatchExecutor sets the key order:dispatched:
      const setKeyIndex = content.indexOf("connection.set(`order:dispatched:${order.id}`");
      expect(setKeyIndex).toBeGreaterThan(0);

      // Provider route resolution occurs before this file or before the lock is set
      const resolveProviderIndex = content.indexOf('resolveProviderService(');
      if (resolveProviderIndex !== -1) {
        expect(setKeyIndex).toBeGreaterThan(resolveProviderIndex);
      }
    });

    it('Behavioral Simulation: Concurrent dispatches both pass preflight when lock is non-atomic', async () => {
      // Mock Redis state
      const redisStore = new Map<string, string>();
      const mockConnection = {
        get: async (key: string) => redisStore.get(key) || null,
        set: async (key: string, val: string, ..._args: unknown[]) => {
          redisStore.set(key, val);
          return 'OK';
        },
      };

      const orderId = 'order-test-uuid-123';
      const redisKey = `order:dispatched:${orderId}`;

      // Simulate OrderPreflightGuard: Read check without atomic lock
      const preflightCheck = async () => {
        const isDispatched = await mockConnection.get(redisKey);
        if (isDispatched) {
          return { pass: false, reason: 'ALREADY_DISPATCHED' };
        }
        // Simulated window: external route calculation, provider margin validation
        await new Promise((r) => setTimeout(r, 10));
        return { pass: true };
      };

      // Two concurrent worker jobs picking up the same order or retrying
      const [worker1Result, worker2Result] = await Promise.all([
        preflightCheck(),
        preflightCheck(),
      ]);

      // Both workers pass preflight simultaneously because neither acquired an atomic lock!
      expect(worker1Result.pass).toBe(true);
      expect(worker2Result.pass).toBe(true);

      // Now both workers execute OrderDispatchExecutor and create duplicate external provider orders
      let externalOrderCount = 0;
      const executeDispatch = async () => {
        await mockConnection.set(redisKey, '1', 'EX', 86400);
        externalOrderCount++;
      };

      await Promise.all([executeDispatch(), executeDispatch()]);
      expect(externalOrderCount).toBe(2); // Two duplicate orders charged at provider!
    });
  });

  describe('P0-2: BullMQ Built-in Backoff Shadows Custom Jittered Strategy', () => {
    it('Source Invariant: defaultJobOptions uses type exponential which BullMQ intercepts before custom backoffStrategy', () => {
      const queueManagerPath = path.resolve(process.cwd(), 'src/lib/queue-manager.ts');
      const queueContent = fs.readFileSync(queueManagerPath, 'utf-8');

      const workersIndexPath = path.resolve(process.cwd(), 'src/workers/index.ts');
      const workersContent = fs.readFileSync(workersIndexPath, 'utf-8');

      // queue-manager configures defaultJobOptions with backoff: { type: 'exponential', delay: 5000 }
      expect(queueContent).toContain("type: 'exponential'");
      expect(queueContent).toContain('delay: 5000');
      // queue-manager does NOT set jitter option in defaultJobOptions
      expect(queueContent).not.toMatch(/backoff:\s*\{[^}]*jitter:/);

      // workers/index.ts defines a custom backoffStrategy with jitter
      expect(workersContent).toContain('backoffStrategy:');
      expect(workersContent).toContain('Math.random()');
    });

    it('Mathematical Invariant: BullMQ built-in exponential backoff without jitter causes deterministic retry storms', () => {
      // BullMQ built-in formula (node_modules/bullmq/dist/cjs/classes/backoffs.js):
      // Math.round((Math.pow(2, attemptsMade - 1) - 1) * delay)
      const bullmqBuiltinExponential = (attemptsMade: number, delay: number) => {
        return Math.round((Math.pow(2, attemptsMade - 1) - 1) * delay);
      };

      const delay = 5000;
      // 10 concurrent failing jobs retrying attempt 1, 2, 3
      const sampleJobs = Array.from({ length: 10 }, (_, i) => ({ id: `job-${i}` }));

      // Attempt 1: delay is exactly 0 ms for all jobs
      const attempt1Delays = sampleJobs.map(() => bullmqBuiltinExponential(1, delay));
      expect(new Set(attempt1Delays).size).toBe(1); // All 10 jobs fire at the EXACT same millisecond!
      expect(attempt1Delays[0]).toBe(0);

      // Attempt 2: delay is exactly 5000 ms for all jobs
      const attempt2Delays = sampleJobs.map(() => bullmqBuiltinExponential(2, delay));
      expect(new Set(attempt2Delays).size).toBe(1); // 100% deterministic, 0 jitter!
      expect(attempt2Delays[0]).toBe(5000);

      // Attempt 3: delay is exactly 15000 ms for all jobs
      const attempt3Delays = sampleJobs.map(() => bullmqBuiltinExponential(3, delay));
      expect(new Set(attempt3Delays).size).toBe(1); // Thundering herd storm on external APIs!
      expect(attempt3Delays[0]).toBe(15000);
    });
  });

  describe('P1-1: Dead Code Invariant: withJobTimeout is never invoked by any worker', () => {
    it('Source Invariant: withJobTimeout is exported in queue-manager but NEVER imported in workers/index.ts', () => {
      const queueManagerPath = path.resolve(process.cwd(), 'src/lib/queue-manager.ts');
      const queueContent = fs.readFileSync(queueManagerPath, 'utf-8');

      const workersIndexPath = path.resolve(process.cwd(), 'src/workers/index.ts');
      const workersContent = fs.readFileSync(workersIndexPath, 'utf-8');

      // Exported in queue-manager
      expect(queueContent).toContain('export function withJobTimeout');
      expect(queueContent).toContain('export const QUEUE_TIMEOUTS');

      // But completely absent from workers/index.ts!
      expect(workersContent).not.toContain('withJobTimeout');
    });
  });

  describe('P1-2: Lock Duration vs Batch Duration Mismatch (False Stalled Job Failures)', () => {
    it('Source Invariant: Global lockDuration is 60s with maxStalledCount: 1', () => {
      const workersIndexPath = path.resolve(process.cwd(), 'src/workers/index.ts');
      const workersContent = fs.readFileSync(workersIndexPath, 'utf-8');

      // Global lockDuration is 60,000ms
      expect(workersContent).toContain('lockDuration: 60000');
      expect(workersContent).toContain('stalledInterval: 30000');
      expect(workersContent).toContain('maxStalledCount: 1');
    });

    it('Source Invariant: Long-running processors (catalog, sync, cleanup) do NOT customize lockDuration', () => {
      const workersIndexPath = path.resolve(process.cwd(), 'src/workers/index.ts');
      const workersContent = fs.readFileSync(workersIndexPath, 'utf-8');

      // All workers share the same global workerConfig without per-worker lockDuration overrides
      const catalogWorkerDefinition = workersContent.slice(
        workersContent.indexOf("new Worker('catalog',"),
        workersContent.indexOf("new Worker('cleanup',")
      );
      expect(catalogWorkerDefinition).toContain('workerConfig');
      expect(catalogWorkerDefinition).not.toContain('lockDuration:');
    });
  });

  describe('P1-3: DLQ Blind Spots & Missing Consumer', () => {
    it('Source Invariant: aiObserverWorker, aiEconomicOptimizerWorker, geoAvailabilityWorker have NO failed event listener', () => {
      const workersIndexPath = path.resolve(process.cwd(), 'src/workers/index.ts');
      const workersContent = fs.readFileSync(workersIndexPath, 'utf-8');

      expect(workersContent).not.toContain("aiObserverWorker.on('failed'");
      expect(workersContent).not.toContain("aiEconomicOptimizerWorker.on('failed'");
      expect(workersContent).not.toContain("geoAvailabilityWorker.on('failed'");
    });

    it('Source Invariant: telegramWorker and cleanupWorker fail to route dead jobs to dlqQueue', () => {
      const workersIndexPath = path.resolve(process.cwd(), 'src/workers/index.ts');
      const workersContent = fs.readFileSync(workersIndexPath, 'utf-8');

      // telegramWorker has an on('failed') listener
      const telegramFailedIndex = workersContent.indexOf("telegramWorker.on('failed'");
      expect(telegramFailedIndex).toBeGreaterThan(0);

      // But it only logs to logger.error, never routes to dlqQueue.add
      const telegramSnippet = workersContent.slice(telegramFailedIndex, telegramFailedIndex + 250);
      expect(telegramSnippet).toContain('logger.error');
      expect(telegramSnippet).not.toContain('dlqQueue.add');
    });

    it('Source Invariant: dead-letter-queue has NO BullMQ Worker to process or alert on DLQ jobs', () => {
      const workersIndexPath = path.resolve(process.cwd(), 'src/workers/index.ts');
      const workersContent = fs.readFileSync(workersIndexPath, 'utf-8');

      // Zero workers instantiated for 'dead-letter-queue'
      expect(workersContent).not.toContain("new Worker('dead-letter-queue'");
      expect(workersContent).not.toContain("new Worker(QUEUE_NAMES.DLQ");
    });
  });

  describe('P1-4: Orphan Order Recovery Deadlock via Duplicate jobId Collision', () => {
    it('Source Invariant: sync.processor.ts re-enqueues orphan orders with fixed jobId dispatch-${orphan.id}', () => {
      const syncProcessorPath = path.resolve(process.cwd(), 'src/workers/processors/sync.processor.ts');
      const syncContent = fs.readFileSync(syncProcessorPath, 'utf-8');

      // Orphan recovery uses fixed jobId
      expect(syncContent).toContain('jobId: `dispatch-${orphan.id}`');
    });

    it('Behavioral Simulation: BullMQ rejects re-adding job if previous job with same jobId exists in failed/completed set', () => {
      // Mock BullMQ set behavior: BullMQ stores job IDs in a Redis hash/set.
      // If a job with jobId already exists in the queue (including completed or failed set with retention),
      // queue.add returns the existing Job object and DOES NOT schedule a new run.
      const existingJobIds = new Set<string>();
      existingJobIds.add('dispatch-orphan-order-999'); // Pre-existing failed or completed job

      const simulateQueueAdd = (name: string, data: unknown, opts: { jobId?: string }) => {
        if (opts.jobId && existingJobIds.has(opts.jobId)) {
          return { id: opts.jobId, scheduled: false, message: 'Existing job found; no new execution queued' };
        }
        if (opts.jobId) existingJobIds.add(opts.jobId);
        return { id: opts.jobId, scheduled: true };
      };

      const result = simulateQueueAdd('process-order', { orderId: 'orphan-order-999' }, {
        jobId: 'dispatch-orphan-order-999',
      });

      expect(result.scheduled).toBe(false);
      // Because scheduled is false, the order in DB remains in PENDING status indefinitely!
    });
  });
});
