import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function walk(dir: string): string[] {
  const files = fs.readdirSync(dir);
  const res: string[] = [];
  for (const f of files) {
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) res.push(...walk(full));
    else if (full.endsWith('.tsx') || full.endsWith('.ts')) res.push(full);
  }
  return res;
}

describe('H-01: Reverse Tabnabbing Security Audit', () => {
  it('guarantees that 100% of target="_blank" links include rel="noopener" or "noreferrer"', () => {
    const srcFiles = walk(path.resolve(process.cwd(), 'src'));
    const violations: { file: string; match: string }[] = [];

    const tagRegex = /<(?:a|Link)\b[^>]*\btarget=["']_blank["'][^>]*>/gi;

    for (const file of srcFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const matches = content.match(tagRegex);
      if (matches) {
        for (const m of matches) {
          if (!m.includes('rel=') || !m.includes('noopener')) {
            violations.push({
              file: path.relative(process.cwd(), file),
              match: m.replace(/\s+/g, ' ').substring(0, 80)
            });
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
