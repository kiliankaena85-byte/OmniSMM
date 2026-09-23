import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { manualApprovePaymentAction } from '@/actions/admin/finance/payments';
import { PaymentService } from '@/services/financial/payment.service';
import { verifySession } from '@/lib/session';

vi.mock('@/lib/session', () => ({
  verifySession: vi.fn(),
  decryptSessionToken: vi.fn(),
  encryptSessionToken: vi.fn(),
}));

describe('🛡️ PCI DSS v4.0.1 & Fintech High-Concurrency Race Condition Tests', () => {
  let adminUser: { id: string; email: string };
  let customerUser: { id: string; email: string };

  beforeEach(async () => {
    // 1. Admin
    const admin = await db.user.create({
      data: {
        email: `pci_admin_${Date.now()}_${Math.random()}@smmplan.pro`,
        role: 'ADMIN',
        balance: BigInt(0),
        tenantId: 'smmplan',
      },
    });
    adminUser = { id: admin.id, email: admin.email };

    // 2. Customer
    const customer = await db.user.create({
      data: {
        email: `pci_cust_${Date.now()}_${Math.random()}@example.com`,
        role: 'USER',
        balance: BigInt(50000), // 500 RUB initial
        tenantId: 'smmplan',
      },
    });
    customerUser = { id: customer.id, email: customer.email };

    vi.mocked(verifySession).mockResolvedValue({
      userId: adminUser.id,
      email: adminUser.email,
      role: 'ADMIN',
      tenantId: 'smmplan',
    } as any);
  });

  it('Scenario 1: High-Concurrency Stress (10 simultaneous manual approvals -> EXACTLY 1 credit, 9 rejected)', async () => {
    // Create pending payment for 1 000 RUB (100 000 cents)
    const payment = await db.payment.create({
      data: {
        userId: customerUser.id,
        amount: BigInt(100000),
        currency: 'RUB',
        status: 'PENDING',
        gateway: 'yookassa',
        tenantId: 'smmplan',
      },
    });

    // Fire 10 simultaneous approval requests in parallel
    const parallelCalls = Array.from({ length: 10 }, (_, i) => 
      manualApprovePaymentAction({
        paymentId: payment.id,
        gatewayTransactionId: `concurrent-tx-${i}-${Date.now()}-${Math.random()}`,
        notes: `Simultaneous click #${i}`,
      })
    );

    const results = await Promise.all(parallelCalls);

    const successes = results.filter(r => r.success);
    const failures = results.filter(r => !r.success);

    // EXACTLY 1 request must succeed
    expect(successes.length).toBe(1);
    // EXACTLY 9 requests must be safely rejected
    expect(failures.length).toBe(9);

    // Verify balance was credited EXACTLY ONCE: 500 + 1000 = 1500 RUB
    const updatedCustomer = await db.user.findUniqueOrThrow({ where: { id: customerUser.id } });
    expect(updatedCustomer.balance).toBe(BigInt(150000));

    // Verify exactly 1 LedgerEntry was created for this payment
    const ledgerCount = await db.ledgerEntry.count({
      where: {
        userId: customerUser.id,
        transactionType: 'TOPUP',
        amount: BigInt(100000),
      },
    });
    expect(ledgerCount).toBe(1);
  });

  it('Scenario 2: Race Condition between Manual Approval and Delayed Webhook', async () => {
    const gatewayId = `race-gateway-${Date.now()}-${Math.random()}`;
    const payment = await db.payment.create({
      data: {
        userId: customerUser.id,
        amount: BigInt(200000), // 2 000 RUB
        currency: 'RUB',
        status: 'PENDING',
        gateway: 'yookassa',
        gatewayId,
        tenantId: 'smmplan',
      },
    });

    // 1. Manual approval executes first
    const manualRes = await manualApprovePaymentAction({
      paymentId: payment.id,
      gatewayTransactionId: gatewayId,
      notes: 'Подтверждено оператором до вебхука',
    });
    expect(manualRes.success).toBe(true);

    // 2. Delayed webhook arrives 10ms later trying to process the same payment
    const paymentService = new PaymentService();
    const webhookProcessed = await paymentService.confirmPayment(
      gatewayId,
      200000, // 2000 RUB received
      customerUser.id
    );

    // Webhook safely returns true or handled without double-crediting
    expect(webhookProcessed).toBe(true);

    // Final balance check: initial 500 RUB + 2000 RUB = 2500 RUB (NOT 4500 RUB!)
    const finalCustomer = await db.user.findUniqueOrThrow({ where: { id: customerUser.id } });
    expect(finalCustomer.balance).toBe(BigInt(250000));
  });

  it('Scenario 3: BigInt ExactMath & Kopecks Strict Integer Guarantee', async () => {
    const payment = await db.payment.create({
      data: {
        userId: customerUser.id,
        amount: BigInt(33333), // 333.33 RUB (odd cents)
        currency: 'RUB',
        status: 'PENDING',
        gateway: 'yookassa',
        tenantId: 'smmplan',
      },
    });

    const res = await manualApprovePaymentAction({
      paymentId: payment.id,
      gatewayTransactionId: `exactmath-tx-${Date.now()}-${Math.random()}`,
      notes: 'Проверка точности до копейки',
    });
    expect(res.success).toBe(true);

    const updatedCustomer = await db.user.findUniqueOrThrow({ where: { id: customerUser.id } });
    // 50000 + 33333 = 83333 kopecks
    expect(updatedCustomer.balance).toBe(BigInt(83333));
  });
});
