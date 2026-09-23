import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../../src/lib/db';
import { runOrphanSweep } from '../../src/workers/processors/cleanup.processor';
import { ordersQueue } from '../../src/lib/queue-manager';

describe('Sweep Orphans (Task C3)', () => {
  let testUserId: string;
  let testServiceId: string;

  beforeEach(async () => {
    const user = await db.user.create({
      data: {
        email: `sweep-tester-${Date.now()}@test.com`,
        passwordHash: 'hash',
        balance: 100000,
        role: 'CLIENT'
      }
    });
    testUserId = user.id;

    const category = await db.category.create({
      data: { name: 'Test Category', sort: 1 }
    });
    const service = await db.service.create({
      data: {
        name: 'Test Service',
        categoryId: category.id,
        pricePer1000Cents: 100,
        rate: 1.0
      }
    });
    testServiceId = service.id;

    // Clear queue before testing
    await ordersQueue.obliterate({ force: true });
  });

  afterEach(async () => {
    // Clear orders
    await db.order.deleteMany({ where: { userId: testUserId } });
    await db.service.deleteMany({ where: { id: testServiceId } });
    await db.category.deleteMany({ where: { name: 'Test Category' } });
    await db.user.deleteMany({ where: { id: testUserId } });
    await ordersQueue.obliterate({ force: true });
  });

  it('should successfully re-enqueue a truly orphaned PENDING order without changing its status', async () => {
    // 1. Create a fake old PENDING order
    const oldDate = new Date(Date.now() - 20 * 60 * 1000); // 20 minutes ago
    const order = await db.order.create({
      data: {
        userId: testUserId,
        serviceId: testServiceId,
        link: 'http://test.com',
        quantity: 100,
        charge: 50,
        providerCost: 20,
        status: 'PENDING',
        numericId: Math.floor(Math.random() * 1000000),
        createdAt: oldDate,
        updatedAt: oldDate
      }
    });

    // Verify it is NOT in the queue
    const jobId = `dispatch-${order.id}`;
    let job = await ordersQueue.getJob(jobId);
    expect(job).toBeUndefined();

    // 2. Run Sweep
    await runOrphanSweep();

    // 3. Verify it was re-enqueued
    job = await ordersQueue.getJob(jobId);
    expect(job).toBeDefined();
    expect(job?.id).toBe(jobId);
    expect(job?.data.orderId).toBe(order.id);

    // 4. Verify status is still PENDING
    const dbOrder = await db.order.findUnique({ where: { id: order.id } });
    expect(dbOrder?.status).toBe('PENDING');
  });

  it('should NOT re-enqueue if job already exists in delayed state', async () => {
    const oldDate = new Date(Date.now() - 20 * 60 * 1000); // 20 minutes ago
    const order = await db.order.create({
      data: {
        userId: testUserId,
        serviceId: testServiceId,
        link: 'http://test.com',
        quantity: 100,
        charge: 50,
        providerCost: 20,
        status: 'PENDING',
        numericId: Math.floor(Math.random() * 1000000),
        createdAt: oldDate,
        updatedAt: oldDate
      }
    });

    const jobId = `dispatch-${order.id}`;
    
    // Simulate it already being in queue (delayed)
    await ordersQueue.add('order-dispatch', { orderId: order.id }, { jobId, delay: 60000 });

    const beforeCount = await ordersQueue.getDelayedCount();
    expect(beforeCount).toBe(1);

    // Run sweep
    await runOrphanSweep();

    const afterCount = await ordersQueue.getDelayedCount();
    expect(afterCount).toBe(1); // Didn't duplicate!
    
    const dbOrder = await db.order.findUnique({ where: { id: order.id } });
    expect(dbOrder?.status).toBe('PENDING');
  });

  it('should NOT re-enqueue if job already exists in completed state, but keep order PENDING', async () => {
    const oldDate = new Date(Date.now() - 20 * 60 * 1000); // 20 minutes ago
    const order = await db.order.create({
      data: {
        userId: testUserId,
        serviceId: testServiceId,
        link: 'http://test.com',
        quantity: 100,
        charge: 50,
        providerCost: 20,
        status: 'PENDING',
        numericId: Math.floor(Math.random() * 1000000),
        createdAt: oldDate,
        updatedAt: oldDate
      }
    });

    const jobId = `dispatch-${order.id}`;
    
        // Mock getJob
    const spy = vi.spyOn(ordersQueue, 'getJob').mockResolvedValue({
      id: jobId,
      getState: async () => 'completed'
    } as any);

    const before = await db.order.findUnique({ where: { id: order.id } });
    console.log('[DEBUG-TEST] Order before sweep:', before);

    await runOrphanSweep();

    const dbOrder = await db.order.findUnique({ where: { id: order.id } });
    console.log('[DEBUG-TEST] Order after sweep:', dbOrder);
    expect(dbOrder?.status).toBe('PENDING'); // Unchanged

    const delayed = await ordersQueue.getDelayedCount();
    const waiting = await ordersQueue.getWaitingCount();
    expect(delayed + waiting).toBe(0); // Not re-enqueued

    spy.mockRestore();
  });

  it('should NOT re-enqueue and keep order PENDING on Redis error', async () => {
    const oldDate = new Date(Date.now() - 20 * 60 * 1000); // 20 minutes ago
    const order = await db.order.create({
      data: {
        userId: testUserId,
        serviceId: testServiceId,
        link: 'http://test.com',
        quantity: 100,
        charge: 50,
        providerCost: 20,
        status: 'PENDING',
        numericId: Math.floor(Math.random() * 1000000),
        createdAt: oldDate,
        updatedAt: oldDate
      }
    });

    // Mock getJob to throw
    const spy = vi.spyOn(ordersQueue, 'getJob').mockRejectedValue(new Error('Redis connection lost'));

    await runOrphanSweep();

    const dbOrder = await db.order.findUnique({ where: { id: order.id } });
    expect(dbOrder?.status).toBe('PENDING'); // Unchanged

    const delayed = await ordersQueue.getDelayedCount();
    const waiting = await ordersQueue.getWaitingCount();
    expect(delayed + waiting).toBe(0); // Not re-enqueued

    spy.mockRestore();
  });
});
