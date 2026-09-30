import type { Job } from 'bullmq';
import { logger } from '@/lib/logger';

export async function processDePinWatchdog(_job: Job): Promise<void> {
  logger.info('🔍 Watchdog round started', { component: 'DePinWatchdog' });
  try {
    const { runFollowAuditRound } = await import('@/services/depin/follow-watchdog');
    const result = await runFollowAuditRound();
    logger.info('✅ Audit done', { component: 'DePinWatchdog', ...result });

    const { DePinEscrowService } = await import('@/services/depin/escrow');
    const { db } = await import('@/lib/db');
    const expired = await DePinEscrowService.getExpiredEscrows();
    let released = 0;
    for (const escrow of expired) {
      await DePinEscrowService.releaseEscrow(escrow.targetId);
      await db.dePinTarget.updateMany({
        where: { id: escrow.targetId, status: 'PENDING_VERIFY' },
        data: { status: 'COMPLETED', verifiedAt: new Date() },
      });
      released++;
    }
    if (released > 0) logger.info(`💰 Released ${released} escrows`, { component: 'DePinWatchdog', released });
  } catch (err: unknown) {
    logger.error('Watchdog failed', { component: 'DePinWatchdog', err: String(err) });
    throw err;
  }
}
