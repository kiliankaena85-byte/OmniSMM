import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { P0AlertDebouncer } from '@/lib/alerts/p0-alert-debouncer';
import { sendP0EmergencyAlert } from '@/lib/notifications';

const log = logger.child({ component: 'NightlyLedgerAuditService' });

export interface LedgerAuditDiscrepancy {
  userId: string;
  userEmail: string;
  tenantId?: string;
  cachedBalanceCents: number;
  calculatedLedgerSumCents: number;
  diffCents: number;
}

export class NightlyLedgerAuditService {
  /**
   * Scans all users with ledger history to ensure User.balance == SUM(LedgerEntry.amount).
   * Runs lightweight aggregate query without table locks.
   */
  public static async runIntegrityAudit(tenantId?: string): Promise<{
    totalAudited: number;
    discrepancies: LedgerAuditDiscrepancy[];
    isHealthy: boolean;
  }> {
    log.info(`[NightlyLedgerAudit] Starting mathematical ledger consistency audit${tenantId ? ` for tenant [${tenantId}]` : ''}...`);
    const discrepancies: LedgerAuditDiscrepancy[] = [];

    try {
      // 1. Group ledger entries by user - strictly APPROVED status and optional tenant filter
      const ledgerSums = await db.ledgerEntry.groupBy({
        by: ['userId'],
        where: {
          status: 'APPROVED',
          ...(tenantId && tenantId !== 'all' ? { tenantId } : {}),
        },
        _sum: { amount: true },
      });

      // 2. Fetch corresponding users in chunks
      const userIds = ledgerSums.map((l) => l.userId).filter(Boolean) as string[];
      const users = await db.user.findMany({
        where: {
          id: { in: userIds },
          ...(tenantId && tenantId !== 'all' ? { tenantId } : {}),
        },
        select: { id: true, email: true, balance: true, tenantId: true },
      });

      const userMap = new Map(users.map((u) => [u.id, u]));

      for (const entry of ledgerSums) {
        if (!entry.userId) continue;
        const user = userMap.get(entry.userId);
        if (!user) continue;

        const ledgerSum = Number(entry._sum.amount || 0);
        const userBalance = Number(user.balance);

        if (ledgerSum !== userBalance) {
          const diff = Math.abs(userBalance - ledgerSum);
          discrepancies.push({
            userId: user.id,
            userEmail: user.email || 'no-email',
            tenantId: user.tenantId,
            cachedBalanceCents: userBalance,
            calculatedLedgerSumCents: ledgerSum,
            diffCents: diff,
          });
        }
      }

      const isHealthy = discrepancies.length === 0;

      if (!isHealthy) {
        log.error(`[NightlyLedgerAudit] Invariant breach detected! ${discrepancies.length} users with balance drift.`);

        const shouldSend = await P0AlertDebouncer.shouldSendAlert('p0_ledger_invariant', 24 * 3600); // 24h debounce
        if (shouldSend) {
          const sample = discrepancies.slice(0, 3).map(
            (d) => `User ${d.userEmail} (ID: ${d.userId.slice(-6)}, Tenant: ${d.tenantId || 'default'}): Баланс = ${d.cachedBalanceCents / 100} ₽, Проводки = ${d.calculatedLedgerSumCents / 100} ₽ (Разница: ${d.diffCents / 100} ₽)`
          ).join('\n');

          await sendP0EmergencyAlert({
            code: 'P0_LEDGER_INVARIANT_BREACH',
            title: `Математический рассинхрон балансов и проводок у ${discrepancies.length} пользователей!`,
            details: `Обнаружено расхождение между User.balance и суммой записей в LedgerEntry:\n${sample}`,
            actionPlan: 'Проверьте последние Server Actions списания средств и запустите финансовую сверку в разделе «Админка → Финансы → Сверка».',
          });
        }
      } else {
        log.info(`[NightlyLedgerAudit] Consistency audit PASSED. ${userIds.length} accounts verified with 0 drift.`);
      }

      return {
        totalAudited: userIds.length,
        discrepancies,
        isHealthy,
      };
    } catch (err) {
      log.error('[NightlyLedgerAudit] Audit execution failed', { cause: err });
      return { totalAudited: 0, discrepancies: [], isHealthy: false };
    }
  }
}
