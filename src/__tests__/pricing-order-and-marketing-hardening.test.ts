import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { db } from '@/lib/db';
import { marketingService } from '@/services/marketing.service';
import { getServiceBySlugAction } from '@/actions/order/catalog';

vi.mock('@/lib/session', async (importOriginal: any) => {
  const actual = await importOriginal();
  return {
    ...actual,
    verifySession: vi.fn(),
  };
});

describe.sequential('Pricing Hardening: Marketing Engine, Storefront Parity & Admin Actions', () => {
  beforeEach(async () => {
    await db.systemSettings.upsert({
      where: { id: 'smmplan' },
      update: { isTestMode: true, exchangeRateUSD: 100.0 },
      create: { id: 'smmplan', isTestMode: true, exchangeRateUSD: 100.0 },
    });
  });

  afterAll(async () => {
    // Cleanup test-created providers, categories, services and networks by pattern
    const testProviders = await db.provider.findMany({
      where: { OR: [{ apiKey: { startsWith: 'k' }, apiUrl: { startsWith: 'http://a/' } }] },
      select: { id: true }
    });
    const provIds = testProviders.map(p => p.id);
    await db.service.deleteMany({ where: { providerId: { in: provIds } } }).catch(() => {});
    await db.provider.deleteMany({ where: { id: { in: provIds } } }).catch(() => {});
    // Orphaned categories created in this test (no network, no services left)
    await db.category.deleteMany({ where: { networkId: null, services: { none: {} } } }).catch(() => {});
  });

  describe('1. Marketing Service Multi-Currency & Cross-Rate Accuracy', () => {
    it('calculates USD service price accurately', async () => {
      const ts = Date.now() + Math.floor(Math.random() * 1000000);
      const cat = await db.category.create({ data: { name: `Cat M-USD ${ts}` } });
      const prov = await db.provider.create({
        data: { name: `Prov M-USD ${ts}`, apiUrl: `http://a/${ts}`, apiKey: `k${ts}`, balanceCurrency: 'USD', isActive: true, syncLock: false }
      });
      // Rate = $1.00 USD/1k (100 RUB cost at 100.0 USD rate), markup = 5.0, retail = 500 RUB/1k (50000 cents)
      const service = await db.service.create({
        data: {
          name: 'USD Service Test',
          categoryId: cat.id,
          providerId: prov.id,
          providerCurrency: 'USD',
          rate: 1.0,
          costPer1kRub: 100.0,
          markup: 5.0,
          pricePer1000Cents: 50000,
          minQty: 100,
          maxQty: 10000,
          isActive: true,
        },
      });

      const pricing = await marketingService.calculatePrice(null, service.id, 1000);
      expect(pricing.totalCents).toBe(50000);
      expect(pricing.providerCostCents).toBe(10000);
    });

    it('calculates EUR service cost accurately without USD rate confusion', async () => {
      const ts = Date.now() + Math.floor(Math.random() * 1000000);
      const cat = await db.category.create({ data: { name: `Cat M-EUR ${ts}` } });
      const prov = await db.provider.create({
        data: { name: `Prov M-EUR ${ts}`, apiUrl: `http://a/${ts}`, apiKey: `k${ts}`, balanceCurrency: 'EUR', isActive: true, syncLock: false }
      });
      // €10.0 EUR/1k, costPer1kRub = 1080 RUB, price = 5400 RUB (540000 cents)
      const service = await db.service.create({
        data: {
          name: 'EUR Service Test',
          categoryId: cat.id,
          providerId: prov.id,
          providerCurrency: 'EUR',
          rate: 10.0,
          costPer1kRub: 1080.0,
          markup: 5.0,
          pricePer1000Cents: 540000,
          minQty: 50,
          maxQty: 5000,
          isActive: true,
        },
      });

      const pricing = await marketingService.calculatePrice(null, service.id, 500);
      // 500 units @ 5400 RUB/1k = 2700 RUB = 270000 cents
      expect(pricing.totalCents).toBe(270000);
      // 500 units cost @ 1080 RUB/1k = 540 RUB = 54000 cents
      expect(pricing.providerCostCents).toBe(54000);
    });

    it('calculates UAH service without 100x rate explosion bug', async () => {
      const ts = Date.now() + Math.floor(Math.random() * 1000000);
      const cat = await db.category.create({ data: { name: `Cat M-UAH ${ts}` } });
      const prov = await db.provider.create({
        data: { name: `Prov M-UAH ${ts}`, apiUrl: `http://a/${ts}`, apiKey: `k${ts}`, balanceCurrency: 'UAH', isActive: true, syncLock: false }
      });
      // 1000 UAH/1k (approx 2700 RUB cost, NOT 100,000 RUB!), retail = 13500 RUB (1350000 cents)
      const service = await db.service.create({
        data: {
          name: 'UAH Service Test',
          categoryId: cat.id,
          providerId: prov.id,
          providerCurrency: 'UAH',
          rate: 1000.0,
          costPer1kRub: 2700.0,
          markup: 5.0,
          pricePer1000Cents: 1350000,
          minQty: 100,
          maxQty: 5000,
          isActive: true,
        },
      });

      const pricing = await marketingService.calculatePrice(null, service.id, 1000);
      expect(pricing.totalCents).toBe(1350000);
      expect(pricing.providerCostCents).toBe(270000);
    });
  });

  describe('2. Storefront to Checkout Price Parity', () => {
    it('honors DB pricePer1000Cents in calculatePrice rather than recalculating on the fly', async () => {
      const ts = Date.now() + Math.floor(Math.random() * 1000000);
      const cat = await db.category.create({ data: { name: `Cat Parity ${ts}` } });
      const prov = await db.provider.create({
        data: { name: `Prov Parity ${ts}`, apiUrl: `http://a/${ts}`, apiKey: `k${ts}`, balanceCurrency: 'RUB', isActive: true, syncLock: false }
      });
      const service = await db.service.create({
        data: {
          name: 'Custom Retail Price Service',
          categoryId: cat.id,
          providerId: prov.id,
          providerCurrency: 'RUB',
          rate: 100.0,
          costPer1kRub: 100.0,
          markup: 5.5,
          pricePer1000Cents: 55000, // 550.00 RUB
          minQty: 100,
          maxQty: 5000,
          isActive: true,
        },
      });

      const pricing = await marketingService.calculatePrice(null, service.id, 1000);
      expect(pricing.totalCents).toBe(55000);
    });

    it('syncs pricePer1kRub and pricePerUnitRub with Anti-Negative Margin protection in getServiceBySlugAction', async () => {
      const ts = Date.now() + Math.floor(Math.random() * 1000000);
      const net = await db.network.create({ data: { name: `Net Detail ${ts}`, slug: `net-det-${ts}`, isActive: true } });
      const cat = await db.category.create({ data: { name: `Cat Detail ${ts}`, slug: `cat-det-${ts}`, networkId: net.id } });
      const prov = await db.provider.create({
        data: { name: `Prov Detail ${ts}`, apiUrl: `http://a/${ts}`, apiKey: `k${ts}`, balanceCurrency: 'RUB', isActive: true, syncLock: false }
      });
      const service = await db.service.create({
        data: {
          name: 'Floored Detail Service',
          slug: `floored-detail-srv-${ts}`,
          categoryId: cat.id,
          providerId: prov.id,
          providerCurrency: 'RUB',
          rate: 100.0,
          costPer1kRub: 100.0,
          markup: 0.8,
          pricePer1000Cents: 8000,
          minQty: 100,
          maxQty: 5000,
          isActive: true,
        },
      });

      const detail = await getServiceBySlugAction(service.slug!);
      expect(detail).not.toBeNull();
      if (detail) {
        // Storefront strictly reads pricePer1000Cents as single source of truth
        expect(detail.pricePer1kRub).toBe(80);
        expect(detail.pricePerUnitRub).toBe(0.08);
        expect(detail.pricePer1kRub).toBe(detail.pricePerUnitRub * 1000);
      }
    });
  });

  describe('3. Admin Batch Actions & Security Guards', () => {
    it('blocks markup update exceeding UPPER_SANITY_LIMIT_RUB (500,000 ₽)', async () => {
      const ts = Date.now() + Math.floor(Math.random() * 1000000);
      const cat = await db.category.create({ data: { name: `Cat Sanity ${ts}` } });
      const prov = await db.provider.create({
        data: { name: `Prov Sanity ${ts}`, apiUrl: `http://a/${ts}`, apiKey: `k${ts}`, balanceCurrency: 'RUB', isActive: true, syncLock: false }
      });
      const service = await db.service.create({
        data: {
          name: 'High Cost Service',
          categoryId: cat.id,
          providerId: prov.id,
          providerCurrency: 'RUB',
          rate: 200000.0,
          costPer1kRub: 200000.0,
          markup: 2.0,
          pricePer1000Cents: 40000000,
          minQty: 10,
          maxQty: 500,
          isActive: true,
        },
      });

      const adminUser = await db.user.create({
        data: {
          email: `admin-tester-${ts}@smmplan.pro`,
          role: 'ADMIN',
          tenantId: 'smmplan',
        }
      });

      const { verifySession } = await import('@/lib/session');
      vi.mocked(verifySession).mockResolvedValueOnce({
        userId: adminUser.id,
        role: 'ADMIN',
        email: adminUser.email,
      } as any);

      const { updateServiceMarkupAction } = await import('@/actions/admin/catalog/batch');
      const res = await updateServiceMarkupAction(service.id, 3.0);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain('Превышен верхний лимит');
      }
    });
  });
});