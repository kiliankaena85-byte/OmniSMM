import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { db } from '@/lib/db';
import { adminOrderService } from '@/services/admin/order.service';
import { calculatePartialRefund } from '@/utils/refund';

describe('Order Management & Support Actions — Comprehensive E2E Suite', () => {
  let testUserId: string;
  let testServiceId: string;
  let testProviderId: string;

  beforeEach(async () => {
    // 1. Create or retrieve test user
    let user = await db.user.findFirst({ where: { email: 'e2e-order-support@smmplan.pro' } });
    if (!user) {
      user = await db.user.create({
        data: {
          email: 'e2e-order-support@smmplan.pro',
          role: 'USER',
          balance: BigInt(100000), // 1000.00 RUB
          totalSpent: BigInt(500000), // 5000.00 RUB spent
          tenantId: 'smmplan',
        }
      });
    } else {
      user = await db.user.update({
        where: { id: user.id },
        data: { totalSpent: BigInt(500000) }
      });
    }
    testUserId = user.id;

    // 2. Create or retrieve provider
    let provider = await db.provider.findFirst({ where: { name: 'E2E_Mock_Provider' } });
    if (!provider) {
      provider = await db.provider.create({
        data: {
          name: 'E2E_Mock_Provider',
          apiUrl: 'https://api.mockprovider.com/v2',
          apiKey: 'mock_key_123',
          balanceCurrency: 'RUB',
          isActive: true,
        }
      });
    }
    testProviderId = provider.id;

    // 3. Create category & service
    let cat = await db.category.findFirst({ where: { name: 'E2E Order Test Category' } });
    if (!cat) {
      cat = await db.category.create({
        data: {
          name: 'E2E Order Test Category',
          slug: `e2e-cat-${Date.now()}`,
          tenantId: 'smmplan',
        }
      });
    }

    let service = await db.service.findFirst({ where: { name: 'E2E Test Telegram Subs' } });
    if (!service) {
      service = await db.service.create({
        data: {
          name: 'E2E Test Telegram Subs',
          categoryId: cat.id,
          tenantId: 'smmplan',
          rate: 50.0,
          minQty: 10,
          maxQty: 10000,
          isCancelEnabled: true,
          providerId: provider.id,
        }
      });
    }
    testServiceId = service.id;
  });

  afterAll(async () => {
    // Cleanup persistent test fixtures created by findFirst+create pattern in proper FK order
    await db.order.deleteMany({ where: { user: { email: 'e2e-order-support@smmplan.pro' } } }).catch(() => {});
    await db.order.deleteMany({ where: { serviceId: testServiceId } }).catch(() => {});
    await db.order.deleteMany({ where: { userId: testUserId } }).catch(() => {});
    await db.service.deleteMany({ where: { id: testServiceId } }).catch(() => {});
    await db.category.deleteMany({ where: { name: 'E2E Order Test Category' } }).catch(() => {});
    await db.provider.deleteMany({ where: { name: 'E2E_Mock_Provider' } }).catch(() => {});
    await db.ledgerEntry.deleteMany({ where: { user: { email: 'e2e-order-support@smmplan.pro' } } }).catch(() => {});
    await db.ledgerEntry.deleteMany({ where: { userId: testUserId } }).catch(() => {});
    await db.user.deleteMany({ where: { email: 'e2e-order-support@smmplan.pro' } }).catch(() => {});
  });

  describe('1. Order Cancellation & Refund Mechanics', () => {
    it('cancels a PENDING order with 100% full refund', async () => {
      const order = await db.order.create({
        data: {
          numericId: Math.floor(Date.now() % 1000000),
          userId: testUserId,
          serviceId: testServiceId,
          providerId: testProviderId,
          status: 'PENDING',
          quantity: 100,
          remains: 100,
          charge: BigInt(5000), // 50.00 RUB
          providerCost: BigInt(2000),
          link: 'https://t.me/durov',
          tenantId: 'smmplan',
        }
      });

      const userBefore = await db.user.findUniqueOrThrow({ where: { id: testUserId } });

      const res = await adminOrderService.cancelOrder(order.id, {
        id: testUserId,
        email: 'admin@smmplan.pro',
      });

      expect(res.refundCents).toBe(5000);
      expect(res.orderNumericId).toBe(order.numericId);

      const updatedOrder = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(updatedOrder.status).toBe('CANCELED');

      const userAfter = await db.user.findUniqueOrThrow({ where: { id: testUserId } });
      expect(Number(userAfter.balance - userBefore.balance)).toBe(5000);
    });

    it('cancels an IN_PROGRESS order with proportional partial refund for remaining quantity', async () => {
      const order = await db.order.create({
        data: {
          numericId: Math.floor((Date.now() + 1) % 1000000),
          userId: testUserId,
          serviceId: testServiceId,
          providerId: testProviderId,
          status: 'IN_PROGRESS',
          quantity: 100,
          remains: 40, // 60 delivered, 40 remaining
          charge: BigInt(10000), // 100.00 RUB
          providerCost: BigInt(3000),
          link: 'https://t.me/durov',
          tenantId: 'smmplan',
        }
      });

      const userBefore = await db.user.findUniqueOrThrow({ where: { id: testUserId } });

      const res = await adminOrderService.cancelOrder(order.id, {
        id: testUserId,
        email: 'admin@smmplan.pro',
      });

      // 40% of 100 RUB = 40.00 RUB = 4000 cents
      expect(res.refundCents).toBe(4000);

      const updatedOrder = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(updatedOrder.status).toBe('CANCELED');

      const userAfter = await db.user.findUniqueOrThrow({ where: { id: testUserId } });
      expect(Number(userAfter.balance - userBefore.balance)).toBe(4000);
    });

    it('cancels an AWAITING_PAYMENT (unpaid) order with ZERO refund to prevent fraud balance inflation', async () => {
      const order = await db.order.create({
        data: {
          numericId: Math.floor((Date.now() + 2) % 1000000),
          userId: testUserId,
          serviceId: testServiceId,
          providerId: testProviderId,
          status: 'AWAITING_PAYMENT',
          quantity: 200,
          remains: 200,
          charge: BigInt(8000), // 80.00 RUB
          providerCost: BigInt(2000),
          link: 'https://t.me/durov',
          tenantId: 'smmplan',
        }
      });

      const userBefore = await db.user.findUniqueOrThrow({ where: { id: testUserId } });

      const res = await adminOrderService.cancelOrder(order.id, {
        id: testUserId,
        email: 'admin@smmplan.pro',
      });

      // Unpaid orders must NOT credit money!
      expect(res.refundCents).toBe(0);

      const userAfter = await db.user.findUniqueOrThrow({ where: { id: testUserId } });
      expect(userAfter.balance).toBe(userBefore.balance);
    });

    it('allows admin cancellation and full refund on COMPLETED orders (SPEC-2026-09-16)', async () => {
      const order = await db.order.create({
        data: {
          numericId: Math.floor((Date.now() + 3) % 1000000),
          userId: testUserId,
          serviceId: testServiceId,
          providerId: testProviderId,
          status: 'COMPLETED',
          quantity: 100,
          remains: 0,
          charge: BigInt(5000),
          providerCost: BigInt(1500),
          link: 'https://t.me/durov',
          tenantId: 'smmplan',
        }
      });

      const res = await adminOrderService.cancelOrder(order.id, {
        id: testUserId,
        email: 'admin@smmplan.pro',
      });
      expect(res.refundCents).toBe(5000);

      const updated = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(updated.status).toBe('CANCELED');
    });

    it('rejects cancellation on terminal CANCELED orders', async () => {
      const order = await db.order.create({
        data: {
          numericId: Math.floor((Date.now() + 4) % 1000000),
          userId: testUserId,
          serviceId: testServiceId,
          providerId: testProviderId,
          status: 'CANCELED',
          quantity: 100,
          remains: 0,
          charge: BigInt(5000),
          providerCost: BigInt(1500),
          link: 'https://t.me/durov',
          tenantId: 'smmplan',
        }
      });

      await expect(
        adminOrderService.cancelOrder(order.id, {
          id: testUserId,
          email: 'admin@smmplan.pro',
        })
      ).rejects.toThrow(/already in terminal state/i);
    });
  });

  describe('2. Partial Refund Formula Calculations', () => {
    it('correctly computes partial refund without rounding errors', () => {
      const mockOrder = {
        charge: BigInt(9999), // 99.99 RUB
        quantity: 333,
        remains: 111,
      };

      const refund = calculatePartialRefund(mockOrder);
      // (9999 * 111) / 333 = 3333 kopecks
      expect(refund).toBe(3333);
    });

    it('returns 0 when remains is 0', () => {
      const mockOrder = {
        charge: BigInt(5000),
        quantity: 100,
        remains: 0,
      };
      expect(calculatePartialRefund(mockOrder)).toBe(0);
    });
  });

  describe('3. Order Restart Mechanics', () => {
    it('successfully restarts an ERROR order and resets it to PENDING', async () => {
      const order = await db.order.create({
        data: {
          numericId: Math.floor((Date.now() + 4) % 1000000),
          userId: testUserId,
          serviceId: testServiceId,
          providerId: testProviderId,
          status: 'ERROR',
          error: 'Provider upstream timeout',
          quantity: 150,
          remains: 150,
          charge: BigInt(7500),
          providerCost: BigInt(2500),
          link: 'https://t.me/durov',
          tenantId: 'smmplan',
        }
      });

      const res = await adminOrderService.restartOrder(order.id, {
        id: testUserId,
        email: 'admin@smmplan.pro',
      });

      expect(res.orderNumericId).toBe(order.numericId);

      const restarted = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(restarted.status).toBe('PENDING');
      expect(restarted.error).toBeNull();
      expect(restarted.retryCount).toBe(0);
    });

    it('restarts order in PENDING_CHECK without charging customer again', async () => {
      const userBefore = await db.user.findUniqueOrThrow({ where: { id: testUserId } });
      const balanceBefore = userBefore.balance;

      const order = await db.order.create({
        data: {
          numericId: Math.floor(Date.now() / 1000) + 1,
          userId: testUserId,
          serviceId: testServiceId,
          providerId: testProviderId,
          status: 'PENDING_CHECK',
          error: 'Ошибка поставщика VexBoost: Not enough funds. Авто-переключение отключено (manual mode). Требуется проверка оператором.',
          quantity: 100,
          remains: 100,
          charge: BigInt(5000),
          providerCost: BigInt(2000),
          link: 'https://t.me/durov',
          tenantId: 'smmplan',
        }
      });

      const res = await adminOrderService.restartOrder(order.id, {
        id: testUserId,
        email: 'admin@smmplan.pro',
      });

      expect(res.orderNumericId).toBe(order.numericId);

      const restarted = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(restarted.status).toBe('PENDING');
      expect(restarted.error).toBeNull();
      expect(restarted.retryCount).toBe(0);

      // Verify user balance was NOT charged a second time
      const userAfter = await db.user.findUniqueOrThrow({ where: { id: testUserId } });
      expect(userAfter.balance).toBe(balanceBefore);
    });
  });
});

