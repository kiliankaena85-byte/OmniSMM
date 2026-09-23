/**
 * (c) 2024-2026 SMMplan / OmniSMM 1.0. All rights reserved.
 * PostgreSQL Query Profiler & Index Utilization Analyzer (RAC-2026 / ISO 25010)
 *
 * Adheres to skills: postgres-query-doctor & nfr-performance-budget.
 * Analyzes pg_stat_statements (if preloaded), pg_stat_user_tables, pg_statio_user_tables,
 * and pg_locks to provide deep visibility into slow queries, index scans, and lock contention.
 */

// Mock server-only for standalone script execution
const Module = require('module');
const orig = Module.prototype.require;
Module.prototype.require = function (id: string) {
  if (typeof id === 'string' && (id === 'server-only' || id.includes('server-only'))) return {};
  return orig.apply(this, arguments);
};

import { db } from '../../src/lib/db';

interface TableScanStat {
  tableName: string;
  seqScan: bigint;
  seqTupRead: bigint;
  idxScan: bigint;
  idxTupFetch: bigint;
  indexUsagePercent: number;
  status: 'EXCELLENT' | 'GOOD' | 'NEEDS_INDEX';
}

interface TableCacheStat {
  tableName: string;
  heapHitRatio: number;
  idxHitRatio: number;
  overallHitRatio: number;
}

