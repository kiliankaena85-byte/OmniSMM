import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { redis } from '@/lib/redis';
import { SettingsProvider } from '@/lib/settings';
import { providerService } from '@/services/providers/provider.service';
import { providerBalanceService } from '../provider-balance.service';

describe('Challenger 2 — M1 Empirical Stress Tests (Balance Verifier)', () => {
  const TEST_USD_ID = 'challenger-test-usd-prov';
  const TEST_RUB_ID = 'challenger-test-rub-prov';
  const TEST_EUR_ID = 'challenger-test-eur-prov';
  let mockGetBalance: any;

  beforeEach(async () => {
    // Clean Redis cache keys
    await redis.del(`provider:${TEST_USD_ID}:balance`);
    await redis.del(`provider:${TEST_RUB_ID}:balance`);
    await redis.del(`provider:${TEST_EUR_ID}:balance`);
    await redis.del('providers:global:liquidity');

    // Seed mock exchange rate 100.0 RUB = 1.0 USD
    await db.systemSettings.upsert({
      where: { id: 'smmplan' },
      update: { exchangeRateUSD: 100.0 },
      create: { id: 'smmplan', exchangeRateUSD: 100.0 },
    });

    vi.spyOn(SettingsProvider, 'getExchangeRateUSD').mockResolvedValue(100.0);

    // Upsert isolated test providers in each test after resetTestDb
    await db.provider.upsert({
      where: { id: TEST_USD_ID },
      update: {
        name: 'Challenger USD Provider',
        apiUrl: 'https://api.challenger-usd.com/v2',
        apiKey: 'key-usd-challenger',
        isActive: true,
        balanceCurrency: 'USD',
        errorCount5m: 0,
        avgResponseMs: 100,
      },
      create: {
        id: TEST_USD_ID,
        name: 'Challenger USD Provider',
        apiUrl: 'https://api.challenger-usd.com/v2',
        apiKey: 'key-usd-challenger',
        isActive: true,
        balanceCurrency: 'USD',
        errorCount5m: 0,
        avgResponseMs: 100,
      },
    });

    await db.provider.upsert({
      where: { id: TEST_RUB_ID },
      update: {
        name: 'Challenger RUB Provider',
        apiUrl: 'https://api.challenger-rub.com/v2',
        apiKey: 'key-rub-challenger',
        isActive: true,
        balanceCurrency: 'RUB',
        errorCount5m: 0,
        avgResponseMs: 100,
      },
      create: {
        id: TEST_RUB_ID,
        name: 'Challenger RUB Provider',
        apiUrl: 'https://api.challenger-rub.com/v2',
        apiKey: 'key-rub-challenger',
        isActive: true,
        balanceCurrency: 'RUB',
        errorCount5m: 0,
        avgResponseMs: 100,
      },
    });

    await db.provider.upsert({
      where: { id: TEST_EUR_ID },
      update: {
        name: 'Challenger EUR Provider',
        apiUrl: 'https://api.challenger-eur.com/v2',
        apiKey: 'key-eur-challenger',
        isActive: true,
        balanceCurrency: 'EUR',
        errorCount5m: 0,
        avgResponseMs: 100,
      },
      create: {
        id: TEST_EUR_ID,
        name: 'Challenger EUR Provider',
        apiUrl: 'https://api.challenger-eur.com/v2',
        apiKey: 'key-eur-challenger',
        isActive: true,
        balanceCurrency: 'EUR',
        errorCount5m: 0,
        avgResponseMs: 100,
      },
    });

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
    vi.restoreAllMocks();
  });

  describe('Dimension 1: Exact Exchange Rate Boundary Conversions', () => {
    it('Threshold test: exactly $50.01 USD -> healthy (> 50)', async () => {
      mockGetBalance.mockResolvedValue({ balance: '50.01', currency: 'USD' });
      const res = await providerBalanceService.getProviderBalance(TEST_USD_ID, true);
      expect(res.balanceUsd).toBe(50.01);
      expect(res.balanceRub).toBe(5001);
      expect(res.status).toBe('healthy');
    });

    it('Threshold test: exactly $50.00 USD -> warning (10 <= balance <= 50)', async () => {
      mockGetBalance.mockResolvedValue({ balance: '50.00', currency: 'USD' });
      const res = await providerBalanceService.getProviderBalance(TEST_USD_ID, true);
      expect(res.balanceUsd).toBe(50.0);
      expect(res.balanceRub).toBe(5000);
      expect(res.status).toBe('warning');
    });

    it('Threshold test: exactly $49.99 USD -> warning (10 <= balance <= 50)', async () => {
      mockGetBalance.mockResolvedValue({ balance: '49.99', currency: 'USD' });
      const res = await providerBalanceService.getProviderBalance(TEST_USD_ID, true);
      expect(res.balanceUsd).toBe(49.99);
      expect(res.balanceRub).toBe(4999);
      expect(res.status).toBe('warning');
    });

    it('Threshold test: exactly $10.00 USD -> warning (10 <= balance <= 50)', async () => {
      mockGetBalance.mockResolvedValue({ balance: '10.00', currency: 'USD' });
      const res = await providerBalanceService.getProviderBalance(TEST_USD_ID, true);
      expect(res.balanceUsd).toBe(10.0);
      expect(res.balanceRub).toBe(1000);
      expect(res.status).toBe('warning');
    });

    it('Threshold test: exactly $9.99 USD -> critical (< 10)', async () => {
      mockGetBalance.mockResolvedValue({ balance: '9.99', currency: 'USD' });
      const res = await providerBalanceService.getProviderBalance(TEST_USD_ID, true);
      expect(res.balanceUsd).toBe(9.99);
      expect(res.balanceRub).toBe(999);
      expect(res.status).toBe('critical');
    });

    it('Threshold test: exactly $0.00 USD -> critical (< 10)', async () => {
      mockGetBalance.mockResolvedValue({ balance: '0.00', currency: 'USD' });
      const res = await providerBalanceService.getProviderBalance(TEST_USD_ID, true);
      expect(res.balanceUsd).toBe(0.0);
      expect(res.balanceRub).toBe(0.0);
      expect(res.status).toBe('critical');
    });

    it('Threshold test: negative balance -$15.50 USD -> critical (< 10)', async () => {
      mockGetBalance.mockResolvedValue({ balance: '-15.50', currency: 'USD' });
      const res = await providerBalanceService.getProviderBalance(TEST_USD_ID, true);
      expect(res.balanceUsd).toBe(-15.5);
      expect(res.status).toBe('critical');
    });
  });

  describe('Dimension 2: RUB & EUR Boundary Normalization (Rate = 100 RUB/USD)', () => {
    it('RUB Boundary: 5001.00 RUB -> 50.01 USD -> healthy', async () => {
      mockGetBalance.mockResolvedValue({ balance: '5001.00', currency: 'RUB' });
      const res = await providerBalanceService.getProviderBalance(TEST_RUB_ID, true);
      expect(res.balanceRub).toBe(5001);
      expect(res.balanceUsd).toBe(50.01);
      expect(res.status).toBe('healthy');
    });

    it('RUB Boundary: 5000.00 RUB -> 50.00 USD -> warning', async () => {
      mockGetBalance.mockResolvedValue({ balance: '5000.00', currency: 'RUB' });
      const res = await providerBalanceService.getProviderBalance(TEST_RUB_ID, true);
      expect(res.balanceRub).toBe(5000);
      expect(res.balanceUsd).toBe(50.0);
      expect(res.status).toBe('warning');
    });

    it('RUB Boundary: 4999.00 RUB -> 49.99 USD -> warning', async () => {
      mockGetBalance.mockResolvedValue({ balance: '4999.00', currency: 'RUB' });
      const res = await providerBalanceService.getProviderBalance(TEST_RUB_ID, true);
      expect(res.balanceRub).toBe(4999);
      expect(res.balanceUsd).toBe(49.99);
      expect(res.status).toBe('warning');
    });

    it('RUB Boundary: 1000.00 RUB -> 10.00 USD -> warning', async () => {
      mockGetBalance.mockResolvedValue({ balance: '1000.00', currency: 'RUB' });
      const res = await providerBalanceService.getProviderBalance(TEST_RUB_ID, true);
      expect(res.balanceRub).toBe(1000);
      expect(res.balanceUsd).toBe(10.0);
      expect(res.status).toBe('warning');
    });

    it('RUB Boundary: 999.00 RUB -> 9.99 USD -> critical', async () => {
      mockGetBalance.mockResolvedValue({ balance: '999.00', currency: 'RUB' });
      const res = await providerBalanceService.getProviderBalance(TEST_RUB_ID, true);
      expect(res.balanceRub).toBe(999);
      expect(res.balanceUsd).toBe(9.99);
      expect(res.status).toBe('critical');
    });

    it('RUB Boundary: 0.00 RUB -> 0.00 USD -> critical', async () => {
      mockGetBalance.mockResolvedValue({ balance: '0.00', currency: 'RUB' });
      const res = await providerBalanceService.getProviderBalance(TEST_RUB_ID, true);
      expect(res.balanceRub).toBe(0);
      expect(res.balanceUsd).toBe(0);
      expect(res.status).toBe('critical');
    });

    it('EUR Boundary: 46.30 EUR * 1.08 = 50.004 USD -> healthy', async () => {
      mockGetBalance.mockResolvedValue({ balance: '46.30', currency: 'EUR' });
      const res = await providerBalanceService.getProviderBalance(TEST_EUR_ID, true);
      expect(res.balanceUsd).toBe(50.0); // rounded to 2 decimals
      expect(res.status).toBe('healthy');
    });

    it('EUR Boundary: 46.29 EUR * 1.08 = 49.9932 USD -> warning', async () => {
      mockGetBalance.mockResolvedValue({ balance: '46.29', currency: 'EUR' });
      const res = await providerBalanceService.getProviderBalance(TEST_EUR_ID, true);
      expect(res.balanceUsd).toBe(49.99);
      expect(res.status).toBe('warning');
    });

    it('EUR Boundary: 9.25 EUR * 1.08 = 9.99 USD -> critical', async () => {
      mockGetBalance.mockResolvedValue({ balance: '9.25', currency: 'EUR' });
      const res = await providerBalanceService.getProviderBalance(TEST_EUR_ID, true);
      expect(res.balanceUsd).toBe(9.99);
      expect(res.status).toBe('critical');
    });
  });

  describe('Dimension 3: Malformed, Corrupt and Edge String Inputs', () => {
    it('handles non-numeric string balance gracefully ("invalid_balance" -> 0 -> critical)', async () => {
      mockGetBalance.mockResolvedValue({ balance: 'invalid_balance', currency: 'USD' });
      const res = await providerBalanceService.getProviderBalance(TEST_USD_ID, true);
      expect(res.balance).toBe(0);
      expect(res.balanceUsd).toBe(0);
      expect(res.status).toBe('critical');
    });

    it('handles empty string balance ("" -> 0 -> critical)', async () => {
      mockGetBalance.mockResolvedValue({ balance: '', currency: 'USD' });
      const res = await providerBalanceService.getProviderBalance(TEST_USD_ID, true);
      expect(res.balance).toBe(0);
      expect(res.balanceUsd).toBe(0);
      expect(res.status).toBe('critical');
    });

    it('handles whitespace-padded numeric string ("  150.75  " -> 150.75 -> healthy)', async () => {
      mockGetBalance.mockResolvedValue({ balance: '  150.75  ', currency: ' USD ' });
      const res = await providerBalanceService.getProviderBalance(TEST_USD_ID, true);
      expect(res.balance).toBe(150.75);
      expect(res.currency).toBe('USD');
      expect(res.status).toBe('healthy');
    });

    it('handles missing/undefined currency in balance response by falling back to provider.balanceCurrency', async () => {
      mockGetBalance.mockResolvedValue({ balance: '25.00' });
      const res = await providerBalanceService.getProviderBalance(TEST_USD_ID, true);
      expect(res.currency).toBe('USD');
      expect(res.balanceUsd).toBe(25);
      expect(res.status).toBe('warning');
    });
  });

  describe('Dimension 4: SLA Metric Database Updates & Error Tracking', () => {
    it('updates avgResponseMs, lastSuccessAt, and resets errorCount5m on successful probe', async () => {
      // First, set non-zero errorCount5m on provider
      await db.provider.update({
        where: { id: TEST_USD_ID },
        data: { errorCount5m: 5, avgResponseMs: 200 },
      });

      mockGetBalance.mockResolvedValue({ balance: '100.00', currency: 'USD' });
      const res = await providerBalanceService.getProviderBalance(TEST_USD_ID, true);

      expect(res.status).toBe('healthy');

      const updated = await db.provider.findUnique({ where: { id: TEST_USD_ID } });
      expect(updated).not.toBeNull();
      expect(updated!.errorCount5m).toBe(0);
      expect(updated!.lastSuccessAt).not.toBeNull();
      expect(updated!.avgResponseMs).toBeGreaterThanOrEqual(0);
    });

    it('increments errorCount5m and updates lastErrorAt on probe error', async () => {
      await db.provider.update({
        where: { id: TEST_USD_ID },
        data: { errorCount5m: 2, lastErrorAt: null },
      });

      mockGetBalance.mockRejectedValue(new Error('Connection timed out'));
      const res = await providerBalanceService.getProviderBalance(TEST_USD_ID, true);

      expect(res.status).toBe('error');
      expect(res.error).toBeDefined();

      const updated = await db.provider.findUnique({ where: { id: TEST_USD_ID } });
      expect(updated!.errorCount5m).toBe(3);
      expect(updated!.lastErrorAt).not.toBeNull();
    });
  });
});
