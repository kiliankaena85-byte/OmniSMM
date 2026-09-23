import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'P0AlertDebouncer' });

// In-memory fallback if Redis is offline/unreachable
const inMemoryLocks = new Map<string, number>();
const inMemoryCounters = new Map<string, { count: number; expiresAt: number }>();

export class P0AlertDebouncer {
  private static readonly PREFIX = 'p0:debounce:';
  private static readonly THRESHOLD_PREFIX = 'p0:threshold:';

  /**
   * Attempts to acquire an alert lock.
   * Returns TRUE if this is the first alert in the window (lock acquired -> ALLOW SEND).
   * Returns FALSE if an alert was already sent recently (lock exists -> DEBOUNCE / SUPPRESS).
   */
  public static async shouldSendAlert(
    alertKey: string,
    cooldownSeconds: number = 3600 // Default 1 hour cooldown
  ): Promise<boolean> {
    const fullKey = `${this.PREFIX}${alertKey}`;

    try {
      if (redis.status === 'ready' || redis.status === 'connecting') {
        const acquired = await redis.set(fullKey, '1', 'EX', cooldownSeconds, 'NX');
        return acquired === 'OK';
      }
    } catch (redisErr) {
      log.warn('[P0AlertDebouncer] Redis unavailable, using in-memory debounce lock', { error: redisErr });
    }

    // In-memory fallback
    const now = Date.now();
    const existingExpiry = inMemoryLocks.get(fullKey);
    if (existingExpiry && existingExpiry > now) {
      return false; // Suppress
    }

    inMemoryLocks.set(fullKey, now + cooldownSeconds * 1000);
    return true; // Allow
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

    try {
      if (redis.status === 'ready' || redis.status === 'connecting') {
        const currentCount = await redis.incr(fullKey);
        if (currentCount === 1) {
          await redis.expire(fullKey, windowSeconds);
        }
        return {
          count: currentCount,
          shouldTrigger: currentCount >= thresholdLimit,
        };
      }
    } catch (redisErr) {
      log.warn('[P0AlertDebouncer] Redis unavailable, using in-memory threshold counter', { error: redisErr });
    }

    // In-memory fallback
    const now = Date.now();
    const entry = inMemoryCounters.get(fullKey);
    if (!entry || entry.expiresAt <= now) {
      inMemoryCounters.set(fullKey, { count: 1, expiresAt: now + windowSeconds * 1000 });
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
    try {
      if (redis.status === 'ready' || redis.status === 'connecting') {
        await redis.del(fullKey);
      }
    } catch { /* ignore */ }
    inMemoryLocks.delete(fullKey);
  }

  /**
   * Smart Deduplication with occurrence count tracker.
   * Returns shouldSend = true on first occurrence, plus the total occurrences accumulated.
   */
  public static async checkDeduplicatedAlert(
    alertKey: string,
    cooldownSeconds: number = 7200 // 2 hours default
  ): Promise<{ shouldSend: boolean; occurrences: number }> {
    const countKey = `${this.THRESHOLD_PREFIX}occurrences:${alertKey}`;
    let occurrences = 1;

    try {
      if (redis.status === 'ready' || redis.status === 'connecting') {
        occurrences = await redis.incr(countKey);
        if (occurrences === 1) {
          await redis.expire(countKey, cooldownSeconds);
        }
      }
    } catch (redisErr) {
      log.warn('[P0AlertDebouncer] Redis error on occurrence increment', { error: redisErr });
    }

    const shouldSend = await this.shouldSendAlert(alertKey, cooldownSeconds);
    return { shouldSend, occurrences };
  }
}
