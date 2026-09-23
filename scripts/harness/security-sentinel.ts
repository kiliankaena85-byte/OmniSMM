#!/usr/bin/env node
/**
 * 🛡️ ANTIGRAVITY SECURITY SENTINEL HARNESS v3.0 (Full-Coverage Zero-Trust Engine)
 * 
 * Deep Improve over v2.0 — fixes 5 proven blind spots:
 *  1. Arrow Function + Function Expression detection (BLIND-01)
 *  2. API Route Handler auth verification (BLIND-02 → SEC-API-001)
 *  3. Destructured IDOR detection from parsed.data / formData.get (BLIND-03)
 *  4. Coverage metric — tracks checked vs total exported functions (SEC-META-001)
 *  5. All original v2.0 rules preserved (SEC-FIN-001/002, SEC-INJ-001, SEC-AUTH-001, SEC-IDOR-001, SEC-VAL-001)
 */

import * as fs from 'fs';
import * as path from 'path';
import ts from 'typescript';
import { SmmplanMemoryClient } from '../memory-client';

const memoryClient = new SmmplanMemoryClient();

export interface SecurityFinding {
  ruleId: string;
  category: 'AUTH' | 'IDOR' | 'FINANCE' | 'INJECTION' | 'VALIDATION' | 'TENANT' | 'META';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  title: string;
  description: string;
  filePath: string;
  line: number;
  snippet?: string;
  remediation: string;
}

export interface SecurityAuditReport {
  targetPath: string;
  timestamp: string;
  filesScanned: number;
  score: number; // 0..100
  findings: SecurityFinding[];
  coverage: {
    totalExportedFunctions: number;
    checkedFunctions: number;
    coveragePercent: number;
  };
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    passedRules: number;
  };
}

// ============================================================================
// Shared auth guard patterns used across Server Actions and API Routes
// ============================================================================
const AUTH_GUARD_PATTERNS = [
  'verifySession', 'requireAdmin', 'requireStaffPermission',
  'requireOwnerPermission', 'requireRole', 'requireOperatorPermission',
  'authGuard', 'jwtVerify', 'verifyAPIKey', 'decryptSessionToken',
  'enforcePageRole', 'enforceSectionAccess',
];

const API_AUTH_PATTERNS = [
  ...AUTH_GUARD_PATTERNS,
  'timingSafeEqual',        // HMAC signature verification (webhooks)
  'CRON_SECRET',            // Cron job bearer token
  'INTERNAL_API_SECRET',    // Internal API bearer token
  'WEBHOOK_SECRET',         // Generic webhook secret
  'YOOKASSA_WEBHOOK_SECRET',
  'VEXBOOST_WEBHOOK_SECRET',
];

const DEV_GUARD_PATTERNS = [
  "process.env.NODE_ENV === 'production'",
  'process.env.NODE_ENV === "production"',
  'ENABLE_DEV_ROUTES',
];

const IDOR_PARAM_NAMES = ['userId', 'targetUserId', 'targetId', 'user_id'];

// ============================================================================
// Main Scanner Class
// ============================================================================
export class SecuritySentinelScannerV3 {
  private projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  /**
   * In-memory AST audit of raw TypeScript source code (for PoV tests).
   * Creates a virtual source file without touching the filesystem.
   */
  public auditSource(source: string, virtualPath: string): SecurityFinding[] {
    const sourceFile = ts.createSourceFile(
      virtualPath,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );
    return this._auditSourceFile(sourceFile, source, virtualPath);
  }

  /**
   * Глубокий AST аудит одного файла TypeScript
   */
  public auditFile(filePath: string): SecurityFinding[] {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.projectRoot, filePath);
    if (!fs.existsSync(fullPath)) return [];

    const content = fs.readFileSync(fullPath, 'utf-8');
    const relPath = path.relative(this.projectRoot, fullPath);
    const sourceFile = ts.createSourceFile(
      fullPath,
      content,
      ts.ScriptTarget.Latest,
      true,
      filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );

