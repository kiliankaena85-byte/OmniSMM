#!/usr/bin/env node
/**
 * Production Readiness Automated Linter & Audit Tool (v2026)
 * 
 * Сканирует кодовую базу на типичные «детские болезни» и антипаттерны, 
 * которые блокируют прохождение кода в продакшен и код-ревью техлида:
 * - Нелимитированные сетевые вызовы fetch() без таймаутов
 * - Пустые блоки catch (проглатывание ошибок)
 * - Использование OFFSET в пагинации
 * - Вызовы fs.readFile без стримов
 * - Сырой console.log в продуктовом коде
 * - Запрещенный "use server" в page.tsx
 * - Тяжелые barrel-импорты lodash
 */

import fs from 'node:fs';
import path from 'node:path';

interface AuditFinding {
  ruleId: string;
  severity: 'BLOCKER' | 'MAJOR' | 'MINOR';
  file: string;
  line: number;
  message: string;
  snippet: string;
  recommendation: string;
}

const FINDINGS: AuditFinding[] = [];

// Целевые директории для сканирования
const SCAN_DIRS = ['src/actions', 'src/services', 'src/lib', 'src/app/api', 'src/workers'];
const IGNORE_PATTERNS = ['node_modules', '.next', 'dist', '__tests__', '.git'];

function scanFile(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const relPath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');

  // 1. Проверка "use server" в page.tsx
  if (relPath.endsWith('page.tsx')) {
    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      if (lines[i].includes('"use server"') || lines[i].includes("'use server'")) {
        FINDINGS.push({
          ruleId: 'INV-PROD-PAGE-USE-SERVER',
          severity: 'BLOCKER',
          file: relPath,
          line: i + 1,
          message: 'Директива "use server" обнаружена в page.tsx! Это ломает билд Next.js.',
          snippet: lines[i].trim(),
          recommendation: 'Вынесите Server Actions в отдельный файл внутри src/actions/.'
        });
      }
    }
  }

  // 2. Построчный анализ
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    const prevLine = i > 0 ? lines[i - 1] : '';
    const hasAuditIgnore = line.includes('// audit-ignore') || prevLine.includes('// audit-ignore');

    // Проверка: пустой catch
    if (/catch\s*(\([^\)]*\))?\s*\{\s*\}/.test(line) && !hasAuditIgnore) {
      FINDINGS.push({
        ruleId: 'INV-PROD-09-EMPTY-CATCH',
        severity: 'BLOCKER',
        file: relPath,
        line: lineNum,
        message: 'Обнаружен пустой блок catch (тихое проглатывание ошибки).',
        snippet: line.trim(),
        recommendation: 'Залогируйте ошибку через logger.error или верните { success: false, error }.'
      });
    }

    // Проверка: barrel-импорт lodash
    if (/import\s+\{[^}]+\}\s+from\s+['"]lodash['"]/.test(line) && !hasAuditIgnore) {
      FINDINGS.push({
        ruleId: 'INV-PROD-04-BARREL-LODASH',
        severity: 'MAJOR',
        file: relPath,
        line: lineNum,
        message: 'Обнаружен монолитный barrel-импорт из lodash (раздувание клиентского бандла).',
        snippet: line.trim(),
        recommendation: 'Используйте точечные импорты вида `import debounce from "lodash/debounce";`.'
      });
    }

    // Проверка: сырой console.log
    if (/\bconsole\.(log|dir|debug)\s*\(/.test(line) && !hasAuditIgnore) {
      FINDINGS.push({
        ruleId: 'INV-PROD-08-CONSOLE-LOG',
        severity: 'MINOR',
        file: relPath,
        line: lineNum,
        message: 'Использование сырого console.log в продуктовом слое.',
        snippet: line.trim(),
        recommendation: 'Используйте структурированный логгер `logger.info(...)` или `logger.error(...)`.'
      });
    }

    // Проверка: OFFSET в запросах
    if (/\bOFFSET\s+\d+/i.test(line) || /\bskip:\s*\d+/i.test(line)) {
      // Исключаем keyset pagination: skip: 1 вместе с cursor или skip: cursor ? 1 : 0
      const isKeyset = line.includes('skip: cursor ? 1 : 0') || (line.includes('skip: 1') && (line.includes('cursor') || prevLine.includes('cursor')));
      if (!isKeyset && !hasAuditIgnore) {
        FINDINGS.push({
          ruleId: 'INV-PROD-06-OFFSET-PAGINATION',
          severity: 'MAJOR',
          file: relPath,
          line: lineNum,
          message: 'Обнаружено использование OFFSET/skip пагинации.',
          snippet: line.trim(),
          recommendation: 'Используйте Keyset (Cursor-based) пагинацию по индексированному полю.'
        });
      }
    }

    // Проверка: fs.readFile / fs.readFileSync
    if (/\bfs\.(readFile|readFileSync)\s*\(/.test(line) && !hasAuditIgnore) {
      FINDINGS.push({
        ruleId: 'INV-PROD-01-FS-READFILE',
        severity: 'MAJOR',
        file: relPath,
        line: lineNum,
        message: 'Чтение файла целиком в память через readFile (риск OOM при больших файлах).',
        snippet: line.trim(),
        recommendation: 'Для файлов > 64 КБ используйте потоки: createReadStream + pipeline.'
      });
    }
  }

  // 3. Анализ сетевых вызовов fetch() на наличие таймаута
  const fetchMatches = [...content.matchAll(/\bfetch\s*\(/g)];
  for (const match of fetchMatches) {
    const matchIndex = match.index || 0;
    const beforeContent = content.substring(0, matchIndex);
    const linesBefore = beforeContent.split('\n');
    const lineNum = linesBefore.length;
    const currentLine = linesBefore[linesBefore.length - 1] || '';
    const prevLine = linesBefore.length > 1 ? linesBefore[linesBefore.length - 2] : '';
    
    // Check audit-ignore or commented-out line
    if (
      currentLine.includes('// audit-ignore') || 
      prevLine.includes('// audit-ignore') ||
      currentLine.trim().startsWith('//') ||
      currentLine.trim().startsWith('*') ||
      currentLine.trim().startsWith('/*')
    ) {
      continue;
    }

    // Окно вокруг вызова fetch (до 1200 символов вперед)
    const surroundingCode = content.substring(matchIndex, matchIndex + 1200);
    if (!surroundingCode.includes('signal') && !surroundingCode.includes('AbortSignal') && !surroundingCode.includes('timeout')) {
      FINDINGS.push({
        ruleId: 'INV-PROD-03-FETCH-NO-TIMEOUT',
        severity: 'BLOCKER',
        file: relPath,
        line: lineNum,
        message: 'Вызов fetch() без детерминированного таймаута AbortSignal.timeout().',
        snippet: surroundingCode.split('\n')[0].substring(0, 80) + '...',
        recommendation: 'Добавьте `{ signal: AbortSignal.timeout(5000) }` для защиты от зависших сокетов.'
      });
    }
  }
}

function walkDir(dir: string) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (IGNORE_PATTERNS.some(p => entry.name.includes(p))) continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else if (/\.(ts|tsx|js|mjs)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      scanFile(fullPath);
    }
  }
}

