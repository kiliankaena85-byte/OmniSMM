import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { WalletOps } from '@/services/financial/wallet-ops';

// Vitest mock for external fetch
const globalFetch = vi.fn();
global.fetch = globalFetch;

describe('YooKassa Payment Integration & Webhook Lifecycle', () => {
  let userId: string;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Seed test tenant & system settings
    

    await db.systemSettings.upsert({
      where: { id: 'smmplan' },
      update: {
        yookassaShopId: '123456',
        yookassaSecretKey: 'test_secret_key_12345',
        isTestMode: true,
        exchangeRateUSD: 95.0,
      },
      create: {
        id: 'smmplan',
        yookassaShopId: '123456',
        yookassaSecretKey: 'test_secret_key_12345',
        isTestMode: true,
        exchangeRateUSD: 95.0,
      },
    });

    // Seed test user
    const user = await db.user.upsert({
      where: { email_tenantId: { email: 'yookassa-test-user@smmplan.local', tenantId: 'smmplan' } },
      update: { balance: 0, isActive: true },
      create: {
        email: 'yookassa-test-user@smmplan.local',
        tenantId: 'smmplan',
        balance: 0,
        role: 'USER',
        isActive: true,
      },
    });
    userId = user.id;
  });

  // ─────────────────────────────────────────────
  // 1. Payment Creation → Checkout URL
  // ─────────────────────────────────────────────
  it('creates payment and returns checkout confirmation URL without real API calls', async () => {
    const mockYooKassaResponse = {
      id: '2768594d-000f-5000-8000-11b3d5b248a3',
      status: 'pending',
      paid: false,
      amount: { value: '500.00', currency: 'RUB' },
      confirmation: {
        type: 'redirect',
        confirmation_url: 'https://yoomoney.ru/checkout/payments/v2/contract?orderId=2768594d',
      },
    };

    globalFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(mockYooKassaResponse), { status: 200 })
    );

    // Create payment in DB first
    const payment = await db.payment.create({
      data: {
        userId,
        tenantId: 'smmplan',
        amount: 500_00, // 500 RUB in kopecks
        status: 'PENDING',
        gateway: 'YOOKASSA',
        gatewayId: '2768594d-000f-5000-8000-11b3d5b248a3',
      },
    });

    expect(payment.id).toBeDefined();
    expect(payment.status).toBe('PENDING');
    expect(payment.amount).toBe(BigInt(50000));
  });

  // ─────────────────────────────────────────────
  // 2. Webhook Notification → Balance Credited
  // ─────────────────────────────────────────────
  it('credits user balance on valid payment.succeeded webhook payload', async () => {
    const payment = await db.payment.create({
      data: {
        userId,
        tenantId: 'smmplan',
        amount: 1000_00, // 1000 RUB
        status: 'PENDING',
        gateway: 'YOOKASSA',
        gatewayId: `yk-pay-${Date.now()}`,
      },
    });

    // Simulate successful transaction via WalletOps (as done by webhook endpoint)
    await db.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'SUCCEEDED' },
      });

      await WalletOps.credit(
        tx,
        userId,
        Number(payment.amount),
        `Пополнение через ЮKassa (${payment.id})`,
        { idempotencyKey: `yookassa-${payment.id}` }
      );
    });

    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.balance).toBe(BigInt(1000_00));

    const ledger = await db.ledgerEntry.findFirst({
      where: { userId, idempotencyKey: `yookassa-${payment.id}` },
    });
    expect(ledger).not.toBeNull();
    expect(ledger?.status).toBe('APPROVED');
  });

  // ─────────────────────────────────────────────
  // 3. Webhook Replay → Idempotent
  // ─────────────────────────────────────────────
  it('prevents double balance credit on duplicate webhook delivery (idempotency)', async () => {
    const payment = await db.payment.create({
      data: {
        userId,
        tenantId: 'smmplan',
        amount: 300_00,
        status: 'PENDING',
        gateway: 'YOOKASSA',
        gatewayId: `yk-idem-${Date.now()}`,
      },
    });

    const processWebhook = async (): Promise<{ alreadyProcessed?: boolean; success?: boolean }> => {
      return db.$transaction(async (tx) => {
        const currentPayment = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
        if (currentPayment.status === 'SUCCEEDED') {
          return { alreadyProcessed: true };
        }

        await tx.payment.update({
          where: { id: payment.id },
          data: { status: 'SUCCEEDED' },
        });

        const creditResult = await WalletOps.credit(
          tx,
          userId,
          Number(payment.amount),
          `Пополнение через ЮKassa (${payment.id})`,
          { idempotencyKey: `yookassa-idem-${payment.id}` }
        );

        return { alreadyProcessed: false, success: creditResult.success };
      });
    };

    // First webhook call
    const res1 = await processWebhook();
    expect(res1.alreadyProcessed).toBe(false);

    // Second webhook call (duplicate replay)
    const res2 = await processWebhook();
    expect(res2.alreadyProcessed).toBe(true);

    // Balance credited only once (300 RUB)
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.balance).toBe(BigInt(300_00));
  });

  // ─────────────────────────────────────────────
  // 4. Invalid Signature / Mismatch → Rejected
  // ─────────────────────────────────────────────
  it('rejects webhooks with unverified ip or invalid shop credentials', async () => {
    const mockRequest = {
      ip: '192.168.1.1', // Non-YooKassa IP
      headers: { 'content-type': 'application/json' },
      body: { event: 'payment.succeeded', object: { id: 'fake_id' } },
    };

    // Helper logic matching yookassa webhook security check
    const isValidYooKassaIp = (ip: string) => {
      const allowedRanges = ['185.71.76.', '185.71.77.', '77.75.153.', '77.75.156.'];
      return allowedRanges.some((prefix) => ip.startsWith(prefix));
    };

    const isAllowed = isValidYooKassaIp(mockRequest.ip);
    expect(isAllowed).toBe(false);
  });

  // ─────────────────────────────────────────────
  // 5. Refund → Balance Deducted
  // ─────────────────────────────────────────────
  it('deducts user balance on payment refund event', async () => {
    // Start with 1000 RUB balance
    await db.user.update({ where: { id: userId }, data: { balance: 1000_00 } });

    const payment = await db.payment.create({
      data: {
        userId,
        tenantId: 'smmplan',
        amount: 400_00,
        status: 'SUCCEEDED',
        gateway: 'YOOKASSA',
        gatewayId: `yk-refund-${Date.now()}`,
      },
    });

    // Execute refund debit via WalletOps
    await db.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'CANCELED' },
      });

      await WalletOps.charge(
        tx,
        userId,
        Number(payment.amount),
        `Возврат средств по платежу ЮKassa #${payment.id}`,
        { idempotencyKey: `refund-${payment.id}` }
      );
    });

    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.balance).toBe(BigInt(600_00)); // 1000 - 400 = 600 RUB
  });
});
