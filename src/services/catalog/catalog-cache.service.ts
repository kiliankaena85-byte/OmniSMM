/**
 * (c) 2024-2026 SMMplan / OmniSMM 1.0. All rights reserved.
 * Multi-Tenant Redis Catalog Cache Service (RAC-2026 / SDD-TDD 2026)
 *
 * Implements high-performance Redis caching for the public catalog tree and service lists.
 * Features:
 * 1. Strict Tenant Isolation: All keys are prefixed with tenantId.
 * 2. Fail-Open Circuit Breaker: If Redis is unavailable or times out (>500ms),
 *    the service transparently executes the DB fetcher without interrupting user sessions.
 * 3. Atomic Invalidation: Helpers to flush catalog cache on admin mutations.
 */

import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { normalizeTenantId } from '@/lib/tenant-scope';

export const CATALOG_CACHE_TTL_SECONDS = 1800; // 30 minutes

export const CATALOG_CACHE_KEYS = {
  networks: (tenantId: string) => `catalog:v1:${normalizeTenantId(tenantId)}:networks`,
  services: (categoryId: string, tenantId: string) =>
    `catalog:v1:${normalizeTenantId(tenantId)}:services:${categoryId}`,
  publicCatalog: (tenantId: string) => `catalog:v1:${normalizeTenantId(tenantId)}:public-catalog`,
  publicServices: (categoryId: string, tenantId: string) =>
    `catalog:v1:${normalizeTenantId(tenantId)}:public-services:${categoryId}`,
  storefrontGuestBundle: (tenantId: string) => `catalog:v1:${normalizeTenantId(tenantId)}:guest-bundle`,
  tenantPattern: (tenantId: string) => `catalog:v1:${normalizeTenantId(tenantId)}:*`,
};

/**
 * Executes a Redis get operation with an internal timeout guard.
 */
async function safeRedisGet(key: string): Promise<string | null> {
  try {
    return await Promise.race([
      redis.get(key),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('Redis get timeout')), 500)
      ),
    ]);
  } catch (error) {
    logger.warn('[CATALOG_CACHE] Redis read failed or timed out, degrading to DB fetcher', {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Executes a Redis set operation safely without blocking the caller.
 */
async function safeRedisSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  try {
    await redis.set(key, value, 'EX', ttlSeconds);
  } catch (error) {
    logger.warn('[CATALOG_CACHE] Redis write failed', {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Retrieves cached networks tree for storefront with Redis caching and DB fallback.
 */
export async function getCachedNetworksWithRedis<T>(
  rawTenantId: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const tenantId = normalizeTenantId(rawTenantId);
  const cacheKey = CATALOG_CACHE_KEYS.networks(tenantId);

  // 1. Try reading from Redis
  const cached = await safeRedisGet(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached) as T;
    } catch {
      // Corrupted JSON, discard
    }
  }

  // 2. Cache miss or Redis error -> fetch from DB
  const data = await fetcher();

  // 3. Populate Redis asynchronously
  if (data !== undefined && data !== null) {
    void safeRedisSet(cacheKey, JSON.stringify(data), CATALOG_CACHE_TTL_SECONDS);
  }

  return data;
}

/**
 * Retrieves cached services for a category with Redis caching and DB fallback.
 */
export async function getCachedCategoryServicesWithRedis<T>(
  categoryId: string,
  rawTenantId: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const tenantId = normalizeTenantId(rawTenantId);
  const cacheKey = CATALOG_CACHE_KEYS.services(categoryId, tenantId);

  // 1. Try reading from Redis
  const cached = await safeRedisGet(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached) as T;
    } catch {
      // Corrupted JSON, discard
    }
  }

  // 2. Cache miss or Redis error -> fetch from DB
  const data = await fetcher();

  // 3. Populate Redis asynchronously
  if (data !== undefined && data !== null) {
    void safeRedisSet(cacheKey, JSON.stringify(data), CATALOG_CACHE_TTL_SECONDS);
  }

  return data;
}

/**
 * Retrieves fully-transformed public catalog with Redis caching and fallback.
 */
export async function getCachedPublicCatalogWithRedis<T>(
  rawTenantId: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const tenantId = normalizeTenantId(rawTenantId);
  const cacheKey = CATALOG_CACHE_KEYS.publicCatalog(tenantId);

  const cached = await safeRedisGet(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached) as T;
    } catch {
      // Corrupted JSON, discard
    }
  }

  const data = await fetcher();

  if (data !== undefined && data !== null) {
    void safeRedisSet(cacheKey, JSON.stringify(data), CATALOG_CACHE_TTL_SECONDS);
  }

  return data;
}

/**
 * Retrieves fully-transformed public services for a category with Redis caching and fallback.
 */
export async function getCachedProcessedServicesWithRedis<T>(
  categoryId: string,
  rawTenantId: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const tenantId = normalizeTenantId(rawTenantId);
  const cacheKey = CATALOG_CACHE_KEYS.publicServices(categoryId, tenantId);

  const cached = await safeRedisGet(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached) as T;
    } catch {
      // Corrupted JSON, discard
    }
  }

  const data = await fetcher();

  if (data !== undefined && data !== null) {
    void safeRedisSet(cacheKey, JSON.stringify(data), CATALOG_CACHE_TTL_SECONDS);
  }

  return data;
}

/**
 * Retrieves storefront guest bundle with Redis caching and fallback.
 */
export async function getCachedGuestBundleWithRedis<T>(
  rawTenantId: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const tenantId = normalizeTenantId(rawTenantId);
  const cacheKey = CATALOG_CACHE_KEYS.storefrontGuestBundle(tenantId);

  const cached = await safeRedisGet(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached) as T;
    } catch {
      // Corrupted JSON, discard
    }
  }

  const data = await fetcher();

  if (data !== undefined && data !== null) {
    void safeRedisSet(cacheKey, JSON.stringify(data), 600); // 10 minutes TTL
  }

  return data;
}

/**
 * Atomically invalidates Redis catalog cache for a specific tenant or all tenants.
 */
export async function invalidateCatalogCache(rawTenantId?: string): Promise<void> {
  try {
    if (rawTenantId) {
      const tenantId = normalizeTenantId(rawTenantId);
      const networkKey = CATALOG_CACHE_KEYS.networks(tenantId);
      
      // Delete primary networks key directly
      await redis.del(networkKey);

      // Delete category services for this tenant
      const pattern = CATALOG_CACHE_KEYS.tenantPattern(tenantId);
      if (typeof (redis as any).scan === 'function') {
        let cursor = '0';
        do {
          const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
          cursor = nextCursor;
          if (keys.length > 0) {
            await redis.del(...keys);
          }
        } while (cursor !== '0');
      } else if (typeof (redis as any).keys === 'function') {
        const keys = await (redis as any).keys(pattern);
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      }
    } else {
      // Invalidate both primary brands
      await Promise.all([
        invalidateCatalogCache('smmplan'),
        invalidateCatalogCache('flux'),
      ]);
    }
  } catch (error) {
    logger.warn('[CATALOG_CACHE] Failed to invalidate Redis cache keys', {
      tenantId: rawTenantId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