    return this._auditSourceFile(sourceFile, content, relPath);
  }

  /**
   * Core audit logic — works on any SourceFile (disk or in-memory)
   */
  private _auditSourceFile(sourceFile: ts.SourceFile, content: string, rawRelPath: string): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const lines = content.split('\n');

    // Uniformly normalize path to handle both Windows (\) and POSIX (/)
    const relPath = path.normalize(rawRelPath);
    const normalizedPosixPath = relPath.replace(/\\/g, '/');

    const isServerActionFile = normalizedPosixPath.startsWith('src/actions/') ||
      content.includes('"use server"') || content.includes("'use server'");
    const isServiceFile = normalizedPosixPath.startsWith('src/services/');
    const isApiRouteFile = normalizedPosixPath.startsWith('src/app/api/');
    const isDevRoute = normalizedPosixPath.includes('/api/dev/');
    const isTestFile = normalizedPosixPath.includes('__tests__') || normalizedPosixPath.includes('.test.') || normalizedPosixPath.includes('.spec.');

    const getLine = (node: ts.Node): number => {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      return line + 1;
    };

    const getSnippet = (lineNum: number): string | undefined => {
      return lines[lineNum - 1]?.trim();
    };

    const visit = (node: ts.Node) => {
      // =====================================================================
      // 1. [SEC-FIN-001] Прямая мутация User.balance в обход WalletOps
      // =====================================================================
      if (ts.isPropertyAssignment(node)) {
        const propName = node.name.getText(sourceFile);
        if (propName === 'balance' || propName === '"balance"') {
          let parent: ts.Node | undefined = node.parent;
          while (parent) {
            if (ts.isCallExpression(parent)) {
              const callText = parent.expression.getText(sourceFile);
              if (
                (callText.includes('user.update') || callText.includes('user.updateMany')) &&
                !normalizedPosixPath.includes('wallet-ops.ts') &&
                !normalizedPosixPath.includes('wallet.service.ts') &&
                !normalizedPosixPath.includes('ledger-reconciliation.service.ts') &&
                !normalizedPosixPath.includes('seed') &&
                !isTestFile
              ) {
                const line = getLine(node);
                findings.push({
                  ruleId: 'SEC-FIN-001',
                  category: 'FINANCE',
                  severity: 'CRITICAL',
                  title: 'Прямая мутация User.balance в обход WalletOps',
                  description: 'Обнаружено прямое обновление User.balance через Prisma update.',
                  filePath: relPath,
                  line,
                  snippet: getSnippet(line),
                  remediation: 'Замените на WalletOps.credit() или WalletOps.debit() с уникальным idempotencyKey.',
                });
              }
            }
            parent = parent.parent;
          }
        }
      }

      // =====================================================================
      // 2. [SEC-INJ-001] Непараметризованный raw SQL ($queryRawUnsafe)
      // =====================================================================
      if (ts.isCallExpression(node)) {
        const callText = node.expression.getText(sourceFile);
        if (callText.includes('$queryRawUnsafe') || callText.includes('$executeRawUnsafe')) {
          if (!isTestFile && !normalizedPosixPath.includes('setup.ts')) {
            const line = getLine(node);
            findings.push({
              ruleId: 'SEC-INJ-001',
              category: 'INJECTION',
              severity: 'CRITICAL',
              title: 'Использование непараметризованного raw SQL ($queryRawUnsafe)',
              description: 'Вызов $queryRawUnsafe создает критический риск SQL-инъекций.',
              filePath: relPath,
              line,
              snippet: getSnippet(line),
              remediation: 'Замените на db.$queryRaw`SELECT ... ${variable}` с параметризацией.',
            });
          }
        }
      }

      // =====================================================================
      // 3. SERVER ACTIONS: FunctionDeclaration (original v2.0 logic)
      // =====================================================================
      if (isServerActionFile && ts.isFunctionDeclaration(node) &&
          node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
        const fnName = node.name ? node.name.getText(sourceFile) : 'anonymous';
        const fnBody = node.body ? node.body.getText(sourceFile) : '';
        const params = node.parameters;
        const paramsText = params.map(p => p.name.getText(sourceFile)).join(', ');
        const jsDocNode: ts.Node = node;
        this._auditServerActionFunction(findings, sourceFile, relPath, fnName, fnBody, params, paramsText, jsDocNode, isTestFile, lines);
      }

      // =====================================================================
      // 4. SERVER ACTIONS: Arrow Functions / Function Expressions (BLIND-01 FIX)
      //    Handles: export const foo = async (...) => { ... }
      // =====================================================================
      if (isServerActionFile && ts.isVariableStatement(node)) {
        const isExported = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
        if (isExported) {
          for (const decl of node.declarationList.declarations) {
            const init = decl.initializer;
            if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
              const fnName = ts.isIdentifier(decl.name) ? decl.name.getText(sourceFile) : 'anonymous';
              const fnBody = init.body ? init.body.getText(sourceFile) : '';
              const params = init.parameters;
              const paramsText = params.map(p => p.name.getText(sourceFile)).join(', ');
              // JSDoc may be attached to the VariableStatement, not the function itself
              const jsDocNode: ts.Node = node;
              this._auditServerActionFunction(findings, sourceFile, relPath, fnName, fnBody, params, paramsText, jsDocNode, isTestFile, lines);
            }
          }
        }
      }

      // =====================================================================
      // 5. API ROUTE HANDLERS: SEC-API-001 (BLIND-02 FIX)
      //    Checks exported GET/POST/PUT/DELETE/PATCH in src/app/api/
      // =====================================================================
      if (isApiRouteFile && ts.isFunctionDeclaration(node) &&
          node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
        const fnName = node.name ? node.name.getText(sourceFile) : '';
        const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
        if (httpMethods.includes(fnName)) {
          const fnBody = node.body ? node.body.getText(sourceFile) : '';
          this._auditApiRouteHandler(findings, sourceFile, relPath, fnName, fnBody, isDevRoute, isTestFile, lines, node);
        }
      }

      // =====================================================================
      // 6. [SEC-FIN-002] Проверка уровня изоляции транзакций в сервисах
      // =====================================================================
      if (isServiceFile && ts.isCallExpression(node)) {
        const callText = node.expression.getText(sourceFile);
        if (callText === 'db.$transaction' || callText === 'prisma.$transaction') {
          const fullCallCode = node.getText(sourceFile);
          const isFinancialService = normalizedPosixPath.includes('wallet') || normalizedPosixPath.includes('ledger') ||
            normalizedPosixPath.includes('order') || normalizedPosixPath.includes('escrow') || normalizedPosixPath.includes('financial');

          if (isFinancialService && !fullCallCode.includes('Serializable') && !isTestFile) {
            const line = getLine(node);
            findings.push({
              ruleId: 'SEC-FIN-002',
              category: 'FINANCE',
              severity: 'HIGH',
              title: 'Финансовая транзакция без Serializable изоляции (Риск Race Condition)',
              description: 'Транзакция в финансовом сервисе не указывает Serializable изоляцию.',
              filePath: relPath,
              line,
              snippet: getSnippet(line),
              remediation: 'Добавьте: { isolationLevel: "Serializable", timeout: 15000 }',
            });
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return findings;
  }

  /**
   * Shared logic for auditing a Server Action function (FunctionDeclaration or ArrowFunction).
   * Applies SEC-AUTH-001, SEC-IDOR-001, SEC-IDOR-002, SEC-VAL-001.
   */
  private _auditServerActionFunction(
    findings: SecurityFinding[],
    sourceFile: ts.SourceFile,
    relPath: string,
    fnName: string,
    fnBody: string,
    params: ts.NodeArray<ts.ParameterDeclaration>,
    paramsText: string,
    jsDocNode: ts.Node,
    isTestFile: boolean,
    lines: string[]
  ): void {
    if (isTestFile) return;

    const getLine = (node: ts.Node): number => {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      return line + 1;
    };
    const line = getLine(jsDocNode);
    const snippet = lines[line - 1]?.trim();

    // Check for @public / @guest JSDoc annotation
    const jsDoc = ts.getJSDocCommentsAndTags(jsDocNode);
    const hasExplicitPublicTag = jsDoc.some(doc => {
      const t = doc.getText();
      return t.includes('@public') || t.includes('@guest') || t.includes('@unprotected');
    });

    const hasAuthGuard = AUTH_GUARD_PATTERNS.some(pattern => fnBody.includes(pattern));

    // --- SEC-AUTH-001: Missing auth guard ---
    if (!hasAuthGuard && !hasExplicitPublicTag) {
      findings.push({
        ruleId: 'SEC-AUTH-001',
        category: 'AUTH',
        severity: 'CRITICAL',
        title: `Server Action "${fnName}" без проверки прав доступа`,
        description: `Функция "${fnName}" экспортирована из файла Server Actions, но не имеет ни Auth Guard, ни аннотации /** @public */.`,
        filePath: relPath,
        line,
        snippet,
        remediation: 'Добавьте `const session = await verifySession();` или `/** @public */`.',
      });
    }

    // --- SEC-IDOR-001: Direct userId parameter without ownership check ---
    const hasDirectUserIdParam = IDOR_PARAM_NAMES.some(name =>
      paramsText.includes(name)
    );
    const isAdminAction = fnBody.includes('requireAdmin') ||
      fnBody.includes('requireStaffPermission') ||
      fnBody.includes('requireOwnerPermission') ||
      fnBody.includes('requireOperatorPermission') ||
      fnBody.includes('requireRole');
    const hasSessionMatchCheck = fnBody.includes('=== session.userId') ||
      fnBody.includes('=== session?.userId') ||
      fnBody.includes('!== session.userId') ||
      fnBody.includes('!== session?.userId');

    if (hasDirectUserIdParam && !isAdminAction && hasAuthGuard && !hasSessionMatchCheck && !hasExplicitPublicTag) {
      findings.push({
        ruleId: 'SEC-IDOR-001',
        category: 'IDOR',
        severity: 'CRITICAL',
        title: `Потенциальный IDOR в "${fnName}": клиентский userId без проверки владения`,
        description: `Функция принимает параметр "${paramsText}", но не проверяет userId === session.userId и не требует прав администратора.`,
        filePath: relPath,
        line,
        snippet,
        remediation: 'Используйте session.userId напрямую. Не принимайте userId от клиента.',
      });
    }

    // --- SEC-IDOR-002: Destructured userId from data/input/formData (BLIND-03 FIX) ---
    if (!hasDirectUserIdParam && hasAuthGuard && !isAdminAction && !hasExplicitPublicTag) {
      const hasDestructuredUserId =
        // Pattern 1: const { userId } = parsed.data; or const { userId } = data;
        /\{\s*(?:\w+\s*,\s*)*userId(?:\s*,\s*\w+)*\s*\}\s*=/.test(fnBody) ||
        // Pattern 2: parsed.data.userId or data.userId
        /(?:parsed\.data|data|input)\.userId/.test(fnBody) ||
        // Pattern 3: formData.get("userId") or formData.get('userId')
        /formData\.get\s*\(\s*['"]userId['"]\s*\)/.test(fnBody);

      if (hasDestructuredUserId && !hasSessionMatchCheck) {
        findings.push({
          ruleId: 'SEC-IDOR-002',
          category: 'IDOR',
          severity: 'HIGH',
          title: `Destructured userId в "${fnName}" без проверки владения`,
          description: `Функция извлекает userId из деструктурированного объекта (data/input/formData), но не проверяет userId === session.userId и не требует прав администратора.`,
          filePath: relPath,
          line,
          snippet,
          remediation: 'Если это админ-действие, добавьте requireAdmin(). Если пользовательское — используйте session.userId.',
        });
      }
    }

    // --- SEC-VAL-001: Missing Zod validation ---
    if (params.length > 0 && !hasExplicitPublicTag) {
      const hasZodValidation = fnBody.includes('.parse(') ||
        fnBody.includes('.safeParse(') ||
        fnBody.includes('zod') ||
        fnBody.includes('Schema') ||
        fnBody.includes('createSafeAction');

      const isComplexInput = paramsText.includes('data') || paramsText.includes('formData') ||
        paramsText.includes('input') || paramsText.includes('params');

      if (isComplexInput && !hasZodValidation && !fnBody.includes('typeof ')) {
        findings.push({
          ruleId: 'SEC-VAL-001',
          category: 'VALIDATION',
          severity: 'HIGH',
          title: `Отсутствие Zod-валидации входных данных в "${fnName}"`,
          description: `Server Action принимает сложный объект (${paramsText}), но не использует Zod safeParse/parse.`,
          filePath: relPath,
          line,
          snippet,
          remediation: 'Валидируйте: `const parsed = schema.safeParse(input); if (!parsed.success) ...`',
        });
      }
    }
  }

  /**
   * Audit an API Route Handler for authentication (SEC-API-001).
   * Checks exported GET/POST/PUT/DELETE/PATCH functions in src/app/api/.
   */
  private _auditApiRouteHandler(
    findings: SecurityFinding[],
    sourceFile: ts.SourceFile,
    relPath: string,
    fnName: string,
    fnBody: string,
    isDevRoute: boolean,
    isTestFile: boolean,
    lines: string[],
    node: ts.Node
  ): void {
    if (isTestFile) return;

    const getLine = (n: ts.Node): number => {
      const { line } = sourceFile.getLineAndCharacterOfPosition(n.getStart(sourceFile));
      return line + 1;
    };
    const line = getLine(node);
    const snippet = lines[line - 1]?.trim();

    // Check JSDoc @public
    const jsDoc = ts.getJSDocCommentsAndTags(node);
    const hasExplicitPublicTag = jsDoc.some(doc => {
      const t = doc.getText();
      return t.includes('@public') || t.includes('@guest') || t.includes('@unprotected');
    });

    if (hasExplicitPublicTag) return;

    // Intentionally public endpoints (health, logout, auth verify, maintenance, draft disable)
    const normalizedRelPath = relPath.replace(/\\/g, '/');
    const intentionallyPublicPaths = [
      'health', 'logout', 'verify', 'maintenance-status', 'og',
    ];
    if (intentionallyPublicPaths.some(p => normalizedRelPath.includes(`/api/${p}/`) || normalizedRelPath.includes(`/api/${p}`) || normalizedRelPath.includes(`/api/auth/${p}/`))) return;
    // draft/disable is a known public endpoint
    if (normalizedRelPath.includes('/api/draft/disable/')) return;

    // Dev routes — check for NODE_ENV guard
    if (isDevRoute) {
      const hasDevGuard = DEV_GUARD_PATTERNS.some(p => fnBody.includes(p));
      if (!hasDevGuard) {
        findings.push({
          ruleId: 'SEC-API-002',
          category: 'AUTH',
          severity: 'CRITICAL',
          title: `Dev route "${relPath}" ${fnName}() без NODE_ENV guard`,
          description: 'Dev-only эндпоинт доступен в production без проверки NODE_ENV.',
          filePath: relPath,
          line,
          snippet,
          remediation: "Добавьте: if (process.env.NODE_ENV === 'production') return new Response('Not Found', { status: 404 });",
        });
      }
      return; // Dev routes don't need session auth
    }

    // Webhook routes — check for signature verification
    if (normalizedRelPath.includes('webhook')) {
      const hasSignatureVerification = API_AUTH_PATTERNS.some(p => fnBody.includes(p));
      if (!hasSignatureVerification) {
        findings.push({
          ruleId: 'SEC-API-003',
          category: 'AUTH',
          severity: 'CRITICAL',
          title: `Webhook "${relPath}" ${fnName}() без верификации подписи`,
          description: 'Webhook-эндпоинт не проверяет HMAC-подпись или секретный токен.',
          filePath: relPath,
          line,
          snippet,
          remediation: 'Добавьте проверку подписи через timingSafeEqual или секретный Bearer-токен.',
        });
      }
      return; // Webhooks use signature auth, not session auth
    }

    // Cron routes — check for CRON_SECRET
    if (normalizedRelPath.includes('/cron/')) {
      const hasCronAuth = fnBody.includes('CRON_SECRET') || fnBody.includes('timingSafeEqual');
      if (!hasCronAuth) {
        findings.push({
          ruleId: 'SEC-API-004',
          category: 'AUTH',
          severity: 'HIGH',
          title: `Cron route "${relPath}" ${fnName}() без CRON_SECRET проверки`,
          description: 'Cron-эндпоинт не проверяет Bearer-токен CRON_SECRET.',
          filePath: relPath,
          line,
          snippet,
          remediation: 'Добавьте проверку: Bearer ${CRON_SECRET} через timingSafeEqual.',
        });
      }
      return;
    }

    // Regular API routes — check for session/auth
    const hasAnyAuth = API_AUTH_PATTERNS.some(p => fnBody.includes(p));
    if (!hasAnyAuth) {
      // Check if it's a rate-limited public endpoint (intentionally unauthenticated)
      const isRateLimited = fnBody.includes('RateLimitService') || fnBody.includes('rateLimit');
      const severity = isRateLimited ? 'MEDIUM' as const : 'HIGH' as const;

      findings.push({
        ruleId: 'SEC-API-001',
        category: 'AUTH',
        severity,
        title: `API route "${relPath}" ${fnName}() без аутентификации`,
        description: `Обработчик ${fnName}() в API route не содержит проверки сессии, JWT, или API-ключа.${isRateLimited ? ' (Rate limiting присутствует)' : ''}`,
        filePath: relPath,
        line,
        snippet,
        remediation: 'Добавьте verifySession(), jwtVerify(), или пометьте /** @public */ если эндпоинт намеренно открыт.',
      });
    }
  }

  /**
   * Полный аудит всей кодовой базы
   */
  public auditAll(): SecurityAuditReport {
    const targetDirs = [
      path.join(this.projectRoot, 'src/actions'),
      path.join(this.projectRoot, 'src/app/api'),
      path.join(this.projectRoot, 'src/services'),
    ];

    const allFiles: string[] = [];

    const collectFiles = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== '__tests__') {
          collectFiles(full);
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
          allFiles.push(full);
        }
      }
    };

    targetDirs.forEach(collectFiles);

    // Count total exported functions for coverage metric
    let totalExportedFunctions = 0;
    let checkedFunctions = 0;

    const allFindings: SecurityFinding[] = [];
    for (const file of allFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const relPath = path.relative(this.projectRoot, file);
      const isServerActionFile = relPath.startsWith(path.normalize('src/actions/')) ||
        content.includes('"use server"') || content.includes("'use server'");
      const isApiRouteFile = relPath.startsWith(path.normalize('src/app/api/'));

      // Count exported functions for coverage tracking
      const sourceFile = ts.createSourceFile(
        file,
        content,
        ts.ScriptTarget.Latest,
        true,
        file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
      );
      const countExports = (node: ts.Node) => {
        if (ts.isFunctionDeclaration(node) && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
          totalExportedFunctions++;
          const name = node.name?.getText(sourceFile) || '';
          if (isServerActionFile || (isApiRouteFile && ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(name))) {
            checkedFunctions++;
          }
        }
        if (ts.isVariableStatement(node) && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
          for (const decl of node.declarationList.declarations) {
            const init = decl.initializer;
            if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
              totalExportedFunctions++;
              if (isServerActionFile) {
                checkedFunctions++;
              }
            }
          }
        }
        ts.forEachChild(node, countExports);
      };
      countExports(sourceFile);

      const findings = this.auditFile(file);
      allFindings.push(...findings);
    }

    const critical = allFindings.filter(f => f.severity === 'CRITICAL').length;
    const high = allFindings.filter(f => f.severity === 'HIGH').length;
    const medium = allFindings.filter(f => f.severity === 'MEDIUM').length;
    const low = allFindings.filter(f => f.severity === 'LOW').length;

    const penalty = critical * 25 + high * 10 + medium * 3 + low * 1;
    const score = Math.max(0, 100 - penalty);

    const coveragePercent = totalExportedFunctions > 0
      ? Math.round((checkedFunctions / totalExportedFunctions) * 100)
      : 100;

    return {
      targetPath: 'src/(actions|api|services)',
      timestamp: new Date().toISOString(),
      filesScanned: allFiles.length,
      score,
      findings: allFindings,
      coverage: {
        totalExportedFunctions,
        checkedFunctions,
        coveragePercent,
      },
      summary: {
        critical,
        high,
        medium,
        low,
        passedRules: Math.max(0, 10 - allFindings.length),
      }
    };
  }
}

