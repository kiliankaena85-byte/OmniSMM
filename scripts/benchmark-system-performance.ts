import { db } from '../src/lib/db';
import { performance } from 'perf_hooks';

interface LatencyResult {
  operation: string;
  samples: number;
  minMs: number;
  maxMs: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  status: 'PASS' | 'WARN' | 'FAIL';
  targetP95: number;
}

function calculatePercentiles(latencies: number[], targetP95: number, name: string): LatencyResult {
  latencies.sort((a, b) => a - b);
  const n = latencies.length;
  const min = Number(latencies[0].toFixed(2));
  const max = Number(latencies[n - 1].toFixed(2));
  const avg = Number((latencies.reduce((a, b) => a + b, 0) / n).toFixed(2));
  const p50 = Number(latencies[Math.floor(n * 0.5)].toFixed(2));
  const p95 = Number(latencies[Math.floor(n * 0.95)].toFixed(2));
  const p99 = Number(latencies[Math.floor(n * 0.99)].toFixed(2));

  let status: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
  if (p95 > targetP95 * 2) {
    status = 'FAIL';
  } else if (p95 > targetP95) {
    status = 'WARN';
  }

  return {
    operation: name,
    samples: n,
    minMs: min,
    maxMs: max,
    avgMs: avg,
    p50Ms: p50,
    p95Ms: p95,
    p99Ms: p99,
    status,
    targetP95,
  };
}

