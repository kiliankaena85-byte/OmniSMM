/**
 * (c) 2024-2026 SMMplan / OmniSMM 1.0. All rights reserved.
 * Database Chaos, Fault Injection & Stress CLI Runner (RAC-2026 / ISO 25010)
 *
 * Standalone executable CLI harness for executing chaos engineering experiments:
 * - Transaction Rollback Guarantees
 * - Immutable Ledger Tampering Defense
 * - Parallel Race & Conservation of Money
 * - Hardware Constraint Enforcement (chk_user_balance_non_negative)
 * - Multi-Tenant Isolation Fail-Closed Verification
 */

// Mock server-only for standalone script execution
const Module = require('module');
const orig = Module.prototype.require;
Module.prototype.require = function (id: string) {
  if (typeof id === 'string' && (id === 'server-only' || id.includes('server-only'))) return {};
  return orig.apply(this, arguments);
};

interface ChaosReportItem {
  id: string;
  name: string;
  category: 'FAULT_INJECTION' | 'TAMPER_DEFENSE' | 'CONCURRENCY_RACE' | 'HARDWARE_CONSTRAINT' | 'TENANT_ISOLATION';
  status: 'PASS' | 'FAIL';
  durationMs: number;
  details: string;
}

async function main() {
  const { db } = await import('../../src/lib/db');
  const { WalletOps, WalletUserNotFoundError } = await import('../../src/services/financial/wallet-ops');

  console.log('='.repeat(80));
  console.log('⚡ OMNISMM 1.0 — DATABASE CHAOS & FAULT INJECTION HARNESS (2026)');
  console.log('   Adhering to Standards: RAC-2026 / ISO 25010 / concurrency-acid-guard');
  console.log('='.repeat(80));

  const reports: ChaosReportItem[] = [];
  const testUserIds: string[] = [];

  const record = (item: ChaosReportItem) => {
    reports.push(item);
    const icon = item.status === 'PASS' ? '✅' : '❌';
    console.log(`  ${icon} [${item.id}] ${item.name.padEnd(45)} (${item.durationMs}ms) -> ${item.status}`);
    console.log(`     Details: ${item.details}`);
  };

  try {
    // -------------------------------------------------------------------------
    // Scenario 1: Rollback Atomicity Under Mid-Transaction Crash
    // -------------------------------------------------------------------------
    console.log('\n[1/5] 🌪️ FAULT INJECTION: MID-TRANSACTION CRASH & ROLLBACK ATOMICITY');
    const start1 = Date.now();
    const u1 = await db.user.create({
      data: {
        email: `cli-chaos-crash-${Date.now()}@smmplan.local`,
        balance: BigInt(5000),
        tenantId: 'smmplan',
        role: 'USER',
      },
    });
    testUserIds.push(u1.id);

    const crashKey = `cli-crash-${Date.now()}`;
    let threw = false;
    try {
      await db.$transaction(async (tx) => {
        await WalletOps.charge(tx, u1.id, BigInt(1500), 'Crash candidate', {
          tenantId: 'smmplan',
          idempotencyKey: crashKey,
        });
        throw new Error('SIMULATED_POWER_CUT_BEFORE_TX_COMMIT');
      });
    } catch (e: any) {
      if (e.message === 'SIMULATED_POWER_CUT_BEFORE_TX_COMMIT') threw = true;
    }

    const checkU1 = await db.user.findUnique({ where: { id: u1.id } });
    const checkEntry = await db.ledgerEntry.findFirst({ where: { idempotencyKey: crashKey } });

    if (threw && checkU1?.balance === BigInt(5000) && !checkEntry) {
      record({
        id: 'CHAOS-01',
        name: 'Transaction Rollback Atomicity on Crash',
        category: 'FAULT_INJECTION',
        status: 'PASS',
        durationMs: Date.now() - start1,
        details: 'User balance remained 5000 kopecks; 0 phantom ledger entries were written to disk.',
      });
    } else {
      record({
        id: 'CHAOS-01',
        name: 'Transaction Rollback Atomicity on Crash',
        category: 'FAULT_INJECTION',
        status: 'FAIL',
        durationMs: Date.now() - start1,
        details: `Rollback failed! Balance=${checkU1?.balance}, EntryFound=${!!checkEntry}`,
      });
    }

    // -------------------------------------------------------------------------
    // Scenario 2: Immutable Ledger Physical Tampering
    // -------------------------------------------------------------------------
    console.log('\n[2/5] 🛡️ TAMPER DEFENSE: CONCURRENT MALICIOUS UPDATE & DELETE');
    const start2 = Date.now();
    const validEntry = await db.ledgerEntry.create({
      data: {
        userId: u1.id,
        tenantId: 'smmplan',
        amount: BigInt(1000),
        reason: 'Legit entry for tamper testing',
        status: 'APPROVED',
        idempotencyKey: `cli-tamper-target-${Date.now()}`,
      },
    });

    let updateBlocked = false;
    let deleteBlocked = false;

    try {
      await db.$executeRawUnsafe(`UPDATE "LedgerEntry" SET amount = 999999 WHERE id = '${validEntry.id}'`);
    } catch (e: any) {
      if (String(e).includes('trg_ledger_immutable') || String(e).includes('P0001')) updateBlocked = true;
    }

    try {
      await db.$executeRawUnsafe(`DELETE FROM "LedgerEntry" WHERE id = '${validEntry.id}'`);
    } catch (e: any) {
      if (String(e).includes('trg_ledger_immutable') || String(e).includes('P0001')) deleteBlocked = true;
    }

    if (updateBlocked && deleteBlocked) {
      record({
        id: 'CHAOS-02',
        name: 'Immutable Ledger Physical Trigger Immunity',
        category: 'TAMPER_DEFENSE',
        status: 'PASS',
        durationMs: Date.now() - start2,
        details: 'Both malicious UPDATE and DELETE were physically rejected with code P0001.',
      });
    } else {
      record({
        id: 'CHAOS-02',
        name: 'Immutable Ledger Physical Trigger Immunity',
        category: 'TAMPER_DEFENSE',
        status: 'FAIL',
        durationMs: Date.now() - start2,
        details: `UPDATE blocked=${updateBlocked}, DELETE blocked=${deleteBlocked}`,
      });
    }

    // -------------------------------------------------------------------------
    // Scenario 3: Conservation of Money under High Concurrency (30 parallel debits)
    // -------------------------------------------------------------------------
    console.log('\n[3/5] 🏎️ CONCURRENCY: 30 PARALLEL DEBITS & CONSERVATION OF MONEY');
    const start3 = Date.now();
    const u3 = await db.user.create({
      data: {
        email: `cli-race-${Date.now()}@smmplan.local`,
        balance: BigInt(1500), // 15.00 RUB
        tenantId: 'smmplan',
        role: 'USER',
      },
    });
    testUserIds.push(u3.id);

    const parallelCharges = Array.from({ length: 30 }, async (_, idx) => {
      try {
        await db.$transaction(async (tx) => {
          await WalletOps.charge(tx, u3.id, BigInt(100), `Race task ${idx}`, {
            tenantId: 'smmplan',
            idempotencyKey: `cli-race-${u3.id}-${idx}`,
          });
        });
        return { success: true };
      } catch (e) {
        return { success: false };
      }
    });

    const raceResults = await Promise.all(parallelCharges);
    const successCount = raceResults.filter((r) => r.success).length;
    const failCount = raceResults.filter((r) => !r.success).length;

    const checkU3 = await db.user.findUnique({ where: { id: u3.id } });

    if (successCount === 15 && failCount === 15 && checkU3?.balance === BigInt(0)) {
      record({
        id: 'CHAOS-03',
        name: 'Conservation of Money Under Race Conditions',
        category: 'CONCURRENCY_RACE',
        status: 'PASS',
        durationMs: Date.now() - start3,
        details: 'Exactly 15 succeeded (1500 kopecks), 15 rejected with InsufficientFunds. Final balance: 0.',
      });
    } else {
      record({
        id: 'CHAOS-03',
        name: 'Conservation of Money Under Race Conditions',
        category: 'CONCURRENCY_RACE',
        status: 'FAIL',
        durationMs: Date.now() - start3,
        details: `Succeeded=${successCount}, Failed=${failCount}, FinalBalance=${checkU3?.balance}`,
      });
    }

    // -------------------------------------------------------------------------
    // Scenario 4: PostgreSQL Physical CHECK Constraint (chk_user_balance_non_negative)
    // -------------------------------------------------------------------------
    console.log('\n[4/5] 🛡️ HARDWARE CONSTRAINT: DIRECT NEGATIVE BALANCE BLOCKADE');
    const start4 = Date.now();
    let checkConstraintFired = false;
    try {
      await db.$executeRawUnsafe(`UPDATE "User" SET balance = -999 WHERE id = '${u1.id}'`);
    } catch (e: any) {
      if (String(e).includes('chk_user_balance_non_negative') || String(e).includes('23514')) {
        checkConstraintFired = true;
      }
    }

    if (checkConstraintFired) {
      record({
        id: 'CHAOS-04',
        name: 'PostgreSQL Balance CHECK (balance >= 0)',
        category: 'HARDWARE_CONSTRAINT',
        status: 'PASS',
        durationMs: Date.now() - start4,
        details: 'Direct raw SQL negative update physically blocked with 23514 check_violation.',
      });
    } else {
      record({
        id: 'CHAOS-04',
        name: 'PostgreSQL Balance CHECK (balance >= 0)',
        category: 'HARDWARE_CONSTRAINT',
        status: 'FAIL',
        durationMs: Date.now() - start4,
        details: 'PostgreSQL CHECK constraint failed to block negative balance!',
      });
    }

    // -------------------------------------------------------------------------
    // Scenario 5: Multi-Tenant Cross-Access Isolation
    // -------------------------------------------------------------------------
    console.log('\n[5/5] 🏢 MULTI-TENANT ISOLATION: CROSS-BRAND WALLET TAMPER');
    const start5 = Date.now();
    let tenantBlocked = false;
    try {
      await db.$transaction(async (tx) => {
        await WalletOps.charge(tx, u1.id, BigInt(100), 'Cross-tenant attack', {
          tenantId: 'smmflux', // u1 is smmplan!
        });
      });
    } catch (e: any) {
      if (e instanceof WalletUserNotFoundError || e.code === 'USER_NOT_FOUND') {
        tenantBlocked = true;
      }
    }

    if (tenantBlocked) {
      record({
        id: 'CHAOS-05',
        name: 'Cross-Tenant Financial Isolation Guard',
        category: 'TENANT_ISOLATION',
        status: 'PASS',
        durationMs: Date.now() - start5,
        details: 'Attempt to debit SMMplan user from SMMflux context rejected with WalletUserNotFoundError.',
      });
    } else {
      record({
        id: 'CHAOS-05',
        name: 'Cross-Tenant Financial Isolation Guard',
        category: 'TENANT_ISOLATION',
        status: 'FAIL',
        durationMs: Date.now() - start5,
        details: 'Cross-tenant access was NOT blocked!',
      });
    }
  } finally {
    // Cleanup: temporarily disable ledger trigger to remove ephemeral test data
    if (testUserIds.length > 0) {
      try {
        await db.$executeRawUnsafe(`ALTER TABLE "LedgerEntry" DISABLE TRIGGER trg_ledger_immutable`);
        await db.ledgerEntry.deleteMany({ where: { userId: { in: testUserIds } } });
        await db.user.deleteMany({ where: { id: { in: testUserIds } } });
      } catch (err) {
        // Suppress cleanup issues
      } finally {
        await db.$executeRawUnsafe(`ALTER TABLE "LedgerEntry" ENABLE TRIGGER trg_ledger_immutable`).catch(() => {});
      }
    }
    await db.$disconnect();
  }

  // Summary Table
  console.log('\n' + '='.repeat(80));
  console.log('📊 CHAOS ENGINEERING EXPERIMENT RESULTS SUMMARY (RAC-2026):');
  console.log('  ' + '-'.repeat(76));
  console.log(`  | ${'ID'.padEnd(10)} | ${'Test Name'.padEnd(42)} | ${'Time'.padStart(8)} | ${'Status'.padEnd(6)} |`);
  console.log('  ' + '-'.repeat(76));
  for (const r of reports) {
    console.log(`  | ${r.id.padEnd(10)} | ${r.name.padEnd(42)} | ${(r.durationMs + 'ms').padStart(8)} | ${r.status.padEnd(6)} |`);
  }
  console.log('  ' + '-'.repeat(76));

  const allPassed = reports.every((r) => r.status === 'PASS');
  if (allPassed) {
    console.log('🎉 ALL CHAOS & INTEGRITY EXPERIMENTS PASSED WITH 100% SUCCESS!');
  } else {
    console.log('❌ SOME CHAOS EXPERIMENTS FAILED. CHECK SYSTEM LOGS.');
    process.exit(1);
  }
  console.log('='.repeat(80));
}

main().catch(console.error);
