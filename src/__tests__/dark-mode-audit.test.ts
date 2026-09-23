/**
 * @file dark-mode-audit.test.ts
 * @description Verifies design system dark mode invariants, CSS tokens, and theme hygiene.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Admin Design System: Dark Mode Invariants', () => {
  const cssPath = path.resolve(process.cwd(), 'src/app/globals.css');
  const providersPath = path.resolve(process.cwd(), 'src/app/providers.tsx');
  const dropdownPath = path.resolve(process.cwd(), 'src/components/admin/admin-profile-dropdown.tsx');

  const cssContent = fs.readFileSync(cssPath, 'utf-8');
  const providersContent = fs.readFileSync(providersPath, 'utf-8');
  const dropdownContent = fs.readFileSync(dropdownPath, 'utf-8');

  it('declares valid Tailwind 4 dark variant directive', () => {
    expect(cssContent).match(/@(custom-)?variant\s+dark/);
    expect(cssContent).contains('@import "tailwindcss";');
  });

  it('defines essential dark theme semantic tokens in .dark scope', () => {
    expect(cssContent).contains('--color-background: #0f172a;');
    expect(cssContent).contains('--color-foreground: #f8fafc;');
    expect(cssContent).contains('--color-card: #1e293b;');
    expect(cssContent).contains('--color-border: rgba(255, 255, 255, 0.08);');
    expect(cssContent).contains('--color-primary: #38bdf8;');
  });

  it('preserves light theme semantic tokens intact in @theme', () => {
    expect(cssContent).contains('--color-background: #f8fafc;');
    expect(cssContent).contains('--color-card: #ffffff;');
    expect(cssContent).contains('--color-border: #e2e8f0;');
    expect(cssContent).contains('--color-primary: #0369a1;');
  });

  it('ensures NextThemesProvider values are free of invalid whitespace multi-tokens', () => {
    const valueMatch = providersContent.match(/value=\{\{([\s\S]*?)\}\}/);
    expect(valueMatch).not.toBeNull();
    if (valueMatch) {
      const entries = valueMatch[1].split('\n');
      for (const entry of entries) {
        if (entry.includes(':')) {
          const valPart = entry.split(':')[1].trim().replace(/['",]/g, '');
          expect(valPart.includes(' ')).toBe(false);
        }
      }
    }
  });

  it('ensures admin profile dropdown uses mounted guard and resolvedTheme', () => {
    expect(dropdownContent).contains('resolvedTheme');
    expect(dropdownContent).contains('setMounted(true)');
    expect(dropdownContent).contains('toggleTheme');
    expect(dropdownContent).contains('setTheme(next)');
  });
});
