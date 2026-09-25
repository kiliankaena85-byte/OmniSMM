/**
 * @file lint-zero-any.ts
 * 🛡️ OmniSMM 1.0 — Zero-Any AST Ratchet Guard (2026).
 *
 * Implements a strict ratchet mechanism using the native TypeScript Compiler API.
 * Guarantees that:
 * 1. Zero new `any` keywords can ever enter the codebase.
 * 2. Any new file or newly added test MUST have 0 `any` keywords (Instant Blocker).
 * 3. Any file in the baseline cannot increase its `any` count.
 * 4. As legacy files are cleaned up, the baseline ratchets down and cannot rebound.
 */

import fs from 'fs';
import path from 'path';
import ts from 'typescript';

export interface AnyOccurrence {
  file: string;
  line: number;
  snippet: string;
}

export interface ZeroAnyReport {
  totalFiles: number;
  cleanFiles: number;
  violatingFiles: number;
  totalAnyCount: number;
  newViolations: AnyOccurrence[];
  graduatedFiles: string[];
  passed: boolean;
}

const BASELINE_FILE = path.resolve(__dirname, 'zero-any-baseline.json');
const PROJECT_ROOT = path.resolve(__dirname, '..');

export class ZeroAnyRatchetScanner {
  private baseline: Record<string, number> = {};

  constructor() {
    this.loadBaseline();
  }

  private loadBaseline(): void {
    if (fs.existsSync(BASELINE_FILE)) {
      try {
        const raw = fs.readFileSync(BASELINE_FILE, 'utf-8');
        this.baseline = JSON.parse(raw);
      } catch (e) {
        console.warn('⚠️ [Zero-Any] Could not parse baseline file, using empty baseline:', e);
        this.baseline = {};
      }
    } else {
      this.baseline = {};
    }
  }

  public saveBaseline(counts: Record<string, number>): void {
    // Only persist files with count > 0 to keep baseline compact
    const compact: Record<string, number> = {};
    for (const [file, count] of Object.entries(counts)) {
      if (count > 0) {
        compact[file] = count;
      }
    }
    fs.writeFileSync(BASELINE_FILE, JSON.stringify(compact, null, 2), 'utf-8');
    console.log(`💾 [Zero-Any] Baseline saved to ${BASELINE_FILE} with ${Object.keys(compact).length} files.`);
  }

  private getSourceFiles(dir: string): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) return results;

    const list = fs.readdirSync(dir);
    for (const item of list) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        if (!['node_modules', '.next', 'dist', '.git', '.planning', '.agents'].includes(item)) {
          results.push(...this.getSourceFiles(fullPath));
        }
      } else if ((item.endsWith('.ts') || item.endsWith('.tsx')) && !item.endsWith('.d.ts')) {
        results.push(fullPath);
      }
    }
    return results;
  }

  public scanFile(filePath: string): { occurrences: AnyOccurrence[]; count: number } {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relPath = path.relative(PROJECT_ROOT, filePath).replace(/\\/g, '/');
    const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
    const lines = content.split('\n');

    const occurrences: AnyOccurrence[] = [];

    const visit = (node: ts.Node) => {
      if (node.kind === ts.SyntaxKind.AnyKeyword) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const snippet = (lines[line] || '').trim();
        occurrences.push({
          file: relPath,
          line: line + 1,
          snippet,
        });
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return { occurrences, count: occurrences.length };
  }

  public runScan(targetDir = 'src'): {
    report: ZeroAnyReport;
    currentCounts: Record<string, number>;
  } {
    const fullTarget = path.resolve(PROJECT_ROOT, targetDir);
    const files = this.getSourceFiles(fullTarget);

    let totalAnyCount = 0;
    let cleanFiles = 0;
    const currentCounts: Record<string, number> = {};
    const newViolations: AnyOccurrence[] = [];
    const graduatedFiles: string[] = [];

    for (const file of files) {
      const relPath = path.relative(PROJECT_ROOT, file).replace(/\\/g, '/');
      const { occurrences, count } = this.scanFile(file);
      currentCounts[relPath] = count;
      totalAnyCount += count;

      if (count === 0) {
        cleanFiles++;
        if (this.baseline[relPath] && this.baseline[relPath] > 0) {
          graduatedFiles.push(relPath);
        }
      } else {
        const allowed = this.baseline[relPath] ?? 0;
        if (count > allowed) {
          // New violations found!
          // Take only the excess violations
          const excess = occurrences.slice(allowed);
          newViolations.push(...excess);
        }
      }
    }

    const report: ZeroAnyReport = {
      totalFiles: files.length,
      cleanFiles,
      violatingFiles: files.length - cleanFiles,
      totalAnyCount,
      newViolations,
      graduatedFiles,
      passed: newViolations.length === 0,
    };

    return { report, currentCounts };
  }
}

// CLI Execution
if (require.main === module || process.argv[1]?.includes('lint-zero-any.ts')) {
  const args = process.argv.slice(2);
  const isInit = args.includes('--init');
  const isUpdate = args.includes('--update');

  const scanner = new ZeroAnyRatchetScanner();
  console.log('🛡️  [Zero-Any Ratchet] Scanning TypeScript AST for forbidden `any` keywords...\n');

  const startTime = Date.now();
  const { report, currentCounts } = scanner.runScan('src');
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`📦 Analyzed ${report.totalFiles} TypeScript files in ${elapsed}s.`);
  console.log(`✨ Clean files (0 any): ${report.cleanFiles} / ${report.totalFiles} (${((report.cleanFiles / report.totalFiles) * 100).toFixed(1)}%)`);
  console.log(`⚠️  Files with legacy any: ${report.violatingFiles}`);
  console.log(`📊 Total 'any' keywords across codebase: ${report.totalAnyCount}\n`);

  if (report.graduatedFiles.length > 0) {
    console.log('🎉 [GRADUATED] The following files were cleaned up to 0 any:');
    report.graduatedFiles.forEach((f) => console.log(`   ✅ ${f}`));
    console.log();
  }

  if (isInit || isUpdate) {
    scanner.saveBaseline(currentCounts);
    console.log('✅ Baseline updated successfully!');
    process.exit(0);
  }

  if (!report.passed) {
    console.error(`🛑 [ZERO-ANY VIOLATION] Found ${report.newViolations.length} unauthorized 'any' keyword(s)!`);
    console.error('   Any new files, new tests, or additions to refactored files are STRICTLY forbidden from using `any`.\n');
    report.newViolations.forEach((v, idx) => {
      console.error(`   [${idx + 1}] ${v.file}:${v.line}`);
      console.error(`       Snippet: "${v.snippet}"`);
    });
    console.error('\n💡 Remediation Guide:');
    console.error('   1. Use Typed Entity Builders (e.g. createTestUser, createTestOrder).');
    console.error('   2. Use `unknown` with runtime type guards or Zod schemas.');
    console.error('   3. Cast mocks via `as unknown as typeof db.user.findUnique`.');
    console.error('   4. Check `prisma/schema.prisma` for exact database model field names.\n');
    process.exit(1);
  }

  console.log('🟢 [ZERO-ANY PASS] No new `any` keywords detected! Ratchet contract strictly honored.');
  process.exit(0);
}
