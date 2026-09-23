import fs from 'fs';
import path from 'path';

interface MultiTenantViolation {
  file: string;
  line: number;
  pattern: string;
  code: string;
}

const violations: MultiTenantViolation[] = [];

// Whitelist files where brand definitions and config exist
const WHITELIST_FILES = [
  'seo-helpers.ts',
  'audit-multi-tenant-isolation.ts',
  'settings.ts',
  'tenant-config.ts',
  'tenants.ts',
  'tenant-resolver.ts',
  'audit-engine.ts',
  'integrations-settings.tsx',
  'globals.css',
  'sitemap.ts',
  'robots.ts',
  'schema.prisma',
  'middleware.ts',
  'nginx.conf',
];

function scanDir(dir: string) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (!['node_modules', '.next', '.git', 'dist', 'coverage', '__tests__', 'data'].includes(file)) {
        scanDir(fullPath);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      if (file.endsWith('.test.ts') || file.endsWith('.test.tsx') || file.endsWith('.spec.ts')) {
        continue;
      }
      const basename = path.basename(fullPath);
      if (WHITELIST_FILES.includes(basename)) {
        continue;
      }
      checkMultiTenantFile(fullPath);
    }
  }
}

function checkMultiTenantFile(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    if (line.trim().startsWith('//')) return;

    // Check for hardcoded hosts
    if ((line.includes("'smmplan.pro'") || line.includes('"smmplan.pro"') || line.includes("'smmflux.ru'") || line.includes('"smmflux.ru"')) && !line.includes('// audit-ignore')) {
      violations.push({
        file: filePath,
        line: index + 1,
        pattern: 'Hardcoded tenant host forbidden! Use getTenantHost(tenantId) or absoluteCanonical(tenantId, path)',
        code: line.trim(),
      });
    }

    // Check for references to lovable.pro (deprecated brand)
    if (line.toLowerCase().includes('lovable.pro') || line.toLowerCase().includes('lovable.dev')) {
      violations.push({
        file: filePath,
        line: index + 1,
        pattern: 'Deprecated Lovable brand reference detected! Replace with smmflux / flux',
        code: line.trim(),
      });
    }
  });
}

console.log('🌐 Scanning src/ for Multi-Tenant isolation & dynamic host compliance...\n');
scanDir(path.resolve(process.cwd(), 'src'));

if (violations.length === 0) {
  console.log('✅ [PASSED] 0 Multi-Tenant violations found! Complete host dynamic resolution and Lovable cleanup.');
  process.exit(0);
} else {
  console.error(`❌ [FAILED] Found ${violations.length} multi-tenant isolation violations:\n`);
  violations.forEach((v) => {
    console.error(`  - ${v.file}:${v.line}`);
    console.error(`    Violation: ${v.pattern}`);
    console.error(`    Snippet: ${v.code}\n`);
  });
  process.exit(1);
}
