import fs from 'fs';
import path from 'path';

interface Violation {
  file: string;
  line: number;
  pattern: string;
  code: string;
}

const violations: Violation[] = [];

function scanDir(dir: string) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (!['node_modules', '.next', '.git', 'dist', 'coverage'].includes(file)) {
        scanDir(fullPath);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      if (file.endsWith('.test.ts') || file.endsWith('.test.tsx') || file.endsWith('.spec.ts') || file.endsWith('.d.ts')) {
        continue;
      }
      checkFile(fullPath);
    }
  }
}

function checkFile(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    // 1. Check for forwardRef (React 19 uses direct ref prop)
    if (/\bforwardRef\b/.test(line) && !line.includes('// audit-ignore')) {
      violations.push({
        file: filePath,
        line: index + 1,
        pattern: 'forwardRef (React 19 uses direct ref prop)',
        code: line.trim(),
      });
    }

    // 2. Check for useFormState (React 19 replaces with useActionState)
    if (/\buseFormState\b/.test(line) && !line.includes('// audit-ignore')) {
      violations.push({
        file: filePath,
        line: index + 1,
        pattern: 'useFormState (Deprecated in React 19, use useActionState)',
        code: line.trim(),
      });
    }

    // 3. Check for defaultProps
    if (/\.defaultProps\s*=/.test(line)) {
      violations.push({
        file: filePath,
        line: index + 1,
        pattern: 'defaultProps (Deprecated in React 19, use ES6 default parameters)',
        code: line.trim(),
      });
    }

    // 4. Check for 'use server' in page.tsx
    if (filePath.endsWith('page.tsx') && (line.includes("'use server'") || line.includes('"use server"'))) {
      violations.push({
        file: filePath,
        line: index + 1,
        pattern: '"use server" in page.tsx is forbidden (crashes Next.js App Router)',
        code: line.trim(),
      });
    }
  });
}

console.log('🔍 Scanning src/ for React 19 & Next.js 16 modernization compliance...\n');
scanDir(path.resolve(process.cwd(), 'src'));

if (violations.length === 0) {
  console.log('✅ [PASSED] 0 React 19 / Next.js 16 pattern violations found! All components are 100% modern.');
  process.exit(0);
} else {
  console.error(`❌ [FAILED] Found ${violations.length} violations:\n`);
  violations.forEach((v) => {
    console.error(`  - ${v.file}:${v.line}`);
    console.error(`    Pattern: ${v.pattern}`);
    console.error(`    Snippet: ${v.code}\n`);
  });
  process.exit(1);
}
