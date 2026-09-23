import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { db } from '@/lib/db';
import catalogProcessor from '@/workers/processors/catalog.processor';
import { UPPER_SANITY_LIMIT_RUB } from '@/lib/financial-constants';

vi.mock('@/lib/revalidate-cache', () => ({
  triggerCacheRevalidation: vi.fn().mockResolvedValue(true),
}));

describe.sequential('Price Reconciler Engine (P-D Unit Tests)', () => {
  beforeEach(async () => {
    await db.systemSettings.upsert({
      where: { id: 'smmplan' },
      update: { isTestMode: true, exchangeRateUSD: 100.0 },
      create: { id: 'smmplan', isTestMode: true, exchangeRateUSD: 100.0 },
    });
  });

  afterAll(async () => {
    // Cleanup: remove all test providers/categories/services created by this suite
    const testProviders = await db.provider.findMany({
      where: { apiUrl: { startsWith: 'http://a/' }, apiKey: { startsWith: 'k' } },
      select: { id: true }
    });
    const providerIds = testProviders.map(p => p.id);
    await db.service.deleteMany({ where: { providerId: { in: providerIds } } }).catch(() => {});
    await db.category.deleteMany({ where: { name: { startsWith: 'Cat ' }, services: { none: {} } } }).catch(() => {});
    await db.provider.deleteMany({ where: { id: { in: providerIds } } }).catch(() => {});
  });

  it('1. Updates costPer1kRub when cost drifts > 2% without changing retail price', async () => {
    const ts = Date.now() + Math.floor(Math.random() * 1000000);
    const cat = await db.category.create({ data: { name: `Cat 1 ${ts}` } });
    const prov = await db.provider.create({
      data: { name: `Prov 1 ${ts}`, apiUrl: `http://a/${ts}`, apiKey: `k${ts}`, balanceCurrency: 'RUB', isActive: true, syncLock: false }
    });

    const service = await db.service.create({
      data: {
        name: 'Drifting Cost Service',
        categoryId: cat.id,
        providerId: prov.id,
        providerCurrency: 'RUB',
        rate: 110.0,
        costPer1kRub: 100.0,
        markup: 3.0,
        pricePer1000Cents: 33000, // 330.00 RUB
        minQty: 10,
        maxQty: 1000,
        isActive: true,
        isQuarantined: false,
      },
    });

    await catalogProcessor({
      id: `job-rec-1-${ts}`,
      data: { type: 'RECONCILE_PRICES', batchSize: 100 },
    } as any);

    const updated = await db.service.findUniqueOrThrow({ where: { id: service.id } });
    expect(updated.costPer1kRub).toBe(110.0); // Cost cache fixed to 110.0
    expect(updated.pricePer1000Cents).toBe(33000); // Retail UNCHANGED
    expect(updated.isActive).toBe(true);
    expect(updated.isQuarantined).toBe(false);
  });

  it('2. Quarantines service when retail price per 1k is below purchase cost (Loss Prevention)', async () => {
    const ts = Date.now() + Math.floor(Math.random() * 1000000);
    const cat = await db.category.create({ data: { name: `Cat 2 ${ts}` } });
    const prov = await db.provider.create({
      data: { name: `Prov 2 ${ts}`, apiUrl: `http://a/${ts}`, apiKey: `k${ts}`, balanceCurrency: 'RUB', isActive: true, syncLock: false }
    });

    const service = await db.service.create({
      data: {
        name: 'Loss Making Service',
        categoryId: cat.id,
        providerId: prov.id,
        providerCurrency: 'RUB',
        rate: 500.0,
        costPer1kRub: 500.0,
        markup: 0.6,
        pricePer1000Cents: 30000, // 300.00 RUB < 500.00 RUB cost
        minQty: 10,
        maxQty: 1000,
        isActive: true,
        isQuarantined: false,
      },
    });

    await catalogProcessor({
      id: `job-rec-2-${ts}`,
      data: { type: 'RECONCILE_PRICES', batchSize: 100 },
    } as any);

    const updated = await db.service.findUniqueOrThrow({ where: { id: service.id } });
    expect(updated.isQuarantined).toBe(true);
    expect(updated.isActive).toBe(false);
    expect(updated.quarantineReason).toContain('Loss Prevention');
  });

  it('3. Quarantines service when retail price exceeds UPPER_SANITY_LIMIT_RUB (500,000 ₽)', async () => {
    const ts = Date.now() + Math.floor(Math.random() * 1000000);
    const cat = await db.category.create({ data: { name: `Cat 3 ${ts}` } });
    const prov = await db.provider.create({
      data: { name: `Prov 3 ${ts}`, apiUrl: `http://a/${ts}`, apiKey: `k${ts}`, balanceCurrency: 'RUB', isActive: true, syncLock: false }
    });

    const service = await db.service.create({
      data: {
        name: 'Insane Price Service',
        categoryId: cat.id,
        providerId: prov.id,
        providerCurrency: 'RUB',
        rate: 200000.0,
        costPer1kRub: 200000.0,
        markup: 3.0,
        pricePer1000Cents: 60000000, // 600,000.00 RUB > 500,000 limit
        minQty: 10,
        maxQty: 1000,
        isActive: true,
        isQuarantined: false,
      },
    });

    await catalogProcessor({
      id: `job-rec-3-${ts}`,
      data: { type: 'RECONCILE_PRICES', batchSize: 100 },
    } as any);

    const updated = await db.service.findUniqueOrThrow({ where: { id: service.id } });
    expect(updated.isQuarantined).toBe(true);
    expect(updated.isActive).toBe(false);
    expect(updated.quarantineReason).toContain('Upper Sanity Limit Exceeded');
  });

  it('4. Quarantines service when provider currency is invalid', async () => {
    const ts = Date.now() + Math.floor(Math.random() * 1000000);
    const cat = await db.category.create({ data: { name: `Cat 4 ${ts}` } });
    const prov = await db.provider.create({
      data: { name: `Prov 4 ${ts}`, apiUrl: `http://a/${ts}`, apiKey: `k${ts}`, balanceCurrency: 'RUB', isActive: true, syncLock: false }
    });

    const service = await db.service.create({
      data: {
        name: 'Invalid Currency Service',
        categoryId: cat.id,
        providerId: prov.id,
        providerCurrency: 'UNKNOWN_CURR',
        rate: 100.0,
        costPer1kRub: 100.0,
        markup: 3.0,
        pricePer1000Cents: 30000,
        minQty: 10,
        maxQty: 1000,
        isActive: true,
        isQuarantined: false,
      },
    });

    await catalogProcessor({
      id: `job-rec-4-${ts}`,
      data: { type: 'RECONCILE_PRICES', batchSize: 100 },
    } as any);

    const updated = await db.service.findUniqueOrThrow({ where: { id: service.id } });
    expect(updated.isQuarantined).toBe(true);
    expect(updated.isActive).toBe(false);
    expect(updated.quarantineReason).toContain('Invalid Currency');
  });
});
