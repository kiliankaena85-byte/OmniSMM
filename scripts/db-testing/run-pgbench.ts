/**
 * (c) 2024-2026 SMMplan / OmniSMM 1.0. All rights reserved.
 * External Database Performance Harness: pgbench Runner inside Docker (RAC-2026 / ISO 25010)
 *
 * Runs custom synthetic & realistic workloads using PostgreSQL's native pgbench
 * directly inside the smmplan_lite_db container on 127.0.0.1:5433.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface PgBenchConfig {
  containerName: string;
  dbName: string;
  dbUser: string;
  clients: number;
  jobs: number;
  durationSeconds: number;
  mode: 'catalog' | 'wallet' | 'mixed' | 'builtin' | 'checkout';
}

function parseArgs(): PgBenchConfig {
  const args = process.argv.slice(2);
  const getArg = (name: string, defaultVal: string) => {
    const idx = args.indexOf(`--${name}`);
    if (idx !== -1 && args[idx + 1]) return args[idx + 1];
    return defaultVal;
  };

  return {
    containerName: getArg('container', 'smmplan_lite_db'),
    dbName: getArg('db', 'smmplan_lite'),
    dbUser: getArg('user', 'postgres'),
    clients: parseInt(getArg('clients', '10'), 10),
    jobs: parseInt(getArg('jobs', '2'), 10),
    durationSeconds: parseInt(getArg('duration', '5'), 10),
    mode: getArg('mode', 'checkout') as PgBenchConfig['mode'],
  };
}

function generateBenchmarkScript(mode: string): string {
  switch (mode) {
    case 'checkout':
      return [
        '\\set sid random(1, 20)',
        'SELECT "id", "name", "pricePer1000Cents", "minQty", "maxQty" FROM "Service" WHERE "numericId" >= :sid AND "isActive" = true LIMIT 1;',
        'SELECT "id", "balance" FROM "User" LIMIT 1;',
      ].join('\n');

    case 'catalog':
      return [
        '\\set cid random(1, 10)',
        'SELECT "id", "name", "pricePer1000Cents", "minQty", "maxQty" FROM "Service" WHERE "numericId" >= :cid AND "isActive" = true LIMIT 20;',
      ].join('\n');

    case 'wallet':
      return [
        'SELECT "id", "balance", "totalSpent" FROM "User" ORDER BY "id" LIMIT 5;',
      ].join('\n');

    case 'mixed':
    default:
      return [
        'SELECT "id", "name" FROM "Network" LIMIT 5;',
        'SELECT "id", "name", "pricePer1000Cents" FROM "Service" WHERE "isActive" = true LIMIT 10;',
        'SELECT "id", "balance" FROM "User" LIMIT 2;',
      ].join('\n');
  }
}

async function main() {
  const config = parseArgs();

  console.log('='.repeat(80));
  console.log('🏁 OMNISMM 1.0 — PGBENCH DATABASE PERFORMANCE & STRESS HARNESS (2026)');
  console.log('   Adheres to Standards: RAC-2026 / ISO 25010 / postgres-query-doctor');
  console.log('='.repeat(80));
  console.log(`  • Docker Container:   ${config.containerName}`);
  console.log(`  • Target Database:    ${config.dbName}`);
  console.log(`  • Workload Mode:      ${config.mode.toUpperCase()}`);
  console.log(`  • Concurrency:        ${config.clients} clients, ${config.jobs} threads`);
  console.log(`  • Test Duration:      ${config.durationSeconds} seconds`);
  console.log('-'.repeat(80));

  // Verify container is accessible
  try {
    execSync(`docker exec ${config.containerName} pg_isready -U ${config.dbUser}`, { stdio: 'pipe' });
  } catch (err) {
    console.error(`❌ Error: Container '${config.containerName}' is not running or PostgreSQL is not ready.`);
    process.exit(1);
  }

  const scriptContent = generateBenchmarkScript(config.mode);
  const containerScriptPath = `/tmp/pgbench_${config.mode}.sql`;

  // Write script inside container using base64 or echo
  const encodedScript = Buffer.from(scriptContent).toString('base64');
  execSync(
    `docker exec ${config.containerName} sh -c "echo '${encodedScript}' | base64 -d > ${containerScriptPath}"`
  );

  console.log(`\n🚀 Executing pgbench workload (${config.mode})...\n`);

  const pgbenchCmd = [
    'docker exec',
    config.containerName,
    'pgbench',
    `-U ${config.dbUser}`,
    '-n',
    `-c ${config.clients}`,
    `-j ${config.jobs}`,
    `-T ${config.durationSeconds}`,
    `-f ${containerScriptPath}`,
    '-r',
    config.dbName,
  ].join(' ');

  try {
    const rawOutput = execSync(pgbenchCmd, { encoding: 'utf-8' });
    console.log(rawOutput);

    // Extract metrics
    const tpsMatch = rawOutput.match(/tps = ([0-9.]+)/g);
    const latencyMatch = rawOutput.match(/latency average = ([0-9.]+) ms/);

    const tpsExcl = tpsMatch && tpsMatch.length > 0 ? tpsMatch[tpsMatch.length - 1].replace('tps = ', '') : 'N/A';
    const latencyAvg = latencyMatch ? latencyMatch[1] : 'N/A';

    console.log('='.repeat(80));
    console.log('📊 BENCHMARK SLA EVALUATION SUMMARY:');
    console.log(`  • Measured TPS:        ${tpsExcl} trans/sec`);
    console.log(`  • Average Latency:     ${latencyAvg} ms`);

    const avgLatNum = parseFloat(latencyAvg);
    if (!isNaN(avgLatNum)) {
      if (avgLatNum <= 15.0) {
        console.log(`  • SLA Compliance:      ✅ PASS (Well within sub-15ms RAC-2026 budget)`);
      } else if (avgLatNum <= 30.0) {
        console.log(`  • SLA Compliance:      ⚠️ ACCEPTABLE (Within 30ms ceiling)`);
      } else {
        console.log(`  • SLA Compliance:      ❌ EXCEEDED BUDGET (>30ms)`);
      }
    }
    console.log('='.repeat(80));

    // Cleanup script in container
    execSync(`docker exec ${config.containerName} rm -f ${containerScriptPath}`);
  } catch (err: any) {
    console.error('❌ pgbench execution failed:', err.message);
    process.exit(1);
  }
}

main().catch(console.error);
