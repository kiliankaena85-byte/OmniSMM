import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '@/lib/db';
import { orderService } from '@/services/core/order.service';
import { getTenantConfig } from '@/config/tenant-config';
import { getTenantHost, normalizeTenantId, absoluteCanonical } from '@/lib/seo-helpers';

describe('Multi-Tenant Architecture & Isolation Security Test Suite', () => {
  let userPlanId: string;
  let userFluxId: string;
  let orderPlanId: string;
  let providerId: string;
  let serviceId: string;

  beforeEach(async () => {
    // 1. Create SMMplan User
    const userPlan = await db.user.create({
      data: {
        email: 'user-plan@smmplan.pro',
        role: 'USER',
        balance: BigInt(5000),
        tenantId: 'smmplan'
      }
    });
    userPlanId = userPlan.id;

    // 2. Create SMMflux User
    const userFlux = await db.user.create({
      data: {
        email: 'user-flux@smmflux.ru',
        role: 'USER',
        balance: BigInt(5000),
        tenantId: 'flux'
      }
    });
    userFluxId = userFlux.id;

    // 3. Provider Fixture
    const provider = await db.provider.create({
      data: {
        id: `provider-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: 'Test Manual Provider',
        apiUrl: 'https://example.com/api',
        apiKey: 'test-api-key',
        providerType: 'MANUAL',
        balanceCurrency: 'USD'
      }
    });

    let network = await db.network.findFirst();
    if (!network) {
      network = await db.network.create({
        data: { name: 'Telegram', slug: 'telegram', icon: 'send', tenantId: 'all' }
      });
    }

    let category = await db.category.findFirst({ where: { networkId: network.id } });
    if (!category) {
      category = await db.category.create({
        data: { name: 'Подписчики', slug: 'subscribers', networkId: network.id, tenantId: 'all' }
      });
    }

    const service = await db.service.create({
      data: {
        name: 'Тестовые подписчики',
        categoryId: category.id,
        rate: 100,
        minQty: 10,
        maxQty: 1000,
        providerId: provider.id,
        externalId: '1',
        tenantId: 'all',
        isActive: true
      }
    });

    providerId = provider.id;
    serviceId = service.id;

    // 4. Create SMMplan order
    const orderPlan = await db.order.create({
      data: {
        userId: userPlanId,
        tenantId: 'smmplan',
        serviceId: service.id,
        link: 'https://t.me/smmplan_channel',
        quantity: 100,
        charge: 1000,
        providerCost: 500,
        status: 'PENDING',
        remains: 100,
        isTest: true
      }
    });
    orderPlanId = orderPlan.id;
  });

  afterEach(async () => {
    try {
      if (orderPlanId) await db.order.deleteMany({ where: { id: orderPlanId } }).catch(() => {});
      if (serviceId) await db.service.deleteMany({ where: { id: serviceId } }).catch(() => {});
      if (providerId) await db.provider.deleteMany({ where: { id: providerId } }).catch(() => {});
      if (userPlanId) await db.user.deleteMany({ where: { id: userPlanId } }).catch(() => {});
      if (userFluxId) await db.user.deleteMany({ where: { id: userFluxId } }).catch(() => {});
    } catch { /* ignore */ }
  });

  describe('1. Cross-Tenant IDOR Attack Defense', () => {
    it('strictly forbids a flux user from canceling an smmplan order', async () => {
      // UserFlux attempts to cancel orderPlanId specifying flux tenant
      const result = await orderService.cancelPendingOrderClient(orderPlanId, userFluxId, 'flux');
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/не найден|доступ ограничен/i);

      // Verify order status remains untouched in DB
      const order = await db.order.findUniqueOrThrow({ where: { id: orderPlanId } });
      expect(order.status).toBe('PENDING');
    });

    it('allows legitimate owner from the same tenant to cancel their cooling-off order', async () => {
      const result = await orderService.cancelPendingOrderClient(orderPlanId, userPlanId, 'smmplan');
      expect(result.success).toBe(true);

      const order = await db.order.findUniqueOrThrow({ where: { id: orderPlanId } });
      expect(order.status).toBe('CANCELED');
    });
  });

  describe('2. Multi-Tenant Domain, Host & Canonical Resolution', () => {
    it('correctly maps tenant identifiers to isolated domains', () => {
      expect(getTenantHost('smmplan')).toBe('smmplan.pro');
      expect(getTenantHost('flux')).toBe('smmflux.ru');
      expect(getTenantHost('lovable')).toBe('smmflux.ru'); // legacy alias

      expect(normalizeTenantId('flux')).toBe('flux');
      expect(normalizeTenantId('smmplan')).toBe('smmplan');
    });

    it('builds absolute canonical URLs with proper host scoping', () => {
      expect(absoluteCanonical('smmplan', '/services/telegram')).toBe('https://smmplan.pro/services/telegram');
      expect(absoluteCanonical('flux', '/services/telegram')).toBe('https://smmflux.ru/services/telegram');
    });
  });

  describe('3. Centralized Legal Configuration (Single Source of Truth)', () => {
    it('returns dedicated legal entities and details for each brand without hardcoded fallbacks', () => {
      const planConfig = getTenantConfig('smmplan');
      const fluxConfig = getTenantConfig('flux');

      expect(planConfig.brandName).toBe('SMMplan');
      expect(planConfig.domain).toBe('smmplan.pro');
      expect(planConfig.legal.name).toBeDefined();
      expect(planConfig.legal.inn).toBeDefined();
      expect(planConfig.legal.email).toContain('smmplan.pro');

      expect(fluxConfig.brandName).toBe('SMMflux');
      expect(fluxConfig.domain).toBe('smmflux.ru');
      expect(fluxConfig.legal.name).toBeDefined();
      expect(fluxConfig.legal.email).toContain('@');
      expect(planConfig.legal.inn).toBeDefined();
    });
  });
});
