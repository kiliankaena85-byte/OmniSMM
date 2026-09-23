import { describe, it, expect } from 'vitest';
import { getPublicCatalogAction, getServicesByCategoryAction } from '@/actions/order/catalog';
import { getTenantHost, normalizeTenantId, absoluteCanonical } from '@/lib/seo-helpers';
import { TENANTS } from '@/config/tenants';
import { db } from '@/lib/db';

describe('Cross-Tenant E2E Isolation & Checkout Verification', () => {
  it('should verify tenant hosts and canonical URLs for both tenants', () => {
    // 1. SMMplan
    const smmplanTenant = normalizeTenantId('smmplan');
    expect(smmplanTenant).toBe('smmplan');
    expect(getTenantHost('smmplan')).toBe('smmplan.pro');
    expect(absoluteCanonical('smmplan', '/services/telegram')).toBe('https://smmplan.pro/services/telegram');

    // 2. SMMflux
    const fluxTenant = normalizeTenantId('flux');
    expect(fluxTenant).toBe('flux');
    expect(getTenantHost('flux')).toBe('smmflux.ru');
    expect(absoluteCanonical('flux', '/services/vk')).toBe('https://smmflux.ru/services/vk');

    // 3. Legacy alias fallback
    expect(normalizeTenantId('lovable')).toBe('flux');
  });

  it('should fetch isolated public catalogs for both smmplan and flux', async () => {
    const smmplanCatalog = await getPublicCatalogAction('smmplan');
    expect(smmplanCatalog.success).toBe(true);
    expect(Array.isArray(smmplanCatalog.data)).toBe(true);

    const fluxCatalog = await getPublicCatalogAction('flux');
    expect(fluxCatalog.success).toBe(true);
    expect(Array.isArray(fluxCatalog.data)).toBe(true);
  });

  it('should verify TENANTS configuration consistency', () => {
    const tenantIds = TENANTS.map(t => t.id);
    expect(tenantIds).toContain('smmplan');
    expect(tenantIds).toContain('flux');
    expect(tenantIds).not.toContain('lovable');
  });

  // AUD-05 (3.1) regression: ghost categories must not appear in another tenant's tree
  it('should hide another tenant\'s category from the storefront tree (no ghost categories)', async () => {
    const slugSuffix = Date.now();

    // Network shared, category and services owned by 'flux' only
    const network = await db.network.create({
      data: { name: `GhostNet ${slugSuffix}`, slug: `ghost-net-${slugSuffix}`, tenantId: 'all', isActive: true }
    });
    const fluxCategory = await db.category.create({
      data: { name: `Flux Only Cat ${slugSuffix}`, slug: `flux-only-${slugSuffix}`, networkId: network.id, tenantId: 'flux' }
    });
    await db.service.create({
      data: {
        tenantId: 'flux', slug: `ghost-flux-svc-${slugSuffix}`, name: 'Flux Only Service',
        categoryId: fluxCategory.id, rate: 1, markup: 2, pricePer1000Cents: 200, minQty: 10, maxQty: 1000,
        isActive: true
      }
    });

    // ...and a shared category with one smmplan service (must be visible to smmplan)
    const sharedCategory = await db.category.create({
      data: { name: `Shared Cat ${slugSuffix}`, slug: `shared-cat-${slugSuffix}`, networkId: network.id, tenantId: 'all' }
    });
    await db.service.create({
      data: {
        tenantId: 'smmplan', slug: `ghost-smm-svc-${slugSuffix}`, name: 'SMMplan Service',
        categoryId: sharedCategory.id, rate: 1, markup: 2, pricePer1000Cents: 200, minQty: 10, maxQty: 1000,
        isActive: true
      }
    });

    try {
      // smmplan tenant: sees the shared category, does NOT see the flux-only category
      const smmplanCatalog = await getPublicCatalogAction('smmplan');
      expect(smmplanCatalog.success).toBe(true);
      const smmplanCats = (smmplanCatalog.data || []).flatMap(n => n.categories.map(c => c.id));
      expect(smmplanCats).toContain(sharedCategory.id);
      expect(smmplanCats).not.toContain(fluxCategory.id);   // ← ghost category killed

      // flux tenant: sees its own category with its services
      const fluxCatalog = await getPublicCatalogAction('flux');
      expect(fluxCatalog.success).toBe(true);
      const fluxCats = (fluxCatalog.data || []).flatMap(n => n.categories.map(c => c.id));
      expect(fluxCats).toContain(fluxCategory.id);

      // Services list: flux services are returned for flux, empty for smmplan in the flux-only category
      const fluxServices = await getServicesByCategoryAction(fluxCategory.id, 'flux');
      expect(fluxServices.length).toBe(1);
      const smmplanServicesInFluxCat = await getServicesByCategoryAction(fluxCategory.id, 'smmplan');
      expect(smmplanServicesInFluxCat.length).toBe(0);

      // Shared category: smmplan sees only its own service
      const sharedServices = await getServicesByCategoryAction(sharedCategory.id, 'smmplan');
      expect(sharedServices.length).toBe(1);
      expect(sharedServices[0].name).toBe('SMMplan Service');
    } finally {
      await db.service.deleteMany({ where: { slug: { in: [`ghost-flux-svc-${slugSuffix}`, `ghost-smm-svc-${slugSuffix}`] } } });
      await db.category.deleteMany({ where: { id: { in: [fluxCategory.id, sharedCategory.id] } } });
      await db.network.deleteMany({ where: { id: network.id } });
    }
  });
});
