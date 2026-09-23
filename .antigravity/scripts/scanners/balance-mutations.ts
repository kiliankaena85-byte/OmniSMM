import fs from 'fs';
import path from 'path';

export interface MutationMatch {
  file: string;
  line: number;
  type: 'wallet_ops' | 'direct_mutation' | 'unknown';
  snippet: string;
}

export interface BalanceScanResult {
  matches: MutationMatch[];
  directMutationCount: number;
  walletOpsCount: number;
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

export function scanBalanceMutations(): BalanceScanResult {
  const srcDir = path.resolve(process.cwd(), 'src');
  const files = walkDir(srcDir);
  const matches: MutationMatch[] = [];

  for (const file of files) {
    const relPath = path.relative(process.cwd(), file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      const lower = line.toLowerCase();

      if (line.includes('WalletOps.')) {
        matches.push({
          file: relPath,
          line: lineNum,
          type: 'wallet_ops',
          snippet: line.trim()
        });
      } else if (
        (lower.includes('balance:') || lower.includes('referralbalance:') || lower.includes('totalspent:')) &&
        (lower.includes('increment:') || lower.includes('decrement:'))
      ) {
        matches.push({
          file: relPath,
          line: lineNum,
          type: 'direct_mutation',
          snippet: line.trim()
        });
      }
    });
  }

  const directMutationCount = matches.filter(m => m.type === 'direct_mutation').length;
  const walletOpsCount = matches.filter(m => m.type === 'wallet_ops').length;

  return {
    matches,
    directMutationCount,
    walletOpsCount,
    timestamp: new Date().toISOString()
  };
}

if (require.main === module) {
  const result = scanBalanceMutations();
  const outDir = path.resolve(process.cwd(), '.antigravity/evidence/scanners');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'balance-mutations.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
