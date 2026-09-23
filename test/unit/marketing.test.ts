import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { marketingService } from '@/services/marketing.service';
import { db } from '@/lib/db';

describe('Financial Core: Marketing Service', () => {
  let testServiceId: string;
  let highMarkupServiceId: string;
  let testUserId: string;
  let testCategoryId: string;

  beforeEach(async () => {
    // Чистим остаточные тестовые данные
    await db.promoCode.deleteMany({ where: { code: 'SALE50' } });
    await db.user.deleteMany({ where: { email: 'test-marketing@example.com' } });

    const category = await db.category.create({
      data: {
        name: `Test Category ${Date.now()}`,
        sort: 0
      }
    });
    testCategoryId = category.id;

    // 1. Стандартная услуга с markup: 5.0 (при скидке срабатывает Safety Floor)
    const service = await db.service.create({
      data: {
        name: 'Test Service Standard',
        externalId: `ext-std-${Date.now()}-${Math.random()}`,
        rate: 5.0, // Base provider cost is $5.00 per 1000 = 47500 Cents
        minQty: 10,
        maxQty: 1000,
        markup: 5.0,
        isActive: true,
        categoryId: testCategoryId
      }
    });
    testServiceId = service.id;

    // 2. Высокомаржинальная услуга с markup: 10.0 (скидка 30% не упирается в Safety Floor)
    const highMarkupService = await db.service.create({
      data: {
        name: 'Test Service High Margin',
        externalId: `ext-high-${Date.now()}-${Math.random()}`,
        rate: 5.0, // Base provider cost is $5.00 per 1000 = 47500 Cents
        minQty: 10,
        maxQty: 1000,
        markup: 10.0,
        isActive: true,
        categoryId: testCategoryId
      }
    });
    highMarkupServiceId = highMarkupService.id;

    const user = await db.user.create({
      data: { email: 'test-marketing@example.com', role: 'USER' }
    });
    testUserId = user.id;

    await db.promoCode.create({
      data: {
        code: 'SALE50',
        discountPercent: 50.0,
        uses: 0,
        maxUses: 100,
        expiresAt: new Date(Date.now() + 86400000), // tomorrow
        isActive: true
      }
    });
  });

  afterEach(async () => {
    await db.promoCode.deleteMany({ where: { code: 'SALE50' } });
    if (testServiceId) await db.service.deleteMany({ where: { id: testServiceId } });
    if (highMarkupServiceId) await db.service.deleteMany({ where: { id: highMarkupServiceId } });
    if (testCategoryId) await db.category.deleteMany({ where: { id: testCategoryId } });
    if (testUserId) await db.user.deleteMany({ where: { id: testUserId } });
  });

  it('Calculates base price correctly without discounts', async () => {
    const result = await marketingService.calculatePrice(null, testServiceId, 1000);
    
    expect(result.providerCostCents).toBe(47500); // 475.00 RUB
    expect(result.originalTotalCents).toBe(240000); // 2400.00 RUB (beautiful retail)
    expect(result.totalCents).toBe(240000); 
  });

  it('Applies standard 50% promo code capped by Safety Floor for low-markup service', async () => {
    const result = await marketingService.calculatePrice(null, testServiceId, 1000, 'SALE50');
    
    expect(result.originalTotalCents).toBe(240000);
    // Защита Safety Floor (не продавать ниже себестоимости с учетом налогов): totalCents = 222223
    expect(result.safetyFloorCents).toBe(222223);
    expect(result.totalCents).toBe(222223);
    expect(result.discountCents).toBe(17777);
  });

  it('Applies MAX_TOTAL_DISCOUNT cap (30%) for high-margin service', async () => {
    const result = await marketingService.calculatePrice(null, highMarkupServiceId, 1000, 'SALE50');
    
    expect(result.originalTotalCents).toBe(480000);
    // 50% promo code ограничен потолком MAX_TOTAL_DISCOUNT = 30% -> скидка 144000
    expect(result.discountCents).toBe(144000);
    expect(result.totalCents).toBe(336000);
    expect(result.discountPercent).toBe(30);
  });

  it('Calculates fractions correctly (e.g. quantity 50)', async () => {
    const result = await marketingService.calculatePrice(null, testServiceId, 50);
    
    expect(result.providerCostCents).toBe(2375);
    expect(result.originalTotalCents).toBe(12000);
    expect(result.totalCents).toBe(12000);
  });
});
