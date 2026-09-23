import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'RateLimiter' });

// In-memory fallback map for environments without Redis or test environments
const memoryCache = new Map<string, { count: number; resetAt: number }>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  total: number;
  resetSeconds: number;
}

/**
 * Generic Rate Limiting service with Redis and in-memory fallback.
 * @param key unique limiter key (e.g. `ml:ip:1.2.3.4`)
 * @param max maximum allowed hits in the time window
 * @param windowSec time window in seconds
 */
export async function rateLimit(
  key: string,
  max: number,
  windowSec: number
): Promise<RateLimitResult> {
  const k = `rl:${key}`;

  try {
    if (redis && typeof redis.incr === 'function' && typeof redis.ttl === 'function') {
      const count = await redis.incr(k);
      if (count === 1 && typeof redis.expire === 'function') {
        await redis.expire(k, windowSec);
      }
      const ttl = await redis.ttl(k);
      const remaining = Math.max(0, max - count);
      return {
        ok: count <= max,
        remaining,
        total: count,
        resetSeconds: ttl > 0 ? ttl : windowSec,
      };
    }
  } catch (err) {
    log.warn('Redis rate limit error, using memory fallback', { error: err instanceof Error ? err.message : String(err) });
  }

  // Memory fallback
  const now = Date.now();
  const existing = memoryCache.get(k);

  if (!existing || existing.resetAt <= now) {
    memoryCache.set(k, { count: 1, resetAt: now + windowSec * 1000 });
    return {
      ok: 1 <= max,
      remaining: Math.max(0, max - 1),
      total: 1,
      resetSeconds: windowSec,
    };
  }

  existing.count += 1;
  const remaining = Math.max(0, max - existing.count);
  const resetSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));

  return {
    ok: existing.count <= max,
    remaining,
    total: existing.count,
    resetSeconds,
  };
}

/**
 * Helper to reset rate limit key (useful for tests)
 */
export async function resetRateLimit(key: string): Promise<void> {
  const k = `rl:${key}`;
  memoryCache.delete(k);
  try {
    if (redis && typeof redis.del === 'function') {
      await redis.del(k);
    }
  } catch {
    // ignore
  }
}
