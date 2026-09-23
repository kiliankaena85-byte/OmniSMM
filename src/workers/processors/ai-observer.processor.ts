import { Job } from 'bullmq';
import { logger } from '../../lib/logger';
import { AiObserverService } from '../../services/observer/ai-observer.service';

const log = logger.child({ component: 'AiObserverWorker' });

export default async function aiObserverProcessor(job: Job) {
  try {
    log.info(`[${job.id}] Executing daily Executive AI Observer pipeline...`);

    const tenantId = (job.data?.tenantId as string) || 'smmplan';
    const result = await AiObserverService.runObserverPipeline({
      tenantId,
      sendTelegram: true,
      forceRun: false,
    });

    if (result.isKillswitchActive) {
      log.info(`[${job.id}] AI Observer was skipped due to Master Kill-Switch.`);
      return { skipped: true, reason: 'KILLSWITCH_ACTIVE' };
    }

    log.info(`[${job.id}] Executive AI Observer completed successfully in ${result.latencyMs}ms (Source: ${result.source})`);
    return {
      success: true,
      source: result.source,
      latencyMs: result.latencyMs,
      generatedAt: result.generatedAt,
    };
  } catch (error) {
    log.error(`[${job.id}] Critical error in AI Observer worker: ${(error as Error).message}`);
    throw error;
  }
}
