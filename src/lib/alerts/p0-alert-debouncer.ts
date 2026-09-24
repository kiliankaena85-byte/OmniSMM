import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'P0AlertDebouncer' });

/**
 * Token Bucket State for resilient in-memory fallback.
 * Guarantees zero alert storms even during process CrashLoop and Redis blackouts.
 */
export interface IncidentTokenBucket {
  tokens: number;
  capacity: number;
  refillRatePerSec: number;
  lastRefillTime: number;
  silenceUntil: number;
  occurrences: number;
  suppressedInWindow: number;
  pendingOfflineDelta: number;
  lastAccessedAt: number;
}

// In-memory fallback stores
const inMemoryIncidentBuckets = new Map<string, IncidentTokenBucket>();
const inMemoryLocks = new Map<string, number>();
const inMemoryCounters = new Map<string, { count: number; expiresAt: number }>();

// Default fallback silence window: 5 minutes (300 seconds) per incident
export const DEFAULT_FALLBACK_SILENCE_WINDOW_MS = 5 * 60 * 1000;
const MAX_IN_MEMORY_ENTRIES = 5000;

function pruneInMemoryStores(): void {
  const needsPruning =
    inMemoryIncidentBuckets.size > MAX_IN_MEMORY_ENTRIES ||
    inMemoryLocks.size > MAX_IN_MEMORY_ENTRIES ||
    inMemoryCounters.size > MAX_IN_MEMORY_ENTRIES;

  if (!needsPruning) return;

  const now = Date.now();
  // 1. Evict expired entries strictly
  for (const [key, bucket] of inMemoryIncidentBuckets.entries()) {
    if (now > bucket.silenceUntil) {
      inMemoryIncidentBuckets.delete(key);
    }
  }
  for (const [key, expiresAt] of inMemoryLocks.entries()) {
    if (now > expiresAt) {
      inMemoryLocks.delete(key);
    }
  }
  for (const [key, counter] of inMemoryCounters.entries()) {
    if (now > counter.expiresAt) {
      inMemoryCounters.delete(key);
    }
  }

  // 2. Least-Recently-Used (LRU) eviction if stores still exceed capacity after expired cleanup
  if (inMemoryCounters.size > MAX_IN_MEMORY_ENTRIES) {
    const sorted = Array.from(inMemoryCounters.entries()).sort(
      (a, b) => a[1].expiresAt - b[1].expiresAt
    );
    const toRemove = sorted.slice(0, inMemoryCounters.size - MAX_IN_MEMORY_ENTRIES);
    for (const [key] of toRemove) {
      inMemoryCounters.delete(key);
    }
  }

  if (inMemoryIncidentBuckets.size > MAX_IN_MEMORY_ENTRIES) {
    const sorted = Array.from(inMemoryIncidentBuckets.entries()).sort((a, b) => {
      const aActive = a[1].silenceUntil > now ? 1 : 0;
      const bActive = b[1].silenceUntil > now ? 1 : 0;
      if (aActive !== bActive) return aActive - bActive; // Inactive buckets evicted first
      return (a[1].lastAccessedAt || a[1].lastRefillTime) - (b[1].lastAccessedAt || b[1].lastRefillTime);
    });
    const toRemove = sorted.slice(0, inMemoryIncidentBuckets.size - MAX_IN_MEMORY_ENTRIES);
    for (const [key] of toRemove) {
      inMemoryIncidentBuckets.delete(key);
    }
  }

  if (inMemoryLocks.size > MAX_IN_MEMORY_ENTRIES) {
    const sorted = Array.from(inMemoryLocks.entries()).sort(
      (a, b) => a[1] - b[1]
    );
    const toRemove = sorted.slice(0, inMemoryLocks.size - MAX_IN_MEMORY_ENTRIES);
    for (const [key] of toRemove) {
      inMemoryLocks.delete(key);
    }
  }
}

export class P0AlertDebouncer {
  private static readonly PREFIX = 'p0:debounce:';
  private static readonly THRESHOLD_PREFIX = 'p0:threshold:';
  private static forceInMemory: boolean = false;

  /** Enable or disable forced in-memory fallback (useful for testing and chaos drills) */
  public static setForceInMemoryFallback(force: boolean): void {
    this.forceInMemory = force;
  }

