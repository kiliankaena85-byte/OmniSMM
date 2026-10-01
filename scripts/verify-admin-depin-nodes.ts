/**
 * Verify DePIN Admin Data Action against real database
 */
import { getDePinAdminDataAction } from '../src/actions/admin/depin/depin-admin-actions';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Testing getDePinAdminDataAction against real database...');

  // Ensure an admin user exists for RBAC mock if needed or directly invoke
  const admin = await prisma.user.findFirst({
    where: { role: { in: ['OWNER', 'SUPPORT', 'SUPER_ADMIN'] } },
  });
  console.log('Admin user found:', admin?.email, 'Role:', admin?.role);

  // Set env if needed
  const res = await getDePinAdminDataAction();
  console.log('Result success:', res.success);
  if (!res.success) {
    console.error('Action error:', res.error);
    process.exit(1);
  }

  console.log('\n📊 DePIN Network Statistics:');
  console.log('• Total nodes:', res.stats?.totalNodes);
  console.log('• Active nodes (24h):', res.stats?.activeNodes24h);
  console.log('• Total credits issued:', res.stats?.totalCreditsIssued, 'PTS');
  console.log('• Rubles equivalent:', res.stats?.totalRublesEquivalent, '₽');
  console.log('• Total escrow credits:', res.stats?.totalEscrowCredits, 'PTS');
  console.log('• Total tasks completed:', res.stats?.totalTasksCompleted);
  console.log('• Active targets in queue:', res.stats?.activeTargetsCount);

  console.log(`\n📋 Loaded ${res.nodes?.length} nodes (Showing top 5):`);
  res.nodes?.slice(0, 5).forEach((node, i) => {
    console.log(`  [${i + 1}] Node: ${node.id} | Balance: ${node.creditsBalance} PTS (${node.rublesEquivalent} ₽) | Tasks: ${node.totalCompletedTasks} | Rep: ${node.reputation}% | Telegram: ${node.telegramId || 'none'}`);
  });

  console.log(`\n🎯 Loaded ${res.targets?.length} targets (Showing top 3):`);
  res.targets?.slice(0, 3).forEach((target, i) => {
    console.log(`  [${i + 1}] Target: @${target.channel}/#${target.postId} | Type: ${target.type} | Progress: ${target.completedViews}/${target.targetViews} | Status: ${target.status}`);
  });

  console.log('\n✅ DePIN Admin Server Action verified successfully!');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
