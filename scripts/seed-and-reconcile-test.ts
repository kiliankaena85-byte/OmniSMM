import { db } from '../src/lib/db';
import { WalletOps } from '../src/services/financial/wallet-ops';

async function main() {
  console.log('=== POPULATED FINANCIAL RECONCILIATION AUDIT ===');
  
  // 1. Seed test tenant and users
  const testTenant = await db.tenant.upsert({
    where: { domain: 'reconcile-test.local' },
    update: {},
    create: { name: 'Reconcile Test Tenant', slug: 'reconcile-test', domain: 'reconcile-test.local' }
  });

  const testUser1 = await db.user.upsert({
    where: { email_tenantId: { email: 'fin_test_user1@smmplan.local', tenantId: testTenant.id } },
    update: { balance: 0n, totalSpent: 0n },
    create: {
      email: 'fin_test_user1@smmplan.local',
      tenantId: testTenant.id,
      balance: 0n,
      totalSpent: 0n,
      role: 'USER'
    }
  });

  const testUser2 = await db.user.upsert({
    where: { email_tenantId: { email: 'fin_test_user2@smmplan.local', tenantId: testTenant.id } },
    update: { balance: 0n, totalSpent: 0n },
    create: {
      email: 'fin_test_user2@smmplan.local',
      tenantId: testTenant.id,
      balance: 0n,
      totalSpent: 0n,
      role: 'USER'
    }
  });

  // 2. Perform Credit Ops
  await db.$transaction(async (tx) => {
    await WalletOps.credit(tx, testUser1.id, 5000_00, 'Top-up YooKassa (Test)', { idempotencyKey: `seed-credit-1-${Date.now()}` });
    await WalletOps.credit(tx, testUser2.id, 2000_00, 'Top-up Robokassa (Test)', { idempotencyKey: `seed-credit-2-${Date.now()}` });
  });

  // 3. Perform Charge Ops
  await db.$transaction(async (tx) => {
    await WalletOps.charge(tx, testUser1.id, 1500_00, 'Order #1001 Debit', { idempotencyKey: `seed-charge-1-${Date.now()}` });
    await WalletOps.charge(tx, testUser2.id, 500_00, 'Order #1002 Debit', { idempotencyKey: `seed-charge-2-${Date.now()}` });
  });

  // 4. Perform Refund Ops
  await db.$transaction(async (tx) => {
    await WalletOps.refund(tx, testUser1.id, 500_00, 'Order #1001 Partial Refund', { idempotencyKey: `seed-refund-1-${Date.now()}` });
  });

  // 5. Run Database Reconciliation
  console.log('--- RECONCILIATION VERIFICATION ON POPULATED DB ---');
  const users = await db.user.findMany({
    where: { id: { in: [testUser1.id, testUser2.id] } },
    select: { id: true, email: true, balance: true, totalSpent: true }
  });

  let mismatches = 0;
  for (const u of users) {
    const aggregate = await db.ledgerEntry.aggregate({
      _sum: { amount: true },
      where: { userId: u.id, status: 'APPROVED' }
    });
    const ledgerSum = BigInt(aggregate._sum.amount || 0);
    const isMatch = u.balance === ledgerSum;
    if (!isMatch) mismatches++;
    console.log(`User ${u.email}: Balance=${u.balance.toString()} cents, LedgerSum=${ledgerSum.toString()} cents, MATCH=${isMatch}`);
  }

  // 6. Duplicate & Null Checks
  const nullIdempotencyCount = await db.ledgerEntry.count({ where: { idempotencyKey: null } });
  const totalLedgers = await db.ledgerEntry.count();

  console.log(`[Result] Balance vs Ledger Mismatches: ${mismatches} / ${users.length} users`);
  console.log(`[Result] Null Idempotency Keys in Ledger: ${nullIdempotencyCount}`);
  console.log(`[Result] Total Ledger Entries Processed: ${totalLedgers}`);
}

main().catch(console.error).finally(() => process.exit(0));
