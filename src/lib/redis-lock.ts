import { redis } from './redis';
import crypto from 'crypto';

const RELEASE_LOCK_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
`;

const EXTEND_LOCK_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("pexpire", KEYS[1], ARGV[2])
else
    return 0
end
`;

export class MutexManager {
  /**
   * Acquires a lock in Redis with a unique owner token.
   * Returns the owner token if acquired, null if timed out.
   */
  static async acquireLock(key: string, ttlMs: number, maxWaitMs: number = 5000): Promise<string | null> {
    const lockKey = key.startsWith('lock:') ? key : `lock:${key}`;
    const token = crypto.randomUUID();
    const start = Date.now();
    const waitTime = 50; // ms between retries

    while (Date.now() - start < maxWaitMs) {
      // PX sets expiry in Ms. NX ensures we only set if it does not exist
      const acquired = await redis.set(lockKey, token, 'PX', ttlMs, 'NX');
      
      if (acquired === 'OK') {
        return token;
      }
      
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
    
    return null;
  }

  /**
   * Extends the TTL of an active lock if and only if the caller owns the lock token.
   */
  static async extendLock(key: string, token: string, extraTtlMs: number): Promise<boolean> {
    if (!token) return false;
    const lockKey = key.startsWith('lock:') ? key : `lock:${key}`;
    try {
      const result = await redis.eval(EXTEND_LOCK_LUA, 1, lockKey, token, extraTtlMs);
      return result === 1;
    } catch {
      return false;
    }
  }

  /**
   * Releases a lock in Redis safely via Lua script compare-and-delete.
   * Prevents removing a lock owned by another process after TTL expiry.
   */
  static async releaseLock(key: string, token: string): Promise<boolean> {
    if (!token) return false;
    const lockKey = key.startsWith('lock:') ? key : `lock:${key}`;
    try {
      const result = await redis.eval(RELEASE_LOCK_LUA, 1, lockKey, token);
      return result === 1;
    } catch {
      return false;
    }
  }

  /**
   * Acquires a distributed lock with a monotonic fencing token to prevent split-brain execution.
   */
  static async acquireLockWithFencing(
    key: string,
    ttlMs: number,
    maxWaitMs: number = 5000
  ): Promise<{ token: string; fencingToken: number } | null> {
    const token = await this.acquireLock(key, ttlMs, maxWaitMs);
    if (!token) return null;

    const lockKey = key.startsWith('lock:') ? key : `lock:${key}`;
    const fencingKey = `${lockKey}:fence`;
    const fencingToken = await redis.incr(fencingKey);
    return { token, fencingToken };
  }

  /**
   * Wrapper execute function that ensures mutual exclusion on a specific key.
   * Periodically extends the lock TTL in the background while the task executes.
   */
  static async withLock<T>(key: string, ttlMs: number, maxWaitMs: number, fn: () => Promise<T>): Promise<T> {
    const token = await this.acquireLock(key, ttlMs, maxWaitMs);
    if (!token) {
      throw new Error(`Failed to acquire lock for key: ${key}`);
    }

    const intervalMs = Math.max(100, Math.floor(ttlMs / 3));
    const heartbeatTimer = setInterval(async () => {
      try {
        await this.extendLock(key, token, ttlMs);
      } catch {
        // Ignore background extension error
      }
    }, intervalMs);

    try {
      return await fn();
    } finally {
      clearInterval(heartbeatTimer);
      await this.releaseLock(key, token);
    }
  }

  /**
   * Executes a callback within a lock guaranteed with a monotonic fencing token.
   * Periodically extends the lock TTL in the background while the task executes.
   */
  static async withFencingLock<T>(
    key: string,
    ttlMs: number,
    maxWaitMs: number,
    fn: (fencingToken: number) => Promise<T>
  ): Promise<T> {
    const handle = await this.acquireLockWithFencing(key, ttlMs, maxWaitMs);
    if (!handle) {
      throw new Error(`Failed to acquire fencing lock for key: ${key}`);
    }

    const { token, fencingToken } = handle;
    const intervalMs = Math.max(100, Math.floor(ttlMs / 3));
    const heartbeatTimer = setInterval(async () => {
      try {
        await this.extendLock(key, token, ttlMs);
      } catch {
        // Ignore background extension error
      }
    }, intervalMs);

    try {
      return await fn(fencingToken);
    } finally {
      clearInterval(heartbeatTimer);
      await this.releaseLock(key, token);
    }
  }
}

