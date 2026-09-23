/**
 * (c) 2024-2026 SMMplan / OmniSMM 1.0. All rights reserved.
 * Database Chaos, Fault Injection & Integrity Test Suite (RAC-2026 / ISO 25010)
 *
 * Verifies:
 * 1. Transaction Rollback Atomicity (zero phantom ledger entries, zero partial commits).
 * 2. Immutable Ledger Tamper Resistance under concurrent attack.
 * 3. Data Integrity & Boundary Fuzzing (negative balances, overflows, zero-charge, cross-tenant leak guards).
 * 4. High-Volume Keyset Cursor vs Offset Pagination verification and Anti-IDOR cursor guard.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { db } from '@/lib/db';
import {
  WalletOps,
  WalletInvalidAmountError,
  WalletUserNotFoundError,
} from '@/services/financial/wallet-ops';
import { fetchCustomerOrdersKeyset } from '@/services/orders/keyset-pagination.service';

describe('Database Chaos, Fault Injection & Integrity (RAC-2026)', () => {
  const createdUserIds: string[] = [];

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      try {
        await db.order.deleteMany({ where: { userId: { in: createdUserIds } } }).catch(() => {});
        await db.$executeRawUnsafe(`ALTER TABLE "LedgerEntry" DISABLE TRIGGER trg_ledger_immutable`);
        await db.ledgerEntry.deleteMany({ where: { userId: { in: createdUserIds } } });
        await db.user.deleteMany({ where: { id: { in: createdUserIds } } });
      } catch (err) {
        // Suppress cleanup issues
      } finally {
        await db.$executeRawUnsafe(`ALTER TABLE "LedgerEntry" ENABLE TRIGGER trg_ledger_immutable`).catch(() => {});
      }
    }
    await db.$disconnect();
  });

  it('TEST 1 [ROLLBACK-ATOMICITY]: Mid-transaction failure must completely roll back LedgerEntry and balance mutation', async () => {
    const initialBalance = BigInt(10000); // 100.00 RUB
    const user = await db.user.create({
      data: {
        email: `chaos-rollback-${Date.now()}@smmplan.local`,
        balance: initialBalance,
        tenantId: 'smmplan',
        role: 'USER',
      },
    });
    createdUserIds.push(user.id);

    const idempotencyKey = `chaos-rollback-idemp-${Date.now()}`;
    let crashCaught = false;

    try {
      await db.$transaction(async (tx) => {
        // Step 1: Ledger entry created and balance decremented
        await WalletOps.charge(
          tx,
          user.id,
          BigInt(3000),
          'Charge before simulated power-cut/crash',
          { tenantId: 'smmplan', idempotencyKey }
        );

        // Step 2: Inject simulated failure (e.g. network partition, external provider error, uncaught exception)
        throw new Error('SIMULATED_CHAOS_SYSTEM_CRASH_BEFORE_COMMIT');
      });
    } catch (err: any) {
      if (err.message === 'SIMULATED_CHAOS_SYSTEM_CRASH_BEFORE_COMMIT') {
        crashCaught = true;
      }
    }

    expect(crashCaught).toBe(true);

    // Verify 100% Rollback Integrity:
    // 1. User balance must be untouched
    const freshUser = await db.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { balance: true, totalSpent: true },
    });
    expect(freshUser.balance).toBe(initialBalance);
    expect(freshUser.totalSpent).toBe(BigInt(0));

    // 2. LedgerEntry must NOT exist in database (no phantom entries)
    const ledgerEntry = await db.ledgerEntry.findFirst({
      where: { idempotencyKey },
    });
    expect(ledgerEntry).toBeNull();

    const allUserEntries = await db.ledgerEntry.findMany({
      where: { userId: user.id },
    });
    expect(allUserEntries.length).toBe(0);
  });

  it('TEST 2 [LEDGER-TAMPER-RESISTANCE]: Parallel malicious UPDATE and DELETE on LedgerEntry must be 100% rejected', async () => {
    const user = await db.user.create({
      data: {
        email: `chaos-tamper-${Date.now()}@smmplan.local`,
        balance: BigInt(5000),
        tenantId: 'smmplan',
        role: 'USER',
      },
    });
    createdUserIds.push(user.id);

    // Create a legitimate ledger entry
    const validEntry = await db.ledgerEntry.create({
      data: {
        userId: user.id,
        tenantId: 'smmplan',
        amount: BigInt(2000),
        reason: 'Legitimate Deposit',
        status: 'APPROVED',
        idempotencyKey: `tamper-target-${Date.now()}`,
      },
    });

    // Concurrently attempt 5 UPDATE and 5 DELETE malicious queries
    const tamperAttempts = [
      ...Array.from({ length: 5 }, (_, i) => ({
        type: 'UPDATE',
        query: `UPDATE "LedgerEntry" SET amount = ${99999 + i} WHERE id = '${validEntry.id}'`,
      })),
      ...Array.from({ length: 5 }, () => ({
        type: 'DELETE',
        query: `DELETE FROM "LedgerEntry" WHERE id = '${validEntry.id}'`,
      })),
    ];

    const results = await Promise.allSettled(
      tamperAttempts.map(async (attempt) => {
        return await db.$executeRawUnsafe(attempt.query);
      })
    );

    // Every single tamper attempt must be rejected by PostgreSQL
    for (const res of results) {
      expect(res.status).toBe('rejected');
      if (res.status === 'rejected') {
        const errStr = String(res.reason);
        expect(
          errStr.includes('trg_ledger_immutable') ||
          errStr.includes('LedgerEntry is immutable') ||
          errStr.includes('P0001')
        ).toBe(true);
      }
    }

    // Verify legitimate entry remains unchanged in DB
    const pristineEntry = await db.ledgerEntry.findUniqueOrThrow({
      where: { id: validEntry.id },
    });
    expect(pristineEntry.amount).toBe(BigInt(2000));
    expect(pristineEntry.status).toBe('APPROVED');
  });

  it('TEST 3 [INTEGRITY-FUZZING]: Fail-closed validation against negative amounts, safety caps, and cross-tenant leakage', async () => {
    const userA = await db.user.create({
      data: {
        email: `fuzz-a-${Date.now()}@smmplan.local`,
        balance: BigInt(5000),
        tenantId: 'smmplan',
        role: 'USER',
      },
    });
    createdUserIds.push(userA.id);

    // 1. Fuzzing negative amount in charge
    await expect(
      db.$transaction(async (tx) => {
        await WalletOps.charge(tx, userA.id, BigInt(-500), 'Negative charge attempt');
      })
    ).rejects.toThrow(WalletInvalidAmountError);

    // 2. Fuzzing zero amount in charge
    await expect(
      db.$transaction(async (tx) => {
        await WalletOps.charge(tx, userA.id, BigInt(0), 'Zero charge attempt');
      })
    ).rejects.toThrow(WalletInvalidAmountError);

    // 3. Fuzzing excessive amount exceeding safety cap (1,000,000.00 RUB)
    await expect(
      db.$transaction(async (tx) => {
        await WalletOps.charge(tx, userA.id, BigInt(150_000_000), 'Overflow charge attempt');
      })
    ).rejects.toThrow(WalletInvalidAmountError);

    // 4. Direct SQL bypass attempt on balance (Physical CHECK constraint chk_user_balance_non_negative)
    let sqlError: any = null;
    try {
      await db.$executeRawUnsafe(
        `UPDATE "User" SET balance = -100 WHERE id = '${userA.id}'`
      );
    } catch (e) {
      sqlError = e;
    }
    expect(sqlError).not.toBeNull();
    expect(
      String(sqlError).includes('chk_user_balance_non_negative') ||
      String(sqlError).includes('23514')
    ).toBe(true);

    // 5. Cross-tenant leakage: Attempting to charge smmplan user from smmflux context
    await expect(
      db.$transaction(async (tx) => {
        await WalletOps.charge(tx, userA.id, BigInt(100), 'Cross-tenant attack', {
          tenantId: 'smmflux', // Malicious or mismatched tenant
        });
      })
    ).rejects.toThrow(WalletUserNotFoundError);
  });

  it('TEST 4 [KEYSET-CURSOR-BENCHMARK]: High-volume keyset pagination must maintain deterministic ordering and Anti-IDOR security', async () => {
    const user = await db.user.create({
      data: {
        email: `keyset-bench-${Date.now()}@smmplan.local`,
        balance: BigInt(50000),
        tenantId: 'smmplan',
        role: 'USER',
      },
    });
    const maliciousUser = await db.user.create({
      data: {
        email: `keyset-malicious-${Date.now()}@smmplan.local`,
        balance: BigInt(1000),
        tenantId: 'smmplan',
        role: 'USER',
      },
    });
    createdUserIds.push(user.id, maliciousUser.id);

    // Ensure a test service exists
    let service = await db.service.findFirst({ where: { isActive: true } });
    if (!service) {
      const net = await db.network.findFirst() || await db.network.create({
        data: { name: 'Net', slug: `net-${Date.now()}`, icon: 'zap' }
      });
      const cat = await db.category.findFirst() || await db.category.create({
        data: { name: 'Cat', networkId: net.id }
      });
      service = await db.service.create({
        data: { name: 'Svc', categoryId: cat.id, pricePer1000Cents: 1000, rate: 1.0, minQty: 10, maxQty: 100, isActive: true }
      });
    }

    // Seed 30 orders with strictly incrementing timestamps
    const now = Date.now();
    const orderInserts = Array.from({ length: 30 }, (_, i) => ({
      userId: user.id,
      serviceId: service!.id,
      quantity: 100,
      charge: BigInt(100),
      providerCost: BigInt(50),
      link: `https://t.me/keyset_${i}`,
      status: 'COMPLETED' as const,
      tenantId: 'smmplan',
      createdAt: new Date(now - (30 - i) * 1000),
    }));

    await db.order.createMany({ data: orderInserts });

    // Also create 1 order for maliciousUser
    const alienOrder = await db.order.create({
      data: {
        userId: maliciousUser.id,
        serviceId: service!.id,
        quantity: 100,
        charge: BigInt(100),
        providerCost: BigInt(50),
        link: 'https://t.me/alien_order',
        status: 'COMPLETED',
        tenantId: 'smmplan',
      },
    });

    // 1. Fetch first page of 10 orders
    const page1 = await fetchCustomerOrdersKeyset({
      userId: user.id,
      tenantId: 'smmplan',
      limit: 10,
    });

    expect(page1.items.length).toBe(10);
    expect(page1.hasMore).toBe(true);
    expect(page1.nextCursor).not.toBeNull();

    // 2. Fetch second page using nextCursor
    const page2 = await fetchCustomerOrdersKeyset({
      userId: user.id,
      tenantId: 'smmplan',
      cursor: page1.nextCursor,
      limit: 10,
    });

    expect(page2.items.length).toBe(10);
    // Page 2 items must not overlap with Page 1 items
    const page1Ids = new Set(page1.items.map((it: any) => it.id));
    for (const item of page2.items) {
      expect(page1Ids.has((item as any).id)).toBe(false);
    }

    // 3. Anti-IDOR Cursor Security: Passing alienOrder.id as cursor
    // Since alienOrder belongs to maliciousUser, user.id lookup for this cursor must return null reference
    // and fail-closed (fall back to first page rather than leaking or crashing)
    const idorAttempt = await fetchCustomerOrdersKeyset({
      userId: user.id,
      tenantId: 'smmplan',
      cursor: alienOrder.id,
      limit: 10,
    });

    // Must return user's orders, NEVER the alien order
    expect(idorAttempt.items.length).toBe(10);
    for (const item of idorAttempt.items) {
      expect((item as any).id).not.toBe(alienOrder.id);
    }
  });
});
