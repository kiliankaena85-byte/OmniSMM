import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../../src/lib/db';
import syncProcessor from '../../src/workers/processors/sync.processor';
import { providerService } from '../../src/services/providers/provider.service';
import * as notifications from '../../src/lib/notifications';
import type { Job } from 'bullmq';

describe('Integration: Zero-Start Progress Escalation (E2.4 / WRK-02)', () => {
  let testUserId: string;
  let testCategoryId: string;
  let testProviderId: string;
  let testServiceId: string;

  beforeEach(async () => {
    const user = await db.user.create({
      data: {
        email: `zero-start-${Date.now()}@test.com`,
        passwordHash: 'hash',
        balance: 50000,
        role: 'CLIENT'
      }
    });
    testUserId = user.id;

    const category = await db.category.create({
      data: { name: `ZS Cat ${Date.now()}`, sort: 1 }
    });
    testCategoryId = category.id;

    const provider = await db.provider.create({
      data: {
        name: `ZS Prov ${Date.now()}`,
        apiUrl: 'https://api.test-provider.com',
        apiKey: 'key-test',
        isActive: true
      }
    });
    testProviderId = provider.id;

    const service = await db.service.create({
      data: {
        name: 'ZS Test Service',
        categoryId: category.id,
        providerId: provider.id,
        externalId: 'prov-svc-zs',
        pricePer1000Cents: 100,
        rate: 1.0
      }
    });
    testServiceId = service.id;

    // Mock provider instance for sync loop
    vi.spyOn(providerService, 'getWorkerProviderInstance').mockResolvedValue({
      getMultiOrderStatus: vi.fn().mockResolvedValue({})
    } as any);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (testUserId) {
      await db.order.deleteMany({ where: { userId: testUserId } });
      await db.user.deleteMany({ where: { id: testUserId } });
    }
    if (testServiceId) {
      await db.service.deleteMany({ where: { id: testServiceId } });
    }
    if (testProviderId) {
      await db.provider.deleteMany({ where: { id: testProviderId } });
    }
    if (testCategoryId) {
      await db.category.deleteMany({ where: { id: testCategoryId } });
    }
  });

  it('escalates stuck IN_PROGRESS order (expired waitingUntil, remains == quantity, non-drip) to PENDING_CHECK + sends alert', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const alertSpy = vi.spyOn(notifications, 'sendAdminAlert');

    const stuckOrder = await db.order.create({
      data: {
        userId: testUserId,
        serviceId: testServiceId,
        link: 'https://example.com/post/stuck-1',
        quantity: 100,
        remains: 100,
        charge: 100,
        providerCost: BigInt(20),
        status: 'IN_PROGRESS',
        externalId: 'ext-zs-100',
        isDripFeed: false,
        waitingUntil: twoHoursAgo,
        numericId: Math.floor(Math.random() * 1000000),
        createdAt: twoHoursAgo,
        updatedAt: twoHoursAgo
      }
    });

    await syncProcessor({ name: 'sync-all' } as Job);

    const updated = await db.order.findUnique({ where: { id: stuckOrder.id } });
    expect(updated?.status).toBe('PENDING_CHECK');
    expect(updated?.error).toContain('zero-start');

    expect(alertSpy).toHaveBeenCalledWith(
      expect.stringContaining('ZERO-START'),
      'WARNING'
    );
  });

  it('regression guard: does NOT escalate IN_PROGRESS order when remains < quantity (progress made)', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const activeOrder = await db.order.create({
      data: {
        userId: testUserId,
        serviceId: testServiceId,
        link: 'https://example.com/post/progress-1',
        quantity: 100,
        remains: 40, // 60 delivered
        charge: 100,
        providerCost: BigInt(20),
        status: 'IN_PROGRESS',
        externalId: 'ext-progress-200',
        isDripFeed: false,
        waitingUntil: twoHoursAgo,
        numericId: Math.floor(Math.random() * 1000000),
        createdAt: twoHoursAgo,
        updatedAt: twoHoursAgo
      }
    });

    await syncProcessor({ name: 'sync-all' } as Job);

    const dbOrder = await db.order.findUnique({ where: { id: activeOrder.id } });
    expect(dbOrder?.status).toBe('IN_PROGRESS'); // Must remain IN_PROGRESS!
  });

  it('regression guard: does NOT escalate drip-feed orders even if remains == quantity', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const dripOrder = await db.order.create({
      data: {
        userId: testUserId,
        serviceId: testServiceId,
        link: 'https://example.com/post/drip-1',
        quantity: 100,
        remains: 100,
        charge: 100,
        providerCost: BigInt(20),
        status: 'IN_PROGRESS',
        externalId: 'ext-drip-300',
        isDripFeed: true, // Drip-feed order
        waitingUntil: twoHoursAgo,
        numericId: Math.floor(Math.random() * 1000000),
        createdAt: twoHoursAgo,
        updatedAt: twoHoursAgo
      }
    });

    await syncProcessor({ name: 'sync-all' } as Job);

    const dbOrder = await db.order.findUnique({ where: { id: dripOrder.id } });
    expect(dbOrder?.status).toBe('IN_PROGRESS'); // Must remain IN_PROGRESS!
  });
});
