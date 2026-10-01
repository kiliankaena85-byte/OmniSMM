const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const now = Date.now();
  const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    dau,
    wau,
    tappersCount,
    performersCount,
    aggregates,
    ledgerPayouts,
    referrersCount,
    rawTopTappers,
    rawTopPerformers,
    rawTopEarners,
    taskGroups,
  ] = await Promise.all([
    prisma.dePinNode.count(),
    prisma.dePinNode.count({ where: { lastActiveAt: { gte: oneDayAgo } } }),
    prisma.dePinNode.count({ where: { lastActiveAt: { gte: sevenDaysAgo } } }),
    prisma.dePinNode.count({ where: { totalTapsCount: { gt: 0 } } }),
    prisma.dePinNode.count({ where: { totalCompletedTasks: { gt: 0 } } }),
    prisma.dePinNode.aggregate({
      _sum: {
        totalTapsCount: true,
        creditsBalance: true,
        totalCompletedTasks: true,
      },
    }),
    prisma.ledgerEntry.aggregate({
      where: {
        transactionType: 'COMPENSATION',
        reason: { contains: 'DePIN' },
      },
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.dePinReferral.count(),
    prisma.dePinNode.findMany({
      orderBy: { totalTapsCount: 'desc' },
      take: 5,
    }),
    prisma.dePinNode.findMany({
      orderBy: { totalCompletedTasks: 'desc' },
      take: 5,
    }),
    prisma.dePinNode.findMany({
      orderBy: { creditsBalance: 'desc' },
      take: 5,
    }),
    prisma.dePinTaskExecution
      ? prisma.dePinTaskExecution.groupBy({
          by: ['type'],
          _count: { id: true },
        })
      : Promise.resolve([]),
  ]);

  console.log('=== REAL POSTGRESQL DePIN ANALYTICS & FUNNEL ===');
  console.log('1. OVERVIEW:');
  console.log('• Total users (Unique Nodes):', totalUsers);
  console.log('• DAU (Active 24h):', dau, `(${totalUsers > 0 ? Math.round((dau/totalUsers)*100) : 0}%)`);
  console.log('• WAU (Active 7d):', wau);
  console.log('• Total physical taps:', aggregates._sum.totalTapsCount || 0);
  console.log('• Total completed tasks:', aggregates._sum.totalCompletedTasks || 0);
  console.log('• Total PTS issued:', aggregates._sum.creditsBalance || 0);
  console.log('• Total Rubles withdrawn:', Math.abs(ledgerPayouts._sum.amount || 0) / 100, 'RUB');
  console.log('• Payout transactions:', ledgerPayouts._count.id || 0);

  console.log('\n2. CONVERSION FUNNEL:');
  console.log(`[Step 1] Openers / Visitors: ${totalUsers} (100%)`);
  console.log(`[Step 2] Tappers: ${tappersCount} (${totalUsers > 0 ? Math.round((tappersCount/totalUsers)*100) : 0}%)`);
  console.log(`[Step 3] Task Performers: ${performersCount} (${totalUsers > 0 ? Math.round((performersCount/totalUsers)*100) : 0}%)`);
  console.log(`[Step 4] Referrers: ${referrersCount} (${totalUsers > 0 ? Math.round((referrersCount/totalUsers)*100) : 0}%)`);
  console.log(`[Step 5] Converters (Payouts): ${ledgerPayouts._count.id || 0}`);

  console.log('\n3. TOP TASK PERFORMERS (LEADERBOARD):');
  rawTopPerformers.forEach((p, i) => {
    console.log(`  [${i+1}] Node: ${p.id} | Tasks: ${p.totalCompletedTasks} | Balance: ${p.creditsBalance} PTS | Rep: ${p.reputation}%`);
  });

  console.log('\n4. TOP EARNERS (PTS / RUBLES):');
  rawTopEarners.forEach((e, i) => {
    console.log(`  [${i+1}] Node: ${e.id} | Balance: ${e.creditsBalance} PTS (${(e.creditsBalance/100).toFixed(2)} RUB) | Rep: ${e.reputation}%`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
