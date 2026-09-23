import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { db } from '@/lib/db';
import { recalculateAllETAs } from '@/services/eta/eta.service';

/**
 * Integration + Edge Case tests for the Adaptive Percentile Window ETA system.
 */

// ── Test Helpers ──

/** Create minimal service hierarchy (Network → Category → Service) */
async function createTestService(name: string = 'Test Likes') {
  const ts = Date.now() + Math.floor(Math.random() * 1000000);
  const network = await db.network.create({ data: { name: `Instagram ${ts}`, slug: `ig-test-${ts}` } });
  const category = await db.category.create({
    data: { name: `Instagram Likes ${ts}`, networkId: network.id },
  });
  return db.service.create({
    data: {
      name,
      rate: 1.0,
      markup: 3.0,
      categoryId: category.id,
    },
  });
}

/** Create a completed order with a specific execution time */
async function createCompletedOrder(params: {
  serviceId: string;
  userId: string;
  executionSeconds: number;
  status?: 'COMPLETED' | 'PARTIAL' | 'PENDING' | 'ERROR';
  createdAgo?: number; // How many seconds ago it was created (for window testing)
  offsetSeconds?: number; // Slight offset to avoid identical timestamps
}) {
  const { serviceId, userId, executionSeconds, status = 'COMPLETED', createdAgo, offsetSeconds = 0 } = params;

  const now = new Date();
  const baseCreatedAt = createdAgo
    ? new Date(now.getTime() - createdAgo * 1000)
    : new Date(now.getTime() - executionSeconds * 1000 - 60_000 - offsetSeconds * 1000);
  const createdAt = baseCreatedAt;
  const updatedAt = new Date(createdAt.getTime() + executionSeconds * 1000);

  return db.order.create({
    data: {
      serviceId,
      userId,
      link: 'https://instagram.com/p/test',
      quantity: 1000,
      charge: 1500,
      providerCost: BigInt(0),
      status,
      createdAt,
      updatedAt,
    },
  });
}

// ── Tests ──

