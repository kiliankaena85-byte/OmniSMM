import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db';
import sitemap from '@/app/sitemap';

// Mock next/headers for sitemap to work in test environment
vi.mock('next/headers', () => {
  return {
    headers: async () => {
      const m = new Map();
      m.set('host', 'smmplan.local');
      m.set('x-tenant-id', 'smmplan');
      return m;
    },
  };
});

describe('SEO Quality Gate Sitemap Integration Tests', () => {
  let networkId: string;
  let categoryId: string;

  beforeEach(async () => {
    // 1. Create Tenant & SystemSettings
    await db.tenant.upsert({
      where: { id: 'smmplan' },
      update: {},
      create: { id: 'smmplan', name: 'SMMplan', slug: 'smmplan', domain: 'smmplan.local', vaultSalt: 'test-salt' },
    });

    await db.systemSettings.upsert({
      where: { id: 'smmplan' },
      update: {
        isTestMode: true,
        exchangeRateUSD: 95.0,
      },
      create: {
        id: 'smmplan',
        isTestMode: true,
        exchangeRateUSD: 95.0,
      },
    });

    // 2. Create Network and Category
    const network = await db.network.create({
      data: {
        name: 'Telegram',
        slug: 'telegram',
        isActive: true,
        tenantId: 'smmplan',
      },
    });
    networkId = network.id;

    const category = await db.category.create({
      data: {
        name: 'Subscribers',
        slug: 'subscribers',
        networkId: networkId,
        tenantId: 'smmplan',
      },
    });
    categoryId = category.id;
  });

  it('Category with >= 3 active services and positive price passes Quality Gate (indexable)', async () => {
    // Create 3 active, non-quarantined, non-cooldown services
    await db.service.createMany({
      data: [
        {
          categoryId,
          name: 'Telegram Subs 1',
          slug: 'subs-1',
          isActive: true,
          isQuarantined: false,
          rate: 1.5, // > 0
          tenantId: 'smmplan',
        },
        {
          categoryId,
          name: 'Telegram Subs 2',
          slug: 'subs-2',
          isActive: true,
          isQuarantined: false,
          rate: 2.0,
          tenantId: 'smmplan',
        },
        {
          categoryId,
          name: 'Telegram Subs 3',
          slug: 'subs-3',
          isActive: true,
          isQuarantined: false,
          rate: 2.5,
          tenantId: 'smmplan',
        },
      ],
    });

    const routes = await sitemap();
    const urls = routes.map((r) => r.url);

    // Should include the category URL
    expect(urls).toContain('https://smmplan.pro/services/telegram/subscribers');
    // Should include the service URLs
    expect(urls).toContain('https://smmplan.pro/services/telegram/subscribers/subs-1');
  });

  it('Category with < 3 active services fails Quality Gate (noindex / omitted)', async () => {
    // Create only 2 services
    await db.service.createMany({
      data: [
        {
          categoryId,
          name: 'Telegram Subs 1',
          slug: 'subs-1',
          isActive: true,
          isQuarantined: false,
          rate: 1.5,
          tenantId: 'smmplan',
        },
        {
          categoryId,
          name: 'Telegram Subs 2',
          slug: 'subs-2',
          isActive: true,
          isQuarantined: false,
          rate: 2.0,
          tenantId: 'smmplan',
        },
      ],
    });

    const routes = await sitemap();
    const urls = routes.map((r) => r.url);

    expect(urls).not.toContain('https://smmplan.pro/services/telegram/subscribers');
  });

  it('Category with quarantined services fails Quality Gate if active ones are < 3', async () => {
    // Create 3 services but 1 is quarantined
    await db.service.createMany({
      data: [
        {
          categoryId,
          name: 'Telegram Subs 1',
          slug: 'subs-1',
          isActive: true,
          isQuarantined: false,
          rate: 1.5,
          tenantId: 'smmplan',
        },
        {
          categoryId,
          name: 'Telegram Subs 2',
          slug: 'subs-2',
          isActive: true,
          isQuarantined: false,
          rate: 2.0,
          tenantId: 'smmplan',
        },
        {
          categoryId,
          name: 'Telegram Subs 3',
          slug: 'subs-3',
          isActive: true,
          isQuarantined: true, // Quarantined
          rate: 2.5,
          tenantId: 'smmplan',
        },
      ],
    });

    const routes = await sitemap();
    const urls = routes.map((r) => r.url);

    expect(urls).not.toContain('https://smmplan.pro/services/telegram/subscribers');
  });

  it('Category with cooldown services fails Quality Gate if active ones are < 3', async () => {
    // Create 3 services but 1 has active cooldown
    await db.service.createMany({
      data: [
        {
          categoryId,
          name: 'Telegram Subs 1',
          slug: 'subs-1',
          isActive: true,
          isQuarantined: false,
          rate: 1.5,
          tenantId: 'smmplan',
        },
        {
          categoryId,
          name: 'Telegram Subs 2',
          slug: 'subs-2',
          isActive: true,
          isQuarantined: false,
          rate: 2.0,
          tenantId: 'smmplan',
        },
        {
          categoryId,
          name: 'Telegram Subs 3',
          slug: 'subs-3',
          isActive: true,
          isQuarantined: false,
          rate: 2.5,
          cooldownUntil: new Date(Date.now() + 600000), // Cooldown in 10 mins
          tenantId: 'smmplan',
        },
      ],
    });

    const routes = await sitemap();
    const urls = routes.map((r) => r.url);

    expect(urls).not.toContain('https://smmplan.pro/services/telegram/subscribers');
  });

  it('Category with rate = 0 fails Quality Gate if all positive price active ones are < 3', async () => {
    // Create 3 services but 1 has rate = 0
    await db.service.createMany({
      data: [
        {
          categoryId,
          name: 'Telegram Subs 1',
          slug: 'subs-1',
          isActive: true,
          isQuarantined: false,
          rate: 1.5,
          tenantId: 'smmplan',
        },
        {
          categoryId,
          name: 'Telegram Subs 2',
          slug: 'subs-2',
          isActive: true,
          isQuarantined: false,
          rate: 2.0,
          tenantId: 'smmplan',
        },
        {
          categoryId,
          name: 'Telegram Subs 3',
          slug: 'subs-3',
          isActive: true,
          isQuarantined: false,
          rate: 0.0, // 0 rate
          tenantId: 'smmplan',
        },
      ],
    });

    const routes1 = await sitemap();
    expect(routes1.map((r) => r.url)).not.toContain('https://smmplan.pro/services/telegram/subscribers');

    // Clean services
    await db.service.deleteMany({ where: { categoryId } });

    // Insert 3 services all with rate = 0
    await db.service.createMany({
      data: [
        {
          categoryId,
          name: 'Telegram Subs 1',
          slug: 'subs-1',
          isActive: true,
          isQuarantined: false,
          rate: 0.0,
          tenantId: 'smmplan',
        },
        {
          categoryId,
          name: 'Telegram Subs 2',
          slug: 'subs-2',
          isActive: true,
          isQuarantined: false,
          rate: 0.0,
          tenantId: 'smmplan',
        },
        {
          categoryId,
          name: 'Telegram Subs 3',
          slug: 'subs-3',
          isActive: true,
          isQuarantined: false,
          rate: 0.0,
          tenantId: 'smmplan',
        },
      ],
    });

    const routes2 = await sitemap();
    expect(routes2.map((r) => r.url)).not.toContain('https://smmplan.pro/services/telegram/subscribers');
  });
});
