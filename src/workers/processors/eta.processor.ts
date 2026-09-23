import { recalculateAllETAs } from '../../services/eta/eta.service';
import { logger } from '../../lib/logger';

const log = logger.child({ component: 'ETACron' });

/**
 * ETA Recalculation Processor
 * Runs every 15 minutes via BullMQ repeatable job.
 * Uses Adaptive Percentile Window algorithm to estimate execution times.
 */
export async function runETARecalculation(): Promise<void> {
  try {
    const result = await recalculateAllETAs();
    log.info('ETA cron completed', result);
  } catch (error) {
    log.error('ETA cron failed', { error: (error as Error).message });
    throw error; // Re-throw for BullMQ retry/DLQ
  }
}
