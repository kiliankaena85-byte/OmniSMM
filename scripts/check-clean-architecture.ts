/**
 * check-clean-architecture.ts
 *
 * Нативный TypeScript AST-валидатор зависимостей и чистоты слоев Clean Architecture (Uncle Bob Pattern).
 * Построен по методологии проекта unclebob/uml-viewer:
 * - Формализует уровни слоев:
 *   - Level 0: Domain & Invariants (src/types, src/lib/financial, src/lib/wallet)
 *   - Level 1: Services & Business Engines (src/services, src/validators, src/utils, src/lib/infra)
 *   - Level 2: Application, Handlers & Gateways (src/actions, src/app/api, src/workers, src/bot)
 *   - Level 3: Presentation & UI Shell (src/components, src/hooks, src/tenants, src/app/*)
 * - Контролирует инвариант: зависимости направлены строго внутрь (Inward Dependency Rule: outer -> inner).
 * - Детектирует циклические зависимости (Cycles) и утечки сервера в клиентские компоненты ('use client').
 * - Вычисляет per-method McCabe Cyclomatic Complexity и Alberto Savoia / Uncle Bob CRAP Score.
 * - Классифицирует модули по DDD Bounded Contexts платформы OmniSMM 1.0.
 * - Генерирует артефакт topology IR (artifacts/architecture-topology.json) для автономного Docker-просмотрщика.
 */

import fs from 'fs';
import path from 'path';
import ts from 'typescript';

export type LayerLevel = 0 | 1 | 2 | 3;

export interface LayerDefinition {
  level: LayerLevel;
  name: string;
  description: string;
  color: string;
}

export const ARCHITECTURE_LAYERS: LayerDefinition[] = [
  { level: 0, name: 'Domain', description: 'Pure Domain Types & Mathematical Invariants', color: '#22c55e' },
  { level: 1, name: 'Services', description: 'Domain Business Logic, Validators & Provider Engines', color: '#3b82f6' },
  { level: 2, name: 'Application', description: 'Server Actions, Route Handlers, Workers, Bot', color: '#a855f7' },
  { level: 3, name: 'Presentation', description: 'React Components, Hooks, Tenant UI Shell & Pages', color: '#eab308' },
];

export type BoundedContextType =
  | 'FINTECH_LEDGER'
  | 'ORDERS_CHECKOUT'
  | 'CATALOG_INGESTION'
  | 'MULTI_TENANT_CORE'
  | 'ASYNC_DAEMONS'
  | 'CORE_FRAMEWORK';

export interface FunctionMetric {
  name: string;
  startLine: number;
  endLine: number;
  cyclomaticComplexity: number;
  coverageRatio: number | null; // null if unmeasured
  crapScore: number;
  isCrappy: boolean; // crapScore > 30
}

export interface TopologyNode {
  id: string;
  label: string;
  level: LayerLevel;
  layer: string;
  boundedContext: BoundedContextType;
  linesCount: number;
  isClientComponent: boolean;
  exportsCount: number;
  functionsCount: number;
  maxCyclomaticComplexity: number;
  maxCrapScore: number;
  crapLoad: number;
  crappyMethodsCount: number;
  coverageStatus: 'MEASURED' | 'UNMEASURED';
  topRiskFunctions?: FunctionMetric[];
}

export interface TopologyEdge {
  source: string;
  target: string;
  kind: 'dependency' | 'association';
  isTypeOnly: boolean;
  isViolating: boolean;
  violationReason?: string;
}

export interface ArchitectureViolation {
  id: string;
  severity: 'BLOCKER' | 'MAJOR' | 'WARNING';
  sourceFile: string;
  targetModule: string;
  line: number;
  message: string;
  snippet: string;
}

export interface ArchitectureGraphIR {
  $schema: string;
  title: string;
  generatedAt: string;
  layers: LayerDefinition[];
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  violations: ArchitectureViolation[];
  cycles: string[][];
  metrics: {
    totalFiles: number;
    totalEdges: number;
    violationsCount: number;
    cyclesCount: number;
    blockersCount: number;
    totalFunctions: number;
    highestCrapModule: { id: string; maxCrap: number; maxCC: number } | null;
    totalCrappyFunctions: number;
    totalCrapLoad: number;
  };
}

