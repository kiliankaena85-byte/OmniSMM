import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('Fetching OPS Analytics Data...');

  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // BLOCK 1: Order Flow (Last 24h)
  const orders24h = await prisma.order.findMany({
    where: { createdAt: { gte: last24h } },
    select: { status: true, isDripFeed: true, currentRun: true, runs: true, nextRunAt: true }
  });

  const totalOrders = orders24h.length;
  const statusCounts = orders24h.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalExclAwaiting = totalOrders - (statusCounts['AWAITING_PAYMENT'] || 0);
  const fulfillmentRate = totalExclAwaiting > 0 
    ? ((statusCounts['COMPLETED'] || 0) + (statusCounts['PARTIAL'] || 0)) / totalExclAwaiting * 100 
    : 0;
  const errorRate = totalExclAwaiting > 0 ? (statusCounts['ERROR'] || 0) / totalExclAwaiting * 100 : 0;
  const cancelRate = totalOrders > 0 ? (statusCounts['CANCELED'] || 0) / totalOrders * 100 : 0;

  // BLOCK 2: Timing SLA (completed in last 24h to avoid memory issues)
  const completedOrders = await prisma.order.findMany({
    where: { status: 'COMPLETED', updatedAt: { gte: last24h } },
    select: { createdAt: true, updatedAt: true }
  });

  const fulfillTimes = completedOrders
    .map(o => o.updatedAt.getTime() - o.createdAt.getTime())
    .filter(t => t <= 7 * 24 * 60 * 60 * 1000); // Exclude > 7 days

  let mttf = 0, mttfP95 = 0, fastest = 0, slowest = 0;
  if (fulfillTimes.length > 0) {
    fulfillTimes.sort((a, b) => a - b);
    mttf = fulfillTimes.reduce((a, b) => a + b, 0) / fulfillTimes.length;
    mttfP95 = fulfillTimes[Math.floor(fulfillTimes.length * 0.95)];
    fastest = fulfillTimes[0];
    slowest = fulfillTimes[fulfillTimes.length - 1];
  }

  // BLOCK 3: Provider Reliability (All time active or last 7d)
  const providers = await prisma.provider.findMany({
    select: { id: true, name: true, syncLock: true }
  });

  const providerStats = [];
  for (const provider of providers) {
    const providerOrders = await prisma.order.findMany({
      where: { providerId: provider.id, createdAt: { gte: last7d } },
      select: { status: true, retryCount: true }
    });
    const quarantinedServices = await prisma.service.count({
      where: { providerId: provider.id, isQuarantined: true }
    });
    
    const total = providerOrders.length;
    const errors = providerOrders.filter(o => o.status === 'ERROR').length;
    const pErrorRate = total > 0 ? (errors / total) * 100 : 0;
    const retries = providerOrders.map(o => o.retryCount);
    const avgRetry = retries.length > 0 ? retries.reduce((a, b) => a + b, 0) / retries.length : 0;
    const maxRetry = retries.length > 0 ? Math.max(...retries) : 0;

    providerStats.push({
      name: provider.name,
      totalOrdersRouted: total,
      errorRate: pErrorRate,
      avgRetryCount: avgRetry,
      maxRetry,
      quarantinedServices,
      syncLock: provider.syncLock,
      reliabilityScore: 100 - pErrorRate
    });
  }
  providerStats.sort((a, b) => b.reliabilityScore - a.reliabilityScore);

  // BLOCK 4: Stuck Orders
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000);

  const stuckPending = await prisma.order.findMany({
    where: { status: 'PENDING', updatedAt: { lt: twoHoursAgo } },
    include: { provider: true }
  });
  const stuckInProgress = await prisma.order.findMany({
    where: { status: 'IN_PROGRESS', updatedAt: { lt: fortyEightHoursAgo } },
    include: { provider: true }
  });
  const zombieOrders = await prisma.order.findMany({
    where: { status: 'PENDING', externalId: null, createdAt: { lt: oneHourAgo } },
    include: { provider: true }
  });

  const allStuck = [...stuckPending, ...stuckInProgress, ...zombieOrders].filter((v,i,a)=>a.findIndex(t=>(t.id === v.id))===i);

  // BLOCK 5: DripFeed Health
  // Active DripFeed
  const activeDripFeed = await prisma.order.count({
    where: { isDripFeed: true, status: 'IN_PROGRESS' }
  });
  // NextRunAt < NOW() - 30 min
  const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);
  const stalledDripFeed = await prisma.order.count({
    where: { isDripFeed: true, status: 'IN_PROGRESS', nextRunAt: { lt: thirtyMinAgo } }
  });
  
  // Completed DripFeeds (from orders24h or all time? Let's query all completed DFs in last 24h for completion rate)
  const completedDripFeedsList = await prisma.order.findMany({
    where: { isDripFeed: true, status: 'COMPLETED', updatedAt: { gte: last24h } },
  });
  const completedDripFeeds = completedDripFeedsList.length; // Approximate, as currentRun >= runs is handled on complete

  const dfTotal = completedDripFeeds + activeDripFeed + stalledDripFeed;
  const dfCompletionRate = dfTotal > 0 ? (completedDripFeeds / dfTotal) * 100 : 0;

  // BLOCK 6: Refill SLA (Last 7d)
  const refills = await prisma.refill.findMany({
    where: { createdAt: { gte: last7d } }
  });
  const refillVolume = refills.length;
  const refillCompleted = refills.filter(r => r.status === 'COMPLETED').length;
  const refillRejected = refills.filter(r => r.status === 'REJECTED').length;
  
  const refillFulfillmentRate = refillVolume > 0 ? (refillCompleted / refillVolume) * 100 : 0;
  const refillRejectedRate = refillVolume > 0 ? (refillRejected / refillVolume) * 100 : 0;

  const completedRefills = refills.filter(r => r.status === 'COMPLETED');
  const refillMttfMs = completedRefills.length > 0 
    ? completedRefills.reduce((acc, r) => acc + (r.updatedAt.getTime() - r.createdAt.getTime()), 0) / completedRefills.length
    : 0;

  // BLOCK 7: Quarantine Queue
  const quarantined = await prisma.service.findMany({
    where: { isQuarantined: true }
  });
  const totalQuarantined = quarantined.length;
  
  const quarantineAges = quarantined.map(q => q.quarantinedAt ? now.getTime() - q.quarantinedAt.getTime() : 0);
  const avgQuarantineAge = quarantineAges.length > 0 ? quarantineAges.reduce((a,b)=>a+b, 0) / quarantineAges.length : 0;
  const oldestQuarantine = quarantineAges.length > 0 ? Math.max(...quarantineAges) : 0;

  const qReasons = quarantined.reduce((acc, q) => {
    const reason = q.quarantineReason || 'Unknown';
    acc[reason] = (acc[reason] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const data = {
    now: now.toISOString(),
    start: last24h.toISOString(),
    end: now.toISOString(),
    orderFlow: {
      total: totalOrders,
      statusCounts,
      fulfillmentRate,
      errorRate,
      cancelRate
    },
    timingSLA: {
      mttf, mttfP95, fastest, slowest
    },
    providers: providerStats,
    stuckOrders: {
      pending: stuckPending.length,
      inProgress: stuckInProgress.length,
      zombies: zombieOrders.length,
      list: allStuck.map(o => ({
        id: o.id,
        status: o.status,
        ageMs: now.getTime() - o.updatedAt.getTime(),
        provider: o.provider?.name || 'Unknown',
        error: o.error || 'None'
      }))
    },
    dripFeed: {
      active: activeDripFeed,
      completed: completedDripFeeds,
      stalled: stalledDripFeed,
      completionRate: dfCompletionRate
    },
    refills: {
      volume: refillVolume,
      fulfillmentRate: refillFulfillmentRate,
      rejectedRate: refillRejectedRate,
      mttf: refillMttfMs
    },
    quarantine: {
      total: totalQuarantined,
      avgAge: avgQuarantineAge,
      oldest: oldestQuarantine,
      reasons: qReasons
    }
  };

  console.log('$$__ANALYTICS_DATA__$$');
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
