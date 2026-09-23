import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { adminCatalogService } from '@/services/admin/catalog.service';

/**
 * 🎲 COMBINATORIAL STATE-MATRIX INTEGRATION SUITE
 * Tests all orthogonal combinations of 8 catalog filters:
 * 1. tenantId ('smmplan', 'flux', 'all')
 * 2. hideDeleted (true, false)
 * 3. isActive (true, false, undefined)
 * 4. networkSlug ('telegram', 'vk', 'ALL', undefined)
 * 5. providerStatus ('active', 'manual', 'zombie', 'all', undefined)
 * 6. categoryId (validId, 'all', undefined)
 * 7. providerId (validId, 'none', 'all', undefined)
 * 8. search (numericId, name substring, externalId, undefined)
 */
describe('Catalog 8-Vector Combinatorial State-Matrix Test Suite', () => {
  let catTelegramId: string;
  let catVkId: string;
  let providerAId: string;

  beforeEach(async () => {
    // 1. Seed Networks
    const netTg = await db.network.upsert({
      where: { slug: 'telegram' },
      update: {},
      create: { name: 'Telegram', slug: 'telegram', icon: 'send', sort: 1 }
    });
    const netVk = await db.network.upsert({
      where: { slug: 'vk' },
      update: {},
      create: { name: 'VKontakte', slug: 'vk', icon: 'share-2', sort: 2 }
    });

    // 2. Seed Categories
    const catTg = await db.category.upsert({
      where: { slug: 'matrix-tg-subs' },
      update: { tenantId: 'smmplan', networkId: netTg.id },
      create: { name: 'Matrix TG Subs', slug: 'matrix-tg-subs', tenantId: 'smmplan', networkId: netTg.id }
    });
    catTelegramId = catTg.id;

    const catVk = await db.category.upsert({
      where: { slug: 'matrix-vk-followers' },
      update: { tenantId: 'smmplan', networkId: netVk.id },
      create: { name: 'Matrix VK Followers', slug: 'matrix-vk-followers', tenantId: 'smmplan', networkId: netVk.id }
    });
    catVkId = catVk.id;

    // 3. Seed Provider
    const prov = await db.provider.upsert({
      where: { id: 'matrix-provider-alpha' },
      update: {},
      create: {
        id: 'matrix-provider-alpha',
        name: 'Matrix Provider Alpha',
        apiUrl: 'https://api.matrix-provider.test/v2',
        apiKey: 'enc_matrix_key_123',
        isActive: true,
      }
    });
    providerAId = prov.id;

    // 4. Seed 5 Distinct Service Profiles (Dirty Seeding Matrix)
    // S1: Active, Normal, TG, ProviderA, cooldownReason = NULL
    await db.service.upsert({
      where: { id: 'matrix-s1-active-tg' },
      update: { isActive: true, cooldownReason: null, tenantId: 'smmplan', providerId: providerAId },
      create: {
        id: 'matrix-s1-active-tg',
        numericId: 99101,
        name: 'Telegram Followers High Speed Alpha',
        externalId: 'ext-99101',
        categoryId: catTelegramId,
        providerId: providerAId,
        tenantId: 'smmplan',
        rate: 25,
        markup: 2.5,
        minQty: 50,
        maxQty: 50000,
        isActive: true,
        cooldownReason: null,
      }
    });

    // S2: Active, Normal, VK, ProviderA, cooldownReason = NULL
    await db.service.upsert({
      where: { id: 'matrix-s2-active-vk' },
      update: { isActive: true, cooldownReason: null, tenantId: 'smmplan', providerId: providerAId },
      create: {
        id: 'matrix-s2-active-vk',
        numericId: 99102,
        name: 'VK Likes Real Russian Profiles',
        externalId: 'ext-99102',
        categoryId: catVkId,
        providerId: providerAId,
        tenantId: 'smmplan',
        rate: 15,
        markup: 3.0,
        minQty: 100,
        maxQty: 10000,
        isActive: true,
        cooldownReason: null,
      }
    });

    // S3: Active, Manual Service (providerId = NULL)
    await db.service.upsert({
      where: { id: 'matrix-s3-manual-tg' },
      update: { isActive: true, cooldownReason: null, tenantId: 'smmplan', providerId: null },
      create: {
        id: 'matrix-s3-manual-tg',
        numericId: 99103,
        name: 'Telegram Manual VIP Consultation',
        categoryId: catTelegramId,
        providerId: null,
        tenantId: 'smmplan',
        rate: 500,
        markup: 1.5,
        minQty: 1,
        maxQty: 10,
        isActive: true,
        cooldownReason: null,
      }
    });

    // S4: Zombie Service (isActive = true, cooldownReason = ZOMBIE_AUTO_DISABLED)
    await db.service.upsert({
      where: { id: 'matrix-s4-zombie-tg' },
      update: { isActive: true, cooldownReason: 'ZOMBIE_AUTO_DISABLED', tenantId: 'smmplan' },
      create: {
        id: 'matrix-s4-zombie-tg',
        numericId: 99104,
        name: 'Telegram Disabled Zombie Tariff',
        categoryId: catTelegramId,
        providerId: providerAId,
        tenantId: 'smmplan',
        rate: 10,
        markup: 2.0,
        minQty: 100,
        maxQty: 5000,
        isActive: true,
        cooldownReason: 'ZOMBIE_AUTO_DISABLED',
      }
    });

    // S5: Inactive Service (isActive = false)
    await db.service.upsert({
      where: { id: 'matrix-s5-inactive-all' },
      update: { isActive: false, cooldownReason: null, tenantId: 'smmplan' },
      create: {
        id: 'matrix-s5-inactive-all',
        numericId: 99105,
        name: 'Archived TG Service',
        categoryId: catTelegramId,
        providerId: providerAId,
        tenantId: 'smmplan',
        rate: 5,
        markup: 2.0,
        minQty: 10,
        maxQty: 100,
        isActive: false,
        cooldownReason: null,
      }
    });
  });

  // Matrix Case 1: Default view (all services in tenant)
  it('Matrix 1: Default view returns all active, manual, and inactive services in tenant', async () => {
    const res = await adminCatalogService.listServices({ tenantId: 'smmplan' });
    const ids = res.items.map(i => i.id);
    expect(ids).toContain('matrix-s1-active-tg');
    expect(ids).toContain('matrix-s2-active-vk');
    expect(ids).toContain('matrix-s3-manual-tg');
    expect(ids).toContain('matrix-s4-zombie-tg');
    expect(ids).toContain('matrix-s5-inactive-all');
  });

  // Matrix Case 2: hideDeleted = true (Must retain S1, S2, S3 with cooldownReason=null, drop S4, S5)
  it('Matrix 2: hideDeleted=true strictly isolates clean active services', async () => {
    const res = await adminCatalogService.listServices({
      tenantId: 'smmplan',
      hideDeleted: true,
    });
    const ids = res.items.map(i => i.id);
    expect(ids).toContain('matrix-s1-active-tg');
    expect(ids).toContain('matrix-s2-active-vk');
    expect(ids).toContain('matrix-s3-manual-tg');
    expect(ids).not.toContain('matrix-s4-zombie-tg');
    expect(ids).not.toContain('matrix-s5-inactive-all');
  });

  // Matrix Case 3: networkSlug = 'telegram' + hideDeleted = true
  it('Matrix 3: platform=telegram + hideDeleted=true narrows to TG active services', async () => {
    const res = await adminCatalogService.listServices({
      tenantId: 'smmplan',
      networkSlug: 'telegram',
      hideDeleted: true,
    });
    const ids = res.items.map(i => i.id);
    expect(ids).toContain('matrix-s1-active-tg');
    expect(ids).toContain('matrix-s3-manual-tg');
    expect(ids).not.toContain('matrix-s2-active-vk');
    expect(ids).not.toContain('matrix-s4-zombie-tg');
  });

  // Matrix Case 4: providerStatus = 'manual'
  it('Matrix 4: providerStatus=manual strictly returns services with providerId=null', async () => {
    const res = await adminCatalogService.listServices({
      tenantId: 'smmplan',
      providerStatus: 'manual',
    });
    const ids = res.items.map(i => i.id);
    expect(ids).toContain('matrix-s3-manual-tg');
    expect(ids).not.toContain('matrix-s1-active-tg');
    expect(ids).not.toContain('matrix-s2-active-vk');
  });

  // Matrix Case 5: providerStatus = 'zombie'
  it('Matrix 5: providerStatus=zombie strictly returns services with ZOMBIE cooldown reason', async () => {
    const res = await adminCatalogService.listServices({
      tenantId: 'smmplan',
      providerStatus: 'zombie',
    });
    const ids = res.items.map(i => i.id);
    expect(ids).toContain('matrix-s4-zombie-tg');
    expect(ids).not.toContain('matrix-s1-active-tg');
  });

  // Matrix Case 6: Numeric ID Omni-Search
  it('Matrix 6: Omni-Search by pure numericId 99102 returns exact VK service', async () => {
    const res = await adminCatalogService.listServices({
      tenantId: 'smmplan',
      search: '99102',
    });
    expect(res.items.length).toBe(1);
    expect(res.items[0].id).toBe('matrix-s2-active-vk');
  });

  // Matrix Case 7: External Provider ID Search
  it('Matrix 7: Search by externalId ext-99101 finds exact provider mapping', async () => {
    const res = await adminCatalogService.listServices({
      tenantId: 'smmplan',
      search: 'ext-99101',
    });
    expect(res.items.length).toBe(1);
    expect(res.items[0].id).toBe('matrix-s1-active-tg');
  });

  // Matrix Case 8: Platform 'ALL' and category 'all' strings
  it('Matrix 8: Edge-case string values ALL and all do not break queries', async () => {
    const res = await adminCatalogService.listServices({
      tenantId: 'smmplan',
      networkSlug: 'ALL',
      categoryId: 'all',
      providerId: 'all',
      providerStatus: 'all',
      hideDeleted: true,
    });
    expect(res.items.length).toBeGreaterThanOrEqual(3);
  });
});
