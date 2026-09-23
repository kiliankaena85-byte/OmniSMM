import { describe, it, expect, beforeEach, vi } from 'vitest';
import { type Service } from '@prisma/client';

const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

const mockHeadersStore = new Headers({
  'x-forwarded-for': '127.0.0.1',
  'user-agent': 'vitest',
});

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => mockHeadersStore),
  cookies: vi.fn(async () => mockCookieStore),
}));

// Mock PaymentGatewayFactory so that createPayment always fails (simulating gateway timeout/crash)
vi.mock('@/services/financial/payment-gateway.service', () => ({
  PaymentGatewayFactory: {
    getGateway: vi.fn(() => ({
      createPayment: vi.fn().mockRejectedValue(new Error('YooKassa timeout / gateway error')),
    })),
  },
}));

import { db } from '@/lib/db';
import { redis } from '@/lib/redis';
import { checkoutAction, calculatePriceAction } from '@/actions/order/checkout';
import { RateLimitService } from '@/services/core/rate-limit.service';

describe('D0.1: Checkout Gateway Error Rollback', () => {
  let service: Service;

  beforeEach(async () => {
    // Wipe rate limits
    await db.rateLimit.deleteMany();
    if (redis.status === 'ready') {
      await redis.del('ratelimit:checkoutCore:127.0.0.1');
    }

    const network = await db.network.upsert({
      where: { name: 'Telegram' },
      create: { name: 'Telegram', slug: 'telegram' },
      update: {},
    });

    const category = await db.category.create({
      data: { name: 'Rollback Test Category', networkId: network.id }
    });

    service = await db.service.create({
      data: {
        name: 'TG Post Views with MediaGroup',
        categoryId: category.id,
        rate: 50 / 95,
        markup: 3,
        minQty: 10,
        maxQty: 5000,
        isActive: true,
        isMediaGroupAware: false, // will trigger split when mediaGroupUrl is provided
        targetType: 'POST',
        externalId: 'ext_777',
      }
    });
  });

  it('rolls back single order to ERROR and payment to CANCELED when gateway fails', async () => {
    const res = await checkoutAction({
      serviceId: service.id,
      link: 'https://t.me/channel_name/100',
      quantity: 50,
      email: 'single-order-rollback@example.com',
      gateway: 'yookassa',
    });

    // Checkout should report failure because gateway threw
    expect(res.success).toBe(false);

    // Verify orders and payments in DB
    const user = await db.user.findFirst({
      where: { email: 'single-order-rollback@example.com' }
    });
    expect(user).toBeDefined();

    const orders = await db.order.findMany({
      where: { userId: user!.id }
    });
    expect(orders.length).toBe(1);
    expect(orders[0].status).toBe('ERROR');
    expect(orders[0].error).toContain('YooKassa timeout');

    const payment = await db.payment.findUnique({
      where: { id: orders[0].paymentId! }
    });
    expect(payment).toBeDefined();
    expect(payment?.status).toBe('CANCELED');
  });

  it('rolls back BOTH mediaGroup orders to ERROR and payment to CANCELED when gateway fails (CHK-01)', async () => {
    const res = await checkoutAction({
      serviceId: service.id,
      link: 'https://t.me/channel_name/100',
      mediaGroupUrl: 'https://t.me/channel_name/101',
      quantity: 50,
      email: 'mediagroup-rollback@example.com',
      gateway: 'yookassa',
    });

    expect(res.success).toBe(false);

    const user = await db.user.findFirst({
      where: { email: 'mediagroup-rollback@example.com' }
    });
    expect(user).toBeDefined();

    const orders = await db.order.findMany({
      where: { userId: user!.id }
    });

    // Both orders in the media group must be created and marked as ERROR
    expect(orders.length).toBe(2);
    expect(orders[0].status).toBe('ERROR');
    expect(orders[1].status).toBe('ERROR');
    expect(orders[0].paymentId).toBe(orders[1].paymentId);

    const payment = await db.payment.findUnique({
      where: { id: orders[0].paymentId! }
    });
    expect(payment).toBeDefined();
    expect(payment?.status).toBe('CANCELED');
  });

  it('enforces rate limit on calculatePriceAction (CHK-05)', async () => {
    // 1. First call succeeds
    const res1 = await calculatePriceAction(service.id, 100);
    expect(res1.success).toBe(true);
    expect(res1.data?.totalCents).toBeDefined();

    // 2. Mock RateLimitService.check to return false (rate limited)
    const spy = vi.spyOn(RateLimitService, 'check').mockResolvedValueOnce(false);

    const res2 = await calculatePriceAction(service.id, 100);
    expect(res2.success).toBe(false);
    expect(res2.error).toContain('Слишком много запросов');
    expect(spy).toHaveBeenCalledWith('priceCalc', 60, 60, true);

    spy.mockRestore();
  });
});
