import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { calculatePriceAction, checkoutAction } from '@/actions/order/checkout';

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

vi.mock('@/lib/session', () => ({
  verifySession: vi.fn(async () => ({ userId: mockUserId, role: 'USER' })),
  createSession: vi.fn(),
}));

let mockUserId = '';
let mockUserEmail = '';

describe('D1.2: Promo Code Case Normalization (CHK-07)', () => {
  let serviceId: string;
  let categoryId: string;
  let providerId: string;
  let promoCodeName: string;

  beforeEach(async () => {
    // 1. Create User
    mockUserEmail = `promo-user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@smmplan.pro`;
    const user = await db.user.create({
      data: {
        email: mockUserEmail,
        role: 'USER',
        balance: 100_000, // 1000 RUB in cents
      }
    });
    mockUserId = user.id;

    // 2. Create Provider, Category & Service
    const provider = await db.provider.create({
      data: { name: `PromoProvider-${Date.now()}`, apiUrl: 'http://test.local', apiKey: 'test-key' }
    });
    const category = await db.category.create({
      data: { name: `PromoCat-${Date.now()}`, sort: 0 }
    });
    const service = await db.service.create({
      data: {
        name: `PromoSvc-${Date.now()}`,
        providerId: provider.id,
        externalId: '101',
        rate: 10,
        markup: 5.0,
        minQty: 10,
        maxQty: 1000,
        categoryId: category.id,
        targetType: 'CUSTOM',
        isActive: true,
      }
    });
    categoryId = category.id;
    providerId = provider.id;
    serviceId = service.id;
  });

  afterEach(async () => {
    try {
      if (mockUserId) {
        await db.ledgerEntry.deleteMany({ where: { userId: mockUserId } }).catch(() => {});
        await db.order.deleteMany({ where: { userId: mockUserId } }).catch(() => {});
        await db.user.deleteMany({ where: { id: mockUserId } }).catch(() => {});
      }
      if (promoCodeName) {
        await db.promoCode.deleteMany({ where: { code: promoCodeName } }).catch(() => {});
      }
      if (serviceId) await db.service.deleteMany({ where: { id: serviceId } }).catch(() => {});
      if (categoryId) await db.category.deleteMany({ where: { id: categoryId } }).catch(() => {});
      if (providerId) await db.provider.deleteMany({ where: { id: providerId } }).catch(() => {});
    } catch { /* ignore */ }
  });

  it('applies lowercase and mixed-case input to uppercase promo code in calculatePriceAction and checkoutAction', async () => {
    // 1. Create uppercase promo code
    const promoCode = `SALE10_${Date.now()}`;
    promoCodeName = promoCode;
    await db.promoCode.create({
      data: {
        code: promoCode,
        type: 'DISCOUNT',
        discountPercent: 10,
        maxUses: 100,
        uses: 0,
        isActive: true,
      }
    });

    // 2. Calculate price with lowercase input: 'sale10_...'
    const lowerCode = promoCode.toLowerCase();
    const priceRes = await calculatePriceAction(serviceId, 100, lowerCode);
    expect(priceRes.success).toBe(true);
    expect(priceRes.data).toBeDefined();
    expect(priceRes.data!.discountCents).toBeGreaterThan(0);
    expect(priceRes.data!.totalCents).toBeLessThan(priceRes.data!.originalTotalCents);

    // 3. Checkout with mixed-case input: 'Sale10_...'
    const mixedCode = promoCode.charAt(0).toUpperCase() + promoCode.slice(1).toLowerCase();
    const idempotencyKey = `promo-case-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const checkoutRes = await checkoutAction({
      serviceId,
      link: 'https://vk.com/wall-12345_67890',
      quantity: 100,
      email: mockUserEmail,
      promoCodeStr: mixedCode,
      gateway: 'balance',
      idempotencyKey,
      isRequirementsConfirmed: true,
    });

    expect(checkoutRes.success).toBe(true);
    if (checkoutRes.success) {
      expect(checkoutRes.data.orderId).toBeDefined();
    }

    // 4. Assert that promo uses counter was incremented
    const updatedPromo = await db.promoCode.findUnique({ where: { code: promoCode } });
    expect(updatedPromo?.uses).toBe(1);

    // 5. Non-existent promo code should not apply discount in calculatePriceAction
    const invalidPriceRes = await calculatePriceAction(serviceId, 100, 'NONEXISTENT_CODE_XYZ');
    expect(invalidPriceRes.success).toBe(true);
    expect(invalidPriceRes.data!.discountCents).toBe(0);
  });
});
