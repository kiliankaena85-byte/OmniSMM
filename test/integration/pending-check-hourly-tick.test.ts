import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../../src/lib/db';
import { runPendingCheckResolution } from '../../src/workers/processors/cleanup.processor';
import { providerService } from '../../src/services/providers/provider.service';

describe('Integration: Hourly PENDING_CHECK Auto-Resolution (E2.3 / WRK-03)', () => {
  let testUserId: string;
  let testCategoryId: string;
  let testProviderId: string;
  let testServiceId: string;

  beforeEach(async () => {
    const user = await db.user.create({
      data: {
        email: `pending-check-${Date.now()}@test.com`,
        passwordHash: 'hash',
        balance: 50000,
        role: 'CLIENT'
      }
    });
    testUserId = user.id;

    const category = await db.category.create({
      data: { name: `PC Cat ${Date.now()}`, sort: 1 }
    });
    testCategoryId = category.id;

    const provider = await db.provider.create({
      data: {
        name: `PC Prov ${Date.now()}`,
        apiUrl: 'https://api.test-provider.com',
        apiKey: 'key-test',
        isActive: true
      }
    });
    testProviderId = provider.id;

    const service = await db.service.create({
      data: {
        name: 'PC Test Service',
        categoryId: category.id,
        providerId: provider.id,
        externalId: 'prov-svc-1',
        pricePer1000Cents: 100,
        rate: 1.0
      }
    });
    testServiceId = service.id;
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

  it('auto-resolves stale PENDING_CHECK order (>6h) via provider status on hourly tick', async () => {
    const sevenHoursAgo = new Date(Date.now() - 7 * 60 * 60 * 1000);

    const order = await db.order.create({
      data: {
        userId: testUserId,
        serviceId: testServiceId,
        link: 'https://example.com/post/pc1',
        quantity: 100,
        charge: 100,
        providerCost: BigInt(20),
        status: 'PENDING_CHECK',
        externalId: 'ext-hourly-123',
        numericId: Math.floor(Math.random() * 1000000),
        createdAt: sevenHoursAgo,
        updatedAt: sevenHoursAgo
      }
    });

    const mockProviderInstance = {
      getOrderStatus: vi.fn().mockResolvedValue({ status: 'Completed', remains: '0' })
    };
    vi.spyOn(providerService, 'getWorkerProviderInstance').mockResolvedValue(mockProviderInstance as any);

    await runPendingCheckResolution();

    const updatedOrder = await db.order.findUnique({ where: { id: order.id } });
    expect(updatedOrder?.status).toBe('COMPLETED');
    expect(updatedOrder?.updatedAt.getTime()).toBeGreaterThan(sevenHoursAgo.getTime());
  });

  it('regression guard: does NOT resolve PENDING_CHECK orders younger than 6 hours threshold', async () => {
    const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000);

    const recentOrder = await db.order.create({
      data: {
        userId: testUserId,
        serviceId: testServiceId,
        link: 'https://example.com/post/recent',
        quantity: 100,
        charge: 100,
        providerCost: BigInt(20),
        status: 'PENDING_CHECK',
        externalId: 'ext-recent-456',
        numericId: Math.floor(Math.random() * 1000000),
        createdAt: oneHourAgo,
        updatedAt: oneHourAgo
      }
    });

    const mockProviderInstance = {
      getOrderStatus: vi.fn().mockResolvedValue({ status: 'Completed', remains: '0' })
    };
    vi.spyOn(providerService, 'getWorkerProviderInstance').mockResolvedValue(mockProviderInstance as any);

    await runPendingCheckResolution();

    const dbOrder = await db.order.findUnique({ where: { id: recentOrder.id } });
    expect(dbOrder?.status).toBe('PENDING_CHECK'); // Must remain PENDING_CHECK!
    expect(mockProviderInstance.getOrderStatus).not.toHaveBeenCalled();
  });
});
