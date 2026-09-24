import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Package 4: BullMQ Reliability, Repeatable Jobs Hygiene & Distributed Locking
 * Verifies:
 * - DEF-014: Repeatable Job Cleanup Options (removeOnComplete, removeOnFail)
 * - R2-P0-01: Atomic SET NX Lock in OrderPreflightGuard
 * - DEF-015 / R2-P1-03: Unique Timestamped JobId in Orphan Recovery
 * - Queue Manager Mock Interface Completeness
 */
describe('Package 4: BullMQ Queue Reliability & Redis Hygiene', () => {

  describe('DEF-014: Repeatable Jobs Retention Policies', () => {
    const queueManagerPath = path.resolve(process.cwd(), 'src/lib/queue-manager.ts');

    it('queue-manager.ts defines REPEATABLE_JOB_CLEANUP_OPTS and attaches it to repeating jobs', () => {
      const content = fs.readFileSync(queueManagerPath, 'utf-8');

      expect(content.includes('const REPEATABLE_JOB_CLEANUP_OPTS')).toBe(true);
      expect(content.includes('removeOnComplete: { count: 100, age: 3600 }')).toBe(true);
      expect(content.includes('removeOnFail: { count: 100, age: 86400 }')).toBe(true);
      expect(content.includes('...REPEATABLE_JOB_CLEANUP_OPTS')).toBe(true);
    });

    it('Mock proxy targetObj implements BullMQ count getters', () => {
      const content = fs.readFileSync(queueManagerPath, 'utf-8');

      expect(content.includes('getWaitingCount: () => Promise.resolve(0)')).toBe(true);
      expect(content.includes('getActiveCount: () => Promise.resolve(0)')).toBe(true);
      expect(content.includes('getFailedCount: () => Promise.resolve(0)')).toBe(true);
      expect(content.includes('getCompletedCount: () => Promise.resolve(0)')).toBe(true);
      expect(content.includes('getDelayedCount: () => Promise.resolve(0)')).toBe(true);
    });
  });

  describe('R2-P0-01: Atomic Distributed Lock in OrderPreflightGuard', () => {
    const preflightPath = path.resolve(process.cwd(), 'src/workers/processors/order/order-preflight-guard.ts');

    it('order-preflight-guard.ts acquires atomic SET NX lock before dispatching order', () => {
      const content = fs.readFileSync(preflightPath, 'utf-8');

      expect(content.includes("const dispatchLockKey = `order:dispatch_lock:${order.id}`;")).toBe(true);
      expect(content.includes("await connection.set(dispatchLockKey, '1', 'EX', 120, 'NX')")).toBe(true);
      expect(content.includes('if (!acquiredLock)')).toBe(true);
    });
  });

  describe('DEF-015 / R2-P1-03: Deadlock-Free Orphan Recovery JobIds', () => {
    const cleanupProcessorPath = path.resolve(process.cwd(), 'src/workers/processors/cleanup.processor.ts');
    const syncProcessorPath = path.resolve(process.cwd(), 'src/workers/processors/sync.processor.ts');

    it('cleanup.processor.ts uses timestamped jobId for orphan re-enqueuing', () => {
      const content = fs.readFileSync(cleanupProcessorPath, 'utf-8');
      expect(content.includes('const dispatchJobId = `dispatch-${orphan.id}-${Date.now()}`;')).toBe(true);
    });

    it('sync.processor.ts uses timestamped jobId for orphan re-enqueuing', () => {
      const content = fs.readFileSync(syncProcessorPath, 'utf-8');
      expect(content.includes('jobId: `dispatch-${orphan.id}-${Date.now()}`')).toBe(true);
    });
  });

});
