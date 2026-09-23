import fs from 'fs';
import path from 'path';

export interface OwnershipScanMatch {
  file: string;
  line: number;
  snippet: string;
  hasUserFilter: boolean;
}

export interface OwnershipScanResult {
  detailQueriesCount: number;
  scopedDetailQueriesCount: number;
  unscopedDetailQueriesCount: number;
  matches: OwnershipScanMatch[];
  timestamp: string;
}

function walkDir(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walkDir(filePath, fileList);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

export function scanOwnershipFilters(): OwnershipScanResult {
  const srcDir = path.resolve(process.cwd(), 'src');
  const files = walkDir(srcDir);
  const matches: OwnershipScanMatch[] = [];

  for (const file of files) {
    const relPath = path.relative(process.cwd(), file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      if (line.includes('findUnique') || line.includes('findFirst')) {
        const lineNum = idx + 1;
        const block = lines.slice(idx, idx + 10).join('\n');
        const hasUserFilter = block.includes('userId');

        matches.push({
          file: relPath,
          line: lineNum,
          snippet: line.trim(),
          hasUserFilter
        });
      }
    });
  }

  const scoped = matches.filter(m => m.hasUserFilter).length;
  const unscoped = matches.filter(m => !m.hasUserFilter).length;

  return {
    detailQueriesCount: matches.length,
    scopedDetailQueriesCount: scoped,
    unscopedDetailQueriesCount: unscoped,
    matches: matches.slice(0, 50),
    timestamp: new Date().toISOString()
  };
}

if (require.main === module) {
  const result = scanOwnershipFilters();
  const outDir = path.resolve(process.cwd(), '.antigravity/evidence/scanners');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'ownership-filters.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
