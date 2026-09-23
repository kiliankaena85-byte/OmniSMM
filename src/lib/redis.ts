import { Redis } from 'ioredis';
import { redactSensitiveTokens } from '@/lib/logger/sensitive-data-filter';

const globalForRedis = global as unknown as { redis: Redis };

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export interface RedisValidationResult {
  valid: boolean;
  warning?: string;
  error?: string;
}

/**
 * Validates Redis connection string security per PROD-SEC-2026 (SEC-001).
 * In production:
 * 1. Connection string MUST contain explicit authentication credentials (@ or password).
 * 2. If non-local host is used, TLS (rediss://) is recommended to prevent plaintext transit.
 */
export function validateRedisUrl(
  url: string,
  env: string = process.env.NODE_ENV || 'development',
  explicitPassword?: string
): RedisValidationResult {
  if (env === 'production') {
    // In production, ALL Redis connections must explicitly contain authentication credentials
    const hasAuth = url.includes('@') || Boolean(explicitPassword || process.env.REDIS_PASSWORD);
    if (!hasAuth) {
      return {
        valid: false,
        error: 'FATAL [SECURITY]: SEC-001 Violation! Redis is running in production without explicit authentication in the connection string (e.g. redis://:<STRONG_PASSWORD>@host:port or rediss://...).',
      };
    }

    const isLocal =
      url.includes('localhost') ||
      url.includes('127.0.0.1') ||
      url.includes('0.0.0.0') ||
      url.includes('@redis:') ||
      url.includes('//redis:') ||
      url.includes('smmplan_redis') ||
      url.includes('host.docker.internal');

    if (!isLocal && !url.startsWith('rediss://')) {
      return {
        valid: true,
        warning: '🚨 [SECURITY WARNING] Redis in production is not using TLS (rediss://). Transit encryption recommended!',
      };
    }
  }

  return { valid: true };
}

// Enforce SEC-001 Hardening at startup
const redisCheck = validateRedisUrl(redisUrl, process.env.NODE_ENV);
if (!redisCheck.valid) {
  throw new Error(redisCheck.error);
}
if (redisCheck.warning) {
  console.warn(redisCheck.warning);
}

/**
 * Calculates exponential reconnect backoff delay in ms.
 * In production, caps at 3000ms and NEVER returns null to prevent connection drop (P0-REDIS-RESILIENCE).
 */
export function calculateRedisRetryDelay(times: number, env: string = process.env.NODE_ENV || 'development'): number {
  if (env === 'test') {
    return Math.min(times * 50, 500);
  }
  return Math.min(times * 100, 3000);
}

export const redis =
  globalForRedis.redis ||
  new Redis(redisUrl, {
    maxRetriesPerRequest: process.env.NODE_ENV === 'test' ? null : 3,
    connectTimeout: 5000,
    lazyConnect: true,
    retryStrategy: (times) => calculateRedisRetryDelay(times, process.env.NODE_ENV),
  });

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;

// Fire and forget error handler to prevent unhandled rejection crashes
redis.on('error', (err) => {
  console.error('[REDIS] Connection error:', redactSensitiveTokens(err.message));
});