async function runBenchmark() {
  console.log('='.repeat(80));
  console.log('🏁 OMNISMM 1.0 — SYSTEM, DATABASE & SITE PERFORMANCE BENCHMARK (2026)');
  console.log('   Adhering to Skills: postgres-query-doctor & nfr-performance-budget');
  console.log('='.repeat(80));

  // 1. Database Version & Connection Test
  console.log('\n[1/5] 🔌 DATABASE CONNECTION & METADATA AUDIT');
  const connStart = performance.now();
  const dbInfoRaw = await db.$queryRaw<any[]>`
    SELECT 
      version() as pg_version,
      current_database() as db_name,
      pg_size_pretty(pg_database_size(current_database())) as db_size,
      (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) as active_connections
  `;
  const connLatency = (performance.now() - connStart).toFixed(2);
  const dbInfo = dbInfoRaw[0];
  console.log(`  • PostgreSQL Version:     ${dbInfo.pg_version.split(' on ')[0]}`);
  console.log(`  • Database Name:          ${dbInfo.db_name}`);
  console.log(`  • Database Size:          ${dbInfo.db_size}`);
  console.log(`  • Active Connections:     ${dbInfo.active_connections} (Connection Limit Pool: 5)`);
  console.log(`  • Raw Ping Latency:       ${connLatency} ms`);

  // 2. Table Row Counts & Sizes
  console.log('\n[2/5] 📦 DATABASE ARCHITECTURE & TABLE STORAGE AUDIT');
  const tableStats = await db.$queryRaw<any[]>`
    SELECT 
      c.relname as table_name,
      c.reltuples::bigint as estimated_rows,
      pg_size_pretty(pg_total_relation_size(c.oid)) as total_size,
      pg_size_pretty(pg_relation_size(c.oid)) as table_size,
      pg_size_pretty(pg_indexes_size(c.oid)) as index_size
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY pg_total_relation_size(c.oid) DESC
    LIMIT 10;
  `;
  console.table(tableStats.map(t => ({
    'Имя таблицы': t.table_name,
    'Строк (live)': Number(t.estimated_rows),
    'Общий вес': t.total_size,
    'Вес данных': t.table_size,
    'Вес индексов': t.index_size,
  })));

  // 3. Cache Hit Ratio (Buffer Pool Efficiency)
  const cacheHitRaw = await db.$queryRaw<any[]>`
    SELECT 
      sum(heap_blks_read) as heap_read,
      sum(heap_blks_hit)  as heap_hit,
      round((sum(heap_blks_hit)::numeric / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0)) * 100, 2) as ratio_pct
    FROM pg_statio_user_tables;
  `;
  const cacheRatio = cacheHitRaw[0]?.ratio_pct ?? 'N/A';
  console.log(`  • PostgreSQL Buffer Cache Hit Ratio: ${cacheRatio}% (Target: > 99%)`);

  // 4. Query Latency Benchmarks (Warmup + Measurement Runs)
  console.log('\n[3/5] ⚡ PRISMA QUERY LATENCY BENCHMARKS (NFR Target: P95 <= 30ms)');
  const results: LatencyResult[] = [];
  const WARMUP_RUNS = 5;
  const TEST_RUNS = 25;

  // Scenario A: Catalog Listing with Relations (Heavy query)
  console.log('  → Benchmarking Scenario A: Catalog Public Listing with Category & Network...');
  for (let i = 0; i < WARMUP_RUNS; i++) {
    await db.service.findMany({
      where: { isActive: true },
      take: 20,
      select: {
        id: true,
        numericId: true,
        name: true,
        rate: true,
        minQty: true,
        maxQty: true,
        category: {
          select: {
            id: true,
            name: true,
            network: { select: { id: true, name: true, slug: true } }
          }
        }
      }
    });
  }
  const catalogTimes: number[] = [];
  for (let i = 0; i < TEST_RUNS; i++) {
    const t0 = performance.now();
    await db.service.findMany({
      where: { isActive: true },
      take: 20,
      select: {
        id: true,
        numericId: true,
        name: true,
        rate: true,
        minQty: true,
        maxQty: true,
        category: {
          select: {
            id: true,
            name: true,
            network: { select: { id: true, name: true, slug: true } }
          }
        }
      }
    });
    catalogTimes.push(performance.now() - t0);
  }
  results.push(calculatePercentiles(catalogTimes, 30, 'Catalog Public Listing (20 items + relations)'));

  // Scenario B: User Profile Lookup with Balance (Hot Path)
  console.log('  → Benchmarking Scenario B: User Session & Balance Lookup...');
  const sampleUser = await db.user.findFirst({ select: { id: true, tenantId: true } });
  const userId = sampleUser?.id || 'non_existent_usr';
  const tenantId = sampleUser?.tenantId || 'smmplan';

  for (let i = 0; i < WARMUP_RUNS; i++) {
    await db.user.findFirst({
      where: { id: userId, tenantId },
      select: { id: true, email: true, balance: true, role: true, tenantId: true }
    });
  }
  const userTimes: number[] = [];
  for (let i = 0; i < TEST_RUNS; i++) {
    const t0 = performance.now();
    await db.user.findFirst({
      where: { id: userId, tenantId },
      select: { id: true, email: true, balance: true, role: true, tenantId: true }
    });
    userTimes.push(performance.now() - t0);
  }
  results.push(calculatePercentiles(userTimes, 15, 'User Profile & Balance Lookup (Unique B-Tree)'));

  // Scenario C: Customer Orders Registry with Status Counts
  console.log('  → Benchmarking Scenario C: Customer Orders Paginated List...');
  const orderTimes: number[] = [];
  for (let i = 0; i < TEST_RUNS; i++) {
    const t0 = performance.now();
    await Promise.all([
      db.order.findMany({
        where: { tenantId },
        take: 15,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          numericId: true,
          status: true,
          charge: true,
          quantity: true,
          createdAt: true,
        }
      }),
      db.order.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: true,
      })
    ]);
    orderTimes.push(performance.now() - t0);
  }
  results.push(calculatePercentiles(orderTimes, 30, 'Orders Registry (List 15 + Status GroupBy)'));

  // Scenario D: Financial Double-Entry Ledger Lookup
  console.log('  → Benchmarking Scenario D: Ledger Entries History...');
  const ledgerTimes: number[] = [];
  for (let i = 0; i < TEST_RUNS; i++) {
    const t0 = performance.now();
    await db.ledgerEntry.findMany({
      where: { tenantId },
      take: 20,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        amount: true,
        reason: true,
        status: true,
        transactionType: true,
        createdAt: true,
      }
    });
    ledgerTimes.push(performance.now() - t0);
  }
  results.push(calculatePercentiles(ledgerTimes, 25, 'Ledger Transactions (Double-Entry History)'));

  // Scenario E: Admin Executive Dashboard Aggregations (KPI Metrics)
  console.log('  → Benchmarking Scenario E: Admin Executive Dashboard Multi-Aggregate...');
  const adminTimes: number[] = [];
  for (let i = 0; i < TEST_RUNS; i++) {
    const t0 = performance.now();
    await Promise.all([
      db.order.count({ where: { tenantId } }),
      db.user.count({ where: { tenantId } }),
      db.payment.aggregate({
        where: { tenantId, status: 'PAID' },
        _sum: { amount: true },
        _count: true,
      }),
      db.service.groupBy({
        by: ['isQuarantined', 'cooldownReason'],
        where: { tenantId },
        _count: true,
      })
    ]);
    adminTimes.push(performance.now() - t0);
  }
  results.push(calculatePercentiles(adminTimes, 40, 'Admin Dashboard Aggregations (4 Parallel Queries)'));

  console.table(results.map(r => ({
    'Операция': r.operation,
    'P50 (ms)': `${r.p50Ms} ms`,
    'P95 (ms)': `${r.p95Ms} ms`,
    'P99 (ms)': `${r.p99Ms} ms`,
    'Target P95': `${r.targetP95} ms`,
    'Статус NFR': r.status === 'PASS' ? '✅ PASS' : (r.status === 'WARN' ? '⚠️ WARN' : '❌ FAIL')
  })));

  // 5. Index Plan Verification (EXPLAIN ANALYZE)
  console.log('\n[4/5] 🔬 INDEX PLAN EXPLAIN VERIFICATION (Index Scan vs Seq Scan)');
  const explainOrder = await db.$queryRaw<any[]>`
    EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF)
    SELECT id, "numericId", status, charge
    FROM "Order"
    WHERE "tenantId" = 'smmplan'
    ORDER BY "createdAt" DESC, id DESC
    LIMIT 15;
  `;
  console.log('  • Order Query Plan:');
  for (const line of explainOrder.slice(0, 5)) {
    console.log(`    ${line['QUERY PLAN']}`);
  }

  // 6. Site HTTP Response Benchmark (Web Container on :3000)
  console.log('\n[5/5] 🌐 SITE HTTP ENDPOINT RESPONSE TIME (TTFB Benchmark)');
  const siteUrls = [
    { name: 'Storefront Landing (/)', url: 'http://127.0.0.1:3000/' },
    { name: 'Storefront Catalog (/services)', url: 'http://127.0.0.1:3000/services' },
    { name: 'Client Dashboard (/dashboard)', url: 'http://127.0.0.1:3000/dashboard' },
    { name: 'Admin Dashboard (/admin/dashboard)', url: 'http://127.0.0.1:3000/admin/dashboard' },
  ];

  const httpResults = [];
  for (const item of siteUrls) {
    try {
      // Warmup
      await fetch(item.url, { headers: { 'User-Agent': 'Benchmark/1.0' } }).catch(() => {});
      const times: number[] = [];
      let statusCode = 0;
      for (let i = 0; i < 5; i++) {
        const t0 = performance.now();
        const res = await fetch(item.url, { headers: { 'User-Agent': 'Benchmark/1.0' }, redirect: 'manual' });
        times.push(performance.now() - t0);
        statusCode = res.status;
      }
      times.sort((a, b) => a - b);
      const p50 = Number(times[Math.floor(times.length * 0.5)].toFixed(2));
      const p95 = Number(times[Math.floor(times.length * 0.95)].toFixed(2));
      httpResults.push({
        'Маршрут': item.name,
        'HTTP Code': statusCode,
        'P50 (ms)': `${p50} ms`,
        'P95 (ms)': `${p95} ms`,
        'Статус': p95 <= 500 ? '✅ Быстро' : (p95 <= 1500 ? '⚠️ Приемлемо' : '❌ Медленно')
      });
    } catch (e: any) {
      httpResults.push({
        'Маршрут': item.name,
        'HTTP Code': 'ERR',
        'P50 (ms)': 'N/A',
        'P95 (ms)': 'N/A',
        'Статус': `❌ ${e.message}`
      });
    }
  }
  console.table(httpResults);

  console.log('\n' + '='.repeat(80));
  console.log('✅ BENCHMARK COMPLETED SUCCESSFULLY');
  console.log('='.repeat(80));
}

runBenchmark()
  .catch(err => {
    console.error('Fatal benchmark error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
