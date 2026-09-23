import { Queue } from 'bullmq';
import { redis } from '../src/lib/redis';

async function cleanQueues() {
  console.log('🧹 Cleaning stale failed/waiting jobs from catalogQueue and dead-letter-queue...');

  const catalogQueue = new Queue('catalogQueue', { connection: redis });
  const dlqQueue = new Queue('dead-letter-queue', { connection: redis });
  const orderQueue = new Queue('ordersQueue', { connection: redis });

  const catCountsBefore = await catalogQueue.getJobCounts();
  console.log('catalogQueue before:', catCountsBefore);

  await catalogQueue.clean(0, 1000, 'failed');
  await catalogQueue.clean(0, 1000, 'completed');
  await catalogQueue.clean(0, 1000, 'wait');

  const dlqCountsBefore = await dlqQueue.getJobCounts();
  console.log('dead-letter-queue before:', dlqCountsBefore);

  await dlqQueue.clean(0, 1000, 'wait');
  await dlqQueue.clean(0, 1000, 'failed');
  await dlqQueue.clean(0, 1000, 'completed');

  await orderQueue.clean(0, 1000, 'failed');
  await orderQueue.clean(0, 1000, 'completed');

  const catCountsAfter = await catalogQueue.getJobCounts();
  const dlqCountsAfter = await dlqQueue.getJobCounts();

  console.log('catalogQueue after:', catCountsAfter);
  console.log('dead-letter-queue after:', dlqCountsAfter);

  await catalogQueue.close();
  await dlqQueue.close();
  await orderQueue.close();
  await redis.quit();
  console.log('✅ Stale queue backlog drained successfully!');
}

cleanQueues().catch(console.error);
