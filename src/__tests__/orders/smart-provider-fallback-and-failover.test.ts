/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Master Test Suite for Smart Provider Fallback & Failover Architecture.
 * Covers: Automatic Failover on Provider Error, MarginGuard Unprofitable Route Skipping,
 * Price Drift Hold Protection, and Routing Audit Logging.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SmartRoutingService, MarginGuard } from '@/services/providers/smart-routing.service';
import { SettingsProvider } from '@/lib/settings';
import { db } from '@/lib/db';

vi.mock('@/lib/settings', () => ({
  SettingsProvider: {
    getExchangeRateUSD: vi.fn(),
    get: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  db: {
    serviceRoute: {
      findMany: vi.fn(),
    },
    routingAuditLog: {
      create: vi.fn(),
    },
    order: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    provider: {
      findUnique: vi.fn(),
    },
  },
}));

describe('⚡ Smart Provider Fallback & Failover Architecture Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Dynamic Route Prioritization & Degradation Handling', () => {
    it('deprioritizes degraded providers (errorCount5m > 10) to the bottom of the list', async () => {
      const mockRoutes = [
        {
          id: 'route_primary_degraded',
          serviceId: 'svc_tg_subs',
          providerId: 'prov_alpha',
          isPrimary: true,
          priority: 0,
          isActive: true,
          provider: {
            id: 'prov_alpha',
            name: 'Provider Alpha (Degraded)',
            errorCount5m: 15, // Degraded!
            isActive: true,
          },
        },
        {
          id: 'route_backup_healthy',
          serviceId: 'svc_tg_subs',
          providerId: 'prov_beta',
          isPrimary: false,
          priority: 1,
          isActive: true,
          provider: {
            id: 'prov_beta',
            name: 'Provider Beta (Healthy)',
            errorCount5m: 2, // Healthy!
            isActive: true,
          },
        },
      ];

      vi.mocked(db.serviceRoute.findMany).mockResolvedValue(mockRoutes as any);

      const prioritized = await SmartRoutingService.getPrioritizedRoutes('svc_tg_subs');

      expect(prioritized.length).toBe(2);
      // Healthy backup should be prioritized first over the degraded primary
      expect(prioritized[0].providerId).toBe('prov_beta');
      expect(prioritized[1].providerId).toBe('prov_alpha');
    });
  });

  describe('2. MarginGuard Profitability Verification with 5% Currency Buffer', () => {
    it('approves candidate route when client payment covers provider cost with margin', async () => {
      vi.mocked(SettingsProvider.getExchangeRateUSD).mockResolvedValue(95.0);

      // Client paid 300 RUB (30000 kopecks) for 1000 items.
      // Provider rate: 2.0 USD / 1000.
      // Cost: 2.0 * 95 * 1.05 (buffer) = 199.5 RUB (20000 kopecks rounded up).
      const check = await MarginGuard.checkMargin(
        BigInt(30000),
        1000,
        2.0,
        'USD',
        0.05
      );

      expect(check.isProfitable).toBe(true);
      expect(check.costCents).toBe(BigInt(19950));
      expect(check.marginPercent).toBeGreaterThan(30);
      expect(check.reason).toBeUndefined();
    });

    it('rejects candidate route when provider rate surge causes negative margin (Price Drift)', async () => {
      vi.mocked(SettingsProvider.getExchangeRateUSD).mockResolvedValue(100.0);

      // Client paid 100 RUB (10000 kopecks).
      // Provider rate: 1.5 USD / 1000.
      // Cost: 1.5 * 100 * 1.05 = 157.5 RUB (15750 kopecks).
      const check = await MarginGuard.checkMargin(
        BigInt(10000),
        1000,
        1.5,
        'USD',
        0.05
      );

      expect(check.isProfitable).toBe(false);
      expect(check.costCents).toBe(BigInt(15750));
      expect(check.marginPercent).toBeLessThan(0);
      expect(check.reason).toContain('превышает оплату клиента');
    });
  });

  describe('3. Failover Audit Event Recording', () => {
    it('records FAILOVER_SWAP in RoutingAuditLog when switching providers', async () => {
      await SmartRoutingService.recordFailoverEvent({
        serviceId: 'svc_tg_001',
        action: 'FAILOVER_SWAP',
        fromProviderId: 'prov_primary',
        toProviderId: 'prov_backup',
        reason: 'Primary returned HTTP 502 Bad Gateway',
      });

      expect(db.routingAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          serviceId: 'svc_tg_001',
          action: 'FAILOVER_SWAP',
          fromProviderId: 'prov_primary',
          toProviderId: 'prov_backup',
          reason: 'Primary returned HTTP 502 Bad Gateway',
        }),
      });
    });

    it('records MARGIN_REJECTED in RoutingAuditLog when candidate route is unprofitable', async () => {
      await SmartRoutingService.recordFailoverEvent({
        serviceId: 'svc_tg_001',
        action: 'MARGIN_REJECTED',
        fromProviderId: 'prov_primary',
        toProviderId: 'prov_expensive_backup',
        reason: 'Cost exceeds client charge',
      });

      expect(db.routingAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          serviceId: 'svc_tg_001',
          action: 'MARGIN_REJECTED',
          fromProviderId: 'prov_primary',
          toProviderId: 'prov_expensive_backup',
        }),
      });
    });
  });
});
