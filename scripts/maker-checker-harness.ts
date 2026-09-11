/**
 * maker-checker-harness.ts
 * Инструмент автоматизированной сборки Handoff Bundle и пред-аудита
 * для протокола Maker-Checker в платформе OmniSMM 1.0.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export interface PreAuditFinding {
  vector: string;
  severity: 'BLOCKER' | 'MAJOR' | 'MINOR';
  file: string;
  line: number;
  message: string;
  snippet: string;
}

export interface HandoffBundle {
  timestamp: string;
  branch: string;
  modifiedFiles: string[];
  findings: PreAuditFinding[];
  summary: {
    blockers: number;
    majors: number;
    minors: number;
    passed: boolean;
  };
  gitDiffSnippet: string;
}

export class MakerCheckerHarness {
  private projectRoot: string;

  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  /**
   * Получить список измененных файлов через git status
   */
  getModifiedFiles(): string[] {
    try {
      const output = execSync('git status --porcelain', { cwd: this.projectRoot, encoding: 'utf-8' });
      return output
        .split('\n')
        .filter((raw) => raw.length >= 3)
        .map((raw) => raw.slice(3).trim())
        .filter((file) => /\.(ts|tsx|js|mjs|json)$/.test(file))
        .filter((file) => !file.includes('node_modules') && !file.includes('.next') && !file.includes('dist') && !file.includes('.planning') && !file.includes('maker-checker-harness'));
    } catch {
      return [];
    }
  }

  /**
   * Получить git diff текущих изменений
   */
  getGitDiff(): string {
    try {
      return execSync('git diff HEAD', { cwd: this.projectRoot, encoding: 'utf-8', maxBuffer: 1024 * 1024 * 5 });
    } catch {
      return '';
    }
  }

  /**
   * Запуск статического пред-аудита по файлам
   */
  scanFile(filePath: string): PreAuditFinding[] {
    const fullPath = path.resolve(this.projectRoot, filePath);
    if (!fs.existsSync(fullPath)) return [];

    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');
    const findings: PreAuditFinding[] = [];

    // Вектор 5: Лимит строк (<= 200)
    if (filePath.endsWith('.tsx') && lines.length > 200) {
      findings.push({
        vector: 'Vector 5: Architecture & NFR',
        severity: 'MAJOR',
        file: filePath,
        line: lines.length,
        message: `Компонент превышает лимит в 200 строк (всего ${lines.length} строк). Рекомендуется декомпозиция.`,
        snippet: `Total lines: ${lines.length}`,
      });
    }

    // Вектор 5: Запрет "use server" в page.tsx
    if (filePath.endsWith('page.tsx') && content.includes('"use server"')) {
      const lineIdx = lines.findIndex((l) => l.includes('"use server"'));
      findings.push({
        vector: 'Vector 5: Architecture & NFR',
        severity: 'BLOCKER',
        file: filePath,
        line: lineIdx + 1,
        message: 'Директива "use server" внутри page.tsx вызывает краш Next.js 16 App Router!',
        snippet: lines[lineIdx]?.trim() || '',
      });
    }

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      const trimmed = line.trim();

      // Вектор 4: Заглушки (TODO / FIXME)
      if (/\/\/\s*(TODO|FIXME|XXX)/i.test(trimmed)) {
        findings.push({
          vector: 'Vector 4: Code Hygiene',
          severity: 'MAJOR',
          file: filePath,
          line: lineNum,
          message: 'Обнаружена заглушка TODO/FIXME. Код должен быть полностью реализован.',
          snippet: trimmed,
        });
      }

      // Вектор 4: Подавления типов (@ts-ignore / eslint-disable)
      if (/@ts-ignore|@ts-nocheck|eslint-disable/i.test(trimmed)) {
        findings.push({
          vector: 'Vector 4: Code Hygiene',
          severity: 'MAJOR',
          file: filePath,
          line: lineNum,
          message: 'Подавление типов через @ts-ignore или eslint-disable недопустимо.',
          snippet: trimmed,
        });
      }

      // Вектор 4: Использование `any` без обоснования
      if (/:\s*any\b|\bas\s+any\b/.test(trimmed) && !trimmed.startsWith('//') && !filePath.includes('.test.')) {
        findings.push({
          vector: 'Vector 4: Code Hygiene',
          severity: 'MAJOR',
          file: filePath,
          line: lineNum,
          message: 'Нетипизированное использование any. Замените на строгий тип, generic или unknown.',
          snippet: trimmed,
        });
      }

      // Вектор 4: Inline цвета Tailwind вместо семантических токенов
      if (/\b(text-white|bg-black|text-black|bg-white|bg-blue-[0-9]{3}|text-gray-[0-9]{3})\b/.test(trimmed) && !filePath.includes('tailwind.config')) {
        findings.push({
          vector: 'Vector 4: Code Hygiene',
          severity: 'MINOR',
          file: filePath,
          line: lineNum,
          message: 'Использование inline-цвета вместо семантического токена из globals.css (text-foreground, bg-background).',
          snippet: trimmed,
        });
      }

      // Вектор 2: Transaction Escape (db.* внутри tx)
      if (/db\.(user|order|service|wallet|ledgerEntry)\.(update|create|delete|find)/.test(trimmed) && content.includes('$transaction')) {
        findings.push({
          vector: 'Vector 2: Financial & ACID',
          severity: 'BLOCKER',
          file: filePath,
          line: lineNum,
          message: 'Потенциальный Transaction Escape: использование db.* внутри транзакционного файла.',
          snippet: trimmed,
        });
      }
    });

    return findings;
  }

  /**
   * Сборка итогового Handoff Bundle
   */
  generateBundle(): HandoffBundle {
    const modifiedFiles = this.getModifiedFiles();
    const allFindings: PreAuditFinding[] = [];

    for (const file of modifiedFiles) {
      const findings = this.scanFile(file);
      allFindings.push(...findings);
    }

    const blockers = allFindings.filter((f) => f.severity === 'BLOCKER').length;
    const majors = allFindings.filter((f) => f.severity === 'MAJOR').length;
    const minors = allFindings.filter((f) => f.severity === 'MINOR').length;

    let branch = 'main';
    try {
      branch = execSync('git branch --show-current', { cwd: this.projectRoot, encoding: 'utf-8' }).trim();
    } catch {
      // ignore
    }

    const diff = this.getGitDiff();

    return {
      timestamp: new Date().toISOString(),
      branch,
      modifiedFiles,
      findings: allFindings,
      summary: {
        blockers,
        majors,
        minors,
        passed: blockers === 0 && majors === 0,
      },
      gitDiffSnippet: diff.slice(0, 3000) + (diff.length > 3000 ? '\n... [diff truncated]' : ''),
    };
  }

  /**
   * Вывод отчета в консоль и сохранение файла
   */
  run(): void {
    console.log('🛡️ [Maker-Checker Harness] Scanning modified files for pre-audit checklist...\n');
    const bundle = this.generateBundle();

    console.log(`📁 Modified Files Found (${bundle.modifiedFiles.length}):`);
    bundle.modifiedFiles.forEach((f) => console.log(`   - ${f}`));

    console.log(`\n📊 Pre-Audit Summary:`);
    console.log(`   - 🛑 BLOCKERS: ${bundle.summary.blockers}`);
    console.log(`   - ⚠️ MAJORS:   ${bundle.summary.majors}`);
    console.log(`   - ℹ️ MINORS:   ${bundle.summary.minors}`);

    if (bundle.findings.length > 0) {
      console.log('\n🔍 Detailed Findings:');
      bundle.findings.forEach((f, idx) => {
        const icon = f.severity === 'BLOCKER' ? '🛑' : f.severity === 'MAJOR' ? '⚠️' : 'ℹ️';
        console.log(`\n[${idx + 1}] ${icon} [${f.severity}] ${f.vector}`);
        console.log(`    File: ${f.file}:${f.line}`);
        console.log(`    Message: ${f.message}`);
        console.log(`    Snippet: "${f.snippet}"`);
      });
    }

    const reportPath = path.resolve(this.projectRoot, '.planning/maker_checker_handoff.json');
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(bundle, null, 2), 'utf-8');
    console.log(`\n📄 Handoff bundle saved to: ${reportPath}`);

    if (bundle.summary.passed) {
      console.log('\n🟢 [Pre-Audit PASS] Handoff Bundle is clean! Ready for Checker review (qa_reviewer).');
    } else {
      console.log('\n🔴 [Pre-Audit FAIL] Maker must fix Blockers and Majors before invoking Checker.');
    }
  }
}

// CLI Execution
if (process.argv[1]?.includes('maker-checker-harness.ts')) {
  const harness = new MakerCheckerHarness();
  harness.run();

  if (process.argv.includes('--ai')) {
    import('./maker-checker-ai').then(({ runCheckerAudit }) => {
      runCheckerAudit();
    });
  }
}
