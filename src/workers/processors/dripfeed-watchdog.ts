import { db } from '@/lib/db';
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { SmartTaskStatus, SmartCampaignStatus } from '@prisma/client';

const WATCHDOG_LOCK_KEY = 'lock:watchdog:dripfeed:sweep';
const WATCHDOG_LOCK_TTL_SEC = 60;
const STALE_RUN_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes past expected execution

export class DripFeedWatchdog {
  private batchSize: number;

  constructor(batchSize = 50) {
    this.batchSize = batchSize;
  }

  /**
   * Main watchdog sweep executed periodically to recover orphaned smart tasks.
   */
  async sweepAndRecover(): Promise<{ recoveredCount: number; errors: string[] }> {
    let acquired: string | null = null;
    try {
      acquired = await redis.set(WATCHDOG_LOCK_KEY, 'locked', 'EX', WATCHDOG_LOCK_TTL_SEC, 'NX');
    } catch (err: any) {
      logger.error(`[DripFeedWatchdog] Redis lock error: ${err.message}`);
      return { recoveredCount: 0, errors: [err.message] };
    }

    if (!acquired) {
      logger.info('[DripFeedWatchdog] Another node is currently sweeping. Skipping.');
      return { recoveredCount: 0, errors: [] };
    }

    let recoveredCount = 0;
    const errors: string[] = [];

    try {
      const now = new Date();
      const cutoff = new Date(now.getTime() - STALE_RUN_THRESHOLD_MS);

      const orphanedTasks = await db.smartTask.findMany({
        where: {
          status: SmartTaskStatus.PLANNED,
          runAt: { lte: cutoff },
          campaign: {
            status: SmartCampaignStatus.RUNNING,
          },
        },
        include: {
          campaign: true,
        },
        take: this.batchSize,
        orderBy: { runAt: 'asc' },
      });

      if (orphanedTasks.length > 0) {
        logger.info(`[DripFeedWatchdog] Found ${orphanedTasks.length} overdue smart tasks. Triggering processor...`);
        const { runSmartDripfeedTick } = await import('@/workers/processors/dripfeed.processor');
        await runSmartDripfeedTick();
        recoveredCount = orphanedTasks.length;
      }
    } catch (err: any) {
      const msg = `Failed to sweep dripfeed tasks: ${err.message}`;
      logger.error(`[DripFeedWatchdog] ${msg}`);
      errors.push(msg);
    } finally {
      try {
        await redis.del(WATCHDOG_LOCK_KEY);
      } catch (err: any) {
        logger.error(`[DripFeedWatchdog] Error clearing lock: ${err.message}`);
      }
    }

    return { recoveredCount, errors };
  }
}
