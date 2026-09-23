import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MarginGuard, SmartRoutingService } from '@/services/providers/smart-routing.service';
import { SettingsProvider } from '@/lib/settings';
import { db } from '@/lib/db';

vi.mock('@/lib/settings', () => ({
  SettingsProvider: {
    getExchangeRateUSD: vi.fn(),
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
  },
}));

describe('Smart Routing & MarginGuard Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('MarginGuard.checkMargin', () => {
    it('returns isProfitable: true when order price exceeds provider cost', async () => {
      vi.mocked(SettingsProvider.getExchangeRateUSD).mockResolvedValue(100.0);

      // Client paid 200 RUB (20000 kopecks).
      // Cost: 1.0 USD * 100 USD/RUB * 1.05 (buffer) = 105 RUB (10500 kopecks).
      const result = await MarginGuard.checkMargin(
        BigInt(20000),
        1000,
        1.0,
        'USD'
      );

      expect(result.isProfitable).toBe(true);
      expect(result.costCents).toBe(BigInt(10500));
      expect(result.clientPaidCents).toBe(BigInt(20000));
      expect(result.marginPercent).toBeGreaterThan(0);
      expect(result.reason).toBeUndefined();
    });

    it('returns isProfitable: false and includes reason when cost exceeds order price', async () => {
      vi.mocked(SettingsProvider.getExchangeRateUSD).mockResolvedValue(100.0);

      // Client paid 50 RUB (5000 kopecks).
      // Cost: 1.0 USD * 100 USD/RUB * 1.05 = 105 RUB (10500 kopecks).
      const result = await MarginGuard.checkMargin(
        BigInt(5000),
        1000,
        1.0,
        'USD'
      );

      expect(result.isProfitable).toBe(false);
      expect(result.costCents).toBe(BigInt(10500));
      expect(result.clientPaidCents).toBe(BigInt(5000));
      expect(result.marginPercent).toBeLessThan(0);
      expect(result.reason).toBeDefined();
      expect(result.reason).toContain('превышает оплату клиента');
    });

    it('correctly applies 5% currency volatility buffer to protect against exchange rate swings', async () => {
      vi.mocked(SettingsProvider.getExchangeRateUSD).mockResolvedValue(100.0);

      // Order price: 102 RUB (10200 kopecks).
      // Without buffer: 1.0 USD * 100 = 100 RUB (10000 kopecks) -> would be profitable.
      // With 5% buffer: 1.0 USD * 100 * 1.05 = 105 RUB (10500 kopecks) -> unprofitable!
      const resultWithBuffer = await MarginGuard.checkMargin(
        BigInt(10200),
        1000,
        1.0,
        'USD'
      );

      expect(resultWithBuffer.isProfitable).toBe(false);
      expect(resultWithBuffer.costCents).toBe(BigInt(10500));
      expect(resultWithBuffer.reason).toContain('10500 коп');

      // If buffer is explicitly set to 0%, the same order becomes profitable
      const resultWithoutBuffer = await MarginGuard.checkMargin(
        BigInt(10200),
        1000,
        1.0,
        'USD',
        0.0
      );

      expect(resultWithoutBuffer.isProfitable).toBe(true);
      expect(resultWithoutBuffer.costCents).toBe(BigInt(10000));
    });

    it('evaluates RUB provider rates without foreign currency multiplier', async () => {
      // 100 RUB rate per 1000 for quantity 1000 = 100 RUB (10000 kopecks).
      // Client paid 150 RUB (15000 kopecks).
      const result = await MarginGuard.checkMargin(
        BigInt(15000),
        1000,
        100.0,
        'RUB'
      );

      expect(result.isProfitable).toBe(true);
      expect(result.costCents).toBe(BigInt(10000));
      expect(result.clientPaidCents).toBe(BigInt(15000));
    });
  });

  describe('SmartRoutingService.getPrioritizedRoutes', () => {
    it('sorts candidate routes by isPrimary desc, priority asc, and pushes degraded providers to end', async () => {
      const mockRoutes = [
        {
          id: 'route-1-primary',
          serviceId: 'svc-1',
          providerId: 'prov-1',
          providerServiceId: 'ext-1',
          isPrimary: true,
          priority: 0,
          failoverMode: 'automatic',
          provider: {
            id: 'prov-1',
            name: 'Provider 1 (Healthy Primary)',
            apiUrl: 'https://p1.com',
            apiKey: 'k1',
            isActive: true,
            balanceCurrency: 'USD',
            errorCount5m: 0,
          },
        },
        {
          id: 'route-2-degraded-primary',
          serviceId: 'svc-1',
          providerId: 'prov-2',
          providerServiceId: 'ext-2',
          isPrimary: true,
          priority: 1,
          failoverMode: 'automatic',
          provider: {
            id: 'prov-2',
            name: 'Provider 2 (Degraded Primary)',
            apiUrl: 'https://p2.com',
            apiKey: 'k2',
            isActive: true,
            balanceCurrency: 'USD',
            errorCount5m: 12, // > 10 errors
          },
        },
        {
          id: 'route-3-backup-high-prio',
          serviceId: 'svc-1',
          providerId: 'prov-3',
          providerServiceId: 'ext-3',
          isPrimary: false,
          priority: 0,
          failoverMode: 'automatic',
          provider: {
            id: 'prov-3',
            name: 'Provider 3 (Healthy Backup 0)',
            apiUrl: 'https://p3.com',
            apiKey: 'k3',
            isActive: true,
            balanceCurrency: 'RUB',
            errorCount5m: 2,
          },
        },
        {
          id: 'route-4-backup-low-prio',
          serviceId: 'svc-1',
          providerId: 'prov-4',
          providerServiceId: 'ext-4',
          isPrimary: false,
          priority: 5,
          failoverMode: 'automatic',
          provider: {
            id: 'prov-4',
            name: 'Provider 4 (Healthy Backup 5)',
            apiUrl: 'https://p4.com',
            apiKey: 'k4',
            isActive: true,
            balanceCurrency: 'USD',
            errorCount5m: 0,
          },
        },
      ];

      vi.mocked(db.serviceRoute.findMany).mockResolvedValue(mockRoutes as never);

      const prioritized = await SmartRoutingService.getPrioritizedRoutes('svc-1');

      // Verify db query parameters
      expect(db.serviceRoute.findMany).toHaveBeenCalledWith({
        where: {
          serviceId: 'svc-1',
          isActive: true,
          provider: {
            isActive: true,
          },
        },
        include: {
          provider: true,
        },
        orderBy: [
          { isPrimary: 'desc' },
          { priority: 'asc' },
          { createdAt: 'asc' },
        ],
      });

      // Assert healthy routes come first in order, followed by degraded routes
      expect(prioritized).toHaveLength(4);
      expect(prioritized[0].id).toBe('route-1-primary');
      expect(prioritized[1].id).toBe('route-3-backup-high-prio');
      expect(prioritized[2].id).toBe('route-4-backup-low-prio');
      expect(prioritized[3].id).toBe('route-2-degraded-primary'); // Pushed to end due to errorCount5m > 10
    });

    it('records failover events to RoutingAuditLog', async () => {
      await SmartRoutingService.recordFailoverEvent({
        serviceId: 'svc-1',
        action: 'FAILOVER_SWAP',
        fromProviderId: 'prov-1',
        toProviderId: 'prov-3',
        reason: 'Primary provider timed out',
      });

      expect(db.routingAuditLog.create).toHaveBeenCalledWith({
        data: {
          serviceId: 'svc-1',
          adminId: null,
          action: 'FAILOVER_SWAP',
          fromProviderId: 'prov-1',
          toProviderId: 'prov-3',
          reason: 'Primary provider timed out',
        },
      });
    });
  });
});
