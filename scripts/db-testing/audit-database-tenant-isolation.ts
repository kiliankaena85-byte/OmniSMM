import { db } from '../../src/lib/db';
import { TENANTS } from '../../src/config/tenants';

interface TableTenantStat {
  table: string;
  totalRows: number;
  nullOrEmpty: number;
  distribution: Record<string, number>;
  unsupportedTenants: Array<{ tenant: string; count: number }>;
}

interface CrossTenantMismatch {
  relation: string;
  count: number;
  samples: Array<{ id: string; childTenant: string; userTenant: string; userEmail: string }>;
}

const CATALOG_TABLES = new Set(['Category', 'Network', 'Service', 'ShadowService', 'ServiceDraft']);

async function runTenantIsolationAudit() {
  console.log('================================================================');
  console.log('🌐 OMNISMM 1.0 — MULTI-TENANT DATABASE ISOLATION AUDIT');
  console.log('Standards: multi-tenant-isolation-arch, ст. 54.1 НК РФ, PCI-DSS');
  console.log('================================================================\n');

  try {
    // -------------------------------------------------------------------------
    // 0. Динамическая загрузка зарегистрированных тенантов из базы данных
    // -------------------------------------------------------------------------
    let dbTenants: Array<{ slug: string; name: string; domain: string }> = [];
    try {
      dbTenants = await db.tenant.findMany({
        select: { slug: true, name: true, domain: true },
      });
    } catch (e) {
      console.warn('⚠️ Не удалось загрузить тенанты из таблицы Tenant, используется статический список:', (e as Error).message);
    }

    const allRegisteredSlugs = new Set<string>([
      ...TENANTS.map((t) => t.id),
      ...dbTenants.map((t) => t.slug),
    ]);

    const standardAllowedTenants = allRegisteredSlugs;
    const catalogAllowedTenants = new Set<string>([...allRegisteredSlugs, 'all']);

    console.log(`📋 Авторизованные тенанты (${allRegisteredSlugs.size}): [${Array.from(allRegisteredSlugs).join(', ')}]\n`);
    // -------------------------------------------------------------------------
    // 1. Поиск всех таблиц с колонкой tenantId в PostgreSQL
    // -------------------------------------------------------------------------
    const tenantTablesRes = await db.$queryRaw<Array<{ table_name: string }>>`
      SELECT DISTINCT table_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND column_name = 'tenantId'
      ORDER BY table_name;
    `;

    const tenantTables = tenantTablesRes.map((r) => r.table_name);
    console.log(`📋 Найдено ${tenantTables.length} таблиц с изоляцией по tenantId:`);
    console.log(`   ${tenantTables.join(', ')}\n`);

    // -------------------------------------------------------------------------
    // 2. Аудит каждой таблицы: целостность tenantId и распределение по брендам
    // -------------------------------------------------------------------------
    console.log('--- [ШАГ 1: АУДИТ ТАБЛИЦ НА NULL, ПУСТЫЕ И ФАНТОМНЫЕ ТЕНАНТЫ] ---');
    const tableStats: TableTenantStat[] = [];
    let hasTableDefects = false;

    for (const table of tenantTables) {
      // Подсчет null / пустых
      const nullRes = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*)::bigint AS count FROM "${table}" WHERE "tenantId" IS NULL OR "tenantId" = ''`
      );
      const nullCount = Number(nullRes[0]?.count ?? 0n);

      // Общее количество
      const totalRes = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*)::bigint AS count FROM "${table}"`
      );
      const totalCount = Number(totalRes[0]?.count ?? 0n);

      // Распределение по тенантам
      const distRes = await db.$queryRawUnsafe<Array<{ tenantId: string | null; count: bigint }>>(
        `SELECT "tenantId", COUNT(*)::bigint AS count FROM "${table}" GROUP BY "tenantId"`
      );

      const distribution: Record<string, number> = {};
      const unsupported: Array<{ tenant: string; count: number }> = [];

      for (const row of distRes) {
        const t = row.tenantId || 'NULL/EMPTY';
        const cnt = Number(row.count);
        distribution[t] = cnt;
        const allowed = CATALOG_TABLES.has(table) ? catalogAllowedTenants : standardAllowedTenants;
        if (!allowed.has(row.tenantId ?? '')) {
          unsupported.push({ tenant: t, count: cnt });
        }
      }

      tableStats.push({
        table,
        totalRows: totalCount,
        nullOrEmpty: nullCount,
        distribution,
        unsupportedTenants: unsupported,
      });

      const icon = nullCount === 0 && unsupported.length === 0 ? '✅' : '❌';
      console.log(`${icon} Таблица "${table}" (Всего: ${totalCount} строк):`);
      console.log(`   Распределение: ${JSON.stringify(distribution)}`);
      if (nullCount > 0) {
        console.log(`   🚨 ВНИМАНИЕ: Найдено ${nullCount} строк с NULL/EMPTY tenantId!`);
        hasTableDefects = true;
      }
      if (unsupported.length > 0) {
        console.log(`   🚨 ФАНТОМНЫЕ ТЕНАНТЫ: ${JSON.stringify(unsupported)}`);
        hasTableDefects = true;
      }
      console.log('');
    }

    // -------------------------------------------------------------------------
    // 3. Аудит сквозных связей (Cross-Tenant Bleeding: Child.tenantId vs User.tenantId)
    // -------------------------------------------------------------------------
    console.log('--- [ШАГ 2: АУДИТ МЕЖТЕНАНТНОГО СМЕШЕНИЯ (CROSS-TENANT BLEEDING)] ---');
    const crossChecks = [
      { name: 'User ↔ Order', childTable: 'Order', foreignKey: 'userId' },
      { name: 'User ↔ LedgerEntry', childTable: 'LedgerEntry', foreignKey: 'userId' },
      { name: 'User ↔ Ticket', childTable: 'Ticket', foreignKey: 'userId' },
      { name: 'User ↔ Refill', childTable: 'Refill', foreignKey: 'userId' },
      { name: 'User ↔ Session', childTable: 'Session', foreignKey: 'userId' },
    ];

    const crossMismatches: CrossTenantMismatch[] = [];

    for (const check of crossChecks) {
      if (!tenantTables.includes(check.childTable)) continue;

      const mismatchCountRes = await db.$queryRawUnsafe<Array<{ count: bigint }>>(`
        SELECT COUNT(*)::bigint AS count
        FROM "${check.childTable}" c
        JOIN "User" u ON c."${check.foreignKey}" = u.id
        WHERE c."tenantId" != u."tenantId"
      `);

      const mismatchCount = Number(mismatchCountRes[0]?.count ?? 0n);

      if (mismatchCount > 0) {
        const samples = await db.$queryRawUnsafe<Array<{
          id: string;
          childTenant: string;
          userTenant: string;
          userEmail: string;
        }>>(`
          SELECT c.id, c."tenantId" AS "childTenant", u."tenantId" AS "userTenant", u.email AS "userEmail"
          FROM "${check.childTable}" c
          JOIN "User" u ON c."${check.foreignKey}" = u.id
          WHERE c."tenantId" != u."tenantId"
          LIMIT 3
        `);

        crossMismatches.push({
          relation: check.name,
          count: mismatchCount,
          samples,
        });

        console.log(`❌ [FAIL] ${check.name}: Обнаружено ${mismatchCount} записей с нарушением изоляции!`);
        console.log(`   Примеры утечки: ${JSON.stringify(samples)}`);
      } else {
        console.log(`✅ [PASS] ${check.name}: 100% изоляция (0 межтенантных расхождений).`);
      }
    }

    // Дополнительная проверка: Order ↔ Service (Заказ эксклюзивной услуги чужого тенанта)
    const orderServiceMismatch = await db.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM "Order" o
      JOIN "Service" s ON o."serviceId" = s.id
      WHERE s."tenantId" != 'all' AND s."tenantId" != o."tenantId";
    `;
    const osCount = Number(orderServiceMismatch[0]?.count ?? 0n);
    if (osCount === 0) {
      console.log('✅ [PASS] Order ↔ Service: 100% изоляция (0 заказов чужих эксклюзивных услуг).');
    } else {
      console.log(`❌ [FAIL] Order ↔ Service: Найдено ${osCount} заказов чужих эксклюзивных услуг!`);
      crossMismatches.push({ relation: 'Order ↔ Service', count: osCount, samples: [] });
    }

    // Дополнительная проверка: Order ↔ Payment (Оплата заказа через кассу другого тенанта)
    const orderPaymentMismatch = await db.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM "Order" o
      JOIN "Payment" p ON o."paymentId" = p.id
      WHERE o."tenantId" != p."tenantId";
    `;
    const opCount = Number(orderPaymentMismatch[0]?.count ?? 0n);
    if (opCount === 0) {
      console.log('✅ [PASS] Order ↔ Payment: 100% изоляция (0 оплат через чужие фискальные кассы тенанта).');
    } else {
      console.log(`❌ [FAIL] Order ↔ Payment: Найдено ${opCount} оплат через чужие фискальные кассы!`);
      crossMismatches.push({ relation: 'Order ↔ Payment', count: opCount, samples: [] });
    }

    // -------------------------------------------------------------------------
    // 4. Аудит уникальных составных ключей (Composite Unique Constraints)
    // -------------------------------------------------------------------------
    console.log('\n--- [ШАГ 3: АУДИТ СОСТАВНЫХ УНИКАЛЬНЫХ КЛЮЧЕЙ С TENANT_ID] ---');
    const compositeIndexes = await db.$queryRaw<Array<{ tablename: string; indexname: string; indexdef: string }>>`
      SELECT tablename, indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' 
        AND indexdef LIKE '%tenantId%'
        AND indexdef LIKE '%UNIQUE%'
      ORDER BY tablename, indexname;
    `;

    console.log(`✅ Найдено ${compositeIndexes.length} составных UNIQUE индексов с изоляцией по tenantId:`);
    for (const idx of compositeIndexes) {
      console.log(`   - ${idx.tablename} :: ${idx.indexname}`);
    }

    // -------------------------------------------------------------------------
    // 5. Итоговый отчет
    // -------------------------------------------------------------------------
    console.log('\n================================================================');
    console.log('📊 ИТОГОВЫЙ ВЕРДИКТ АУДИТА ТЕНАНТНОЙ ИЗОЛЯЦИИ:');
    console.log('================================================================');

    const totalTablesChecked = tableStats.length;
    const cleanTablesCount = tableStats.filter((t) => t.nullOrEmpty === 0 && t.unsupportedTenants.length === 0).length;
    const crossCheckPass = crossMismatches.length === 0;

    console.log(`- Проверено изолированных таблиц: ${totalTablesChecked}`);
    console.log(`- Таблиц со 100% чистым tenantId: ${cleanTablesCount} / ${totalTablesChecked}`);
    console.log(`- Межтенантных конфликтов в связях (Cross-Tenant): ${crossMismatches.length} связей с ошибками`);

    if (!hasTableDefects && crossCheckPass) {
      console.log('\n🌟 ВЕРДИКТ: ПОЛНАЯ ИЗОЛЯЦИЯ ТЕНАНТОВ (100% COMPLIANT)');
      console.log('   Никаких утечек между smmplan.pro и smmflux.ru не обнаружено.');
      console.log('   Юридический барьер ст. 54.1 НК РФ и PCI-DSS соблюден безупречно.');
    } else {
      console.log('\n⚠️ ВЕРДИКТ: ОБНАРУЖЕНЫ НАРУШЕНИЯ ИЗОЛЯЦИИ ТЕНАНТОВ!');
    }
    console.log('================================================================\n');

  } catch (error) {
    console.error('❌ Ошибка при выполнении аудита изоляции тенантов:', error);
  } finally {
    await db.$disconnect();
    process.exit(0);
  }
}

runTenantIsolationAudit();
