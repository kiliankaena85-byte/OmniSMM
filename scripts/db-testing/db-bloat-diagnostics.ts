/**
 * (c) 2024-2026 SMMplan / OmniSMM 1.0. All rights reserved.
 * Database Bloat, MVCC HOT-Updates & Autovacuum Diagnostics (RAC-2026 / ISO 25010)
 *
 * Adheres to skills: postgres-query-doctor & db-evolution-zero-downtime.
 * Analyzes table & index bloat, dead tuples, and HOT-update ratios (validating fillfactor = 85).
 */

// Mock server-only for standalone script execution
const Module = require('module');
const orig = Module.prototype.require;
Module.prototype.require = function (id: string) {
  if (typeof id === 'string' && (id === 'server-only' || id.includes('server-only'))) return {};
  return orig.apply(this, arguments);
};

import { db } from '../../src/lib/db';

interface TableBloatMetric {
  tableName: string;
  liveTuples: bigint;
  deadTuples: bigint;
  inserts: bigint;
  updates: bigint;
  deletes: bigint;
  hotUpdates: bigint;
  deadRatioPercent: number;
  hotRatioPercent: number;
  totalSize: string;
  indexSize: string;
  lastAutovacuum: string | null;
  status: 'OPTIMAL' | 'MODERATE_BLOAT' | 'CRITICAL_BLOAT';
}

async function main() {
  console.log('='.repeat(80));
  console.log('🧹 OMNISMM 1.0 — POSTGRESQL BLOAT & MVCC HOT-UPDATES DIAGNOSTICS (2026)');
  console.log('   Adhering to Skills: postgres-query-doctor & db-evolution-zero-downtime');
  console.log('='.repeat(80));

  // 1. Query table statistics and bloat indicators
  const rawStats: any[] = await db.$queryRawUnsafe(`
    SELECT
      c.relname AS table_name,
      pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
      pg_size_pretty(pg_relation_size(c.oid)) AS table_size,
      pg_size_pretty(pg_indexes_size(c.oid)) AS index_size,
      COALESCE(s.n_live_tup, 0) AS live_tuples,
      COALESCE(s.n_dead_tup, 0) AS dead_tuples,
      COALESCE(s.n_tup_ins, 0) AS inserts,
      COALESCE(s.n_tup_upd, 0) AS updates,
      COALESCE(s.n_tup_del, 0) AS deletes,
      COALESCE(s.n_tup_hot_upd, 0) AS hot_updates,
      s.last_autovacuum,
      s.last_vacuum
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
    WHERE c.relkind = 'r'
      AND n.nspname = 'public'
    ORDER BY pg_total_relation_size(c.oid) DESC
    LIMIT 15;
  `);

  console.log('\n[1/3] 📊 TABLE STORAGE, DEAD TUPLES & MVCC HOT-UPDATE EFFICIENCY:');
  console.log('  ' + '-'.repeat(76));
  console.log(`  | ${'Table'.padEnd(16)} | ${'Total'.padStart(8)} | ${'Live Tup'.padStart(9)} | ${'Dead Tup'.padStart(9)} | ${'Dead %'.padStart(7)} | ${'HOT Upd %'.padStart(10)} | ${'Status'.padEnd(12)} |`);
  console.log('  ' + '-'.repeat(76));

  const metrics: TableBloatMetric[] = [];

  for (const row of rawStats) {
    const live = BigInt(row.live_tuples || 0);
    const dead = BigInt(row.dead_tuples || 0);
    const updates = BigInt(row.updates || 0);
    const hotUpdates = BigInt(row.hot_updates || 0);

    const totalTuples = live + dead;
    const deadRatio = totalTuples > BigInt(0) ? (Number(dead) / Number(totalTuples)) * 100 : 0;
    const hotRatio = updates > BigInt(0) ? (Number(hotUpdates) / Number(updates)) * 100 : 100;

    let status: 'OPTIMAL' | 'MODERATE_BLOAT' | 'CRITICAL_BLOAT' = 'OPTIMAL';
    if (deadRatio > 25.0 && dead > BigInt(100)) {
      status = 'CRITICAL_BLOAT';
    } else if (deadRatio > 10.0 && dead > BigInt(50)) {
      status = 'MODERATE_BLOAT';
    }

    metrics.push({
      tableName: row.table_name,
      liveTuples: live,
      deadTuples: dead,
      inserts: BigInt(row.inserts || 0),
      updates,
      deletes: BigInt(row.deletes || 0),
      hotUpdates,
      deadRatioPercent: deadRatio,
      hotRatioPercent: hotRatio,
      totalSize: row.total_size,
      indexSize: row.index_size,
      lastAutovacuum: row.last_autovacuum ? new Date(row.last_autovacuum).toISOString() : null,
      status,
    });

    console.log(
      `  | ${row.table_name.padEnd(16)} | ${row.total_size.padStart(8)} | ${live.toString().padStart(9)} | ${dead.toString().padStart(9)} | ${deadRatio.toFixed(1).padStart(6)}% | ${hotRatio.toFixed(1).padStart(9)}% | ${status.padEnd(12)} |`
    );
  }
  console.log('  ' + '-'.repeat(76));

  // 2. Deep Dive: Order table HOT-Updates & fillfactor verification
  console.log('\n[2/3] 🎯 MVCC HOT-UPDATES DEEP DIVE (Table: "Order"):');
  const orderMetric = metrics.find((m) => m.tableName === 'Order');
  if (orderMetric) {
    console.log(`  • Live Tuples:        ${orderMetric.liveTuples}`);
    console.log(`  • Dead Tuples:        ${orderMetric.deadTuples} (${orderMetric.deadRatioPercent.toFixed(1)}%)`);
    console.log(`  • Total Updates:      ${orderMetric.updates}`);
    console.log(`  • HOT Updates:        ${orderMetric.hotUpdates} (${orderMetric.hotRatioPercent.toFixed(1)}%)`);

    // Verify fillfactor parameter
    const relOptions: any[] = await db.$queryRawUnsafe(`
      SELECT reloptions FROM pg_class WHERE relname = 'Order'
    `);
    const options = relOptions[0]?.reloptions || [];
    console.log(`  • PostgreSQL reloptions: [${options.join(', ')}]`);

    if (options.some((o: string) => o.includes('fillfactor=85'))) {
      console.log('  • Verification:       ✅ fillfactor=85 is active (15% page reserve for index-free HOT updates)');
    } else {
      console.log('  • Verification:       ⚠️ fillfactor=85 not found in reloptions.');
    }
  } else {
    console.log('  • Order table not found in top tables.');
  }

  // 3. Maintenance and Autovacuum recommendations
  console.log('\n[3/3] 🛠️ AUTONOMOUS MAINTENANCE & TUNING RECOMMENDATIONS:');
  const bloatList = metrics.filter((m) => m.status !== 'OPTIMAL');
  if (bloatList.length === 0) {
    console.log('  ✅ All tables are in OPTIMAL health. No manual VACUUM needed.');
  } else {
    for (const b of bloatList) {
      console.log(`  ⚠️ Table "${b.tableName}" has ${b.deadRatioPercent.toFixed(1)}% dead tuples (${b.deadTuples} dead rows).`);
      console.log(`     Recommended command: VACUUM (ANALYZE) "${b.tableName}";`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('🏁 BLOAT DIAGNOSTICS COMPLETE');
  console.log('='.repeat(80));
}

main().catch(console.error).finally(() => db.$disconnect());
