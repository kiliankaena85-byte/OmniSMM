import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../../src/lib/db';
import paymentSyncProcessor from '../../src/workers/processors/payment-sync';
import { SettingsManager } from '../../src/lib/settings';
import type { Job } from 'bullmq';

describe('Integration: Payment Sync Remote Canceled (E2.2 / WRK-01)', () => {
  let testUserId: string;
  let testCategoryId: string;
  let testServiceId: string;
  let testPaymentId: string;
  const originalFetch = global.fetch;

  beforeEach(async () => {
    vi.spyOn(SettingsManager, 'isTestMode').mockResolvedValue(false);
    vi.spyOn(SettingsManager, 'getPaymentSecrets').mockResolvedValue({
      yookassaShopId: 'shop1',
      yookassaSecretKey: 'secret1'
    } as any);

    const user = await db.user.create({
      data: {
        email: `remote-canceled-${Date.now()}@test.com`,
        passwordHash: 'hash',
        balance: 0,
        role: 'CLIENT'
      }
    });
    testUserId = user.id;

    const category = await db.category.create({
      data: { name: `Test Cat ${Date.now()}`, sort: 1 }
    });
    testCategoryId = category.id;

    const service = await db.service.create({
      data: {
        name: 'Test Remote Cancel Service',
        categoryId: category.id,
        pricePer1000Cents: 100,
        rate: 1.0
      }
    });
    testServiceId = service.id;
  });

  afterEach(async () => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();

    if (testPaymentId) {
      await db.order.deleteMany({ where: { paymentId: testPaymentId } });
      await db.payment.deleteMany({ where: { id: testPaymentId } });
    }
    if (testUserId) {
      await db.order.deleteMany({ where: { userId: testUserId } });
      await db.payment.deleteMany({ where: { userId: testUserId } });
      await db.user.deleteMany({ where: { id: testUserId } });
    }
    if (testServiceId) {
      await db.service.deleteMany({ where: { id: testServiceId } });
    }
    if (testCategoryId) {
      await db.category.deleteMany({ where: { id: testCategoryId } });
    }
  });

  it('cancels pending YooKassa payment and its awaiting basket order when remote status is canceled', async () => {
    // Created 20 mins ago (> 10 mins threshold, < 24h)
    const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000);

    const payment = await db.payment.create({
      data: {
        userId: testUserId,
        amount: 150,
        currency: 'RUB',
        gateway: 'yookassa',
        gatewayId: `yoo-test-${Date.now()}`,
        status: 'PENDING',
        createdAt: twentyMinsAgo,
        updatedAt: twentyMinsAgo
      }
    });
    testPaymentId = payment.id;

    const order = await db.order.create({
      data: {
        userId: testUserId,
        serviceId: testServiceId,
        link: 'https://example.com/post/canceled',
        quantity: 100,
        charge: 150,
        providerCost: BigInt(30),
        status: 'AWAITING_PAYMENT',
        paymentId: payment.id,
        numericId: Math.floor(Math.random() * 1000000),
        createdAt: twentyMinsAgo,
        updatedAt: twentyMinsAgo
      }
    });

    // Mock fetch to return canceled status from YooKassa API
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'canceled'
      })
    }) as any;

    await paymentSyncProcessor({ name: 'payment-sync' } as Job);

    const updatedPayment = await db.payment.findUnique({ where: { id: payment.id } });
    expect(updatedPayment?.status).toBe('CANCELED');

    const updatedOrder = await db.order.findUnique({ where: { id: order.id } });
    expect(updatedOrder?.status).toBe('CANCELED');
    expect(updatedOrder?.error).toContain('Платёж отменён на стороне шлюза');
  });
});
