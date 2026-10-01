import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';

const projectRoot = path.resolve(__dirname, '..');
const auditPath = path.resolve(projectRoot, '.planning', 'HYGIENE_DEAD_CODE_AUDIT.json');
const archiveDir = path.resolve(projectRoot, '.archive', 'orphans_2026');

if (!fs.existsSync(auditPath)) {
  console.error('Audit report not found at:', auditPath);
  process.exit(1);
}

const auditData = JSON.parse(fs.readFileSync(auditPath, 'utf-8'));
const trueOrphans: { file: string; linesCount: number }[] = (auditData.deadFiles || [])
  .filter((f: { isReferencedInTestsOnly?: boolean; file: string; linesCount: number }) => !f.isReferencedInTestsOnly);

console.log(`📦 Found ${trueOrphans.length} true orphan files to quarantine.`);

if (!fs.existsSync(archiveDir)) {
  fs.mkdirSync(archiveDir, { recursive: true });
}

interface QuarantineRecord {
  originalPath: string;
  archivePath: string;
  sha256: string;
  linesCount: number;
  quarantinedAt: string;
}

const manifest: QuarantineRecord[] = [];
let movedCount = 0;

for (const orphan of trueOrphans) {
  const fullSrcPath = path.resolve(projectRoot, orphan.file);
  if (!fs.existsSync(fullSrcPath)) {
    console.warn(`File not found (already moved?): ${orphan.file}`);
    continue;
  }

  const content = fs.readFileSync(fullSrcPath);
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  const targetPath = path.resolve(archiveDir, orphan.file);

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.renameSync(fullSrcPath, targetPath);

  manifest.push({
    originalPath: orphan.file,
    archivePath: path.relative(projectRoot, targetPath).replace(/\\/g, '/'),
    sha256: hash,
    linesCount: orphan.linesCount,
    quarantinedAt: new Date().toISOString(),
  });
  movedCount++;
}

const manifestPath = path.resolve(archiveDir, 'QUARANTINE_MANIFEST.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
console.log(`✅ Quarantined ${movedCount} files to: ${archiveDir}`);
console.log(`📄 Manifest written to: ${manifestPath}`);

// Verify compilation
console.log('🧪 Verifying project compilation with tsc --noEmit...');
try {
  execSync('npm run typecheck', { cwd: projectRoot, stdio: 'inherit' });
  console.log('🟢 [VERIFICATION PASS] Zero compile errors after quarantining orphan files!');
} catch (err) {
  console.error('🔴 [ROLLBACK TRIGGERED] Compilation failed after quarantine! Rolling back...');
  for (const item of manifest) {
    const from = path.resolve(projectRoot, item.archivePath);
    const to = path.resolve(projectRoot, item.originalPath);
    if (fs.existsSync(from)) {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.renameSync(from, to);
    }
  }
  console.log('↩️ All files successfully rolled back to original locations.');
  process.exit(1);
}
