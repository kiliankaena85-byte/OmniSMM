import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { WalletOps } from '@/services/financial/wallet-ops';
import { orderService } from '@/services/core/order.service';

describe('Financial Integration: Wallet Refund Transaction Type', () => {
  let testUserId: string;

  beforeEach(async () => {
    // 1. Create a test user with a positive balance and some total spent
    const user = await db.user.create({
      data: {
        email: `refund-test-${Date.now()}@test.com`,
        role: 'USER',
        balance: 10000n, // 10,000 cents = 100 RUB
        totalSpent: 5000n, // 5,000 cents = 50 RUB
      },
    });
    testUserId = user.id;
  });

  describe('WalletOps.refund direct calls', () => {
    it('successfully refunds and sets transactionType to REFUND', async () => {
      const refundAmount = 2000; // 20 RUB

      const result = await db.$transaction(async (tx) => {
        return await WalletOps.refund(tx, testUserId, refundAmount, 'Test refund type verification');
      }, { isolationLevel: 'Serializable' });

      expect(result.success).toBe(true);
      expect(result.cached).toBe(false);

      // Verify user state: balance incremented, totalSpent decremented
      const user = await db.user.findUniqueOrThrow({ where: { id: testUserId } });
      expect(user.balance).toBe(12000n); // 10000 + 2000
      expect(user.totalSpent).toBe(3000n); // 5000 - 2000

      // Verify LedgerEntry created
      expect(result.entry).toBeDefined();
      expect(result.entry.transactionType).toBe('REFUND');
      expect(result.entry.status).toBe('APPROVED');
      expect(result.entry.amount).toBe(BigInt(refundAmount));

      const ledgerEntryInDb = await db.ledgerEntry.findUniqueOrThrow({
        where: { id: result.entry.id }
      });
      expect(ledgerEntryInDb.transactionType).toBe('REFUND');
      expect(ledgerEntryInDb.status).toBe('APPROVED');
    });

    it('safely caps totalSpent decrement to 0', async () => {
      const refundAmount = 6000; // 60 RUB (more than totalSpent of 50 RUB)

      await db.$transaction(async (tx) => {
        return await WalletOps.refund(tx, testUserId, refundAmount, 'Test refund type cap totalSpent');
      }, { isolationLevel: 'Serializable' });

      // Verify user state: balance incremented, totalSpent capped at 0
      const user = await db.user.findUniqueOrThrow({ where: { id: testUserId } });
      expect(user.balance).toBe(16000n); // 10000 + 6000
      expect(user.totalSpent).toBe(0n); // 5000 - 5000
    });

    it('is idempotent when idempotencyKey is reused', async () => {
      const refundAmount = 1000;
      const idempotencyKey = `idemp-${Date.now()}`;

      // First call
      const res1 = await db.$transaction(async (tx) => {
        return await WalletOps.refund(tx, testUserId, refundAmount, 'First refund call', { idempotencyKey });
      }, { isolationLevel: 'Serializable' });

      // Second call
      const res2 = await db.$transaction(async (tx) => {
        return await WalletOps.refund(tx, testUserId, refundAmount, 'Second refund call', { idempotencyKey });
      }, { isolationLevel: 'Serializable' });

      expect(res1.cached).toBe(false);
      expect(res2.cached).toBe(true);
      expect(res2.entry.id).toBe(res1.entry.id);

      // Verify user balance incremented only once
      const user = await db.user.findUniqueOrThrow({ where: { id: testUserId } });
      expect(user.balance).toBe(11000n); // 10000 + 1000
    });
  });

  describe('OrderService refund triggers', () => {
    let testServiceId: string;

    beforeEach(async () => {
      // Seed a minimal category and service
      const category = await db.category.create({
        data: { name: 'Refund Testing Cat' }
      });

      const service = await db.service.create({
        data: {
          name: 'Refund Testing Service',
          categoryId: category.id,
          rate: 10,
          markup: 2,
          minQty: 10,
          maxQty: 1000,
          isActive: true,
          externalId: `ext-${Date.now()}`
        }
      });
      testServiceId = service.id;
    });

    it('creates REFUND ledger entry when cancelPendingOrderClient cancels a paid order', async () => {
      // 1. Create order in PENDING state with a positive charge
      const order = await db.order.create({
        data: {
          userId: testUserId,
          serviceId: testServiceId,
          quantity: 100,
          link: 'https://test-refund.com',
          charge: 2000n, // 20 RUB
          providerCost: 1000n,
          status: 'PENDING',
          email: 'buyer@example.com'
        }
      });

      // 2. Cancel order via client cancel method
      const cancelRes = await orderService.cancelPendingOrderClient(order.id, testUserId);
      expect(cancelRes.success).toBe(true);

      // 3. Verify order status
      const updatedOrder = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(updatedOrder.status).toBe('CANCELED');

      // 4. Verify LedgerEntry exists and has transactionType: 'REFUND'
      const refundKey = `refund-client-cancel-${order.id}`;
      const ledgerEntry = await db.ledgerEntry.findFirstOrThrow({
        where: { idempotencyKey: refundKey }
      });
      expect(ledgerEntry.transactionType).toBe('REFUND');
      expect(ledgerEntry.amount).toBe(2000n);
      expect(ledgerEntry.userId).toBe(testUserId);
    });

    it('creates REFUND ledger entry when processStatusUpdate cancels a paid order (CANCELED status)', async () => {
      // 1. Create order in IN_PROGRESS state with an external ID
      const externalId = `ext-order-${Date.now()}`;
      const order = await db.order.create({
        data: {
          userId: testUserId,
          serviceId: testServiceId,
          quantity: 100,
          link: 'https://test-refund.com',
          charge: 2000n,
          providerCost: 1000n,
          status: 'IN_PROGRESS',
          externalId,
          email: 'buyer@example.com'
        }
      });

      // 2. Call processStatusUpdate with Canceled
      const updateRes = await orderService.processStatusUpdate(externalId, 'Canceled', 100);
      expect(updateRes.success).toBe(true);

      // 3. Verify order status and ledger entry
      const updatedOrder = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(updatedOrder.status).toBe('CANCELED');

      const refundKey = `refund-order-${order.id}`;
      const ledgerEntry = await db.ledgerEntry.findFirstOrThrow({
        where: { idempotencyKey: refundKey }
      });
      expect(ledgerEntry.transactionType).toBe('REFUND');
      expect(ledgerEntry.amount).toBe(2000n);
    });

    it('creates REFUND ledger entry for proportional refund when processStatusUpdate sets status to PARTIAL', async () => {
      // 1. Create order in IN_PROGRESS state
      const externalId = `ext-order-partial-${Date.now()}`;
      const order = await db.order.create({
        data: {
          userId: testUserId,
          serviceId: testServiceId,
          quantity: 100,
          link: 'https://test-refund.com',
          charge: 2000n,
          providerCost: 1000n,
          status: 'IN_PROGRESS',
          externalId,
          email: 'buyer@example.com'
        }
      });

      // 2. Call processStatusUpdate with Partial and 40 remains (should refund for 40 items = 40% of 2000 = 800 cents)
      const updateRes = await orderService.processStatusUpdate(externalId, 'Partial', 40);
      expect(updateRes.success).toBe(true);

      // 3. Verify order status and ledger entry
      const updatedOrder = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(updatedOrder.status).toBe('PARTIAL');
      expect(updatedOrder.remains).toBe(40);

      const refundKey = `refund-order-${order.id}`;
      const ledgerEntry = await db.ledgerEntry.findFirstOrThrow({
        where: { idempotencyKey: refundKey }
      });
      expect(ledgerEntry.transactionType).toBe('REFUND');
      expect(ledgerEntry.amount).toBe(800n);
    });

    it('creates REFUND ledger entry when failOrderTerminal is called on PENDING order', async () => {
      // 1. Create order in PENDING state
      const order = await db.order.create({
        data: {
          userId: testUserId,
          serviceId: testServiceId,
          quantity: 100,
          link: 'https://test-refund.com',
          charge: 2000n,
          providerCost: 1000n,
          status: 'PENDING',
          email: 'buyer@example.com'
        }
      });

      // 2. Call failOrderTerminal
      await orderService.failOrderTerminal(order.id, 'API Connection Timeout');

      // 3. Verify order status and ledger entry
      const updatedOrder = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(updatedOrder.status).toBe('ERROR');

      const refundKey = `refund-dlq-${order.id}`;
      const ledgerEntry = await db.ledgerEntry.findFirstOrThrow({
        where: { idempotencyKey: refundKey }
      });
      expect(ledgerEntry.transactionType).toBe('REFUND');
      expect(ledgerEntry.amount).toBe(2000n);
    });

    it('creates REFUND ledger entry when failOrderTerminalFast is called on PENDING order', async () => {
      // 1. Create order in PENDING state
      const order = await db.order.create({
        data: {
          userId: testUserId,
          serviceId: testServiceId,
          quantity: 100,
          link: 'https://test-refund.com',
          charge: 2000n,
          providerCost: 1000n,
          status: 'PENDING',
          email: 'buyer@example.com'
        }
      });

      // 2. Call failOrderTerminalFast
      await orderService.failOrderTerminalFast(order.id, 'Provider returned Canceled status immediately');

      // 3. Verify order status and ledger entry
      const updatedOrder = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(updatedOrder.status).toBe('CANCELED');

      const refundKey = `refund-failfast-${order.id}`;
      const ledgerEntry = await db.ledgerEntry.findFirstOrThrow({
        where: { idempotencyKey: refundKey }
      });
      expect(ledgerEntry.transactionType).toBe('REFUND');
      expect(ledgerEntry.amount).toBe(2000n);
    });
  });
});
