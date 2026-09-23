import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'YooKassaStatusChecker' });

/**
 * Rate limit tracking key prefix.
 * We use a sliding window counter in Redis to enforce max 30 req/min to YooKassa API.
 */
const RATE_LIMIT_KEY = 'yookassa:api:rate_limit';
const RATE_LIMIT_WINDOW_SEC = 60;
const RATE_LIMIT_MAX_REQUESTS = 30;

const STATUS_CACHE_PREFIX = 'pay:status:';
const STATUS_CACHE_TTL_SEC = 5;

export interface YooKassaPaymentStatus {
  id: string;
  status: 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled';
  amount: { value: string; currency: string };
  paid: boolean;
  capturedAt?: string;
  createdAt?: string;
  description?: string;
  cancellationDetails?: { party: string; reason: string };
}

export class YooKassaStatusChecker {
  /**
   * Checks the live status of a payment directly from YooKassa API v3.
   * 
   * Implements:
   * - Redis cache (TTL 5 sec) to prevent duplicate calls for the same paymentId
   * - Global rate limiter (max 30 req/min) to avoid 429 bans
   * - AbortSignal timeout (10 sec) to prevent hanging connections
   * 
   * @returns YooKassaPaymentStatus or null if rate-limited/cached-miss/error
   */
  public static async checkPaymentStatus(
    gatewayId: string,
    shopId: string,
    secretKey: string
  ): Promise<YooKassaPaymentStatus | null> {
    // 1. Check Redis cache first (prevents duplicate calls within 5 sec)
    const cacheKey = `${STATUS_CACHE_PREFIX}${gatewayId}`;
    try {
      if (redis.status === 'ready' || redis.status === 'connecting') {
        const cached = await redis.get(cacheKey);
        if (cached) {
          log.debug(`[YooKassa] Cache hit for ${gatewayId}`);
          return JSON.parse(cached) as YooKassaPaymentStatus;
        }
      }
    } catch {
      // Redis unavailable — proceed without cache
    }

    // 2. Check global rate limit (max 30 requests per minute)
    const isAllowed = await this.checkRateLimit();
    if (!isAllowed) {
      log.warn(`[YooKassa] Rate limit reached (${RATE_LIMIT_MAX_REQUESTS}/min). Skipping API call for ${gatewayId}`);
      return null;
    }

    // 3. Make the actual API call to YooKassa
    const authHeader = 'Basic ' + Buffer.from(`${shopId}:${secretKey}`).toString('base64');

    try {
      const response = await fetch(`https://api.yookassa.ru/v3/payments/${gatewayId}`, {
        method: 'GET',
        headers: { 'Authorization': authHeader },
        signal: AbortSignal.timeout(10000),
      });

      if (response.status === 429) {
        log.warn(`[YooKassa] Received 429 Too Many Requests. Backing off for ${gatewayId}`);
        return null;
      }

      if (!response.ok) {
        log.error(`[YooKassa] API error ${response.status} for ${gatewayId}`);
        return null;
      }

      const data = (await response.json()) as YooKassaPaymentStatus;

      // 4. Cache the result in Redis (TTL 5 sec)
      try {
        if (redis.status === 'ready' || redis.status === 'connecting') {
          await redis.set(cacheKey, JSON.stringify(data), 'EX', STATUS_CACHE_TTL_SEC);
        }
      } catch {
        // Cache write failure is non-critical
      }

      log.info(`[YooKassa] Active Pull for ${gatewayId}: status=${data.status}, paid=${data.paid}`);
      return data;
    } catch (err) {
      const errName = err instanceof Error ? err.name : 'UnknownError';
      if (errName === 'AbortError' || errName === 'TimeoutError') {
        log.warn(`[YooKassa] Timeout checking status for ${gatewayId}`);
      } else {
        log.error(`[YooKassa] Failed to check status for ${gatewayId}`, { cause: err });
      }
      return null;
    }
  }

  /**
   * Sliding window rate limiter using Redis INCR + EXPIRE.
   * Returns true if the request is allowed, false if rate limit exceeded.
   */
  private static async checkRateLimit(): Promise<boolean> {
    try {
      if (redis.status === 'ready' || redis.status === 'connecting') {
        const count = await redis.incr(RATE_LIMIT_KEY);
        if (count === 1) {
          await redis.expire(RATE_LIMIT_KEY, RATE_LIMIT_WINDOW_SEC);
        }
        return count <= RATE_LIMIT_MAX_REQUESTS;
      }
    } catch {
      // If Redis is down, allow the request (fail-open for reads is acceptable)
    }
    return true;
  }
}
