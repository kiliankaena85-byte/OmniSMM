import { db } from '../src/lib/db';

async function main() {
  console.log('=== FINANCIAL RECONCILIATION AUDIT (EMPIRICAL DB OUTPUT) ===');
  
  // 1. Balance vs Ledger Sum
  const users = await db.user.findMany({ select: { id: true, balance: true, email: true } });
  let balanceMismatchCount = 0;
  for (const u of users) {
    const sumResult = await db.ledgerEntry.aggregate({
      _sum: { amount: true },
      where: { userId: u.id, status: 'APPROVED' }
    });
    const ledgerSum = BigInt(sumResult._sum.amount || 0);
    if (u.balance !== ledgerSum) {
      balanceMismatchCount++;
      console.log(`Mismatch user ${u.id}: User.balance=${u.balance.toString()}, Ledger.sum=${ledgerSum.toString()}`);
    }
  }
  console.log(`[Reconciliation] Balance vs Ledger sum mismatches: ${balanceMismatchCount} / ${users.length} users`);

  // 2. LedgerEntry null idempotencyKey
  const missingIdempotency = await db.ledgerEntry.count({ where: { idempotencyKey: null } });
  console.log(`[Reconciliation] LedgerEntries with null idempotencyKey: ${missingIdempotency}`);

  // 3. LedgerEntry total count
  const totalLedger = await db.ledgerEntry.count();
  console.log(`[Reconciliation] Total LedgerEntries: ${totalLedger}`);

  // 4. Payment status counts
  const totalPayments = await db.payment.count();
  const succeededPayments = await db.payment.count({ where: { status: 'SUCCEEDED' } });
  console.log(`[Reconciliation] Payments total=${totalPayments}, succeeded=${succeededPayments}`);

  // 5. SecurityEvents count
  const securityEventsCount = await db.securityEvent.count();
  console.log(`[Reconciliation] Total SecurityEvents: ${securityEventsCount}`);
}

main().catch(console.error).finally(() => process.exit(0));
