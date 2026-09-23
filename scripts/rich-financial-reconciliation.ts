import { db } from '../src/lib/db';
import { WalletOps } from '../src/services/financial/wallet-ops';

async function main() {
  console.log('=== RICH FINANCIAL RECONCILIATION AUDIT (V4 FULL DATASET) ===');

  // 1. Seed test tenant and users
  const testTenant = await db.tenant.upsert({
    where: { domain: 'rich-fin.local' },
    update: {},
    create: { name: 'Rich Financial Tenant', slug: 'rich-fin', domain: 'rich-fin.local' }
  });

  const referrerUser = await db.user.upsert({
    where: { email_tenantId: { email: 'referrer@smmplan.local', tenantId: testTenant.id } },
    update: { balance: 0n, totalSpent: 0n, referralBalance: 0 },
    create: {
      email: 'referrer@smmplan.local',
      tenantId: testTenant.id,
      balance: 0n,
      totalSpent: 0n,
      referralBalance: 0,
      role: 'USER'
    }
  });

  const referredUser = await db.user.upsert({
    where: { email_tenantId: { email: 'referred@smmplan.local', tenantId: testTenant.id } },
    update: { balance: 0n, totalSpent: 0n, referredById: referrerUser.id },
    create: {
      email: 'referred@smmplan.local',
      tenantId: testTenant.id,
      balance: 0n,
      totalSpent: 0n,
      referredById: referrerUser.id,
      role: 'USER'
    }
  });

  // 2. Perform Full Cycle: Top-up, Charge, Refund, Referral Commission, Promo Voucher, Support Compensation
  const ts = Date.now();

  await db.$transaction(async (tx) => {
    // Top-up (Deposit)
    await WalletOps.credit(tx, referredUser.id, 20000_00, 'Top-up YooKassa', { idempotencyKey: `rich-dep-${ts}` });
    
    // Charge Order
    await WalletOps.charge(tx, referredUser.id, 8000_00, 'Order #5001 Charge', { idempotencyKey: `rich-charge-${ts}` });
    
    // Partial Refund
    await WalletOps.refund(tx, referredUser.id, 2000_00, 'Order #5001 Partial Refund', { idempotencyKey: `rich-refund-${ts}` });

    // Commission Record & Confirmation
    await tx.commission.create({
      data: {
        orderId: `order-5001-${ts}`,
        referrerId: referrerUser.id,
        amount: 800_00n, // 10% commission = 800 RUB
        status: 'CONFIRMED'
      }
    });
    await WalletOps.credit(tx, referrerUser.id, 800_00, 'Реферальное вознаграждение', { idempotencyKey: `rich-comm-${ts}` });

    // Promo Voucher Credit
    await WalletOps.credit(tx, referredUser.id, 500_00, 'Активация ваучера: BONUS500', { idempotencyKey: `rich-promo-${ts}` });

    // Support Compensation Credit
    await WalletOps.credit(tx, referredUser.id, 300_00, 'Компенсация техподдержки', { idempotencyKey: `rich-comp-${ts}` });
  });

  console.log('--- RECONCILIATION INTEGRITY AUDIT ---');
  const targetUsers = [referrerUser, referredUser];

  let mismatches = 0;
  for (const u of targetUsers) {
    const freshUser = await db.user.findUniqueOrThrow({ where: { id: u.id }, select: { email: true, balance: true } });
    const agg = await db.ledgerEntry.aggregate({
      _sum: { amount: true },
      where: { userId: u.id, status: 'APPROVED' }
    });
    const ledgerSum = BigInt(agg._sum.amount || 0);
    const isMatch = freshUser.balance === ledgerSum;
    if (!isMatch) mismatches++;
    console.log(`User ${freshUser.email}: User.balance=${freshUser.balance.toString()} cents, LedgerSum=${ledgerSum.toString()} cents, MATCH=${isMatch}`);
  }

  // Extended Duplicate SQL Checks
  const dupCommissions = await db.$queryRaw`
    SELECT "orderId", "referrerId", COUNT(*)::int as count 
    FROM "Commission" 
    GROUP BY "orderId", "referrerId" 
    HAVING COUNT(*) > 1`;

  const nullIdempotency = await db.ledgerEntry.count({ where: { idempotencyKey: null } });

  console.log(`[Reconciliation Result] User.balance vs SUM(LedgerEntry.amount) Mismatches: ${mismatches} / ${targetUsers.length} users`);
  console.log(`[Reconciliation Result] Duplicate Commissions Count: ${(dupCommissions as any[]).length}`);
  console.log(`[Reconciliation Result] Null Idempotency Keys Count: ${nullIdempotency}`);
}

main().catch(console.error).finally(() => process.exit(0));