  /**
   * Attempts to acquire an alert lock.
   * Uses Redis if available; seamlessly falls back to local in-memory Token Bucket
   * with a mandatory 5-minute silence window to prevent alert storming.
   *
   * Returns TRUE if this alert should be delivered.
   * Returns FALSE if suppressed / debounced.
   */
  public static async shouldSendAlert(
    alertKey: string,
    cooldownSeconds: number = 3600 // Default 1 hour cooldown
  ): Promise<boolean> {
    const fullKey = `${this.PREFIX}${alertKey}`;
    const now = Date.now();

    const silenceDurationMs = Math.max(cooldownSeconds * 1000, DEFAULT_FALLBACK_SILENCE_WINDOW_MS);

    // Respect active in-memory silence window even if Redis reconnected / flapped
    const activeBucket = inMemoryIncidentBuckets.get(fullKey);
    if (activeBucket) {
      activeBucket.lastAccessedAt = now;
      if (now < activeBucket.silenceUntil) {
        activeBucket.occurrences += 1;
        activeBucket.suppressedInWindow += 1;
        return false;
      }
    }

    const isRedisReady = !this.forceInMemory && redis && typeof redis.set === 'function' && redis.status === 'ready';

    if (isRedisReady) {
      try {
        const acquired = await redis.set(fullKey, '1', 'EX', cooldownSeconds, 'NX');
        const shouldSend = acquired === 'OK';

        if (shouldSend) {
          inMemoryIncidentBuckets.set(fullKey, {
            tokens: 0,
            capacity: 1,
            refillRatePerSec: 1 / (silenceDurationMs / 1000),
            lastRefillTime: now,
            silenceUntil: now + silenceDurationMs,
            occurrences: 1,
            suppressedInWindow: 0,
            pendingOfflineDelta: 0,
            lastAccessedAt: now,
          });
          inMemoryLocks.set(fullKey, now + silenceDurationMs);
          pruneInMemoryStores();
          return true;
        } else {
          if (activeBucket) {
            activeBucket.occurrences += 1;
            activeBucket.suppressedInWindow += 1;
            activeBucket.lastAccessedAt = now;
          }
          return false;
        }
      } catch (redisErr) {
        log.warn('[P0AlertDebouncer] Redis unavailable, activating in-memory Token Bucket fallback', {
          error: (redisErr as Error)?.message,
        });
      }
    }

    // ── Local Token Bucket Fallback with Silence Window ────────────────────────

    let bucket = inMemoryIncidentBuckets.get(fullKey);
    if (!bucket) {
      bucket = {
        tokens: 0,
        capacity: 1,
        refillRatePerSec: 1 / (silenceDurationMs / 1000),
        lastRefillTime: now,
        silenceUntil: now + silenceDurationMs,
        occurrences: 1,
        suppressedInWindow: 0,
        pendingOfflineDelta: 0,
        lastAccessedAt: now,
      };
      inMemoryIncidentBuckets.set(fullKey, bucket);
      inMemoryLocks.set(fullKey, now + silenceDurationMs);
      pruneInMemoryStores();
      return true; // Allow first incident notification
    }

    // Existing incident bucket
    bucket.occurrences += 1;
    bucket.lastAccessedAt = now;

    // Active Silence Window check
    if (now < bucket.silenceUntil) {
      bucket.suppressedInWindow += 1;
      return false; // Suppressed by silence window
    }

    // Refill tokens based on elapsed time
    const elapsedSec = (now - bucket.lastRefillTime) / 1000;
    bucket.tokens = Math.min(bucket.capacity, bucket.tokens + elapsedSec * bucket.refillRatePerSec);
    bucket.lastRefillTime = now;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      bucket.silenceUntil = now + silenceDurationMs;
      bucket.suppressedInWindow = 0;
      inMemoryLocks.set(fullKey, now + silenceDurationMs);
      return true; // Token consumed, allow alert
    }

