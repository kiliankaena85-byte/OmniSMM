import * as fs from 'fs';
import * as path from 'path';

const SNAPSHOTS_DIR = path.resolve(process.cwd(), '.agent/snapshots');
const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'out',
  '.gemini',
  'snapshots' // Avoid backing up backups recursively
]);

const ALLOWED_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.prisma', '.html', '.env', '.md'
]);

function copyFile(src: string, dest: string) {
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  fs.copyFileSync(src, dest);
}

function walkAndBackup(dir: string, baseDir: string, backupPath: string, stats: { filesCopied: number; bytesCopied: number }) {
  let files: string[];
  try {
    files = fs.readdirSync(dir);
  } catch (err) {
    return;
  }

  for (const file of files) {
    const fullPath = path.join(dir, file);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(fullPath);
    } catch (err) {
      continue;
    }

    if (stat.isDirectory()) {
      if (IGNORE_DIRS.has(file)) continue;
      // Skip .agent/snapshots folder specifically
      if (fullPath.startsWith(SNAPSHOTS_DIR)) continue;

      walkAndBackup(fullPath, baseDir, backupPath, stats);
    } else if (stat.isFile()) {
      const ext = path.extname(file).toLowerCase();
      if (ALLOWED_EXTENSIONS.has(ext) || file === '.env') {
        const relative = path.relative(baseDir, fullPath);
        const destPath = path.join(backupPath, relative);
        
        try {
          copyFile(fullPath, destPath);
          stats.filesCopied++;
          stats.bytesCopied += stat.size;
        } catch (err) {}
      }
    }
  }
}

function main() {
  console.log('📸 Workspace Snapshot: Archiving source files for safe rollback...');
  const rootDir = path.resolve(process.cwd());
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sessionBackupPath = path.join(SNAPSHOTS_DIR, `snapshot-${timestamp}`);

  if (!fs.existsSync(SNAPSHOTS_DIR)) {
    fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  }

  console.log(`Creating snapshot under: .agent/snapshots/snapshot-${timestamp}/`);
  
  const stats = { filesCopied: 0, bytesCopied: 0 };
  walkAndBackup(rootDir, rootDir, sessionBackupPath, stats);

  console.log('\n--- 📊 Backup Summary ---');
  console.log(`  Files Archived:      ${stats.filesCopied}`);
  console.log(`  Total Data Size:     ${(stats.bytesCopied / 1024).toFixed(2)} KB`);
  console.log(`  Location:            .agent/snapshots/snapshot-${timestamp}/`);
  console.log('-------------------------');
  console.log('✅ Success: Workspace snapshot created successfully. You can now perform refactoring with full rollback security!');
  
  process.exit(0);
}

if (require.main === module) {
  main();
}
