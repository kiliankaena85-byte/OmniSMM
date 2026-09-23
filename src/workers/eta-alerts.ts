import { sendAdminAlert } from '@/lib/notifications';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'ETAAlerts' });

export const ETA_ALERT_THRESHOLD = 5;
let etaFailureStreak = 0;

export function getEtaFailureStreak(): number {
  return etaFailureStreak;
}

export function resetEtaFailureStreak(): void {
  etaFailureStreak = 0;
}

export function trackEtaFailure(job?: { id?: string; name?: string }, err?: { message?: string }): void {
  etaFailureStreak++;
  log.error('[etaWorker] Job failed', {
    jobId: job?.id,
    jobName: job?.name,
    error: err?.message,
    consecutiveFailures: etaFailureStreak,
  });

  if (etaFailureStreak >= ETA_ALERT_THRESHOLD) {
    etaFailureStreak = 0; // reset to avoid alert flood
    sendAdminAlert(
      `⚠️ ETA Worker: ${ETA_ALERT_THRESHOLD} подряд проваленных джоб. ETA-статистика на витрине устаревает — проверьте воркеры и Redis.`,
      'WARNING'
    );
  }
}