describe('ETA Service — recalculateAllETAs()', () => {
  let testUser: any;

  beforeEach(async () => {
    testUser = await db.user.create({ data: { email: `eta-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.com` } });
  });

  afterEach(async () => {
    try {
      if (testUser?.id) {
        await db.order.deleteMany({ where: { userId: testUser.id } }).catch(() => {});
        await db.user.deleteMany({ where: { id: testUser.id } }).catch(() => {});
      }
    } catch { /* ignore */ }
  });

  afterAll(async () => {
    try {
      // Global cleanup of ETA test networks and categories
      const testNets = await db.network.findMany({
        where: { slug: { startsWith: 'ig-test-' } },
        select: { id: true }
      });
      const netIds = testNets.map(n => n.id);
      const testCats = await db.category.findMany({
        where: { networkId: { in: netIds } },
        select: { id: true }
      });
      const catIds = testCats.map(c => c.id);
      await db.order.deleteMany({ where: { service: { categoryId: { in: catIds } } } }).catch(() => {});
      await db.service.deleteMany({ where: { categoryId: { in: catIds } } }).catch(() => {});
      await db.category.deleteMany({ where: { id: { in: catIds } } }).catch(() => {});
      await db.network.deleteMany({ where: { id: { in: netIds } } }).catch(() => {});
      await db.user.deleteMany({ where: { email: { contains: '@test.com' } } }).catch(() => {});
    } catch { /* ignore */ }
  });

  // ── Layer 2: Integration Tests ──

  describe('Layer 2: Speed Classification', () => {
    it('classifies FAST services (exec < 30 min)', async () => {
      const service = await createTestService();

      // Create 5 orders with 10-minute execution time
      for (let i = 0; i < 5; i++) {
        await createCompletedOrder({
          serviceId: service.id,
          userId: testUser.id,
          executionSeconds: 600, // 10 minutes
        });
      }

      const result = await recalculateAllETAs();
      expect(result.updated).toBe(1);

      const updated = await db.service.findUnique({ where: { id: service.id } });
      expect(updated!.etaSpeedClass).toBe('FAST');
      expect(updated!.etaP50Seconds).toBeGreaterThan(0);
      expect(updated!.etaP90Seconds).toBeGreaterThanOrEqual(updated!.etaP50Seconds!);
      expect(updated!.etaSampleCount).toBeGreaterThanOrEqual(2);
      expect(updated!.etaUpdatedAt).toBeInstanceOf(Date);
    });

    it('classifies MEDIUM services (30 min < exec < 6 hours)', async () => {
      const service = await createTestService();

      for (let i = 0; i < 5; i++) {
        await createCompletedOrder({
          serviceId: service.id,
          userId: testUser.id,
          executionSeconds: 7200, // 2 hours
        });
      }

      const result = await recalculateAllETAs();
      expect(result.updated).toBe(1);

      const updated = await db.service.findUnique({ where: { id: service.id } });
      expect(updated!.etaSpeedClass).toBe('MEDIUM');
    });

    it('classifies SLOW services (6 hours < exec < 48 hours)', async () => {
      const service = await createTestService();

      for (let i = 0; i < 5; i++) {
        await createCompletedOrder({
          serviceId: service.id,
          userId: testUser.id,
          executionSeconds: 86400, // 24 hours
        });
      }

      const result = await recalculateAllETAs();
      expect(result.updated).toBe(1);

      const updated = await db.service.findUnique({ where: { id: service.id } });
      expect(updated!.etaSpeedClass).toBe('SLOW');
    });
  });

  describe('Layer 2: Statistical Correctness', () => {
    it('P50 approximates the median of execution times', async () => {
      const service = await createTestService();

      // Create orders with known distribution: 5, 10, 15, 20, 25 minutes
      const times = [300, 600, 900, 1200, 1500];
      for (const t of times) {
        await createCompletedOrder({
          serviceId: service.id,
          userId: testUser.id,
          executionSeconds: t,
        });
      }

      await recalculateAllETAs();
      const updated = await db.service.findUnique({ where: { id: service.id } });

      // With trimming (15% each side on 5 samples), the middle values dominate
      // P50 should be approximately near the median (900s = 15 min)
      expect(updated!.etaP50Seconds).toBeGreaterThan(0);
      expect(updated!.etaP50Seconds).toBeLessThan(1800); // Sanity: must be < 30 min
    });

    it('P90 is always >= P50', async () => {
      const service = await createTestService();

      // Varied execution times to create spread
      const times = [120, 300, 600, 900, 1200, 1500, 1800];
      for (const t of times) {
        await createCompletedOrder({
          serviceId: service.id,
          userId: testUser.id,
          executionSeconds: t,
        });
      }

      await recalculateAllETAs();
      const updated = await db.service.findUnique({ where: { id: service.id } });

      expect(updated!.etaP90Seconds).toBeGreaterThanOrEqual(updated!.etaP50Seconds!);
    });

    it('persists all ETA fields to the database', async () => {
      const service = await createTestService();

      for (let i = 0; i < 5; i++) {
        await createCompletedOrder({
          serviceId: service.id,
          userId: testUser.id,
          executionSeconds: 600,
        });
      }

      await recalculateAllETAs();

      const updated = await db.service.findUnique({ where: { id: service.id } });
      expect(updated!.etaP50Seconds).not.toBeNull();
      expect(updated!.etaP90Seconds).not.toBeNull();
      expect(updated!.etaSampleCount).toBeGreaterThan(0);
      expect(updated!.etaSpeedClass).toBeTruthy();
      expect(updated!.etaUpdatedAt).toBeInstanceOf(Date);
    });

    it('returns correct updated/skipped counts', async () => {
      const service = await createTestService();

      for (let i = 0; i < 5; i++) {
        await createCompletedOrder({
          serviceId: service.id,
          userId: testUser.id,
          executionSeconds: 600,
        });
      }

      const result = await recalculateAllETAs();
      expect(result.updated).toBe(1);
      expect(result.skipped).toBeGreaterThanOrEqual(0);
    });
  });

  // ── Layer 3: Edge Cases ──

  describe('Layer 3: Edge Cases', () => {
    it('returns { updated: 0 } when no services have enough data (< 3 orders)', async () => {
      const service = await createTestService();

      // Only 2 orders — below threshold
      for (let i = 0; i < 2; i++) {
        await createCompletedOrder({
          serviceId: service.id,
          userId: testUser.id,
          executionSeconds: 600,
        });
      }

      const result = await recalculateAllETAs();
      expect(result.updated).toBe(0);

      const updated = await db.service.findUnique({ where: { id: service.id } });
      expect(updated!.etaP50Seconds).toBeNull();
    });

    it('ignores non-completed orders (PENDING, ERROR)', async () => {
      const service = await createTestService();

      // 3 PENDING orders — should be excluded
      for (let i = 0; i < 3; i++) {
        await createCompletedOrder({
          serviceId: service.id,
          userId: testUser.id,
          executionSeconds: 600,
          status: 'PENDING',
        });
      }

      const result = await recalculateAllETAs();
      expect(result.updated).toBe(0);
    });

    it('counts PARTIAL orders as completed', async () => {
      const service = await createTestService();

      for (let i = 0; i < 5; i++) {
        await createCompletedOrder({
          serviceId: service.id,
          userId: testUser.id,
          executionSeconds: 600,
          status: 'PARTIAL',
        });
      }

      const result = await recalculateAllETAs();
      expect(result.updated).toBe(1);

      const updated = await db.service.findUnique({ where: { id: service.id } });
      expect(updated!.etaSpeedClass).toBe('FAST');
    });

    it('handles identical execution times (zero variance)', async () => {
      const service = await createTestService();

      for (let i = 0; i < 5; i++) {
        await createCompletedOrder({
          serviceId: service.id,
          userId: testUser.id,
          executionSeconds: 600, // All exactly 10 minutes
        });
      }

      await recalculateAllETAs();
      const updated = await db.service.findUnique({ where: { id: service.id } });

      // P50 and P90 should be equal when all values are the same
      expect(updated!.etaP50Seconds).toBe(updated!.etaP90Seconds);
    });

    it('resists outliers via trimmed percentile', async () => {
      const service = await createTestService();

      // 9 normal orders (10 min) + 1 extreme outlier (72 hours)
      for (let i = 0; i < 9; i++) {
        await createCompletedOrder({
          serviceId: service.id,
          userId: testUser.id,
          executionSeconds: 600,
        });
      }
      await createCompletedOrder({
        serviceId: service.id,
        userId: testUser.id,
        executionSeconds: 259200, // 72 hours — extreme outlier
      });

      await recalculateAllETAs();
      const updated = await db.service.findUnique({ where: { id: service.id } });

      // P50 should NOT be dragged to the outlier — it should stay near 600s
      // With trimming, the outlier is in the top 15% and gets excluded
      expect(updated!.etaP50Seconds!).toBeLessThan(3600); // < 1 hour
    });

    it('is idempotent — running twice produces the same result', async () => {
      const service = await createTestService();

      for (let i = 0; i < 5; i++) {
        await createCompletedOrder({
          serviceId: service.id,
          userId: testUser.id,
          executionSeconds: 600,
        });
      }

      await recalculateAllETAs();
      const first = await db.service.findUnique({ where: { id: service.id } });

      await recalculateAllETAs();
      const second = await db.service.findUnique({ where: { id: service.id } });

      expect(second!.etaP50Seconds).toBe(first!.etaP50Seconds);
      expect(second!.etaP90Seconds).toBe(first!.etaP90Seconds);
      expect(second!.etaSpeedClass).toBe(first!.etaSpeedClass);
      expect(second!.etaSampleCount).toBe(first!.etaSampleCount);
    });

    it('handles multiple services independently', async () => {
      const network = await db.network.create({ data: { name: 'IG', slug: 'ig' } });
      const category = await db.category.create({
        data: { name: 'IG Likes', networkId: network.id },
      });

      const fastService = await db.service.create({
        data: { name: 'Fast Likes', rate: 1.0, markup: 3.0, categoryId: category.id },
      });
      const slowService = await db.service.create({
        data: { name: 'Slow Followers', rate: 2.0, markup: 3.0, categoryId: category.id },
      });

      // Fast: 10 min
      for (let i = 0; i < 5; i++) {
        await createCompletedOrder({
          serviceId: fastService.id,
          userId: testUser.id,
          executionSeconds: 600,
        });
      }

      // Slow: 24 hours
      for (let i = 0; i < 5; i++) {
        await createCompletedOrder({
          serviceId: slowService.id,
          userId: testUser.id,
          executionSeconds: 86400,
        });
      }

      const result = await recalculateAllETAs();
      expect(result.updated).toBe(2);

      const fast = await db.service.findUnique({ where: { id: fastService.id } });
      const slow = await db.service.findUnique({ where: { id: slowService.id } });

      expect(fast!.etaSpeedClass).toBe('FAST');
      expect(slow!.etaSpeedClass).toBe('SLOW');
      expect(fast!.etaP50Seconds!).toBeLessThan(slow!.etaP50Seconds!);
    });

    it('returns { updated: 0 } when there are zero orders in the database', async () => {
      const result = await recalculateAllETAs();
      expect(result.updated).toBe(0);
      expect(result.skipped).toBe(0);
    });
  });
});
