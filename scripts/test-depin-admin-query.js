const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    totalNodes,
    activeNodes24h,
    aggregateStats,
    activeTargetsCount,
    rawNodes,
    rawTargets,
  ] = await Promise.all([
    prisma.dePinNode.count(),
    prisma.dePinNode.count({ where: { lastActiveAt: { gte: oneDayAgo } } }),
    prisma.dePinNode.aggregate({
      _sum: {
        creditsBalance: true,
        escrowCredits: true,
        totalCompletedTasks: true,
        tasksFailed: true,
      },
    }),
    prisma.dePinTarget.count({ where: { status: { in: ['QUEUED', 'ASSIGNED'] } } }),
    prisma.dePinNode.findMany({
      orderBy: [{ creditsBalance: 'desc' }, { lastActiveAt: 'desc' }],
      take: 10,
    }),
    prisma.dePinTarget.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);

  console.log('=== REAL POSTGRESQL DePIN ANALYTICS ===');
  console.log('Total nodes:', totalNodes);
  console.log('Active nodes (24h):', activeNodes24h);
  console.log('Total credits:', aggregateStats._sum.creditsBalance, 'PTS');
  console.log('Total rubles eq:', Math.floor((aggregateStats._sum.creditsBalance || 0) / 100), 'RUB');
  console.log('Total escrow:', aggregateStats._sum.escrowCredits, 'PTS');
  console.log('Total completed tasks:', aggregateStats._sum.totalCompletedTasks);
  console.log('Total failed tasks:', aggregateStats._sum.tasksFailed);
  console.log('Active targets in queue:', activeTargetsCount);

  console.log('\nTop 5 Nodes:');
  rawNodes.slice(0, 5).forEach((n, i) => {
    console.log(`[${i+1}] ${n.id} | Balance: ${n.creditsBalance} PTS | Tasks: ${n.totalCompletedTasks} | Failed: ${n.tasksFailed} | Rep: ${n.reputation}%`);
  });

  console.log('\nRecent Targets:');
  rawTargets.slice(0, 3).forEach((t, i) => {
    console.log(`[${i+1}] @${t.channel}/#${t.postId} | ${t.type} | Progress: ${t.completedViews}/${t.targetViews} | Status: ${t.status}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
