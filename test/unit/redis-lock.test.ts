import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MutexManager } from '@/lib/redis-lock';
import { redis } from '@/lib/redis';

describe('🔒 SEC-LOCK: Redis Distributed Mutex', () => {
  const lockKey = 'test-resource';

  beforeEach(async () => {
    await redis.del(`lock:${lockKey}`);
  });

  it('SEC-LOCK-001: Acquires and releases lock with valid token', async () => {
    const token = await MutexManager.acquireLock(lockKey, 5000, 1000);
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');

    // Confirm key is in redis with our token
    const value = await redis.get(`lock:${lockKey}`);
    expect(value).toBe(token);

    // Release with valid token
    const released = await MutexManager.releaseLock(lockKey, token!);
    expect(released).toBe(true);

    // Key should now be gone
    const afterRelease = await redis.get(`lock:${lockKey}`);
    expect(afterRelease).toBeNull();
  });

  it('SEC-LOCK-002: Foreign process cannot release lock (prevents deleting new lock after TTL expiry)', async () => {
    // Process A acquires lock
    const tokenA = await MutexManager.acquireLock(lockKey, 5000, 1000);
    expect(tokenA).toBeDefined();

    // Process B attempts to release with a different token
    const foreignToken = 'random-token-of-process-b';
    const released = await MutexManager.releaseLock(lockKey, foreignToken);
    expect(released).toBe(false);

    // Key MUST still exist and belong to Process A
    const value = await redis.get(`lock:${lockKey}`);
    expect(value).toBe(tokenA);

    // Clean up
    await MutexManager.releaseLock(lockKey, tokenA!);
  });

  it('SEC-LOCK-003: withLock executes mutually exclusively and safely cleans up', async () => {
    let executionOrder: number[] = [];

    const p1 = MutexManager.withLock(lockKey, 5000, 2000, async () => {
      executionOrder.push(1);
      await new Promise((r) => setTimeout(r, 100));
      executionOrder.push(2);
      return 'result1';
    });

    const p2 = MutexManager.withLock(lockKey, 5000, 2000, async () => {
      executionOrder.push(3);
      return 'result2';
    });

    const [res1, res2] = await Promise.all([p1, p2]);
    expect(res1).toBe('result1');
    expect(res2).toBe('result2');
    expect(executionOrder).toEqual([1, 2, 3]);
  });
});
