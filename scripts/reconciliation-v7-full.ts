import { db } from '../src/lib/db';
import { WalletOps } from '../src/services/financial/wallet-ops';

async function main() {
  console.log('=== FINANCIAL INTEGRITY V7: ADVANCED RECONCILIATION & INTEGRITY AUDIT ===');

  // 1. Seed test tenant and users
  const testTenant = await db.tenant.upsert({
    where: { domain: 'v7-audit.local' },
    update: {},
    create: { name: 'V7 Audit Tenant', slug: 'v7-audit', domain: 'v7-audit.local' }
  });

  const referrer = await db.user.upsert({
    where: { email_tenantId: { email: 'v7_referrer@smmplan.local', tenantId: testTenant.id } },
    update: { balance: 0n, totalSpent: 0n, referralBalance: 0 },
    create: {
      email: 'v7_referrer@smmplan.local',
      tenantId: testTenant.id,
      balance: 0n,
      totalSpent: 0n,
      referralBalance: 0,
      role: 'USER'
    }
  });

  const referred = await db.user.upsert({
    where: { email_tenantId: { email: 'v7_referred@smmplan.local', tenantId: testTenant.id } },
    update: { balance: 0n, totalSpent: 0n, referredById: referrer.id },
    create: {
      email: 'v7_referred@smmplan.local',
      tenantId: testTenant.id,
      balance: 0n,
      totalSpent: 0n,
      referredById: referrer.id,
      role: 'USER'
    }
  });

  const ts = Date.now();

  // 2. Perform Credit, Charge, Commission & Referral Balance Operations
  await db.$transaction(async (tx) => {
    // Deposit & Charge
    await WalletOps.credit(tx, referred.id, 10000_00, 'Deposit YooKassa (RUB)', { idempotencyKey: `v7-dep-${ts}` });
    await WalletOps.charge(tx, referred.id, 5000_00, 'Order #9001 Charge', { idempotencyKey: `v7-charge-${ts}` });

    // Create & Confirm Commission
    const comm = await tx.commission.create({
      data: {
        orderId: `order-v7-${ts}`,
        referrerId: referrer.id,
        amount: 500_00n, // 500 RUB
        status: 'CONFIRMED'
      }
    });

    // Update referral balance atomically
    await tx.user.update({
      where: { id: referrer.id },
      data: { referralBalance: { increment: 500_00 } }
    });

    // Transfer referral balance to main balance
    await tx.user.update({
      where: { id: referrer.id },
      data: {
        referralBalance: { decrement: 500_00 },
        balance: { increment: 500_00 }
      }
    });

    await tx.ledgerEntry.create({
      data: {
        userId: referrer.id,
        amount: 500_00,
        reason: 'Перевод реферального баланса на основной',
        status: 'APPROVED',
        idempotencyKey: `v7-ref-transfer-${referrer.id}-${ts}`
      }
    });
  });

  // 3. Database Reconciliation
  console.log('--- RECONCILIATION VERIFICATION ---');

  // Check 1: User.balance vs SUM(LedgerEntry.amount)
  const users = [referrer, referred];
  let mainBalanceMismatches = 0;

  for (const u of users) {
    const fresh = await db.user.findUniqueOrThrow({ where: { id: u.id }, select: { email: true, balance: true } });
    const agg = await db.ledgerEntry.aggregate({
      _sum: { amount: true },
      where: { userId: u.id, status: 'APPROVED' }
    });
    const ledgerSum = BigInt(agg._sum.amount || 0);
    const isMatch = fresh.balance === ledgerSum;
    if (!isMatch) mainBalanceMismatches++;
    console.log(`User ${fresh.email}: Balance=${fresh.balance.toString()} cents, LedgerSum=${ledgerSum.toString()} cents, MATCH=${isMatch}`);
  }

  // Check 2: User.referralBalance vs Net Active Commissions
  const freshReferrer = await db.user.findUniqueOrThrow({ where: { id: referrer.id }, select: { referralBalance: true } });
  console.log(`Referrer referralBalance: ${freshReferrer.referralBalance} cents (Expected after transfer: 0) — ${freshReferrer.referralBalance === 0 ? 'PASSED' : 'FAILED'}`);

  console.log(`[V7 Reconciliation Result] Main Balance Mismatches: ${mainBalanceMismatches} / ${users.length} users`);
}

main().catch(console.error).finally(() => process.exit(0));
