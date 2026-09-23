import { Queue } from 'bullmq';
import { redis } from '../src/lib/redis';

async function checkQueues() {
  console.log('Inspecting BullMQ queues in Redis...');
  const queueNames = [
    'ordersQueue', 
    'catalogQueue', 
    'syncQueue', 
    'paymentSyncQueue', 
    'refillQueue', 
    'dead-letter-queue', 
    'telegram-notifications',
    'cleanup',
    'eta-recalc',
    'articlePublishQueue',
    'aiObserverQueue',
    'aiEconomicOptimizerQueue'
  ];
  
  for (const qn of queueNames) {
    const q = new Queue(qn, { connection: redis });
    const counts = await q.getJobCounts('active', 'completed', 'failed', 'delayed', 'waiting', 'paused');
    console.log(`Queue [${qn}]:`, counts);
    if (counts.failed > 0) {
      const failed = await q.getFailed(0, 5);
      for (const j of failed) {
        console.log(`  ❌ [FAILED] ID: ${j.id}, Name: ${j.name}, Attempts: ${j.attemptsMade}, Reason: ${j.failedReason}`);
      }
    }
    await q.close();
  }

  const dlq = new Queue('dead-letter-queue', { connection: redis });
  const dlqJobs = await dlq.getJobs(['completed', 'waiting', 'active', 'failed'], 0, 10);
  console.log(`\n=== Total DLQ jobs (${dlqJobs.length}) ===`);
  for (const j of dlqJobs) {
    console.log(`DLQ Item -> ID: ${j.id}, OriginalQueue: ${j.data?.originalQueue}, Error: ${j.data?.error}`);
  }
  await dlq.close();

  const debouncerKeys = await redis.keys('p0_alert_*');
  console.log('\n=== Debouncer Redis Keys ===', debouncerKeys);
  for (const k of debouncerKeys) {
    console.log(`  ${k} => ${await redis.get(k)} (TTL: ${await redis.ttl(k)}s)`);
  }

  await redis.quit();
}

checkQueues().catch(console.error);
