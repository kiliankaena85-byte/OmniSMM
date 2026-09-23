import { logger } from '@/lib/logger';

const log = logger.child({ component: 'FingerprintTokenBucketPool' });

export interface MinimalRedisSortedSetClient {
  zremrangebyscore: (key: string, min: number | string, max: number | string) => Promise<number>;
  zcard: (key: string) => Promise<number>;
  zadd: (key: string, score: number, member: string) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<number>;
}

async function getRedisInstance(): Promise<MinimalRedisSortedSetClient | null> {
  try {
    const { redis } = await import('@/lib/redis');
    return redis as unknown as MinimalRedisSortedSetClient;
  } catch (err) {
    log.warn('Redis unavailable for token bucket pool', { error: String(err) });
    return null;
  }
}

export interface PoolRateLimitResult {
  isAllowed: boolean;
  remaining: number;
}

/**
 * Checks and increments request counter for a specific browser fingerprint across rotating proxy IPs.
 * Employs a sliding window algorithm in Redis (Sorted Set).
 */
export async function checkFingerprintPoolLimit(
  fingerprint: string,
  tenantId: string = 'smmplan',
  maxRequests: number = 120,
  windowSeconds: number = 60,
  customRedis?: MinimalRedisSortedSetClient
): Promise<PoolRateLimitResult> {
  const redis = customRedis || (await getRedisInstance());
  if (!redis) {
    return { isAllowed: true, remaining: maxRequests }; // Fail-Open invariant
  }

  const key = `ddos:fp:${tenantId}:${fingerprint}`;
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;

  try {
    // 1. Remove expired entries older than sliding window start
    await redis.zremrangebyscore(key, 0, windowStart);

    // 2. Count current entries in sliding window
    const currentCount = await redis.zcard(key);

    if (currentCount >= maxRequests) {
      return { isAllowed: false, remaining: 0 };
    }

    // 3. Add current request unique member
    const uniqueMember = `${now}-${Math.random().toString(36).substring(2, 9)}`;
    await redis.zadd(key, now, uniqueMember);
    await redis.expire(key, windowSeconds * 2);

    return {
      isAllowed: true,
      remaining: Math.max(0, maxRequests - (currentCount + 1)),
    };
  } catch (err) {
    log.warn('Failed to evaluate fingerprint sliding window in Redis', { error: String(err), fingerprint });
    return { isAllowed: true, remaining: maxRequests }; // Fail-Open on Redis errors
  }
}
