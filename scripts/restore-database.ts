/**
 * @file restore-database.ts
 * 🔄 OmniSMM 1.0 — Automated Database Restoration Engine (2026).
 *
 * Restores the PostgreSQL database from a verified golden snapshot.
 * Supports both Docker containerized execution and native psql pipelines.
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_BACKUP_PATH = path.resolve(PROJECT_ROOT, 'prisma/backups/smmplan_golden_backup_latest.sql');

async function restoreDatabase() {
  const args = process.argv.slice(2);
  const targetBackup = args[0] ? path.resolve(process.cwd(), args[0]) : DEFAULT_BACKUP_PATH;

  console.log('🔄 [DB Restore] Starting OmniSMM Database Restore Protocol...\n');

  if (!fs.existsSync(targetBackup)) {
    console.error(`❌ [DB Restore] Backup file not found: ${targetBackup}`);
    process.exit(1);
  }

  const stat = fs.statSync(targetBackup);
  console.log(`📦 Backup file: ${path.relative(PROJECT_ROOT, targetBackup)} (${(stat.size / 1024).toFixed(1)} KB)`);

  // Check if docker container is active
  let isDockerActive = false;
  try {
    const psOut = execSync('docker ps --filter "name=smmplan_lite_db" --format "{{.Names}}"', { encoding: 'utf-8' });
    isDockerActive = psOut.includes('smmplan_lite_db');
  } catch (e) {
    isDockerActive = false;
  }

  if (!isDockerActive) {
    console.error('❌ [DB Restore] Container "smmplan_lite_db" is not running! Start it via: docker compose up -d db');
    process.exit(1);
  }

  console.log('🐳 Found active container: smmplan_lite_db. Piping dump via psql...\n');

  try {
    const fileStream = fs.createReadStream(targetBackup);
    const psqlProcess = spawn('docker', ['exec', '-i', 'smmplan_lite_db', 'psql', '-U', 'postgres', '-d', 'smmplan_lite'], {
      stdio: ['pipe', 'inherit', 'inherit'],
    });

    fileStream.pipe(psqlProcess.stdin);

    await new Promise<void>((resolve, reject) => {
      psqlProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`psql exited with code ${code}`));
        }
      });
      psqlProcess.on('error', reject);
    });

    console.log('\n✅ [DB Restore] SQL dump applied successfully!');

    // Verify table counts
    console.log('🔍 Verifying restored database tables...');
    const tableVerify = execSync(
      'docker exec smmplan_lite_db psql -U postgres -d smmplan_lite -c "SELECT count(*) FROM \\"Tenant\\";"',
      { encoding: 'utf-8' }
    );
    console.log(tableVerify.trim());

    console.log('🟢 [DB Restore COMPLETE] Database is fully restored to golden state.');
  } catch (err) {
    console.error('❌ [DB Restore FAILED]:', err);
    process.exit(1);
  }
}

if (require.main === module || process.argv[1]?.includes('restore-database.ts')) {
  restoreDatabase();
}
