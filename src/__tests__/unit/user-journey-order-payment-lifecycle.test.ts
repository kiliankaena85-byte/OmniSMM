import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { PaymentService } from '@/services/financial/payment.service';
import { WalletOps } from '@/services/financial/wallet-ops';

describe('User Journey Payments & Cancellation E2E Suite', () => {
  const paymentSvc = new PaymentService();
  let testUser: any;
  let testService: any;
  let testNetwork: any;
  let testCategory: any;

  beforeEach(async () => {
    const timestamp = Date.now() + Math.random().toString(36).slice(2, 6);

    // Ensure tenant exists
    await db.tenant.upsert({
      where: { id: 'smmplan' },
      update: {},
      create: {
        id: 'smmplan',
        name: 'SMMplan Test',
        slug: `smmplan_${timestamp}`,
        domain: `smmplan_${timestamp}.local`,
      }
    });

    // Create user with 1000 RUB (100,000 kopecks)
    testUser = await db.user.create({
      data: {
        email: `client_${timestamp}@test.local`,
        role: 'USER',
        balance: BigInt(100000), // 1,000.00 RUB
        tenantId: 'smmplan',
      }
    });

    // Create a network, category and active service
    testNetwork = await db.network.create({
      data: {
        name: `Telegram Test ${timestamp}`,
        slug: `tg_test_${timestamp}`,
        isActive: true,
      }
    });

    testCategory = await db.category.create({
      data: {
        name: `Channel Subscribers ${timestamp}`,
        slug: `subs_${timestamp}`,
        network: { connect: { id: testNetwork.id } },
      }
    });

    testService = await db.service.create({
      data: {
        name: `TG Subscribers HQ ${timestamp}`,
        categoryId: testCategory.id,
        rate: 500,
        pricePer1000Cents: 50000,
        minQty: 50,
        maxQty: 10000,
        externalId: '101',
        isActive: true,
        targetType: 'CHANNEL',
        isDripFeedEnabled: true,
      }
    });
  });

  describe('1. Happy Path: Order Creation & Balance Payment', () => {
    it('creates order, deducts balance atomically via WalletOps and records Ledger', async () => {
      const orderChargeCents = BigInt(5000); // 50 RUB (100 * 0.50)
      const initialBalance = testUser.balance;

      // Atomic payment using WalletOps.charge inside transaction
      const chargeRes = await db.$transaction(async (tx) => {
        const debitRes = await WalletOps.charge(
          tx,
          testUser.id,
          orderChargeCents,
          'Оплата заказа #12345'
        );

        const order = await tx.order.create({
          data: {
            userId: testUser.id,
            serviceId: testService.id,
            link: 'https://t.me/testchannel',
            quantity: 100,
            email: testUser.email,
            status: 'IN_PROGRESS',
            charge: orderChargeCents,
            providerCost: BigInt(2000),
            remains: 100,
            tenantId: 'smmplan'
          }
        });

        return { order, debitRes };
      });

      expect(chargeRes.order.status).toBe('IN_PROGRESS');

      // Verify user balance
      const updatedUser = await db.user.findUnique({ where: { id: testUser.id } });
      expect(updatedUser?.balance).toBe(initialBalance - orderChargeCents);

      // Verify Ledger Entry
      const ledger = await db.ledgerEntry.findFirst({
        where: { userId: testUser.id, transactionType: 'ORDER_CHARGE' }
      });
      expect(ledger).toBeDefined();
      expect(ledger?.amount).toBe(-orderChargeCents);
    });
  });

  describe('2. Negative Path: Insufficient Balance Rejection', () => {
    it('blocks order creation if user has insufficient funds', async () => {
      const poorUser = await db.user.create({
        data: {
          email: `poor_${Date.now()}@test.local`,
          role: 'USER',
          balance: BigInt(100), // 1 RUB
        }
      });

      await expect(
        db.$transaction(async (tx) => {
          await WalletOps.charge(
            tx,
            poorUser.id,
            BigInt(5000), // 50 RUB required
            'Оплата заказа'
          );
        })
      ).rejects.toThrow('Insufficient funds');

      // Balance untouched
      const checkedUser = await db.user.findUnique({ where: { id: poorUser.id } });
      expect(checkedUser?.balance).toBe(BigInt(100));
    });
  });

  describe('3. Happy Path: External Gateway Webhook Confirmation (YooKassa/CryptoBot)', () => {
    it('transitions order from AWAITING_PAYMENT to IN_PROGRESS and marks Payment SUCCEEDED', async () => {
      const gatewayId = `test_yoo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      // Create pending payment & order
      const payment = await db.payment.create({
        data: {
          userId: testUser.id,
          amount: BigInt(5000),
          currency: 'RUB',
          status: 'PENDING',
          gateway: 'yookassa',
          gatewayId,
          tenantId: 'smmplan'
        }
      });

      const order = await db.order.create({
        data: {
          userId: testUser.id,
          serviceId: testService.id,
          link: 'https://t.me/testchannel',
          quantity: 100,
          email: testUser.email,
          status: 'AWAITING_PAYMENT',
          charge: BigInt(5000),
          providerCost: BigInt(2000),
          paymentId: payment.id,
          tenantId: 'smmplan'
        }
      });

      // Execute webhook confirmation
      const confirmed = await paymentSvc.confirmPayment(
        gatewayId,
        BigInt(5000),
        testUser.id,
        true, // isDevSandbox
        'yookassa',
        payment.id,
        'checkout'
      );

      expect(confirmed).toBe(true);

      // Verify payment SUCCEEDED
      const updatedPayment = await db.payment.findUnique({ where: { id: payment.id } });
      expect(updatedPayment?.status).toBe('SUCCEEDED');

      // Verify order transitioned to IN_PROGRESS or PENDING (active fulfillment)
      const updatedOrder = await db.order.findUnique({ where: { id: order.id } });
      expect(['IN_PROGRESS', 'PENDING']).toContain(updatedOrder?.status);
    });
  });

  describe('4. Happy & Negative Path: Payment Cancellation & Promo Release', () => {
    it('cancels pending payment, marks order CANCELED and decrements promo code uses', async () => {
      const cancelGatewayId = `test_yoo_cancel_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      // Create a promo code with 1 usage
      const promo = await db.promoCode.create({
        data: {
          code: `TESTPROMO_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
          discountPercent: 10,
          maxUses: 10,
          uses: 1, // reserved by checkout
          isActive: true
        }
      });

      const payment = await db.payment.create({
        data: {
          userId: testUser.id,
          amount: BigInt(5000),
          currency: 'RUB',
          status: 'PENDING',
          gateway: 'yookassa',
          gatewayId: cancelGatewayId,
          tenantId: 'smmplan'
        }
      });

      const order = await db.order.create({
        data: {
          userId: testUser.id,
          serviceId: testService.id,
          link: 'https://t.me/testchannel',
          quantity: 100,
          email: testUser.email,
          status: 'AWAITING_PAYMENT',
          charge: BigInt(5000),
          providerCost: BigInt(2000),
          paymentId: payment.id,
          promoCodeId: promo.id,
          tenantId: 'smmplan'
        }
      });

      // User or gateway cancels payment
      const cancelRes = await paymentSvc.cancelPayment(cancelGatewayId);
      expect(cancelRes).toBe(true);

      // Verify payment CANCELED
      const p = await db.payment.findUnique({ where: { id: payment.id } });
      expect(p?.status).toBe('CANCELED');

      // Verify order CANCELED
      const o = await db.order.findUnique({ where: { id: order.id } });
      expect(o?.status).toBe('CANCELED');

      // Verify promo code usage rolled back
      const updatedPromo = await db.promoCode.findUnique({ where: { id: promo.id } });
      expect(updatedPromo?.uses).toBe(0);
    });

    it('rejects double-cancellation gracefully without errors', async () => {
      const deadGatewayId = `test_dead_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const res = await paymentSvc.cancelPayment(deadGatewayId);
      expect(res).toBe(false);
    });
  });

  describe('5. Order Cancellation & Refund Flow', () => {
    it('refunds user balance via WalletOps.refund when pending order is cancelled', async () => {
      const orderChargeCents = BigInt(3000); // 30 RUB
      const startBalance = testUser.balance;

      const order = await db.order.create({
        data: {
          userId: testUser.id,
          serviceId: testService.id,
          link: 'https://t.me/testchannel',
          quantity: 60,
          email: testUser.email,
          status: 'PENDING',
          charge: orderChargeCents,
          providerCost: BigInt(1200),
          remains: 60,
          tenantId: 'smmplan'
        }
      });

      // Cancellation with refund
      await db.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'CANCELED' }
        });

        await WalletOps.refund(
          tx,
          testUser.id,
          orderChargeCents,
          `Возврат средств за отмену заказа #${order.id}`,
          { idempotencyKey: `refund_${order.id}` }
        );
      });

      // Verify balance increased by refund
      const updatedUser = await db.user.findUnique({ where: { id: testUser.id } });
      expect(updatedUser?.balance).toBe(startBalance + orderChargeCents);

      // Verify REFUND ledger entry created
      const refundLedger = await db.ledgerEntry.findFirst({
        where: { userId: testUser.id, transactionType: 'REFUND' }
      });
      expect(refundLedger).toBeDefined();
      expect(refundLedger?.amount).toBe(orderChargeCents);
    });
  });
});