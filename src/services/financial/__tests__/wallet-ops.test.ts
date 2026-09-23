import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { WalletOps } from '../wallet-ops';
import {
  WalletInsufficientFundsError,
  WalletInvalidAmountError,
} from '../wallet-ops';

describe('WalletOps Unit Tests', () => {
  let userId: string;

  beforeEach(async () => {
    

    const user = await db.user.create({
      data: {
        email: 'client@example.com',
        role: 'USER',
        balance: BigInt(1000), // 10.00 RUB
        quarantineBalance: BigInt(0),
        preferredDashboard: 'CLASSIC',
      },
    });
    userId = user.id;
  });

  it('credit increases balance and creates LedgerEntry', async () => {
    const amount = 500;
    const res = await db.$transaction(async (tx) => {
      return WalletOps.credit(tx, userId, amount, 'Bonus payout');
    });

    expect(res.success).toBe(true);

    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.balance).toBe(BigInt(1500));

    const ledger = await db.ledgerEntry.findFirst({
      where: { userId, reason: 'Bonus payout' },
    });
    expect(ledger).toBeDefined();
    expect(ledger?.amount).toBe(BigInt(500));
    expect(ledger?.status).toBe('APPROVED');
  });

  it('debit (charge) decreases balance and creates LedgerEntry', async () => {
    const amount = 300;
    const res = await db.$transaction(async (tx) => {
      return WalletOps.charge(tx, userId, amount, 'Order charge');
    });

    expect(res.success).toBe(true);

    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.balance).toBe(BigInt(700));

    const ledger = await db.ledgerEntry.findFirst({
      where: { userId, reason: 'Order charge' },
    });
    expect(ledger).toBeDefined();
    expect(ledger?.amount).toBe(BigInt(-300));
  });

  it('debit (charge) does not go below zero (if forbidden)', async () => {
    const amount = 1200; // Greater than 1000 balance
    await expect(
      db.$transaction(async (tx) => {
        return WalletOps.charge(tx, userId, amount, 'Overdraft charge');
      })
    ).rejects.toThrow(WalletInsufficientFundsError);

    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.balance).toBe(BigInt(1000)); // Balance unchanged
  });

  it('refund creates LedgerEntry with correct sign (positive)', async () => {
    await db.user.update({
      where: { id: userId },
      data: { totalSpent: BigInt(500) },
    });

    const amount = 300;
    const res = await db.$transaction(async (tx) => {
      return WalletOps.refund(tx, userId, amount, 'Refund service failure');
    });

    expect(res.success).toBe(true);

    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.balance).toBe(BigInt(1300));
    expect(user.totalSpent).toBe(BigInt(200));

    const ledger = await db.ledgerEntry.findFirst({
      where: { userId, reason: 'Refund service failure' },
    });
    expect(ledger).toBeDefined();
    expect(ledger?.amount).toBe(BigInt(300));
  });

  it('idempotencyKey prevents double operation', async () => {
    const key = `idem-test-${Date.now()}`;
    const amount = 100;

    const first = await db.$transaction(async (tx) => {
      return WalletOps.credit(tx, userId, amount, 'Idempotent Credit', { idempotencyKey: key });
    });
    expect(first.success).toBe(true);
    expect(first.cached).toBe(false);

    const second = await db.$transaction(async (tx) => {
      return WalletOps.credit(tx, userId, amount, 'Idempotent Credit', { idempotencyKey: key });
    });
    expect(second.success).toBe(true);
    expect(second.cached).toBe(true);

    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.balance).toBe(BigInt(1100));
  });

  it('BigInt precision is maintained', async () => {
    const largeAmount = BigInt('9007199254740995');
    const userWithBigInt = await db.user.update({
      where: { id: userId },
      data: { balance: largeAmount },
      select: { balance: true }
    });
    expect(userWithBigInt.balance).toBe(largeAmount);
    expect(typeof userWithBigInt.balance).toBe('bigint');
  });

  it('quarantine: funds go into quarantineBalance, not balance', async () => {
    const amount = 400;
    await db.$transaction(async (tx) => {
      return WalletOps.quarantineAdd(tx, userId, amount, 'Quarantine check');
    });

    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.balance).toBe(BigInt(1000));
    expect(user.quarantineBalance).toBe(BigInt(400));

    const ledger = await db.ledgerEntry.findFirst({
      where: { userId, reason: 'Quarantine check' },
    });
    expect(ledger?.status).toBe('QUARANTINE');
    expect(ledger?.amount).toBe(BigInt(400));
  });
});
