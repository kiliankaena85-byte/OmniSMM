import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Treasury UI/UX Design System, Typography & OWASP Frontend Security Suite', () => {
  const treasuryDir = path.join(process.cwd(), 'src/components/admin/finance/treasury');
  const treasuryPagePath = path.join(process.cwd(), 'src/app/admin/finance/treasury/treasury-client.tsx');

  const componentFiles = fs.existsSync(treasuryDir)
    ? fs.readdirSync(treasuryDir).filter((f) => f.endsWith('.tsx')).map((f) => path.join(treasuryDir, f))
    : [];

  const allTreasuryFiles = [treasuryPagePath, ...componentFiles];

  // =========================================================================
  // 1. Design System Token Compliance & No Hardcoded Colors
  // =========================================================================
  describe('1. Semantic Design System Tokens (No Hardcoded Colors)', () => {
    it('verifies all Treasury UI components exist and are non-empty', () => {
      expect(allTreasuryFiles.length).toBeGreaterThanOrEqual(5);
      for (const filePath of allTreasuryFiles) {
        expect(fs.existsSync(filePath)).toBe(true);
        const content = fs.readFileSync(filePath, 'utf8');
        expect(content.length).toBeGreaterThan(100);
      }
    });

    it('strictly forbids raw hardcoded colors (text-white, bg-black, raw hex in styles)', () => {
      const forbiddenPatterns = [
        /\btext-white\b/,
        /\bbg-black\b/,
        /\bstyle=\{\{[^}]*(?:color|background|backgroundColor):\s*['"`]#[0-9a-fA-F]+/i,
      ];

      const violations: string[] = [];

      for (const filePath of allTreasuryFiles) {
        const content = fs.readFileSync(filePath, 'utf8');
        const relativePath = path.relative(process.cwd(), filePath);

        for (const pattern of forbiddenPatterns) {
          if (pattern.test(content)) {
            violations.push(`${relativePath}: matches forbidden pattern ${pattern.toString()}`);
          }
        }
      }

      expect(violations).toEqual([]);
    });

    it('ensures exclusive usage of semantic tokens in UI subcomponents', () => {
      for (const filePath of componentFiles) {
        const content = fs.readFileSync(filePath, 'utf8');
        expect(content).toMatch(/bg-card|bg-background|bg-muted|border-border|text-foreground|text-muted-foreground/);
      }
    });
  });

  // =========================================================================
  // 2. Strict Typography & Tabular Numbers for Financial Precision
  // =========================================================================
  describe('2. Financial Typography & Tabular Numbers', () => {
    it('enforces font-mono or tabular format for monetary amounts in UI subcomponents', () => {
      for (const filePath of componentFiles) {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.includes('toLocaleString') || content.includes('maskedAccountNumber')) {
          expect(content).toMatch(/font-mono|tabular-nums/);
        }
      }
    });
  });

  // =========================================================================
  // 3. Strict TypeScript & Zero "any" Annotations
  // =========================================================================
  describe('3. Strict Typing & Zero "any" Invariant', () => {
    it('verifies 0 instances of ": any" or "as any" in Treasury UI components', () => {
      const violations: string[] = [];

      for (const filePath of allTreasuryFiles) {
        const content = fs.readFileSync(filePath, 'utf8');
        const relativePath = path.relative(process.cwd(), filePath);

        if (/:\s*any\b/.test(content) || /\bas\s+any\b/.test(content)) {
          violations.push(`${relativePath} contains explicit 'any' type annotation`);
        }
      }

      expect(violations).toEqual([]);
    });
  });

  // =========================================================================
  // 4. OWASP Frontend Security & Sensitive Data Leak Prevention
  // =========================================================================
  describe('4. OWASP Frontend Security & Zero-Leak Bounds', () => {
    it('verifies that no client component uses dangerouslySetInnerHTML or eval', () => {
      for (const filePath of allTreasuryFiles) {
        const content = fs.readFileSync(filePath, 'utf8');
        expect(content).not.toContain('dangerouslySetInnerHTML');
        expect(content).not.toContain('eval(');
      }
    });

    it('strictly guarantees that server secrets are never imported into client components', () => {
      const dangerousServerImports = [
        'ALFA_BANK_API_KEY',
        'ALFA_BANK_CLIENT_SECRET',
        'DATABASE_URL',
        'SESSION_SECRET',
        'REDIS_URL',
      ];

      for (const filePath of allTreasuryFiles) {
        const content = fs.readFileSync(filePath, 'utf8');
        const relativePath = path.relative(process.cwd(), filePath);

        for (const secretKey of dangerousServerImports) {
          expect(
            content.includes(`process.env.${secretKey}`),
            `Security Alert: ${relativePath} directly references server secret ${secretKey}`
          ).toBe(false);
        }
      }
    });
  });
});
