/**
 * (c) 2024-2026 SMMplan / OmniSMM 1.0. All rights reserved.
 * Database Stress & Concurrency Race Test Suite (RAC-2026 / ISO 25010)
 *
 * Verifies:
 * 1. Parallel debiting race conditions (conservation of money, zero negative balance).
 * 2. Concurrent order placements competing for balance (atomic transaction consistency).
 * 3. Connection pool saturation and queuing resilience under burst load.
 * 4. Circular deadlock detection (PostgreSQL 40P01 / P2034) and retry handling.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/lib/db';
import { WalletOps, WalletInsufficientFundsError } from '@/services/financial/wallet-ops';
import { runSerializableTransaction } from '@/lib/transactions';
import { Prisma } from '@prisma/client';

describe('Database Stress & Concurrency Race Invariants (RAC-2026)', () => {
  const createdUserIds: string[] = [];

  afterAll(async () => {
    // Cleanup created test users and related records
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

  it('TEST 1 [RACE-DEBIT]: 50 concurrent debits must maintain absolute Conservation of Money without negative balance', async () => {
    const initialBalanceKopecks = BigInt(2500); // 25.00 RUB
    const debitAmount = BigInt(100); // 1.00 RUB per debit
    const concurrentWorkers = 50; // Total requested = 5,000 kopecks (twice the balance)

    const user = await db.user.create({
      data: {
        email: `stress-race-${Date.now()}@smmplan.local`,
        balance: initialBalanceKopecks,
        tenantId: 'smmplan',
        role: 'USER',
      },
    });
    createdUserIds.push(user.id);

    // Launch 50 simultaneous debit operations
    const promises = Array.from({ length: concurrentWorkers }, async (_, index) => {
      try {
        const result = await db.$transaction(async (tx) => {
          return await WalletOps.charge(
            tx,
            user.id,
            debitAmount,
            `Concurrent Debit Task #${index + 1}`,
            {
              tenantId: 'smmplan',
              idempotencyKey: `race-debit-${user.id}-${index + 1}`,
            }
          );
        }, { isolationLevel: 'ReadCommitted', timeout: 15000 });
        return { success: true, balance: result.balance, error: null };
      } catch (err: any) {
        return {
          success: false,
          balance: null,
          errorCode: err?.code || err?.name,
          errorMessage: err?.message,
        };
      }
    });

    const results = await Promise.all(promises);

    const successfulDebits = results.filter((r) => r.success);
    const failedDebits = results.filter((r) => !r.success);

    // EXACT MATH INVARIANT:
    // With 2500 kopecks and 100 per charge, exactly 25 must succeed and 25 must fail
    expect(successfulDebits.length).toBe(25);
    expect(failedDebits.length).toBe(25);

    // All failures must be due to Insufficient Funds
    for (const fail of failedDebits) {
      expect(
        fail.errorCode === 'INSUFFICIENT_FUNDS' ||
        fail.errorMessage?.includes('Insufficient funds')
      ).toBe(true);
    }

    // Verify DB state directly
    const refreshedUser = await db.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { balance: true, totalSpent: true },
    });

    expect(refreshedUser.balance).toBe(BigInt(0));
    expect(refreshedUser.totalSpent).toBe(initialBalanceKopecks);

    // Verify LedgerEntries count
    const ledgerEntries = await db.ledgerEntry.findMany({
      where: { userId: user.id },
    });
    expect(ledgerEntries.length).toBe(25);

    const totalLedgerDebited = ledgerEntries.reduce(
      (sum, entry) => sum + BigInt(entry.amount),
      BigInt(0)
    );
    expect(totalLedgerDebited).toBe(-initialBalanceKopecks);
  });

  it('TEST 2 [PARALLEL-ORDERS]: Parallel order placements competing for balance must guarantee zero orphan orders', async () => {
    const initialBalance = BigInt(3000); // 30.00 RUB
    const orderCost = BigInt(1000); // 10.00 RUB per order
    const parallelOrdersCount = 8; // Total attempt: 8,000 kopecks; only 3 should succeed

    const user = await db.user.create({
      data: {
        email: `stress-orders-${Date.now()}@smmplan.local`,
        balance: initialBalance,
        tenantId: 'smmplan',
        role: 'USER',
      },
    });
    createdUserIds.push(user.id);

    // Find or create a valid service for order placement
    let service = await db.service.findFirst({ where: { isActive: true } });
    if (!service) {
      const network = await db.network.findFirst() || await db.network.create({
        data: { name: 'Stress Test Network', slug: `stress-net-${Date.now()}`, icon: 'zap' },
      });
      const category = await db.category.findFirst() || await db.category.create({
        data: { name: 'Stress Category', networkId: network.id },
      });
      service = await db.service.create({
        data: {
          name: 'Stress Test Service',
          categoryId: category.id,
          pricePer1000Cents: 1000,
          rate: 1.0,
          minQty: 10,
          maxQty: 1000,
          isActive: true,
        },
      });
    }

    // Execute 8 parallel transactions: each charges balance and creates an order atomically
    const orderAttempts = Array.from({ length: parallelOrdersCount }, async (_, idx) => {
      try {
        const order = await db.$transaction(async (tx) => {
          // Step 1: Charge wallet
          await WalletOps.charge(
            tx,
            user.id,
            orderCost,
            `Order placement #${idx + 1}`,
            {
              tenantId: 'smmplan',
              idempotencyKey: `stress-ord-idemp-${user.id}-${idx + 1}`,
            }
          );

          // Step 2: Create Order
          return await tx.order.create({
            data: {
              userId: user.id,
              serviceId: service!.id,
              quantity: 100,
              charge: orderCost,
              providerCost: BigInt(500),
              link: `https://t.me/stress_test_channel_${idx}`,
              status: 'PENDING',
              tenantId: 'smmplan',
            },
          });
        });
        return { success: true, orderId: order.id };
      } catch (err: any) {
        return { success: false, error: err?.message || String(err) };
      }
    });

    const results = await Promise.all(orderAttempts);
    const createdOrders = results.filter((r) => r.success);
    const rejectedOrders = results.filter((r) => !r.success);

    // Exactly 3 orders should succeed (3 * 1000 = 3000 kopecks), 5 rejected
    expect(createdOrders.length).toBe(3);
    expect(rejectedOrders.length).toBe(5);

    // Verify orders count in DB matches exactly created orders
    const dbOrders = await db.order.findMany({ where: { userId: user.id } });
    expect(dbOrders.length).toBe(3);

    // Check user balance is exactly 0
    const finalUser = await db.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { balance: true },
    });
    expect(finalUser.balance).toBe(BigInt(0));
  });

  it('TEST 3 [POOL-SATURATION]: Connection pool must queue 30 concurrent queries without P2024 timeouts', async () => {
    // Current test connection limit is 15. We send 30 queries simultaneously.
    const concurrentQueriesCount = 30;

    const start = Date.now();
    const queryPromises = Array.from({ length: concurrentQueriesCount }, async (_, idx) => {
      // Query executes a fast ping and returns identifier
      const res: any[] = await db.$queryRawUnsafe(
        `SELECT ${idx} AS query_idx, current_database() AS db_name, pg_backend_pid() AS pid`
      );
      return res[0];
    });

    const results = await Promise.all(queryPromises);
    const durationMs = Date.now() - start;

    expect(results.length).toBe(concurrentQueriesCount);
    // Every query must have returned valid row
    for (let i = 0; i < concurrentQueriesCount; i++) {
      expect(results.some((r) => Number(r.query_idx) === i)).toBe(true);
    }

    // Verify distinct backend pids were shared/reused by pool
    const pids = new Set(results.map((r) => r.pid));
    expect(pids.size).toBeGreaterThan(0);
    expect(pids.size).toBeLessThanOrEqual(20); // bounded by pool size
  });

  it('TEST 4 [DEADLOCK-RESILIENCE]: Deadlock simulation between cross-locking transactions must be detected and resolved', async () => {
    // Create two users for cross-locking
    const userA = await db.user.create({
      data: {
        email: `deadlock-a-${Date.now()}@smmplan.local`,
        balance: BigInt(5000),
        tenantId: 'smmplan',
        role: 'USER',
      },
    });
    const userB = await db.user.create({
      data: {
        email: `deadlock-b-${Date.now()}@smmplan.local`,
        balance: BigInt(5000),
        tenantId: 'smmplan',
        role: 'USER',
      },
    });
    createdUserIds.push(userA.id, userB.id);

    // Transaction 1: Locks A, then locks B
    // Transaction 2: Locks B, then locks A
    // Wrapped in runSerializableTransaction to test resilience & automatic retry
    const tx1 = runSerializableTransaction(async (tx) => {
      // Lock User A
      await tx.$executeRawUnsafe(
        `SELECT id FROM "User" WHERE id = '${userA.id}' FOR UPDATE`
      );
      await new Promise((r) => setTimeout(r, 60)); // Yield to allow Tx2 to lock B
      // Lock User B
      await tx.$executeRawUnsafe(
        `SELECT id FROM "User" WHERE id = '${userB.id}' FOR UPDATE`
      );
      return 'TX1_SUCCESS';
    }, 5);

    const tx2 = runSerializableTransaction(async (tx) => {
      // Lock User B
      await tx.$executeRawUnsafe(
        `SELECT id FROM "User" WHERE id = '${userB.id}' FOR UPDATE`
      );
      await new Promise((r) => setTimeout(r, 60)); // Yield to allow Tx1 to lock A
      // Lock User A
      await tx.$executeRawUnsafe(
        `SELECT id FROM "User" WHERE id = '${userA.id}' FOR UPDATE`
      );
      return 'TX2_SUCCESS';
    }, 5);

    // Settle both transactions
    const [res1, res2] = await Promise.allSettled([tx1, tx2]);

    // At least one transaction must succeed immediately, and if deadlock is detected,
    // the retried transaction should succeed or cleanly fail without unhandled crash
    const successful = [res1, res2].filter((r) => r.status === 'fulfilled');
    expect(successful.length).toBeGreaterThanOrEqual(1);

    // Ensure database connection remains healthy after deadlock test
    const ping: any[] = await db.$queryRawUnsafe(`SELECT 1 AS healthy`);
    expect(ping[0].healthy).toBe(1);
  });
});
