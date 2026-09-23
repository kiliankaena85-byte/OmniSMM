import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProviderBalanceService, CachedProviderBalance } from '@/services/admin/provider-balance.service';
import { db } from '@/lib/db';
import { redis } from '@/lib/redis';
import { providerService } from '@/services/providers/provider.service';
import { sendAdminAlert } from '@/lib/notifications';

vi.mock('@/lib/db', () => ({
  db: {
    provider: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    order: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { providerCost: BigInt(50000) } }),
    },
  },
}));

vi.mock('@/lib/redis', () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
  },
}));

vi.mock('@/lib/settings', () => ({
  SettingsProvider: {
    getExchangeRateUSD: vi.fn().mockResolvedValue(95.0),
  },
}));

vi.mock('@/lib/notifications', () => ({
  sendAdminAlert: vi.fn().mockResolvedValue(undefined),
}));

describe('Provider Balance & Multi-Currency Liquidity Test Suite', () => {
  let service: ProviderBalanceService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProviderBalanceService();
  });

  describe('1. Real Provider Balance & Multi-Currency Parsing', () => {
    it('accurately parses VexBoost real balance: 2.0936 RUB -> 2.09 RUB (~$0.02 USD), status: critical', async () => {
      const mockProvider = {
        id: 'cmswm47y60000hqrkoljy8wde',
        name: 'VexBoost',
        apiUrl: 'https://vexboost.ru/api/v2',
        apiKey: 'key_vex_123',
        balanceCurrency: 'RUB',
        isActive: true,
        avgResponseMs: 150,
      };

      (db.provider.findUnique as any).mockResolvedValue(mockProvider);
      vi.spyOn(providerService, 'getProviderInstance').mockResolvedValue({
        getBalance: vi.fn().mockResolvedValue({ balance: '2.0936', currency: 'RUB' }),
      } as any);

      const result = await service.getProviderBalance('cmswm47y60000hqrkoljy8wde', true);

      expect(result.providerName).toBe('VexBoost');
      expect(result.balance).toBe(2.0936);
      expect(result.rawBalance).toBe('2.0936');
      expect(result.currency).toBe('RUB');
      expect(result.balanceRub).toBe(2.09);
      expect(result.balanceUsd).toBe(0.02);
      expect(result.status).toBe('critical'); // 0.02 USD < 10 USD
    });

    it('accurately parses USD Provider balance: 15.50 USD -> 15.50 USD (~1472.50 RUB), status: warning', async () => {
      const mockProvider = {
        id: 'p_usd_1',
        name: 'US Provider',
        apiUrl: 'https://smmus.com/api/v2',
        apiKey: 'key_us_123',
        balanceCurrency: 'USD',
        isActive: true,
      };

      (db.provider.findUnique as any).mockResolvedValue(mockProvider);
      vi.spyOn(providerService, 'getProviderInstance').mockResolvedValue({
        getBalance: vi.fn().mockResolvedValue({ balance: '15.50', currency: 'USD' }),
      } as any);

      const result = await service.getProviderBalance('p_usd_1', true);

      expect(result.providerName).toBe('US Provider');
      expect(result.currency).toBe('USD');
      expect(result.balanceUsd).toBe(15.5);
      expect(result.balanceRub).toBe(1472.5); // 15.5 * 95
      expect(result.status).toBe('warning'); // 15.5 USD is >= 10 and <= 50
    });

    it('accurately parses EUR Provider balance: 100.00 EUR -> 108.00 USD (~10260.00 RUB), status: healthy', async () => {
      const mockProvider = {
        id: 'p_eur_1',
        name: 'Euro Provider',
        apiUrl: 'https://smmeur.com/api/v2',
        apiKey: 'key_eur_123',
        balanceCurrency: 'EUR',
        isActive: true,
      };

      (db.provider.findUnique as any).mockResolvedValue(mockProvider);
      vi.spyOn(providerService, 'getProviderInstance').mockResolvedValue({
        getBalance: vi.fn().mockResolvedValue({ balance: '100.00', currency: 'EUR' }),
      } as any);

      const result = await service.getProviderBalance('p_eur_1', true);

      expect(result.currency).toBe('EUR');
      expect(result.balanceUsd).toBe(108); // 100 * 1.08
      expect(result.balanceRub).toBe(10260); // 108 * 95
      expect(result.status).toBe('healthy'); // 108 USD > 50 USD
    });

    it('sanitizes messy raw string balances with commas and symbols ("2,09 ₽")', async () => {
      const mockProvider = {
        id: 'p_messy_1',
        name: 'Messy Provider',
        apiUrl: 'https://messy.ru/api/v2',
        apiKey: 'key_messy_123',
        balanceCurrency: 'RUB',
        isActive: true,
      };

      (db.provider.findUnique as any).mockResolvedValue(mockProvider);
      vi.spyOn(providerService, 'getProviderInstance').mockResolvedValue({
        getBalance: vi.fn().mockResolvedValue({ balance: '2,09 ₽', currency: 'RUB' }),
      } as any);

      const result = await service.getProviderBalance('p_messy_1', true);

      expect(result.balance).toBe(2.09);
      expect(result.balanceRub).toBe(2.09);
      expect(result.status).toBe('critical');
    });
  });

  describe('2. Telegram Alert Formatting Invariants (Zero Ambiguity)', () => {
    it('sends unambiguous RUB alert without "$0.02 (RUB)" contradiction', async () => {
      const mockProvider = {
        id: 'cmswm47y60000hqrkoljy8wde',
        name: 'VexBoost',
        apiUrl: 'https://vexboost.ru/api/v2',
        apiKey: 'key_vex_123',
        balanceCurrency: 'RUB',
        isActive: true,
      };

      (db.provider.findUnique as any).mockResolvedValue(mockProvider);
      vi.spyOn(providerService, 'getProviderInstance').mockResolvedValue({
        getBalance: vi.fn().mockResolvedValue({ balance: '2.09', currency: 'RUB' }),
      } as any);

      await service.getProviderBalance('cmswm47y60000hqrkoljy8wde', true);

      expect(sendAdminAlert).toHaveBeenCalledWith(
        expect.stringContaining('Баланс провайдера "VexBoost" = 2.09 ₽ (~$0.02) — ниже порога 950 ₽ ($10.00)'),
        'CRITICAL'
      );
      // Ensure the old contradictory pattern is NEVER generated
      const alertCall = vi.mocked(sendAdminAlert).mock.calls[0][0];
      expect(alertCall).not.toContain('$0.02 (RUB)');
    });

    it('sends clear USD alert for USD provider warning', async () => {
      const mockProvider = {
        id: 'p_usd_alert',
        name: 'Soc-Rocket',
        apiUrl: 'https://socrocket.com/api/v2',
        apiKey: 'key_soc_123',
        balanceCurrency: 'USD',
        isActive: true,
      };

      (db.provider.findUnique as any).mockResolvedValue(mockProvider);
      vi.spyOn(providerService, 'getProviderInstance').mockResolvedValue({
        getBalance: vi.fn().mockResolvedValue({ balance: '12.00', currency: 'USD' }),
      } as any);

      await service.getProviderBalance('p_usd_alert', true);

      expect(sendAdminAlert).toHaveBeenCalledWith(
        expect.stringContaining('Баланс провайдера "Soc-Rocket" = $12.00 (~1140.00 ₽) — ниже порога $50.00'),
        'WARNING'
      );
    });
  });

  describe('3. Global Liquidity Summary Aggregation', () => {
    it('aggregates multi-currency providers and calculates total liquidity and runway', async () => {
      const mockProviders = [
        {
          id: 'p1',
          name: 'VexBoost',
          apiUrl: 'https://vexboost.ru/api/v2',
          apiKey: 'k1',
          balanceCurrency: 'RUB',
          isActive: true,
        },
        {
          id: 'p2',
          name: 'Mock Provider Alpha',
          apiUrl: 'https://mock.smmplan.internal/api/v2',
          apiKey: 'k2',
          balanceCurrency: 'RUB',
          isActive: true,
        },
      ];

      (db.provider.findMany as any).mockResolvedValue(mockProviders);
      (db.provider.findUnique as any)
        .mockImplementation(({ where }: { where: { id: string } }) => {
          return Promise.resolve(mockProviders.find(p => p.id === where.id));
        });

      vi.spyOn(providerService, 'getProviderInstance')
        .mockImplementation((config: any) => {
          if (config.id === 'p1') {
            return Promise.resolve({
              getBalance: vi.fn().mockResolvedValue({ balance: '2.10', currency: 'RUB' }),
            } as any);
          }
          return Promise.resolve({
            getBalance: vi.fn().mockResolvedValue({ balance: '150000.00', currency: 'RUB' }),
          } as any);
        });

      const summary = await service.getGlobalLiquiditySummary(true);

      expect(summary.activeCount).toBe(2);
      expect(summary.criticalCount).toBe(1); // VexBoost
      expect(summary.healthyCount).toBe(1); // Mock Alpha
      expect(summary.totalRub).toBeCloseTo(150002.1, 1);
      expect(summary.providers.length).toBe(2);
    });
  });
});
