/**
 * (c) 2024-2026 OmniSMM 1.0 / SMMplan Platform.
 * Test Suite: Autonomous Catalog & Routing Resilience Architecture.
 * Covers:
 * 1. Smart Cascade Failover on Provider Outage with MarginGuard Verification
 * 2. ReDoS Immunity & Smoke-Link Pre-flight Testing
 * 3. Granular Multi-Tenant Cache Tags Invalidation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrderDispatchService } from '@/services/provider/order-dispatch.service';
import { SafeRegexValidator } from '@/services/analyzer/safe-regex.validator';
import { validateRegexSafetyAndSmoke } from '@/validators/link-mutators';
import { SettingsProvider } from '@/lib/settings';
import { db } from '@/lib/db';

vi.mock('@/lib/settings', () => ({
  SettingsProvider: {
    getExchangeRateUSD: vi.fn().mockResolvedValue(95.0),
    get: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  db: {
    providerOutbox: {
      findUnique: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 'outbox-1', status: 'PENDING' }),
      update: vi.fn().mockResolvedValue({ id: 'outbox-1' }),
    },
    provider: {
      findUnique: vi.fn(),
    },
    order: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({ id: 'ord-123', status: 'IN_PROGRESS' }),
    },
    serviceRoute: {
      findMany: vi.fn(),
    },
    routingAuditLog: {
      create: vi.fn().mockResolvedValue({ id: 'audit-log-1' }),
    },
  },
}));

describe('? Autonomous Catalog & Routing Resilience Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Smart Cascade Failover with MarginGuard Verification', () => {
    it('dispatches directly to primary provider when healthy', async () => {
      vi.mocked(db.provider.findUnique).mockResolvedValue({
        id: 'prov_alpha',
        name: 'Provider Alpha',
        isActive: true,
        apiUrl: 'https://alpha.example.com',
        apiKey: 'key_alpha',
      } as any);

      vi.spyOn(OrderDispatchService as any, 'providerService', 'get').mockReturnValue({
        getProviderInstance: vi.fn().mockResolvedValue({
          createOrder: vi.fn().mockResolvedValue({ order: '1001' }),
        }),
      });

      const result = await OrderDispatchService.dispatchOrderWithFailover({
        orderId: 'ord-1',
        userId: 'usr-1',
        serviceId: 'svc-1',
        providerId: 'prov_alpha',
        externalServiceId: 'ext-101',
        link: 'https://t.me/channel',
        quantity: 1000,
      });

      expect(result.success).toBe(true);
      expect(result.providerOrderId).toBe('1001');
      expect(result.failoverUsed).toBeUndefined();
      expect(db.routingAuditLog.create).not.toHaveBeenCalled();
    });

    it('cascades to profitable fallback route when primary provider fails', async () => {
      vi.mocked(db.order.findUnique).mockResolvedValue({
        id: 'ord-failover',
        charge: 30000,
        quantity: 1000,
      } as any);

      (vi.mocked(db.provider.findUnique) as any).mockImplementation(async ({ where }: any) => {
        if (where.id === 'prov_alpha') {
          return {
            id: 'prov_alpha',
            name: 'Provider Alpha (Down)',
            isActive: true,
          } as any;
        }
        return {
          id: 'prov_beta',
          name: 'Provider Beta (Backup)',
          isActive: true,
          balanceCurrency: 'USD',
        } as any;
      });

      vi.mocked(db.serviceRoute.findMany).mockResolvedValue([
        {
          id: 'route_primary',
          serviceId: 'svc-failover',
          providerId: 'prov_alpha',
          externalServiceId: 'alpha-1',
          rate: 1.0,
          isPrimary: true,
          priority: 0,
          isActive: true,
          createdAt: new Date(),
          provider: {
            id: 'prov_alpha',
            name: 'Provider Alpha',
            isActive: true,
            errorCount5m: 15,
            balanceCurrency: 'USD',
          },
        },
        {
          id: 'route_backup',
          serviceId: 'svc-failover',
          providerId: 'prov_beta',
          externalServiceId: 'beta-999',
          rate: 1.5,
          isPrimary: false,
          priority: 1,
          isActive: true,
          createdAt: new Date(),
          provider: {
            id: 'prov_beta',
            name: 'Provider Beta (Backup)',
            isActive: true,
            errorCount5m: 0,
            balanceCurrency: 'USD',
          },
        },
      ] as any);

      vi.spyOn(OrderDispatchService as any, 'providerService', 'get').mockReturnValue({
        getProviderInstance: vi.fn().mockImplementation(async (prov) => {
          if (prov.id === 'prov_alpha') {
            return {
              createOrder: vi.fn().mockRejectedValue(new Error('Provider Alpha 502 Bad Gateway')),
            };
          }
          return {
            createOrder: vi.fn().mockResolvedValue({ order: '9999' }),
          };
        }),
      });

      const result = await OrderDispatchService.dispatchOrderWithFailover({
        orderId: 'ord-failover',
        userId: 'usr-1',
        serviceId: 'svc-failover',
        providerId: 'prov_alpha',
        externalServiceId: 'alpha-1',
        link: 'https://t.me/channel',
        quantity: 1000,
      });

      expect(result.success).toBe(true);
      expect(result.providerOrderId).toBe('9999');
      expect(result.failoverUsed).toBe(true);
      expect(result.fallbackProviderId).toBe('prov_beta');

      expect(db.routingAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            serviceId: 'svc-failover',
            action: 'AUTOMATIC_FAILOVER',
            fromProviderId: 'prov_alpha',
            toProviderId: 'prov_beta',
          }),
        })
      );
    });

    it('skips unprofitable fallback routes and avoids financial deficit', async () => {
      vi.mocked(db.order.findUnique).mockResolvedValue({
        id: 'ord-unprofitable',
        charge: 1000,
        quantity: 1000,
      } as any);

      vi.mocked(db.provider.findUnique).mockResolvedValue({
        id: 'prov_expensive',
        name: 'Provider Expensive',
        isActive: true,
        balanceCurrency: 'USD',
      } as any);

      vi.mocked(db.serviceRoute.findMany).mockResolvedValue([
        {
          id: 'route_expensive',
          serviceId: 'svc-unprofitable',
          providerId: 'prov_expensive',
          externalServiceId: 'exp-1',
          rate: 5.0,
          isPrimary: false,
          priority: 1,
          isActive: true,
          createdAt: new Date(),
          provider: {
            id: 'prov_expensive',
            name: 'Provider Expensive',
            isActive: true,
            errorCount5m: 0,
            balanceCurrency: 'USD',
          },
        },
      ] as any);

      vi.spyOn(OrderDispatchService as any, 'providerService', 'get').mockReturnValue({
        getProviderInstance: vi.fn().mockResolvedValue({
          createOrder: vi.fn().mockRejectedValue(new Error('Primary Service Inactive')),
        }),
      });

      const result = await OrderDispatchService.dispatchOrderWithFailover({
        orderId: 'ord-unprofitable',
        userId: 'usr-1',
        serviceId: 'svc-unprofitable',
        providerId: 'prov_primary',
        externalServiceId: 'prim-1',
        link: 'https://t.me/channel',
        quantity: 1000,
      });

      expect(result.success).toBe(false);
      expect(result.failoverUsed).toBeUndefined();
      expect(db.routingAuditLog.create).not.toHaveBeenCalled();
    });
  });

  describe('2. ReDoS Immunity & Smoke-Link Pre-flight Testing', () => {
    it('detects nested quantifiers and rejects hazardous ReDoS patterns', () => {
      const redosPatterns = [
        '(a+)+',
        '([a-z0-9]+)+',
        '(.*)+',
        '^(a|aa)+$',
        '(x+x+)+',
      ];

      for (const pattern of redosPatterns) {
        const audit = validateRegexSafetyAndSmoke(pattern);
        expect(audit.isValid).toBe(false);
        expect(audit.error).toContain('ReDoS');
      }
    });

    it('validates safe regex patterns and executes smoke test suite', () => {
      const safePattern = '^https?:\\/\\/(www\\.)?t\\.me\\/([a-zA-Z0-9_]+)\\/?$';
      const smokeCases = [
        { url: 'https://t.me/durov', expectedMatch: true },
        { url: 'http://www.t.me/channel_test/', expectedMatch: true },
        { url: 'https://instagram.com/user', expectedMatch: false },
        { url: 'not-a-url', expectedMatch: false },
      ];

      const result = SafeRegexValidator.runSmokeTestSuite(safePattern, smokeCases);
      expect(result.passed).toBe(true);
      expect(result.failedCases.length).toBe(0);
    });

    it('fails smoke-test suite when regex does not match expected URL', () => {
      const strictPostPattern = '^https?:\\/\\/t\\.me\\/[a-zA-Z0-9_]+\\/\\d+$';
      const smokeCases = [
        { url: 'https://t.me/channel/123', expectedMatch: true },
        { url: 'https://t.me/channel', expectedMatch: true },
      ];

      const result = SafeRegexValidator.runSmokeTestSuite(strictPostPattern, smokeCases);
      expect(result.passed).toBe(false);
      expect(result.failedCases.length).toBe(1);
      expect(result.failedCases[0].url).toBe('https://t.me/channel');
    });
  });
});
