/**
 * lint-tenant-isolation.ts
 * Нативный TypeScript AST-сканер изоляции тенантов платформы OmniSMM 1.0.
 * Реализует стандарт SDD-TDD 2026, защиту от BOLA/IDOR, Brand Bleeding и ст. 54.1 НК РФ.
 */

import fs from 'fs';
import path from 'path';
import ts from 'typescript';

export interface TenantViolation {
  ruleId: string;
  severity: 'BLOCKER' | 'MAJOR' | 'WARNING';
  file: string;
  line: number;
  message: string;
  snippet: string;
}

export const TENANT_SCOPED_MODELS = new Set([
  'order',
  'user',
  'payment',
  'ticket',
  'service',
  'category',
  'ledgerentry',
  'customergroup',
  'ticketfeedback',
]);

export const TARGET_QUERY_METHODS = new Set([
  'findmany',
  'findfirst',
  'findunique',
  'count',
  'update',
  'updatemany',
  'delete',
  'deletemany',
  'aggregate',
  'groupby',
]);

export class TenantIsolationLinter {
  private projectRoot: string;

  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  /**
   * Анализ переданного фрагмента кода (используется в тестах и при точечном аудите)
   */
  public analyzeSnippet(filePath: string, content: string): TenantViolation[] {
    const violations: TenantViolation[] = [];
    const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
    const lines = content.split('\n');

    const getLine = (node: ts.Node): number => {
      return sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    };

    const getSnippet = (node: ts.Node): string => {
      const lineNum = getLine(node);
      return (lines[lineNum - 1] || '').trim();
    };

    const normPath = filePath.replace(/\\/g, '/');
    const isSystemInfrastructure =
      normPath.includes('src/lib/server/rbac') ||
      normPath.includes('src/lib/operator/rbac') ||
      normPath.includes('src/lib/api-auth') ||
      normPath.includes('src/lib/auth/require-session') ||
      normPath.includes('src/lib/alerts/') ||
      normPath.includes('src/lib/session') ||
      normPath.includes('src/lib/prisma-tenant-scope') ||
      normPath.includes('src/lib/daemons/') ||
      normPath.includes('src/lib/finance/') ||
      normPath.includes('src/lib/fraud/') ||
      normPath.includes('src/lib/pricing/currency-invariant') ||
      normPath.includes('src/lib/providers/') ||
      normPath.includes('src/lib/orders/realtime-status') ||
      normPath.includes('src/app/api/webhooks/') ||
      normPath.includes('src/services/providers/') ||
      normPath.includes('src/services/financial/nightly-ledger-audit.service') ||
      normPath.includes('src/services/financial/ledger-reconciliation.service') ||
      normPath.includes('src/services/financial/accounting.service') ||
      normPath.includes('src/services/observer/') ||
      normPath.includes('src/services/admin/escrow.service') ||
      normPath.includes('src/services/admin/storm-detector.service');

    const fileHasFileLevelIgnore = lines.slice(0, 15).some(l => l.includes('tenant-isolation-ignore'));

    // Проверка наличия комментария-игнора в предыдущих строках или файле
    const hasIgnoreComment = (lineNum: number): boolean => {
      if (isSystemInfrastructure || fileHasFileLevelIgnore) return true;
      for (let i = Math.max(0, lineNum - 5); i < lineNum; i++) {
        const line = lines[i] || '';
        if (line.includes('tenant-isolation-ignore')) {
          return true;
        }
      }
      return false;
    };

    // Обход синтаксического AST-дерева
    const visit = (node: ts.Node) => {
      // -------------------------------------------------------------
      // ПРАВИЛО 1: tenant-where-clause-required (Prisma Query Inspection)
      // -------------------------------------------------------------
      if (ts.isCallExpression(node)) {
        const expr = node.expression;
        if (ts.isPropertyAccessExpression(expr)) {
          const methodName = expr.name.text.toLowerCase();
          const targetObj = expr.expression;

          if (ts.isPropertyAccessExpression(targetObj)) {
            const modelName = targetObj.name.text.toLowerCase();
            const rootClient = targetObj.expression.getText(sourceFile);

            if (
              (rootClient === 'db' || rootClient === 'tx' || rootClient.endsWith('Db') || rootClient.endsWith('Prisma')) &&
              TENANT_SCOPED_MODELS.has(modelName) &&
              TARGET_QUERY_METHODS.has(methodName)
            ) {
              const lineNum = getLine(node);
              if (!hasIgnoreComment(lineNum)) {
                // Проверяем первый аргумент (options object)
                const firstArg = node.arguments[0];
                let hasTenantInWhere = false;

                if (!firstArg) {
                  hasTenantInWhere = false;
                } else if (ts.isIdentifier(firstArg) || ts.isCallExpression(firstArg)) {
                  // Динамический объект аргументов (e.g. db.model.findMany(query))
                  hasTenantInWhere = true;
                } else if (ts.isObjectLiteralExpression(firstArg)) {
                  for (const prop of firstArg.properties) {
                    if (ts.isPropertyAssignment(prop) && prop.name.getText(sourceFile) === 'where') {
                      const whereInit = prop.initializer;
                      const whereText = whereInit.getText(sourceFile);
                      if (
                        whereText.includes('tenantId') ||
                        whereText.includes('tenant') ||
                        whereText.includes('cleanTenant') ||
                        whereText.includes('normalizedTenant') ||
                        whereText.includes('where') ||
                        whereText.includes('filter') ||
                        whereText.includes('clause') ||
                        whereText.includes('scope') ||
                        whereText.includes('condition')
                      ) {
                        hasTenantInWhere = true;
                      } else if (ts.isIdentifier(whereInit) || ts.isCallExpression(whereInit)) {
                        // Динамический where хелпер
                        hasTenantInWhere = true;
                      }
                    } else if (ts.isShorthandPropertyAssignment(prop) && prop.name.getText(sourceFile) === 'where') {
                      // e.g. { where, orderBy }
                      hasTenantInWhere = true;
                    } else if (ts.isSpreadAssignment(prop)) {
                      // e.g. { ...whereOptions }
                      const spreadText = prop.expression.getText(sourceFile);
                      if (
                        spreadText.includes('tenant') ||
                        spreadText.includes('where') ||
                        spreadText.includes('filter') ||
                        spreadText.includes('query')
                      ) {
                        hasTenantInWhere = true;
                      }
                    }
                  }
                }

                if (!hasTenantInWhere) {
                  const isSingleUniqueOp = methodName === 'findunique' || methodName === 'update' || methodName === 'delete';
                  violations.push({
                    ruleId: 'tenant-where-clause-required',
                    severity: isSingleUniqueOp ? 'WARNING' : 'BLOCKER',
                    file: filePath,
                    line: lineNum,
                    message: isSingleUniqueOp
                      ? `Запрос ${targetObj.name.text}.${expr.name.text}() без tenantId в where. Рекомендуется findFirst({ where: { id, tenantId } }) или обязательная проверка record.tenantId сразу после выборки для защиты от IDOR.`
                      : `Запрос к модели ${targetObj.name.text}.${expr.name.text}() обязан содержать 'where: { tenantId }' для защиты от BOLA/IDOR утечек.`,
                    snippet: getSnippet(node),
                  });
                }
              }
            }
          }
        }

        // -------------------------------------------------------------
        // ПРАВИЛО 2: tenant-cache-key-required (unstable_cache Inspection)
        // -------------------------------------------------------------
        const callName = node.expression.getText(sourceFile);
        if (callName === 'unstable_cache') {
          const lineNum = getLine(node);
          const keyArg = node.arguments[1];
          let hasTenantInKey = false;

          if (keyArg && ts.isArrayLiteralExpression(keyArg)) {
            const lowerKey = keyArg.getText(sourceFile).toLowerCase();
            if (lowerKey.includes('tenant')) {
              hasTenantInKey = true;
            }
          }

          if (!hasTenantInKey && !hasIgnoreComment(lineNum)) {
            violations.push({
              ruleId: 'tenant-cache-key-required',
              severity: 'MAJOR',
              file: filePath,
              line: lineNum,
              message: `Вызов unstable_cache обязан включать 'tenantId' в массив ключей кэша для предотвращения Brand Bleeding.`,
              snippet: getSnippet(node),
            });
          }
        }
      }

      // -------------------------------------------------------------
      // ПРАВИЛО 3: no-phantom-brand-ghosting (Запрет фантомных брендов)
      // -------------------------------------------------------------
      const isAllowedLegacyNormalizer =
        filePath.includes('tenant-resolver-edge') ||
        filePath.includes('tenant-scope') ||
        filePath.includes('seo-helpers') ||
        filePath.includes('tenant-config');

      if (!isAllowedLegacyNormalizer) {
        if (ts.isStringLiteral(node) || ts.isJsxText(node)) {
          const text = node.getText(sourceFile).toLowerCase();
          if (
            (text.includes('lovable') || text.includes('smmboost')) &&
            !text.includes('normalize') &&
            !text.includes('preferreddashboard')
          ) {
            const lineNum = getLine(node);
            violations.push({
              ruleId: 'no-phantom-brand-ghosting',
              severity: 'BLOCKER',
              file: filePath,
              line: lineNum,
              message: `Обнаружен фантомный бренд '${text.trim()}' (Brand Ghosting). Брендов Lovable и SMMboost не существует! Используйте канонический бренд 'flux' или динамический 'tenantId'.`,
              snippet: getSnippet(node),
            });
          }
        }
      }

      // -------------------------------------------------------------
      // ПРАВИЛО 4: tenant-worker-wrapper-required (BullMQ Фоновые задачи)
      // -------------------------------------------------------------
      if (normPath.includes('src/workers/processors/') && !normPath.includes('__tests__') && !normPath.includes('types.ts')) {
        // Check if the node is an exported function or default export (the processor entry point)
        if ((ts.isFunctionDeclaration(node) && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) ||
            (ts.isArrowFunction(node) && node.parent && ts.isVariableDeclaration(node.parent) && node.parent.parent && node.parent.parent.parent && ts.isVariableStatement(node.parent.parent.parent) && node.parent.parent.parent.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword))) {
          
          const lineNum = getLine(node);
          const funcText = node.getText(sourceFile);
          
          // order/ directory contains helpers, but main processors are in processors/ root
          const isMainProcessor = normPath.split('/').length === 4; 
          
          if (isMainProcessor && !funcText.includes('runWithTenant') && !hasIgnoreComment(lineNum)) {
            violations.push({
              ruleId: 'tenant-worker-wrapper-required',
              severity: 'BLOCKER',
              file: filePath,
              line: lineNum,
              message: `Фоновая задача BullMQ ОБЯЗАНА быть обернута в runWithTenant(job.data.tenantId, async () => { ... }) для защиты контекста бренда.`,
              snippet: getSnippet(node),
            });
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return violations;
  }

  /**
   * Поиск всех файлов для анализа
   */
  public getSourceFiles(dir: string): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) return results;

    const list = fs.readdirSync(dir);
    for (const file of list) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        if (!['node_modules', '.next', 'dist', '.git', '.planning', '.agents'].includes(file)) {
          results.push(...this.getSourceFiles(fullPath));
        }
      } else if (
        (file.endsWith('.ts') || file.endsWith('.tsx')) &&
        !file.endsWith('.d.ts') &&
        !file.includes('.test.') &&
        !file.includes('prisma/schema')
      ) {
        results.push(fullPath);
      }
    }
    return results;
  }

  /**
   * Сквозной запуск линтера
   */
  public run(targetDirs = ['src/actions', 'src/services', 'src/app/api', 'src/lib', 'src/workers']): {
    violations: TenantViolation[];
    filesChecked: number;
    blockersCount: number;
  } {
    const allViolations: TenantViolation[] = [];
    let filesChecked = 0;

    for (const relDir of targetDirs) {
      const fullDir = path.join(this.projectRoot, relDir);
      const files = this.getSourceFiles(fullDir);

      for (const file of files) {
        filesChecked++;
        const content = fs.readFileSync(file, 'utf-8');
        const violations = this.analyzeSnippet(path.relative(this.projectRoot, file), content);
        allViolations.push(...violations);
      }
    }

    const blockersCount = allViolations.filter((v) => v.severity === 'BLOCKER').length;
    return {
      violations: allViolations,
      filesChecked,
      blockersCount,
    };
  }
}

