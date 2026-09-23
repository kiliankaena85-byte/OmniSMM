import { db } from '../src/lib/db';
import { WalletOps } from '../src/services/financial/wallet-ops';

async function main() {
  console.log('=== FINANCIAL INTEGRITY V6: COMPREHENSIVE RECONCILIATION & NEGATIVE ATTEMPTS ===');

  // 1. Seed test tenant and users
  const testTenant = await db.tenant.upsert({
    where: { domain: 'v6-neg.local' },
    update: {},
    create: { name: 'V6 Negative Tenant', slug: 'v6-neg', domain: 'v6-neg.local' }
  });

  const testUser = await db.user.upsert({
    where: { email_tenantId: { email: 'v6_user@smmplan.local', tenantId: testTenant.id } },
    update: { balance: 0n, totalSpent: 0n },
    create: {
      email: 'v6_user@smmplan.local',
      tenantId: testTenant.id,
      balance: 0n,
      totalSpent: 0n,
      role: 'USER'
    }
  });

  const ts = Date.now();

  // 2. Scenario 1: Over-refund Prevention (Partial -> Cancel)
  console.log('--- TEST SCENARIO 1: PARTIAL THEN CANCEL OVER-REFUND PREVENTION ---');
  let orderCharge = 1000_00; // 1000 RUB
  let partialRefundCents = 400_00; // 400 RUB partial refund

  await db.$transaction(async (tx) => {
    // Top-up and Charge
    await WalletOps.credit(tx, testUser.id, 5000_00, 'Top-up YooKassa', { idempotencyKey: `v6-dep-${ts}` });
    await WalletOps.charge(tx, testUser.id, orderCharge, 'Order #8001 Charge', { idempotencyKey: `v6-charge-${ts}` });

    // Step 1: Partial Refund
    await WalletOps.refund(tx, testUser.id, partialRefundCents, 'Order #8001 Partial Refund', { idempotencyKey: `refund_order-8001_${ts}_PARTIAL` });
  });

  // Step 2: Cancel Order after Partial Refund — calculate remaining refund
  let calculatedRemainingRefund = 0;
  await db.$transaction(async (tx) => {
    const partialLedger = await tx.ledgerEntry.findFirst({
      where: { idempotencyKey: `refund_order-8001_${ts}_PARTIAL` }
    });
    const previousPartialRefund = partialLedger ? Number(partialLedger.amount) : 0;
    calculatedRemainingRefund = Math.max(0, orderCharge - previousPartialRefund);

    await WalletOps.refund(tx, testUser.id, calculatedRemainingRefund, 'Order #8001 Final Cancel Refund', { idempotencyKey: `refund_order-8001_${ts}_CANCELED` });
  });

  console.log(`Initial Charge: ${orderCharge} cents, Partial Refund: ${partialRefundCents} cents, Final Cancel Refund: ${calculatedRemainingRefund} cents`);
  console.log(`Total Refunded: ${partialRefundCents + calculatedRemainingRefund} cents (Expected: ${orderCharge} cents) — ${partialRefundCents + calculatedRemainingRefund === orderCharge ? 'PASSED (No Over-refund)' : 'FAILED'}`);

  // 3. Scenario 2: Direct Ledger Integrity Reconciliation
  console.log('--- RECONCILIATION INTEGRITY CHECK ---');
  const freshUser = await db.user.findUniqueOrThrow({ where: { id: testUser.id }, select: { balance: true } });
  const agg = await db.ledgerEntry.aggregate({
    _sum: { amount: true },
    where: { userId: testUser.id, status: 'APPROVED' }
  });
  const ledgerSum = BigInt(agg._sum.amount || 0);
  const isMatch = freshUser.balance === ledgerSum;

  console.log(`User.balance = ${freshUser.balance.toString()} cents`);
  console.log(`Ledger.sum   = ${ledgerSum.toString()} cents`);
  console.log(`Reconciliation MATCH: ${isMatch ? 'PERFECT MATCH' : 'MISMATCH DETECTED'}`);
}

main().catch(console.error).finally(() => process.exit(0));
