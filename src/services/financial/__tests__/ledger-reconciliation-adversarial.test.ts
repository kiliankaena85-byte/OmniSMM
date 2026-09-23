import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { LedgerReconciliationService } from '../ledger-reconciliation.service';
import { WalletOps } from '../wallet-ops';

describe('Adversarial Challenger Suite: Ledger Reconciliation Guard', () => {
  beforeEach(async () => {
    // 1. Clear tables for pristine test environment in canonical lock order
    await db.$executeRawUnsafe('TRUNCATE TABLE "LedgerEntry", "AdminAuditLog", "User" CASCADE;');

    // 2. Enable test mode in system settings
    await db.systemSettings.upsert({
      where: { id: 'global' },
      update: { isTestMode: true },
      create: { id: 'global', isTestMode: true },
    });
  });

  describe('1. Multi-Currency, Negative Balances, Zero Balances & Extreme Values', () => {
    it('should correctly handle zero-balance accounts with 0 transactions and matching 0-sum transactions', async () => {
      const tenant = `adv-zero-${Date.now()}`;
      

      // User 1: 0 balance, 0 transactions
      const uZeroEmpty = await db.user.create({
        data: {
          email: `zero_empty_${Date.now()}@test.pro`,
          balance: BigInt(0),
          tenantId: tenant,
        },
      });

      // User 2: 0 balance, balanced net-zero transactions (+10000, -10000)
      const uZeroNet = await db.user.create({
        data: {
          email: `zero_net_${Date.now()}@test.pro`,
          balance: BigInt(0),
          tenantId: tenant,
        },
      });
      await db.ledgerEntry.createMany({
        data: [
          { userId: uZeroNet.id, amount: BigInt(10000), reason: 'Top-up', status: 'APPROVED', tenantId: tenant },
          { userId: uZeroNet.id, amount: BigInt(-10000), reason: 'Purchase', status: 'APPROVED', tenantId: tenant },
        ],
      });

      // User 3: 0 balance, but orphan phantom ledger entry (+500) -> Anomaly!
      const uZeroOrphan = await db.user.create({
        data: {
          email: `zero_orphan_${Date.now()}@test.pro`,
          balance: BigInt(0),
          tenantId: tenant,
        },
      });
      await db.ledgerEntry.create({
        data: {
          userId: uZeroOrphan.id,
          amount: BigInt(500),
          reason: 'Phantom credit',
          status: 'APPROVED',
          tenantId: tenant,
        },
      });

      const summary = await LedgerReconciliationService.getSummary(tenant);

      expect(summary.totalUsersChecked).toBe(3);
      expect(summary.reconciledUsersCount).toBe(2);
      expect(summary.discrepancyUsersCount).toBe(1);
      expect(summary.totalUserBalancesCents).toBe(0);
      expect(summary.totalLedgerSumsCents).toBe(500);
      expect(summary.netDiscrepancyCents).toBe(-500); // 0 - 500 = -500

      // Verify accounts list sorts the orphan anomaly first
      const accounts = await LedgerReconciliationService.getAccounts({
        onlyAnomalies: true,
        tenantId: tenant,
      });
      expect(accounts.totalCount).toBe(1);
      expect(accounts.items[0].userId).toBe(uZeroOrphan.id);
      expect(accounts.items[0].discrepancy).toBe(-500);
      expect(accounts.items[0].isDiscrepancy).toBe(true);
    });

    it('should correctly reconcile negative balances (overdraft / chargeback) and auto-remediate negative discrepancies', async () => {
      const tenant = `adv-neg-${Date.now()}`;
      

      // User with negative balance (-4500 cents = -45.00 RUB) matching negative ledger entries
      const uNegBalanced = await db.user.create({
        data: {
          email: `neg_balanced_${Date.now()}@test.pro`,
          balance: BigInt(-4500),
          tenantId: tenant,
        },
      });
      await db.ledgerEntry.createMany({
        data: [
          { userId: uNegBalanced.id, amount: BigInt(-5000), reason: 'Chargeback clawback', status: 'APPROVED', tenantId: tenant },
          { userId: uNegBalanced.id, amount: BigInt(500), reason: 'Partial repayment', status: 'APPROVED', tenantId: tenant },
        ],
      });

      // User with negative balance (-6000 cents) but ledger sum is -4000 (discrepancy: -2000)
      const uNegDiscrepancy = await db.user.create({
        data: {
          email: `neg_discrepancy_${Date.now()}@test.pro`,
          balance: BigInt(-6000),
          tenantId: tenant,
        },
      });
      await db.ledgerEntry.create({
        data: {
          userId: uNegDiscrepancy.id,
          amount: BigInt(-4000),
          reason: 'Chargeback',
          status: 'APPROVED',
          tenantId: tenant,
        },
      });

      const summary = await LedgerReconciliationService.getSummary(tenant);
      expect(summary.totalUsersChecked).toBe(2);
      expect(summary.reconciledUsersCount).toBe(1);
      expect(summary.discrepancyUsersCount).toBe(1);
      expect(summary.netDiscrepancyCents).toBe(-2000); // (-4500 - (-4500)) + (-6000 - (-4000)) = -2000

      // Auto-adjust negative discrepancy
      const admin = { id: 'admin-neg-test', email: 'audit@smmplan.pro' };
      const remResult = await LedgerReconciliationService.remediateUser(uNegDiscrepancy.id, 'AUTO_ADJUST', admin, 'Negative ledger balance sync');
      expect(remResult.success).toBe(true);

      // Verify post-condition: 100% integrity
      const postSummary = await LedgerReconciliationService.getSummary(tenant);
      expect(postSummary.reconciledUsersCount).toBe(2);
      expect(postSummary.discrepancyUsersCount).toBe(0);
      expect(postSummary.integrityPercentage).toBe(100);

      // Verify compensating entry was created with -2000 amount
      const compEntry = await db.ledgerEntry.findFirst({
        where: { userId: uNegDiscrepancy.id, transactionType: 'COMPENSATION' },
      });
      expect(compEntry).toBeDefined();
      expect(compEntry!.amount).toBe(BigInt(-2000));
    });

    it('should handle large balances (100M+ RUB in cents) without integer overflow or float truncation', async () => {
      const tenant = `adv-whale-${Date.now()}`;
      

      const HUGE_BALANCE_CENTS = BigInt(10_000_000_000); // 100,000,000.00 RUB = 10 Billion cents

      const uWhale = await db.user.create({
        data: {
          email: `whale_enterprise_${Date.now()}@test.pro`,
          balance: HUGE_BALANCE_CENTS,
          tenantId: tenant,
        },
      });

      await db.ledgerEntry.createMany({
        data: [
          { userId: uWhale.id, amount: BigInt(6_000_000_000), reason: 'Enterprise Deposit 1', status: 'APPROVED', tenantId: tenant },
          { userId: uWhale.id, amount: BigInt(4_000_000_000), reason: 'Enterprise Deposit 2', status: 'APPROVED', tenantId: tenant },
        ],
      });

      const summary = await LedgerReconciliationService.getSummary(tenant);
      expect(summary.totalUsersChecked).toBe(1);
      expect(summary.reconciledUsersCount).toBe(1);
      expect(summary.totalUserBalancesCents).toBe(10_000_000_000);
      expect(summary.totalLedgerSumsCents).toBe(10_000_000_000);
      expect(summary.netDiscrepancyCents).toBe(0);
      expect(summary.integrityPercentage).toBe(100);

      const timeline = await LedgerReconciliationService.getUserAuditTimeline(uWhale.id);
      expect(timeline.user.balance).toBe(10_000_000_000);
      expect(timeline.discrepancy).toBe(0);
      expect(timeline.entries[0].runningBalance).toBe(10_000_000_000);
      expect(timeline.entries[1].runningBalance).toBe(6_000_000_000);
    });
  });

  describe('2. Massive Ledger History (500+ Transactions Stress Test)', () => {
    it('should accurately compute running balance for an account with 550+ ledger entries in under 100ms', async () => {
      const tenant = `adv-heavy-${Date.now()}`;
      

      const TOTAL_ENTRIES = 550;
      let expectedBalance = BigInt(0);

      const heavyUser = await db.user.create({
        data: {
          email: `heavy_trader_${Date.now()}@test.pro`,
          balance: BigInt(0), // Will update after building ledger
          tenantId: tenant,
        },
      });

      const ledgerBatch: Array<{
        userId: string;
        amount: bigint;
        reason: string;
        status: string;
        createdAt: Date;
        tenantId: string;
      }> = [];

      const baseTimestamp = new Date('2026-01-01T00:00:00Z').getTime();

      for (let i = 1; i <= TOTAL_ENTRIES; i++) {
        // Interleave credits (+1000..+5000), debits (-500..-2000), and occasional quarantine/rejected
        let amount: bigint;
        let status = 'APPROVED';

        if (i % 25 === 0) {
          status = 'QUARANTINE';
          amount = BigInt(777); // Should not affect approved balance
        } else if (i % 40 === 0) {
          status = 'REJECTED';
          amount = BigInt(999); // Should not affect approved balance
        } else if (i % 2 === 0) {
          amount = BigInt(-(100 + (i % 50) * 10)); // Debit
          expectedBalance += amount;
        } else {
          amount = BigInt(500 + (i % 30) * 20); // Credit
          expectedBalance += amount;
        }

        ledgerBatch.push({
          userId: heavyUser.id,
          amount,
          reason: `Tx #${i} (${status})`,
          status,
          createdAt: new Date(baseTimestamp + i * 1000),
          tenantId: tenant,
        });
      }

      // Bulk insert 550 entries
      await db.ledgerEntry.createMany({ data: ledgerBatch });

      // Update user balance to exactly match approved sum
      await db.user.update({
        where: { id: heavyUser.id },
        data: { balance: expectedBalance },
      });

      // Benchmark timeline generation
      const startTime = performance.now();
      const timeline = await LedgerReconciliationService.getUserAuditTimeline(heavyUser.id);
      const durationMs = performance.now() - startTime;

      expect(durationMs).toBeLessThan(500); // Must be fast
      expect(timeline.entries.length).toBe(TOTAL_ENTRIES);
      expect(timeline.discrepancy).toBe(0);
      expect(timeline.isDiscrepancy).toBe(false);
      expect(timeline.user.balance).toBe(Number(expectedBalance));

      // Verify running balance integrity from newest to oldest
      // Newest entry (index 0) must have the final runningBalance
      expect(timeline.entries[0].runningBalance).toBe(Number(expectedBalance));

      // Verify sequential step correctness for all 550 entries
      // When re-reversed (oldest to newest), running balance must match incremental prefix sum of approved entries
      const chronological = [...timeline.entries].reverse();
      let calculatedPrefixSum = 0;
      for (let i = 0; i < chronological.length; i++) {
        const e = chronological[i];
        if (e.status === 'APPROVED') {
          calculatedPrefixSum += e.amount;
        }
        expect(e.runningBalance).toBe(calculatedPrefixSum);
      }

      // Benchmark summary aggregation with 550+ entries
      const summaryStart = performance.now();
      const summary = await LedgerReconciliationService.getSummary(tenant);
      const summaryDuration = performance.now() - summaryStart;

      expect(summaryDuration).toBeLessThan(100);
      expect(summary.integrityPercentage).toBe(100);
      expect(summary.totalLedgerSumsCents).toBe(Number(expectedBalance));
    });
  });

  describe('3. Strict Isolation of Quarantine & Multi-Status Entries', () => {
    it('should strictly exclude QUARANTINE, REJECTED, and PENDING entries from reconciliation sum and auto-adjustment', async () => {
      const tenant = `adv-quarantine-${Date.now()}`;
      

      const user = await db.user.create({
        data: {
          email: `quarantine_strict_${Date.now()}@test.pro`,
          balance: BigInt(5000),           // Approved balance = 50.00 RUB
          quarantineBalance: BigInt(25000), // Escrow in quarantine = 250.00 RUB
          tenantId: tenant,
        },
      });

      // Approved entries sum: 3000 + 2000 = 5000 (matches balance 5000)
      // Quarantine entries sum: 15000 + 10000 = 25000 (matches quarantineBalance 25000)
      // Rejected entry: 5000 (excluded)
      await db.ledgerEntry.createMany({
        data: [
          { userId: user.id, amount: BigInt(3000), reason: 'Approved Topup 1', status: 'APPROVED', tenantId: tenant },
          { userId: user.id, amount: BigInt(2000), reason: 'Approved Topup 2', status: 'APPROVED', tenantId: tenant },
          { userId: user.id, amount: BigInt(15000), reason: 'Quarantine Topup A', status: 'QUARANTINE', tenantId: tenant },
          { userId: user.id, amount: BigInt(10000), reason: 'Quarantine Topup B', status: 'QUARANTINE', tenantId: tenant },
          { userId: user.id, amount: BigInt(5000), reason: 'Rejected Fraud Attempt', status: 'REJECTED', tenantId: tenant },
        ],
      });

      const summary = await LedgerReconciliationService.getSummary(tenant);
      expect(summary.reconciledUsersCount).toBe(1);
      expect(summary.discrepancyUsersCount).toBe(0);
      expect(summary.totalUserBalancesCents).toBe(5000);
      expect(summary.totalLedgerSumsCents).toBe(5000); // Must be strictly 5000, NOT 35000

      // AUTO_ADJUST should be a safe no-op because approved balance is already perfectly matching
      const admin = { id: 'admin-q-check', email: 'security@smmplan.pro' };
      const res = await LedgerReconciliationService.remediateUser(user.id, 'AUTO_ADJUST', admin);
      expect(res.success).toBe(true);
      expect(res.message).toContain('Расхождений не обнаружено');

      // Verify no compensation entry was created
      const compCount = await db.ledgerEntry.count({
        where: { userId: user.id, transactionType: 'COMPENSATION' },
      });
      expect(compCount).toBe(0);

      // Verify quarantine balance in User remained intact
      const freshUser = await db.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(freshUser.quarantineBalance).toBe(BigInt(25000));
      expect(freshUser.balance).toBe(BigInt(5000));
    });
  });

  describe('4. Concurrency & Race Condition Resistance (Locking / Remediation vs Active Operations)', () => {
    it('should maintain strict serializability and integrity when remediation races with wallet charges/credits', async () => {
      const tenant = `adv-race-${Date.now()}`;
      

      const user = await db.user.create({
        data: {
          email: `race_user_${Date.now()}@test.pro`,
          balance: BigInt(10000), // 100.00 RUB
          isActive: true,
          tenantId: tenant,
        },
      });

      // Initial matching ledger entry
      await db.ledgerEntry.create({
        data: {
          userId: user.id,
          amount: BigInt(10000),
          reason: 'Initial balance',
          status: 'APPROVED',
          tenantId: tenant,
        },
      });

      const admin = { id: 'admin-concurrency', email: 'guard@smmplan.pro' };

      // Concurrently execute:
      // 1. Account Lock via remediation
      // 2. Wallet charge operation
      // 3. Wallet credit operation
      const operations = [
        LedgerReconciliationService.remediateUser(user.id, 'LOCK', admin, 'Concurrent Security Alert'),
        db.$transaction(async (tx) => {
          return await WalletOps.charge(tx, user.id, BigInt(2000), 'Concurrent Order Payment', {
            idempotencyKey: `race-charge-${Date.now()}`,
          });
        }, { isolationLevel: 'Serializable' }),
        db.$transaction(async (tx) => {
          return await WalletOps.credit(tx, user.id, BigInt(5000), 'Concurrent Topup', {
            idempotencyKey: `race-credit-${Date.now()}`,
          });
        }, { isolationLevel: 'Serializable' }),
      ];

      await Promise.allSettled(operations);

      // Regardless of which committed first or rolled back on conflict, verify final state integrity:
      const finalUser = await db.user.findUniqueOrThrow({ where: { id: user.id } });
      
      // Aggregate approved ledger entries
      const finalLedgerAgg = await db.ledgerEntry.aggregate({
        _sum: { amount: true },
        where: { userId: user.id, status: 'APPROVED' },
      });
      const finalLedgerSum = finalLedgerAgg._sum.amount ?? BigInt(0);

      // Invariant: User.balance MUST EXACTLY equal finalLedgerSum
      expect(finalUser.balance).toBe(finalLedgerSum);

      // Re-run reconciliation summary on this isolated tenant to verify 100% integrity
      const postSummary = await LedgerReconciliationService.getSummary(tenant);
      expect(postSummary.discrepancyUsersCount).toBe(0);
      expect(postSummary.integrityPercentage).toBe(100);
      expect(postSummary.netDiscrepancyCents).toBe(0);
    });
  });
});
