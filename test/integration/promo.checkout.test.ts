import { describe, it, expect, vi } from 'vitest';
import { db } from '../../src/lib/db';
import { checkoutAction } from '../../src/actions/order/checkout';

vi.mock('../../src/lib/session', () => ({
  verifySession: vi.fn(),
  createSession: vi.fn()
}));

vi.mock('../../src/services/core/rate-limit.service', () => ({
  RateLimitService: {
    check: vi.fn().mockResolvedValue(true),
    checkCustomKey: vi.fn().mockResolvedValue(true)
  }
}));

describe('Checkout Voucher Rejection', () => {
  it('should reject VOUCHER type in checkout without mutating balance or creating payment', async () => {
    const { verifySession } = await import('../../src/lib/session');
    
    const userId = 'test_checkout_user_' + Date.now();
    
    // Setup user
    await db.user.create({
      data: {
        id: userId,
        email: `${userId}@example.com`,
        balance: 5000,
        role: 'USER'
      }
    });

    const promoCodeStr = `VOUCHER_${Date.now()}`;
    const promo = await db.promoCode.create({
      data: {
        code: promoCodeStr,
        type: 'VOUCHER',
        amount: 1000,
        maxUses: 1,
        uses: 0,
        isActive: true,
        discountPercent: 0
      }
    });

    // Create dummy provider, category & service
    const provider = await db.provider.create({
      data: { name: 'Test Provider', apiUrl: 'http://test', apiKey: 'test' }
    });
    const category = await db.category.create({
      data: { name: 'Test Category' }
    });
    const service = await db.service.create({
      data: {
        categoryId: category.id,
        name: 'Test Service',
        providerId: provider.id,
        externalId: 'ext-123',
        rate: 1.0,
        pricePer1000Cents: 2000,
        minQty: 10,
        maxQty: 1000,
        isActive: true,
        targetType: 'POST'
      }
    });

    // Mock session
    vi.mocked(verifySession).mockResolvedValue({ userId, role: 'USER' } as any);

    const initialPayments = await db.payment.count({ where: { userId } });

    // Call checkoutAction
    const result = await checkoutAction({
      serviceId: service.id,
      link: 'https://instagram.com/p/test12345',
      quantity: 100,
      email: `${userId}@example.com`,
      promoCodeStr: promoCodeStr
    });

    expect(result.success).toBe(false);
    expect((result as any).error).toContain('VOUCHER_USE_BALANCE');

    const finalUser = await db.user.findUnique({ where: { id: userId } });
    const finalPayments = await db.payment.count({ where: { userId } });
    const finalPromo = await db.promoCode.findUnique({ where: { id: promo.id } });

    // Balance remains untouched
    expect(finalUser?.balance).toBe(5000n);
    // No new payment created
    expect(finalPayments).toBe(initialPayments);
    // Promo uses untouched
    expect(finalPromo?.uses).toBe(0);

    // Cleanup
    await db.service.delete({ where: { id: service.id } });
    await db.category.delete({ where: { id: category.id } });
    await db.provider.delete({ where: { id: provider.id } });
    await db.promoCode.delete({ where: { id: promo.id } });
    await db.user.delete({ where: { id: userId } });
  });

  it('should log PromoCodeUsage correctly with UTM details and budget tracking upon successful payment', async () => {
    const userId = 'test_analytics_user_' + Date.now();
    
    await db.user.create({
      data: {
        id: userId,
        email: `${userId}@example.com`,
        balance: 10000,
        role: 'USER'
      }
    });

    const promoCodeStr = `CAMPAIGN_${Date.now()}`;
    const promo = await db.promoCode.create({
      data: {
        code: promoCodeStr,
        type: 'DISCOUNT',
        discountPercent: 10,
        amount: 0,
        maxUses: 100,
        uses: 0,
        isActive: true,
        description: 'Black Friday Campaign',
        utmSource: 'telegram',
        utmMedium: 'cpc',
        utmCampaign: 'black_friday_2026',
        budgetCents: 50000,
        isSuspicious: true
      }
    });

    const provider = await db.provider.create({
      data: { name: 'Analytics Provider', apiUrl: 'http://test', apiKey: 'test' }
    });
    const category = await db.category.create({
      data: { name: 'Analytics Category' }
    });
    const service = await db.service.create({
      data: {
        categoryId: category.id,
        name: 'Analytics Service',
        providerId: provider.id,
        externalId: 'ext-456',
        rate: 1.0,
        markup: 6.0,
        minQty: 10,
        maxQty: 1000,
        isActive: true,
        targetType: 'POST'
      }
    });

    // Mock verifySession to return this user
    const { verifySession } = await import('../../src/lib/session');
    vi.mocked(verifySession).mockResolvedValue({ userId, role: 'USER' } as any);

    // Run checkoutAction with campaign discount promo code
    const checkoutResult = await checkoutAction({
      serviceId: service.id,
      link: 'https://instagram.com/p/test1234567/',
      quantity: 1000,
      email: `${userId}@example.com`,
      promoCodeStr: promoCodeStr
    });

    expect(checkoutResult.success).toBe(true);
    const orderId = (checkoutResult as any).data.orderId;

    // The order should have promoCodeId linked
    const order = await db.order.findUnique({
      where: { id: orderId }
    });
    expect(order?.promoCodeId).toBe(promo.id);
    expect(order?.discountCents).toBe(5700n); // 10% of 57000 cents is 5700 cents

    const { logPromoCodeUsageIfNeeded } = await import('../../src/services/marketing-utils');
    await db.$transaction(async (tx) => {
      await logPromoCodeUsageIfNeeded(tx, orderId, userId);
    });

    // Verify PromoCodeUsage record was created
    const usage = await db.promoCodeUsage.findFirst({
      where: { orderId }
    });
    expect(usage).toBeDefined();
    expect(usage?.promoCodeId).toBe(promo.id);
    expect(usage?.userId).toBe(userId);
    expect(usage?.discountCents).toBe(5700n);
    expect(usage?.revenueCents).toBe(51300n); // 57000 - 5700 discount = 51300 cents charged
    expect(usage?.isSuspicious).toBe(true); // Persists suspicious status from the PromoCode

    // Clean up
    await db.promoCodeUsage.deleteMany({ where: { promoCodeId: promo.id } });
    await db.order.deleteMany({ where: { userId } });
    await db.payment.deleteMany({ where: { userId } });
    await db.service.delete({ where: { id: service.id } });
    await db.category.delete({ where: { id: category.id } });
    await db.provider.delete({ where: { id: provider.id } });
    await db.promoCode.delete({ where: { id: promo.id } });
    await db.user.delete({ where: { id: userId } });
  });
});
