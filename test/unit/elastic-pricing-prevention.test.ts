import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock Setup using Hoisted Variables ──

const { mockDb, mockSendAdminAlert, mockProviderInstance } = vi.hoisted(() => {
  let shadowServiceDb: any[] = [];
  return {
    mockDb: {
      $queryRaw: vi.fn().mockResolvedValue([]),
      $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
      $disconnect: vi.fn().mockResolvedValue(undefined),
      $transaction: vi.fn().mockImplementation(async (updates) => {
        if (typeof updates === 'function') {
          return updates(mockDb);
        }
        if (Array.isArray(updates)) {
          return Promise.all(updates);
        }
        return updates;
      }),
      systemSettings: {
        upsert: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
        findUnique: vi.fn().mockResolvedValue({ exchangeRateUSD: 100 }),
      },
      provider: {
        findFirst: vi.fn().mockResolvedValue({ id: 'prov-1', name: 'Butik', isActive: true, balanceCurrency: 'USD' }),
        findUnique: vi.fn().mockResolvedValue({ id: 'prov-1', name: 'Butik', isActive: true, balanceCurrency: 'USD' }),
        findMany: vi.fn().mockResolvedValue([{ id: 'prov-1', name: 'Butik', isActive: true, balanceCurrency: 'USD' }]),
      },
      tenant: {
        findUnique: vi.fn().mockResolvedValue({ id: 'tenant-1', slug: 'smmplan' }),
        findFirst: vi.fn().mockResolvedValue({ id: 'tenant-1', slug: 'smmplan' }),
      },
      category: {
        findUnique: vi.fn().mockResolvedValue({ id: 'cat-1', name: 'Cat 1' }),
        findMany: vi.fn().mockResolvedValue([]),
      },
      service: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
      shadowService: {
        count: vi.fn().mockResolvedValue(0),
        deleteMany: vi.fn().mockImplementation(async () => {
          shadowServiceDb = [];
          return { count: 0 };
        }),
        createMany: vi.fn().mockImplementation(async ({ data }) => {
          shadowServiceDb.push(...data);
          return { count: data.length };
        }),
        findMany: vi.fn().mockImplementation(async () => {
          return shadowServiceDb;
        }),
      },
      routingAuditLog: {
        create: vi.fn(),
      },
      servicePriceHistory: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
      }
    },
    mockSendAdminAlert: vi.fn(),
    mockProviderInstance: {
      getServices: vi.fn()
    }
  };
});

vi.mock('@/lib/db', () => ({
  db: mockDb
}));

vi.mock('@/lib/server/rbac', () => ({
  requireStaffPermission: vi.fn((domain, action, cb) => cb({ id: 'admin-1', email: 'admin@test.com' }))
}));

vi.mock('@/lib/redis-lock', () => ({
  MutexManager: {
    withLock: vi.fn((name, timeout, retry, cb) => cb())
  }
}));

vi.mock('@/lib/settings', () => ({
  SettingsManager: {
    get: vi.fn().mockResolvedValue({ exchangeRateUSD: 100, quarantineThreshold: 0.20 }),
    getExchangeRateUSD: vi.fn().mockResolvedValue(100),
    setExchangeRateUSD: vi.fn().mockResolvedValue(undefined)
  },
  SettingsProvider: {
    get: vi.fn().mockResolvedValue({ exchangeRateUSD: 100, quarantineThreshold: 0.20 }),
    getExchangeRateUSD: vi.fn().mockResolvedValue(100),
    setExchangeRateUSD: vi.fn().mockResolvedValue(undefined)
  }
}));

vi.mock('@/lib/admin-audit', () => ({
  auditAdmin: vi.fn()
}));

vi.mock('@/services/providers/post-sync-rules', () => ({
  applyPostSyncRules: vi.fn().mockResolvedValue({ success: true })
}));

vi.mock('@/lib/notifications', () => ({
  sendAdminAlert: (...args: any[]) => mockSendAdminAlert(...args)
}));

vi.mock('@/services/providers/provider.service', () => ({
  providerService: {
    getProviderInstance: vi.fn().mockResolvedValue(mockProviderInstance)
  }
}));

vi.mock('@/services/admin/audit-engine', () => ({
  ServiceAuditEngine: {
    auditAndFixService: vi.fn().mockImplementation((service, external, exchangeRate) => {
      // No-op to prevent auto-fixing low markups during pricing sync tests
      return [];
    })
  }
}));

// ── Imports ──
import { CBRRateService } from '../../src/services/system/cbr-rate.service';
import { QuarantineService } from '../../src/services/providers/quarantine.service';
import { adminSyncProviderCatalog } from '../../src/actions/admin/providers/sync-action';
import { SettingsManager } from '../../src/lib/settings';

