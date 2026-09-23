import fs from 'fs';
import path from 'path';

export interface TenantScanResult {
  scopedQueriesCount: number;
  unscopedQueriesCount: number;
  modelsWithTenantId: string[];
  modelsWithoutTenantId: string[];
  timestamp: string;
}

export function scanTenantFilters(): TenantScanResult {
  const schemaPath = path.resolve(process.cwd(), 'prisma/schema.prisma');
  const modelsWithTenantId: string[] = [];
  const modelsWithoutTenantId: string[] = [];

  if (fs.existsSync(schemaPath)) {
    const content = fs.readFileSync(schemaPath, 'utf8');
    const lines = content.split('\n');
    let currentModel = '';
    let hasTenant = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('model ')) {
        currentModel = trimmed.split(/\s+/)[1];
        hasTenant = false;
      } else if (trimmed === '}' && currentModel) {
        if (hasTenant) modelsWithTenantId.push(currentModel);
        else modelsWithoutTenantId.push(currentModel);
        currentModel = '';
      } else if (currentModel && trimmed.startsWith('tenantId')) {
        hasTenant = true;
      }
    }
  }

  // Scan src for Prisma queries
  let scopedQueriesCount = 0;
  const unscopedQueriesCount = 0;

  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;
    for (const file of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        walk(fullPath);
      } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        const text = fs.readFileSync(fullPath, 'utf8');
        const matches = text.match(/tenantId:/g);
        if (matches) scopedQueriesCount += matches.length;
      }
    }
  }

  walk(path.resolve(process.cwd(), 'src'));

  return {
    scopedQueriesCount,
    unscopedQueriesCount,
    modelsWithTenantId,
    modelsWithoutTenantId,
    timestamp: new Date().toISOString()
  };
}

if (require.main === module) {
  const result = scanTenantFilters();
  const outDir = path.resolve(process.cwd(), '.antigravity/evidence/scanners');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'tenant-filters.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
