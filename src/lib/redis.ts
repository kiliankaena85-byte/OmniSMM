import { Redis } from 'ioredis';
import { redactSensitiveTokens } from '@/lib/logger/sensitive-data-filter';

const globalForRedis = global as unknown as { redis: Redis };

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Security check: Enforce authenticated/encrypted REDIS_URL in production (SEC-001)
if (process.env.NODE_ENV === 'production') {
  const isLocal = redisUrl.includes('localhost') || redisUrl.includes('127.0.0.1') || redisUrl.includes('smmplan_redis');
  
  if (!isLocal) {
    if (!redisUrl.startsWith('rediss://')) {
      console.warn('🚨 [SECURITY WARNING] Redis in production is not using TLS (rediss://). Transit encryption recommended!');
    }
    
    // REDIS_URL must explicitly contain authentication credentials (redis://:<PASSWORD>@...)
    if (!redisUrl.includes('@')) {
      throw new Error('FATAL [SECURITY]: SEC-001 Violation! REDIS_URL is running in production without explicit authentication in the connection string (e.g. redis://:<STRONG_PASSWORD>@host:port).');
    }
  }
}

export const redis =
  globalForRedis.redis ||
  new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    connectTimeout: 5000,
    lazyConnect: true,
    retryStrategy: (times) => {
      // Return null to explicitly stop retrying if Redis is totally unavailable.
      // We don't want to crash or freeze the app if Redis is down, we want to fallback gracefully.
      if (times > 3) return null;
      return Math.min(times * 50, 2000);
    },
  });

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;

// Fire and forget error handler to prevent unhandled rejection crashes
redis.on('error', (err) => {
  console.error('[REDIS] Connection error:', redactSensitiveTokens(err.message));
});
