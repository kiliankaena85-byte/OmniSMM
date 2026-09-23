import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../../src/lib/db';
import paymentSyncProcessor from '../../src/workers/processors/payment-sync';
import { SettingsManager } from '../../src/lib/settings';
import type { Job } from 'bullmq';

describe('Integration: Payment Sync Stale Basket Orders (E2.1 / WRK-01)', () => {
  let testUserId: string;
  let testCategoryId: string;
  let testServiceId: string;
  let testPaymentId: string;

  beforeEach(async () => {
    vi.spyOn(SettingsManager, 'isTestMode').mockResolvedValue(false);
    vi.spyOn(SettingsManager, 'getPaymentSecrets').mockResolvedValue({
      yookassaShopId: 'shop-test',
      yookassaSecretKey: 'key-test'
    } as any);

    const user = await db.user.create({
      data: {
        email: `stale-basket-${Date.now()}@test.com`,
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
        name: 'Test Basket Service',
        categoryId: category.id,
        pricePer1000Cents: 100,
        rate: 1.0
      }
    });
    testServiceId = service.id;
  });

  afterEach(async () => {
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

  it('expires stale 24h non-YooKassa payment and cancels all associated basket orders', async () => {
    const staleDate = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago

    const payment = await db.payment.create({
      data: {
        userId: testUserId,
        amount: 200,
        currency: 'RUB',
        gateway: 'robokassa',
        status: 'PENDING',
        createdAt: staleDate,
        updatedAt: staleDate
      }
    });
    testPaymentId = payment.id;

    const order1 = await db.order.create({
      data: {
        userId: testUserId,
        serviceId: testServiceId,
        link: 'https://example.com/post/1',
        quantity: 100,
        charge: 100,
        providerCost: BigInt(20),
        status: 'AWAITING_PAYMENT',
        paymentId: payment.id,
        numericId: Math.floor(Math.random() * 1000000),
        createdAt: staleDate,
        updatedAt: staleDate
      }
    });

    const order2 = await db.order.create({
      data: {
        userId: testUserId,
        serviceId: testServiceId,
        link: 'https://example.com/post/2',
        quantity: 100,
        charge: 100,
        providerCost: BigInt(20),
        status: 'AWAITING_PAYMENT',
        paymentId: payment.id,
        numericId: Math.floor(Math.random() * 1000000),
        createdAt: staleDate,
        updatedAt: staleDate
      }
    });

    await paymentSyncProcessor({ name: 'payment-sync' } as Job);

    const updatedPayment = await db.payment.findUnique({ where: { id: payment.id } });
    expect(updatedPayment?.status).toBe('CANCELED');

    const updatedOrder1 = await db.order.findUnique({ where: { id: order1.id } });
    const updatedOrder2 = await db.order.findUnique({ where: { id: order2.id } });

    expect(updatedOrder1?.status).toBe('CANCELED');
    expect(updatedOrder1?.error).toContain('Оплата не поступила в течение 24ч');

    expect(updatedOrder2?.status).toBe('CANCELED');
    expect(updatedOrder2?.error).toContain('Оплата не поступила в течение 24ч');
  });

  it('regression guard: does NOT cancel already activated PENDING orders under the same paymentId', async () => {
    const staleDate = new Date(Date.now() - 25 * 60 * 60 * 1000);

    const payment = await db.payment.create({
      data: {
        userId: testUserId,
        amount: 100,
        currency: 'RUB',
        gateway: 'robokassa',
        status: 'PENDING',
        createdAt: staleDate,
        updatedAt: staleDate
      }
    });
    testPaymentId = payment.id;

    const activatedOrder = await db.order.create({
      data: {
        userId: testUserId,
        serviceId: testServiceId,
        link: 'https://example.com/post/active',
        quantity: 100,
        charge: 100,
        providerCost: BigInt(20),
        status: 'PENDING', // Already activated
        paymentId: payment.id,
        numericId: Math.floor(Math.random() * 1000000),
        createdAt: staleDate,
        updatedAt: staleDate
      }
    });

    await paymentSyncProcessor({ name: 'payment-sync' } as Job);

    const dbOrder = await db.order.findUnique({ where: { id: activatedOrder.id } });
    expect(dbOrder?.status).toBe('PENDING'); // Must remain PENDING!
  });
});
