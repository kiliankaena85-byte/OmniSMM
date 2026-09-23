import { describe, it, expect } from 'vitest';
import {
  calculateRelativeLuminance,
  calculateContrastRatio,
  isWcagAaCompliant,
  parseThemeVariablesFromCss,
  scanCodeForRawColors,
  generateThemeFromSeed,
} from '../../../scripts/ui/theme-harness';

describe('UI Theme Architect & Theme Harness (2026)', () => {
  describe('Математика контрастности (WCAG 2.2 AA / W3C Formula)', () => {
    it('должен правильно вычислять относительную яркость чистого белого и черного', () => {
      const whiteLum = calculateRelativeLuminance('#ffffff');
      const blackLum = calculateRelativeLuminance('#000000');

      expect(whiteLum).toBeCloseTo(1.0, 2);
      expect(blackLum).toBeCloseTo(0.0, 2);
    });

    it('должен правильно вычислять коэффициент контрастности (Contrast Ratio)', () => {
      const blackAndWhiteCr = calculateContrastRatio('#ffffff', '#000000');
      const sameColorCr = calculateContrastRatio('#ffffff', '#ffffff');

      expect(blackAndWhiteCr).toBeCloseTo(21.0, 1);
      expect(sameColorCr).toBeCloseTo(1.0, 1);
    });

    it('должен строго валидировать соответствие порогу WCAG 2.2 AA (>= 4.5:1 для обычного текста, >= 3.0:1 для крупного)', () => {
      // #0369a1 (sky-700) на #ffffff имеет контраст ~ 5.6:1 -> WCAG AA compliant
      const skyWhiteCr = calculateContrastRatio('#0369a1', '#ffffff');
      expect(skyWhiteCr).toBeGreaterThanOrEqual(4.5);
      expect(isWcagAaCompliant(skyWhiteCr, 'normal')).toBe(true);

      // #38bdf8 (sky-400) на #ffffff имеет контраст ~ 1.9:1 -> НЕ проходит для обычного текста
      const lightSkyWhiteCr = calculateContrastRatio('#38bdf8', '#ffffff');
      expect(lightSkyWhiteCr).toBeLessThan(4.5);
      expect(isWcagAaCompliant(lightSkyWhiteCr, 'normal')).toBe(false);
    });
  });

  describe('Парсер тем и CSS-переменных из globals.css', () => {
    it('должен извлекать переменные темы из CSS-блока', () => {
      const mockCss = `
        :root, [data-theme="sky-light"] {
          --color-background: #f8fafc;
          --color-foreground: #0f172a;
          --color-card: #ffffff;
          --color-card-foreground: #0f172a;
        }
        .dark, [data-theme="sky-dark"] {
          --color-background: #0f172a;
          --color-foreground: #f8fafc;
          --color-card: #1e293b;
          --color-card-foreground: #f8fafc;
        }
      `;

      const themes = parseThemeVariablesFromCss(mockCss);
      expect(themes['sky-light'] || themes[':root']).toBeDefined();
      expect(themes['sky-dark'] || themes['.dark']).toBeDefined();

      const lightTheme = themes['sky-light'] || themes[':root'];
      expect(lightTheme['--color-background']).toBe('#f8fafc');
      expect(lightTheme['--color-foreground']).toBe('#0f172a');
    });
  });

  describe('Статический сканер кода на несанкционированный хардкод цветов', () => {
    it('должен обнаруживать text-white, bg-black и raw-hex в JSX коде', () => {
      const dirtyCode = `
        export function BadButton() {
          return (
            <button className="bg-black text-white p-2 border-[#ff0000]">
              Click me
            </button>
          );
        }
      `;

      const issues = scanCodeForRawColors(dirtyCode, 'BadButton.tsx');
      expect(issues.length).toBeGreaterThanOrEqual(3);

      const issueTypes = issues.map((i) => i.match);
      expect(issueTypes).toContain('bg-black');
      expect(issueTypes).toContain('text-white');
      expect(issueTypes).toContain('#ff0000');
    });

    it('не должен ругаться на легальные семантические токены', () => {
      const cleanCode = `
        export function GoodButton() {
          return (
            <button className="bg-card text-foreground p-2 border-border">
              Click me
            </button>
          );
        }
      `;

      const issues = scanCodeForRawColors(cleanCode, 'GoodButton.tsx');
      expect(issues.length).toBe(0);
    });
  });

  describe('Генератор тем из Seed Color (HCT / OKLCH Simulation)', () => {
    it('должен генерировать согласованные Light и Dark палитры с соблюдением контраста >= 4.5:1', () => {
      const seedColor = '#0284c7'; // Sky-600
      const generated = generateThemeFromSeed('sky-modern', seedColor);

      expect(generated.name).toBe('sky-modern');
      expect(generated.light['--color-background']).toBeDefined();
      expect(generated.light['--color-foreground']).toBeDefined();
      expect(generated.dark['--color-background']).toBeDefined();
      expect(generated.dark['--color-foreground']).toBeDefined();

      // Проверяем контраст сгенерированной светлой темы
      const lightCr = calculateContrastRatio(
        generated.light['--color-foreground'],
        generated.light['--color-background']
      );
      expect(lightCr).toBeGreaterThanOrEqual(4.5);

      // Проверяем контраст сгенерированной темной темы
      const darkCr = calculateContrastRatio(
        generated.dark['--color-foreground'],
        generated.dark['--color-background']
      );
      expect(darkCr).toBeGreaterThanOrEqual(4.5);

      // Проверяем наличие CSS-блока
      expect(generated.cssBlock).toContain('[data-theme="sky-modern-light"]');
      expect(generated.cssBlock).toContain('[data-theme="sky-modern-dark"]');
    });
  });
});
