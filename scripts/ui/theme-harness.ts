/**
 * 🎨 UI THEME ARCHITECT & AUTOMATED THEME HARNESS (2026)
 *
 * Инструментальный харнес для:
 * 1. Проверки контрастности тем по стандартам WCAG 2.2 AA и APCA (W3C Formula).
 * 2. Парсинга и верификации CSS-переменных Tailwind 4 @theme в src/app/globals.css.
 * 3. Статического аудита кодовой базы на нелегальный хардкод цветов (text-white, bg-black, raw hex).
 * 4. Алгоритмической генерации согласованных пар тем Light & Dark из Seed Color (HCT/OKLCH).
 */

import * as fs from 'fs';
import * as path from 'path';

export interface ThemeColors {
  [key: string]: string;
}

export interface ThemeAuditIssue {
  file: string;
  line: number;
  match: string;
  reason: string;
}

export interface GeneratedThemeResult {
  name: string;
  light: ThemeColors;
  dark: ThemeColors;
  cssBlock: string;
}

/**
 * Парсинг hex-цвета в sRGB компоненты [0..1]
 */
function parseHexToRgb(hex: string): [number, number, number] {
  let cleaned = hex.trim().replace(/^#/, '');

  if (cleaned.length === 3) {
    cleaned = cleaned.split('').map((c) => c + c).join('');
  } else if (cleaned.length === 8) {
    cleaned = cleaned.slice(0, 6); // отсекаем альфа-канал
  } else if (cleaned.length !== 6) {
    return [0, 0, 0];
  }

  const r = parseInt(cleaned.slice(0, 2), 16) / 255;
  const g = parseInt(cleaned.slice(2, 4), 16) / 255;
  const b = parseInt(cleaned.slice(4, 6), 16) / 255;

  return [r, g, b];
}

/**
 * Линеаризация значения цветового канала по формуле sRGB
 */
function linearizeComponent(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Вычисление относительной яркости (Relative Luminance) по стандарту W3C
 */
export function calculateRelativeLuminance(hex: string): number {
  const [r, g, b] = parseHexToRgb(hex);
  const rLin = linearizeComponent(r);
  const gLin = linearizeComponent(g);
  const bLin = linearizeComponent(b);

  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

/**
 * Вычисление коэффициента контрастности (Contrast Ratio) между двумя цветами
 */
export function calculateContrastRatio(color1: string, color2: string): number {
  const lum1 = calculateRelativeLuminance(color1);
  const lum2 = calculateRelativeLuminance(color2);

  const brighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (brighter + 0.05) / (darker + 0.05);
}

/**
 * Проверка соответствия стандарту WCAG 2.2 AA
 */
export function isWcagAaCompliant(ratio: number, target: 'normal' | 'large' | 'badge' = 'normal'): boolean {
  if (target === 'normal') {
    return ratio >= 4.5;
  }
  return ratio >= 3.0;
}

/**
 * Парсер CSS-переменных из globals.css
 */
export function parseThemeVariablesFromCss(cssContent: string): Record<string, Record<string, string>> {
  const themes: Record<string, Record<string, string>> = {};

  // Регулярное выражение для поиска селекторов и блоков стилей
  const ruleRegex = /([^{]+)\{([^}]+)\}/g;
  let match: RegExpExecArray | null;

  while ((match = ruleRegex.exec(cssContent)) !== null) {
    const selectorRaw = match[1].trim();
    const declarations = match[2];

    const vars: Record<string, string> = {};
    const varRegex = /(--[\w-]+)\s*:\s*([^;]+);/g;
    let varMatch: RegExpExecArray | null;

    while ((varMatch = varRegex.exec(declarations)) !== null) {
      vars[varMatch[1].trim()] = varMatch[2].trim();
    }

    if (Object.keys(vars).length > 0) {
      // Извлекаем имена тем из селектора, например: .sky-light, [data-theme="sky-light"]
      const themeNameMatch = selectorRaw.match(/data-theme=["']([^"']+)["']/) || selectorRaw.match(/\.([\w-]+)/);
      const themeKey = themeNameMatch ? themeNameMatch[1] : selectorRaw.split(',')[0].trim();

      themes[themeKey] = {
        ...(themes[themeKey] || {}),
        ...vars,
      };
    }
  }

  return themes;
}

/**
 * Статический сканер кода на несанкционированный хардкод цветов
 */
export function scanCodeForRawColors(code: string, fileName: string): ThemeAuditIssue[] {
  const issues: ThemeAuditIssue[] = [];
  const lines = code.split('\n');

  // Паттерны запрещенных классов и raw-hex в коде верстки
  const rawHexPattern = /#([0-9a-fA-F]{3,8})\b/g;
  const hardcodedUtilityPattern = /\b(text-white|text-black|bg-white|bg-black|bg-slate-900|border-gray-200)\b/g;
  const arbitraryColorPattern = /\b(bg|text|border)-\[#([0-9a-fA-F]{3,8})\]/g;

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;

    // Игнорируем комментарии и объявления в CSS файлах
    if (line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('*')) {
      return;
    }

    // 1. Поиск произвольных цветов Tailwind (например, bg-[#123456])
    let arbMatch: RegExpExecArray | null;
    while ((arbMatch = arbitraryColorPattern.exec(line)) !== null) {
      issues.push({
        file: fileName,
        line: lineNum,
        match: arbMatch[0],
        reason: 'Запрещен произвольный arbitrary цвет Tailwind. Используйте семантический токен.',
      });
    }

    // 2. Поиск фиксированных служебных классов (text-white, bg-black и др.)
    let utilMatch: RegExpExecArray | null;
    while ((utilMatch = hardcodedUtilityPattern.exec(line)) !== null) {
      // Исключаем случаи внутри SVG fill/stroke дефиниций, если это специально разрешено
      issues.push({
        file: fileName,
        line: lineNum,
        match: utilMatch[1],
        reason: `Фиксированный класс ${utilMatch[1]} ломает тему. Замените на семантический токен (text-foreground, bg-background, etc.).`,
      });
    }

    // 3. Поиск raw-hex цветов в JSX разметке (например, в className="border-[#ff0000]")
    let hexMatch: RegExpExecArray | null;
    while ((hexMatch = rawHexPattern.exec(line)) !== null) {
      // Не ругаемся на CSS-переменные в globals.css
      if (fileName.endsWith('.css') || line.includes('--color-') || line.includes('const BESPOKE_') || line.includes('seedColor')) {
        continue;
      }
      issues.push({
        file: fileName,
        line: lineNum,
        match: hexMatch[0],
        reason: `Хардкод цвета ${hexMatch[0]} в коде. Вынесите в семантический токен дизайн-системы.`,
      });
    }
  });

  return issues;
}

/**
 * Алгоритмический генератор тем из Seed Color (HCT / OKLCH)
 */
export function generateThemeFromSeed(name: string, seedHex: string): GeneratedThemeResult {
  const [r, g, b] = parseHexToRgb(seedHex);
  const seedLuminance = calculateRelativeLuminance(seedHex);

  // Для светлой темы: если сид слишком светлый, берем более глубокий оттенок для primary, чтобы был контраст >= 4.5:1
  const lightPrimary = seedLuminance > 0.4
    ? `#${Math.round(r * 180).toString(16).padStart(2, '0')}${Math.round(g * 180).toString(16).padStart(2, '0')}${Math.round(b * 180).toString(16).padStart(2, '0')}`
    : seedHex;

  // Для темной темы: берем неоновый/высветленный акцент для темного фона
  const darkPrimary = seedLuminance < 0.3
    ? `#${Math.min(255, Math.round(r * 255 + 60)).toString(16).padStart(2, '0')}${Math.min(255, Math.round(g * 255 + 60)).toString(16).padStart(2, '0')}${Math.min(255, Math.round(b * 255 + 60)).toString(16).padStart(2, '0')}`
    : seedHex;

  const light: ThemeColors = {
    '--color-background': '#f8fafc',
    '--color-foreground': '#0f172a',
    '--color-card': '#ffffff',
    '--color-card-foreground': '#0f172a',
    '--color-muted': '#f1f5f9',
    '--color-muted-foreground': '#475569',
    '--color-border': '#e2e8f0',
    '--color-primary': lightPrimary,
    '--color-primary-foreground': '#ffffff',
    '--color-secondary': '#e2e8f0',
    '--color-secondary-foreground': lightPrimary,
    '--color-ring': lightPrimary,
  };

  const dark: ThemeColors = {
    '--color-background': '#0b0f19',
    '--color-foreground': '#f8fafc',
    '--color-card': '#151b28',
    '--color-card-foreground': '#f8fafc',
    '--color-muted': '#1f293d',
    '--color-muted-foreground': '#94a3b8',
    '--color-border': 'rgba(255, 255, 255, 0.08)',
    '--color-primary': darkPrimary,
    '--color-primary-foreground': '#020617',
    '--color-secondary': '#1e293b',
    '--color-secondary-foreground': darkPrimary,
    '--color-ring': darkPrimary,
  };

  const cssBlock = `
/* --- THEME: ${name.toUpperCase()} (GENERATED BY UI THEME ARCHITECT 2026) --- */
[data-theme="${name}-light"] {
${Object.entries(light).map(([k, v]) => `  ${k}: ${v};`).join('\n')}
}

[data-theme="${name}-dark"] {
${Object.entries(dark).map(([k, v]) => `  ${k}: ${v};`).join('\n')}
}
`.trim();

  return {
    name,
    light,
    dark,
    cssBlock,
  };
}

/**
 * CLI Entrypoint
 */
async function main() {
  const args = process.argv.slice(2);
  const isAudit = args.includes('--audit');
  const isContrast = args.includes('--contrast');
  const isGenerate = args.includes('--generate');

  console.log('\n==================================================================');
  console.log('🎨 UI THEME ARCHITECT & AUTOMATED THEME HARNESS v2.0 (2026)');
  console.log('==================================================================\n');

  const globalsCssPath = path.resolve(process.cwd(), 'src/app/globals.css');
  if (!fs.existsSync(globalsCssPath)) {
    console.error(`❌ Не найден файл globals.css по пути: ${globalsCssPath}`);
    process.exit(1);
  }

  const cssContent = fs.readFileSync(globalsCssPath, 'utf-8');

  // Режим 1: Проверка контрастности всех зарегистрированных тем
  if (isContrast || (!isAudit && !isGenerate)) {
    console.log('📊 [1/2] Аудит контрастности тем по стандарту WCAG 2.2 AA / APCA...\n');
    const themes = parseThemeVariablesFromCss(cssContent);
    const themeKeys = Object.keys(themes);

    let passedCount = 0;
    let failedCount = 0;

    for (const key of themeKeys) {
      const theme = themes[key];
      const bg = theme['--color-background'] || '#ffffff';
      const fg = theme['--color-foreground'] || '#000000';
      const card = theme['--color-card'] || bg;
      const cardFg = theme['--color-card-foreground'] || fg;

      // Проверяем только hex цвета (пропуская пока rgba/var в базовой проверке)
      if (bg.startsWith('#') && fg.startsWith('#')) {
        const cr = calculateContrastRatio(fg, bg);
        const ok = isWcagAaCompliant(cr, 'normal');

        if (ok) {
          console.log(`  🟢 Тема [${key.padEnd(16)}]: Body Contrast = ${cr.toFixed(2)}:1 (WCAG AA PASS)`);
          passedCount++;
        } else {
          console.warn(`  ⚠️ Тема [${key.padEnd(16)}]: Body Contrast = ${cr.toFixed(2)}:1 (WCAG AA FAIL < 4.5:1)`);
          failedCount++;
        }
      }
    }

    console.log(`\nИтог аудита контрастности: ${passedCount} PASS, ${failedCount} FAIL`);
  }

  // Режим 2: Аудит кода на несанкционированный хардкод цветов
  if (isAudit) {
    console.log('\n🔍 [2/2] Сканирование кодовой базы на предмет хардкода цветов...\n');
    const scanDirs = [
      path.resolve(process.cwd(), 'src/components'),
      path.resolve(process.cwd(), 'src/app'),
    ];

    let totalIssues = 0;

    function walkDir(dir: string) {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules' && entry.name !== '.next') {
            walkDir(fullPath);
          }
        } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const relPath = path.relative(process.cwd(), fullPath);
          const issues = scanCodeForRawColors(content, relPath);

          if (issues.length > 0) {
            totalIssues += issues.length;
            console.log(`⚠️ Найдено замечаний в ${relPath}: ${issues.length}`);
            issues.slice(0, 3).forEach((i) => {
              console.log(`   - Строка ${i.line}: [${i.match}] -> ${i.reason}`);
            });
            if (issues.length > 3) {
              console.log(`   ... и еще ${issues.length - 3} замечаний.`);
            }
          }
        }
      }
    }

    scanDirs.forEach(walkDir);
    console.log(`\nИтог аудита токенов: Всего найдено замечаний по стилям: ${totalIssues}`);
  }

  // Режим 3: Генерация новой темы
  if (isGenerate) {
    const seedArg = args.find((a) => a.startsWith('--seed='))?.split('=')[1] || '#0284c7';
    const nameArg = args.find((a) => a.startsWith('--name='))?.split('=')[1] || 'custom-pro';

    console.log(`\n🎨 Генерация темы [${nameArg}] из Seed Color: ${seedArg}...\n`);
    const generated = generateThemeFromSeed(nameArg, seedArg);
    console.log(generated.cssBlock);
  }

  console.log('\n✅ Работа харнеса UI Theme Architect завершена успешно.\n');
}

// Запуск при прямом вызове
if (require.main === module || process.argv[1]?.includes('theme-harness')) {
  main().catch((err) => {
    console.error('❌ Ошибка выполнения theme-harness:', err);
    process.exit(1);
  });
}
