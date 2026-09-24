import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Audit P0: Transaction Purity & Zero External Network in $transaction (DEF-002)', () => {
  it('AST / Source Invariant: sendOrderCompletedMail must NOT be called inside db.$transaction', () => {
    const filePath = path.resolve(process.cwd(), 'src/workers/processors/sync.processor.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Find all db.$transaction blocks
    const txRegex = /db\.\$transaction\s*\(\s*async\s*\(([^)]*)\)\s*=>\s*\{([\s\S]*?)\}\s*\)/g;
    let match: RegExpExecArray | null;
    const violations: string[] = [];

    while ((match = txRegex.exec(content)) !== null) {
      const txBody = match[2];
      if (txBody.includes('sendOrderCompletedMail')) {
        violations.push('sendOrderCompletedMail found inside db.$transaction block');
      }
      if (txBody.includes('fetch(') || txBody.includes('axios.') || txBody.includes('http')) {
        violations.push('External HTTP call found inside db.$transaction block');
      }
    }

    expect(violations, `Violations found in sync.processor.ts: ${violations.join(', ')}`).toEqual([]);
  });
});