export class CleanArchitectureGuard {
  private projectRoot: string;
  private srcDir: string;
  private nodes: Map<string, TopologyNode> = new Map();
  private edges: TopologyEdge[] = [];
  private violations: ArchitectureViolation[] = [];
  private adjacencyList: Map<string, Set<string>> = new Map();
  private coverageData: Map<string, { linesCov: number }> = new Map();

  constructor(projectRoot = process.cwd()) {
    this.projectRoot = path.resolve(projectRoot);
    this.srcDir = path.resolve(this.projectRoot, 'src');
    this.loadCoverageSummary();
  }

  /**
   * Загрузка отчета о покрытии Vitest/V8 (если доступен)
   */
  private loadCoverageSummary(): void {
    const summaryCandidates = [
      path.join(this.projectRoot, 'coverage', 'coverage-summary.json'),
      path.join(this.projectRoot, 'coverage', 'coverage-final.json'),
    ];

    for (const filePath of summaryCandidates) {
      if (fs.existsSync(filePath)) {
        try {
          const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          for (const [key, val] of Object.entries(raw)) {
            const relKey = path.relative(this.projectRoot, key).replace(/\\/g, '/');
            const summaryVal = val as { lines?: { pct?: number } };
            if (summaryVal?.lines?.pct !== undefined) {
              this.coverageData.set(relKey, { linesCov: summaryVal.lines.pct / 100 });
            }
          }
          break;
        } catch {
          // Игнорируем ошибки чтения кэша покрытия
        }
      }
    }
  }

  /**
   * Определение слоя и уровня по относительному пути (Clean Architecture Matrix)
   */
  public determineLayer(relPath: string): { level: LayerLevel; layer: string } {
    const normalized = relPath.replace(/\\/g, '/');

    // Level 0: Pure Domain & Invariants (Highest abstraction, no runtime dependencies)
    if (
      normalized.startsWith('src/types/') ||
      normalized.startsWith('src/lib/financial/') ||
      normalized.startsWith('src/lib/wallet/')
    ) {
      return { level: 0, layer: 'Domain' };
    }

    // Level 1: Domain Services, Engines, Validators & Domain Utilities
    if (
      normalized.startsWith('src/services/') ||
      normalized.startsWith('src/validators/') ||
      normalized.startsWith('src/utils/') ||
      normalized.startsWith('src/lib/')
    ) {
      return { level: 1, layer: 'Services' };
    }

    // Level 2: Application Orchestration, Gateways, Workers, Bot & Server Actions
    if (
      normalized.startsWith('src/actions/') ||
      normalized.startsWith('src/app/api/') ||
      normalized.startsWith('src/workers/') ||
      normalized.startsWith('src/bot/')
    ) {
      return { level: 2, layer: 'Application' };
    }

    // Level 3: Presentation, React UI Shell, Hooks, Pages, Tenant Strategies
    if (
      normalized.startsWith('src/components/') ||
      normalized.startsWith('src/hooks/') ||
      normalized.startsWith('src/tenants/') ||
      normalized.startsWith('src/app/')
    ) {
      return { level: 3, layer: 'Presentation' };
    }

    return { level: 1, layer: 'Services' };
  }

  /**
   * Определение DDD Bounded Context
   */
  public determineBoundedContext(relPath: string): BoundedContextType {
    const norm = relPath.replace(/\\/g, '/');

    if (
      norm.includes('/wallet') ||
      norm.includes('/financial') ||
      norm.includes('/billing') ||
      norm.includes('/payment') ||
      norm.includes('/balance') ||
      norm.includes('/treasury')
    ) {
      return 'FINTECH_LEDGER';
    }

    if (
      norm.includes('/order') ||
      norm.includes('/checkout') ||
      norm.includes('/drip') ||
      norm.includes('/basket')
    ) {
      return 'ORDERS_CHECKOUT';
    }

    if (
      norm.includes('/catalog') ||
      norm.includes('/provider') ||
      norm.includes('/analyzer') ||
      norm.includes('/refill') ||
      norm.includes('/taxonomy')
    ) {
      return 'CATALOG_INGESTION';
    }

    if (
      norm.includes('/tenant') ||
      norm.includes('/flux') ||
      norm.includes('/smmplan')
    ) {
      return 'MULTI_TENANT_CORE';
    }

    if (
      norm.includes('/worker') ||
      norm.includes('/bot') ||
      norm.includes('/queue') ||
      norm.includes('/daemon')
    ) {
      return 'ASYNC_DAEMONS';
    }

    return 'CORE_FRAMEWORK';
  }

