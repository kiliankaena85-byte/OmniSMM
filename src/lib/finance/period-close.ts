import { db } from '@/lib/db';
import { sendAdminAlert } from '@/lib/notifications';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'FinancialPeriodClose' });

export interface ClosePeriodResult {
  success: boolean;
  periodId?: string;
  frozenEntriesCount: number;
  message?: string;
}

/**
 * Freezes a fiscal/tax month, marking all contained ledger entries as immutable.
 * Prevents retroactive changes during tax audits and 54-FZ compliance checks.
 */
export async function closePeriod(
  month: string, // e.g. "2026-08"
  closedByStaffId: string
): Promise<ClosePeriodResult> {
  try {
    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr, 10);
    const monthNum = parseInt(monthStr, 10);

    if (isNaN(year) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return { success: false, frozenEntriesCount: 0, message: 'Неверный формат месяца. Используйте YYYY-MM.' };
    }

    const startDate = new Date(Date.UTC(year, monthNum - 1, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, monthNum, 0, 23, 59, 59, 999));

    // Upsert or find period
    let period = await db.ledgerPeriod.findUnique({
      where: { month },
    });

    if (period && period.frozen) {
      return {
        success: false,
        periodId: period.id,
        frozenEntriesCount: 0,
        message: `Период ${month} уже был заморожен ${period.frozenAt?.toISOString()} пользователем ${period.frozenBy}`,
      };
    }

    if (!period) {
      period = await db.ledgerPeriod.create({
        data: {
          month,
          startDate,
          endDate,
          frozen: false,
        },
      });
    }

    // Count entries and freeze period in transaction (LedgerEntry rows are strictly immutable and never mutated)
    const updateResult = await db.$transaction(async (tx) => {
      const count = await tx.ledgerEntry.count({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      await tx.ledgerPeriod.update({
        where: { id: period.id },
        data: {
          frozen: true,
          frozenAt: new Date(),
          frozenBy: closedByStaffId,
        },
      });

      return count;
    });

    log.info('Ledger period successfully closed and frozen', {
      month,
      closedByStaffId,
      frozenEntriesCount: updateResult,
    });

    sendAdminAlert(
      `🔒 <b>Налоговый период ${month} закрыт и заморожен!</b>\nОператор: <code>${closedByStaffId}</code>\nЗафиксировано неизменяемых проводок: <b>${updateResult}</b>.`,
      'INFO'
    );

    return {
      success: true,
      periodId: period.id,
      frozenEntriesCount: updateResult,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log.error('Failed to close financial period', { month, error: errorMsg, stack: err instanceof Error ? err.stack : undefined });
    return {
      success: false,
      frozenEntriesCount: 0,
      message: errorMsg,
    };
  }
}

/**
 * Checks if a specific transaction date falls into an already frozen period.
 */
export async function isPeriodFrozen(date: Date): Promise<boolean> {
  const frozenPeriod = await db.ledgerPeriod.findFirst({
    where: {
      startDate: { lte: date },
      endDate: { gte: date },
      frozen: true,
    },
  });

  return Boolean(frozenPeriod);
}
