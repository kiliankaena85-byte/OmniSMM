/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Multi-Tier High Performance Redis Cache Service.
 */

import { redis } from '@/lib/redis';

// Safe BigInt JSON Serializer / Deserializer
const replacer = (_key: string, value: unknown) => {
  if (typeof value === 'bigint') {
    return { __type: 'BigInt', val: value.toString() };
  }
  return value;
};

const reviver = (_key: string, value: unknown) => {
  if (value && typeof value === 'object' && (value as { __type?: string }).__type === 'BigInt') {
    return BigInt((value as { val: string }).val);
  }
  return value;
};

// In-memory L1 cache map for ultra-fast local hits (<1ms)
const localL1Cache = new Map<string, { value: unknown; expiresAt: number }>();

export class RedisCacheService {
  /**
   * Retrieves an item from L1 memory or L2 Redis.
   */
  static async get<T>(key: string): Promise<T | null> {
    const now = Date.now();

    // 1. L1 Memory Cache Hit
    const l1 = localL1Cache.get(key);
    if (l1) {
      if (l1.expiresAt > now) {
        return l1.value as T;
      }
      localL1Cache.delete(key);
    }

    // 2. L2 Redis Hit
    try {
      if (redis && (redis.status === 'ready' || redis.status === 'connecting')) {
        const raw = await redis.get(key);
        if (raw) {
          const parsed = JSON.parse(raw, reviver) as T;
          // Store in L1 for next 10 seconds
          localL1Cache.set(key, { value: parsed, expiresAt: now + 10000 });
          return parsed;
        }
      }
    } catch (err) {
      console.warn(`[RedisCacheService] Read failed for key ${key}:`, err);
    }

    return null;
  }

  /**
   * Stores an item into L1 and L2 Redis with TTL in seconds.
   */
  static async set<T>(key: string, data: T, ttlSeconds: number = 300): Promise<void> {
    const now = Date.now();
    localL1Cache.set(key, { value: data, expiresAt: now + ttlSeconds * 1000 });

    try {
      if (redis && (redis.status === 'ready' || redis.status === 'connecting')) {
        const serialized = JSON.stringify(data, replacer);
        await redis.set(key, serialized, 'EX', ttlSeconds);
      }
    } catch (err) {
      console.warn(`[RedisCacheService] Write failed for key ${key}:`, err);
    }
  }

  /**
   * High-level get-or-set wrapper.
   */
  static async getOrSet<T>(key: string, fetcher: () => Promise<T>, ttlSeconds: number = 300): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null && cached !== undefined) {
      return cached;
    }

    const fresh = await fetcher();
    await this.set(key, fresh, ttlSeconds);
    return fresh;
  }

  /**
   * Invalidates keys matching a pattern.
   */
  static async invalidate(pattern: string): Promise<void> {
    const cleanPattern = pattern.endsWith('*') ? pattern.slice(0, -1) : pattern;

    // Clear matching L1 keys
    for (const key of localL1Cache.keys()) {
      if (pattern === '*' || key.startsWith(cleanPattern) || key.includes(cleanPattern)) {
        localL1Cache.delete(key);
      }
    }

    try {
      if (redis && (redis.status === 'ready' || redis.status === 'connecting')) {
        const redisPattern = pattern.includes('*') ? pattern : `${pattern}*`;
        const keys = await redis.keys(redisPattern);
        if (keys.length > 0) {
          await redis.del(...keys);
        }
        // Broadcast invalidation to all sibling Node.js instances via Redis Pub/Sub
        if (typeof redis.publish === 'function') {
          await redis.publish('cache:invalidation:channel', pattern).catch(() => {});
        }
      }
    } catch (err) {
      console.warn(`[RedisCacheService] Invalidation failed for pattern ${pattern}:`, err);
    }
  }
}
