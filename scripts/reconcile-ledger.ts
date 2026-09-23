/**
 * Ledger Reconciliation Script
 * 
 * Compares User.balance with SUM(LedgerEntry.amount) for each user.
 * Detects discrepancies caused by bugs, manual DB edits, or race conditions.
 * 
 * Run: npx tsx scripts/reconcile-ledger.ts
 * Schedule: Daily at 03:00 via cron or PM2
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface Discrepancy {
  userId: string;
  email: string;
  currentBalance: number;
  ledgerSum: number;
  diff: number;
}

async function reconcile(): Promise<void> {
  console.log('[Reconciliation] Starting ledger reconciliation...');

  const users = await prisma.user.findMany({
    select: { id: true, email: true, balance: true },
    where: { balance: { gt: 0 } } // Only check users with positive balance
  });

  const discrepancies: Discrepancy[] = [];

  for (const user of users) {
    const result = await prisma.ledgerEntry.aggregate({
      where: { userId: user.id, status: 'APPROVED' },
      _sum: { amount: true }
    });

    const ledgerSum = Number(result._sum.amount ?? 0);
    const currentBalance = Number(user.balance);
    const diff = currentBalance - ledgerSum;

    if (Math.abs(diff) > 1) { // Tolerance: 1 kopeck
      discrepancies.push({
        userId: user.id,
        email: user.email,
        currentBalance,
        ledgerSum,
        diff
      });
    }
  }

  if (discrepancies.length === 0) {
    console.log(`[Reconciliation] ✅ All ${users.length} users reconciled. No discrepancies.`);
  } else {
    console.error(`[Reconciliation] 🔴 ALERT: ${discrepancies.length} discrepancies found!`);
    
    for (const d of discrepancies) {
      console.error(
        `  User: ${d.email} (${d.userId}) | Balance: ${d.currentBalance} | Ledger Sum: ${d.ledgerSum} | Diff: ${d.diff > 0 ? '+' : ''}${d.diff}`
      );
    }

    // Send Telegram alert if bot token is configured
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

    if (botToken && adminChatId) {
      const message = `🔴 RECONCILIATION ALERT\n\n${discrepancies.length} расхождений баланса!\n\n` +
        discrepancies.slice(0, 5).map(d => 
          `• ${d.email}: баланс ${d.currentBalance}, леджер ${d.ledgerSum}, разница ${d.diff}`
        ).join('\n') +
        (discrepancies.length > 5 ? `\n\n...и ещё ${discrepancies.length - 5}` : '');

      try {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: adminChatId, text: message })
        });
        console.log('[Reconciliation] Telegram alert sent.');
      } catch (e) {
        console.error('[Reconciliation] Failed to send Telegram alert:', e);
      }
    }
  }

  await prisma.$disconnect();
}

reconcile().catch((e) => {
  console.error('[Reconciliation] Fatal error:', e);
  process.exit(1);
});
