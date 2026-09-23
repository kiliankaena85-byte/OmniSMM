import { redis } from '@/lib/redis';

export interface RateLimitConfig {
  maxRequestsPerSecond: number;
  burstCapacity?: number;
}

export class AdaptiveRateLimiterService {
  private static readonly DEFAULT_RPS = 5;
  private static readonly KEY_PREFIX = 'rate:limit:provider:';
  private static readonly inMemoryBuckets = new Map<string, { tokens: number; lastRefill: number }>();

  /**
   * Acquire execution token before dispatching HTTP request to provider.
   * If limit is saturated, waits with exponential jitter.
   */
  public static async acquireToken(
    providerId: string,
    customRps?: number,
    maxWaitMs: number = 5000
  ): Promise<boolean> {
    const rps = customRps || this.DEFAULT_RPS;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const allowed = await this.tryConsumeToken(providerId, rps);
      if (allowed) {
        return true;
      }

      // Jitter backoff between 100ms and 250ms
      const delayMs = Math.floor(100 + Math.random() * 150);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    // Timed out waiting for token
    console.warn(`[AdaptiveRateLimiter] Rate limit timeout for provider ${providerId} after ${maxWaitMs}ms`);
    return false;
  }

  /**
   * Try to consume a token from Redis (or in-memory store).
   */
  private static async tryConsumeToken(providerId: string, rps: number): Promise<boolean> {
    const now = Date.now();

    if (redis) {
      try {
        const key = `${this.KEY_PREFIX}${providerId}`;
        const currentCount = await redis.incr(key);
        if (currentCount === 1) {
          await redis.expire(key, 1); // 1-second sliding window
        }

        if (currentCount <= rps) {
          return true;
        }
        return false;
      } catch (err) {
        console.warn(`[AdaptiveRateLimiter] Redis error, using in-memory bucket fallback:`, err);
      }
    }

    // In-memory token bucket fallback
    let bucket = this.inMemoryBuckets.get(providerId);
    if (!bucket) {
      bucket = { tokens: rps, lastRefill: now };
      this.inMemoryBuckets.set(providerId, bucket);
    }

    const elapsedSec = (now - bucket.lastRefill) / 1000;
    if (elapsedSec >= 1) {
      bucket.tokens = rps;
      bucket.lastRefill = now;
    }

    if (bucket.tokens > 0) {
      bucket.tokens -= 1;
      return true;
    }

    return false;
  }

  /**
   * Reset rate limit state for tests.
   */
  public static resetLocalState(): void {
    this.inMemoryBuckets.clear();
  }
}
