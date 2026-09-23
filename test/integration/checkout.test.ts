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
import { db } from '@/lib/db';
import { redis } from '@/lib/redis';
import { calculatePriceAction, checkoutAction } from '@/actions/order/checkout';
import { revalidateTag } from 'next/cache';

describe('Server Actions: Checkout Integration', () => {
  let service: Service;

  beforeEach(async () => {
    // Relying on global setup to TRUNCATE DB
    
    // Enable test mode in DB so it doesn't crash on Payment Gateways
    await db.systemSettings.upsert({
      where: { id: 'smmplan' },
      create: { id: 'smmplan', isTestMode: true },
      update: { isTestMode: true }
    });
    await db.systemSettings.upsert({
      where: { id: 'global' },
      create: { id: 'global', isTestMode: true },
      update: { isTestMode: true }
    });
    await db.systemSettings.updateMany({
      data: {
        isTestMode: true,
        yookassaShopId: null,
        yookassaSecretKey: null,
        yookassaTestShopId: null,
        yookassaTestSecretKey: null,
        cryptoBotToken: null,
        robokassaLogin: null,
        robokassaPassword: null,
        robokassaWebhookPassword: null
      }
    });
    (revalidateTag as any)('settings');
    // Wipe out rate limit from previous runs or other loops
    await db.rateLimit.deleteMany();
    // Also wipe out from Redis!
    if (redis.status === 'ready') {
      await redis.del('ratelimit:checkoutCore:127.0.0.1');
    }

    const category = await db.category.create({
      data: { name: 'Action Testing' }
    });

    service = await db.service.create({
      data: {
        name: 'Organic Followers',
        categoryId: category.id,
        rate: 50 / 95, // scale to 50 RUB 
        markup: 3, // total price 150 RUB per 1k = 15000 cents
        minQty: 100,
        maxQty: 5000,
        isActive: true,
        externalId: 'ext_777'
      }
    });
  });

  it('Calculates correct preview price (calculatePriceAction)', async () => {
    // 500 followers with Safety Floor 3.0 = 11696 cents
    const res = await calculatePriceAction(service.id, 500);
    expect(res.success).toBe(true);
    expect(res.data?.totalCents).toBe(11696);
  });

  it('Creates order transaction and returns mock url (checkoutAction)', async () => {
    const res = await checkoutAction({
      serviceId: service.id,
      link: 'https://mysite.com',
      quantity: 500,
      email: 'buyer@example.com',
      gateway: 'yookassa'
    });

    expect(res.success).toBe(true);
    if (!res.success) throw new Error(res.error);
    if (res.success) {
      expect(res.data.paymentUrl).toContain('/api/dev/mock-payment');
    }
    
    // Check DB
    const orderInDb = await db.order.findFirst({ where: { email: 'buyer@example.com' } });
    expect(orderInDb).toBeDefined();
    expect(orderInDb?.status).toBe('AWAITING_PAYMENT');
    expect(orderInDb?.charge).toBe(11696n);
    expect(orderInDb?.providerCost).toBe(2500n); // 500 * (50/1000) = 25 RUB = 2500 cents
  });

  it('Refuses to create order out of bounds', async () => {
    const res = await checkoutAction({
      serviceId: service.id,
      link: 'https://mysite.com',
      quantity: 5, // < minQty 100
      email: 'buyer@example.com',
      gateway: 'yookassa'
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain('Количество должно быть от'); 
    }
  });

  it('Creates order transaction with cryptobot gateway', async () => {
    const res = await checkoutAction({
      serviceId: service.id,
      link: 'https://mysite.com',
      quantity: 500,
      email: 'buyer_crypto@example.com',
      gateway: 'cryptobot'
    });

    expect(res.success).toBe(true);
    if (!res.success) throw new Error(res.error);
    if (res.success) {
      expect(res.data.paymentUrl).toContain('/api/dev/mock-payment');
    }
  });

  it('Triggers RateLimit after 15 fast checkouts', async () => {
    process.env.ENABLE_RATE_LIMIT_TEST = 'true';
    try {
      // 1 checkout was already done above, and it hits "checkoutCore" globally. Let's do 15 more to ensure 429.
      let blockedResponse;
      for (let i = 0; i < 16; i++) {
        const res = await checkoutAction({
          serviceId: service.id,
          link: 'https://site.com',
          quantity: 100, // min Qty
          email: `spammer${i}@test.com`,
          gateway: 'yookassa'
        });
        if (!res.success && res.error?.includes('Слишком много запросов. Попробуйте через минуту.')) {
          blockedResponse = res;
          break;
        }
      }
      expect(blockedResponse).toBeDefined();
      expect(blockedResponse?.success).toBe(false);
    } finally {
      delete process.env.ENABLE_RATE_LIMIT_TEST;
    }
  });

  it('Allows retrying failed/ERROR orders with the same idempotencyKey', async () => {
    const key = 'test_failed_retry_key_123';
    
    // First, let's create a guest user (passwordHash: null)
    const user = await db.user.create({
      data: { email: 'failed-retry@test.com', tenantId: 'smmplan' }
    });

    // First, let's create a failed order in the DB with the key
    const order = await db.order.create({
      data: {
        userId: user.id,
        serviceId: service.id,
        quantity: 100,
        link: 'https://test-failed.com',
        charge: 1500n,
        providerCost: 500n,
        status: 'ERROR',
        idempotencyKey: key,
        email: 'failed-retry@test.com'
      }
    });

    // Now, run checkoutAction using the SAME key
    const res = await checkoutAction({
      serviceId: service.id,
      link: 'https://test-failed.com',
      quantity: 100,
      email: 'failed-retry@test.com',
      gateway: 'yookassa',
      idempotencyKey: key
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.orderId).not.toBe(order.id);
    }

    // Verify old order's idempotency key was updated
    const oldOrder = await db.order.findUnique({
      where: { id: order.id }
    });
    expect(oldOrder?.idempotencyKey).toBe(`${key}_failed_${order.id}`);

    // Verify new order was created with the active key
    const newOrder = await db.order.findUnique({
      where: { idempotencyKey: key }
    });
    expect(newOrder).toBeDefined();
    expect(newOrder?.id).not.toBe(order.id);
  });
});
