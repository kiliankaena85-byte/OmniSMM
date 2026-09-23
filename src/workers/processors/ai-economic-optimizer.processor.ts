import { Job } from 'bullmq';
import { logger } from '../../lib/logger';
import { MutexManager } from '../../lib/redis-lock';
import { AiEconomicOptimizerService } from '../../services/pricing/ai-economic-optimizer.service';
import type { AiEconomicOptimizerJobPayload } from '../../lib/queue-manager';

const log = logger.child({ component: 'AiEconomicOptimizerWorker' });

export default async function aiEconomicOptimizerProcessor(job: Job<AiEconomicOptimizerJobPayload>) {
  const { tenantId = 'all', analyzedPeriodDays = 30, forceRun = false } = job.data || {};
  const tenantsToProcess = tenantId === 'all' ? ['smmplan', 'flux'] : [tenantId];

  log.info(`[${job.id}] Starting Nightly Economic Optimization for tenants: [${tenantsToProcess.join(', ')}]`);

  const results: Record<string, unknown>[] = [];

  for (const currentTenant of tenantsToProcess) {
    const lockKey = `worker:ai-economic-optimizer:${currentTenant}`;
    const LOCK_TTL_MS = 10 * 60 * 1000;

    try {
      const tenantResult = await MutexManager.withLock(lockKey, LOCK_TTL_MS, 3000, async () => {
        log.info(`[${job.id}][Tenant: ${currentTenant}] Acquired lock, executing optimization pipeline...`);
        return await AiEconomicOptimizerService.runNightlyOptimization({
          tenantId: currentTenant,
          analyzedPeriodDays,
          forceRun,
        });
      });

      results.push(tenantResult);
    } catch (err) {
      const errorMsg = (err as Error).message;
      if (errorMsg.includes('Failed to acquire lock')) {
        log.warn(`[${job.id}][Tenant: ${currentTenant}] Optimization skipped due to lock contention.`);
        results.push({ tenantId: currentTenant, skipped: true, reason: 'LOCK_CONTENTION' });
      } else {
        log.error(`[${job.id}][Tenant: ${currentTenant}] Failed economic optimization: ${errorMsg}`, {
          stack: (err as Error).stack,
        });
        throw err;
      }
    }
  }

  log.info(`[${job.id}] Nightly Economic Optimization finished across all tenants.`);
  return { success: true, processedTenants: results };
}
