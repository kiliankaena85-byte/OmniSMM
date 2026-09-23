import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { db } from '@/lib/db';
import { redis } from '@/lib/redis';
import { SettingsProvider } from '@/lib/settings';
import { providerService } from '@/services/providers/provider.service';
import { providerBalanceService } from '../provider-balance.service';

describe('ProviderBalanceService Unit Tests', () => {
  let testProviderUsd: any;
  let testProviderRub: any;
  let mockGetBalance: any;

  beforeEach(async () => {
    // Seed system settings
    await db.systemSettings.upsert({
      where: { id: 'smmplan' },
      update: { exchangeRateUSD: 100.0 },
      create: { id: 'smmplan', exchangeRateUSD: 100.0 },
    });

    vi.spyOn(SettingsProvider, 'getExchangeRateUSD').mockResolvedValue(100.0);

    // Create test providers
    testProviderUsd = await db.provider.upsert({
      where: { name: 'Test USD Provider' },
      update: {
        apiUrl: 'https://api.usd-provider.com/v2',
        apiKey: 'key-usd-123',
        isActive: true,
        balanceCurrency: 'USD',
        errorCount5m: 0,
        avgResponseMs: 120,
      },
      create: {
        id: 'test-prov-usd',
        name: 'Test USD Provider',
        apiUrl: 'https://api.usd-provider.com/v2',
        apiKey: 'key-usd-123',
        isActive: true,
        balanceCurrency: 'USD',
        errorCount5m: 0,
        avgResponseMs: 120,
      },
    });

    testProviderRub = await db.provider.upsert({
      where: { name: 'Test RUB Provider' },
      update: {
        apiUrl: 'https://api.rub-provider.com/v2',
        apiKey: 'key-rub-123',
        isActive: true,
        balanceCurrency: 'RUB',
        errorCount5m: 0,
        avgResponseMs: 150,
      },
      create: {
        id: 'test-prov-rub',
        name: 'Test RUB Provider',
        apiUrl: 'https://api.rub-provider.com/v2',
        apiKey: 'key-rub-123',
        isActive: true,
        balanceCurrency: 'RUB',
        errorCount5m: 0,
        avgResponseMs: 150,
      },
    });

    // Dynamically clear Redis cache using resolved provider IDs
    if (testProviderUsd?.id) {
      await redis.del(`provider:${testProviderUsd.id}:balance`);
    }
    if (testProviderRub?.id) {
      await redis.del(`provider:${testProviderRub.id}:balance`);
    }
    await redis.del('provider:test-prov-usd:balance');
    await redis.del('provider:test-prov-rub:balance');
    await redis.del('providers:global:liquidity');

    mockGetBalance = vi.fn();
    vi.spyOn(providerService, 'getProviderInstance').mockImplementation(async () => {
      return {
        getBalance: mockGetBalance,
        getServices: vi.fn(),
        createOrder: vi.fn(),
        getOrderStatus: vi.fn(),
        getMultiOrderStatus: vi.fn(),
        refill: vi.fn(),
        getRefillStatus: vi.fn(),
      };
    });
  });

  afterEach(async () => {
    if (testProviderUsd?.id) {
      await redis.del(`provider:${testProviderUsd.id}:balance`);
    }
    if (testProviderRub?.id) {
      await redis.del(`provider:${testProviderRub.id}:balance`);
    }
    await redis.del('provider:test-prov-usd:balance');
    await redis.del('provider:test-prov-rub:balance');
    await redis.del('providers:global:liquidity');
    vi.clearAllMocks();
  });

  describe('Cache Mechanism & TTL', () => {
    it('fetches from provider on cache miss and stores in Redis with 60s TTL', async () => {
      mockGetBalance.mockResolvedValueOnce({ balance: '150.00', currency: 'USD' });

      const result = await providerBalanceService.getProviderBalance(testProviderUsd.id);

      expect(mockGetBalance).toHaveBeenCalledTimes(1);
      expect(result.balance).toBe(150);
      expect(result.currency).toBe('USD');
      expect(result.balanceUsd).toBe(150);
      expect(result.balanceRub).toBe(15000); // 150 * 100
      expect(result.status).toBe('healthy');

      // Verify stored in Redis
      const cached = await redis.get(`provider:${testProviderUsd.id}:balance`);
      expect(cached).not.toBeNull();
      const parsed = JSON.parse(cached!);
      expect(parsed.balance).toBe(150);
      expect(parsed.status).toBe('healthy');
    });

    it('returns cached data on cache hit without invoking provider instance', async () => {
      const now = Date.now();
      const cachedPayload = {
        providerId: testProviderUsd.id,
        providerName: 'Test USD Provider',
        balance: 75,
        rawBalance: '75',
        currency: 'USD',
        balanceUsd: 75,
        balanceRub: 7500,
        status: 'healthy',
        latencyMs: 85,
        cachedAt: now,
        expiresAt: now + 60000,
      };

      await redis.set(`provider:${testProviderUsd.id}:balance`, JSON.stringify(cachedPayload), 'EX', 60);

      const result = await providerBalanceService.getProviderBalance(testProviderUsd.id);

      expect(mockGetBalance).not.toHaveBeenCalled();
      expect(result.balance).toBe(75);
      expect(result.balanceUsd).toBe(75);
      expect(result.status).toBe('healthy');
    });

    it('bypasses cache when forceRefresh is true and updates Redis', async () => {
      const oldCached = {
        providerId: testProviderUsd.id,
        providerName: 'Test USD Provider',
        balance: 20,
        rawBalance: '20',
        currency: 'USD',
        balanceUsd: 20,
        balanceRub: 2000,
        status: 'warning',
        latencyMs: 100,
        cachedAt: Date.now() - 30000,
        expiresAt: Date.now() + 30000,
      };
      await redis.set(`provider:${testProviderUsd.id}:balance`, JSON.stringify(oldCached), 'EX', 60);

      mockGetBalance.mockResolvedValueOnce({ balance: '200.00', currency: 'USD' });

      const result = await providerBalanceService.getProviderBalance(testProviderUsd.id, true);

      expect(mockGetBalance).toHaveBeenCalledTimes(1);
      expect(result.balance).toBe(200);
      expect(result.status).toBe('healthy');

      const cached = await redis.get(`provider:${testProviderUsd.id}:balance`);
      const parsed = JSON.parse(cached!);
      expect(parsed.balance).toBe(200);
    });
  });

  describe('3-Tier Health Status & Currency Normalization', () => {
    it('evaluates status as healthy when USD balance > 50', async () => {
      mockGetBalance.mockResolvedValueOnce({ balance: '50.01', currency: 'USD' });

      const result = await providerBalanceService.getProviderBalance(testProviderUsd.id);

      expect(result.status).toBe('healthy');
      expect(result.balanceUsd).toBe(50.01);
    });

    it('evaluates status as warning when USD balance is between 10 and 50', async () => {
      mockGetBalance.mockResolvedValueOnce({ balance: '35.50', currency: 'USD' });

      const result = await providerBalanceService.getProviderBalance(testProviderUsd.id);

      expect(result.status).toBe('warning');
      expect(result.balanceUsd).toBe(35.5);
    });

    it('evaluates status as critical when USD balance is below 10', async () => {
      mockGetBalance.mockResolvedValueOnce({ balance: '4.80', currency: 'USD' });

      const result = await providerBalanceService.getProviderBalance(testProviderUsd.id);

      expect(result.status).toBe('critical');
      expect(result.balanceUsd).toBe(4.8);
    });

    it('normalizes RUB balance to USD equivalent and calculates correct status', async () => {
      // 100 USD rate: 6000 RUB = 60 USD -> healthy
      mockGetBalance.mockResolvedValueOnce({ balance: '6000.00', currency: 'RUB' });

      const resultHealthy = await providerBalanceService.getProviderBalance(testProviderRub.id);
      expect(resultHealthy.balanceRub).toBe(6000);
      expect(resultHealthy.balanceUsd).toBe(60);
      expect(resultHealthy.status).toBe('healthy');

      // 2500 RUB = 25 USD -> warning
      await redis.del(`provider:${testProviderRub.id}:balance`);
      mockGetBalance.mockResolvedValueOnce({ balance: '2500.00', currency: 'RUB' });

      const resultWarning = await providerBalanceService.getProviderBalance(testProviderRub.id);
      expect(resultWarning.balanceRub).toBe(2500);
      expect(resultWarning.balanceUsd).toBe(25);
      expect(resultWarning.status).toBe('warning');

      // 800 RUB = 8 USD -> critical
      await redis.del(`provider:${testProviderRub.id}:balance`);
      mockGetBalance.mockResolvedValueOnce({ balance: '800.00', currency: 'RUB' });

      const resultCritical = await providerBalanceService.getProviderBalance(testProviderRub.id);
      expect(resultCritical.balanceRub).toBe(800);
      expect(resultCritical.balanceUsd).toBe(8);
      expect(resultCritical.status).toBe('critical');
    });

    it('normalizes EUR currency properly', async () => {
      mockGetBalance.mockResolvedValueOnce({ balance: '100.00', currency: 'EUR' });

      const result = await providerBalanceService.getProviderBalance(testProviderUsd.id);

      expect(result.balanceUsd).toBe(108); // 100 * 1.08
      expect(result.balanceRub).toBe(10800); // 108 * 100
      expect(result.status).toBe('healthy');
    });
  });

  describe('Error and Timeout Fallback Resilience', () => {
    it('handles provider API errors gracefully and records SLA failure', async () => {
      mockGetBalance.mockRejectedValueOnce(new Error('Invalid API key'));

      const result = await providerBalanceService.getProviderBalance(testProviderUsd.id);

      expect(result.status).toBe('error');
      expect(result.balance).toBe(0);
      expect(result.error).toContain('Неверный API-ключ');
      expect(result.suggestedFix).toBeDefined();

      // Check DB SLA error record
      const updatedProvider = await db.provider.findUnique({ where: { id: testProviderUsd.id } });
      expect(updatedProvider?.errorCount5m).toBeGreaterThan(0);
      expect(updatedProvider?.lastErrorAt).not.toBeNull();
    });

    it('handles non-existent provider ID gracefully', async () => {
      const result = await providerBalanceService.getProviderBalance('non-existent-id');

      expect(result.status).toBe('error');
      expect(result.error).toContain('не найден');
    });
  });

  describe('getAllProviderBalances & GlobalLiquiditySummary', () => {
    it('retrieves all active provider balances in parallel', async () => {
      mockGetBalance.mockImplementation(async () => {
        return { balance: '100.00', currency: 'USD' };
      });

      const balances = await providerBalanceService.getAllProviderBalances(true);

      expect(balances.length).toBeGreaterThanOrEqual(2);
      const usdItem = balances.find((b) => b.providerId === testProviderUsd.id);
      expect(usdItem).toBeDefined();
      expect(usdItem?.status).toBe('healthy');
    });

    it('calculates global liquidity summary using cached provider balances', async () => {
      // Seed provider 1 (Healthy: 100 USD = 10,000 RUB)
      await redis.set(
        `provider:${testProviderUsd.id}:balance`,
        JSON.stringify({
          providerId: testProviderUsd.id,
          providerName: 'Test USD Provider',
          balance: 100,
          rawBalance: '100',
          currency: 'USD',
          balanceUsd: 100,
          balanceRub: 10000,
          status: 'healthy',
          latencyMs: 80,
          cachedAt: Date.now(),
          expiresAt: Date.now() + 60000,
        }),
        'EX',
        60
      );

      // Seed provider 2 (Warning: 3000 RUB = 30 USD)
      await redis.set(
        `provider:${testProviderRub.id}:balance`,
        JSON.stringify({
          providerId: testProviderRub.id,
          providerName: 'Test RUB Provider',
          balance: 3000,
          rawBalance: '3000',
          currency: 'RUB',
          balanceUsd: 30,
          balanceRub: 3000,
          status: 'warning',
          latencyMs: 120,
          cachedAt: Date.now(),
          expiresAt: Date.now() + 60000,
        }),
        'EX',
        60
      );

      const summary = await providerBalanceService.getGlobalLiquiditySummary(false);

      expect(summary.totalRub).toBeGreaterThanOrEqual(13000);
      expect(summary.totalUsd).toBeGreaterThanOrEqual(130);
      expect(summary.healthyCount).toBeGreaterThanOrEqual(1);
      expect(summary.warningCount).toBeGreaterThanOrEqual(1);
      expect(summary.providers.length).toBeGreaterThanOrEqual(2);

      // Verify cached in Redis
      const cached = await redis.get('providers:global:liquidity');
      expect(cached).not.toBeNull();
    });

    it('calculates live global liquidity when forceRefresh is true', async () => {
      mockGetBalance.mockImplementation(async () => {
        return { balance: '250.00', currency: 'USD' };
      });

      const summary = await providerBalanceService.getGlobalLiquiditySummary(true);

      expect(summary.totalUsd).toBeGreaterThanOrEqual(500); // 2 active providers * 250 USD
      expect(summary.healthyCount).toBeGreaterThanOrEqual(2);
      expect(summary.errorCount).toBe(0);
    });
  });
});
