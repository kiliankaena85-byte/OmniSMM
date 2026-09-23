/**
 * CLI Tool for Dead Letter Queue (DLQ) & Failed Jobs Management
 * 
 * Usage:
 *   npx tsx scripts/dlq-manage.ts list [--queue <name>] [--limit 50]
 *   npx tsx scripts/dlq-manage.ts retry --id <jobId> [--queue <name>]
 *   npx tsx scripts/dlq-manage.ts retry-all [--queue <name>]
 *   npx tsx scripts/dlq-manage.ts purge [--queue <name>] [--force]
 */

import { Queue } from 'bullmq';
import { getRedisConnection } from '../src/lib/queue-manager';

const ALL_QUEUES = [
  'ordersQueue',
  'refillQueue',
  'syncQueue',
  'catalogQueue',
  'paymentGatewayQueue',
  'paymentSyncQueue',
  'cleanup',
  'telegram-notifications',
  'eta-recalc',
  'articlePublishQueue',
  'dead-letter-queue'
];

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'list';

  // Parse flags
  const getArgValue = (flag: string): string | null => {
    const idx = args.indexOf(flag);
    if (idx !== -1 && idx + 1 < args.length) {
      return args[idx + 1];
    }
    return null;
  };

  const targetQueueName = getArgValue('--queue');
  const limit = parseInt(getArgValue('--limit') || '50', 10);
  const targetJobId = getArgValue('--id');
  const isForce = args.includes('--force');

  const connection = getRedisConnection();

  const getQueuesToProcess = (): string[] => {
    if (targetQueueName) {
      return [targetQueueName];
    }
    return ALL_QUEUES;
  };

  try {
    switch (command) {
      case 'list': {
        console.log(`\n=== Listing Failed Jobs (limit: ${limit}) ===\n`);
        const queues = getQueuesToProcess();
        let totalFailed = 0;

        for (const queueName of queues) {
          const q = new Queue(queueName, { connection });
          try {
            const failedJobs = await q.getFailed(0, limit - 1);
            if (failedJobs.length > 0) {
              console.log(`Queue: [${queueName}] (${failedJobs.length} failed jobs)`);
              console.table(
                failedJobs.map(j => ({
                  jobId: j.id,
                  name: j.name,
                  attemptsMade: j.attemptsMade,
                  failedReason: (j.failedReason || '').slice(0, 50),
                  timestamp: new Date(j.timestamp).toISOString()
                }))
              );
              totalFailed += failedJobs.length;
            }
          } catch (err) {
            console.error(`Could not read queue [${queueName}]: ${(err as Error).message}`);
          } finally {
            await q.close().catch(() => {});
          }
        }

        if (totalFailed === 0) {
          console.log('✅ No failed jobs found in monitored queues.');
        }
        break;
      }

      case 'retry': {
        if (!targetJobId) {
          console.error('❌ Error: --id <jobId> is required for retry command.');
          process.exit(1);
        }

        let retried = false;
        const queues = getQueuesToProcess();

        for (const queueName of queues) {
          const q = new Queue(queueName, { connection });
          try {
            const job = await q.getJob(targetJobId);
            if (job) {
              await job.retry();
              console.log(`✅ Successfully retried job [${targetJobId}] in queue [${queueName}].`);
              retried = true;
              await q.close().catch(() => {});
              break;
            }
          } catch (err) {
            console.error(`Could not query queue [${queueName}]: ${(err as Error).message}`);
          } finally {
            await q.close().catch(() => {});
          }
        }

        if (!retried) {
          console.error(`❌ Error: Job [${targetJobId}] not found in checked queues.`);
        }
        break;
      }

      case 'retry-all': {
        console.log('\n=== Retrying All Failed Jobs ===\n');
        const queues = getQueuesToProcess();
        let retriedCount = 0;

        for (const queueName of queues) {
          const q = new Queue(queueName, { connection });
          try {
            const failedJobs = await q.getFailed();
            for (const job of failedJobs) {
              await job.retry();
              retriedCount++;
            }
            if (failedJobs.length > 0) {
              console.log(`Retried ${failedJobs.length} jobs in queue [${queueName}].`);
            }
          } catch (err) {
            console.error(`Could not retry queue [${queueName}]: ${(err as Error).message}`);
          } finally {
            await q.close().catch(() => {});
          }
        }

        console.log(`\n✅ Finished. Total jobs retried: ${retriedCount}`);
        break;
      }

      case 'purge': {
        if (!isForce) {
          console.log('⚠️  Purge requires confirmation. Pass --force to execute purge.');
          process.exit(0);
        }

        console.log('\n=== Purging Failed Jobs ===\n');
        const queues = getQueuesToProcess();
        let purgedCount = 0;

        for (const queueName of queues) {
          const q = new Queue(queueName, { connection });
          try {
            const failedJobs = await q.getFailed();
            for (const job of failedJobs) {
              await job.remove();
              purgedCount++;
            }
            if (failedJobs.length > 0) {
              console.log(`Purged ${failedJobs.length} jobs in queue [${queueName}].`);
            }
          } catch (err) {
            console.error(`Could not purge queue [${queueName}]: ${(err as Error).message}`);
          } finally {
            await q.close().catch(() => {});
          }
        }

        console.log(`\n✅ Finished. Total jobs purged: ${purgedCount}`);
        break;
      }

      default:
        console.log('Unknown command. Available: list, retry, retry-all, purge');
    }
  } catch (err) {
    console.error('❌ DLQ Manager error:', (err as Error).message);
  } finally {
    await connection.quit().catch(() => {});
  }
}

main();
