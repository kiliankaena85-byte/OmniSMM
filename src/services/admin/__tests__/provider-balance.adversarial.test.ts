import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { redis } from '@/lib/redis';
import { SettingsProvider } from '@/lib/settings';
import { providerService } from '@/services/providers/provider.service';
import { providerBalanceService } from '../provider-balance.service';

describe('ProviderBalanceService — Adversarial Stress & Chaos Test Suite', () => {
  const TEST_ADV_ID = 'test-prov-adv-1';
  let mockGetBalance: any;

  beforeEach(async () => {
    // Clear redis cache keys for the exact provider ID
    await redis.del(`provider:${TEST_ADV_ID}:balance`);
    await redis.del('providers:global:liquidity');

    // Ensure system settings exist
    await db.systemSettings.upsert({
      where: { id: 'smmplan' },
      update: { exchangeRateUSD: 100.0 },
      create: { id: 'smmplan', exchangeRateUSD: 100.0 },
    });

    vi.spyOn(SettingsProvider, 'getExchangeRateUSD').mockResolvedValue(100.0);

    // Create / re-seed adversarial test provider before each test
    await db.provider.upsert({
      where: { id: TEST_ADV_ID },
      update: {
        name: 'Adversarial Test Provider 1',
        apiUrl: 'https://api.adversarial-provider.com/v1',
        apiKey: 'adv-key-999',
        isActive: true,
        balanceCurrency: 'USD',
        errorCount5m: 0,
        avgResponseMs: 100,
      },
      create: {
        id: TEST_ADV_ID,
        name: 'Adversarial Test Provider 1',
        apiUrl: 'https://api.adversarial-provider.com/v1',
        apiKey: 'adv-key-999',
        isActive: true,
        balanceCurrency: 'USD',
        errorCount5m: 0,
        avgResponseMs: 100,
      },
    });

    mockGetBalance = vi.fn().mockResolvedValue({ balance: '100.00', currency: 'USD' });
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
    vi.restoreAllMocks();
    await redis.del(`provider:${TEST_ADV_ID}:balance`);
    await redis.del('providers:global:liquidity');
  });

  // =========================================================================
  // VECTOR 1: Extreme & Corrupted Balance Values
  // =========================================================================
  describe('Vector 1: Extreme & Corrupted Balance Values', () => {
    it('handles zero balance ($0, "0", "0.00") and marks status as critical', async () => {
      mockGetBalance.mockResolvedValue({ balance: '0.00', currency: 'USD' });

      const res = await providerBalanceService.getProviderBalance(TEST_ADV_ID, true);

      expect(res.balance).toBe(0);
      expect(res.balanceUsd).toBe(0);
      expect(res.balanceRub).toBe(0);
      expect(res.status).toBe('critical');
      expect(Number.isNaN(res.balance)).toBe(false);
    });

    it('handles negative balance values gracefully without crashing and marks as critical', async () => {
      mockGetBalance.mockResolvedValue({ balance: '-50.25', currency: 'USD' });

      const res = await providerBalanceService.getProviderBalance(TEST_ADV_ID, true);

      expect(res.balance).toBe(-50.25);
      expect(res.balanceUsd).toBe(-50.25);
      expect(res.balanceRub).toBe(-5025); // -50.25 * 100
      expect(res.status).toBe('critical');
      expect(Number.isNaN(res.balanceUsd)).toBe(false);
    });

    it('handles pure non-numeric strings (NaN, invalid JSON, special chars) by falling back to 0 without throwing', async () => {
      const nonNumericValues = ['INVALID_RESPONSE', 'NaN', 'undefined', 'null', '$150.00', '', '   '];

      for (const val of nonNumericValues) {
        await redis.del(`provider:${TEST_ADV_ID}:balance`);
        mockGetBalance.mockResolvedValue({ balance: val, currency: 'USD' });

        const res = await providerBalanceService.getProviderBalance(TEST_ADV_ID, true);

        expect(Number.isNaN(res.balance)).toBe(false);
        expect(Number.isNaN(res.balanceUsd)).toBe(false);
        expect(Number.isNaN(res.balanceRub)).toBe(false);
        expect(res.balance).toBe(0);
        expect(res.status).toBe('critical'); // 0 USD is critical
      }
    });

    it('handles strings with numbers and currency suffixes ("150,00 USD", "25 USD", "5 USD") correctly', async () => {
      mockGetBalance.mockResolvedValue({ balance: '150,00 USD', currency: 'USD' });
      const res1 = await providerBalanceService.getProviderBalance(TEST_ADV_ID, true);
      expect(res1.balance).toBe(150);
      expect(res1.status).toBe('healthy');

      await redis.del(`provider:${TEST_ADV_ID}:balance`);
      mockGetBalance.mockResolvedValue({ balance: '25 USD', currency: 'USD' });
      const res2 = await providerBalanceService.getProviderBalance(TEST_ADV_ID, true);
      expect(res2.balance).toBe(25);
      expect(res2.status).toBe('warning');

      await redis.del(`provider:${TEST_ADV_ID}:balance`);
      mockGetBalance.mockResolvedValue({ balance: '5 USD', currency: 'USD' });
      const res3 = await providerBalanceService.getProviderBalance(TEST_ADV_ID, true);
      expect(res3.balance).toBe(5);
      expect(res3.status).toBe('critical');
    });

    it('handles billions and extreme magnitude values without precision overflow', async () => {
      mockGetBalance.mockResolvedValue({ balance: '1000000000.50', currency: 'USD' });

      const res = await providerBalanceService.getProviderBalance(TEST_ADV_ID, true);

      expect(res.balance).toBe(1000000000.5);
      expect(res.balanceUsd).toBe(1000000000.5);
      expect(res.balanceRub).toBe(100000000050);
      expect(res.status).toBe('healthy');
    });

    it('handles missing, null, undefined, or empty currency fields', async () => {
      mockGetBalance.mockResolvedValue({ balance: '75.00', currency: undefined });

      const res = await providerBalanceService.getProviderBalance(TEST_ADV_ID, true);

      expect(res.currency).toBe('USD'); // Default fallback
      expect(res.balanceUsd).toBe(75);
      expect(res.status).toBe('healthy');
    });

    it('handles exotic / unsupported currencies (e.g. USDT, TRY, JPY) gracefully', async () => {
      mockGetBalance.mockResolvedValue({ balance: '120.00', currency: 'USDT' });

      const res = await providerBalanceService.getProviderBalance(TEST_ADV_ID, true);

      expect(res.currency).toBe('USDT');
      expect(res.balanceUsd).toBe(120);
      expect(res.status).toBe('healthy');
    });

    it('handles malformed getBalance return value (missing balance property)', async () => {
      mockGetBalance.mockResolvedValue({});

      const res = await providerBalanceService.getProviderBalance(TEST_ADV_ID, true);

      expect(res.balance).toBe(0);
      expect(res.rawBalance).toBe('0');
      expect(res.status).toBe('critical');
    });

    it('handles getBalance returning null by catching error cleanly', async () => {
      mockGetBalance.mockResolvedValue(null as any);

      const res = await providerBalanceService.getProviderBalance(TEST_ADV_ID, true);

      expect(res.status).toBe('error');
      expect(res.error).toBeDefined();
    });
  });

  // =========================================================================
  // VECTOR 2: Concurrency & Stampede / Race Conditions
  // =========================================================================
  describe('Vector 2: Rapid Concurrent ForceRefresh Requests (Stampede)', () => {
    it('survives 20 concurrent forceRefresh calls without unhandled rejections or deadlocks', async () => {
      mockGetBalance.mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 10));
        return { balance: '85.50', currency: 'USD' };
      });

      const concurrentCalls = Array.from({ length: 20 }, () =>
        providerBalanceService.getProviderBalance(TEST_ADV_ID, true)
      );

      const results = await Promise.all(concurrentCalls);

      expect(results.length).toBe(20);
      for (const res of results) {
        expect(res.status).toBe('healthy');
        expect(res.balance).toBe(85.5);
        expect(res.balanceUsd).toBe(85.5);
      }
    });

    it('survives concurrent getAllProviderBalances and getGlobalLiquiditySummary requests', async () => {
      mockGetBalance.mockResolvedValue({ balance: '120.00', currency: 'USD' });

      const calls = [
        ...Array.from({ length: 5 }, () => providerBalanceService.getAllProviderBalances(true)),
        ...Array.from({ length: 5 }, () => providerBalanceService.getGlobalLiquiditySummary(true)),
      ];

      const results = await Promise.all(calls);
      expect(results.length).toBe(10);
    });
  });

  // =========================================================================
  // VECTOR 3: Redis Failure & Chaos Simulation
  // =========================================================================
  describe('Vector 3: Redis Failure & Chaos Resilience', () => {
    it('gracefully degrades when Redis GET throws ECONNREFUSED and fetches live balance', async () => {
      vi.spyOn(redis, 'get').mockRejectedValueOnce(new Error('ECONNREFUSED: Redis connection refused'));
      mockGetBalance.mockResolvedValue({ balance: '90.00', currency: 'USD' });

      const res = await providerBalanceService.getProviderBalance(TEST_ADV_ID, false);

      expect(mockGetBalance).toHaveBeenCalledTimes(1);
      expect(res.balance).toBe(90);
      expect(res.status).toBe('healthy');
    });

    it('gracefully degrades when Redis SET throws ETIMEDOUT without failing the user request', async () => {
      vi.spyOn(redis, 'set').mockRejectedValueOnce(new Error('ETIMEDOUT: Redis write timed out'));
      mockGetBalance.mockResolvedValue({ balance: '95.00', currency: 'USD' });

      const res = await providerBalanceService.getProviderBalance(TEST_ADV_ID, true);

      expect(res.balance).toBe(95);
      expect(res.status).toBe('healthy');
    });

    it('handles corrupted non-JSON cached content in Redis without crashing', async () => {
      await redis.set(`provider:${TEST_ADV_ID}:balance`, 'CORRUPTED_NON_JSON_DATA{{{', 'EX', 60);
      mockGetBalance.mockResolvedValue({ balance: '65.00', currency: 'USD' });

      const res = await providerBalanceService.getProviderBalance(TEST_ADV_ID, false);

      expect(mockGetBalance).toHaveBeenCalledTimes(1);
      expect(res.balance).toBe(65);
      expect(res.status).toBe('healthy');
    });

    it('handles Redis failure during getGlobalLiquiditySummary without throwing', async () => {
      vi.spyOn(redis, 'get').mockRejectedValueOnce(new Error('Redis cluster down'));
      vi.spyOn(redis, 'set').mockRejectedValueOnce(new Error('Redis read-only replica'));
      mockGetBalance.mockResolvedValue({ balance: '40.00', currency: 'USD' });

      const summary = await providerBalanceService.getGlobalLiquiditySummary(false);

      expect(summary.totalUsd).toBeGreaterThanOrEqual(0);
      expect(summary.providers.length).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // VECTOR 4: Provider Hanging Beyond 5000ms Timeout
  // =========================================================================
  describe('Vector 4: Provider Hanging Beyond 5000ms Timeout', () => {
    it('times out after 5000ms when provider hangs and caches error record for 15s', async () => {
      // Mock getBalance to hang for 7000ms (exceeding 5000ms timeout)
      mockGetBalance.mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(() => resolve({ balance: '100' }), 7000))
      );

      const startTime = Date.now();
      const res = await providerBalanceService.getProviderBalance(TEST_ADV_ID, true);
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(4800);
      expect(res.status).toBe('error');
      expect(res.error).toMatch(/Таймаут|timed out|ETIMEDOUT/i);
      expect(res.expiresAt - res.cachedAt).toBe(15000); // 15s error TTL

      // Subsequent call within 15s should return cached error in <100ms without hanging another 5s
      const secondCallStart = Date.now();
      const cachedRes = await providerBalanceService.getProviderBalance(TEST_ADV_ID, false);
      const secondElapsed = Date.now() - secondCallStart;

      expect(secondElapsed).toBeLessThan(200);
      expect(cachedRes.status).toBe('error');
    }, 15000);
  });

  // =========================================================================
  // VECTOR 5: Database SLA Metrics Stability
  // =========================================================================
  describe('Vector 5: Database SLA Metrics Stability', () => {
    it('updates rolling average latency correctly on success', async () => {
      mockGetBalance.mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 20));
        return { balance: '55.00', currency: 'USD' };
      });

      await providerBalanceService.getProviderBalance(TEST_ADV_ID, true);

      const updated = await db.provider.findUnique({ where: { id: TEST_ADV_ID } });
      expect(updated?.lastSuccessAt).not.toBeNull();
      expect(updated?.avgResponseMs).toBeGreaterThan(0);
      expect(updated?.errorCount5m).toBe(0);
    });
  });
});
