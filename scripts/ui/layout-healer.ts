/**
 * (c) 2026 SMMplan & OmniSMM 1.0.
 * Layout Overflow Auto-Healer — Automated Responsive Layout Codemod Engine.
 *
 * Automatically detects and heals layout anti-patterns:
 * 1. Squashed elements: injects "shrink-0" into SVG/Lucide icons inside flex.
 * 2. Horizontal scroll: replaces "w-screen" with "w-full max-w-full".
 * 3. Truncation overflow: adds "min-w-0" to elements with "truncate" in flex.
 * 4. iOS Auto-Zoom: upgrades mobile input "text-xs" to "text-base sm:text-xs".
 * 5. Wide table bottlenecks: replaces fixed large min-w on tables with "w-full".
 */

import fs from 'fs';
import path from 'path';
import { COMPONENT_DIRS } from './layout-sentry';

export interface AppliedFix {
  file: string;
  line: number;
  type: 'INJECT_SHRINK_0' | 'REPLACE_W_SCREEN' | 'ADD_MIN_W_0' | 'FIX_IOS_INPUT_ZOOM' | 'TABLE_W_FULL' | 'INJECT_PB_SAFE' | 'BUTTON_TYPE_ATTRIBUTE';
  before: string;
  after: string;
}

export interface HealResult {
  timestamp: string;
  dryRun: boolean;
  filesScanned: number;
  filesModified: number;
  fixesApplied: number;
  fixes: AppliedFix[];
}

export interface HealOptions {
  dirs?: string[];
  scope?: string;
  dryRun?: boolean;
}

/**
 * Executes layout healing across codebase.
 */
export function healLayoutFiles(options: HealOptions = {}): HealResult {
  const rootDir = process.cwd();
  const dryRun = options.dryRun ?? false;
  const targetDirs = options.scope ? [options.scope] : (options.dirs ?? COMPONENT_DIRS);

  const appliedFixes: AppliedFix[] = [];
  let filesScanned = 0;
  let filesModified = 0;

  for (const relDir of targetDirs) {
    const absPath = path.resolve(rootDir, relDir);
    if (!fs.existsSync(absPath)) continue;

    const files = fs.statSync(absPath).isDirectory() 
      ? getFilesRecursively(absPath, ['.tsx', '.jsx']) 
      : [absPath];

    for (const file of files) {
      filesScanned++;
      const relPath = path.relative(rootDir, file).replace(/\\/g, '/');
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      let isFileDirty = false;

      for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        const lineNum = i + 1;
        const origLine = line;

        // 1. Inject shrink-0 into SVG/Lucide/Icon tags inside flex
        if (/<(?:[A-Z][a-zA-Z]+|svg)\s+[^>]*className="([^"]*(?:w-[3-6]\s+h-[3-6]|h-[3-6]\s+w-[3-6])[^"]*)"/.test(line)) {
          if (!line.includes('shrink-0') && !line.includes('pointer-events-none')) {
            const isNearFlex = line.includes('flex') || [1, 2, 3, 4, 5].some(offset => i >= offset && lines[i - offset].includes('flex'));
            if (isNearFlex) {
              line = line.replace(/className="([^"]*)"/, (match, classList) => {
                return `className="${classList} shrink-0"`;
              });
              appliedFixes.push({
                file: relPath,
                line: lineNum,
                type: 'INJECT_SHRINK_0',
                before: origLine.trim(),
                after: line.trim()
              });
              isFileDirty = true;
            }
          }
        }

        // 2. Replace w-screen with w-full max-w-full in classNames (ignoring max-w-screen-*)
        if (/\bclassName="[^"]*(?<![\w-])w-screen(?![\w-])[^"]*"/.test(line)) {
          line = line.replace(/(?<![\w-])w-screen(?![\w-])/g, 'w-full max-w-full');
          appliedFixes.push({
            file: relPath,
            line: lineNum,
            type: 'REPLACE_W_SCREEN',
            before: origLine.trim(),
            after: line.trim()
          });
          isFileDirty = true;
        }

        // 3. Add min-w-0 to truncate flex children
        if (line.includes('truncate') && !line.includes('min-w-0')) {
          const isNearFlex = line.includes('flex') || [1, 2, 3, 4, 5].some(offset => i >= offset && lines[i - offset].includes('flex'));
          if (isNearFlex) {
            line = line.replace(/className="([^"]*truncate[^"]*)"/, (match, classList) => {
              return `className="${classList} min-w-0"`;
            });
            appliedFixes.push({
              file: relPath,
              line: lineNum,
              type: 'ADD_MIN_W_0',
              before: origLine.trim(),
              after: line.trim()
            });
            isFileDirty = true;
          }
        }

        // 4. Upgrade mobile input font sizes (< 16px) to text-base sm:text-xs to stop iOS auto-zoom
        if (/<(?:input|textarea)\s+[^>]*className="[^"]*text-(?:xs|\[1[0-3]px\])[^"]*"/.test(line)) {
          if (!line.includes('sm:text-') && !line.includes('md:text-')) {
            line = line.replace(/\btext-(?:xs|\[1[0-3]px\])\b/g, 'text-base sm:text-xs');
            appliedFixes.push({
              file: relPath,
              line: lineNum,
              type: 'FIX_IOS_INPUT_ZOOM',
              before: origLine.trim(),
              after: line.trim()
            });
            isFileDirty = true;
          }
        }

        // 5. Replace overly wide table min-w with w-full
        if (/<table[^>]*className="[^"]*min-w-\[(?:1[0-9]{3}|[89][0-9]{2})px\][^"]*"/.test(line)) {
          line = line.replace(/min-w-\[(?:1[0-9]{3}|[89][0-9]{2})px\]/g, 'w-full');
          appliedFixes.push({
            file: relPath,
            line: lineNum,
            type: 'TABLE_W_FULL',
            before: origLine.trim(),
            after: line.trim()
          });
          isFileDirty = true;
        }

        // 6. Inject pb-safe / safe-area padding into fixed bottom panels
        if (/\bclassName="[^"]*fixed\b[^"]*bottom-0[^"]*"/.test(line)) {
          if (!line.includes('pb-') && !line.includes('safe-area')) {
            line = line.replace(/className="([^"]*)"/, (match, classList) => {
              return `className="${classList} pb-[calc(1rem+env(safe-area-inset-bottom,0px))] md:pb-0"`;
            });
            appliedFixes.push({
              file: relPath,
              line: lineNum,
              type: 'INJECT_PB_SAFE',
              before: origLine.trim(),
              after: line.trim()
            });
            isFileDirty = true;
          }
        }

        // 7. Explicit button type="button" on interactive buttons with onClick without type
        if (/<button\s+[^>]*onClick=[^>]*>/.test(line) && !line.includes('type=') && !line.includes('asChild')) {
          line = line.replace(/<button\s+/, '<button type="button" ');
          appliedFixes.push({
            file: relPath,
            line: lineNum,
            type: 'BUTTON_TYPE_ATTRIBUTE',
            before: origLine.trim(),
            after: line.trim()
          });
          isFileDirty = true;
        }

        lines[i] = line;
      }

      if (isFileDirty) {
        filesModified++;
        if (!dryRun) {
          fs.writeFileSync(file, lines.join('\n'), 'utf8');
        }
      }
    }
  }

  const result: HealResult = {
    timestamp: new Date().toISOString(),
    dryRun,
    filesScanned,
    filesModified,
    fixesApplied: appliedFixes.length,
    fixes: appliedFixes
  };

  return result;
}

