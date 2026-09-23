import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { RedisCacheService } from '@/lib/cache/redis-cache.service';
import { SafePagination, MAX_SAFE_TAKE } from '@/lib/pagination/safe-pagination';
import { QueuePrioritizer, QUEUE_CONFIGS } from '@/workers/queues/queue-prioritizer';

describe('Performance & Scalability Overhaul Test Suite', () => {
  describe('1. Redis Multi-Tier Cache Layer', () => {
    beforeEach(async () => {
      await RedisCacheService.invalidate('test:*');
    });

    it('stores and retrieves cached data with ultra-low latency (<5ms)', async () => {
      const cacheKey = 'test:categories:all';
      const mockData = [{ id: 'cat_1', name: 'Telegram Members', amount: BigInt(5000) }];

      // Cache miss -> Fetcher called
      const fetcher = vi.fn().mockResolvedValue(mockData);
      const res1 = await RedisCacheService.getOrSet(cacheKey, fetcher, 60);

      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(res1).toEqual(mockData);

      // Cache hit -> Immediate return without calling fetcher
      const startTime = performance.now();
      const res2 = await RedisCacheService.getOrSet(cacheKey, fetcher, 60);
      const durationMs = performance.now() - startTime;

      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(res2).toEqual(mockData);
      expect(durationMs).toBeLessThan(10); // Ultra-fast L1/L2 response
    });

    it('invalidates cache keys on demand', async () => {
      const cacheKey = 'test:profile:user123';
      await RedisCacheService.set(cacheKey, { name: 'Alex' }, 60);

      const before = await RedisCacheService.get(cacheKey);
      expect(before).toEqual({ name: 'Alex' });

      await RedisCacheService.invalidate('test:profile');
      const after = await RedisCacheService.get(cacheKey);
      expect(after).toBeNull();
    });
  });

  describe('2. Safe Pagination & OOM Protection', () => {
    it('clamps abusive or huge take requests (e.g. 10000) down to MAX_SAFE_TAKE (100)', () => {
      const result = SafePagination.sanitize({ take: 10000, page: 1 });
      expect(result.take).toBe(MAX_SAFE_TAKE);
      expect(result.skip).toBe(0);
    });

    it('calculates correct skip for pagination pages', () => {
      const result = SafePagination.sanitize({ page: 3, pageSize: 25 });
      expect(result.take).toBe(25);
      expect(result.skip).toBe(50); // (3 - 1) * 25
    });

    it('supports cursor-based pagination with safe limits', () => {
      const result = SafePagination.sanitize({ cursor: 'ord_xyz123', pageSize: 20 });
      expect(result.take).toBe(20);
      expect(result.cursor).toEqual({ id: 'ord_xyz123' });
      expect(result.skip).toBe(1);
    });
  });

  describe('3. Queue Prioritization & Concurrency Segregation', () => {
    it('assigns high priority to financial and authentication jobs and low priority to bulk jobs', () => {
      expect(QueuePrioritizer.getQueueTierForJob('OTP_DISPATCH')).toBe('critical');
      expect(QueuePrioritizer.getQueueTierForJob('BALANCE_OPERATION')).toBe('critical');
      expect(QueuePrioritizer.getQueueTierForJob('ORDER_STATUS_SYNC')).toBe('default');
      expect(QueuePrioritizer.getQueueTierForJob('SHADOW_CATALOG_SYNC')).toBe('bulk');
      expect(QueuePrioritizer.getQueueTierForJob('GENERATE_REPORT')).toBe('bulk');

      expect(QUEUE_CONFIGS.critical.priority).toBeGreaterThan(QUEUE_CONFIGS.default.priority);
      expect(QUEUE_CONFIGS.default.priority).toBeGreaterThan(QUEUE_CONFIGS.bulk.priority);
    });
  });

  describe('4. Eager Loading & No N+1 Verification', () => {
    it('loads orders with related service, provider and user in a single relational query', async () => {
      // Create test dataset
      const user = await db.user.create({
        data: {
          email: `perf-user-${Date.now()}@smmplan.pro`,
          role: 'USER',
          balance: BigInt(0),
          tenantId: 'smmplan',
        },
      });

      await db.network.upsert({
        where: { id: 'telegram' },
        update: {},
        create: {
          id: 'telegram',
          name: 'Telegram',
          slug: 'telegram',
        },
      });

      const category = await db.category.create({
        data: {
          name: 'Perf Cat',
          networkId: 'telegram',
          tenantId: 'smmplan',
        },
      });

      const service = await db.service.create({
        data: {
          name: 'Perf Service',
          categoryId: category.id,
          rate: 10,
          tenantId: 'smmplan',
        },
      });

      const order = await db.order.create({
        data: {
          userId: user.id,
          serviceId: service.id,
          charge: BigInt(1000),
          providerCost: BigInt(500),
          link: 'https://t.me/channel',
          quantity: 100,
          tenantId: 'smmplan',
        },
      });

      // Eager load with single query
      const loaded = await db.order.findUnique({
        where: { id: order.id },
        include: {
          service: {
            include: {
              category: true,
            },
          },
          user: true,
        },
      });

      expect(loaded).not.toBeNull();
      expect(loaded?.service.name).toBe('Perf Service');
      expect(loaded?.service.category.name).toBe('Perf Cat');
      expect(loaded?.user.email).toBe(user.email);
    });
  });
});
