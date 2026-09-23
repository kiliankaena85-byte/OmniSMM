import { db } from '../src/lib/db';
import { WalletOps } from '../src/services/financial/wallet-ops';

async function main() {
  console.log('=== EXTENDED FINANCIAL RECONCILIATION AUDIT (V3 POPULATED DB) ===');
  
  // 1. Seed test tenant and users
  const testTenant = await db.tenant.upsert({
    where: { domain: 'reconcile-ext.local' },
    update: {},
    create: { name: 'Extended Reconcile Tenant', slug: 'reconcile-ext', domain: 'reconcile-ext.local' }
  });

  const testUser = await db.user.upsert({
    where: { email_tenantId: { email: 'ext_fin_user@smmplan.local', tenantId: testTenant.id } },
    update: { balance: 0n, totalSpent: 0n },
    create: {
      email: 'ext_fin_user@smmplan.local',
      tenantId: testTenant.id,
      balance: 0n,
      totalSpent: 0n,
      role: 'USER'
    }
  });

  // 2. Perform credit, charge, refund cycle with idempotency keys
  const idKeyCredit = `ext-credit-${Date.now()}`;
  const idKeyCharge = `ext-charge-${Date.now()}`;
  const idKeyRefund = `ext-refund-${Date.now()}`;

  await db.$transaction(async (tx) => {
    await WalletOps.credit(tx, testUser.id, 10000_00, 'Deposit YooKassa', { idempotencyKey: idKeyCredit });
    await WalletOps.charge(tx, testUser.id, 3000_00, 'Order #9001 Charge', { idempotencyKey: idKeyCharge });
    await WalletOps.refund(tx, testUser.id, 1000_00, 'Order #9001 Partial Refund', { idempotencyKey: idKeyRefund });
  });

  console.log('--- EXECUTING EXTENDED SQL INTEGRITY CHECKS ---');

  // [Check 1] User Balance vs Ledger Sum
  const users = await db.user.findMany({ select: { id: true, email: true, balance: true } });
  let balanceMismatchCount = 0;
  for (const u of users) {
    const sumResult = await db.ledgerEntry.aggregate({
      _sum: { amount: true },
      where: { userId: u.id, status: 'APPROVED' }
    });
    const ledgerSum = BigInt(sumResult._sum.amount || 0);
    if (u.balance !== ledgerSum) balanceMismatchCount++;
  }
  console.log(`[SQL Check 1] User.balance vs SUM(LedgerEntry.amount) mismatches: ${balanceMismatchCount}`);

  // [Check 2] Duplicate ORDER_DEBIT
  const dupDebits = await db.$queryRaw`
    SELECT "idempotencyKey", COUNT(*)::int as count 
    FROM "LedgerEntry" 
    WHERE "amount" < 0 AND "idempotencyKey" IS NOT NULL 
    GROUP BY "idempotencyKey" 
    HAVING COUNT(*) > 1`;
  console.log(`[SQL Check 2] Duplicate ORDER_DEBIT count: ${(dupDebits as any[]).length}`);

  // [Check 3] Duplicate ORDER_REFUND
  const dupRefunds = await db.$queryRaw`
    SELECT "idempotencyKey", COUNT(*)::int as count 
    FROM "LedgerEntry" 
    WHERE "reason" LIKE '%Возврат%' AND "idempotencyKey" IS NOT NULL 
    GROUP BY "idempotencyKey" 
    HAVING COUNT(*) > 1`;
  console.log(`[SQL Check 3] Duplicate ORDER_REFUND count: ${(dupRefunds as any[]).length}`);

  // [Check 4] Duplicate DEPOSIT
  const dupDeposits = await db.$queryRaw`
    SELECT "idempotencyKey", COUNT(*)::int as count 
    FROM "LedgerEntry" 
    WHERE "reason" LIKE '%Пополнение%' AND "idempotencyKey" IS NOT NULL 
    GROUP BY "idempotencyKey" 
    HAVING COUNT(*) > 1`;
  console.log(`[SQL Check 4] Duplicate DEPOSIT count: ${(dupDeposits as any[]).length}`);

  // [Check 5] Duplicate REFERRAL_BONUS
  const dupReferrals = await db.$queryRaw`
    SELECT "idempotencyKey", COUNT(*)::int as count 
    FROM "LedgerEntry" 
    WHERE "reason" LIKE '%Реферальн%' AND "idempotencyKey" IS NOT NULL 
    GROUP BY "idempotencyKey" 
    HAVING COUNT(*) > 1`;
  console.log(`[SQL Check 5] Duplicate REFERRAL_BONUS count: ${(dupReferrals as any[]).length}`);

  // [Check 6] Duplicate COMMISSION
  const dupCommissions = await db.$queryRaw`
    SELECT "orderId", "referrerId", COUNT(*)::int as count 
    FROM "Commission" 
    GROUP BY "orderId", "referrerId" 
    HAVING COUNT(*) > 1`;
  console.log(`[SQL Check 6] Duplicate COMMISSION count: ${(dupCommissions as any[]).length}`);

  // [Check 7] Null Idempotency Keys in Ledger
  const nullIdempotency = await db.ledgerEntry.count({ where: { idempotencyKey: null } });
  console.log(`[SQL Check 7] LedgerEntries with null idempotencyKey: ${nullIdempotency}`);

  // [Check 8] Orphan LedgerEntries
  const orphanLedgers = await db.$queryRaw`
    SELECT COUNT(*)::int as count 
    FROM "LedgerEntry" l 
    LEFT JOIN "User" u ON u.id = l."userId" 
    WHERE u.id IS NULL`;
  console.log(`[SQL Check 8] Orphan LedgerEntries: ${(orphanLedgers as any[])[0]?.count || 0}`);

  console.log('=== EXTENDED RECONCILIATION COMPLETED SUCCESSFULLY ===');
}

main().catch(console.error).finally(() => process.exit(0));