function getFilesRecursively(dir: string, extensions: string[]): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.next') {
        results.push(...getFilesRecursively(fullPath, extensions));
      }
    } else if (extensions.some(ext => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }

  return results;
}

export function runLayoutHealerCli(): void {
  const args = process.argv.slice(2);
  const isFix = args.includes('--fix');
  const isDryRun = args.includes('--dry-run') || !isFix;
  const isCheck = args.includes('--check');

  let scope: string | undefined;
  const scopeArg = args.find(a => a.startsWith('--scope='));
  if (scopeArg) {
    scope = scopeArg.split('=')[1];
  }

  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log(`🩺 Layout Auto-Healer — Automated Responsive Codemod (${isDryRun ? 'DRY-RUN' : 'APPLY FIXES'})`);
  console.log('   Targets: Mobile (375/390px) | Tablet (768px) | Laptop (1366px)');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  const result = healLayoutFiles({ dryRun: isDryRun, scope });

  console.log(`📊 Статистика исцеления:`);
  console.log(`   Файлов проверено: ${result.filesScanned}`);
  console.log(`   Файлов с исправлениями: ${result.filesModified}`);
  console.log(`   Всего примененных фиксов: ${result.fixesApplied}`);
  console.log(`   Режим: ${isDryRun ? '🟡 Просмотр (без записи на диск)' : '🟢 Записано на диск'}\n`);

  if (result.fixes.length > 0) {
    console.log('📋 Список исправлений:');
    result.fixes.slice(0, 15).forEach((f, idx) => {
      console.log(`   [${idx + 1}] ${f.type} @ ${f.file}:${f.line}`);
      console.log(`       Было:  ${f.before}`);
      console.log(`       Стало: ${f.after}`);
    });
    if (result.fixes.length > 15) {
      console.log(`   ... и еще ${result.fixes.length - 15} исправлений.`);
    }
  } else {
    console.log('✨ Замечаний для авто-исправления не найдено. Верстка соответствует стандарту.');
  }

  if (isCheck && result.fixesApplied > 0) {
    console.error(`\n❌ [FAIL] Layout issues found that require healing. Run "npm run layout:fix" to resolve.`);
    process.exit(1);
  }
}

if (require.main === module) {
  runLayoutHealerCli();
}
