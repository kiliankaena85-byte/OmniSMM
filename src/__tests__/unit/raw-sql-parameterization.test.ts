import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('H-02: Raw SQL Parameterization Guard', () => {
  const targetFiles = [
    'scripts/fix-import.ts',
    'scripts/db-testing/db-chaos-runner.ts',
    'scripts/generate-evidence-report.ts',
    'scripts/real-db-pentest.ts',
    'prisma/seed-data/vexboost-services.ts',
  ];

  for (const relPath of targetFiles) {
    it(`should not have template literal interpolation in $executeRawUnsafe in ${relPath}`, () => {
      const fullPath = path.resolve(process.cwd(), relPath);
      if (!fs.existsSync(fullPath)) {
        return;
      }
      const content = fs.readFileSync(fullPath, 'utf8');

      // Check for patterns like $executeRawUnsafe(`...${...}...`)
      // Matches $executeRawUnsafe containing a template literal with interpolation
      const dangerousRawRegex = /\$executeRawUnsafe\s*\(\s*`[^`]*\$\{[^}]+\}[^`]*`/g;
      const matches = content.match(dangerousRawRegex);

      expect(matches, `Found unparameterized raw SQL template literals in ${relPath}: ${JSON.stringify(matches)}`).toBeNull();
    });
  }

  it('should verify vexboost-services uses parameterized placeholders ($1, $2, ...)', () => {
    const fullPath = path.resolve(process.cwd(), 'prisma/seed-data/vexboost-services.ts');
    const content = fs.readFileSync(fullPath, 'utf8');
    expect(content).toContain('$1, $2, $3, $4, $5, $6, $7, $8, $9');
  });

  it('should verify fix-import uses $1 for setval', () => {
    const fullPath = path.resolve(process.cwd(), 'scripts/fix-import.ts');
    const content = fs.readFileSync(fullPath, 'utf8');
    expect(content).toContain('SELECT setval(pg_get_serial_sequence(\'"Service"\', \'numericId\'), $1, false)');
  });
});
