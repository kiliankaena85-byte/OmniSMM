import { db } from '../src/lib/db';
import { WalletOps } from '../src/services/financial/wallet-ops';

async function main() {
  console.log('=== FINANCIAL INTEGRITY V5: RECONCILIATION & NEGATIVE ATTEMPTS ===');

  // 1. Seed test tenant and users
  const testTenant = await db.tenant.upsert({
    where: { domain: 'neg-test.local' },
    update: {},
    create: { name: 'Negative Attempts Tenant', slug: 'neg-test', domain: 'neg-test.local' }
  });

  const testUser = await db.user.upsert({
    where: { email_tenantId: { email: 'neg_user@smmplan.local', tenantId: testTenant.id } },
    update: { balance: 0n, totalSpent: 0n, referralBalance: 500_00 },
    create: {
      email: 'neg_user@smmplan.local',
      tenantId: testTenant.id,
      balance: 0n,
      totalSpent: 0n,
      referralBalance: 500_00,
      role: 'USER'
    }
  });

  const ts = Date.now();

  // 2. Scenario A: Initial Operations
  await db.$transaction(async (tx) => {
    await WalletOps.credit(tx, testUser.id, 10000_00, 'Deposit YooKassa', { idempotencyKey: `neg-credit-${ts}` });
    await WalletOps.charge(tx, testUser.id, 4000_00, 'Order #7001 Charge', { idempotencyKey: `neg-charge-${ts}` });
    await WalletOps.refund(tx, testUser.id, 1000_00, 'Order #7001 Refund', { idempotencyKey: `neg-refund-${ts}` });
  });

  // 3. Scenario B: Negative Attempts (Duplicate Webhook / Credit / Charge / Refund)
  console.log('--- EXECUTING NEGATIVE DUPLICATE ATTEMPTS ---');

  // Attempt duplicate credit with same idempotencyKey
  let dupCreditBlocked = false;
  await db.$transaction(async (tx) => {
    const res = await WalletOps.credit(tx, testUser.id, 10000_00, 'Duplicate Deposit', { idempotencyKey: `neg-credit-${ts}` });
    if (res.cached) dupCreditBlocked = true;
  });
  console.log(`[Negative Test 1] Duplicate Credit (Idempotency Hit): ${dupCreditBlocked ? 'PASSED (Blocked)' : 'FAILED'}`);

  // Attempt duplicate charge with same idempotencyKey
  let dupChargeBlocked = false;
  await db.$transaction(async (tx) => {
    const res = await WalletOps.charge(tx, testUser.id, 4000_00, 'Duplicate Charge', { idempotencyKey: `neg-charge-${ts}` });
    if (res.cached) dupChargeBlocked = true;
  });
  console.log(`[Negative Test 2] Duplicate Charge (Idempotency Hit): ${dupChargeBlocked ? 'PASSED (Blocked)' : 'FAILED'}`);

  // Attempt duplicate refund with same idempotencyKey
  let dupRefundBlocked = false;
  await db.$transaction(async (tx) => {
    const res = await WalletOps.refund(tx, testUser.id, 1000_00, 'Duplicate Refund', { idempotencyKey: `neg-refund-${ts}` });
    if (res.cached) dupRefundBlocked = true;
  });
  console.log(`[Negative Test 3] Duplicate Refund (Idempotency Hit): ${dupRefundBlocked ? 'PASSED (Blocked)' : 'FAILED'}`);

  // Attempt duplicate promo code activation with same idempotencyKey
  let dupPromoBlocked = false;
  const promoKey = `promo-BONUS100-${testUser.id}`;
  await db.$transaction(async (tx) => {
    await WalletOps.credit(tx, testUser.id, 100_00, 'Promo BONUS100', { idempotencyKey: promoKey });
  });
  await db.$transaction(async (tx) => {
    const res = await WalletOps.credit(tx, testUser.id, 100_00, 'Promo BONUS100 Duplicate', { idempotencyKey: promoKey });
    if (res.cached) dupPromoBlocked = true;
  });
  console.log(`[Negative Test 4] Duplicate Promo Voucher (Idempotency Hit): ${dupPromoBlocked ? 'PASSED (Blocked)' : 'FAILED'}`);

  // 4. Financial Reconciliation Check
  console.log('--- FINANCIAL RECONCILIATION VERIFICATION ---');
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
