import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { manualApprovePaymentAction } from '@/actions/admin/finance/payments';
import { verifySession } from '@/lib/session';

vi.mock('@/lib/session', () => ({
  verifySession: vi.fn(),
  decryptSessionToken: vi.fn(),
  encryptSessionToken: vi.fn(),
}));

describe('🛡️ Manual Payment Approval Security & Hybrid RBAC Tests', () => {
  let adminUser: { id: string; email: string; role: string };
  let supportUser: { id: string; email: string; role: string; supportLimitCents: number };
  let customerUser: { id: string; email: string };

  beforeEach(async () => {
    // 1. Admin
    const admin = await db.user.create({
      data: {
        email: `admin_fin_${Date.now()}@smmplan.pro`,
        role: 'ADMIN',
        balance: BigInt(0),
        tenantId: 'smmplan',
      },
    });
    adminUser = { id: admin.id, email: admin.email, role: 'ADMIN' };

    // 2. Support with 3 000 RUB (300 000 cents) limit
    const support = await db.user.create({
      data: {
        email: `support_fin_${Date.now()}@smmplan.pro`,
        role: 'SUPPORT',
        supportLimitCents: 300000,
        balance: BigInt(0),
        tenantId: 'smmplan',
      },
    });
    supportUser = { 
      id: support.id, 
      email: support.email, 
      role: 'SUPPORT', 
      supportLimitCents: support.supportLimitCents 
    };

    // 3. Customer
    const customer = await db.user.create({
      data: {
        email: `customer_fin_${Date.now()}@example.com`,
        role: 'USER',
        balance: BigInt(100000), // 1 000 RUB initial
        tenantId: 'smmplan',
      },
    });
    customerUser = { id: customer.id, email: customer.email };
  });

  it('Scenario 1: Support approves a pending payment <= 3 000 RUB (ALLOWED)', async () => {
    // Create pending payment for 2 500 RUB (250 000 cents)
    const payment = await db.payment.create({
      data: {
        userId: customerUser.id,
        amount: BigInt(250000),
        currency: 'RUB',
        status: 'PENDING',
        gateway: 'yookassa',
        tenantId: 'smmplan',
      },
    });

    vi.mocked(verifySession).mockResolvedValue({
      userId: supportUser.id,
      email: supportUser.email,
      role: 'SUPPORT',
      tenantId: 'smmplan',
    } as any);

    const gatewayTxId = `yoo-tx-2500-${Date.now()}-${Math.random()}`;
    const res = await manualApprovePaymentAction({
      paymentId: payment.id,
      gatewayTransactionId: gatewayTxId,
      notes: 'Проверено по чеку в почте от ЮKassa',
    });

    expect(res.success).toBe(true);

    // Verify balance was credited +2 500 RUB
    const updatedCustomer = await db.user.findUniqueOrThrow({ where: { id: customerUser.id } });
    expect(updatedCustomer.balance).toBe(BigInt(350000)); // 1000 + 2500 = 3500 RUB

    // Verify payment status became SUCCEEDED
    const updatedPayment = await db.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(updatedPayment.status).toBe('SUCCEEDED');
    expect(updatedPayment.gatewayId).toBe(gatewayTxId);
  });

  it('Scenario 2: Support attempts to approve a payment > 3 000 RUB (BLOCKED by Hybrid Limit)', async () => {
    // Create pending payment for 5 000 RUB (500 000 cents)
    const payment = await db.payment.create({
      data: {
        userId: customerUser.id,
        amount: BigInt(500000),
        currency: 'RUB',
        status: 'PENDING',
        gateway: 'yookassa',
        tenantId: 'smmplan',
      },
    });

    vi.mocked(verifySession).mockResolvedValue({
      userId: supportUser.id,
      email: supportUser.email,
      role: 'SUPPORT',
      tenantId: 'smmplan',
    } as any);

    const res = await manualApprovePaymentAction({
      paymentId: payment.id,
      gatewayTransactionId: `yoo-tx-5000-${Date.now()}`,
      notes: 'Попытка саппорта подтвердить крупный чек',
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('превышает ваш лимит ручного подтверждения');

    // Verify balance was NOT credited
    const customer = await db.user.findUniqueOrThrow({ where: { id: customerUser.id } });
    expect(customer.balance).toBe(BigInt(100000));
  });

  it('Scenario 3: Admin approves a large payment > 3 000 RUB (ALLOWED)', async () => {
    // Create pending payment for 50 000 RUB (5 000 000 cents)
    const payment = await db.payment.create({
      data: {
        userId: customerUser.id,
        amount: BigInt(5000000),
        currency: 'RUB',
        status: 'PENDING',
        gateway: 'yookassa',
        tenantId: 'smmplan',
      },
    });

    vi.mocked(verifySession).mockResolvedValue({
      userId: adminUser.id,
      email: adminUser.email,
      role: 'ADMIN',
      tenantId: 'smmplan',
    } as any);

    const gatewayTxId = `yoo-tx-50000-${Date.now()}-${Math.random()}`;
    const res = await manualApprovePaymentAction({
      paymentId: payment.id,
      gatewayTransactionId: gatewayTxId,
      notes: 'Лично сверил выписку банка по крупному пополнению',
    });

    expect(res.success).toBe(true);

    // Verify balance was credited +50 000 RUB
    const updatedCustomer = await db.user.findUniqueOrThrow({ where: { id: customerUser.id } });
    expect(updatedCustomer.balance).toBe(BigInt(5100000));
  });

  it('Scenario 4: Double Approval / Race Condition is safely rejected', async () => {
    // Create pending payment
    const payment = await db.payment.create({
      data: {
        userId: customerUser.id,
        amount: BigInt(150000),
        currency: 'RUB',
        status: 'PENDING',
        gateway: 'yookassa',
        tenantId: 'smmplan',
      },
    });

    vi.mocked(verifySession).mockResolvedValue({
      userId: adminUser.id,
      email: adminUser.email,
      role: 'ADMIN',
      tenantId: 'smmplan',
    } as any);

    const gatewayTxId = `yoo-tx-1500-${Date.now()}-${Math.random()}`;
    // 1st approval succeeds
    const firstRes = await manualApprovePaymentAction({
      paymentId: payment.id,
      gatewayTransactionId: gatewayTxId,
      notes: 'Первое подтверждение',
    });
    expect(firstRes.success).toBe(true);

    // 2nd approval MUST BE REJECTED
    const secondRes = await manualApprovePaymentAction({
      paymentId: payment.id,
      gatewayTransactionId: `${gatewayTxId}-second`,
      notes: 'Повторное подтверждение того же платежа',
    });
    expect(secondRes.success).toBe(false);
    expect(secondRes.error).toContain('уже имеет статус «SUCCEEDED»');

    // Balance credited only once
    const updatedCustomer = await db.user.findUniqueOrThrow({ where: { id: customerUser.id } });
    expect(updatedCustomer.balance).toBe(BigInt(250000)); // 1000 + 1500 = 2500 RUB
  });
});
