import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { WalletOps } from '@/services/financial/wallet-ops';

describe('Balance Flow Integration Tests', () => {
  let userId: string;

  beforeEach(async () => {
    // Clear handled globally
    await db.tenant.upsert({
      where: { id: 'smmplan' },
      update: {},
      create: { id: 'smmplan', name: 'SMMplan', slug: 'smmplan', domain: 'smmplan.local', vaultSalt: 'test-salt' },
    });

    const user = await db.user.create({
      data: {
        email: 'integration@example.com',
        role: 'USER',
        balance: BigInt(0),
        quarantineBalance: BigInt(0),
        preferredDashboard: 'CLASSIC',
      },
    });
    userId = user.id;
  });

  it('Deposit -> Order -> Cancel -> Refund flow works and balance reconciles', async () => {
    // 1. Deposit 5000 cents (50.00 RUB)
    await db.$transaction(async (tx) => {
      await WalletOps.credit(tx, userId, 5000, 'YooKassa Deposit', { idempotencyKey: 'dep-1' });
    });

    let user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.balance).toBe(BigInt(5000));

    // 2. Order placement of 3000 cents (30.00 RUB)
    await db.$transaction(async (tx) => {
      await WalletOps.charge(tx, userId, 3000, 'Order purchase #101', { idempotencyKey: 'order-1' });
    });

    user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.balance).toBe(BigInt(2000));
    expect(user.totalSpent).toBe(BigInt(3000));

    // 3. Order cancellation: refund 3000 cents
    await db.$transaction(async (tx) => {
      await WalletOps.refund(tx, userId, 3000, 'Refund order purchase #101', { idempotencyKey: 'refund-1' });
    });

    user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.balance).toBe(BigInt(5000)); // Restored
    expect(user.totalSpent).toBe(BigInt(0)); // Reset since order is cancelled

    // 4. Ledger reconciliation
    const ledgerSum = await db.ledgerEntry.aggregate({
      _sum: { amount: true },
      where: { userId },
    });
    const totalLedger = ledgerSum._sum.amount || BigInt(0);
    expect(totalLedger).toBe(user.balance); // Reconciliation sum === balance
  });

  it('Promo code voucher credit and referral transfer flows work', async () => {
    // Promo code voucher credit
    await db.$transaction(async (tx) => {
      await WalletOps.credit(tx, userId, 1000, 'Promo code voucher', { idempotencyKey: 'promo-1' });
    });

    let user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.balance).toBe(BigInt(1000));

    const promoLedger = await db.ledgerEntry.findFirst({
      where: { userId, reason: 'Promo code voucher' },
    });
    expect(promoLedger).toBeDefined();

    // Referral transfer simulation
    await db.$transaction(async (tx) => {
      await WalletOps.credit(tx, userId, 500, 'Referral transfer', { idempotencyKey: 'ref-1' });
    });

    user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.balance).toBe(BigInt(1500));

    const refLedger = await db.ledgerEntry.findFirst({
      where: { userId, reason: 'Referral transfer' },
    });
    expect(refLedger).toBeDefined();
  });

  it('Concurrent balance updates resolve safely without race conditions', async () => {
    // Trigger 10 concurrent balance credit additions of 100 cents (1.00 RUB) each
    const creditOperations = Array.from({ length: 10 }).map((_, idx) => {
      return db.$transaction(async (tx) => {
        return WalletOps.credit(tx, userId, 100, `Concurrent credit #${idx}`, {
          idempotencyKey: `concurrent-credit-${idx}`,
        });
      });
    });

    await Promise.all(creditOperations);

    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.balance).toBe(BigInt(1000)); // Exactly 1000 cents (10.00 RUB)

    // Verify reconciliation
    const ledgerSum = await db.ledgerEntry.aggregate({
      _sum: { amount: true },
      where: { userId },
    });
    expect(ledgerSum._sum.amount).toBe(user.balance);
  });
});
