import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { BalanceAutoFlushService } from '@/services/providers/balance-autoflush.service';
import { db } from '@/lib/db';
import { redis } from '@/lib/redis';
import { ordersQueue } from '@/lib/queue-manager';

describe('BalanceAutoFlushService — Smart Balance Recovery & Red Team Guards', () => {
  let testUserId: string;
  let testServiceId: string;
  let testProviderId: string;

  beforeEach(async () => {
    // 1. Setup mock/test entities
    let user = await db.user.findFirst({ where: { email: 'autoflush-test@smmplan.pro' } });
    if (!user) {
      user = await db.user.create({
        data: {
          email: 'autoflush-test@smmplan.pro',
          role: 'USER',
          balance: BigInt(50000),
          tenantId: 'smmplan',
        }
      });
    }
    testUserId = user.id;

    let provider = await db.provider.findFirst({ where: { name: 'AutoFlush_Test_Provider' } });
    if (!provider) {
      provider = await db.provider.create({
        data: {
          name: 'AutoFlush_Test_Provider',
          apiUrl: 'https://api.test-autoflush.com/v2',
          apiKey: 'test_key',
          balanceCurrency: 'RUB',
          isActive: true,
        }
      });
    }
    testProviderId = provider.id;

    let cat = await db.category.findFirst({ where: { name: 'AutoFlush Test Category' } });
    if (!cat) {
      cat = await db.category.create({
        data: {
          name: 'AutoFlush Test Category',
          slug: `autoflush-cat-${Date.now()}`,
          tenantId: 'smmplan',
        }
      });
    }

    let service = await db.service.findFirst({ where: { name: 'AutoFlush Test Service' } });
    if (!service) {
      service = await db.service.create({
        data: {
          name: 'AutoFlush Test Service',
          categoryId: cat.id,
          providerId: testProviderId,
          rate: 0.5,
          providerCurrency: 'RUB',
          minQty: 10,
          maxQty: 10000,
          tenantId: 'smmplan',
        }
      });
    }
    testServiceId = service.id;

    // Reset Redis flags
    await redis.del('autoflush:enabled');
    await redis.del(`lock:provider:flush:${testProviderId}`);
    await redis.del(`provider:${testProviderId}:balance`);

    vi.spyOn(ordersQueue, 'add').mockResolvedValue({} as any);
  });

  afterAll(async () => {
    // Cleanup persistent test fixtures (findFirst+create pattern — no timestamps)
    await db.order.deleteMany({ where: { userId: testUserId } }).catch(() => {});
    await db.service.deleteMany({ where: { name: 'AutoFlush Test Service' } }).catch(() => {});
    await db.category.deleteMany({ where: { name: 'AutoFlush Test Category' } }).catch(() => {});
    await db.provider.deleteMany({ where: { name: 'AutoFlush_Test_Provider' } }).catch(() => {});
    await db.user.deleteMany({ where: { email: 'autoflush-test@smmplan.pro' } }).catch(() => {});
  });

  describe('1. Error Classifier Accuracy', () => {
    it('accurately identifies balance-related error messages', () => {
      expect(BalanceAutoFlushService.isBalanceRelatedError('Not enough funds')).toBe(true);
      expect(BalanceAutoFlushService.isBalanceRelatedError('Low balance on account')).toBe(true);
      expect(BalanceAutoFlushService.isBalanceRelatedError('[INSUFFICIENT_PROVIDER_BALANCE] Ошибка VexBoost')).toBe(true);
      expect(BalanceAutoFlushService.isBalanceRelatedError('Недостаточно средств для списания')).toBe(true);
      expect(BalanceAutoFlushService.isBalanceRelatedError('error_not_enough_funds')).toBe(true);
    });

    it('rejects fatal non-balance errors to prevent retry storms', () => {
      expect(BalanceAutoFlushService.isBalanceRelatedError('Invalid link format')).toBe(false);
      expect(BalanceAutoFlushService.isBalanceRelatedError('Profile is private')).toBe(false);
      expect(BalanceAutoFlushService.isBalanceRelatedError('PRICE_DRIFT_HOLD: margin negative')).toBe(false);
      expect(BalanceAutoFlushService.isBalanceRelatedError(null)).toBe(false);
      expect(BalanceAutoFlushService.isBalanceRelatedError('')).toBe(false);
    });
  });

  describe('2. Kill-Switch & Distributed Mutex Guards', () => {
    it('halts immediately when global kill-switch is active', async () => {
      await redis.set('autoflush:enabled', 'false');

      const res = await BalanceAutoFlushService.checkAndFlushProvider(testProviderId);
      expect(res.status).toBe('DISABLED_KILLSWITCH');
      expect(res.flushedCount).toBe(0);
    });

    it('prevents concurrent execution when provider lock is held', async () => {
      await redis.set(`lock:provider:flush:${testProviderId}`, '1', 'EX', 30);

      const res = await BalanceAutoFlushService.checkAndFlushProvider(testProviderId);
      expect(res.status).toBe('LOCKED');
      expect(res.flushedCount).toBe(0);
    });
  });

  describe('3. Selective Auto-Flush Execution', () => {
    it('flushes only balance-related PENDING_CHECK orders and skips fatal errors', async () => {
      // Mock provider balance in Redis to be healthy (5000 RUB)
      await redis.set(
        `provider:${testProviderId}:balance`,
        JSON.stringify({
          providerId: testProviderId,
          providerName: 'AutoFlush_Test_Provider',
          balance: 5000,
          rawBalance: '5000',
          currency: 'RUB',
          balanceUsd: 55,
          balanceRub: 5000,
          status: 'healthy',
          latencyMs: 50,
          cachedAt: Date.now(),
          expiresAt: Date.now() + 60000,
        })
      );

      // Create order 1: with balance error (should be flushed)
      const order1 = await db.order.create({
        data: {
          numericId: Math.floor(Date.now() / 1000) + 101,
          userId: testUserId,
          serviceId: testServiceId,
          providerId: testProviderId,
          status: 'PENDING_CHECK',
          error: '[INSUFFICIENT_PROVIDER_BALANCE] Not enough funds on VexBoost account',
          quantity: 100,
          charge: BigInt(5000),
          providerCost: BigInt(2000),
          link: 'https://t.me/durov',
          tenantId: 'smmplan',
        }
      });

      // Create order 2: with invalid link error (should be SKIPPED)
      const order2 = await db.order.create({
        data: {
          numericId: Math.floor(Date.now() / 1000) + 102,
          userId: testUserId,
          serviceId: testServiceId,
          providerId: testProviderId,
          status: 'PENDING_CHECK',
          error: 'Invalid link or closed private account',
          quantity: 100,
          charge: BigInt(5000),
          providerCost: BigInt(2000),
          link: 'https://t.me/private_test',
          tenantId: 'smmplan',
        }
      });

      const res = await BalanceAutoFlushService.checkAndFlushProvider(testProviderId, { forceRefresh: false });

      expect(res.status).toBe('SUCCESS');
      expect(res.flushedCount).toBeGreaterThanOrEqual(1);
      expect(res.skippedCount).toBeGreaterThanOrEqual(1);

      // Verify order 1 was moved to PENDING
      const o1After = await db.order.findUniqueOrThrow({ where: { id: order1.id } });
      expect(o1After.status).toBe('PENDING');
      expect(o1After.error).toBeNull();

      // Verify order 2 stayed in PENDING_CHECK
      const o2After = await db.order.findUniqueOrThrow({ where: { id: order2.id } });
      expect(o2After.status).toBe('PENDING_CHECK');
      expect(o2After.error).toContain('Invalid link');
    });
  });
});
