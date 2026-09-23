import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { adminCatalogService } from '@/services/admin/catalog.service';

describe('Admin Catalog Multi-Tenant & Numbers Audit E2E Suite', () => {
  let testCategoryId: string;
  let testProviderId: string;

  beforeEach(async () => {
    // 1. Setup Provider
    const provider = await db.provider.upsert({
      where: { name: 'E2E_Catalog_Provider' },
      update: { isActive: true },
      create: {
        name: 'E2E_Catalog_Provider',
        apiUrl: 'https://api.mockcatalog.com/v2',
        apiKey: 'key_mock',
        balanceCurrency: 'RUB',
        isActive: true,
      }
    });
    testProviderId = provider.id;

    // 2. Setup Category with tenant 'all'
    const cat = await db.category.upsert({
      where: { slug: 'e2e-catalog-multitenant-cat' },
      update: { tenantId: 'all' },
      create: {
        name: 'E2E Multi-Tenant Category',
        slug: 'e2e-catalog-multitenant-cat',
        tenantId: 'all',
      }
    });
    testCategoryId = cat.id;

    // 3. Clean up test services in this category
    await db.service.deleteMany({
      where: { categoryId: testCategoryId }
    });

    // 4. Create distinct services per tenant:
    // - 2 services for smmplan
    // - 1 service for flux
    // - 1 service for all
    await db.service.createMany({
      data: [
        {
          name: 'E2E Smmplan Service 1',
          categoryId: testCategoryId,
          tenantId: 'smmplan',
          rate: 10.0,
          minQty: 10,
          maxQty: 1000,
          providerId: testProviderId,
          isActive: true,
        },
        {
          name: 'E2E Smmplan Service 2',
          categoryId: testCategoryId,
          tenantId: 'smmplan',
          rate: 20.0,
          minQty: 10,
          maxQty: 2000,
          providerId: testProviderId,
          isActive: true,
        },
        {
          name: 'E2E Flux Service 1',
          categoryId: testCategoryId,
          tenantId: 'flux',
          rate: 15.0,
          minQty: 10,
          maxQty: 1500,
          providerId: testProviderId,
          isActive: true,
        },
        {
          name: 'E2E Universal Service (All)',
          categoryId: testCategoryId,
          tenantId: 'all',
          rate: 30.0,
          minQty: 10,
          maxQty: 3000,
          providerId: testProviderId,
          isActive: true,
        }
      ]
    });
  });

  it('correctly filters services in listServices by tenant', async () => {
    // smmplan should see: 2 (smmplan) + 1 (all) = 3 services in this category
    const smmplanRes = await adminCatalogService.listServices({
      categoryId: testCategoryId,
      tenantId: 'smmplan',
    });
    expect(smmplanRes.items.length).toBe(3);
    const smmplanNames = smmplanRes.items.map(s => s.name);
    expect(smmplanNames).toContain('E2E Smmplan Service 1');
    expect(smmplanNames).toContain('E2E Smmplan Service 2');
    expect(smmplanNames).toContain('E2E Universal Service (All)');
    expect(smmplanNames).not.toContain('E2E Flux Service 1');

    // flux should see: 1 (flux) + 1 (all) = 2 services in this category
    const fluxRes = await adminCatalogService.listServices({
      categoryId: testCategoryId,
      tenantId: 'flux',
    });
    expect(fluxRes.items.length).toBe(2);
    const fluxNames = fluxRes.items.map(s => s.name);
    expect(fluxNames).toContain('E2E Flux Service 1');
    expect(fluxNames).toContain('E2E Universal Service (All)');
    expect(fluxNames).not.toContain('E2E Smmplan Service 1');
  });

  it('returns accurate tenant-scoped serviceCount in listCategories', async () => {
    // Categories list for smmplan
    const categoriesSmmplan = await adminCatalogService.listCategories('smmplan');
    const targetCatSmmplan = categoriesSmmplan.find(c => c.id === testCategoryId);
    expect(targetCatSmmplan).toBeDefined();
    // Must be exactly 3 (2 smmplan + 1 all)
    expect(targetCatSmmplan?.serviceCount).toBe(3);

    // Categories list for flux
    const categoriesFlux = await adminCatalogService.listCategories('flux');
    const targetCatFlux = categoriesFlux.find(c => c.id === testCategoryId);
    expect(targetCatFlux).toBeDefined();
    // Must be exactly 2 (1 flux + 1 all)
    expect(targetCatFlux?.serviceCount).toBe(2);
  });

  it('returns synchronized numbers between listServices total and category serviceCount', async () => {
    const fluxServices = await adminCatalogService.listServices({
      categoryId: testCategoryId,
      tenantId: 'flux',
    });
    const fluxCategories = await adminCatalogService.listCategories('flux');
    const fluxCat = fluxCategories.find(c => c.id === testCategoryId);

    expect(fluxServices.items.length).toBe(fluxCat?.serviceCount);

    const smmplanServices = await adminCatalogService.listServices({
      categoryId: testCategoryId,
      tenantId: 'smmplan',
    });
    const smmplanCategories = await adminCatalogService.listCategories('smmplan');
    const smmplanCat = smmplanCategories.find(c => c.id === testCategoryId);

    expect(smmplanServices.items.length).toBe(smmplanCat?.serviceCount);
  });
});