  /**
   * Рекурсивный поиск файлов в src/
   */
  private getSourceFiles(dir: string): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) return results;

    const list = fs.readdirSync(dir);
    for (const item of list) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        if (!['node_modules', '.next', 'dist', '.git', '__tests__'].includes(item)) {
          results.push(...this.getSourceFiles(fullPath));
        }
      } else if (
        (item.endsWith('.ts') || item.endsWith('.tsx')) &&
        !item.endsWith('.d.ts') &&
        !item.includes('.test.') &&
        !item.includes('.spec.')
      ) {
        results.push(fullPath);
      }
    }
    return results;
  }

  /**
   * Разрешение пути импорта в относительный путь файла внутри проекта
   */
  private resolveImport(sourceFilePath: string, importPath: string): string | null {
    let targetAbs = '';

    if (importPath.startsWith('@/')) {
      targetAbs = path.join(this.srcDir, importPath.slice(2));
    } else if (importPath.startsWith('.')) {
      targetAbs = path.resolve(path.dirname(sourceFilePath), importPath);
    } else {
      return null;
    }

    const candidateExtensions = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];
    for (const ext of candidateExtensions) {
      const candidate = targetAbs + ext;
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return path.relative(this.projectRoot, candidate).replace(/\\/g, '/');
      }
    }

    return null;
  }

  /**
   * Точный расчет Cyclomatic Complexity и CRAP Score для отдельной функции
   */
  private analyzeFunction(
    fnNode: ts.Node,
    sourceFile: ts.SourceFile,
    fileCoverage: number | null
  ): FunctionMetric {
    let complexity = 1;

    const visitComplexity = (node: ts.Node) => {
      switch (node.kind) {
        case ts.SyntaxKind.IfStatement:
        case ts.SyntaxKind.ConditionalExpression: // a ? b : c
        case ts.SyntaxKind.CaseClause:            // case x:
        case ts.SyntaxKind.CatchClause:
        case ts.SyntaxKind.ForStatement:
        case ts.SyntaxKind.ForInStatement:
        case ts.SyntaxKind.ForOfStatement:
        case ts.SyntaxKind.WhileStatement:
        case ts.SyntaxKind.DoStatement:
          complexity++;
          break;

        // Внимание: логические операторы &&, ||, ??
        case ts.SyntaxKind.BinaryExpression: {
          const binExpr = node as ts.BinaryExpression;
          const op = binExpr.operatorToken.kind;
          if (
            op === ts.SyntaxKind.AmpersandAmpersandToken ||
            op === ts.SyntaxKind.BarBarToken ||
            op === ts.SyntaxKind.QuestionQuestionToken
          ) {
            complexity++;
          }
          break;
        }
      }

      // Опциональные цепочки (?.)
      if (
        (ts.isPropertyAccessChain && ts.isPropertyAccessChain(node)) ||
        (ts.isElementAccessChain && ts.isElementAccessChain(node)) ||
        (ts.isCallChain && ts.isCallChain(node))
      ) {
        complexity++;
      }

      ts.forEachChild(node, visitComplexity);
    };

    ts.forEachChild(fnNode, visitComplexity);

    const startLine = sourceFile.getLineAndCharacterOfPosition(fnNode.getStart()).line + 1;
    const endLine = sourceFile.getLineAndCharacterOfPosition(fnNode.getEnd()).line + 1;

    let name = '<anonymous>';
    if (ts.isFunctionDeclaration(fnNode) || ts.isMethodDeclaration(fnNode)) {
      name = fnNode.name?.getText(sourceFile) || '<anonymous>';
    } else if (ts.isVariableDeclaration(fnNode.parent) && ts.isIdentifier(fnNode.parent.name)) {
      name = fnNode.parent.name.getText(sourceFile);
    } else if (ts.isPropertyAssignment(fnNode.parent) && ts.isIdentifier(fnNode.parent.name)) {
      name = fnNode.parent.name.getText(sourceFile);
    }

    // Формула Альберто Савойи и Дяди Боба:
    // CRAP(f) = CC(f)^2 * (1 - cov)^3 + CC(f)
    const effectiveCov = fileCoverage !== null ? fileCoverage : 0; // Worst-case fallback
    const rawCrap = Math.pow(complexity, 2) * Math.pow(1 - effectiveCov, 3) + complexity;
    const crapScore = Math.round(rawCrap * 10) / 10;

    return {
      name,
      startLine,
      endLine,
      cyclomaticComplexity: complexity,
      coverageRatio: fileCoverage,
      crapScore,
      isCrappy: crapScore > 30,
    };
  }

  /**
   * Анализ файла: зависимости, слои, экшены, CC и CRAP score
   */
  public analyzeFile(filePath: string): void {
    const relPath = path.relative(this.projectRoot, filePath).replace(/\\/g, '/');
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const isClientComponent = content.includes("'use client'") || content.includes('"use client"');

    const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
    const { level: sourceLevel, layer: sourceLayer } = this.determineLayer(relPath);
    const boundedContext = this.determineBoundedContext(relPath);

    let exportsCount = 0;
    const functions: FunctionMetric[] = [];
    const coverageEntry = this.coverageData.get(relPath);
    const fileCoverage = coverageEntry ? coverageEntry.linesCov : null;

    const getLine = (node: ts.Node) => {
      return sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    };

    const getSnippet = (node: ts.Node) => {
      const lineIdx = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line;
      return (lines[lineIdx] || '').trim();
    };

    // Обход AST для функций, экспортов и импортов
    const walkNode = (node: ts.Node) => {
      // Подсчет экспортов
      if (
        ts.isExportDeclaration(node) ||
        (ts.isFunctionDeclaration(node) && node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword))
      ) {
        exportsCount++;
      }

      // Извлечение функций
      const isFunction =
        ts.isFunctionDeclaration(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isArrowFunction(node) ||
        ts.isFunctionExpression(node) ||
        ts.isGetAccessor(node) ||
        ts.isSetAccessor(node);

      if (isFunction) {
        const fnMetric = this.analyzeFunction(node, sourceFile, fileCoverage);
        functions.push(fnMetric);
      }

      // Проверка импортов
      if (ts.isImportDeclaration(node)) {
        const importSpecifier = node.moduleSpecifier.getText(sourceFile).replace(/['"]/g, '');

        const isClauseTypeOnly = node.importClause?.isTypeOnly ?? false;
        let isTypeOnly = isClauseTypeOnly;

        if (!isTypeOnly && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
          const elements = node.importClause.namedBindings.elements;
          if (elements.length > 0 && elements.every((el) => el.isTypeOnly)) {
            isTypeOnly = true;
          }
        }

        const line = getLine(node);
        const snippet = getSnippet(node);

        // Проверка: Утечка сервера в клиентский компонент
        if (isClientComponent && !isTypeOnly) {
          const dangerousServerModules = ['@/lib/db', '@prisma/client', 'ioredis', '@/lib/redis'];
          if (dangerousServerModules.includes(importSpecifier) || importSpecifier.endsWith('/db')) {
            this.violations.push({
              id: 'client-server-leak',
              severity: 'BLOCKER',
              sourceFile: relPath,
              targetModule: importSpecifier,
              line,
              message: `Клиентский компонент ('use client') импортирует серверный модуль '${importSpecifier}' во время выполнения!`,
              snippet,
            });
          }
        }

        const resolvedTarget = this.resolveImport(filePath, importSpecifier);
        if (resolvedTarget) {
          const { level: targetLevel, layer: targetLayer } = this.determineLayer(resolvedTarget);

          let isViolating = false;
          let violationReason: string | undefined;

          if (!isTypeOnly) {
            // Level 0 (Domain) строго изолирован
            if (sourceLevel === 0 && targetLevel > 0) {
              isViolating = true;
              violationReason = `Clean Architecture Violation: чистый доменный слой 'Domain' (${relPath}) не имеет права импортировать внешний модуль '${targetLayer}' (${resolvedTarget}).`;
            }
            // Level 1 (Services) не зависит от Application (2) и Presentation (3)
            else if (sourceLevel === 1 && targetLevel > 1) {
              isViolating = true;
              violationReason = `Clean Architecture Violation: бизнес-сервис '${sourceLayer}' (${relPath}) не имеет права зависеть от внешнего слоя '${targetLayer}' (${resolvedTarget}).`;
            }
            // Level 2 (Application / Server Actions) не зависит от Presentation (3)
            else if (sourceLevel === 2 && targetLevel === 3) {
              isViolating = true;
              violationReason = `Clean Architecture Violation: Application модуль (${relPath}) не имеет права импортировать UI представление (${resolvedTarget}).`;
            }

            if (isViolating && violationReason) {
              this.violations.push({
                id: 'clean-architecture-dependency-violation',
                severity: 'BLOCKER',
                sourceFile: relPath,
                targetModule: resolvedTarget,
                line,
                message: violationReason,
                snippet,
              });
            }
          }

          this.edges.push({
            source: relPath,
            target: resolvedTarget,
            kind: isTypeOnly ? 'association' : 'dependency',
            isTypeOnly,
            isViolating,
            violationReason,
          });

          if (!isTypeOnly) {
            if (!this.adjacencyList.has(relPath)) {
              this.adjacencyList.set(relPath, new Set());
            }
            this.adjacencyList.get(relPath)!.add(resolvedTarget);
          }
        }
      }

      ts.forEachChild(node, walkNode);
    };

    ts.forEachChild(sourceFile, walkNode);

    // Агрегация метрик качества
    const maxCC = functions.length > 0 ? Math.max(...functions.map((f) => f.cyclomaticComplexity)) : 1;
    const maxCrap = functions.length > 0 ? Math.max(...functions.map((f) => f.crapScore)) : 1;
    const crappyMethodsCount = functions.filter((f) => f.isCrappy).length;
    const crapLoad = functions.reduce((sum, f) => (f.isCrappy ? sum + (f.crapScore - 30) : sum), 0);

    const sortedRisk = [...functions].sort((a, b) => b.crapScore - a.crapScore).slice(0, 3);

    this.nodes.set(relPath, {
      id: relPath,
      label: path.basename(relPath),
      level: sourceLevel,
      layer: sourceLayer,
      boundedContext,
      linesCount: lines.length,
      isClientComponent,
      exportsCount,
      functionsCount: functions.length,
      maxCyclomaticComplexity: maxCC,
      maxCrapScore: maxCrap,
      crapLoad: Math.round(crapLoad * 10) / 10,
      crappyMethodsCount,
      coverageStatus: fileCoverage !== null ? 'MEASURED' : 'UNMEASURED',
      topRiskFunctions: sortedRisk,
    });
  }

  /**
   * Детекция циклов в графе зависимостей (DFS Cycle Detection)
   */
  public detectCycles(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const pathStack: string[] = [];

    const dfs = (node: string) => {
      visited.add(node);
      recStack.add(node);
      pathStack.push(node);

      const neighbors = this.adjacencyList.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor);
        } else if (recStack.has(neighbor)) {
          const cycleStart = pathStack.indexOf(neighbor);
          if (cycleStart !== -1) {
            cycles.push([...pathStack.slice(cycleStart), neighbor]);
          }
        }
      }

      pathStack.pop();
      recStack.delete(node);
    };

    for (const node of this.adjacencyList.keys()) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    return cycles;
  }

  /**
   * Основной запуск аудита и генерация Topology IR
   */
  public run(): { passed: boolean; ir: ArchitectureGraphIR } {
    console.log('🏛️  [Clean Architecture Guard] Starting AST Dependency & CRAP Audit...\n');

    const files = this.getSourceFiles(this.srcDir);
    console.log(`📦 Analyzing ${files.length} production TypeScript modules in 'src/'...`);

    const startTime = Date.now();
    for (const file of files) {
      this.analyzeFile(file);
    }

    const cycles = this.detectCycles();
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    const blockers = this.violations.filter((v) => v.severity === 'BLOCKER');

    const allNodes = Array.from(this.nodes.values());
    const totalFunctions = allNodes.reduce((sum, n) => sum + n.functionsCount, 0);
    const totalCrappy = allNodes.reduce((sum, n) => sum + n.crappyMethodsCount, 0);
    const totalCrapLoad = Math.round(allNodes.reduce((sum, n) => sum + n.crapLoad, 0) * 10) / 10;

    let highestCrapModule: { id: string; maxCrap: number; maxCC: number } | null = null;
    let highestCrapVal = 0;
    for (const node of allNodes) {
      if (node.maxCrapScore > highestCrapVal) {
        highestCrapVal = node.maxCrapScore;
        highestCrapModule = { id: node.id, maxCrap: node.maxCrapScore, maxCC: node.maxCyclomaticComplexity };
      }
    }

    const ir: ArchitectureGraphIR = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      title: 'OmniSMM Architecture Topology (Uncle Bob Pattern)',
      generatedAt: new Date().toISOString(),
      layers: ARCHITECTURE_LAYERS,
      nodes: allNodes,
      edges: this.edges,
      violations: this.violations,
      cycles,
      metrics: {
        totalFiles: this.nodes.size,
        totalEdges: this.edges.length,
        violationsCount: this.violations.length,
        cyclesCount: cycles.length,
        blockersCount: blockers.length,
        totalFunctions,
        highestCrapModule,
        totalCrappyFunctions: totalCrappy,
        totalCrapLoad: totalCrapLoad,
      },
    };

    // Сохранение артефакта топологии
    const artifactsDir = path.join(this.projectRoot, 'artifacts');
    if (!fs.existsSync(artifactsDir)) {
      fs.mkdirSync(artifactsDir, { recursive: true });
    }
    const outputPath = path.join(artifactsDir, 'architecture-topology.json');
    fs.writeFileSync(outputPath, JSON.stringify(ir, null, 2), 'utf-8');

    console.log(`⏱️  Audit completed in ${elapsed}s.`);
    console.log(`🗺️  Topology IR artifact written to: ${path.relative(this.projectRoot, outputPath)}`);
    console.log('\n📊 Architecture Statistics:');
    console.log(`   - Total Modules:      ${ir.metrics.totalFiles}`);
    console.log(`   - Total Dependencies: ${ir.metrics.totalEdges}`);
    console.log(`   - Layer Violations:    ${ir.metrics.violationsCount} (${blockers.length} blockers)`);
    console.log(`   - Circular Cycles:     ${ir.metrics.cyclesCount}`);
    console.log('\n📈 Quality & CRAP Risk Metrics (Uncle Bob Standard):');
    console.log(`   - Functions Analyzed:  ${ir.metrics.totalFunctions}`);
    console.log(`   - Crappy Functions:    ${ir.metrics.totalCrappyFunctions} (CRAP > 30)`);
    console.log(`   - Total CRAP Load:     ${ir.metrics.totalCrapLoad}`);
    if (highestCrapModule) {
      console.log(`   - Highest Risk File:   ${highestCrapModule.id} (CRAP: ${highestCrapModule.maxCrap}, CC: ${highestCrapModule.maxCC})`);
    }

    // Топ-5 рисковых модулей
    const topRisk = [...allNodes].sort((a, b) => b.maxCrapScore - a.maxCrapScore).slice(0, 5);
    console.log('\n🔥 Top 5 High-Risk Modules by CRAP Score:');
    topRisk.forEach((node, idx) => {
      console.log(`   ${idx + 1}. [${node.layer}] ${node.id}`);
      console.log(`      Lines: ${node.linesCount} | Max CC: ${node.maxCyclomaticComplexity} | Max CRAP: ${node.maxCrapScore} | Crappy Fns: ${node.crappyMethodsCount}`);
      if (node.topRiskFunctions && node.topRiskFunctions.length > 0) {
        const topFn = node.topRiskFunctions[0];
        console.log(`      Worst Function: "${topFn.name}" (line ${topFn.startLine}, CC: ${topFn.cyclomaticComplexity}, CRAP: ${topFn.crapScore})`);
      }
    });

    if (this.violations.length > 0) {
      console.log('\n🔴 Architecture Violations:');
      this.violations.forEach((v, idx) => {
        console.log(`\n[${idx + 1}] 🛑 [${v.severity}] ${v.id}`);
        console.log(`    Source: ${v.sourceFile}:${v.line}`);
        console.log(`    Target: ${v.targetModule}`);
        console.log(`    Reason: ${v.message}`);
        console.log(`    Snippet: "${v.snippet}"`);
      });
    }

    if (cycles.length > 0) {
      console.log('\n⚠️  Circular Dependencies Detected:');
      cycles.slice(0, 5).forEach((c, idx) => {
        console.log(`  Cycle ${idx + 1}: ${c.join(' ➔ ')}`);
      });
      if (cycles.length > 5) {
        console.log(`  ... and ${cycles.length - 5} more cycles.`);
      }
    }

    const passed = blockers.length === 0 && cycles.length === 0;

    if (passed) {
      console.log('\n🟢 [CLEAN ARCHITECTURE PASS] All dependency rules strictly respected!');
    } else {
      console.log('\n🔴 [CLEAN ARCHITECTURE FAIL] Architectural violations must be resolved.');
    }

    return { passed, ir };
  }
}

// Запуск из командной строки
if (process.argv[1]?.includes('check-clean-architecture.ts')) {
  const guard = new CleanArchitectureGuard();
  const { passed } = guard.run();
  if (!passed) {
    process.exit(1);
  }
}
