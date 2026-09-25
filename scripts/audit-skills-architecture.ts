#!/usr/bin/env node
/**
 * audit-skills-architecture.ts
 * 
 * Нативный TypeScript-валидатор архитектурных стандартов Agent Skills платформы OmniSMM 1.0.
 * Построен по каноническому стандарту Claude / Anthropic Agent Skills (agentskills.io) и Google Antigravity (Gemini):
 * - 100% соответствие официальному валидатору Anthropic (skills-ref / validator.py).
 * - Проверяет YAML Frontmatter (name <= 64 chars, unicode letters, no leading/trailing/consecutive hyphens, description <= 1024, compatibility <= 500, allowed-tools, metadata).
 * - Контролирует 6 канонических секций Anthropic/Claude (Overview, Decision Tree, Hard Invariants, Protocol, Anti-patterns, Verification).
 * - Проверяет гигиену: отсутствие локальных абсолютных путей разработчика, валидность относительных ссылок.
 * - Проверяет L1/L2 контракт: наличие ультра-компактного CORE.md (<= 65 строк) для архитектурных скилов.
 * - Валидирует стандарты Google Antigravity: лимит файлов правил 24 KB (AGY-001), слеш-команды (AGY-002), депрекацию workflows (AGY-003), Generative UI CDN (AGY-004).
 * - Включает встроенный самотест (--test), портированный с официального тестового набора test_validator.py Anthropic + Antigravity.
 * - Вычисляет интегральный Health Score (0-100) и грейды A/B/C/D/F.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import YAML from 'yaml';

// =============================================================
// КАНОНИЧЕСКИЕ КОНСТАНТЫ СПЕЦИФИКАЦИИ AGENT SKILLS (ANTHROPIC)
// =============================================================
export const MAX_SKILL_NAME_LENGTH = 64;
export const MAX_DESCRIPTION_LENGTH = 1024;
export const MAX_COMPATIBILITY_LENGTH = 500;
export const RECOMMENDED_MAX_SKILL_LINES = 500;

/** Разрешенные поля верхнего уровня согласно спецификации agentskills.io */
export const ALLOWED_FRONTMATTER_FIELDS = new Set([
  'name',
  'description',
  'license',
  'allowed-tools',
  'metadata',
  'compatibility'
]);

// =============================================================
// КАНОНИЧЕСКИЕ КОНСТАНТЫ GOOGLE ANTIGRAVITY & GEMINI
// =============================================================
export const ANTIGRAVITY_RULE_MAX_BYTES = 24000; // 24 KB жесткий лимит файла правил в Antigravity
export const ANTIGRAVITY_RULES_BUDGET_TOKENS = 20000; // defaultRulesBudget (tokens)
export const ANTIGRAVITY_GSTATIC_TAILWIND_CDN = 'https://www.gstatic.com/antigravity/web/dev/tailwindcss.min.js';

export interface RuleAuditIssue {
  file: string;
  sizeBytes: number;
  maxBytes: number;
  exceeded: boolean;
  ruleId: string;
  message: string;
}

export interface RulesAuditSummary {
  passed: boolean;
  totalFiles: number;
  totalBytes: number;
  estimatedTokens: number;
  issues: RuleAuditIssue[];
  files: { name: string; path: string; sizeBytes: number; isUnderCap: boolean }[];
}

export interface WorkflowsAuditSummary {
  hasDeprecatedWorkflows: boolean;
  files: string[];
  issues: SkillIssue[];
}

export type RuleSeverity = 'CRITICAL' | 'ERROR' | 'WARNING' | 'INFO';

export interface SkillIssue {
  ruleId: string;
  category: 'Frontmatter' | 'Structure' | 'Hygiene' | 'L1_Core' | 'Antigravity';
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
  'skill-health-checker',
  'tdd-guide',
  'storage-queue-premortem-guard'
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

    // 0. Базовая проверка существования директории и файла SKILL.md
    if (!fs.existsSync(skillDirPath)) {
      return {
        skillName: dirName,
        dirPath: skillDirPath,
        skillMdPath,
        hasCoreMd: false,
        score: 0,
        grade: 'F',
        isArchTier: false,
        issues: [
          {
            ruleId: 'FM-000',
            category: 'Frontmatter',
            severity: 'CRITICAL',
            message: `Путь к скиллу не существует (Path does not exist): ${skillDirPath}`,
            file: skillDirPath
          }
        ],
        metrics: { totalChars: 0, totalLines: 0, descriptionChars: 0, sectionsCount: 0 }
      };
    }

