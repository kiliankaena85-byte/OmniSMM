import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { db } from '@/lib/db';
import { checkoutAction } from '@/actions/order/checkout';

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Map([['user-agent', 'test-agent'], ['host', 'localhost:3000']])),
  cookies: vi.fn().mockReturnValue({
    get: vi.fn().mockReturnValue(null),
    set: vi.fn(),
  })
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: (cb: any) => cb,
}));

vi.mock('@/services/core/rate-limit.service', () => ({
  RateLimitService: {
    check: vi.fn().mockResolvedValue(true),
  }
}));

let mockUserId = '';

vi.mock('@/lib/session', () => ({
  verifySession: vi.fn().mockImplementation(async () => {
    return { userId: mockUserId };
  }),
  createSession: vi.fn(),
  deleteSession: vi.fn()
}));

describe('Server Actions: MediaGroup Order Checkout Integration Flow', () => {
  let user: any;
  let service: any;
  let network: any;
  let category: any;
  let provider: any;

  beforeEach(async () => {
    // 1. Enable test mode in DB so it doesn't crash on Payment Gateways
    await db.systemSettings.update({
      where: { id: 'global' },
      data: { isTestMode: true }
    });

    // 2. Setup User
    user = await db.user.create({
      data: {
        email: 'client-mediagroup@smmplan.test',
        balance: 50000, // 500 RUB = 50000 cents
        role: 'USER',
      }
    });
    mockUserId = user.id;

    // 3. Setup network and category
    network = await db.network.create({
      data: { name: 'Telegram', slug: 'telegram', isActive: true, icon: 'telegram' }
    });

    category = await db.category.create({
      data: { name: 'Просмотры', networkId: network.id }
    });

    provider = await db.provider.create({
      data: { name: 'Cheap-SMM Provider', apiUrl: 'https://cheap-smm.com/api', apiKey: 'testkey' }
    });

    // 4. Setup Telegram Views Service
    service = await db.service.create({
      data: {
        categoryId: category.id,
        name: '[Cheap-SMM] Просмотры — Super Fast ⚡',
        providerId: provider.id,
        externalId: 'ext_views_123',
        isActive: true,
        isDripFeedEnabled: false,
        minQty: 10,
        maxQty: 50000,
        rate: 45 / 95, // scale to 45 RUB per 1k provider rate scaled by exchange rate (95)
        markup: 2, // 200% markup (customer price = 90 RUB per 1k)
        targetType: 'POST',
        isMediaGroupAware: false
      }
    });
  });

  afterAll(async () => {
    // Cleanup
    await db.order.deleteMany();
    await db.payment.deleteMany();
    await db.ledgerEntry.deleteMany();
    await db.user.deleteMany();
    await db.service.deleteMany();
    await db.category.deleteMany();
    await db.network.deleteMany();
    await db.provider.deleteMany();
  });

  it('Creates exactly 1 order successfully when mediaGroupUrl is NOT provided', async () => {
    const res = await checkoutAction({
      serviceId: service.id,
      link: 'https://t.me/durov/248',
      quantity: 1000,
      email: user.email,
      gateway: 'yookassa'
    });

    expect(res.success).toBe(true);
    if (!res.success) throw new Error(res.error);

    const paymentId = res.data.paymentId;
    expect(paymentId).toBeDefined();

    // Confirm only 1 order exists in database linked to this payment
    const orders = await db.order.findMany({ where: { paymentId } });
    expect(orders.length).toBe(1);
    expect(orders[0].link).toBe('https://t.me/durov/248');
    expect(orders[0].charge).toBe(21053n); // Safety Floor 3.0
  });

  it('Successfully splits order into two separate orders when mediaGroupUrl IS provided', async () => {
    const mainLink = 'https://t.me/durov/248';
    const secondaryLink = 'https://t.me/durov/250';

    const res = await checkoutAction({
      serviceId: service.id,
      link: mainLink,
      mediaGroupUrl: secondaryLink,
      quantity: 1000,
      email: user.email,
      gateway: 'yookassa'
    });

    expect(res.success).toBe(true);
    if (!res.success) throw new Error(res.error);

    const paymentId = res.data.paymentId;
    expect(paymentId).toBeDefined();
    if (!paymentId) throw new Error('paymentId is undefined');

    // Confirm that exactly 2 orders were created
    const orders = await db.order.findMany({
      where: { paymentId },
      orderBy: { createdAt: 'asc' }
    });
    expect(orders.length).toBe(2);

    const [order1, order2] = orders;

    // Check primary order
    expect(order1.link).toBe(mainLink);
    expect(order1.charge).toBe(21053n);
    expect(order1.customData).toBeNull();

    // Check secondary order
    expect(order2.link).toBe(secondaryLink);
    expect(order2.charge).toBe(21053n);
    expect(order2.customData).toContain('Медиагруппа: последнее медиа. Основной заказ:');

    // Confirm payment total amount is doubled (21053 * 2 = 42106 cents)
    const payment = await db.payment.findUnique({ where: { id: paymentId } });
    expect(payment).toBeDefined();
    expect(payment?.amount).toBe(42106n);
  });

  it('Fails checkout when secondary mediaGroupUrl is an invalid Telegram link', async () => {
    const res = await checkoutAction({
      serviceId: service.id,
      link: 'https://t.me/durov/248',
      mediaGroupUrl: 'https://invalid-link.com/post', // Invalid for Telegram
      quantity: 1000,
      email: user.email,
      gateway: 'yookassa'
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain('Некорректная ссылка на последнее медиа');
    }
  });

  it('Fails balance checkout if balance is not enough to cover the double charge', async () => {
    // 1. Create a user with limited balance (100 RUB = 10000 cents)
    const poorUser = await db.user.create({
      data: {
        email: 'poor-tester@smmplan.test',
        balance: 10000, // 100 RUB
        role: 'USER',
      }
    });
    mockUserId = poorUser.id;

    // 2. Perform MediaGroup checkout (90 RUB * 2 = 180 RUB, which exceeds 100 RUB balance)
    const mainLink = 'https://t.me/durov/248';
    const secondaryLink = 'https://t.me/durov/250';

    const res = await checkoutAction({
      serviceId: service.id,
      link: mainLink,
      mediaGroupUrl: secondaryLink,
      quantity: 1000,
      email: poorUser.email,
      gateway: 'balance'
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain('Недостаточно средств на балансе. Пожалуйста, пополните счет.');
    }
  });
});