// Also export v2 alias for backward compatibility
export { SecuritySentinelScannerV3 as SecuritySentinelScannerV2 };

// ============================================================================
// CLI Runner
// ============================================================================
if (process.argv[1]?.endsWith('security-sentinel.ts')) {
  const scanner = new SecuritySentinelScannerV3();
  const args = process.argv.slice(2);
  const target = args[0] || 'all';

  console.log('\n==================================================================');
  console.log('🛡️  ANTIGRAVITY SECURITY SENTINEL HARNESS v3.0 (Full-Coverage Zero-Trust)');
  console.log('==================================================================\n');

  if (target === 'all' || target === 'scan') {
    console.log('🔍 Запуск глубокого AST сканирования кодовой базы...\n');
    const report = scanner.auditAll();

    console.log(`📦 Просканировано файлов: ${report.filesScanned}`);
    console.log(`📊 РЕАЛЬНЫЙ ИНДЕКС БЕЗОПАСНОСТИ: ${report.score} / 100`);
    console.log(`🔬 ПОКРЫТИЕ: ${report.coverage.checkedFunctions} / ${report.coverage.totalExportedFunctions} функций (${report.coverage.coveragePercent}%)\n`);

    if (report.findings.length === 0) {
      console.log('✅ КРИТИЧЕСКИХ УЯЗВИМОСТЕЙ НЕ ОБНАРУЖЕНО!');
    } else {
      console.log(`⚠️  ОБНАРУЖЕНО ${report.findings.length} ЗАМЕЧАНИЙ БЕЗОПАСНОСТИ:\n`);
      report.findings.forEach((f, idx) => {
        const icon = f.severity === 'CRITICAL' ? '🔴' : f.severity === 'HIGH' ? '🟠' : f.severity === 'MEDIUM' ? '🟡' : '⚪';
        console.log(`${idx + 1}. ${icon} [${f.ruleId}] [${f.category}] ${f.title}`);
        console.log(`   Файл: ${f.filePath}:${f.line}`);
        if (f.snippet) console.log(`   Код:  ${f.snippet}`);
        console.log(`   Fix:  ${f.remediation}\n`);
      });
    }

    console.log('------------------------------------------------------------------');
    console.log(`• Critical: ${report.summary.critical} | High: ${report.summary.high} | Medium: ${report.summary.medium} | Low: ${report.summary.low}`);
    console.log('==================================================================\n');

    // Sync with GraphRAG
    if (report.findings.length > 0) {
      memoryClient.recordDecision({
        title: `Security Sentinel v3 Audit: ${report.findings.length} findings (Score: ${report.score}/100)`,
        context: 'Full-coverage audit: arrow functions, API routes, destructured IDOR',
        decision: `Выявлены риски: ${Array.from(new Set(report.findings.map(f => f.ruleId))).join(', ')}`,
        rationale: 'v3.0 Deep Improve: закрыты 5 слепых зон v2.0',
        tags: ['security', 'v3', 'full-coverage', 'audit', 'sentinel']
      }).catch(() => {});
    }
  } else {
    console.log(`🔍 Аудит файла: ${target}\n`);
    const findings = scanner.auditFile(target);
    if (findings.length === 0) {
      console.log('✅ Файл полностью чист. Нарушений политик безопасности не обнаружено.');
    } else {
      findings.forEach((f, idx) => {
        const icon = f.severity === 'CRITICAL' ? '🔴' : f.severity === 'HIGH' ? '🟠' : '🟡';
        console.log(`${idx + 1}. [${f.ruleId}] ${f.title} (line ${f.line})`);
        console.log(`   Fix: ${f.remediation}`);
      });
    }
  }
}
