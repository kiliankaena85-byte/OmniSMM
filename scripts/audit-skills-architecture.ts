#!/usr/bin/env node
/**
 * audit-skills-architecture.ts
 * 
 * Нативный TypeScript-валидатор архитектурных стандартов Agent Skills платформы OmniSMM 1.0.
 * Построен по каноническому стандарту Claude / Anthropic Agent Skills & OmniSMM Architecture Suite:
 * - Проверяет YAML Frontmatter (name, description, trigger phrases, boundaries, semver).
 * - Контролирует 6 канонических секций Anthropic/Claude (Overview, Decision Tree, Hard Invariants, Protocol, Anti-patterns, Verification).
 * - Проверяет гигиену: отсутствие локальных абсолютных путей разработчика, валидность относительных ссылок.
 * - Проверяет L1/L2 контракт: наличие ультра-компактного CORE.md (<= 65 строк) для архитектурных скилов.
 * - Вычисляет интегральный Health Score (0-100) и грейды A/B/C/D/F.
 */

import fs from 'fs';
import path from 'path';
import YAML from 'yaml';

export type RuleSeverity = 'CRITICAL' | 'ERROR' | 'WARNING' | 'INFO';

export interface SkillIssue {
  ruleId: string;
  category: 'Frontmatter' | 'Structure' | 'Hygiene' | 'L1_Core';
  severity: RuleSeverity;
  message: string;
  file: string;
  line?: number;
  fixSuggestion?: string;
}

export interface SkillAuditResult {
  skillName: string;
  dirPath: string;
  skillMdPath: string;
  hasCoreMd: boolean;
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  isArchTier: boolean;
  issues: SkillIssue[];
  metrics: {
    totalChars: number;
    totalLines: number;
    coreLines?: number;
    descriptionChars: number;
    sectionsCount: number;
  };
}

export const ARCH_TIER_SKILLS = new Set([
  'arch-boundary-guard',
  'ddd-aggregate-invariants',
  'catalog-taxonomy-curator',
  'provider-catalog-importer',
  'adr-architect',
  'concurrency-acid-guard',
  'bank-grade-db-guard',
  'db-evolution-zero-downtime',
  'event-driven-reliability',
  'resilience-bulkhead-circuit',
  'multi-tenant-isolation-arch',
  'api-contract-evolver',
  'impact-blast-radius',
  'nfr-performance-budget',
  'production-readiness-guard',
  'maker-checker-protocol',
  'multi-model-jury',
  'llm-mutation-testing',
  'ephemeral-sandbox-visual-loop',
  'layout-overflow-sentry',
  'self-healing-ooda-loop',
  'docker-memory-ops',
  'clash-verge-atomics',
  'docker-lean-build-ops',
  'competitor-threat-shield',
  'owasp-asvs-sentinel',
  'local-pentest-orchestrator',
  'payment-gateway-fuzzer',
  'postgres-query-doctor',
  'compliance-54fz-auditor',
  'compliance-legal-ecommerce-ru',
  'ui-theme-architect',
  'google-stitch-architect',
  'wireframe-nanobanana-stitch',
  'foolproof-minimalist-ux',
  'heroui-v3-compound-guard',
  'react-19-next-16-ui-engine',
  'client-hydration-perf-guard',
  'viewport-responsive-density',
  'mobile-cro-interaction',
  'mobile-first-responsive-architect',
  'omnismm-checkout-integrity-guard',
  'skill-architecture-guard',
  'skill-health-checker'
]);

export class SkillArchitectureAuditor {
  private projectRoot: string;
  private skillsDir: string;

  constructor(projectRoot = process.cwd(), skillsDir?: string) {
    this.projectRoot = projectRoot;
    this.skillsDir = skillsDir || path.resolve(projectRoot, '.agents', 'skills');
  }

