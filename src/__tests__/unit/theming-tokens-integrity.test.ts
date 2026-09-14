import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  parseThemeVariablesFromCss,
  calculateContrastRatio,
  isWcagAaCompliant,
} from '../../../scripts/ui/theme-harness';

describe('Подсистема темизации платформы (Theming & Tokens Integrity 2026)', () => {
  const globalsCssPath = path.resolve(process.cwd(), 'src/app/globals.css');
  const providersPath = path.resolve(process.cwd(), 'src/app/providers.tsx');

  it('globals.css и providers.tsx должны физически существовать', () => {
    expect(fs.existsSync(globalsCssPath)).toBe(true);
    expect(fs.existsSync(providersPath)).toBe(true);
  });

  it('все 12 канонических тем должны быть зарегистрированы в providers.tsx', () => {
    const providersContent = fs.readFileSync(providersPath, 'utf-8');
    const expectedThemes = [
      'light',
      'dark',
      'sky-light',
      'sky-dark',
      'emerald-light',
      'emerald-dark',
      'violet-light',
      'violet-dark',
      'warm-light',
      'warm-dark',
      'telegram-light',
      'telegram-dark',
    ];

    for (const theme of expectedThemes) {
      expect(providersContent).toContain(`'${theme}'`);
    }
  });

  it('все темы в globals.css обязаны содержать семантические токены поверхностей и контрастность WCAG 2.2 AA', () => {
    const cssContent = fs.readFileSync(globalsCssPath, 'utf-8');
    const themes = parseThemeVariablesFromCss(cssContent);

    const themeNamesToCheck = [
      'sky-light',
      'dark',
      'emerald-light',
      'emerald-dark',
      'violet-light',
      'violet-dark',
      'warm-light',
      'warm-dark',
      'telegram-light',
      'telegram-dark',
    ];

    const requiredTokens = [
      '--color-background',
      '--color-foreground',
      '--color-card',
      '--color-primary',
      '--color-border',
      '--color-content1',
      '--color-content2',
    ];

    for (const themeName of themeNamesToCheck) {
      const theme = themes[themeName];
      expect(theme, `Тема [${themeName}] обязана быть объявлена в globals.css`).toBeDefined();

      for (const token of requiredTokens) {
        expect(
          theme[token],
          `Тема [${themeName}] обязана содержать токен [${token}]`
        ).toBeDefined();
      }

      // Проверка контрастности text/background
      const bg = theme['--color-background'];
      const fg = theme['--color-foreground'];
      if (bg.startsWith('#') && fg.startsWith('#')) {
        const cr = calculateContrastRatio(fg, bg);
        expect(
          isWcagAaCompliant(cr, 'normal'),
          `Тема [${themeName}] должна соответствовать WCAG AA (>= 4.5:1), получено: ${cr.toFixed(2)}:1`
        ).toBe(true);
      }
    }
  });
});
