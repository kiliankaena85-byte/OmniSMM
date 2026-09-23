import fs from 'fs';
import path from 'path';

export interface IdempotencyMatch {
  file: string;
  line: number;
  snippet: string;
  isUnstable: boolean;
  unstableReason?: string;
}

export interface IdempotencyScanResult {
  matches: IdempotencyMatch[];
  unstableCount: number;
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

export function scanIdempotencyKeys(): IdempotencyScanResult {
  const srcDir = path.resolve(process.cwd(), 'src');
  const files = walkDir(srcDir);
  const matches: IdempotencyMatch[] = [];

  for (const file of files) {
    const relPath = path.relative(process.cwd(), file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      if (line.includes('idempotencyKey') || line.includes('idempotency_key')) {
        const lineNum = idx + 1;
        let isUnstable = false;
        let unstableReason: string | undefined;

        if (line.includes('Date.now()')) {
          isUnstable = true;
          unstableReason = 'Uses Date.now() timestamp which generates distinct keys per retry';
        } else if (line.includes('Math.random()')) {
          isUnstable = true;
          unstableReason = 'Uses Math.random() which generates distinct non-repeatable keys';
        } else if (line.includes('randomUUID()') && !line.includes('order.id') && !line.includes('payment.id')) {
          isUnstable = true;
          unstableReason = 'Uses unpersisted randomUUID() in idempotency key constructor';
        }

        matches.push({
          file: relPath,
          line: lineNum,
          snippet: line.trim(),
          isUnstable,
          unstableReason
        });
      }
    });
  }

  const unstableCount = matches.filter(m => m.isUnstable).length;

  return {
    matches,
    unstableCount,
    timestamp: new Date().toISOString()
  };
}

if (require.main === module) {
  const result = scanIdempotencyKeys();
  const outDir = path.resolve(process.cwd(), '.antigravity/evidence/scanners');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'idempotency-keys.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
