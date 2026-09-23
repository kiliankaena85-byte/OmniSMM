import { db } from '@/lib/db';
import { sendAdminAlert } from '@/lib/notifications';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'DailyReconciliation' });

export interface DailyReconciliationResult {
  reportId: string;
  date: Date;
  bankTotal: bigint;
  dbTotal: bigint;
  ledgerTotal: bigint;
  deltaBankVsDb: bigint;
  deltaDbVsLedger: bigint;
  status: 'OK' | 'MISMATCH';
}

export interface DailyReconciliationOptions {
  isNetBankSettlement?: boolean;
  acquiringFeeBps?: number; // e.g. 350 for 3.5%
}

/**
 * Executes a 3-way reconciliation across:
 * 1. Bank deposits (external gateway settlements)
 * 2. Database Payment records
 * 3. Double-entry Ledger entries
 */
export async function dailyReconciliation(
  date: Date,
  externalBankTotalKopecks?: bigint,
  options?: DailyReconciliationOptions
): Promise<DailyReconciliationResult> {
  const startOfDay = new Date(date);
  startOfDay.setUTCHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setUTCHours(23, 59, 59, 999);

  // 1. Sum verified payments in DB
  const payments = await db.payment.findMany({
    where: {
      status: { in: ['SUCCEEDED', 'PAID'] },
      createdAt: { gte: startOfDay, lte: endOfDay },
    },
    select: { amount: true },
  });

  const dbTotal = payments.reduce((acc, p) => acc + BigInt(p.amount), BigInt(0));

  // 2. Sum Ledger entries (credits / deposits)
  const ledgerEntries = await db.ledgerEntry.findMany({
    where: {
      amount: { gt: BigInt(0) },
      status: 'APPROVED',
      createdAt: { gte: startOfDay, lte: endOfDay },
    },
    select: { amount: true },
  });

  const ledgerTotal = ledgerEntries.reduce((acc, l) => acc + BigInt(l.amount), BigInt(0));

  // 3. Bank total (defaults to DB total if external settlement feed is not passed)
  const bankTotal = externalBankTotalKopecks !== undefined ? externalBankTotalKopecks : dbTotal;

  // Factor in acquiring fee if settlement is reported Net of gateway fees (e.g. 3.5% for YooKassa)
  let deltaBankVsDb: bigint;
  if (options?.isNetBankSettlement && externalBankTotalKopecks !== undefined) {
    const feeBps = BigInt(options.acquiringFeeBps ?? 350);
    const expectedBankNet = (dbTotal * (BigInt(10000) - feeBps)) / BigInt(10000);
    deltaBankVsDb = bankTotal - expectedBankNet;
  } else {
    deltaBankVsDb = bankTotal - dbTotal;
  }

  const deltaDbVsLedger = dbTotal - ledgerTotal;

  const isMatched = deltaBankVsDb === BigInt(0) && deltaDbVsLedger === BigInt(0);
  const status: 'OK' | 'MISMATCH' = isMatched ? 'OK' : 'MISMATCH';

  // Trigger non-blocking liquidity health monitoring
  import('@/services/financial/liquidity-monitor.service')
    .then(({ LiquidityMonitorService }) => LiquidityMonitorService.checkAndAlertLiquidity())
    .catch(err => log.warn('Liquidity check failed during daily reconciliation', { err }));

  const report = await db.reconciliationReport.create({
    data: {
      date: startOfDay,
      bankTotal,
      dbTotal,
      ledgerTotal,
      deltaBankVsDb,
      deltaDbVsLedger,
      status,
      details: {
        paymentsCount: payments.length,
        ledgerEntriesCount: ledgerEntries.length,
      },
    },
  });

  if (status === 'MISMATCH') {
    log.error('Daily financial reconciliation MISMATCH detected', {
      date: startOfDay.toISOString(),
      bankTotal: bankTotal.toString(),
      dbTotal: dbTotal.toString(),
      ledgerTotal: ledgerTotal.toString(),
      deltaDbVsLedger: deltaDbVsLedger.toString(),
    });

    sendAdminAlert(
      `🚨 <b>CRITICAL: Расхождение в ежедневной сверке (Reconciliation Mismatch)!</b>\nДата: <code>${startOfDay.toISOString().slice(0, 10)}</code>\nБанк: <b>${(Number(bankTotal) / 100).toFixed(2)} ₽</b>\nПлатежи (DB): <b>${(Number(dbTotal) / 100).toFixed(2)} ₽</b>\nГлавная книга (Ledger): <b>${(Number(ledgerTotal) / 100).toFixed(2)} ₽</b>\nДельта: <i>${(Number(deltaDbVsLedger) / 100).toFixed(2)} ₽</i>`,
      'CRITICAL'
    );
  } else {
    log.info('Daily financial reconciliation OK', {
      date: startOfDay.toISOString(),
      totalRub: (Number(dbTotal) / 100).toFixed(2),
    });
  }

  return {
    reportId: report.id,
    date: startOfDay,
    bankTotal,
    dbTotal,
    ledgerTotal,
    deltaBankVsDb,
    deltaDbVsLedger,
    status,
  };
}
