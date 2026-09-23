import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PaymentService } from '@/services/financial/payment.service';
import { db } from '@/lib/db';

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers({ 'x-forwarded-for': '127.0.0.1', 'user-agent': 'vitest' })),
  cookies: vi.fn(async () => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() })),
}));

const paymentService = new PaymentService();

describe('D1.1: Retry Payment Activation Contract (CHK-06 single-order branch)', () => {
  let userId: string;
  let serviceId: string;

  beforeEach(async () => {
    const category = await db.category.create({
      data: { name: `RetryCat-${Date.now()}`, sort: 0 }
    });
    const service = await db.service.create({
      data: {
        name: `RetrySvc-${Date.now()}`,
        rate: 10,
        minQty: 10,
        maxQty: 100,
        markup: 2.0,
        categoryId: category.id
      }
    });
    serviceId = service.id;

    const user = await db.user.create({
      data: {
        email: `retry-user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@smmplan.local`,
        role: 'USER',
        balance: 0
      }
    });
    userId = user.id;
  });

  it('activates order, marks payment SUCCEEDED, and creates exactly 1 credit and 1 charge in ledger', async () => {
    const charge = 250; // 2.50 RUB in cents / balance units

    // 1. Create order in AWAITING_PAYMENT
    const order = await db.order.create({
      data: {
        userId,
        serviceId,
        link: 'https://vk.com/retry_test',
        quantity: 50,
        status: 'AWAITING_PAYMENT',
        charge,
        providerCost: 100,
      }
    });

    const gatewayId = `test-gw-retry-${Date.now()}`;

    // 2. Create Payment as created by retryCheckoutAction (with orderId set)
    const payment = await db.payment.create({
      data: {
        gatewayId,
        orderId: order.id,
        userId,
        amount: charge,
        currency: 'RUB',
        status: 'PENDING',
        gateway: 'yookassa'
      }
    });

    // Link order to payment
    await db.order.update({
      where: { id: order.id },
      data: { paymentId: payment.id }
    });

    // Initial check: User balance is 0, ledger has 0 entries
    const initialUser = await db.user.findUnique({ where: { id: userId } });
    expect(Number(initialUser?.balance)).toBe(0);
    const initialLedger = await db.ledgerEntry.findMany({ where: { userId } });
    expect(initialLedger.length).toBe(0);

    // 3. Call confirmPayment
    const confirmed = await paymentService.confirmPayment(
      gatewayId,
      charge,
      userId,
      false, // isLiveVerify = false (test mode)
      'yookassa',
      payment.id
    );
    expect(confirmed).toBe(true);

    // 4. Assertions: Order activated, Payment succeeded
    const updatedOrder = await db.order.findUnique({ where: { id: order.id } });
    expect(updatedOrder?.status).toBe('PENDING');

    const updatedPayment = await db.payment.findUnique({ where: { id: payment.id } });
    expect(updatedPayment?.status).toBe('SUCCEEDED');

    // Assert Ledger: exactly 1 credit entry and 1 debit entry
    const ledgerEntries = await db.ledgerEntry.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' }
    });
    expect(ledgerEntries.length).toBe(2);

    const creditEntry = ledgerEntries.find(e => Number(e.amount) > 0);
    expect(creditEntry).toBeDefined();
    expect(creditEntry?.idempotencyKey).toBe(`gateway-credit-${payment.id}`);
    expect(Number(creditEntry?.amount)).toBe(charge);

    const debitEntry = ledgerEntries.find(e => Number(e.amount) < 0);
    expect(debitEntry).toBeDefined();
    expect(debitEntry?.idempotencyKey).toBe(`gateway-charge-${order.id}`);
    expect(Number(debitEntry?.amount)).toBe(-charge);

    // Final balance is 0 (credited 250, debited 250)
    const finalUser = await db.user.findUnique({ where: { id: userId } });
    expect(Number(finalUser?.balance)).toBe(0);

    // 5. Repeated call to confirmPayment must be completely idempotent
    const secondCall = await paymentService.confirmPayment(
      gatewayId,
      charge,
      userId,
      false,
      'yookassa',
      payment.id
    );
    expect(secondCall).toBe(true);

    const postIdempotencyLedger = await db.ledgerEntry.findMany({ where: { userId } });
    expect(postIdempotencyLedger.length).toBe(2);

    const postUser = await db.user.findUnique({ where: { id: userId } });
    expect(Number(postUser?.balance)).toBe(0);
  });

  it('does not double credit or debit when order is already PENDING', async () => {
    const charge = 300;

    // Create order already in PENDING status
    const order = await db.order.create({
      data: {
        userId,
        serviceId,
        link: 'https://vk.com/already_active',
        quantity: 50,
        status: 'PENDING',
        charge,
        providerCost: 100,
      }
    });

    const gatewayId = `test-gw-already-pending-${Date.now()}`;
    const payment = await db.payment.create({
      data: {
        gatewayId,
        orderId: order.id,
        userId,
        amount: charge,
        currency: 'RUB',
        status: 'PENDING',
        gateway: 'yookassa'
      }
    });

    await db.order.update({
      where: { id: order.id },
      data: { paymentId: payment.id }
    });

    // Confirm payment for already-active order
    await paymentService.confirmPayment(
      gatewayId,
      charge,
      userId,
      false,
      'yookassa',
      payment.id
    );

    // Order remains PENDING
    const currentOrder = await db.order.findUnique({ where: { id: order.id } });
    expect(currentOrder?.status).toBe('PENDING');

    // Because order was already PENDING, the single-order activation branch skipped it
    // and the basket branch findMany({ status: 'AWAITING_PAYMENT' }) found 0 orders.
    // So 0 order charges occurred (only the gateway credit if top-up or 0 charges).
    const allLedger = await db.ledgerEntry.findMany({
      where: { userId }
    });
    const charges = allLedger.filter(e => Number(e.amount) < 0);
    expect(charges.length).toBe(0);
  });
});
