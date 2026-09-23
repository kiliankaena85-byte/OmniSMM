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


describe('M5 & M2 Bugs Integration Test', () => {
  let user: any;
  let serviceNoDrip: any;
  let network: any;
  let category: any;
  
  beforeEach(async () => {
    // Setup User with small balance (1000 cents = 10 RUB)
    user = await db.user.create({
      data: {
        email: 'tester-m5-m2@test.com',
        balance: 1000,
        role: 'USER',
      }
    });
    mockUserId = user.id;

    // Setup network and category
    network = await db.network.create({
      data: { name: 'TestNet', slug: 'testnet', isActive: true, icon: 'test' }
    });
    
    category = await db.category.create({
      data: { name: 'TestCat', network: { connect: { id: network.id } } }
    });

    const provider = await db.provider.create({
      data: { name: 'Test Provider', apiUrl: 'https://test.com/api', apiKey: 'test' }
    });

    // Setup service that DOES NOT support dripFeed
    serviceNoDrip = await db.service.create({
      data: {
        categoryId: category.id,
        name: 'Service No Drip',
        providerId: provider.id,
        externalId: 'ext-1',
        isActive: true,
        isDripFeedEnabled: false, // Explicitly false
        minQty: 10,
        maxQty: 1000,
        rate: 50, // 50 rubles per 1000
      }
    });
  });

  afterAll(async () => {
    await db.order.deleteMany();
    await db.payment.deleteMany();
    await db.ledgerEntry.deleteMany();
    await db.user.deleteMany();
    await db.service.deleteMany();
    await db.category.deleteMany();
    await db.network.deleteMany();
  });

  it('M5: Should reject checkout if runs are provided but service does not support DripFeed', async () => {
    const res = await checkoutAction({
      serviceId: serviceNoDrip.id,
      link: 'https://testnet.com/test1',
      quantity: 10,
      email: user.email,
      runs: 2,       // User forces runs somehow (e.g. state bug)
      interval: 5,   // User forces interval
      gateway: 'balance'
    });

    console.log(res);
    const errorStr = JSON.stringify(res);
    expect(errorStr).toContain('Эта услуга не поддерживает Drip-feed (постепенную подачу)');
  });

  it('M2: Should return human-readable Insufficient Funds error instead of raw cents', async () => {
    // Force a price that exceeds balance (rate 50 RUB/1000 means 500 RUB = 50000 cents for 10000 quantity)
    // Balance is 1000 cents.
    const res = await checkoutAction({
      serviceId: serviceNoDrip.id,
      link: 'https://testnet.com/test2',
      quantity: 1000,
      email: user.email,
      gateway: 'balance'
    });
    console.log(res);
    const errorStr = JSON.stringify(res);
    // Assert: Action should fail
    expect(errorStr).toContain('Недостаточно средств на балансе. Пожалуйста, пополните счет.');
    expect(errorStr).not.toContain('got 1000');
    expect(errorStr).not.toContain('Insufficient funds');
  });
});
