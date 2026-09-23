import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { WalletOps } from '@/services/financial/wallet-ops';

describe('Financial Invariants: Double-Entry Ledger', () => {
  let testUserId: string;

  beforeEach(async () => {
    // 1. Create User
    const user = await db.user.create({
       data: { email: `ledger-${Date.now()}@test.com`, role: 'USER', balance: 0 }
    });
    testUserId = user.id;
  });

  it('Ensures Sum(LedgerEntry.amount) EXACTLY EQUALS User.balance across complex operations', async () => {
    const userInDb = await db.user.findUnique({ where: { id: testUserId } });
    console.log('DEBUG USER IN DB BEFORE TX:', userInDb);
    // Step 1: Initial Deposit (Top-up)
    await db.$transaction(async (tx) => {
      const userInTx = await tx.user.findUnique({ where: { id: testUserId } });
      console.log('DEBUG USER IN TX:', userInTx);
      await WalletOps.credit(tx, testUserId, 150000, 'Initial Deposit', { idempotencyKey: `dep-1` });
    }, { isolationLevel: 'Serializable' });

    // Step 2: Multiple sequential charges (simulating orders)
    for (let i = 0; i < 5; i++) {
      await db.$transaction(async (tx) => {
        await WalletOps.charge(tx, testUserId, 10000, `Order ${i}`, { idempotencyKey: `charge-${i}` });
      }, { isolationLevel: 'Serializable' });
    }

    // Step 3: A partial refund (Order cancellation)
    await db.$transaction(async (tx) => {
      await WalletOps.refund(tx, testUserId, 5000, 'Partial Refund Order 0', { idempotencyKey: `refund-0` });
    }, { isolationLevel: 'Serializable' });

    // Step 4: Another deposit
    await db.$transaction(async (tx) => {
      await WalletOps.credit(tx, testUserId, 20000, 'Second Deposit', { idempotencyKey: `dep-2` });
    }, { isolationLevel: 'Serializable' });

    // Step 5: Verify the invariant
    // User Balance should be: 150000 - (5 * 10000) + 5000 + 20000 = 125000
    const finalUser = await db.user.findUniqueOrThrow({ where: { id: testUserId } });
    expect(finalUser.balance).toBe(125000n);

    // Ledger sum should equal user balance EXACTLY
    const ledgerAgg = await db.ledgerEntry.aggregate({
      _sum: { amount: true },
      where: { userId: testUserId, status: 'APPROVED' }
    });

    const sumLedger = BigInt(ledgerAgg._sum.amount?.toString() || '0');
    expect(sumLedger).toBe(finalUser.balance);
  });
});
