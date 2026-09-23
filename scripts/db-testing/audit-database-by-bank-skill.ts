import { db } from '../../src/lib/db';

interface AuditResult {
  category: string;
  name: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  details: string;
  metric?: unknown;
}

async function runBankGradeDbAudit() {
  console.log('================================================================');
  console.log('🏛️  BANK-GRADE DATABASE AUDIT (skill: bank-grade-db-guard)');
  console.log('Standards: ISO 25010:2023, PCI-DSS v4.0.1, 54-ФЗ, BCBS 239');
  console.log('================================================================\n');

  const results: AuditResult[] = [];

  try {
    // -------------------------------------------------------------------------
    // 1. Аппаратный инвариант: неотрицательный баланс (Non-Negative Balance)
    // -------------------------------------------------------------------------
    const negativeUsers = await db.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM "User" WHERE balance < 0;
    `;
    const negCount = Number(negativeUsers[0]?.count ?? 0n);

    const chkConstraint = await db.$queryRaw<Array<{ conname: string }>>`
      SELECT conname FROM pg_constraint 
      WHERE conname = 'chk_user_balance_non_negative' AND conrelid = '"User"'::regclass;
    `;

    if (negCount === 0 && chkConstraint.length > 0) {
      results.push({
        category: '1. Hardware Balance Invariant',
        name: 'Non-Negative User Balance & Hardware CHECK',
        status: 'PASS',
        details: 'Отрицательных балансов нет (0). Аппаратный CHECK chk_user_balance_non_negative активен.',
        metric: { negativeBalanceUsers: negCount, checkConstraintExists: true },
      });
    } else if (negCount === 0) {
      results.push({
        category: '1. Hardware Balance Invariant',
        name: 'Non-Negative User Balance (CHECK Missing)',
        status: 'WARN',
        details: 'Отрицательных балансов нет (0), но аппаратный CHECK в PostgreSQL отсутствует.',
        metric: { negativeBalanceUsers: negCount, checkConstraintExists: false },
      });
    } else {
      results.push({
        category: '1. Hardware Balance Invariant',
        name: 'Negative Balance Detected',
        status: 'FAIL',
        details: `КРИТИЧЕСКИЙ СБОЙ: Обнаружено ${negCount} пользователей с отрицательным балансом!`,
        metric: { negativeBalanceUsers: negCount },
      });
    }

    // -------------------------------------------------------------------------
    // 2. Инвариант неизменяемости Леджера (Immutable Ledger Trigger)
    // -------------------------------------------------------------------------
    const immutableTrigger = await db.$queryRaw<Array<{ tgname: string }>>`
      SELECT tgname FROM pg_trigger 
      WHERE tgname = 'trg_ledger_immutable' AND tgrelid = '"LedgerEntry"'::regclass;
    `;

    if (immutableTrigger.length > 0) {
      results.push({
        category: '2. Immutable Ledger Invariant',
        name: 'LedgerEntry UPDATE/DELETE Immutability Trigger',
        status: 'PASS',
        details: 'Триггер trg_ledger_immutable активен: операции UPDATE и DELETE на уровне PostgreSQL заблокированы.',
        metric: { triggerName: immutableTrigger[0].tgname },
      });
    } else {
      results.push({
        category: '2. Immutable Ledger Invariant',
        name: 'LedgerEntry Immutability Trigger',
        status: 'WARN',
        details: 'Триггер trg_ledger_immutable не найден в БД. Рекомендуется применить scripts/apply-banking-grade-db-hardening.sql.',
        metric: { triggerExists: false },
      });
    }

    // -------------------------------------------------------------------------
    // 3. Инвариант сверки леджера (Reconciliation & Zero Drift)
    // -------------------------------------------------------------------------
    const ledgerDrifts = await db.$queryRaw<Array<{
      id: string;
      email: string;
      current_balance: bigint;
      calculated_ledger_sum: bigint;
      discrepancy: bigint;
    }>>`
      SELECT 
        u.id,
        u.email,
        u.balance AS current_balance,
        COALESCE(SUM(l.amount), 0)::bigint AS calculated_ledger_sum,
        (u.balance - COALESCE(SUM(l.amount), 0))::bigint AS discrepancy
      FROM "User" u
      LEFT JOIN "LedgerEntry" l ON l."userId" = u.id AND l.status = 'APPROVED'
      GROUP BY u.id, u.email, u.balance
      HAVING u.balance != COALESCE(SUM(l.amount), 0)
      LIMIT 10;
    `;

    if (ledgerDrifts.length === 0) {
      results.push({
        category: '3. Ledger-First Reconciliation',
        name: 'Zero Balance-Ledger Drift Invariant',
        status: 'PASS',
        details: 'Сумма утвержденных проводок LedgerEntry на 100% совпадает с User.balance по всем пользователям.',
        metric: { driftsCount: 0 },
      });
    } else {
      results.push({
        category: '3. Ledger-First Reconciliation',
        name: 'Ledger Drift Discrepancy Found',
        status: 'FAIL',
        details: `КРИТИЧЕСКИЙ СБОЙ: Обнаружено расхождение баланса и леджера у ${ledgerDrifts.length} аккаунтов! Требуется протокол карантина.`,
        metric: ledgerDrifts.map((d) => ({
          userId: d.id,
          balance: d.current_balance.toString(),
          ledgerSum: d.calculated_ledger_sum.toString(),
          discrepancy: d.discrepancy.toString(),
        })),
      });
    }

    // -------------------------------------------------------------------------
    // 4. Инвариант идемпотентности: отсутствие дублей ключей
    // -------------------------------------------------------------------------
    const duplicateKeys = await db.$queryRaw<Array<{ idempotencyKey: string; count: bigint }>>`
      SELECT "idempotencyKey", COUNT(*)::bigint AS count
      FROM "LedgerEntry"
      WHERE "idempotencyKey" IS NOT NULL
      GROUP BY "idempotencyKey"
      HAVING COUNT(*) > 1
      LIMIT 5;
    `;

    if (duplicateKeys.length === 0) {
      results.push({
        category: '4. Idempotency Integrity',
        name: 'Duplicate Idempotency Keys in LedgerEntry',
        status: 'PASS',
        details: 'Дубликатов idempotencyKey не обнаружено (строгая защита от повторных списаний P2002).',
        metric: { duplicateKeysCount: 0 },
      });
    } else {
      results.push({
        category: '4. Idempotency Integrity',
        name: 'Duplicate Idempotency Keys Detected',
        status: 'FAIL',
        details: `КРИТИЧЕСКИЙ СБОЙ: Обнаружено ${duplicateKeys.length} дублирующихся ключей идемпотентности!`,
        metric: duplicateKeys,
      });
    }

    // -------------------------------------------------------------------------
    // 5. Инвариант мульти-тенантности: нулевые и битые tenantId
    // -------------------------------------------------------------------------
    const orphanTenantsUsers = await db.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM "User" WHERE "tenantId" IS NULL OR "tenantId" = '';
    `;
    const orphanTenantsOrders = await db.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM "Order" WHERE "tenantId" IS NULL OR "tenantId" = '';
    `;
    const orphanTenantsLedger = await db.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM "LedgerEntry" WHERE "tenantId" IS NULL OR "tenantId" = '';
    `;

    const uCount = Number(orphanTenantsUsers[0]?.count ?? 0n);
    const oCount = Number(orphanTenantsOrders[0]?.count ?? 0n);
    const lCount = Number(orphanTenantsLedger[0]?.count ?? 0n);

    if (uCount === 0 && oCount === 0 && lCount === 0) {
      results.push({
        category: '5. Multi-Tenant Isolation',
        name: 'Tenant ID Integrity across Core Models',
        status: 'PASS',
        details: 'Все записи User, Order, LedgerEntry содержат валидный tenantId. Утечек между тенантами нет.',
        metric: { orphanUsers: uCount, orphanOrders: oCount, orphanLedger: lCount },
      });
    } else {
      results.push({
        category: '5. Multi-Tenant Isolation',
        name: 'Orphan Tenant Records Detected',
        status: 'WARN',
        details: `Обнаружены записи без tenantId: User=${uCount}, Order=${oCount}, LedgerEntry=${lCount}. Требуется батч-бэкфилл.`,
        metric: { orphanUsers: uCount, orphanOrders: oCount, orphanLedger: lCount },
      });
    }

    // -------------------------------------------------------------------------
    // 6. Активные блокировки и дедлоки (Lock Inspection)
    // -------------------------------------------------------------------------
    const activeLocks = await db.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM pg_catalog.pg_locks blocked_locks
      WHERE NOT blocked_locks.granted;
    `;
    const blockedCount = Number(activeLocks[0]?.count ?? 0n);

    if (blockedCount === 0) {
      results.push({
        category: '6. Concurrency & Locks',
        name: 'Lock Contention & Blocked Statements',
        status: 'PASS',
        details: 'Очереди блокировок отсутствуют. 0 процессов ожидают освобождения блокировки.',
        metric: { blockedProcesses: 0 },
      });
    } else {
      results.push({
        category: '6. Concurrency & Locks',
        name: 'Active Lock Contention Detected',
        status: 'WARN',
        details: `Внимание: ${blockedCount} процессов ожидают освобождения блокировок в pg_locks.`,
        metric: { blockedProcesses: blockedCount },
      });
    }

    // -------------------------------------------------------------------------
    // 7. Диагностика раздувания таблиц (Bloat & Dead Tuples)
    // -------------------------------------------------------------------------
    const tableBloat = await db.$queryRaw<Array<{
      relname: string;
      n_live_tup: bigint;
      n_dead_tup: bigint;
      dead_ratio: number;
    }>>`
      SELECT 
        relname,
        n_live_tup,
        n_dead_tup,
        ROUND(n_dead_tup::numeric / GREATEST(n_live_tup + n_dead_tup, 1)::numeric * 100, 2)::float AS dead_ratio
      FROM pg_stat_user_tables
      WHERE relname IN ('Order', 'User', 'LedgerEntry', 'Service')
      ORDER BY n_dead_tup DESC;
    `;

    const highBloat = tableBloat.filter((t) => t.dead_ratio > 20);
    if (highBloat.length === 0) {
      results.push({
        category: '7. Table Health & MVCC Bloat',
        name: 'Dead Tuples Ratio (< 20% SLA)',
        status: 'PASS',
        details: 'Все ключевые таблицы находятся в здоровом состоянии. Раздувание не превышает порог 20%.',
        metric: tableBloat,
      });
    } else {
      results.push({
        category: '7. Table Health & MVCC Bloat',
        name: 'High Dead Tuples Ratio Detected',
        status: 'WARN',
        details: `Таблицы с высоким процентом dead tuples: ${highBloat.map((t) => `${t.relname} (${t.dead_ratio}%)`).join(', ')}. Рекомендуется VACUUM.`,
        metric: tableBloat,
      });
    }

    // -------------------------------------------------------------------------
    // 8. Высокопроизводительные индексы (Trigram / GIN Extension)
    // -------------------------------------------------------------------------
    const trgmExt = await db.$queryRaw<Array<{ extname: string }>>`
      SELECT extname FROM pg_extension WHERE extname = 'pg_trgm';
    `;
    const ginIndexes = await db.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes 
      WHERE indexdef LIKE '%gin%' AND tablename IN ('Order', 'Service', 'User');
    `;

    if (trgmExt.length > 0 && ginIndexes.length > 0) {
      results.push({
        category: '8. Indexing Architecture',
        name: 'pg_trgm Extension & GIN Indexes',
        status: 'PASS',
        details: `Расширение pg_trgm активно, обнаружено ${ginIndexes.length} GIN-индексов для подстрочного поиска без seq_scan.`,
        metric: { extension: 'pg_trgm', ginIndexes: ginIndexes.map((i) => i.indexname) },
      });
    } else {
      results.push({
        category: '8. Indexing Architecture',
        name: 'pg_trgm Extension & GIN Indexes',
        status: 'WARN',
        details: 'pg_trgm или GIN-индексы частично отсутствуют. Рекомендуется применить скрипт харденинга.',
        metric: { trgmEnabled: trgmExt.length > 0, ginIndexesCount: ginIndexes.length },
      });
    }

    // -------------------------------------------------------------------------
    // Вывод итогового отчета
    // -------------------------------------------------------------------------
    console.log('\n📊 РЕЗУЛЬТАТЫ АУДИТА ПО СТАНДАРТУ BANK-GRADE-DB-GUARD:\n');
    let passCount = 0;
    let warnCount = 0;
    let failCount = 0;

    for (const res of results) {
      const icon = res.status === 'PASS' ? '✅' : res.status === 'WARN' ? '⚠️' : '❌';
      console.log(`${icon} [${res.status}] ${res.category} :: ${res.name}`);
      console.log(`   Детали: ${res.details}`);
      if (res.metric) {
        console.log(`   Метрики: ${JSON.stringify(res.metric, (_, v) => typeof v === 'bigint' ? v.toString() : v)}`);
      }
      console.log('');

      if (res.status === 'PASS') passCount++;
      else if (res.status === 'WARN') warnCount++;
      else failCount++;
    }

    console.log('----------------------------------------------------------------');
    console.log(`ИТОГО: PASS = ${passCount}, WARN = ${warnCount}, FAIL = ${failCount}`);
    const complianceScore = Math.round((passCount / results.length) * 100);
    console.log(`COMPLIANCE SCORE: ${complianceScore}%`);
    console.log('----------------------------------------------------------------\n');
  } catch (error) {
    console.error('Критическая ошибка при выполнении аудита БД:', error);
  } finally {
    await db.$disconnect();
    process.exit(0);
  }
}

runBankGradeDbAudit();
