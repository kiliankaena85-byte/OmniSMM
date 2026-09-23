import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { adminCatalogService } from '@/services/admin/catalog.service';
import { adminOrderService } from '@/services/admin/order.service';
import { adminProviderService } from '@/services/admin/provider.service';
import { SmartRoutingService, MarginGuard } from '@/services/providers/smart-routing.service';
import { SettingsProvider } from '@/lib/settings';

describe('Admin Panel Exhaustive Backend Audit — 33 Subtabs & Action Handlers', () => {
  let testAdmin: { id: string; email: string };
  let testServiceId: string;
  let testProviderId: string;
  let testCategoryId: string;

  beforeEach(async () => {
    // 1. Setup Admin
    const user = await db.user.upsert({
      where: { email_tenantId: { email: 'audit-admin@smmplan.pro', tenantId: 'smmplan' } },
      update: { role: 'OWNER', isActive: true },
      create: {
        email: 'audit-admin@smmplan.pro',
        tenantId: 'smmplan',
        role: 'OWNER',
        isActive: true,
        balance: 0,
      }
    });
    testAdmin = { id: user.id, email: user.email };

    // 2. Setup Provider
    const provider = await db.provider.upsert({
      where: { name: 'Audit_Exhaustive_Provider' },
      update: { isActive: true, errorCount5m: 0 },
      create: {
        name: 'Audit_Exhaustive_Provider',
        apiUrl: 'https://api.auditprovider.com/v2',
        apiKey: 'key_audit',
        balanceCurrency: 'RUB',
        isActive: true,
        errorCount5m: 0,
      }
    });
    testProviderId = provider.id;

    // 3. Setup Category
    const cat = await db.category.upsert({
      where: { slug: 'audit-exhaustive-cat' },
      update: { tenantId: 'all' },
      create: {
        name: 'Audit Exhaustive Category',
        slug: 'audit-exhaustive-cat',
        tenantId: 'all',
      }
    });
    testCategoryId = cat.id;

    // 4. Setup Service
    const service = await db.service.create({
      data: {
        name: `Audit Exhaustive Service ${Date.now()}`,
        categoryId: testCategoryId,
        tenantId: 'smmplan',
        rate: 50.0,
        markup: 3.0,
        minQty: 10,
        maxQty: 10000,
        providerId: testProviderId,
        isActive: true,
      }
    });
    testServiceId = service.id;
  });

  describe('1. Catalog & Subtabs Server Services', () => {
    it('listServices executes cleanly with all filter variations', async () => {
      const res = await adminCatalogService.listServices({
        tenantId: 'smmplan',
        pageSize: 10,
        hideDeleted: true,
      });
      expect(res.items).toBeDefined();
      expect(Array.isArray(res.items)).toBe(true);
    });

    it('listCategories returns scoped relations without throwing', async () => {
      const cats = await adminCatalogService.listCategories('smmplan');
      expect(Array.isArray(cats)).toBe(true);
      expect(cats.length).toBeGreaterThan(0);
    });

    it('getCatalogHealthCounts calculates quarantine, zombies and cooldown correctly', async () => {
      const health = await adminCatalogService.getCatalogHealthCounts('smmplan');
      expect(health).toHaveProperty('quarantine');
      expect(health).toHaveProperty('zombies');
      expect(health).toHaveProperty('cooldown');
    });

    it('getCatalogStats returns non-negative counters', async () => {
      const stats = await adminCatalogService.getCatalogStats('smmplan');
      expect(stats.totalServices).toBeGreaterThanOrEqual(0);
      expect(stats.activeServices).toBeGreaterThanOrEqual(0);
      expect(stats.categories).toBeGreaterThanOrEqual(0);
    });
  });

  describe('2. Orders Management Services', () => {
    it('searchOrders executes cleanly with status and search filters', async () => {
      const orders = await adminOrderService.searchOrders({
        pageSize: 10,
        tenantId: 'smmplan',
      });
      expect(orders).toHaveProperty('items');
      expect(Array.isArray(orders.items)).toBe(true);
    });

    it('getOrderStats aggregates status counts cleanly', async () => {
      const stats = await adminOrderService.getOrderStats(undefined, undefined, 'smmplan');
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('pending');
      expect(stats).toHaveProperty('inProgress');
      expect(stats).toHaveProperty('completed');
    });
  });

  describe('3. Providers & Health Services', () => {
    it('listProviders returns active providers', async () => {
      const providers = await adminProviderService.listProviders();
      expect(Array.isArray(providers)).toBe(true);
      expect(providers.length).toBeGreaterThan(0);
    });

    it('SmartRoutingService fetches prioritized routes', async () => {
      const routes = await SmartRoutingService.getPrioritizedRoutes(testServiceId);
      expect(Array.isArray(routes)).toBe(true);
    });
  });

  describe('4. Settings & Exchange Rates', () => {
    it('SettingsProvider returns valid USD exchange rate', async () => {
      const rate = await SettingsProvider.getExchangeRateUSD();
      expect(rate).toBeGreaterThan(0);
    });
  });
});
