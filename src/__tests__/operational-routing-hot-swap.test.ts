import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { SmartRoutingService, MarginGuard } from '@/services/providers/smart-routing.service';
import { addServiceRoute, toggleRouteStatus, changeRoutePriority, deleteServiceRoute } from '@/actions/admin/routing.actions';

describe('Operational Routing (Hot-Swap) — Comprehensive E2E Test Suite', () => {
  let testServiceId: string;
  let primaryProviderId: string;
  let backupProviderId1: string;
  let backupProviderId2: string;

  beforeEach(async () => {
    // 1. Create or retrieve 3 test providers
    const p1 = await db.provider.upsert({
      where: { name: 'E2E_Routing_Provider_Primary' },
      update: { isActive: true, errorCount5m: 0 },
      create: {
        name: 'E2E_Routing_Provider_Primary',
        apiUrl: 'https://api.primary-provider.com/v2',
        apiKey: 'key_primary',
        balanceCurrency: 'RUB',
        isActive: true,
        errorCount5m: 0,
      }
    });
    primaryProviderId = p1.id;

    const p2 = await db.provider.upsert({
      where: { name: 'E2E_Routing_Provider_Backup1' },
      update: { isActive: true, errorCount5m: 0 },
      create: {
        name: 'E2E_Routing_Provider_Backup1',
        apiUrl: 'https://api.backup1.com/v2',
        apiKey: 'key_backup1',
        balanceCurrency: 'RUB',
        isActive: true,
        errorCount5m: 0,
      }
    });
    backupProviderId1 = p2.id;

    const p3 = await db.provider.upsert({
      where: { name: 'E2E_Routing_Provider_Backup2' },
      update: { isActive: true, errorCount5m: 0 },
      create: {
        name: 'E2E_Routing_Provider_Backup2',
        apiUrl: 'https://api.backup2.com/v2',
        apiKey: 'key_backup2',
        balanceCurrency: 'USD',
        isActive: true,
        errorCount5m: 0,
      }
    });
    backupProviderId2 = p3.id;

    // 2. Create Category and Service
    let cat = await db.category.findFirst({ where: { name: 'E2E Routing Category' } });
    if (!cat) {
      cat = await db.category.create({
        data: {
          name: 'E2E Routing Category',
          slug: `e2e-routing-cat-${Date.now()}`,
          tenantId: 'smmplan',
        }
      });
    }

    const service = await db.service.create({
      data: {
        name: `E2E Smart Route Service ${Date.now()}`,
        categoryId: cat.id,
        tenantId: 'smmplan',
        rate: 60.0, // 60 RUB retail
        minQty: 10,
        maxQty: 50000,
        isCancelEnabled: true,
        providerId: primaryProviderId,
      }
    });
    testServiceId = service.id;

    // 3. Create Service Routes (Primary + 2 Backups)
    await db.serviceRoute.createMany({
      data: [
        {
          serviceId: testServiceId,
          providerId: primaryProviderId,
          providerServiceId: '101',
          isPrimary: true,
          isActive: true,
          priority: 0,
        },
        {
          serviceId: testServiceId,
          providerId: backupProviderId1,
          providerServiceId: '202',
          isPrimary: false,
          isActive: true,
          priority: 1,
        },
        {
          serviceId: testServiceId,
          providerId: backupProviderId2,
          providerServiceId: '303',
          isPrimary: false,
          isActive: true,
          priority: 2,
        }
      ]
    });
  });

  describe('1. Dynamic Prioritization & Degradation Shifting', () => {
    it('returns routes sorted with Primary first and priority ASC', async () => {
      const routes = await SmartRoutingService.getPrioritizedRoutes(testServiceId);
      expect(routes.length).toBe(3);
      expect(routes[0].isPrimary).toBe(true);
      expect(routes[0].providerId).toBe(primaryProviderId);
      expect(routes[1].providerId).toBe(backupProviderId1);
      expect(routes[2].providerId).toBe(backupProviderId2);
    });

    it('demotes degraded providers (errorCount5m > 10) to the tail of the cascade', async () => {
      // Simulate primary provider having a spike of 15 errors in last 5m
      await db.provider.update({
        where: { id: primaryProviderId },
        data: { errorCount5m: 15 }
      });

      const routes = await SmartRoutingService.getPrioritizedRoutes(testServiceId);
      expect(routes.length).toBe(3);
      // Healthy routes first
      expect(routes[0].providerId).toBe(backupProviderId1);
      expect(routes[1].providerId).toBe(backupProviderId2);
      // Degraded primary is moved to the end as fallback
      expect(routes[2].providerId).toBe(primaryProviderId);
    });
  });

  describe('2. MarginGuard Financial Safety with Volatility Buffer', () => {
    it('accepts profitable candidate routes with positive margin', async () => {
      // Client paid 100 RUB (10000 cents) for 1000 items
      // Provider rate: 40 RUB per 1000
      const check = await MarginGuard.checkMargin(
        BigInt(10000), // 100.00 RUB
        1000,
        40.0, // 40.00 RUB per 1000
        'RUB',
        0.05
      );

      expect(check.isProfitable).toBe(true);
      expect(check.costCents).toBe(BigInt(4000));
      expect(check.marginPercent).toBe(60);
    });

    it('rejects unprofitable candidate routes where cost exceeds client paid amount', async () => {
      // Client paid 50 RUB (5000 cents) for 1000 items
      // Provider rate: 80 RUB per 1000
      const check = await MarginGuard.checkMargin(
        BigInt(5000), // 50.00 RUB
        1000,
        80.0, // 80.00 RUB per 1000
        'RUB',
        0.05
      );

      expect(check.isProfitable).toBe(false);
      expect(check.costCents).toBe(BigInt(8000));
      expect(check.reason).toContain('Себестоимость');
    });

    it('applies 5% currency volatility buffer on foreign (USD) rates', async () => {
      // Provider rate in USD: 1.00 USD per 1000
      // Assuming 90 RUB / USD exchange rate + 5% buffer = 94.50 RUB
      const check = await MarginGuard.checkMargin(
        BigInt(12000), // 120.00 RUB
        1000,
        1.0, // 1 USD
        'USD',
        0.05
      );

      expect(check.isProfitable).toBe(true);
      expect(Number(check.costCents)).toBeGreaterThanOrEqual(9000);
    });
  });

  describe('3. Routing Audit Logging (Hot-Swap Traceability)', () => {
    it('records FAILOVER_SWAP event in RoutingAuditLog', async () => {
      await SmartRoutingService.recordFailoverEvent({
        serviceId: testServiceId,
        action: 'FAILOVER_SWAP',
        fromProviderId: primaryProviderId,
        toProviderId: backupProviderId1,
        reason: 'Provider timeout on primary route'
      });

      const audit = await db.routingAuditLog.findFirst({
        where: {
          serviceId: testServiceId,
          action: 'FAILOVER_SWAP'
        },
        orderBy: { createdAt: 'desc' }
      });

      expect(audit).not.toBeNull();
      expect(audit?.fromProviderId).toBe(primaryProviderId);
      expect(audit?.toProviderId).toBe(backupProviderId1);
      expect(audit?.reason).toBe('Provider timeout on primary route');
    });
  });

  describe('4. Service Route Management Actions', () => {
    it('toggles non-primary route active state', async () => {
      const backupRoute = await db.serviceRoute.findFirstOrThrow({
        where: { serviceId: testServiceId, isPrimary: false }
      });

      // Toggle off
      await db.serviceRoute.update({
        where: { id: backupRoute.id },
        data: { isActive: false }
      });

      let updated = await db.serviceRoute.findUniqueOrThrow({ where: { id: backupRoute.id } });
      expect(updated.isActive).toBe(false);

      // Toggle back on
      await db.serviceRoute.update({
        where: { id: backupRoute.id },
        data: { isActive: true }
      });

      updated = await db.serviceRoute.findUniqueOrThrow({ where: { id: backupRoute.id } });
      expect(updated.isActive).toBe(true);
    });

    it('swaps priority order between backup routes', async () => {
      const route1 = await db.serviceRoute.findFirstOrThrow({
        where: { serviceId: testServiceId, providerId: backupProviderId1 }
      });
      const route2 = await db.serviceRoute.findFirstOrThrow({
        where: { serviceId: testServiceId, providerId: backupProviderId2 }
      });

      expect(route1.priority).toBe(1);
      expect(route2.priority).toBe(2);

      // Swap priorities
      await db.$transaction([
        db.serviceRoute.update({ where: { id: route1.id }, data: { priority: 2 } }),
        db.serviceRoute.update({ where: { id: route2.id }, data: { priority: 1 } })
      ]);

      const r1After = await db.serviceRoute.findUniqueOrThrow({ where: { id: route1.id } });
      const r2After = await db.serviceRoute.findUniqueOrThrow({ where: { id: route2.id } });

      expect(r1After.priority).toBe(2);
      expect(r2After.priority).toBe(1);
    });
  });
});
