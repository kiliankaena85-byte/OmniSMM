/**
 * (c) 2026 SMMplan.
 * Distributed Sliding Window Rate Limiter with Atomic Redis Lua Script (Anti-Brute-Force Standard).
 */

import { redis } from '@/lib/redis';
import crypto from 'crypto';

export interface RateLimitConfig {
  limit: number;         // Maximum allowed requests in window
  windowSeconds: number; // Duration of window in seconds
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
}

const LUA_SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local unique_id = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local current = redis.call('ZCARD', key)

if current < limit then
  redis.call('ZADD', key, now, unique_id)
  local ttl = math.ceil(window / 1000)
  if ttl < 1 then ttl = 1 end
  redis.call('EXPIRE', key, ttl)
  return current + 1
else
  return 0
end
`;

// In-memory fallback sliding window for test / offline environments
const inMemoryStore = new Map<string, number[]>();

export async function checkRateLimit(
  identifier: string,
  prefix: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const { limit, windowSeconds } = config;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const clearBefore = now - windowMs;
  const key = `ratelimit:${prefix}:${identifier}`;
  const uniqueId = `${now}-${crypto.randomBytes(4).toString('hex')}`;

  try {
    if (redis && typeof redis.eval === 'function' && (redis.status === 'ready' || redis.status === 'connecting')) {
      const currentCount = (await redis.eval(
        LUA_SLIDING_WINDOW_SCRIPT,
        1,
        key,
        limit,
        windowMs,
        now,
        uniqueId
      )) as number;

      const isAllowed = currentCount > 0 && currentCount <= limit;
      return {
        success: isAllowed,
        limit,
        remaining: isAllowed ? Math.max(0, limit - currentCount) : 0,
        resetSeconds: windowSeconds,
      };
    }
  } catch (err) {
    console.warn('[RateLimiter] Redis Lua evaluation failed, falling back to memory store:', err);
  }

  // Fallback: In-memory sliding window
  const timestamps = (inMemoryStore.get(key) || []).filter((ts) => ts > clearBefore);
  const isAllowed = timestamps.length < limit;

  if (isAllowed) {
    timestamps.push(now);
    inMemoryStore.set(key, timestamps);
  }

  const currentCount = timestamps.length;
  const remaining = Math.max(0, limit - currentCount);

  return {
    success: isAllowed,
    limit,
    remaining,
    resetSeconds: windowSeconds,
  };
}

export const RATE_LIMIT_PRESETS = {
  AUTH: { limit: 5, windowSeconds: 60 },
  ORDER: { limit: 10, windowSeconds: 60 },
  PASSWORD_RESET: { limit: 3, windowSeconds: 900 },
  PUBLIC_API: { limit: 120, windowSeconds: 60 },
} as const;