  /**
   * Проверка одного скилла
   */
  public auditSkill(skillDirPath: string): SkillAuditResult {
    const dirName = path.basename(skillDirPath);
    const skillMdPath = path.join(skillDirPath, 'SKILL.md');
    const coreMdPath = path.join(skillDirPath, 'CORE.md');
    const isArchTier = ARCH_TIER_SKILLS.has(dirName);
    const hasCoreMd = fs.existsSync(coreMdPath);

    const issues: SkillIssue[] = [];

    if (!fs.existsSync(skillMdPath)) {
      return {
        skillName: dirName,
        dirPath: skillDirPath,
        skillMdPath,
        hasCoreMd,
        score: 0,
        grade: 'F',
        isArchTier,
        issues: [
          {
            ruleId: 'FM-001',
            category: 'Frontmatter',
            severity: 'CRITICAL',
            message: `Файл SKILL.md отсутствует в директории: ${skillDirPath}`,
            file: skillMdPath
          }
        ],
        metrics: {
          totalChars: 0,
          totalLines: 0,
          descriptionChars: 0,
          sectionsCount: 0
        }
      };
    }

    const content = fs.readFileSync(skillMdPath, 'utf-8');
    const lines = content.split(/\r?\n/);
    const totalChars = content.length;
    const totalLines = lines.length;

    // -------------------------------------------------------------
    // 1. FRONTMATTER VALIDATION (FM)
    // -------------------------------------------------------------
    const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    let frontmatter: any = null;
    let descriptionText = '';

    if (!fmMatch) {
      issues.push({
        ruleId: 'FM-001',
        category: 'Frontmatter',
        severity: 'CRITICAL',
        message: 'Файл SKILL.md обязан начинаться с валидного YAML Frontmatter (закрытого ---).',
        file: skillMdPath,
        line: 1,
        fixSuggestion: 'Добавьте блок ---\nname: <dir-name>\ndescription: ...\n--- в начало файла.'
      });
    } else {
      const rawYaml = fmMatch[1];
      try {
        frontmatter = YAML.parse(rawYaml);
        if (!frontmatter || typeof frontmatter !== 'object') {
          issues.push({
            ruleId: 'FM-001',
            category: 'Frontmatter',
            severity: 'CRITICAL',
            message: 'YAML frontmatter не является объектом.',
            file: skillMdPath,
            line: 1
          });
        }
      } catch (err: any) {
        issues.push({
          ruleId: 'FM-001',
          category: 'Frontmatter',
          severity: 'CRITICAL',
          message: `Ошибка парсинга YAML frontmatter: ${err.message}`,
          file: skillMdPath,
          line: 1
        });
      }
    }

    if (frontmatter) {
      // FM-002: name field
      const name = frontmatter.name ? String(frontmatter.name).trim() : '';
      if (!name) {
        issues.push({
          ruleId: 'FM-002',
          category: 'Frontmatter',
          severity: 'CRITICAL',
          message: 'Поле "name" отсутствует или пусто в YAML frontmatter.',
          file: skillMdPath,
          line: 2
        });
      } else {
        if (!/^[a-z0-9-]+$/.test(name)) {
          issues.push({
            ruleId: 'FM-002',
            category: 'Frontmatter',
            severity: 'ERROR',
            message: `Поле "name" ('${name}') должно быть строго в формате kebab-case (^[a-z0-9-]+$).`,
            file: skillMdPath,
            line: 2
          });
        }
        // FM-003: name matches directory
        if (name !== dirName) {
          issues.push({
            ruleId: 'FM-003',
            category: 'Frontmatter',
            severity: 'CRITICAL',
            message: `Поле "name" ('${name}') не совпадает с именем папки ('${dirName}'). Роутер Claude/Antigravity не сможет его вызвать.`,
            file: skillMdPath,
            line: 2,
            fixSuggestion: `Замените name на: "${dirName}"`
          });
        }
      }

      // FM-004: description field
      descriptionText = frontmatter.description ? String(frontmatter.description).trim() : '';
      if (!descriptionText) {
        issues.push({
          ruleId: 'FM-004',
          category: 'Frontmatter',
          severity: 'CRITICAL',
          message: 'Поле "description" отсутствует или пусто. Без описания агент не сможет обнаружить скилл.',
          file: skillMdPath,
          line: 3
        });
      } else {
        const descLen = descriptionText.length;
        // FM-007: length
        if (descLen < 50) {
          issues.push({
            ruleId: 'FM-007',
            category: 'Frontmatter',
            severity: 'WARNING',
            message: `Поле "description" слишком короткое (${descLen} симв.). Опишите назначение и триггеры (минимум 50 симв.).`,
            file: skillMdPath
          });
        } else if (descLen > 750) {
          issues.push({
            ruleId: 'FM-007',
            category: 'Frontmatter',
            severity: 'WARNING',
            message: `Поле "description" слишком длинное (${descLen} симв. > 750). Это перегружает системный контекст. Сократите до ключевой сути.`,
            file: skillMdPath
          });
        }

        // FM-005: Trigger phrases
        const hasTriggers = /(когда|при|триггер|use when|trigger|activat|always activate|when the user|используй|применяй)/i.test(descriptionText);
        if (!hasTriggers) {
          issues.push({
            ruleId: 'FM-005',
            category: 'Frontmatter',
            severity: 'WARNING',
            message: 'Поле "description" не содержит явных триггеров активации ("Используй когда...", "Use when...").',
            file: skillMdPath,
            fixSuggestion: 'Добавьте: "Используй этот скилл ВСЕГДА, когда..." или "Use when the user asks..."'
          });
        }

        // FM-006: Negative boundaries / anti-triggers
        const hasAntiTriggers = /(не использовать|не применять|not for|do not use|out of scope|запрещено использовать для)/i.test(descriptionText);
        if (!hasAntiTriggers && isArchTier) {
          issues.push({
            ruleId: 'FM-006',
            category: 'Frontmatter',
            severity: 'INFO',
            message: 'Архитектурный скилл рекомендуется снабжать отрицательными триггерами в description ("НЕ применять для..."), чтобы избежать ложных срабатываний.',
            file: skillMdPath
          });
        }
      }

      // FM-008: Semver version
      if (frontmatter.version && !/^\d+\.\d+\.\d+/.test(String(frontmatter.version))) {
        issues.push({
          ruleId: 'FM-008',
          category: 'Frontmatter',
          severity: 'INFO',
          message: `Версия '${frontmatter.version}' не соответствует стандарту SemVer (x.y.z).`,
          file: skillMdPath
        });
      }
    }

    // -------------------------------------------------------------
    // 2. STRUCTURAL ARCHITECTURE (ST) — Claude / Anthropic Canon
    // -------------------------------------------------------------
    const headings = lines.filter(l => /^#{1,4}\s+/.test(l));
    const sectionsCount = headings.length;

    // ST-001: H1 Title
    const hasH1 = lines.some(l => /^#\s+/.test(l));
    if (!hasH1) {
      issues.push({
        ruleId: 'ST-001',
        category: 'Structure',
        severity: 'WARNING',
        message: 'Отсутствует главный заголовок уровня H1 (# SKILL: <name>).',
        file: skillMdPath
      });
    }

    // ST-002: Purpose / Overview section
    const hasOverview = /(##\s+(\d+\.\s+)?(Overview|Назначение|Зона ответственности|Введение|Цель|Purpose|Scope))/i.test(content);
    if (!hasOverview) {
      issues.push({
        ruleId: 'ST-002',
        category: 'Structure',
        severity: 'WARNING',
        message: 'Отсутствует раздел назначения и границ скилла (## Назначение или ## Overview).',
        file: skillMdPath
      });
    }

    // ST-003: Decision Tree / Flowchart
    const hasDecisionTree = /(##\s+(\d+\.\s+)?.*(Дерево решений|Decision Tree|Flowchart|Блок-схема|Алгоритм выбора|Матрица решений|Decision))/i.test(content) ||
      content.includes('```mermaid') ||
      content.includes('flowchart TD');
    if (!hasDecisionTree && isArchTier) {
      issues.push({
        ruleId: 'ST-003',
        category: 'Structure',
        severity: 'ERROR',
        message: 'В архитектурном скилле отсутствует алгоритмическое Дерево решений (## Дерево решений / Decision Tree / ```mermaid). Агенту нужен наглядный алгоритм выбора.',
        file: skillMdPath
      });
    }

    // ST-004: Hard Invariants / Non-negotiables
    const hasHardInvariants = /(##\s+(\d+\.\s+)?.*(Hard Invariants|Жесткие запреты|Инварианты|Ключевые инварианты|Нерушимые правила|Запреты|Правила))/i.test(content) ||
      content.includes('HARD INVARIANTS') ||
      content.includes('КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО');
    if (!hasHardInvariants && isArchTier) {
      issues.push({
        ruleId: 'ST-004',
        category: 'Structure',
        severity: 'ERROR',
        message: 'В архитектурном скилле отсутствует раздел жестких инвариантов (## Hard Invariants / Жесткие запреты).',
        file: skillMdPath
      });
    }

    // ST-005: Step-by-Step Execution Protocol
    const hasProtocol = /(##\s+(\d+\.\s+)?.*(Step-by-step|Пошаговый|Протокол|Регламент|Workflow|Пайплайн|Execution Protocol|Порядок действий))/i.test(content) ||
      lines.some(l => /^#{2,3}\s+.*(Шаг|Step)\s+\d+/i.test(l));
    if (!hasProtocol) {
      issues.push({
        ruleId: 'ST-005',
        category: 'Structure',
        severity: 'WARNING',
        message: 'Отсутствует пошаговый протокол выполнения (## Пошаговый алгоритм / Step-by-step Protocol).',
        file: skillMdPath
      });
    }

    // ST-006: Anti-Patterns / What NOT to do
    const hasAntiPatterns = /(##\s+(\d+\.\s+)?.*(Anti-patterns|Антипаттерны|Known Anti-Patterns|Что нельзя делать|Чего избегать|Предотвращаемые антипаттерны))/i.test(content) ||
      (content.includes('❌') && content.includes('✅'));
    if (!hasAntiPatterns && isArchTier) {
      issues.push({
        ruleId: 'ST-006',
        category: 'Structure',
        severity: 'WARNING',
        message: 'Рекомендуется добавить раздел предотвращаемых антипаттернов (## Предотвращаемые антипаттерны) с наглядными примерами «Как делать нельзя».',
        file: skillMdPath
      });
    }

    // ST-007: Verification Checklist / Self-Audit
    const hasVerification = /(##\s+(\d+\.\s+)?.*(Verification|Чеклист|Самопроверка|Контроль качества|Quality Gate|Проверка))/i.test(content) ||
      content.includes('- [ ]');
    if (!hasVerification) {
      issues.push({
        ruleId: 'ST-007',
        category: 'Structure',
        severity: 'WARNING',
        message: 'Отсутствует чеклист самопроверки и верификации (## Чеклист верификации / - [ ]).',
        file: skillMdPath
      });
    }

    // ST-008: Length / Token budget overflow
    if (totalChars > 45000) {
      issues.push({
        ruleId: 'ST-008',
        category: 'Structure',
        severity: 'WARNING',
        message: `Размер SKILL.md (${totalChars} симв.) превышает рекомендуемый лимит (45 000). Декомпозируйте справочные таблицы в отдельные файлы references/.`,
        file: skillMdPath
      });
    }

    // -------------------------------------------------------------
    // 3. HYGIENE & INTEGRITY (HY)
    // -------------------------------------------------------------
    // HY-001: Local developer hardcoded paths (исключаем строки с ❌ антипаттернами)
    const rawLocalPaths = lines
      .filter(l => !l.includes('❌') && !l.includes('Плохая практика') && !l.includes('Антипаттерн'))
      .join('\n')
      .match(/[A-Za-z]:\\[Uu]sers\\[^\s`'"\)]+/g);
    if (rawLocalPaths) {
      const uniquePaths = Array.from(new Set(rawLocalPaths));
      issues.push({
        ruleId: 'HY-001',
        category: 'Hygiene',
        severity: 'WARNING',
        message: `Обнаружен хардкод локальных путей пользователя Windows (${uniquePaths.slice(0, 2).join(', ')}). Используйте относительные пути.`,
        file: skillMdPath
      });
    }

    // HY-002: Relative links validation
    const mdLinks = content.match(/\[([^\]]+)\]\(([^)]+)\)/g) || [];
    for (const link of mdLinks) {
      const match = link.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (match) {
        const linkTarget = match[2].trim();
        // Проверяем только локальные относительные пути
        if (linkTarget.startsWith('./') || linkTarget.startsWith('../')) {
          const targetClean = linkTarget.split('#')[0].split('?')[0];
          const resolvedPath = path.resolve(skillDirPath, targetClean);
          if (!fs.existsSync(resolvedPath)) {
            issues.push({
              ruleId: 'HY-002',
              category: 'Hygiene',
              severity: 'WARNING',
              message: `Битая относительная ссылка в Markdown: '${linkTarget}' -> файл не найден на диске.`,
              file: skillMdPath
            });
            break; // Ограничиваемся одной ошибкой на файл
          }
        }
      }
    }

    // -------------------------------------------------------------
    // 4. L1/L2 ARCHITECTURAL DUAL-TIER CONTRACT (L1)
    // -------------------------------------------------------------
    let coreLines: number | undefined;
    if (isArchTier) {
      if (!hasCoreMd) {
        issues.push({
          ruleId: 'L1-001',
          category: 'L1_Core',
          severity: 'WARNING',
          message: `Архитектурный скилл '${dirName}' не имеет ультра-компактного файла CORE.md. Это приводит к раздуванию контекста при динамической маршрутизации.`,
          file: coreMdPath,
          fixSuggestion: 'Создайте CORE.md (до 65 строк) с детерминированными формулами и жесткими инвариантами.'
        });
      } else {
        const coreContent = fs.readFileSync(coreMdPath, 'utf-8');
        const cLines = coreContent.split(/\r?\n/);
        coreLines = cLines.length;

        if (coreLines > 65) {
          issues.push({
            ruleId: 'L1-002',
            category: 'L1_Core',
            severity: 'WARNING',
            message: `Файл CORE.md превышает лимит компактности (${coreLines} строк > 65 строк). Сократите до жестких инвариантов.`,
            file: coreMdPath
          });
        }

        if (!coreContent.includes('HARD INVARIANTS') && !coreContent.includes('ИНВАРИАНТ')) {
          issues.push({
            ruleId: 'L1-003',
            category: 'L1_Core',
            severity: 'WARNING',
            message: 'Файл CORE.md обязан содержать заголовок "HARD INVARIANTS" или "КЛЮЧЕВЫЕ ИНВАРИАНТЫ".',
            file: coreMdPath
          });
        }
      }
    }

    // -------------------------------------------------------------
    // ВЫЧИСЛЕНИЕ СКОРИНГА И ГРЕЙДА
    // -------------------------------------------------------------
    let score = 100;
    for (const issue of issues) {
      if (issue.severity === 'CRITICAL') score -= 25;
      else if (issue.severity === 'ERROR') score -= 12;
      else if (issue.severity === 'WARNING') score -= 5;
      else if (issue.severity === 'INFO') score -= 1;
    }
    score = Math.max(0, score);

    let grade: 'A' | 'B' | 'C' | 'D' | 'F' = 'A';
    if (score < 30) grade = 'F';
    else if (score < 55) grade = 'D';
    else if (score < 75) grade = 'C';
    else if (score < 90) grade = 'B';

    return {
      skillName: dirName,
      dirPath: skillDirPath,
      skillMdPath,
      hasCoreMd,
      score,
      grade,
      isArchTier,
      issues,
      metrics: {
        totalChars,
        totalLines,
        coreLines,
        descriptionChars: descriptionText.length,
        sectionsCount
      }
    };
  }

  /**
   * Аудит всех скилов
   */
  public auditAll(options: { archOnly?: boolean; targetSkill?: string } = {}): SkillAuditResult[] {
    const results: SkillAuditResult[] = [];
    if (!fs.existsSync(this.skillsDir)) return results;

    const entries = fs.readdirSync(this.skillsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.') || entry.name === '_archive') continue;

      if (options.targetSkill && entry.name !== options.targetSkill) {
        continue;
      }

      if (options.archOnly && !ARCH_TIER_SKILLS.has(entry.name)) {
        continue;
      }

      const skillDir = path.join(this.skillsDir, entry.name);
      results.push(this.auditSkill(skillDir));
    }

    // Сортировка: сначала с низким скором
    return results.sort((a, b) => a.score - b.score);
  }
}

// -------------------------------------------------------------
// CLI FORMATTING & RUNNER
// -------------------------------------------------------------
if (require.main === module) {
  const args = process.argv.slice(2);
  const isArchOnly = args.includes('--tier=arch') || args.includes('--arch');
  const isJson = args.includes('--json');
  const targetArg = args.find(a => a.startsWith('--skill='));
  const targetSkill = targetArg ? targetArg.split('=')[1] : undefined;

  const auditor = new SkillArchitectureAuditor();
  const results = auditor.auditAll({ archOnly: isArchOnly, targetSkill });

  if (isJson) {
    console.log(JSON.stringify(results, null, 2));
    process.exit(0);
  }

  console.log(`\n═══════════════════════════════════════════════════════════════════════════════════`);
  console.log(`🛡️  OmniSMM Skill Architecture & Anthropic Standards Linter (v1.0)`);
  console.log(`   Scope: ${isArchOnly ? 'Tier 1/2 Architectural Skills' : 'All Workspace Skills'} | Audited: ${results.length} skills`);
  console.log(`═══════════════════════════════════════════════════════════════════════════════════\n`);

  let totalScore = 0;
  let criticalCount = 0;
  let errorCount = 0;
  let warningCount = 0;
  let gradeCounts = { A: 0, B: 0, C: 0, D: 0, F: 0 };

  for (const r of results) {
    totalScore += r.score;
    gradeCounts[r.grade]++;

    for (const iss of r.issues) {
      if (iss.severity === 'CRITICAL') criticalCount++;
      else if (iss.severity === 'ERROR') errorCount++;
      else if (iss.severity === 'WARNING') warningCount++;
    }
  }

  const avgScore = results.length > 0 ? Math.round(totalScore / results.length) : 0;

  // Вывод проблемных скилов
  const problematic = results.filter(r => r.score < 85);
  if (problematic.length > 0) {
    console.log(`⚠️  Найдено ${problematic.length} скиллов, требующих стандартизации:\n`);
    for (const r of problematic.slice(0, 15)) {
      const badge = r.score >= 90 ? '🟢' : r.score >= 75 ? '🟡' : r.score >= 55 ? '🟠' : '🔴';
      console.log(`${badge} [${r.grade}] ${r.skillName.padEnd(35)} Score: ${r.score}/100 | Issues: ${r.issues.length}`);
      for (const iss of r.issues) {
        const icon = iss.severity === 'CRITICAL' ? '⛔' : iss.severity === 'ERROR' ? '❌' : '⚠️';
        console.log(`   ${icon} [${iss.ruleId}] (${iss.category}) ${iss.message}`);
        if (iss.fixSuggestion) {
          console.log(`      💡 Fix: ${iss.fixSuggestion}`);
        }
      }
      console.log('');
    }
    if (problematic.length > 15) {
      console.log(`   ... и еще ${problematic.length - 15} скиллов с замечаниями.\n`);
    }
  } else {
    console.log(`🟢 Все проверенные скилы идеально соответствуют архитектурному стандарту!\n`);
  }

  console.log(`───────────────────────────────────────────────────────────────────────────────────`);
  console.log(`📊 ИТОГОВЫЙ СТАТУС АРХИТЕКТУРЫ СКИЛЛОВ:`);
  console.log(`   Средний Health Score: ${avgScore}/100`);
  console.log(`   Грейды: A(🟢): ${gradeCounts.A} | B(🟡): ${gradeCounts.B} | C(🟠): ${gradeCounts.C} | D(🔴): ${gradeCounts.D} | F(⛔): ${gradeCounts.F}`);
  console.log(`   Найдено дефектов: CRITICAL: ${criticalCount} | ERROR: ${errorCount} | WARNING: ${warningCount}`);
  console.log(`───────────────────────────────────────────────────────────────────────────────────\n`);

  if (criticalCount > 0) {
    process.exit(1);
  }
}