    bucket.suppressedInWindow += 1;
    return false;
  }

  /**
   * Sliding window threshold accumulator.
   * Useful for events that require accumulation (e.g. 20 auth errors in 5 min) before triggering P0.
   * Returns reached = TRUE when threshold limit is met/exceeded.
   */
  public static async checkThresholdTrigger(
    key: string,
    windowSeconds: number,
    thresholdLimit: number
  ): Promise<{ count: number; shouldTrigger: boolean }> {
    const fullKey = `${this.THRESHOLD_PREFIX}${key}`;

    const isRedisReady = !this.forceInMemory && redis && typeof redis.incr === 'function' && redis.status === 'ready';

    if (isRedisReady) {
      try {
        const currentCount = await redis.incr(fullKey);
        if (currentCount === 1) {
          await redis.expire(fullKey, windowSeconds);
        }
        return {
          count: currentCount,
          shouldTrigger: currentCount >= thresholdLimit,
        };
      } catch (redisErr) {
        log.warn('[P0AlertDebouncer] Redis unavailable, using in-memory threshold counter', {
          error: (redisErr as Error)?.message,
        });
      }
    }

    // In-memory fallback
    const now = Date.now();
    const entry = inMemoryCounters.get(fullKey);
    if (!entry || entry.expiresAt <= now) {
      inMemoryCounters.set(fullKey, { count: 1, expiresAt: now + windowSeconds * 1000 });
      pruneInMemoryStores();
      return { count: 1, shouldTrigger: 1 >= thresholdLimit };
    }

    entry.count += 1;
    return {
      count: entry.count,
      shouldTrigger: entry.count >= thresholdLimit,
    };
  }

  /**
   * Resets a debounce lock (useful when an issue is resolved and can alert again).
   */
  public static async resetLock(alertKey: string): Promise<void> {
    const fullKey = `${this.PREFIX}${alertKey}`;
    const countKey = `${this.THRESHOLD_PREFIX}occurrences:${alertKey}`;
    const isRedisReady = !this.forceInMemory && redis && typeof redis.del === 'function' && redis.status === 'ready';

    if (isRedisReady) {
      try {
        await Promise.allSettled([
          redis.del(fullKey),
          redis.del(countKey),
        ]);
      } catch (err) {
        log.warn('[P0AlertDebouncer] Redis error resetting lock', {
          error: (err as Error)?.message,
        });
      }
    }
    inMemoryIncidentBuckets.delete(fullKey);
    inMemoryLocks.delete(fullKey);
    inMemoryCounters.delete(countKey);
  }

  /**
   * Smart Deduplication with occurrence count tracker.
   * Returns shouldSend = true on first occurrence, plus the total occurrences accumulated.
   * Resilient to Redis failure: retains occurrence counts in local memory and merges offline deltas on reconnect.
   */
  public static async checkDeduplicatedAlert(
    alertKey: string,
    cooldownSeconds: number = 7200 // 2 hours default
  ): Promise<{ shouldSend: boolean; occurrences: number }> {
    const fullKey = `${this.PREFIX}${alertKey}`;
    const countKey = `${this.THRESHOLD_PREFIX}occurrences:${alertKey}`;
    let occurrences = 1;
    let redisAvailable = false;

    const activeBucket = inMemoryIncidentBuckets.get(fullKey);
    const isRedisReady = !this.forceInMemory && redis && typeof redis.incr === 'function' && redis.status === 'ready';

    if (isRedisReady) {
      try {
        const deltaToFlush = activeBucket && activeBucket.pendingOfflineDelta > 0 ? activeBucket.pendingOfflineDelta : 0;
        const incrementAmount = 1 + deltaToFlush;

        if (typeof redis.incrby === 'function' && incrementAmount > 1) {
          occurrences = await redis.incrby(countKey, incrementAmount);
        } else {
          occurrences = await redis.incr(countKey);
        }

        if (occurrences === incrementAmount) {
          await redis.expire(countKey, cooldownSeconds);
        }

        if (activeBucket) {
          activeBucket.pendingOfflineDelta = 0;
          activeBucket.occurrences = Math.max(activeBucket.occurrences, occurrences);
        }

        redisAvailable = true;
      } catch (redisErr) {
        log.warn('[P0AlertDebouncer] Redis error on occurrence increment', {
          error: (redisErr as Error)?.message,
        });
      }
    }

    const shouldSend = await this.shouldSendAlert(alertKey, cooldownSeconds);

    if (!redisAvailable) {
      const bucket = inMemoryIncidentBuckets.get(fullKey);
      if (bucket) {
        bucket.pendingOfflineDelta = (bucket.pendingOfflineDelta || 0) + 1;
        return {
          shouldSend,
          occurrences: bucket.occurrences,
        };
      }
      return { shouldSend, occurrences: 1 };
    }

    return { shouldSend, occurrences };
  }

  /**
   * Diagnostics: Reset all in-memory buckets and counters (for testing and clean restart).
   */
  public static resetAllInMemory(): void {
    inMemoryIncidentBuckets.clear();
    inMemoryLocks.clear();
    inMemoryCounters.clear();
  }

  /**
   * Diagnostics: Retrieve current in-memory bucket metrics.
   */
  public static getInMemoryMetrics(): { totalBuckets: number; totalSuppressed: number } {
    let totalSuppressed = 0;
    for (const b of inMemoryIncidentBuckets.values()) {
      totalSuppressed += b.suppressedInWindow;
    }
    return {
      totalBuckets: inMemoryIncidentBuckets.size,
      totalSuppressed,
    };
  }

  /**
   * Diagnostics: Inspect a specific bucket state.
   */
  public static getBucket(alertKey: string): IncidentTokenBucket | undefined {
    return inMemoryIncidentBuckets.get(`${this.PREFIX}${alertKey}`);
  }

  /**
   * Diagnostics: Inspect number of active in-memory counters.
   */
  public static getCountersSize(): number {
    return inMemoryCounters.size;
  }
}
