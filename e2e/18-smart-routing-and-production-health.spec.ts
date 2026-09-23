/**
 * e2e/18-smart-routing-and-production-health.spec.ts
 * BLOCK 18: Smart Provider Multi-Routing 2.0 & Production Armor & Observability
 *
 * Invariants & Contract (AGENTS.md & Zero-Defect):
 * 1. Healthcheck Liveness: Public GET /api/health returns 200 with in-memory cached status (zero DB query DoS risk).
 * 2. Healthcheck Readiness: GET /api/health?detailed=1 requires Bearer CRON_SECRET auth via timingSafeEqual.
 * 3. MarginGuard: Rejects unprofitable routes with 5% currency volatility buffer.
 * 4. Smart Cascade Routing: Prioritizes primary route, orders by priority, demotes degraded providers.
 * 5. Routing Audit Log: Records failover and margin rejection events for operational visibility.
 */

import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { MarginGuard, SmartRoutingService } from '../src/services/providers/smart-routing.service';

const db = new PrismaClient();

test.describe.serial('BLOCK 18: Smart Routing & Production Observability E2E', () => {
  let testServiceId: string;
  let primaryProviderId: string;
  let secondaryProviderId: string;
  let degradedProviderId: string;
  let categoryId: string;

  test.beforeAll(async () => {
    const ts = Date.now();

    // 1. Create a Category
    const category = await db.category.create({
      data: {
        name: `Health & Routing Cat ${ts}`,
        slug: `health-routing-cat-${ts}`,
        tenantId: 'smmplan',
        sort: 10,
      },
    });
    categoryId = category.id;

    // 2. Create Providers
    const primaryProvider = await db.provider.create({
      data: {
        name: `Primary_Route_Provider_${ts}`,
        apiUrl: 'https://api.primary-mock-smm.com/v2',
        apiKey: 'enc_mock_key_primary',
        isActive: true,
        balanceCurrency: 'RUB',
        errorCount5m: 0,
      },
    });
    primaryProviderId = primaryProvider.id;

    const secondaryProvider = await db.provider.create({
      data: {
        name: `Secondary_Route_Provider_${ts}`,
        apiUrl: 'https://api.secondary-mock-smm.com/v2',
        apiKey: 'enc_mock_key_secondary',
        isActive: true,
        balanceCurrency: 'RUB',
        errorCount5m: 0,
      },
    });
    secondaryProviderId = secondaryProvider.id;

    const degradedProvider = await db.provider.create({
      data: {
        name: `Degraded_Route_Provider_${ts}`,
        apiUrl: 'https://api.degraded-mock-smm.com/v2',
        apiKey: 'enc_mock_key_degraded',
        isActive: true,
        balanceCurrency: 'RUB',
        errorCount5m: 15, // High error spike
      },
    });
    degradedProviderId = degradedProvider.id;

    // 3. Create Service
    const service = await db.service.create({
      data: {
        name: `Auto-Failover Telegram Members ${ts}`,
        categoryId: categoryId,
        providerId: primaryProviderId,
        rate: 50.0, // 50 RUB per 1000
        markup: 2.0, // Retail price = 100 RUB per 1000
        minQty: 10,
        maxQty: 50000,
        tenantId: 'smmplan',
        isActive: true,
      },
    });
    testServiceId = service.id;

    // 4. Create ServiceRoutes
    await db.serviceRoute.createMany({
      data: [
        {
          serviceId: testServiceId,
          providerId: primaryProviderId,
          providerServiceId: '101',
          isPrimary: true,
          priority: 0,
          isActive: true,
          failoverMode: 'automatic',
        },
        {
          serviceId: testServiceId,
          providerId: secondaryProviderId,
          providerServiceId: '202',
          isPrimary: false,
          priority: 1,
          isActive: true,
          failoverMode: 'automatic',
        },
        {
          serviceId: testServiceId,
          providerId: degradedProviderId,
          providerServiceId: '303',
          isPrimary: false,
          priority: 2,
          isActive: true,
          failoverMode: 'automatic',
        },
      ],
    });
  });

  test.afterAll(async () => {
    if (testServiceId) {
      await db.serviceRoute.deleteMany({ where: { serviceId: testServiceId } });
      await db.routingAuditLog.deleteMany({ where: { serviceId: testServiceId } });
      await db.service.deleteMany({ where: { id: testServiceId } });
    }
    if (primaryProviderId) {
      await db.provider.deleteMany({
        where: { id: { in: [primaryProviderId, secondaryProviderId, degradedProviderId] } },
      });
    }
    if (categoryId) {
      await db.category.deleteMany({ where: { id: categoryId } });
    }
    await db.$disconnect();
  });

  test('Scenario 1: Public Liveness Probe (GET /api/health returns 200 OK without DB exhaustion)', async ({ request, baseURL }) => {
    const resp = await request.get(`${baseURL}/api/health`);
    expect(resp.status()).toBe(200);

    const data = await resp.json();
    expect(data.status).toBe('healthy');
    expect(data.service).toBe('smmplan');
    expect(data.timestamp).toBeDefined();
    // Public response must NOT reveal internal database host/connection pool topology
    expect(data.database).toBeUndefined();
    expect(data.redis).toBeUndefined();
  });

  test('Scenario 2: Detailed Readiness Probe Unauthorized Guard (GET /api/health?detailed=1 -> 401)', async ({ playwright, baseURL }) => {
    const unauthContext = await playwright.request.newContext({ storageState: undefined });
    const resp = await unauthContext.get(`${baseURL}/api/health?detailed=1`);
    expect(resp.status()).toBe(401);

    const data = await resp.json();
    expect(data.error).toMatch(/Unauthorized|Forbidden/i);
    await unauthContext.dispose();
  });

  test('Scenario 3: Authorized Detailed Readiness Probe (GET /api/health?detailed=1 with Bearer token -> 200 with DB & Redis status)', async ({ request, baseURL }) => {
    const cronSecret = process.env.CRON_SECRET || 'cron_secret_test';
    const resp = await request.get(`${baseURL}/api/health?detailed=1`, {
      headers: {
        Authorization: `Bearer ${cronSecret}`,
      },
    });

    expect(resp.status()).toBe(200);
    const data = await resp.json();
    expect(data.status).toBe('healthy');
    expect(data.database).toBeDefined();
    expect(data.database.status).toBe('connected');
    expect(typeof data.database.latencyMs).toBe('number');
    expect(data.redis).toBeDefined();
    expect(data.redis.status).toBe('connected');
    expect(data.memory).toBeDefined();
  });

  test('Scenario 4: MarginGuard Financial Protection with Currency Volatility Buffer', async () => {
    // 1. Profitable case: Client paid 1,000 cents (10.00 RUB) for 100 qty. Provider rate = 50.0 RUB/1000 (Cost = 5.00 RUB = 500 cents).
    const profitableResult = await MarginGuard.checkMargin(
      BigInt(1_000), // 10.00 RUB paid by client
      100, // qty
      50.0, // provider rate per 1000 RUB
      'RUB'
    );
    expect(profitableResult.isProfitable).toBe(true);
    expect(profitableResult.costCents).toBeLessThanOrEqual(BigInt(600));
    expect(profitableResult.marginPercent).toBeGreaterThan(0);

    // 2. Unprofitable case: Client paid 400 cents (4.00 RUB) for 100 qty. Provider rate = 50.0 RUB/1000 (Cost = 5.25 RUB with 5% buffer = 525 cents).
    const unprofitableResult = await MarginGuard.checkMargin(
      BigInt(400), // 4.00 RUB paid by client
      100, // qty
      50.0, // provider rate per 1000 RUB
      'RUB'
    );
    expect(unprofitableResult.isProfitable).toBe(false);
    expect(unprofitableResult.reason).toContain('превышает');

    // 3. Record audit event for rejected margin
    await SmartRoutingService.recordFailoverEvent({
      serviceId: testServiceId,
      action: 'MARGIN_REJECTED',
      fromProviderId: secondaryProviderId,
      reason: unprofitableResult.reason || 'Unprofitable margin',
    });

    const auditLog = await db.routingAuditLog.findFirst({
      where: { serviceId: testServiceId, action: 'MARGIN_REJECTED' },
    });
    expect(auditLog).toBeDefined();
    expect(auditLog?.reason).toContain('превышает');
  });

  test('Scenario 5: SmartRoutingService Route Prioritization and Degraded Provider Demotion', async () => {
    const routes = await SmartRoutingService.getPrioritizedRoutes(testServiceId);
    expect(routes.length).toBe(3);

    // 1. Primary route must be first
    expect(routes[0].isPrimary).toBe(true);
    expect(routes[0].providerId).toBe(primaryProviderId);

    // 2. Healthy secondary route must be second
    expect(routes[1].isPrimary).toBe(false);
    expect(routes[1].providerId).toBe(secondaryProviderId);

    // 3. Degraded provider with errorCount5m > 10 must be placed last
    expect(routes[2].providerId).toBe(degradedProviderId);
    expect(routes[2].provider.errorCount5m).toBe(15);
  });
});
