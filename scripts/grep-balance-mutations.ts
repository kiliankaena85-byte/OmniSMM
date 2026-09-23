import fs from 'fs';
import path from 'path';

function searchPattern(rootDir: string, targetPattern: string): string[] {
  const matches: string[] = [];
  function walk(dir: string) {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const fullPath = path.join(dir, f);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes(targetPattern)) {
          matches.push(fullPath.replace(/\\/g, '/'));
        }
      }
    }
  }
  walk(rootDir);
  return matches;
}

console.log('=== DIRECT BALANCE MUTATION GREP FOOTPRINT ===');
console.log('[1] balance: { decrement ->', searchPattern('./src', 'balance: { decrement'));
console.log('[2] balance: { increment ->', searchPattern('./src', 'balance: { increment'));
console.log('[3] totalSpent: { increment ->', searchPattern('./src', 'totalSpent: { increment'));
console.log('[4] totalSpent: { decrement ->', searchPattern('./src', 'totalSpent: { decrement'));
console.log('[5] WalletOps.charge ->', searchPattern('./src', 'WalletOps.charge'));
console.log('[6] WalletOps.credit ->', searchPattern('./src', 'WalletOps.credit'));
console.log('[7] WalletOps.refund ->', searchPattern('./src', 'WalletOps.refund'));
