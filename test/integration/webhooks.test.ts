import { describe, it, expect, beforeEach } from 'vitest';
import { PaymentService } from '@/services/financial/payment.service';
import { db } from '@/lib/db';

const paymentService = new PaymentService();

describe('Integration: Payment Webhooks & Idempotency', () => {
  let testUserId: string;
  let testOrderId: string;
  const testGatewayId = 'gw-54321';

  beforeEach(async () => {
    // DB is truncated via global setup
    
    // 1. Create a Category & Service
    const category = await db.category.create({
      data: { name: 'Test', sort: 0 }
    });
    const service = await db.service.create({
      data: {
        name: 'Svc', rate: 10, minQty: 10, maxQty: 100, markup: 2.0, categoryId: category.id
      }
    });

    // 2. Create User
    const user = await db.user.create({
       data: { email: 'webhook@smmplan.local', role: 'USER', balance: 0 }
    });
    testUserId = user.id;

    // 3. Create Order
    const order = await db.order.create({
      data: {
        userId: testUserId,
        serviceId: service.id,
        link: 'https://test',
        quantity: 10,
        status: 'AWAITING_PAYMENT',
        charge: 200,
        providerCost: 100,
      }
    });
    testOrderId = order.id;

    // 4. Create Payment mapped to Order (Pending)
    await db.payment.create({
      data: {
        gatewayId: testGatewayId,
        orderId: testOrderId,
        userId: testUserId,
        amount: 200,
        status: 'PENDING',
        gateway: 'yookassa'
      }
    });
  });

  it('Confirms payment and updates order to PENDING', async () => {
    const success = await paymentService.confirmPayment(testGatewayId, 200, testUserId, true);
    
    // Assuming the service returns true/void correctly
    const order = await db.order.findUnique({ where: { id: testOrderId } });
    expect(order?.status).toBe('PENDING'); // Activated
    
    const payment = await db.payment.findUnique({ where: { gatewayId: testGatewayId } });
    expect(payment?.status).toBe('SUCCEEDED');
  });

  it('Maintains idempotency and ignores concurrent double-webhook blasts', async () => {
    // Simulate 5 identical webhooks arriving at the exact same millisecond
    await Promise.all([
      paymentService.confirmPayment(testGatewayId, 200, testUserId, true),
      paymentService.confirmPayment(testGatewayId, 200, testUserId, true),
      paymentService.confirmPayment(testGatewayId, 200, testUserId, true),
      paymentService.confirmPayment(testGatewayId, 200, testUserId, true),
      paymentService.confirmPayment(testGatewayId, 200, testUserId, true),
    ]);

    // If transactions aren't locked properly, order status might break or something worse
    // But mainly we verify that it executed cleanly and the result is singular
    const orders = await db.order.findMany({ where: { userId: testUserId } });
    expect(orders.length).toBe(1);
    expect(orders[0].status).toBe('PENDING');

    const payments = await db.payment.findMany({ where: { gatewayId: testGatewayId } });
    expect(payments.length).toBe(1);
    expect(payments[0].status).toBe('SUCCEEDED');
  });

  it('Maintains idempotency for Direct Deposits (Top-ups) and ensures LedgerEntry is created exactly once', async () => {
    // 1. Create a Payment without orderId for direct deposit
    const depositGatewayId = 'gw-topup-999';
    await db.payment.create({
      data: {
        gatewayId: depositGatewayId,
        userId: testUserId,
        amount: 50000, // 500 RUB
        status: 'PENDING',
        gateway: 'yookassa'
      }
    });

    // 2. Blast 5 concurrent webhooks
    await Promise.all([
      paymentService.confirmPayment(depositGatewayId, 50000, testUserId, true),
      paymentService.confirmPayment(depositGatewayId, 50000, testUserId, true),
      paymentService.confirmPayment(depositGatewayId, 50000, testUserId, true),
      paymentService.confirmPayment(depositGatewayId, 50000, testUserId, true),
      paymentService.confirmPayment(depositGatewayId, 50000, testUserId, true),
    ]);

    // 3. Verify exactly 1 LedgerEntry was created
    const ledgerEntries = await db.ledgerEntry.findMany({ where: { userId: testUserId } });
    expect(ledgerEntries.length).toBe(1);
    expect(ledgerEntries[0].amount).toBe(50000n);

    // 4. Verify user balance was updated correctly
    const freshUser = await db.user.findUnique({ where: { id: testUserId } });
    expect(freshUser?.balance).toBe(50000n);
  });
});
