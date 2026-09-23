import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { adminCatalogService } from '@/services/admin/catalog.service';

describe('Catalog Filters & SQL Three-Valued Logic Matrix Audit', () => {
  let catId: string;

  beforeEach(async () => {
    const cat = await db.category.upsert({
      where: { slug: 'test-filter-matrix-cat' },
      update: { tenantId: 'smmplan' },
      create: {
        name: 'Filter Matrix Test Category',
        slug: 'test-filter-matrix-cat',
        tenantId: 'smmplan',
      }
    });
    catId = cat.id;

    // 1. Normal Active Service with cooldownReason = NULL
    await db.service.upsert({
      where: { id: 'test-active-null-cooldown' },
      update: { isActive: true, cooldownReason: null, tenantId: 'smmplan' },
      create: {
        id: 'test-active-null-cooldown',
        numericId: 99801,
        name: 'Normal Active Service (NULL Cooldown)',
        categoryId: catId,
        tenantId: 'smmplan',
        rate: 10,
        markup: 2,
        minQty: 10,
        maxQty: 1000,
        isActive: true,
        cooldownReason: null,
      }
    });

    // 2. Archived / Zombie Service with cooldownReason = 'ZOMBIE_AUTO_DISABLED'
    await db.service.upsert({
      where: { id: 'test-zombie-disabled-service' },
      update: { isActive: true, cooldownReason: 'ZOMBIE_AUTO_DISABLED', tenantId: 'smmplan' },
      create: {
        id: 'test-zombie-disabled-service',
        numericId: 99802,
        name: 'Zombie Disabled Service',
        categoryId: catId,
        tenantId: 'smmplan',
        rate: 10,
        markup: 2,
        minQty: 10,
        maxQty: 1000,
        isActive: true,
        cooldownReason: 'ZOMBIE_AUTO_DISABLED',
      }
    });

    // 3. Inactive service (isActive = false)
    await db.service.upsert({
      where: { id: 'test-inactive-service' },
      update: { isActive: false, cooldownReason: null, tenantId: 'smmplan' },
      create: {
        id: 'test-inactive-service',
        numericId: 99803,
        name: 'Inactive Service',
        categoryId: catId,
        tenantId: 'smmplan',
        rate: 10,
        markup: 2,
        minQty: 10,
        maxQty: 1000,
        isActive: false,
        cooldownReason: null,
      }
    });
  });

  it('hideDeleted=true retains normal active services where cooldownReason is NULL', async () => {
    const res = await adminCatalogService.listServices({
      tenantId: 'smmplan',
      hideDeleted: true,
      categoryId: catId,
    });

    // Normal active service MUST be included
    const foundNormal = res.items.find(i => i.id === 'test-active-null-cooldown');
    expect(foundNormal).toBeDefined();
    expect(foundNormal?.isActive).toBe(true);

    // Zombie service MUST be excluded
    const foundZombie = res.items.find(i => i.id === 'test-zombie-disabled-service');
    expect(foundZombie).toBeUndefined();

    // Inactive service MUST be excluded
    const foundInactive = res.items.find(i => i.id === 'test-inactive-service');
    expect(foundInactive).toBeUndefined();
  });

  it('handles platform=ALL without collapsing the query', async () => {
    const res = await adminCatalogService.listServices({
      tenantId: 'smmplan',
      networkSlug: 'ALL',
      categoryId: catId,
    });

    expect(res.items.length).toBeGreaterThan(0);
  });

  it('handles providerStatus=all and categoryId=all gracefully', async () => {
    const res = await adminCatalogService.listServices({
      tenantId: 'smmplan',
      providerStatus: 'all',
      categoryId: 'all',
    });

    expect(res.items.length).toBeGreaterThan(0);
  });
});