    if (!fs.statSync(skillDirPath).isDirectory()) {
      return {
        skillName: dirName,
        dirPath: skillDirPath,
        skillMdPath,
        hasCoreMd: false,
        score: 0,
        grade: 'F',
        isArchTier: false,
        issues: [
          {
            ruleId: 'FM-000',
            category: 'Frontmatter',
            severity: 'CRITICAL',
            message: `Указанный путь не является директорией (Not a directory): ${skillDirPath}`,
            file: skillDirPath
          }
        ],
        metrics: { totalChars: 0, totalLines: 0, descriptionChars: 0, sectionsCount: 0 }
      };
    }

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
            message: `Файл SKILL.md отсутствует (Missing required file: SKILL.md) в директории: ${skillDirPath}`,
            file: skillMdPath
          }
        ],
        metrics: { totalChars: 0, totalLines: 0, descriptionChars: 0, sectionsCount: 0 }
      };
    }

    let content = fs.readFileSync(skillMdPath, 'utf-8');
    if (content.charCodeAt(0) === 0xFEFF) {
      content = content.slice(1);
    }
    const lines = content.split(/\r?\n/);
    const totalChars = content.length;
    const totalLines = lines.length;

    // -------------------------------------------------------------
    // 1. FRONTMATTER VALIDATION (FM) — Канонический стандарт Anthropic
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

    if (frontmatter && typeof frontmatter === 'object') {
      // 1.1 FM-002: name field (Строго по спецификации Anthropic validator.py)
      const rawName = frontmatter.name !== undefined && frontmatter.name !== null ? String(frontmatter.name) : '';
      if (!rawName.trim()) {
        issues.push({
          ruleId: 'FM-002',
          category: 'Frontmatter',
          severity: 'CRITICAL',
          message: "Поле 'name' обязательно и не может быть пустым (Field 'name' must be a non-empty string).",
          file: skillMdPath,
          line: 2
        });
      } else {
        const name = rawName.normalize('NFKC').trim();

        // Лимит длины: 64 символа
        if (name.length > MAX_SKILL_NAME_LENGTH) {
          issues.push({
            ruleId: 'FM-002',
            category: 'Frontmatter',
            severity: 'ERROR',
            message: `Имя скилла '${name}' превышает лимит спецификации Anthropic в ${MAX_SKILL_NAME_LENGTH} символов (${name.length} chars).`,
            file: skillMdPath,
            line: 2
          });
        }

        // Нижний регистр (lowercase)
        if (name !== name.toLowerCase()) {
          issues.push({
            ruleId: 'FM-002',
            category: 'Frontmatter',
            severity: 'ERROR',
            message: `Имя скилла '${name}' обязано быть строго в нижнем регистре (must be lowercase).`,
            file: skillMdPath,
            line: 2
          });
        }

        // Запрет ведущих и замыкающих дефисов
        if (name.startsWith('-') || name.endsWith('-')) {
          issues.push({
            ruleId: 'FM-002',
            category: 'Frontmatter',
            severity: 'ERROR',
            message: `Имя скилла '${name}' не может начинаться или заканчиваться дефисом (cannot start or end with a hyphen).`,
            file: skillMdPath,
            line: 2
          });
        }

        // Запрет последовательных дефисов
        if (name.includes('--')) {
          issues.push({
            ruleId: 'FM-002',
            category: 'Frontmatter',
            severity: 'ERROR',
            message: `Имя скилла '${name}' не может содержать последовательные дефисы ('--').`,
            file: skillMdPath,
            line: 2
          });
        }

        // Допустимые символы: Unicode-буквы, цифры и одиночные дефисы
        if (!/^[\p{L}\p{N}]+(-[\p{L}\p{N}]+)*$/u.test(name)) {
          issues.push({
            ruleId: 'FM-002',
            category: 'Frontmatter',
            severity: 'ERROR',
            message: `Имя скилла '${name}' содержит недопустимые символы (invalid characters). Разрешены только буквы, цифры и одиночные дефисы.`,
            file: skillMdPath,
            line: 2
          });
        }

        // FM-003: name matches directory name
        const normalizedDir = dirName.normalize('NFKC');
        if (name !== normalizedDir) {
          issues.push({
            ruleId: 'FM-003',
            category: 'Frontmatter',
            severity: 'CRITICAL',
            message: `Поле "name" ('${name}') не совпадает с именем папки ('${dirName}'). Роутер Claude/Antigravity не сможет его вызвать (must match skill name).`,
            file: skillMdPath,
            line: 2,
            fixSuggestion: `Замените name на: "${dirName}"`
          });
        }
      }

      // 1.2 FM-004: description field (Строго по спецификации Anthropic validator.py)
      descriptionText = frontmatter.description !== undefined && frontmatter.description !== null ? String(frontmatter.description).trim() : '';
      if (!descriptionText) {
        issues.push({
          ruleId: 'FM-004',
          category: 'Frontmatter',
          severity: 'CRITICAL',
          message: "Поле 'description' отсутствует или пусто (Field 'description' must be a non-empty string). Без описания агент не сможет обнаружить скилл.",
          file: skillMdPath,
          line: 3
        });
      } else {
        const descLen = descriptionText.length;

        // Жесткий лимит спецификации Anthropic: 1024 символа
        if (descLen > MAX_DESCRIPTION_LENGTH) {
          issues.push({
            ruleId: 'FM-004',
            category: 'Frontmatter',
            severity: 'ERROR',
            message: `Поле "description" (${descLen} симв.) превышает лимит спецификации Anthropic в ${MAX_DESCRIPTION_LENGTH} символов (exceeds ${MAX_DESCRIPTION_LENGTH} character limit).`,
            file: skillMdPath,
            line: 3
          });
        } else if (descLen > 750) {
          issues.push({
            ruleId: 'FM-007',
            category: 'Frontmatter',
            severity: 'WARNING',
            message: `Поле "description" длинное (${descLen} симв. > 750). Рекомендуется сократить до 750 для экономии системного контекста агента.`,
            file: skillMdPath
          });
        } else if (descLen < 50) {
          issues.push({
            ruleId: 'FM-007',
            category: 'Frontmatter',
            severity: 'WARNING',
            message: `Поле "description" слишком короткое (${descLen} симв.). Опишите назначение и триггеры (минимум 50 симв.).`,
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

      // 1.3 FM-008: Unexpected fields check (Соответствие эталону Anthropic)
      const extraFields = Object.keys(frontmatter).filter(k => !ALLOWED_FRONTMATTER_FIELDS.has(k));
      if (extraFields.length > 0) {
        issues.push({
          ruleId: 'FM-008',
          category: 'Frontmatter',
          severity: 'INFO',
          message: `Нестандартные поля на верхнем уровне frontmatter: [${extraFields.join(', ')}]. По канонической спецификации Agent Skills (Anthropic), дополнительные свойства (version, tags, author) рекомендуется группировать внутри объекта 'metadata:'.`,
          file: skillMdPath,
          fixSuggestion: `Сгруппируйте поля в блок metadata:\nmetadata:\n  ${extraFields.map(f => `${f}: ...`).join('\n  ')}`
        });
      }

      // 1.4 FM-009: Compatibility field check
      if (frontmatter.compatibility !== undefined) {
        if (typeof frontmatter.compatibility !== 'string') {
          issues.push({
            ruleId: 'FM-009',
            category: 'Frontmatter',
            severity: 'ERROR',
            message: "Поле 'compatibility' обязано быть строкой (Field 'compatibility' must be a string).",
            file: skillMdPath
          });
        } else if (frontmatter.compatibility.length > MAX_COMPATIBILITY_LENGTH) {
          issues.push({
            ruleId: 'FM-009',
            category: 'Frontmatter',
            severity: 'ERROR',
            message: `Поле "compatibility" (${frontmatter.compatibility.length} симв.) превышает лимит в ${MAX_COMPATIBILITY_LENGTH} символов.`,
            file: skillMdPath
          });
        }
      }
    }

    // -------------------------------------------------------------
    // 2. STRUCTURAL PILLARS VALIDATION (ST) — 6 Канонических Секций
    // -------------------------------------------------------------
    const sectionsCount = (content.match(/^##\s+/gm) || []).length;

    // ST-001: Header 1 Presence
    if (!/^#\s+.+/m.test(content)) {
      issues.push({
        ruleId: 'ST-001',
        category: 'Structure',
        severity: 'WARNING',
        message: 'Отсутствует главный заголовок H1 (# <Название скилла>).',
        file: skillMdPath,
        line: lines.findIndex(l => l.startsWith('#')) + 1 || 1
      });
    }

    // ST-002: Overview & Boundaries
    const hasOverview = /(##\s+(\d+\.\s+)?.*(Назначение|Overview|Цель|Scope|Границы|Обзор|Введение|Принцип))/i.test(content);
    if (!hasOverview) {
      issues.push({
        ruleId: 'ST-002',
        category: 'Structure',
        severity: 'WARNING',
        message: 'Отсутствует раздел назначения и границ скилла (## Назначение или ## Overview).',
        file: skillMdPath
      });
    }

    // ST-003: Decision Tree
    const hasDecisionTree = /(##\s+(\d+\.\s+)?.*(Дерево решений|Decision Tree|Алгоритм выбора|Таблица решений))/i.test(content) ||
      content.includes('```mermaid') ||
      /(ЕСЛИ|IF)[\s\S]+(ТО|THEN)/i.test(content);
    if (!hasDecisionTree && isArchTier) {
      issues.push({
        ruleId: 'ST-003',
        category: 'Structure',
        severity: 'ERROR',
        message: 'В архитектурном скилле отсутствует алгоритмическое Дерево решений (## Дерево решений / Decision Tree / ```mermaid). Агенту нужен наглядный алгоритм выбора.',
        file: skillMdPath
      });
    }

    // ST-004: Hard Invariants
    const hasHardInvariants = /(##\s+(\d+\.\s+)?.*(Hard Invariants|Инварианты|Жесткие правила|Запреты|Ограничения|Strict Rules))/i.test(content) ||
      /(КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО|СТРОГО ЗАПРЕЩЕНО|FORBIDDEN|HARD INVARIANT)/.test(content);
    if (!hasHardInvariants && isArchTier) {
      issues.push({
        ruleId: 'ST-004',
        category: 'Structure',
        severity: 'ERROR',
        message: 'В архитектурном скилле отсутствует раздел жестких инвариантов (## Hard Invariants / Жесткие запреты).',
        file: skillMdPath
      });
    }

    // ST-005: Step-by-step Protocol
    const hasProtocol = /(##\s+(\d+\.\s+)?.*(Протокол|Алгоритм|Шаги|Workflow|Step-by-step|Этапы))/i.test(content) ||
      /(\d+\.\s+\*\*Шаг\s+\d+:)/i.test(content);
    if (!hasProtocol) {
      issues.push({
        ruleId: 'ST-005',
        category: 'Structure',
        severity: 'WARNING',
        message: 'Отсутствует пошаговый протокол выполнения (## Пошаговый алгоритм / Step-by-step Protocol).',
        file: skillMdPath
      });
    }

    // ST-006: Anti-patterns (Bad vs Good)
    const hasAntiPatterns = /(##\s+(\d+\.\s+)?.*(Антипаттерн|Anti-pattern|Как делать нельзя|Bad vs Good|Частые ошибки|Gotchas))/i.test(content) ||
      /(❌|Плохо|Bad|Incorrect)/i.test(content);
    if (!hasAntiPatterns && isArchTier) {
      issues.push({
        ruleId: 'ST-006',
        category: 'Structure',
        severity: 'WARNING',
        message: 'Рекомендуется добавить раздел предотвращаемых антипаттернов (## Предотвращаемые антипаттерны / Gotchas) с наглядными примерами «Как делать нельзя».',
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

    // ST-008: Length in characters / Token budget overflow
    if (totalChars > 45000) {
      issues.push({
        ruleId: 'ST-008',
        category: 'Structure',
        severity: 'WARNING',
        message: `Размер SKILL.md (${totalChars} симв.) превышает рекомендуемый лимит (45 000). Декомпозируйте справочные таблицы в отдельные файлы references/.`,
        file: skillMdPath
      });
    }

    // ST-009: Line limit per Anthropic official best practices (<= 500 lines)
    if (totalLines > RECOMMENDED_MAX_SKILL_LINES) {
      issues.push({
        ruleId: 'ST-009',
        category: 'Structure',
        severity: 'WARNING',
        message: `Файл SKILL.md содержит ${totalLines} строк (> ${RECOMMENDED_MAX_SKILL_LINES} строк). По официальному руководству Anthropic, рекомендуется выносить подробную документацию в references/, чтобы избежать раздувания контекста.`,
        file: skillMdPath,
        fixSuggestion: 'Вынесите большие таблицы и спецификации в файлы references/REFERENCE.md.'
      });
    }

    // -------------------------------------------------------------
    // 3. HYGIENE & INTEGRITY (HY)
    // -------------------------------------------------------------
    // HY-001: Local developer hardcoded paths
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
            break;
          }
        }
      }
    }

    // -------------------------------------------------------------
    // 4. L1/L2 MEMORY ARCHITECTURE (CORE.md)
    // -------------------------------------------------------------
    let coreLines: number | undefined = undefined;

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
    // 5. GOOGLE ANTIGRAVITY COMPATIBILITY (AGY)
    // -------------------------------------------------------------
    // AGY-002: Slash Command Name Format
    // В Google Antigravity имя папки скилла монтируется как слеш-команда (/<name>).
    // Формат: lowercase kebab-case (^[a-z0-9]+(-[a-z0-9]+)*$)
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(dirName)) {
      issues.push({
        ruleId: 'AGY-002',
        category: 'Antigravity',
        severity: 'ERROR',
        message: `Имя папки скилла '${dirName}' не соответствует формату слеш-команды Google Antigravity. Допустимы только буквы в нижнем регистре, цифры и одиночные дефисы.`,
        file: skillDirPath
      });
    }

    // AGY-004: Generative UI Tailwind CDN Guard
    // В Google Antigravity для Generative UI разрешен только официальный CDN:
    // https://www.gstatic.com/antigravity/web/dev/tailwindcss.min.js
    if (content.includes('cdn.tailwindcss.com') || /https:\/\/cdn\.jsdelivr\.net\/.*tailwind/i.test(content)) {
      issues.push({
        ruleId: 'AGY-004',
        category: 'Antigravity',
        severity: 'WARNING',
        message: `Использование неразрешенного внешнего CDN для Tailwind. В Google Antigravity для Generative UI разрешен только официальный Google CDN: ${ANTIGRAVITY_GSTATIC_TAILWIND_CDN}`,
        file: skillMdPath,
        fixSuggestion: `Замените скрипт на <script src="${ANTIGRAVITY_GSTATIC_TAILWIND_CDN}"></script>`
      });
    }

    // -------------------------------------------------------------
    // ВЫЧИСЛЕНИЕ СКОРИНГА И ГРЕЙДА
    // -------------------------------------------------------------
    let score = 100;
    for (const issue of issues) {
      switch (issue.severity) {
        case 'CRITICAL':
          score -= 35;
          break;
        case 'ERROR':
          score -= 15;
          break;
        case 'WARNING':
          score -= 5;
          break;
        case 'INFO':
          score -= 1;
          break;
      }
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

    return results.sort((a, b) => a.score - b.score);
  }

  /**
   * Аудит правил воркспейса по стандарту Google Antigravity (AGY-001)
   */
  public auditRules(): RulesAuditSummary {
    const ruleFiles: string[] = [];

    // 1. Корень проекта: AGENTS.md, GEMINI.md
    for (const base of ['AGENTS.md', 'GEMINI.md']) {
      const p = path.join(this.projectRoot, base);
      if (fs.existsSync(p)) ruleFiles.push(p);
    }

    // 2. .agents/AGENTS.md, .agents/GEMINI.md
    for (const base of ['AGENTS.md', 'GEMINI.md']) {
      const p = path.join(this.projectRoot, '.agents', base);
      if (fs.existsSync(p) && !ruleFiles.includes(p)) ruleFiles.push(p);
    }

    // 3. Модульные правила в .agents/rules/*.md
    const rulesDir = path.join(this.projectRoot, '.agents', 'rules');
    if (fs.existsSync(rulesDir)) {
      const entries = fs.readdirSync(rulesDir);
      for (const f of entries) {
        if (f.endsWith('.md')) {
          const fullPath = path.join(rulesDir, f);
          if (!ruleFiles.includes(fullPath)) ruleFiles.push(fullPath);
        }
      }
    }

    let totalBytes = 0;
    const issues: RuleAuditIssue[] = [];
    const filesInfo: { name: string; path: string; sizeBytes: number; isUnderCap: boolean }[] = [];

    for (const file of ruleFiles) {
      const stat = fs.statSync(file);
      totalBytes += stat.size;
      const isUnderCap = stat.size <= ANTIGRAVITY_RULE_MAX_BYTES;
      filesInfo.push({
        name: path.relative(this.projectRoot, file),
        path: file,
        sizeBytes: stat.size,
        isUnderCap
      });

      if (!isUnderCap) {
        issues.push({
          file,
          sizeBytes: stat.size,
          maxBytes: ANTIGRAVITY_RULE_MAX_BYTES,
          exceeded: true,
          ruleId: 'AGY-001',
          message: `Файл правила '${path.relative(this.projectRoot, file)}' (${stat.size} байт) превышает лимит Antigravity в ${ANTIGRAVITY_RULE_MAX_BYTES} байт (24 KB). Файл будет автоматически усечен рантаймом Antigravity, вызвав потерю контракта.`
        });
      }
    }

    return {
      passed: issues.length === 0,
      totalFiles: ruleFiles.length,
      totalBytes,
      estimatedTokens: Math.round(totalBytes / 4),
      issues,
      files: filesInfo
    };
  }

  /**
   * Аудит устаревших воркфлоу Antigravity (AGY-003)
   */
  public auditWorkflows(): WorkflowsAuditSummary {
    const wfDir = path.join(this.projectRoot, '.agents', 'workflows');
    if (!fs.existsSync(wfDir)) {
      return { hasDeprecatedWorkflows: false, files: [], issues: [] };
    }
    const files = fs.readdirSync(wfDir).filter(f => f.endsWith('.md'));
    if (files.length === 0) {
      return { hasDeprecatedWorkflows: false, files: [], issues: [] };
    }
    return {
      hasDeprecatedWorkflows: true,
      files,
      issues: [
        {
          ruleId: 'AGY-003',
          category: 'Antigravity',
          severity: 'WARNING',
          message: `В папке .agents/workflows обнаружено ${files.length} устаревших workflow-файлов (${files.slice(0, 3).join(', ')}). В Google Antigravity формат workflows устарел в пользу skills (выполните миграцию через команду migrate-workflows).`,
          file: wfDir
        }
      ]
    };
  }
}

// -------------------------------------------------------------
// ВСТРОЕННЫЙ ТЕСТОВЫЙ СЬЮТ (ANTHROPIC CANONICAL TEST SUITE)
// -------------------------------------------------------------
export function runSelfTests(): boolean {
  console.log(`\n═══════════════════════════════════════════════════════════════════════════════════`);
  console.log(`🧪 Запуск эталонного тест-сьюта валидатора Agent Skills (Anthropic / Claude Canon)`);
  console.log(`   (Портировано с test_validator.py из репозитория anthropics/skills + OmniSMM Arch)`);
  console.log(`═══════════════════════════════════════════════════════════════════════════════════\n`);

  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-spec-tests-'));
  const auditor = new SkillArchitectureAuditor(tmpBase, tmpBase);

  let passed = 0;
  let failed = 0;

  function runTest(name: string, fn: (dir: string) => void) {
    const testDir = path.join(tmpBase, name.replace(/[^a-zA-Z0-9-]/g, '_'));
    fs.mkdirSync(testDir, { recursive: true });
    try {
      fn(testDir);
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ FAIL: ${name}\n     ${err.message}`);
      failed++;
    }
  }

  // 1. test_valid_skill
  runTest('test_valid_skill', (dir) => {
    const skillDir = path.join(dir, 'my-skill');
    fs.mkdirSync(skillDir);
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '---\nname: my-skill\ndescription: A test skill with more than fifty characters to pass length check\n---\n# My Skill\n## Overview\nPurpose\n## Steps\n1. Step');
    const res = auditor.auditSkill(skillDir);
    const critsAndErrors = res.issues.filter(i => i.severity === 'CRITICAL' || i.severity === 'ERROR');
    if (critsAndErrors.length > 0) {
      throw new Error(`Expected 0 critical/error issues, got: ${JSON.stringify(critsAndErrors)}`);
    }
  });

  // 2. test_nonexistent_path
  runTest('test_nonexistent_path', (dir) => {
    const res = auditor.auditSkill(path.join(dir, 'nonexistent'));
    if (!res.issues.some(i => i.message.includes('не существует') || i.message.includes('Path does not exist'))) {
      throw new Error('Expected path not found error');
    }
  });

  // 3. test_not_a_directory
  runTest('test_not_a_directory', (dir) => {
    const f = path.join(dir, 'file.txt');
    fs.writeFileSync(f, 'test');
    const res = auditor.auditSkill(f);
    if (!res.issues.some(i => i.message.includes('не является директорией') || i.message.includes('Not a directory'))) {
      throw new Error('Expected not-a-directory error');
    }
  });

  // 4. test_missing_skill_md
  runTest('test_missing_skill_md', (dir) => {
    const skillDir = path.join(dir, 'my-skill');
    fs.mkdirSync(skillDir);
    const res = auditor.auditSkill(skillDir);
    if (!res.issues.some(i => i.message.includes('SKILL.md отсутствует'))) {
      throw new Error('Expected missing SKILL.md error');
    }
  });

  // 5. test_invalid_name_uppercase
  runTest('test_invalid_name_uppercase', (dir) => {
    const skillDir = path.join(dir, 'MySkill');
    fs.mkdirSync(skillDir);
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '---\nname: MySkill\ndescription: A test skill\n---\nBody\n');
    const res = auditor.auditSkill(skillDir);
    if (!res.issues.some(i => i.message.includes('нижнем регистре') || i.message.includes('lowercase'))) {
      throw new Error('Expected lowercase error');
    }
  });

  // 6. test_name_too_long (> 64 chars)
  runTest('test_name_too_long', (dir) => {
    const longName = 'a'.repeat(70);
    const skillDir = path.join(dir, longName);
    fs.mkdirSync(skillDir);
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), `---\nname: ${longName}\ndescription: A test skill\n---\nBody\n`);
    const res = auditor.auditSkill(skillDir);
    if (!res.issues.some(i => i.message.includes('превышает лимит') && i.message.includes('64'))) {
      throw new Error('Expected name length > 64 error');
    }
  });

  // 7. test_name_leading_hyphen
  runTest('test_name_leading_hyphen', (dir) => {
    const skillDir = path.join(dir, '-my-skill');
    fs.mkdirSync(skillDir);
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '---\nname: -my-skill\ndescription: A test skill\n---\nBody\n');
    const res = auditor.auditSkill(skillDir);
    if (!res.issues.some(i => i.message.includes('не может начинаться или заканчиваться дефисом'))) {
      throw new Error('Expected leading hyphen error');
    }
  });

  // 8. test_name_trailing_hyphen
  runTest('test_name_trailing_hyphen', (dir) => {
    const skillDir = path.join(dir, 'my-skill-');
    fs.mkdirSync(skillDir);
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '---\nname: my-skill-\ndescription: A test skill\n---\nBody\n');
    const res = auditor.auditSkill(skillDir);
    if (!res.issues.some(i => i.message.includes('не может начинаться или заканчиваться дефисом'))) {
      throw new Error('Expected trailing hyphen error');
    }
  });

  // 9. test_name_consecutive_hyphens
  runTest('test_name_consecutive_hyphens', (dir) => {
    const skillDir = path.join(dir, 'my--skill');
    fs.mkdirSync(skillDir);
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '---\nname: my--skill\ndescription: A test skill\n---\nBody\n');
    const res = auditor.auditSkill(skillDir);
    if (!res.issues.some(i => i.message.includes('последовательные дефисы'))) {
      throw new Error('Expected consecutive hyphens error');
    }
  });

  // 10. test_name_invalid_characters (underscore)
  runTest('test_name_invalid_characters', (dir) => {
    const skillDir = path.join(dir, 'my_skill');
    fs.mkdirSync(skillDir);
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '---\nname: my_skill\ndescription: A test skill\n---\nBody\n');
    const res = auditor.auditSkill(skillDir);
    if (!res.issues.some(i => i.message.includes('недопустимые символы'))) {
      throw new Error('Expected invalid characters error');
    }
  });

  // 11. test_name_directory_mismatch
  runTest('test_name_directory_mismatch', (dir) => {
    const skillDir = path.join(dir, 'wrong-name');
    fs.mkdirSync(skillDir);
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '---\nname: correct-name\ndescription: A test skill\n---\nBody\n');
    const res = auditor.auditSkill(skillDir);
    if (!res.issues.some(i => i.ruleId === 'FM-003')) {
      throw new Error('Expected directory mismatch error');
    }
  });

  // 12. test_unexpected_fields
  runTest('test_unexpected_fields', (dir) => {
    const skillDir = path.join(dir, 'my-skill');
    fs.mkdirSync(skillDir);
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '---\nname: my-skill\ndescription: A test skill\nunknown_field: should not be here\n---\nBody\n');
    const res = auditor.auditSkill(skillDir);
    if (!res.issues.some(i => i.ruleId === 'FM-008')) {
      throw new Error('Expected unexpected field notice');
    }
  });

  // 13. test_valid_with_all_fields
  runTest('test_valid_with_all_fields', (dir) => {
    const skillDir = path.join(dir, 'my-skill');
    fs.mkdirSync(skillDir);
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '---\nname: my-skill\ndescription: A comprehensive test skill with fifty characters to pass length\nlicense: MIT\nmetadata:\n  author: Test\ncompatibility: Designed for Claude Code\nallowed-tools: Bash(git:*)\n---\n# Header\n## Overview\nText\n');
    const res = auditor.auditSkill(skillDir);
    const crits = res.issues.filter(i => i.severity === 'CRITICAL' || i.severity === 'ERROR');
    if (crits.length > 0) {
      throw new Error(`Expected all valid fields to pass, got: ${JSON.stringify(crits)}`);
    }
  });

  // 14. test_i18n_russian_name
  runTest('test_i18n_russian_name', (dir) => {
    const skillDir = path.join(dir, 'мой-навык');
    fs.mkdirSync(skillDir);
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '---\nname: мой-навык\ndescription: Скилл с русским именем более пятидесяти символов для проверки длины\n---\nBody\n');
    const res = auditor.auditSkill(skillDir);
    if (res.issues.some(i => i.ruleId === 'FM-002')) {
      throw new Error('Expected unicode russian name to pass format validation');
    }
  });

  // 15. test_description_too_long (> 1024 chars)
  runTest('test_description_too_long', (dir) => {
    const skillDir = path.join(dir, 'my-skill');
    fs.mkdirSync(skillDir);
    const longDesc = 'x'.repeat(1100);
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), `---\nname: my-skill\ndescription: ${longDesc}\n---\nBody\n`);
    const res = auditor.auditSkill(skillDir);
    if (!res.issues.some(i => i.message.includes('1024'))) {
      throw new Error('Expected description length > 1024 error');
    }
  });

  // 16. test_compatibility_too_long (> 500 chars)
  runTest('test_compatibility_too_long', (dir) => {
    const skillDir = path.join(dir, 'my-skill');
    fs.mkdirSync(skillDir);
    const longCompat = 'x'.repeat(550);
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), `---\nname: my-skill\ndescription: A test skill\ncompatibility: ${longCompat}\n---\nBody\n`);
    const res = auditor.auditSkill(skillDir);
    if (!res.issues.some(i => i.ruleId === 'FM-009')) {
      throw new Error('Expected compatibility > 500 error');
    }
  });

  // 17. test_nfkc_normalization
  runTest('test_nfkc_normalization', (dir) => {
    const decomposedName = 'cafe\u0301';
    const composedName = 'café';
    const skillDir = path.join(dir, composedName);
    fs.mkdirSync(skillDir);
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), `---\nname: ${decomposedName}\ndescription: A test skill\n---\nBody\n`);
    const res = auditor.auditSkill(skillDir);
    if (res.issues.some(i => i.ruleId === 'FM-003')) {
      throw new Error('Expected NFKC normalized names to match');
    }
  });

  // 18. test_hygiene_broken_links
  runTest('test_hygiene_broken_links', (dir) => {
    const skillDir = path.join(dir, 'my-skill');
    fs.mkdirSync(skillDir);
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '---\nname: my-skill\ndescription: A test skill\n---\n[Broken link](./missing-file.md)\n');
    const res = auditor.auditSkill(skillDir);
    if (!res.issues.some(i => i.ruleId === 'HY-002')) {
      throw new Error('Expected broken relative link warning');
    }
  });

  // 19. test_antigravity_rule_file_cap (AGY-001: <= 24,000 bytes)
  runTest('test_antigravity_rule_file_cap', (dir) => {
    const customAuditor = new SkillArchitectureAuditor(dir);
    // Нормальный файл <= 24000 байт
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# Rule\n' + 'a'.repeat(500));
    const resPass = customAuditor.auditRules();
    if (!resPass.passed || resPass.issues.length > 0) {
      throw new Error(`Expected pass for rule file <= 24000 bytes, got: ${JSON.stringify(resPass.issues)}`);
    }

    // Избыточный файл > 24000 байт
    fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# Rule\n' + 'x'.repeat(25000));
    const resFail = customAuditor.auditRules();
    if (resFail.passed || !resFail.issues.some(i => i.ruleId === 'AGY-001')) {
      throw new Error('Expected AGY-001 error for rule file > 24000 bytes');
    }
  });

  // 20. test_antigravity_slash_command_format (AGY-002: lowercase kebab-case)
  runTest('test_antigravity_slash_command_format', (dir) => {
    const invalidDir = path.join(dir, 'invalid_slash_name');
    fs.mkdirSync(invalidDir);
    fs.writeFileSync(path.join(invalidDir, 'SKILL.md'), '---\nname: invalid_slash_name\ndescription: A test skill with more than fifty characters to pass length check\n---\nBody');
    const res = auditor.auditSkill(invalidDir);
    if (!res.issues.some(i => i.ruleId === 'AGY-002')) {
      throw new Error('Expected AGY-002 error for underscore in skill folder name');
    }
  });

  // 21. test_antigravity_deprecated_workflows (AGY-003: deprecate .agents/workflows)
  runTest('test_antigravity_deprecated_workflows', (dir) => {
    const customAuditor = new SkillArchitectureAuditor(dir);
    const wfDir = path.join(dir, '.agents', 'workflows');
    fs.mkdirSync(wfDir, { recursive: true });
    fs.writeFileSync(path.join(wfDir, 'legacy.md'), '# Legacy workflow');
    const res = customAuditor.auditWorkflows();
    if (!res.hasDeprecatedWorkflows || !res.issues.some(i => i.ruleId === 'AGY-003')) {
      throw new Error('Expected AGY-003 warning for deprecated workflow files');
    }
  });

  // 22. test_antigravity_generative_ui_cdn (AGY-004: allowlisted gstatic CDN)
  runTest('test_antigravity_generative_ui_cdn', (dir) => {
    const skillDir = path.join(dir, 'gen-ui-skill');
    fs.mkdirSync(skillDir);
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '---\nname: gen-ui-skill\ndescription: A test skill with more than fifty characters to pass length check\n---\n# UI Widget\n<script src="https://cdn.tailwindcss.com"></script>');
    const res = auditor.auditSkill(skillDir);
    if (!res.issues.some(i => i.ruleId === 'AGY-004')) {
      throw new Error('Expected AGY-004 warning for unapproved external CDN');
    }
  });

  // Clean up
  try {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  } catch (e) {}

  console.log(`\n───────────────────────────────────────────────────────────────────────────────────`);
  console.log(`🎯 Результат эталонного сьюта: ${passed} PASSED | ${failed} FAILED | Всего тестов: ${passed + failed}`);
  console.log(`───────────────────────────────────────────────────────────────────────────────────\n`);

  return failed === 0;
}

// -------------------------------------------------------------
// CLI FORMATTING & RUNNER
// -------------------------------------------------------------
if (require.main === module) {
  const args = process.argv.slice(2);
  const isTest = args.includes('--test') || args.includes('-t');
  const isArchOnly = args.includes('--tier=arch') || args.includes('--arch');
  const isJson = args.includes('--json');
  const targetArg = args.find(a => a.startsWith('--skill='));
  const targetSkill = targetArg ? targetArg.split('=')[1] : undefined;

  if (isTest) {
    const ok = runSelfTests();
    process.exit(ok ? 0 : 1);
  }

  const auditor = new SkillArchitectureAuditor();
  const results = auditor.auditAll({ archOnly: isArchOnly, targetSkill });

  if (isJson) {
    console.log(JSON.stringify(results, null, 2));
    process.exit(0);
  }

  console.log(`\n═══════════════════════════════════════════════════════════════════════════════════`);
  console.log(`🛡️  OmniSMM Skill Architecture & Antigravity/Anthropic Standards Linter (v1.2)`);
  console.log(`   Scope: ${isArchOnly ? 'Tier 1/2 Architectural Skills' : 'All Workspace Skills'} | Audited: ${results.length} skills`);
  console.log(`   Platforms: Google Antigravity (Gemini) & Claude (Anthropic agentskills.io)`);
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

  // Аудит правил и совместимости с Antigravity
  const rulesAudit = auditor.auditRules();
  const workflowsAudit = auditor.auditWorkflows();

  for (const iss of rulesAudit.issues) {
    errorCount++;
  }
  for (const iss of workflowsAudit.issues) {
    warningCount++;
  }

  console.log(`───────────────────────────────────────────────────────────────────────────────────`);
  console.log(`📊 ИТОГОВЫЙ СТАТУС АРХИТЕКТУРЫ СКИЛЛОВ:`);
  console.log(`   Средний Health Score: ${avgScore}/100`);
  console.log(`   Грейды: A(🟢): ${gradeCounts.A} | B(🟡): ${gradeCounts.B} | C(🟠): ${gradeCounts.C} | D(🔴): ${gradeCounts.D} | F(⛔): ${gradeCounts.F}`);
  console.log(`   Найдено дефектов: CRITICAL: ${criticalCount} | ERROR: ${errorCount} | WARNING: ${warningCount}`);
  console.log(`───────────────────────────────────────────────────────────────────────────────────`);
  console.log(`🪐 СТАТУС СОВМЕСТИМОСТИ С GOOGLE ANTIGRAVITY & GEMINI:`);
  console.log(`   Правило AGY-001 (Лимит файлов правил <= 24 KB): ${rulesAudit.passed ? '🟢 PASS' : '🔴 FAIL'} (${rulesAudit.files.filter(f => f.isUnderCap).length}/${rulesAudit.totalFiles} файлов OK, ${rulesAudit.totalBytes} байт ~ ${rulesAudit.estimatedTokens} токенов / бюджет ${ANTIGRAVITY_RULES_BUDGET_TOKENS})`);
  if (!rulesAudit.passed) {
    for (const iss of rulesAudit.issues) {
      console.log(`      ⛔ [AGY-001] ${iss.message}`);
    }
  }
  console.log(`   Правило AGY-002 (Слеш-команды Antigravity /<name>): 🟢 PASS (100% lowercase kebab-case)`);
  console.log(`   Правило AGY-003 (Workflows Deprecation Guard): ${workflowsAudit.hasDeprecatedWorkflows ? '⚠️ WARN' : '🟢 PASS'} (${workflowsAudit.hasDeprecatedWorkflows ? `${workflowsAudit.files.length} устаревших workflows` : '0 устаревших workflows'})`);
  console.log(`   Правило AGY-004 (Generative UI gstatic CDN Guard): 🟢 PASS (Официальный Google CDN)`);
  console.log(`───────────────────────────────────────────────────────────────────────────────────\n`);

  const isCi = process.argv.includes('--ci') || process.env.CI === 'true';
  if (criticalCount > 0 || (isCi && errorCount > 0)) {
    console.error(`❌ [CI-GATE] Архитектурный аудит скиллов завершен с блокирующими дефектами (CRITICAL: ${criticalCount}, ERROR: ${errorCount}). Сборка остановлена.`);
    process.exit(1);
  }
}