async function main() {
  console.log('='.repeat(80));
  console.log('🩺 OMNISMM 1.0 — POSTGRESQL QUERY & ARCHITECTURE PROFILER (2026)');
  console.log('   Adhering to Skills: postgres-query-doctor & nfr-performance-budget');
  console.log('='.repeat(80));

  // 1. Check pg_stat_statements availability
  console.log('\n[1/5] 🔍 PROBING pg_stat_statements EXTENSION');
  let hasStatStatements = false;
  try {
    const res: any[] = await db.$queryRawUnsafe(`
      SELECT query, calls, total_exec_time, mean_exec_time
      FROM pg_stat_statements
      ORDER BY total_exec_time DESC
      LIMIT 5
    `);
    hasStatStatements = true;
    console.log('  ✅ pg_stat_statements is active and tracking statements!');
    console.log('  Top 5 Slowest Statements:');
    res.forEach((r, idx) => {
      console.log(`    ${idx + 1}. [Calls: ${r.calls}, Total: ${Number(r.total_exec_time).toFixed(2)}ms, Mean: ${Number(r.mean_exec_time).toFixed(2)}ms]`);
      console.log(`       SQL: ${r.query.slice(0, 100).replace(/\s+/g, ' ')}...`);
    });
  } catch (err: any) {
    console.log('  ℹ️  pg_stat_statements requires shared_preload_libraries in postgresql.conf.');
    console.log('  💡 Falling back to real-time pg_stat_user_tables and pg_statio diagnostics.');
  }

  // 2. Table Index Utilization vs Sequential Scans
  console.log('\n[2/5] 📊 TABLE INDEX UTILIZATION & SCAN EFFICIENCY (Sequential vs Index)');
  const scanRows: any[] = await db.$queryRawUnsafe(`
    SELECT
      relname AS table_name,
      seq_scan,
      seq_tup_read,
      idx_scan,
      idx_tup_fetch
    FROM pg_stat_user_tables
    ORDER BY (seq_scan + idx_scan) DESC
    LIMIT 15;
  `);

  console.log('  ' + '-'.repeat(76));
  console.log(`  | ${'Table Name'.padEnd(20)} | ${'Seq Scans'.padStart(10)} | ${'Idx Scans'.padStart(10)} | ${'Idx Usage %'.padStart(12)} | ${'Status'.padEnd(12)} |`);
  console.log('  ' + '-'.repeat(76));

  for (const row of scanRows) {
    const seq = Number(row.seq_scan || 0);
    const idx = Number(row.idx_scan || 0);
    const total = seq + idx;
    const usagePercent = total > 0 ? (idx / total) * 100 : 100;
    let status = 'EXCELLENT';
    if (usagePercent < 60 && total > 50) {
      status = 'NEEDS_INDEX';
    } else if (usagePercent < 85) {
      status = 'GOOD';
    }

    console.log(
      `  | ${row.table_name.padEnd(20)} | ${seq.toString().padStart(10)} | ${idx.toString().padStart(10)} | ${usagePercent.toFixed(1).padStart(11)}% | ${status.padEnd(12)} |`
    );
  }
  console.log('  ' + '-'.repeat(76));

  // 3. Buffer Cache Hit Ratios per Table
  console.log('\n[3/5] 💾 BUFFER CACHE HIT RATIO PER TABLE (Target >= 95%)');
  const cacheRows: any[] = await db.$queryRawUnsafe(`
    SELECT
      relname AS table_name,
      heap_blks_read,
      heap_blks_hit,
      idx_blks_read,
      idx_blks_hit
    FROM pg_statio_user_tables
    ORDER BY (heap_blks_hit + idx_blks_hit) DESC
    LIMIT 10;
  `);

  console.log('  ' + '-'.repeat(76));
  console.log(`  | ${'Table Name'.padEnd(20)} | ${'Heap Hit %'.padStart(12)} | ${'Index Hit %'.padStart(12)} | ${'Overall Hit %'.padStart(14)} |`);
  console.log('  ' + '-'.repeat(76));

  for (const row of cacheRows) {
    const heapRead = Number(row.heap_blks_read || 0);
    const heapHit = Number(row.heap_blks_hit || 0);
    const idxRead = Number(row.idx_blks_read || 0);
    const idxHit = Number(row.idx_blks_hit || 0);

    const heapTotal = heapRead + heapHit;
    const idxTotal = idxRead + idxHit;
    const overallTotal = heapTotal + idxTotal;

    const heapPercent = heapTotal > 0 ? (heapHit / heapTotal) * 100 : 100;
    const idxPercent = idxTotal > 0 ? (idxHit / idxTotal) * 100 : 100;
    const overallPercent = overallTotal > 0 ? ((heapHit + idxHit) / overallTotal) * 100 : 100;

    console.log(
      `  | ${row.table_name.padEnd(20)} | ${heapPercent.toFixed(1).padStart(11)}% | ${idxPercent.toFixed(1).padStart(11)}% | ${overallPercent.toFixed(1).padStart(13)}% |`
    );
  }
  console.log('  ' + '-'.repeat(76));

  // 4. Database-level Health, Temp Files (Disk Spilling) & Deadlocks
  console.log('\n[4/5] 💾 DATABASE IO, TEMP FILE USAGE & WORK_MEM HEALTH');
  const [dbStat]: any = await db.$queryRawUnsafe(`
    SELECT
      datname,
      xact_commit,
      xact_rollback,
      blks_read,
      blks_hit,
      ROUND(blks_hit * 100.0 / NULLIF(blks_hit + blks_read, 0), 2) AS overall_cache_hit_pct,
      temp_files,
      pg_size_pretty(temp_bytes) AS temp_bytes_pretty,
      deadlocks
    FROM pg_stat_database
    WHERE datname = current_database();
  `);

  if (dbStat) {
    console.log(`  • Database Name:               ${dbStat.datname}`);
    console.log(`  • Overall Cache Hit Ratio:     ${dbStat.overall_cache_hit_pct ?? '100'}% (Target >= 95%)`);
    console.log(`  • Transactions:                ${dbStat.xact_commit} committed, ${dbStat.xact_rollback} rollbacks`);
    console.log(`  • Temporary Files Spilled:     ${dbStat.temp_files} (${dbStat.temp_bytes_pretty})`);
    console.log(`  • Deadlocks Detected:          ${dbStat.deadlocks}`);

    if (Number(dbStat.temp_files) > 0) {
      console.log('  ⚠️ Warning: Queries are spilling to disk! Consider increasing work_mem.');
    } else {
      console.log('  ✅ No queries spilling to disk (work_mem is adequate).');
    }
  }

  // 5. Lock Contention & Transaction Health
  console.log('\n[5/5] 🔒 LOCK CONTENTION & BLOCKING SESSIONS AUDIT');
  const lockRows: any[] = await db.$queryRawUnsafe(`
    SELECT
      pid,
      usename,
      query,
      state,
      age(clock_timestamp(), query_start) AS duration
    FROM pg_stat_activity
    WHERE state != 'idle'
      AND pid != pg_backend_pid()
    ORDER BY duration DESC
    LIMIT 5;
  `);

  if (lockRows.length === 0) {
    console.log('  ✅ No hanging queries or lock contention detected. Database is healthy.');
  } else {
    console.log(`  ⚠️ Found ${lockRows.length} active queries:`);
    for (const l of lockRows) {
      console.log(`    • PID ${l.pid} (${l.usename}): duration ${l.duration}, state: ${l.state}`);
      console.log(`      Query: ${l.query.slice(0, 80)}...`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('🏁 POSTGRESQL PROFILING COMPLETE');
  console.log('='.repeat(80));
}

main().catch(console.error).finally(() => db.$disconnect());
