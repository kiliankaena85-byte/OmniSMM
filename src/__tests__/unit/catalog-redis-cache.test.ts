import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCachedNetworksWithRedis,
  getCachedCategoryServicesWithRedis,
  invalidateCatalogCache,
  CATALOG_CACHE_KEYS,
} from '@/services/catalog/catalog-cache.service';
import { redis } from '@/lib/redis';

describe('Multi-Tenant Redis Catalog Cache Service (TDD)', () => {
  const mockNetworksSmmplan = [
    { id: 'net-1', slug: 'telegram', name: 'Telegram', categories: [] },
  ];
  const mockNetworksFlux = [
    { id: 'net-2', slug: 'vk', name: 'VKontakte', categories: [] },
  ];

  const mockServices = [
    { id: 'srv-1', numericId: 101, name: 'Telegram Members', pricePer1kRub: 150 },
  ];

  beforeEach(async () => {
    vi.restoreAllMocks();
    // Clean up any test keys in redis if connected
    try {
      await invalidateCatalogCache('smmplan');
      await invalidateCatalogCache('flux');
    } catch {
      // ignore
    }
  });

  it('should generate strict multi-tenant Redis keys', () => {
    const smmplanKey = CATALOG_CACHE_KEYS.networks('smmplan');
    const fluxKey = CATALOG_CACHE_KEYS.networks('flux');
    expect(smmplanKey).toBe('catalog:v1:smmplan:networks');
    expect(fluxKey).toBe('catalog:v1:flux:networks');
    expect(smmplanKey).not.toBe(fluxKey);

    const srvKey = CATALOG_CACHE_KEYS.services('cat-123', 'smmplan');
    expect(srvKey).toBe('catalog:v1:smmplan:services:cat-123');
  });

  it('should call fetcher on cache miss, store in Redis, and return cached result on second call', async () => {
    const fetcher = vi.fn().mockResolvedValue(mockNetworksSmmplan);

    // Call 1: Miss
    const result1 = await getCachedNetworksWithRedis('smmplan', fetcher);
    expect(result1).toEqual(mockNetworksSmmplan);
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Call 2: Hit
    const result2 = await getCachedNetworksWithRedis('smmplan', fetcher);
    expect(result2).toEqual(mockNetworksSmmplan);
    expect(fetcher).toHaveBeenCalledTimes(1); // Fetcher should NOT be called again
  });

  it('should enforce strict tenant isolation in Redis cache', async () => {
    const fetcherSmmplan = vi.fn().mockResolvedValue(mockNetworksSmmplan);
    const fetcherFlux = vi.fn().mockResolvedValue(mockNetworksFlux);

    const resSmmplan = await getCachedNetworksWithRedis('smmplan', fetcherSmmplan);
    const resFlux = await getCachedNetworksWithRedis('flux', fetcherFlux);

    expect(resSmmplan).toEqual(mockNetworksSmmplan);
    expect(resFlux).toEqual(mockNetworksFlux);
    expect(resSmmplan).not.toEqual(resFlux);

    expect(fetcherSmmplan).toHaveBeenCalledTimes(1);
    expect(fetcherFlux).toHaveBeenCalledTimes(1);
  });

  it('should provide Fail-Open resilience when Redis fails or throws', async () => {
    const fetcher = vi.fn().mockResolvedValue(mockNetworksSmmplan);

    // Force redis.get to reject
    const getSpy = vi.spyOn(redis, 'get').mockRejectedValueOnce(new Error('Redis connection timed out'));

    const result = await getCachedNetworksWithRedis('smmplan', fetcher);
    expect(result).toEqual(mockNetworksSmmplan);
    expect(fetcher).toHaveBeenCalledTimes(1);

    getSpy.mockRestore();
  });

  it('should invalidate cache when invalidateCatalogCache is called', async () => {
    const fetcher = vi.fn().mockResolvedValue(mockServices);

    // Cache service
    await getCachedCategoryServicesWithRedis('cat-1', 'smmplan', fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Invalidate
    await invalidateCatalogCache('smmplan');

    // Call again -> should be cache miss
    await getCachedCategoryServicesWithRedis('cat-1', 'smmplan', fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