describe('Stage 4 Milestone 2: Auto-Pricing, Elastic Quarantine & Loss Prevention', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('CBRRateService - Exchange Rate Synchronization', () => {
    it('TC-CBR-001: Fetches XML successfully from official CBR API', async () => {
      const mockXml = `
        <ValCurs Date="24.05.2026" name="Foreign Currency Market">
          <Valute ID="R01235">
            <NumCode>840</NumCode>
            <CharCode>USD</CharCode>
            <Nominal>1</Nominal>
            <Name>US Dollar</Name>
            <Value>96,5000</Value>
            <VunitRate>96,5</VunitRate>
          </Valute>
        </ValCurs>
      `;

      // @ts-expect-error: mock fetch
      global.fetch.mockResolvedValueOnce({
        ok: true,
        text: async () => mockXml
      });

      const result = await CBRRateService.syncCBRExchangeRate();

      expect(result.nominalRate).toBe(96.5);
      expect(result.systemRate).toBe(99.39); // 96.5 * 1.03 = 99.395 -> Math.round is 99.39 in floating point precision representation
      expect(result.updated).toBe(true);
      expect(SettingsManager.setExchangeRateUSD).toHaveBeenCalledWith(99.39, undefined);
    });

    it('TC-CBR-002: Falls back to JSON mirror when XML fetch fails', async () => {
      // XML fetch fails
      // @ts-expect-error: mock fetch
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      // JSON mirror succeeds
      const mockJson = {
        Valute: {
          USD: {
            Value: 95.5
          }
        }
      };
      // @ts-expect-error: mock fetch
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockJson
      });

      const result = await CBRRateService.syncCBRExchangeRate();

      expect(result.nominalRate).toBe(95.5);
      expect(result.systemRate).toBe(98.37); // 95.5 * 1.03 = 98.365 -> 98.37
      expect(result.updated).toBe(true);
      expect(SettingsManager.setExchangeRateUSD).toHaveBeenCalledWith(98.37, undefined);
    });

    it('TC-CBR-003: Gracefully falls back to existing DB rate when both APIs fail', async () => {
      // Both fail
      // @ts-expect-error: mock fetch
      global.fetch.mockRejectedValue(new Error('All networks down'));
      vi.spyOn(SettingsManager, 'getExchangeRateUSD').mockResolvedValue(100.5);

      const result = await CBRRateService.syncCBRExchangeRate();

      expect(result.nominalRate).toBe(100.5);
      expect(result.systemRate).toBe(100.5);
      expect(result.updated).toBe(false);
    });
  });

  describe('QuarantineService - Rule Helpers', () => {
    it('TC-QRN-001: shouldQuarantine flags >20% price spike properly', () => {
      expect(QuarantineService.shouldQuarantine(10, 11)).toBe(false); // +10%
      expect(QuarantineService.shouldQuarantine(10, 12)).toBe(false); // +20% (boundary)
      expect(QuarantineService.shouldQuarantine(10, 12.1)).toBe(true); // +21% (spike)
      expect(QuarantineService.shouldQuarantine(0, 10)).toBe(false); // Initial sync
    });

    it('TC-QRN-002: isLossBreach detects unprofitable prices correctly', () => {
      // 1. Unprofitable scenario: Markup = 0.5 (below cost), usdToRub = 100
      // Rate = 1 USD per 1k -> Cost = 100 RUB. Price per 1k = 50 RUB. Retail per unit = 0.05 RUB.
      // Purchase cost per unit = 0.1 RUB. 0.05 < 0.1 (breach!)
      expect(QuarantineService.isLossBreach(1, 0.5, 100)).toBe(true);

      // 2. Profitable scenario: Markup = 3.5 (above SAFETY_FLOOR_MARKUP 3.0)
      // Price per 1k = 350 RUB. Retail per unit = 0.35 RUB.
      // Purchase cost per unit = 0.10 RUB. 0.35 >= 0.30 (profitable)
      expect(QuarantineService.isLossBreach(1, 3.5, 100)).toBe(false);
    });
  });

  describe('adminSyncProviderCatalog - Synchronization Flow', () => {
    beforeEach(() => {
      vi.spyOn(SettingsManager, 'getExchangeRateUSD').mockResolvedValue(100);
      mockDb.provider.findFirst.mockResolvedValue({ id: 'prov-1', name: 'Butik', isActive: true, balanceCurrency: 'USD' });
      mockDb.provider.findMany.mockResolvedValue([{ id: 'prov-1', name: 'Butik', isActive: true, balanceCurrency: 'USD' }]);
      mockDb.provider.findUnique.mockResolvedValue({ id: 'prov-1', name: 'Butik', isActive: true, balanceCurrency: 'USD' });
    });

    it('TC-SYN-001: Performs successful pricing update when conditions are normal', async () => {
      // Curated service list
      mockDb.service.findMany.mockResolvedValueOnce([
        { id: 'srv-1', externalId: 'ext-1', rate: 1.0, markup: 2.0, isActive: true, isQuarantined: false, pricePer1000Cents: 20000, providerCurrency: 'USD' }
      ]);

      // Fresh provider rates (rate didn't spike, stays 1.1)
      mockProviderInstance.getServices.mockResolvedValueOnce([
        { service: 'ext-1', name: 'Test Service', rate: '1.1', min: '10', max: '10000' }
      ]);

      mockDb.service.update.mockResolvedValueOnce({});

      const result = (await adminSyncProviderCatalog()) as any;

      expect(result.success).toBe(true);
      expect(result.stats?.updatedCount).toBe(1);
      expect(result.stats?.disabledCount).toBe(0);

      // Verify DB update with Price Recalculation (rate increase <= 10% is recalculated to preserve markup percentage)
      expect(mockDb.service.update).toHaveBeenCalledWith({
        where: { id: 'srv-1' },
        data: expect.objectContaining({
          rate: 1.1,
          pricePer1000Cents: 33000,
          providerCurrency: 'USD',
          markup: 3.0,
          minQty: 10,
          maxQty: 10000,
          lastSeenAt: expect.any(Date),
          isQuarantined: false,
          quarantineReason: null
        })
      });
    });

    it('TC-SYN-002: Triggers quarantine automatically on >20% price spike', async () => {
      // Curated service list
      mockDb.service.findMany.mockResolvedValueOnce([
        { id: 'srv-1', externalId: 'ext-1', rate: 1.0, markup: 2.0, isActive: true, isQuarantined: false, pricePer1000Cents: 20000, providerCurrency: 'USD' }
      ]);

      // Fresh provider rates (rate jumped from 1.0 to 1.3 -> +30%)
      mockProviderInstance.getServices.mockResolvedValueOnce([
        { service: 'ext-1', name: 'Test Service', rate: '1.3', min: '10', max: '10000' }
      ]);

      mockDb.service.update.mockResolvedValueOnce({});

      const result = (await adminSyncProviderCatalog()) as any;

      expect(result.success).toBe(true);
      expect(result.stats?.updatedCount).toBe(0);
      expect(result.stats?.disabledCount).toBe(1); // Quarantined

      expect(mockDb.service.update).toHaveBeenCalledWith({
        where: { id: 'srv-1' },
        data: {
          isQuarantined: true,
          quarantineReason: expect.stringContaining("Price Spike"),
          isActive: false,
          pendingRate: 1.3,
          quarantinedAt: expect.any(Date)
        }
      });

      expect(mockSendAdminAlert).toHaveBeenCalledWith(
        expect.stringContaining('Price spike'),
        'WARNING'
      );
    });

    it('TC-SYN-003: Triggers Loss Prevention deactivation when retail is unprofitable', async () => {
      // Curated service list with unsafe low markup (e.g. 0.4)
      mockDb.service.findMany.mockResolvedValueOnce([
        { id: 'srv-1', externalId: 'ext-1', rate: 1.0, markup: 0.4, isActive: true, isQuarantined: false, pricePer1000Cents: 4000, providerCurrency: 'USD' }
      ]);

      // Fresh provider rates
      mockProviderInstance.getServices.mockResolvedValueOnce([
        { service: 'ext-1', name: 'Test Service', rate: '1.0', min: '10', max: '10000' }
      ]);

      mockDb.service.update.mockResolvedValueOnce({});
      mockDb.routingAuditLog.create.mockResolvedValueOnce({});

      const result = (await adminSyncProviderCatalog()) as any;

      expect(result.success).toBe(true);
      expect(result.stats?.disabledCount).toBe(1); // Deactivated due to loss

      expect(mockDb.service.update).toHaveBeenCalledWith({
        where: { id: 'srv-1' },
        data: {
          isActive: false,
          lastSeenAt: expect.any(Date)
        }
      });

      expect(mockDb.routingAuditLog.create).toHaveBeenCalledWith({
        data: {
          serviceId: 'srv-1',
          action: 'LOSS_PREVENTION_BLOCK',
          reason: expect.stringContaining('Retail price')
        }
      });

      expect(mockSendAdminAlert).toHaveBeenCalledWith(
        expect.stringContaining('автоматически отключена! Розничная цена'),
        'CRITICAL'
      );
    });
  });
});
