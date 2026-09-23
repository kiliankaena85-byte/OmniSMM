import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  console.log('Starting Financial Reconciliation...');

  const users = await prisma.user.findMany({
    where: {
      ledgerLogs: { some: {} } // Only check users who have ledger entries
    },
    select: {
      id: true,
      email: true,
      balance: true,
      ledgerLogs: {
        select: {
          amount: true
        }
      }
    }
  });

  let discrepancies = 0;

  for (const user of users) {
    const calculatedBalanceCents = user.ledgerLogs.reduce((sum, entry) => sum + Number(entry.amount), 0);
    const actualBalanceCents = Number(user.balance);

    if (calculatedBalanceCents !== actualBalanceCents) {
      console.error(`[DISCREPANCY] User ${user.email} (ID: ${user.id}):`);
      console.error(`  -> Actual Balance: ${actualBalanceCents}`);
      console.error(`  -> Calculated from Ledger: ${calculatedBalanceCents}`);
      console.error(`  -> Difference: ${actualBalanceCents - calculatedBalanceCents} cents`);
      discrepancies++;
    }
  }

  if (discrepancies === 0) {
    console.log(`✅ Financial Reconciliation Passed. All ${users.length} users with ledger history have matching balances.`);
  } else {
    console.error(`❌ Reconciliation Failed. Found ${discrepancies} discrepancies.`);
  }

  await prisma.$disconnect();
}

run().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