export function runProductionReadinessAudit() {
  console.log('🚀 [Production Readiness Audit] Старт сканирования кодовой базы на готовность к HighLoad...');
  
  for (const dir of SCAN_DIRS) {
    walkDir(path.resolve(process.cwd(), dir));
  }

  const blockers = FINDINGS.filter(f => f.severity === 'BLOCKER');
  const majors = FINDINGS.filter(f => f.severity === 'MAJOR');
  const minors = FINDINGS.filter(f => f.severity === 'MINOR');

  console.log('\n────────────────────────────────────────────────────────────────────────');
  console.log(`📊 РЕЗУЛЬТАТЫ АУДИТА ГОТОВНОСТИ К ПРОДАКШЕНУ (PROD-READINESS-2026):`);
  console.log(`   ⛔ Блокеров (BLOCKER): ${blockers.length}`);
  console.log(`   ⚠️  Критических замечаний (MAJOR): ${majors.length}`);
  console.log(`   ℹ️  Предупреждений (MINOR): ${minors.length}`);
  console.log('────────────────────────────────────────────────────────────────────────\n');

  if (FINDINGS.length > 0) {
    console.log('Детализация блокеров и ключевых находок:\n');
    const itemsToShow = blockers.length > 0 ? blockers : FINDINGS.slice(0, 20);
    itemsToShow.forEach((finding, idx) => {
      const icon = finding.severity === 'BLOCKER' ? '⛔' : finding.severity === 'MAJOR' ? '⚠️' : 'ℹ️';
      console.log(`${idx + 1}. ${icon} [${finding.severity}] ${finding.ruleId} (${finding.file}:${finding.line})`);
      console.log(`   Проблема: ${finding.message}`);
      console.log(`   Фрагмент: "${finding.snippet}"`);
      console.log(`   💡 Решение: ${finding.recommendation}\n`);
    });
  } else {
    console.log('✅ ИДЕАЛЬНО! В кодовой базе не обнаружено типичных блокеров продакшена.');
  }

  return {
    success: blockers.length === 0,
    blockersCount: blockers.length,
    majorsCount: majors.length,
    minorsCount: minors.length,
    totalFindings: FINDINGS.length
  };
}

if (process.argv[1] && process.argv[1].endsWith('audit-production-readiness.ts')) {
  runProductionReadinessAudit();
}
