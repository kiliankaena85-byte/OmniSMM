import { db } from '../../src/lib/db';

interface DriftedUser {
  id: string;
  email: string;
  tenantId: string | null;
  current_balance: bigint;
  calculated_ledger_sum: bigint;
  discrepancy: bigint;
}

async function reconcileLegacyLedgerDrift() {
  console.log('================================================================');
  console.log('⚖️  RUNNING LEDGER-FIRST DRIFT RECONCILIATION');
  console.log('Standard: bank-grade-db-guard (Section 4.4 & Runbook 3)');
  console.log('================================================================\n');

  try {
    // 1. Поиск всех пользователей с расхождением баланса и леджера
    const driftedUsers = await db.$queryRaw<DriftedUser[]>`
      SELECT 
        u.id,
        u.email,
        u."tenantId",
        u.balance AS current_balance,
        COALESCE(SUM(l.amount), 0)::bigint AS calculated_ledger_sum,
        (u.balance - COALESCE(SUM(l.amount), 0))::bigint AS discrepancy
      FROM "User" u
      LEFT JOIN "LedgerEntry" l ON l."userId" = u.id AND l.status = 'APPROVED'
      GROUP BY u.id, u.email, u."tenantId", u.balance
      HAVING u.balance != COALESCE(SUM(l.amount), 0)
      ORDER BY u.id ASC;
    `;

    const totalToReconcile = driftedUsers.length;
    console.log(`🔍 Обнаружено ${totalToReconcile} аккаунтов с расхождением баланса и леджера.\n`);

    if (totalToReconcile === 0) {
      console.log('✅ Все аккаунты находятся в 100% балансе. Реконсиляция не требуется.');
      return;
    }

    console.log('🚀 Старт генерации официальных компенсирующих проводок LedgerEntry...');
    let processed = 0;
    let totalCompensatedKopecks = 0n;

    const BATCH_SIZE = 50;
    for (let i = 0; i < totalToReconcile; i += BATCH_SIZE) {
      const batch = driftedUsers.slice(i, i + BATCH_SIZE);

      await db.$transaction(async (tx) => {
        for (const user of batch) {
          const tenantId = user.tenantId || 'smmplan';
          const discrepancy = user.discrepancy;

          // Создаем компенсирующую проводку (Append-Only)
          await tx.ledgerEntry.create({
            data: {
              userId: user.id,
              tenantId,
              amount: discrepancy,
              reason: `[RECONCILIATION_SYNC] Historical Ledger Drift Fix: Balance=${user.current_balance}n, PrevLedger=${user.calculated_ledger_sum}n`,
              status: 'APPROVED',
              transactionType: discrepancy > 0n ? 'INITIAL_BALANCE_SYNC' : 'COMPENSATION',
              idempotencyKey: `recon:drift:${user.id}`,
            },
          });

          totalCompensatedKopecks += discrepancy;
          processed++;
        }
      });

      console.log(`⏳ Обработано ${processed} / ${totalToReconcile} пользователей (${Math.round((processed / totalToReconcile) * 100)}%)...`);
    }

    console.log('\n================================================================');
    console.log(`✅ РЕКОНСИЛЯЦИЯ УСПЕШНО ЗАВЕРШЕНА!`);
    console.log(`Обработано пользователей: ${processed}`);
    console.log(`Сумма корректировок: ${totalCompensatedKopecks.toString()} копеек`);
    console.log('================================================================\n');

  } catch (error) {
    console.error('❌ Критическая ошибка в процессе реконсиляции леджера:', error);
  } finally {
    await db.$disconnect();
    process.exit(0);
  }
}

reconcileLegacyLedgerDrift();
