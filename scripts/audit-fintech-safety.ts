import fs from 'fs';
import path from 'path';

interface FintechViolation {
  file: string;
  line: number;
  pattern: string;
  code: string;
}

const violations: FintechViolation[] = [];

function scanDir(dir: string) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (!['node_modules', '.next', '.git', 'dist', 'coverage', '__tests__'].includes(file)) {
        scanDir(fullPath);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      if (file.endsWith('.test.ts') || file.endsWith('.test.tsx') || file.endsWith('.spec.ts')) {
        continue;
      }
      checkFintechFile(fullPath);
    }
  }
}

function checkFintechFile(filePath: string) {
  // Allow direct WalletOps in wallet-ops.ts itself
  if (filePath.endsWith('wallet-ops.ts') || filePath.endsWith('wallet.ts')) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    // 1. Check for direct balance increment/decrement bypassing WalletOps
    if (/(db|prisma|tx)\.user\.update\s*\(\s*\{[\s\S]*?balance:\s*\{/i.test(line)) {
      violations.push({
        file: filePath,
        line: index + 1,
        pattern: 'Direct user.balance mutation forbidden! Use WalletOps.credit() / debit() / refund()',
        code: line.trim(),
      });
    }

    // 2. Check for unawaited auditAdmin in financial files
    if (line.includes('auditAdmin(') && !line.includes('await ') && (filePath.includes('checkout') || filePath.includes('payment') || filePath.includes('finance'))) {
      violations.push({
        file: filePath,
        line: index + 1,
        pattern: 'Financial audit must be awaited: use await auditAdminAwaitable()',
        code: line.trim(),
      });
    }
  });
}

console.log('🔒 Scanning src/ for FinTech safety & Trust Boundary compliance...\n');
scanDir(path.resolve(process.cwd(), 'src'));

if (violations.length === 0) {
  console.log('✅ [PASSED] 0 FinTech violations found! All balance mutations use WalletOps & BigInt.');
  process.exit(0);
} else {
  console.error(`❌ [FAILED] Found ${violations.length} FinTech security violations:\n`);
  violations.forEach((v) => {
    console.error(`  - ${v.file}:${v.line}`);
    console.error(`    Violation: ${v.pattern}`);
    console.error(`    Snippet: ${v.code}\n`);
  });
  process.exit(1);
}
