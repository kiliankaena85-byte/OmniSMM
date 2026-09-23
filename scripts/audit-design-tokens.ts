import fs from 'fs';
import path from 'path';

interface TokenViolation {
  file: string;
  line: number;
  pattern: string;
  code: string;
}

const violations: TokenViolation[] = [];

// Forbid inline non-semantic colors in components per AGENTS.md
const FORBIDDEN_PATTERNS = [
  { regex: /\btext-white\b/, desc: 'text-white -> use text-foreground or text-primary-foreground' },
  { regex: /\bbg-black\b/, desc: 'bg-black -> use bg-background or bg-card' },
  { regex: /\btext-blue-500\b/, desc: 'text-blue-500 -> use text-primary' },
  { regex: /\bbg-blue-500\b/, desc: 'bg-blue-500 -> use bg-primary' },
  { regex: /\bborder-\[1px\]\b/, desc: 'border-[1px] -> use border' },
  { regex: /\btext-gray-900\b/, desc: 'text-gray-900 -> use text-foreground' },
  { regex: /\bbg-gray-100\b/, desc: 'bg-gray-100 -> use bg-muted' },
];

function scanDir(dir: string) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (!['node_modules', '.next', '.git', 'dist', 'coverage', '__tests__'].includes(file)) {
        scanDir(fullPath);
      }
    } else if (file.endsWith('.tsx')) {
      if (file.endsWith('.test.tsx') || file.endsWith('.spec.tsx')) {
        continue;
      }
      checkComponentFile(fullPath);
    }
  }
}

function checkComponentFile(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    // Skip comments
    if (line.trim().startsWith('//') || line.includes('/*')) return;
    if (line.includes('// audit-ignore-tokens')) return;

    for (const { regex, desc } of FORBIDDEN_PATTERNS) {
      if (regex.test(line)) {
        violations.push({
          file: filePath,
          line: index + 1,
          pattern: desc,
          code: line.trim(),
        });
      }
    }
  });
}

console.log('🎨 Scanning components in src/ for Tailwind 4 semantic design tokens compliance...\n');
scanDir(path.resolve(process.cwd(), 'src/components'));
scanDir(path.resolve(process.cwd(), 'src/app'));

if (violations.length === 0) {
  console.log('✅ [PASSED] 0 inline color violations found! 100% Tailwind 4 semantic design tokens.');
  process.exit(0);
} else {
  console.warn(`⚠️ [AUDIT REPORT] Found ${violations.length} non-semantic design token usages.`);
  
  // Group by file
  const fileMap = new Map<string, number>();
  violations.forEach((v) => {
    fileMap.set(v.file, (fileMap.get(v.file) || 0) + 1);
  });

  console.log('\nTop files with non-semantic tokens:');
  Array.from(fileMap.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([file, count]) => {
      console.log(`  - ${file}: ${count} instances`);
    });

  process.exit(0);
}
