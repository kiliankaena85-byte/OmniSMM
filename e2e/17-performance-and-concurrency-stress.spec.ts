/**
 * e2e/17-performance-and-concurrency-stress.spec.ts
 * BLOCK 17: Performance, Concurrency Stress & Race Condition Protection
 *
 * Invariants & Contract (AGENTS.md & Zero-Defect):
 * 1. Financial Race Conditions: Zero balance double-spending or negative balance anomalies.
 * 2. Idempotency Key Replay Guard: Concurrent duplicate submissions executed exactly once.
 * 3. B2B API v2 Burst Stress: Zero 500 crashes under high concurrent load.
 * 4. Atomic Counter Integrity: Zero lost updates under concurrent Prisma operations.
 * 5. Connection Pool Stability: Clean transaction lifecycle and zero connection exhaustion.
 */

import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { WalletOps, WalletInsufficientFundsError } from '../src/services/financial/wallet-ops';
import { runSerializableTransaction } from '../src/lib/transactions';

const db = new PrismaClient();

test.describe.serial('BLOCK 17: Concurrency & Stress Testing E2E', () => {
  let testUserId: string;

  test.beforeAll(async () => {
    const ts = Date.now();
    // 1. Create a user with balance = 1,000.00 RUB (100,000 cents)
    const user = await db.user.create({
      data: {
        email: `stress-test-${ts}@smmplan.pro`,
        role: 'USER',
        balance: BigInt(100_000), // 1,000.00 RUB
        totalSpent: BigInt(0),
        tenantId: 'smmplan',
      },
    });
    testUserId = user.id;
  });

  test.afterAll(async () => {
    if (testUserId) {
      await db.ledgerEntry.deleteMany({ where: { userId: testUserId } });
      await db.user.deleteMany({ where: { id: testUserId } });
    }
    await db.$disconnect();
  });

  test('Scenario 1: 50-Thread Parallel Debit Race Condition on Financial Balance', async () => {
    // 50 simultaneous debit requests of 50.00 RUB (5,000 cents) each.
    // Total attempted = 2,500.00 RUB. Available = 1,000.00 RUB (100,000 cents).
    // Exactly 20 operations MUST succeed, exactly 30 MUST fail with insufficient funds.
    const threadCount = 50;
    const debitAmount = BigInt(5_000); // 50.00 RUB

    const tasks = Array.from({ length: threadCount }, (_, i) => {
      const idempotencyKey = `race_debit_${testUserId}_${i}_${Date.now()}`;
      return runSerializableTransaction(async (tx) => {
        return await WalletOps.charge(
          tx,
          testUserId,
          debitAmount,
          `Concurrent debit thread #${i}`,
          { idempotencyKey }
        );
      }).then(
        (res) => ({ success: true, cached: res.cached }),
        (err) => ({
          success: false,
          isInsufficient: err instanceof WalletInsufficientFundsError || (err && (err as { code?: string }).code === 'INSUFFICIENT_FUNDS'),
          error: (err instanceof Error ? err.message : String(err)),
        })
      );
    });

    const results = await Promise.all(tasks);
    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);

    // Verify exactly 20 succeeded and 30 failed
    expect(successes.length).toBe(20);
    expect(failures.length).toBe(30);

    // Verify database state: Balance MUST equal EXACTLY 0 cents, totalSpent MUST equal 100,000 cents
    const finalUser = await db.user.findUniqueOrThrow({ where: { id: testUserId } });
    expect(finalUser.balance).toBe(BigInt(0));
    expect(finalUser.totalSpent).toBe(BigInt(100_000));
  });

  test('Scenario 2: Duplicate Idempotency Key Concurrency Replay Attack', async () => {
    // 1. Credit 500.00 RUB (50,000 cents) to test user
    await runSerializableTransaction(async (tx) => {
      return await WalletOps.credit(
        tx,
        testUserId,
        BigInt(50_000),
        'Refill for replay attack test',
        { idempotencyKey: `credit_replay_test_${Date.now()}` }
      );
    });

    // 2. Launch 20 concurrent requests with the SAME idempotency key
    const duplicateKey = `idem_race_replay_${testUserId}_${Date.now()}`;
    const replayTasks = Array.from({ length: 20 }, () => {
      return runSerializableTransaction(async (tx) => {
        return await WalletOps.charge(
          tx,
          testUserId,
          BigInt(10_000), // 100.00 RUB
          'Replay attack debit attempt',
          { idempotencyKey: duplicateKey }
        );
      });
    });

    const replayResults = await Promise.all(replayTasks);
    // All 20 promises resolve successfully (either original execution or cached replay)
    expect(replayResults.length).toBe(20);

    // Verify only ONE 10,000-cent debit occurred
    const userAfterReplay = await db.user.findUniqueOrThrow({ where: { id: testUserId } });
    expect(userAfterReplay.balance).toBe(BigInt(40_000)); // 50,000 - 10,000 = 40,000 cents
  });

  test('Scenario 3: B2B API v2 High-Throughput Burst Stress Test (50 Concurrent Requests)', async ({ request, baseURL }) => {
    const burstCount = 50;
    const burstRequests = Array.from({ length: burstCount }, () => {
      return request.post(`${baseURL}/api/v2`, {
        headers: { 'Content-Type': 'application/json' },
        data: { action: 'services', key: 'mock_key' },
      });
    });

    const responses = await Promise.all(burstRequests);
    expect(responses.length).toBe(burstCount);

    // Verify none of the concurrent requests resulted in a 500 server crash
    for (const resp of responses) {
      expect(resp.status()).not.toBe(500);
      const json = await resp.json();
      expect(json).toBeDefined();
    }
  });

  test('Scenario 4: Atomic Counter Increment Under Heavy Concurrency', async () => {
    const ts = Date.now();
    const promo = await db.promoCode.create({
      data: {
        code: `CONCURRENCY_TEST_${ts}`,
        discountPercent: 10,
        type: 'DISCOUNT',
        maxUses: 100,
        uses: 0,
        isActive: true,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    // 30 concurrent atomic increments
    const incrementTasks = Array.from({ length: 30 }, () => {
      return db.promoCode.update({
        where: { id: promo.id },
        data: { uses: { increment: 1 } },
      });
    });

    await Promise.all(incrementTasks);

    // Verify final count equals exactly 30 (zero lost updates)
    const updatedPromo = await db.promoCode.findUniqueOrThrow({ where: { id: promo.id } });
    expect(updatedPromo.uses).toBe(30);

    // Cleanup promo
    await db.promoCode.delete({ where: { id: promo.id } });
  });

  test('Scenario 5: Database Connection Pool Stability Under Rapid Transactions', async () => {
    // Execute 30 sequential fast transactions to ensure connection pool returns and remains healthy
    for (let i = 0; i < 30; i++) {
      const user = await runSerializableTransaction(async (tx) => {
        return await tx.user.findUnique({ where: { id: testUserId }, select: { id: true, balance: true } });
      });
      expect(user).toBeDefined();
    }
  });
});