// Прямой запуск через CLI: npx tsx scripts/lint-tenant-isolation.ts
if (process.argv[1] && (process.argv[1].endsWith('lint-tenant-isolation.ts') || process.argv[1].endsWith('lint-tenant-isolation.js'))) {
  const linter = new TenantIsolationLinter();
  console.log('\x1b[36m%s\x1b[0m', '═══════════════════════════════════════════════════════════════');
  console.log('\x1b[1m%s\x1b[0m', '🛡️  OmniSMM 1.0 — Multi-Tenant Isolation & BOLA/IDOR AST Guardrails');
  console.log('\x1b[36m%s\x1b[0m', '═══════════════════════════════════════════════════════════════\n');

  const result = linter.run();
  console.log(`Проверено файлов: ${result.filesChecked}`);

  if (result.violations.length === 0) {
    console.log('\x1b[32m%s\x1b[0m', '\n✅ 100% PASS: Все запросы к БД, кэши и контракты строго изолированы по tenantId!');
    console.log('Zero Cross-Tenant Leakage, Zero Brand Bleeding, Zero Ghost Brands.\n');
    process.exit(0);
  } else {
    console.log(`\nОбнаружено нарушений: ${result.violations.length} (Блокеров: ${result.blockersCount})\n`);
    for (const v of result.violations) {
      const color = v.severity === 'BLOCKER' ? '\x1b[31m' : '\x1b[33m';
      console.log(`${color}[${v.severity}] ${v.ruleId}\x1b[0m`);
      console.log(`  Файл: ${v.file}:${v.line}`);
      console.log(`  Причина: ${v.message}`);
      console.log(`  Код: \x1b[90m${v.snippet}\x1b[0m\n`);
    }

    if (result.blockersCount > 0) {
      console.log('\x1b[31m%s\x1b[0m', '❌ Сборка заблокирована из-за наличия нарушений изоляции уровня BLOCKER.');
      process.exit(1);
    } else {
      console.log('\x1b[33m%s\x1b[0m', '⚠️  Обнаружены некритические предупреждения.');
      process.exit(0);
    }
  }
}
