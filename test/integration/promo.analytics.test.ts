import { describe, it, expect, vi } from 'vitest';
import { db } from '../../src/lib/db';
import { adminMarketingService } from '../../src/services/admin/marketing.service';
import { logPromoCodeUsageIfNeeded } from '../../src/services/marketing-utils';

describe('Smmplan Ads Analytics Module Tests', () => {
  it('should create promo codes with UTM tags, budget, isSuspicious and map BigInt values to number in listPromoCodes', async () => {
    const codeStr = 'ADS_ANALYTICS_' + Date.now();
    const expiresAt = new Date(Date.now() + 86400000);

    const promo = await adminMarketingService.createPromoCode({
      code: codeStr,
      type: 'DISCOUNT',
      discountPercent: 10,
      maxUses: 100,
      expiresAt,
      description: 'UTM Campiagn Test',
      utmSource: 'telegram',
      utmMedium: 'cpc',
      utmCampaign: 'test_campaign',
      budgetCents: 15000, // 150.00 RUB
      isSuspicious: true,
    });

    expect(promo).toBeDefined();
    expect(promo.code).toBe(codeStr);
    expect(promo.description).toBe('UTM Campiagn Test');
    expect(promo.utmSource).toBe('telegram');
    expect(promo.utmMedium).toBe('cpc');
    expect(promo.utmCampaign).toBe('test_campaign');
    expect(promo.budgetCents).toBe(15000);
    expect(promo.isSuspicious).toBe(true);

    // Verify listPromoCodes mapping
    const list = await adminMarketingService.listPromoCodes();
    const found = list.find((p) => p.id === promo.id);
    expect(found).toBeDefined();
    expect(found?.isSuspicious).toBe(true);
    expect(found?.usages).toBeDefined();

    // Clean up
    await db.promoCode.delete({ where: { id: promo.id } });
  });

  it('should atomically log PromoCodeUsage with mapped numeric cents inside payment transaction', async () => {
    const userId = 'test_analytics_user_' + Date.now();
    const codeStr = 'ATOMIC_LOG_' + Date.now();

    // Setup user
    await db.user.create({
      data: {
        id: userId,
        email: `${userId}@example.com`,
        balance: 10000,
        role: 'USER',
      },
    });

    // Setup PromoCode
    const promo = await db.promoCode.create({
      data: {
        code: codeStr,
        type: 'DISCOUNT',
        discountPercent: 15,
        maxUses: 50,
        uses: 1,
        isActive: true,
        isSuspicious: false,
        budgetCents: 5000,
      },
    });

    // Setup Service, Category, Provider
    const provider = await db.provider.create({
      data: { name: 'Test Provider', apiUrl: 'http://test', apiKey: 'test' },
    });
    const category = await db.category.create({
      data: { name: 'Test Category' },
    });
    const service = await db.service.create({
      data: {
        categoryId: category.id,
        name: 'Test Service',
        providerId: provider.id,
        externalId: 'ext-abc',
        rate: 1.0,
        pricePer1000Cents: 2000,
        minQty: 10,
        maxQty: 1000,
        isActive: true,
        targetType: 'POST',
      },
    });

    // Create Order with promo code
    const order = await db.order.create({
      data: {
        userId,
        serviceId: service.id,
        quantity: 100,
        link: 'https://instagram.com/p/123',
        status: 'AWAITING_PAYMENT',
        charge: 200, // 2.00 RUB
        providerCost: 100, // 1.00 RUB margin
        discountCents: 30, // 15% of 200
        promoCodeId: promo.id,
      },
    });

    // Simulating transaction execution of logPromoCodeUsageIfNeeded
    await db.$transaction(async (tx) => {
      await logPromoCodeUsageIfNeeded(tx, order.id, userId);
    });

    // Assert PromoCodeUsage creation
    const usage = await db.promoCodeUsage.findUnique({
      where: { orderId: order.id },
    });

    expect(usage).toBeDefined();
    expect(usage?.promoCodeId).toBe(promo.id);
    expect(usage?.userId).toBe(userId);
    expect(usage?.discountCents).toBe(30n);
    expect(usage?.revenueCents).toBe(200n);
    expect(usage?.profitCents).toBe(100n);
    expect(usage?.isSuspicious).toBe(false);

    // Assert mapped analytics fields from listPromoCodes
    const list = await adminMarketingService.listPromoCodes();
    const promoWithUsages = list.find((p) => p.id === promo.id);
    expect(promoWithUsages).toBeDefined();
    expect(promoWithUsages?.usages.length).toBe(1);
    
    const mappedUsage = promoWithUsages?.usages[0];
    expect(typeof mappedUsage?.discountCents).toBe('number');
    expect(typeof mappedUsage?.revenueCents).toBe('number');
    expect(typeof mappedUsage?.profitCents).toBe('number');
    expect(mappedUsage?.discountCents).toBe(30);
    expect(mappedUsage?.revenueCents).toBe(200);
    expect(mappedUsage?.profitCents).toBe(100);

    // Clean up
    await db.promoCodeUsage.delete({ where: { orderId: order.id } });
    await db.order.delete({ where: { id: order.id } });
    await db.service.delete({ where: { id: service.id } });
    await db.category.delete({ where: { id: category.id } });
    await db.provider.delete({ where: { id: provider.id } });
    await db.promoCode.delete({ where: { id: promo.id } });
    await db.user.delete({ where: { id: userId } });
  });
});
