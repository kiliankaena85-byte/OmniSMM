# 🧭 SKILLS_CATALOG.md — Главный Реестр и Навигатор Скиллов SMMplan

> **Единый источник правды для AI-ассистентов и разработчиков.**  
> Все скиллы проекта структурированы по 7 ключевым доменам.  
> Всего активных скиллов в воркспейсе: **137**.

---

## 📑 Содержание

- [🛠️ Архитектура, Backend & Next.js 16](#-архитектура-backend-next-js-16) (12)
- [🎨 Дизайн-Система, UI & Frontend UX](#-дизайн-система-ui-frontend-ux) (18)
- [🛡️ Безопасность, 54-ФЗ, Юриспруденция & Аудит](#-безопасность-54-фз-юриспруденция-аудит) (11)
- [🧪 QA, Тестирование & Верификация](#-qa-тестирование-верификация) (10)
- [📈 Маркетинг, Конверсия (CRO) & SEO](#-маркетинг-конверсия-cro-seo) (22)
- [📊 Продукт, Аналитика & SaaS Финансы](#-продукт-аналитика-saas-финансы) (12)
- [🤖 Мультиагентные Советы & Оркестрация](#-мультиагентные-советы-оркестрация) (18)
- [📦 Дополнительные & Специализированные Скиллы](#-дополнительные-специализированные-скиллы) (34)

---

## 🛠️ Архитектура, Backend & Next.js 16

| Скилл | Папка | Описание & Назначение |
|---|---|---|
| **`zero-hallucination-coder`** | [`.agents/skills/zero-hallucination-coder`](file:///.agents/skills/zero-hallucination-coder/SKILL.md) | Runs a disciplined Discuss -> Map -> Decompose -> Execute -> Verify loop that grounds code in verified structure — no invented APIs, no assumed imports, no placeholder code — with |
| **`strict-api`** | [`.agents/skills/strict-api`](file:///.agents/skills/strict-api/SKILL.md) | Use when the user says no hallucinations, verify APIs, reality check, or dont invent functions. Prevents the agent from calling methods, imports, or variables that do not provably |
| **`sql-database-assistant`** | [`.agents/skills/sql-database-assistant`](file:///.agents/skills/sql-database-assistant/SKILL.md) | Use when the user asks to write SQL queries, optimize database performance, generate migrations, explore database schemas, or work with ORMs like Prisma, Drizzle, TypeORM, or SQLAl |
| **`feature-flags-architect`** | [`.agents/skills/feature-flags-architect`](file:///.agents/skills/feature-flags-architect/SKILL.md) | Use when adding, retiring, or auditing feature flags. Triggers on add a flag, ship behind a flag, rollout plan, kill switch, stale flags, flag debt, LaunchDarkly, GrowthBook, Stats |
| **`observability-designer`** | [`.agents/skills/observability-designer`](file:///.agents/skills/observability-designer/SKILL.md) | Design production-ready observability strategies combining metrics, logs, and traces. Includes SLI/SLO design, golden-signals monitoring, alert optimization. Use when adding observ |
| **`slo-architect`** | [`.agents/skills/slo-architect`](file:///.agents/skills/slo-architect/SKILL.md) | Use when defining, reviewing, or operating SLOs/SLIs/error budgets. Triggers on define an SLO, what should our SLO be, error budget, burn rate, SLI, service level objective, Google |
| **`code-reviewer`** | [`.agents/skills/code-reviewer`](file:///.agents/skills/code-reviewer/SKILL.md) | Code review automation for TypeScript, JavaScript, Python, Go, Swift, Kotlin, C#, .NET, Java, C, C++, Rust, Ruby, PHP, and Dart/Flutter. Analyzes PRs for complexity and risk, check |
| **`mcp-server-builder`** | [`.agents/skills/mcp-server-builder`](file:///.agents/skills/mcp-server-builder/SKILL.md) | Design and ship production-ready MCP (Model Context Protocol) servers from OpenAPI contracts instead of hand-written tool wrappers. Python and TypeScript support, schema validation |
| **`delivery-engineer-v3`** | [`.agents/skills/delivery-engineer-v3`](file:///.agents/skills/delivery-engineer-v3/SKILL.md) | Use when the user requests to implement designs, modify codebases, resolve tickets, or validate requirements. This skill audits architecture, deletes dead code, and monitors key bu |
| **`gsd-atomic-module-deepdive`** | [`.agents/skills/gsd-atomic-module-deepdive`](file:///.agents/skills/gsd-atomic-module-deepdive/SKILL.md) | Специализированный модуль |
| **`recursive-deep-work-engine`** | [`.agents/skills/recursive-deep-book-engine`](file:///.agents/skills/recursive-deep-book-engine/SKILL.md) | Универсальный рекурсивный движок глубокой декомпозиции, точечного мозгового штурма и пошагового исполнения любых объемных задач (Recursive Deep-Work & Elaboration Engine). |
| **`iterative-loop-orchestrator`** | [`.agents/skills/iterative-loop-orchestrator`](file:///.agents/skills/iterative-loop-orchestrator/SKILL.md) | Управляет закольцованной мультиагентной системой (Orchestrator -> Generator -> Auditor/Checker loop), гарантируя непрерывную работу субагентов до 100% выполнения критериев и фиксац |

---

## 🎨 Дизайн-Система, UI & Frontend UX

| Скилл | Папка | Описание & Назначение |
|---|---|---|
| **`ui-forge-harness`** | [`.agents/skills/ui-forge-harness`](file:///.agents/skills/ui-forge-harness/SKILL.md) | Автоматизированный харнес и арсенал дизайн-системы SMMflux/SMMplan для AI-агентов Antigravity. Включает готовые примитивы, микроанимации и генератор страниц. |
| **`taste-skill`** | [`.agents/skills/taste-skill`](file:///.agents/skills/taste-skill/SKILL.md) | Anti-slop frontend design taste skill for landing pages, portfolios, and web apps. Enforces design dials (VARIANCE, MOTION, DENSITY), bans AI-slop cliches (no purple neon glows, no |
| **`design-rosetta`** | [`.agents/skills/design-rosetta`](file:///.agents/skills/design-rosetta/SKILL.md) | Перевод пользовательских абстрактных запросов к интерфейсам («сделай посолиднее», «все кривое», «не читается») в жесткие ТЗ для фронтенд-агентов с экспертным контролем типографики, |
| **`design-tokens`** | [`.agents/skills/design-tokens`](file:///.agents/skills/design-tokens/SKILL.md) | Design Tokens: трёхуровневая архитектура Primitive→Semantic→Component по W3C DTCG 2025.10. OKLCH color space, dark mode как ремаппинг, Style Dictionary pipeline. Активировать при с |
| **`design-theory-foundation`** | [`.agents/skills/design-theory-foundation`](file:///.agents/skills/design-theory-foundation/SKILL.md) | Академический фундамент дизайна: 7 функций ГД, принципы CRAP, композиция, ритм, типографика, цвет, семиотика. Активировать при обучении ИИ дизайну, при audit на нарушение базовых п |
| **`design-system-management`** | [`.agents/skills/design-system-management`](file:///.agents/skills/design-system-management/SKILL.md) | Стадии зрелости дизайн-системы + Design Debt management: от ad-hoc к systematized. Активировать при создании дизайн-системы, при оценке зрелости, при управлении design debt. ALWAYS |
| **`color-system`** | [`.agents/skills/color-system`](file:///.agents/skills/color-system/SKILL.md) | OKLCH автогенерация палитры из одного цвета, perceptual uniformity, semantic color naming, dark mode. Активировать при создании цветовой системы, при генерации палитры, при настрой |
| **`cognitive-load`** | [`.agents/skills/cognitive-load`](file:///.agents/skills/cognitive-load/SKILL.md) | Управление когнитивной нагрузкой в UI: Progressive Disclosure, закон Хика, закон Фиттса, анти-паттерны перегрузки. Активировать при проектировании форм, onboarding, dashboard, при |
| **`design-for-trust`** | [`.agents/skills/design-for-trust`](file:///.agents/skills/design-for-trust/SKILL.md) | Privacy + Security UX: transparent data handling, trust signals, GDPR/CCPA compliance UX, security indicators. Активировать при проектировании форм сбора данных, privacy flows, при |
| **`accessibility-advantage`** | [`.agents/skills/accessibility-advantage`](file:///.agents/skills/accessibility-advantage/SKILL.md) | A11y = SEO + UX + юридическая защита: WCAG 2.1 AA, keyboard nav, screen reader, ARIA. Активировать при audit accessibility, при проектировании для инклюзивности, при compliance. AL |
| **`adaptive-context`** | [`.agents/skills/adaptive-context`](file:///.agents/skills/adaptive-context/SKILL.md) | Контекстная адаптация интерфейса: по источнику трафика, устройству, времени, роли. Активировать при персонализации UI, адаптивном дизайне, contextual UX, когда один размер не подхо |
| **`copywriting-ux-writing`** | [`.agents/skills/copywriting-ux-writing`](file:///.agents/skills/copywriting-ux-writing/SKILL.md) | Слова как интерфейс: CTA тексты, hero заголовки, error messages, microcopy. Слова конвертируют больше чем визуал. Активировать при написании CTA, заголовков, error messages, onboar |
| **`data-visualization-dashboard`** | [`.agents/skills/data-visualization-dashboard`](file:///.agents/skills/data-visualization-dashboard/SKILL.md) | Chart Decision Tree, Dashboard UX, data ink ratio, правильный выбор визуализации. SaaS = дашборды. Активировать при проектировании дашбордов, графиков, data viz, при выборе типа ch |
| **`make-interfaces-feel-better`** | [`.agents/skills/make-interfaces-feel-better`](file:///.agents/skills/make-interfaces-feel-better/SKILL.md) | Практические рекомендации от Jakub Krehel по улучшению пользовательских интерфейсов (UI-дизайн, анимации, визуальные детали). |
| **`stitch-design-system`** | [`.agents/skills/stitch-design-system`](file:///.agents/skills/stitch-design-system/SKILL.md) | Creates, updates, and synchronizes design systems and DESIGN.md specifications with Google Stitch MCP. Use when establishing multi-brand design tokens, uploading brand guidelines, |
| **`stitch-ui-designer`** | [`.agents/skills/stitch-ui-designer`](file:///.agents/skills/stitch-ui-designer/SKILL.md) | Generates, edits, and iterates high-fidelity UI screens and components using Google Stitch MCP. Use when designing new web/mobile UI interfaces, creating visual screen variants, or |
| **`svg-icon-finder`** | [`.agents/skills/svg-icon-finder`](file:///.agents/skills/svg-icon-finder/SKILL.md) | Strict guidelines for finding and implementing SVG icons and brand logos. Forbids AI generation of raw SVG paths. |
| **`motion-design-system`** | [`.agents/skills/motion-design-system`](file:///.agents/skills/motion-design-system/SKILL.md) | Motion = коммуникация, не украшение: timing, easing, choreography, meaningful transitions. Активировать при проектировании анимаций, transitions, micro-interactions, motion system. |

---

## 🛡️ Безопасность, 54-ФЗ, Юриспруденция & Аудит

| Скилл | Папка | Описание & Назначение |
|---|---|---|
| **`threat-detection`** | [`.agents/skills/threat-detection`](file:///.agents/skills/threat-detection/SKILL.md) | Use when hunting for threats in an environment, analyzing IOCs, or detecting behavioral anomalies in telemetry. Covers hypothesis-driven threat hunting, IOC sweep generation, z-sco |
| **`incident-response`** | [`.agents/skills/incident-response`](file:///.agents/skills/incident-response/SKILL.md) | Use when a security incident has been detected or declared and needs classification, triage, escalation path determination, and forensic evidence collection. Covers SEV1-SEV4 class |
| **`incident-commander`** | [`.agents/skills/incident-commander`](file:///.agents/skills/incident-commander/SKILL.md) | Comprehensive incident response framework from detection through resolution and post-incident review. Battle-tested SRE/DevOps practices: severity classification, timeline reconstr |
| **`ai-security`** | [`.agents/skills/ai-security`](file:///.agents/skills/ai-security/SKILL.md) | Use when assessing AI/ML systems for prompt injection, jailbreak vulnerabilities, model inversion risk, data poisoning exposure, or agent tool abuse. Covers MITRE ATLAS technique m |
| **`secrets-vault-manager`** | [`.agents/skills/secrets-vault-manager`](file:///.agents/skills/secrets-vault-manager/SKILL.md) | Use when the user asks to set up secret management infrastructure, integrate HashiCorp Vault, configure cloud secret stores (AWS Secrets Manager, Azure Key Vault, GCP Secret Manage |
| **`secret-leak-guard`** | [`.agents/skills/secret-leak-guard`](file:///.agents/skills/secret-leak-guard/SKILL.md) | Scans files, diffs, and agent-generated content for hardcoded secrets, keys, and tokens. |
| **`prompt-injection-detector`** | [`.agents/skills/prompt-injection-detector`](file:///.agents/skills/prompt-injection-detector/SKILL.md) | Analyzes content received from external sources before the agent processes or acts on it. |
| **`gsd-russian-legal-watchdog`** | [`.agents/skills/gsd-russian-legal-watchdog`](file:///.agents/skills/gsd-russian-legal-watchdog/SKILL.md) | Audits website compliance with Russian laws (152-FZ, 54-FZ, consumer protection). |
| **`gsd-legal-reverse-engineering`** | [`.agents/skills/gsd-legal-reverse-engineering`](file:///.agents/skills/gsd-legal-reverse-engineering/SKILL.md) | Legal Document Reverse Engineering & Hardening. Applies cyber-security reverse engineering methodologies (from zhaoxuya520/reverse-skill) to legal document development. |
| **`legal-brainstorm-council`** | [`.agents/skills/legal-brainstorm-council`](file:///.agents/skills/legal-brainstorm-council/SKILL.md) | Мультиагентный совет юристов: Dual-Track Dialectic, Live Judge Scoring (Win Rate), Auto-Redline Diff, Evidence Packs, Temporal GraphRAG Decay, адвокатские тактики и аудит IT-рисков |
| **`gsd-corporate-legal-team`** | [`.agents/skills/gsd-corporate-legal-team`](file:///.agents/skills/gsd-corporate-legal-team/SKILL.md) | Корпоративная команда юристов (v3.0) для SMM-панелей. |

---

## 🧪 QA, Тестирование & Верификация

| Скилл | Папка | Описание & Назначение |
|---|---|---|
| **`tdd-guide`** | [`.agents/skills/tdd-guide`](file:///.agents/skills/tdd-guide/SKILL.md) | Test-driven development skill for writing unit tests, generating test fixtures and mocks, analyzing coverage gaps, and guiding red-green-refactor workflows across Jest, Pytest, JUn |
| **`pr-review-expert`** | [`.agents/skills/pr-review-expert`](file:///.agents/skills/pr-review-expert/SKILL.md) | Use when the user asks to review pull requests, analyze code changes, check for security issues in PRs, or assess code quality of diffs. |
| **`performance-profiler`** | [`.agents/skills/performance-profiler`](file:///.agents/skills/performance-profiler/SKILL.md) | Systematic performance profiling for Node.js, Python, and Go applications. Identifies CPU, memory, and I/O bottlenecks, generates flamegraphs, analyzes bundle sizes, optimizes data |
| **`gsd-qa-tester`** | [`.agents/skills/gsd-qa-tester`](file:///.agents/skills/gsd-qa-tester/SKILL.md) | QA Engineer agent. Writes, updates, and maintains E2E (Playwright) and unit/integration tests (Vitest) alongside codebase changes. |
| **`maker-checker-protocol`** | [`.agents/skills/maker-checker-protocol`](file:///.agents/skills/maker-checker-protocol/SKILL.md) | Enforces the Maker-Checker protocol by defining a QA Reviewer subagent that checks codebase changes for quality and security compliance. |
| **`browser-visual-qa`** | [`.agents/skills/browser-visual-qa`](file:///.agents/skills/browser-visual-qa/SKILL.md) | Visual QA через Browser Sub-Agent: screenshot verification, comparison с эталоном, pre-flight check. Активировать после генерации UI, при визуальной проверке, при сравнении с дизай |
| **`dry-run-skill-tester`** | [`.agents/skills/dry-run-skill-tester`](file:///.agents/skills/dry-run-skill-tester/SKILL.md) | Provides an isolated sandbox environment to safely test and simulate other skills. |
| **`flaky-test-detective`** | [`.agents/skills/flaky-test-detective`](file:///.agents/skills/flaky-test-detective/SKILL.md) | Statically detects flaky, unreliable, and non-deterministic tests. |
| **`visual-regression-testing`** | [`.agents/skills/visual-regression-testing`](file:///.agents/skills/visual-regression-testing/SKILL.md) | Screenshot diff pipeline: автоматическая защита от визуальных багов, pixel-level comparison, CI/CD integration. Активировать при настройке visual testing, при защите от regression, |
| **`i18n-testing`** | [`.agents/skills/i18n-testing`](file:///.agents/skills/i18n-testing/SKILL.md) | I18N Testing: 4 уровня тестирования (pseudo-localization, visual, functional, cultural), missing translation detection, automated i18n audit через browser agent. Активировать при н |

---

## 📈 Маркетинг, Конверсия (CRO) & SEO

| Скилл | Папка | Описание & Назначение |
|---|---|---|
| **`page-cro`** | [`.agents/skills/page-cro`](file:///.agents/skills/page-cro/SKILL.md) | When the user wants to optimize, improve, or increase conversions on any marketing page — including homepage, landing pages, pricing pages, feature pages, or blog posts. Also use w |
| **`signup-flow-cro`** | [`.agents/skills/signup-flow-cro`](file:///.agents/skills/signup-flow-cro/SKILL.md) | When the user wants to optimize signup, registration, account creation, or trial activation flows. Also use when the user mentions signup conversions, registration friction, signup |
| **`marketing-psychology`** | [`.agents/skills/marketing-psychology`](file:///.agents/skills/marketing-psychology/SKILL.md) | When the user wants to apply psychological principles, mental models, or behavioral science to marketing. Also use when the user mentions psychology, mental models, cognitive bias, |
| **`ab-test-setup`** | [`.agents/skills/ab-test-setup`](file:///.agents/skills/ab-test-setup/SKILL.md) | When the user wants to plan, design, or implement an A/B test or experiment. Also use when the user mentions A/B test, split test, experiment, test this change, variant copy, multi |
| **`seo-audit`** | [`.agents/skills/seo-audit`](file:///.agents/skills/seo-audit/SKILL.md) | When the user wants to audit, review, or diagnose SEO issues on their site. Also use when the user mentions SEO audit, technical SEO, why am I not ranking, SEO issues, on-page SEO, |
| **`churn-prevention`** | [`.agents/skills/churn-prevention`](file:///.agents/skills/churn-prevention/SKILL.md) | Reduce voluntary and involuntary churn through cancel flow design, save offers, exit surveys, and dunning sequences. Use when designing or optimizing a cancel flow, building save o |
| **`copywriting`** | [`.agents/skills/copywriting`](file:///.agents/skills/copywriting/SKILL.md) | When the user wants to write, rewrite, or improve marketing copy for any page — including homepage, landing pages, pricing pages, feature pages, about pages, or product pages. Also |
| **`content-strategy`** | [`.agents/skills/content-strategy`](file:///.agents/skills/content-strategy/SKILL.md) | When the user wants to plan a content strategy, decide what content to create, or figure out what topics to cover. Also use when the user mentions \content strategy,\ \what should |
| **`referral-program`** | [`.agents/skills/referral-program`](file:///.agents/skills/referral-program/SKILL.md) | When the user wants to design, launch, or optimize a referral or affiliate program. Use when they mention referral program, affiliate program, word of mouth, refer a friend, incent |
| **`campaign-analytics`** | [`.agents/skills/campaign-analytics`](file:///.agents/skills/campaign-analytics/SKILL.md) | Analyzes campaign performance with multi-touch attribution, funnel conversion analysis, and ROI calculation for marketing optimization. Use when analyzing marketing campaigns, ad p |
| **`conversion-intelligence`** | [`.agents/skills/conversion-intelligence`](file:///.agents/skills/conversion-intelligence/SKILL.md) | Конверсионный интеллект: pre-design checklist, post-design validation, метрики конверсии. Активировать при проектировании лендингов, форм, checkout, при оптимизации конверсии, когд |
| **`competitor-decode`** | [`.agents/skills/competitor-decode`](file:///.agents/skills/competitor-decode/SKILL.md) | Декодирование сайтов конкурентов: структурный, психологический и бизнес-анализ. Активировать когда упоминаются конкуренты, конкурентный анализ, сравнение с другими, сделайте как у |
| **`competitor-annotation`** | [`.agents/skills/competitor-annotation`](file:///.agents/skills/competitor-annotation/SKILL.md) | 5-слойные аннотированные карточки для анализа элементов конкурентов: что это, зачем работает, для кого, риски, адаптация. Активировать когда нужен глубокий анализ конкретных элемен |
| **`competitive-monitoring`** | [`.agents/skills/competitive-monitoring`](file:///.agents/skills/competitive-monitoring/SKILL.md) | Непрерывный мониторинг конкурентов: автоматические триггеры при изменении сайтов, анализ diff, реакция на запросы сделайте как у X. Активировать когда нужен мониторинг конкурентов, |
| **`analytics-to-design`** | [`.agents/skills/analytics-to-design`](file:///.agents/skills/analytics-to-design/SKILL.md) | Данные → Гипотеза → Тест: аналитика как источник дизайн-решений, A/B тестирование, data-driven дизайн. Активировать при работе с аналитикой, при формулировании гипотез, при A/B тес |
| **`bias-to-design`** | [`.agents/skills/bias-to-design`](file:///.agents/skills/bias-to-design/SKILL.md) | Когнитивные биасы → дизайн-решения: Social Proof, Scarcity, Anchoring, Loss Aversion, Peak-End Rule. Активировать при проектировании pricing, checkout, hero, при оптимизации конвер |
| **`client-dna`** | [`.agents/skills/client-dna`](file:///.agents/skills/client-dna/SKILL.md) | Извлечение бизнес-ДНК клиента: ICP, цель страницы, возражения, tone of voice, позиционирование. Активировать ДО любой генерации UI, при работе с новым клиентом, при уточнении бизне |
| **`client-preference-interview`** | [`.agents/skills/client-preference-interview`](file:///.agents/skills/client-preference-interview/SKILL.md) | Структурированный опрос клиента в 4 раунда: ориентация, визуальная калибровка, референс-анализ, feasibility check. Активировать ПЕРЕД показом референсов, при работе с новым клиенто |
| **`micro-commitment`** | [`.agents/skills/micro-commitment`](file:///.agents/skills/micro-commitment/SKILL.md) | Лестница микро-обязательств: от нулевого трения к полному commitment. 4 уровня: анонимно, email, профиль, платёж. Активировать при проектировании funnel, onboarding, signup, trial, |
| **`first-impression`** | [`.agents/skills/first-impression`](file:///.agents/skills/first-impression/SKILL.md) | Оптимизация первых 50мс: иерархия доверия, trust signals, anti-trust patterns. 94% первых впечатлений связаны с дизайном. Активировать при проектировании hero, landing page, при оп |
| **`ru-payment-ux`** | [`.agents/skills/ru-payment-ux`](file:///.agents/skills/ru-payment-ux/SKILL.md) | Designed for Russian payment UX integration. Scans checkout flows to verify support for SBP, YooKassa, SberPay, and local BNPL. Use this skill when designing payment systems for Ru |
| **`ru-trust-conversion`** | [`.agents/skills/ru-trust-conversion`](file:///.agents/skills/ru-trust-conversion/SKILL.md) | Designed for building user trust on RuNet. Scans landing pages to audit trust indicators like legal footer info and 152-FZ compliance. Use this skill when customizing cookie consen |

---

## 📊 Продукт, Аналитика & SaaS Финансы

| Скилл | Папка | Описание & Назначение |
|---|---|---|
| **`saas-metrics-coach`** | [`.agents/skills/saas-metrics-coach`](file:///.agents/skills/saas-metrics-coach/SKILL.md) | SaaS financial health advisor. Use when a user shares revenue or customer numbers, or mentions ARR, MRR, churn, LTV, CAC, NRR, or asks how their SaaS business is doing. |
| **`code-to-prd`** | [`.agents/skills/code-to-prd`](file:///.agents/skills/code-to-prd/SKILL.md) | Reverse-engineer any codebase into a complete Product Requirements Document (PRD). Analyzes routes, components, state management, API integrations, and user interactions to produce |
| **`ux-researcher-designer`** | [`.agents/skills/ux-researcher-designer`](file:///.agents/skills/ux-researcher-designer/SKILL.md) | UX research and design toolkit for Senior UX Designer/Researcher including data-driven persona generation, journey mapping, usability testing frameworks, and research synthesis. Us |
| **`competitive-teardown`** | [`.agents/skills/competitive-teardown`](file:///.agents/skills/competitive-teardown/SKILL.md) | Analyzes competitor products and companies by synthesizing data from pricing pages, app store reviews, job postings, SEO signals, and social media into structured competitive intel |
| **`experiment-designer`** | [`.agents/skills/experiment-designer`](file:///.agents/skills/experiment-designer/SKILL.md) | Use when planning product experiments, writing testable hypotheses, estimating sample size, prioritizing tests, or interpreting A/B outcomes with practical statistical rigor. |
| **`financial-analyst`** | [`.agents/skills/financial-analyst`](file:///.agents/skills/financial-analyst/SKILL.md) | Performs financial ratio analysis, DCF valuation, budget variance analysis, and rolling forecast construction for strategic decision-making. Use when analyzing financial statements |
| **`product-analytics`** | [`.agents/skills/product-analytics`](file:///.agents/skills/product-analytics/SKILL.md) | Use when defining product KPIs, building metric dashboards, running cohort or retention analysis, or interpreting feature adoption trends across product stages. |
| **`pricing-strategy`** | [`.agents/skills/pricing-strategy`](file:///.agents/skills/pricing-strategy/SKILL.md) | Design, optimize, and communicate SaaS pricing — tier structure, value metrics, pricing pages, and price increase strategy. Use when building a pricing model from scratch, redesign |
| **`fintech-support-balance-ux`** | [`.agents/skills/fintech-support-balance-ux`](file:///.agents/skills/fintech-support-balance-ux/SKILL.md) | Специализированный скилл проектирования эргономичных, безошибочных и предиктивных финансовых интерфейсов для операторов службы поддержки и финтех-панелей. |
| **`information-architecture`** | [`.agents/skills/information-architecture`](file:///.agents/skills/information-architecture/SKILL.md) | Navigation Decision Tree, IA audit, организация контента, findability. Уходят не из-за дизайна, а из-за не найти. Активировать при проектировании навигации, структуры сайта, при au |
| **`jtbd-design`** | [`.agents/skills/jtbd-design`](file:///.agents/skills/jtbd-design/SKILL.md) | Jobs To Be Done для каждого элемента UI: кнопка нанята снижать страх, заголовок — отвечать это для меня, pricing — снимать страх денег. Активировать при проектировании конкретных U |
| **`onboarding-engineering`** | [`.agents/skills/onboarding-engineering`](file:///.agents/skills/onboarding-engineering/SKILL.md) | Time-to-Value архитектура: first value moment < 5 минут, progressive onboarding, aha-moment, retention engineering. Активировать при проектировании onboarding, первого опыта, trial |

---

## 🤖 Мультиагентные Советы & Оркестрация

| Скилл | Папка | Описание & Назначение |
|---|---|---|
| **`ai-brainstorm-council`** | [`.agents/skills/ai-brainstorm-council`](file:///.agents/skills/ai-brainstorm-council/SKILL.md) | Мультиагентный совет экспертов для мозговых штурмов по методологиям Six Thinking Hats, Delphi Consensus, Hegel Dialectic и Anti-Sycophancy Red Teaming. |
| **`design-guild-council`** | [`.agents/skills/design-guild-council`](file:///.agents/skills/design-guild-council/SKILL.md) | Флот из 15 узкоспециализированных дизайн-агентов (Atomic Design Guild v6.0 Optical Edition) для бескомпромиссного контроля шрифтов, кнопок, отступов, орфографии, CRO, анимаций, цве |
| **`expert-roles-registry`** | [`.agents/skills/expert-roles-registry`](file:///.agents/skills/expert-roles-registry/SKILL.md) | Полный каталог узкоспециализированных субагентов для SMMplan (Разработка, Тестирование, DevOps, Безопасность, Бухгалтерия 54-ФЗ, Юристы 152-ФЗ, SEO, Маркетинг). |
| **`beginner-prompt-assistant`** | [`.agents/skills/beginner-prompt-assistant`](file:///.agents/skills/beginner-prompt-assistant/SKILL.md) | Автоматический транслятор простых и неточных пользовательских запросов в строгие инженерные ТЗ для мультиагентного флота SMMplan. |
| **`gsd-round-table`** | [`.agents/skills/gsd-round-table`](file:///.agents/skills/gsd-round-table/SKILL.md) | Invokes the Native Round Table Multi-Agent Team (9 Experts) pre-trained on SMMplans core stack (Next.js 16, React 19, Tailwind 4, HeroUI v3). |
| **`gsd-chunked-auditor`** | [`.agents/skills/gsd-chunked-auditor`](file:///.agents/skills/gsd-chunked-auditor/SKILL.md) | Prepares chunked audit markdown prompts for external LLMs (Claude, GLM, etc.), grouping codebase files by logical domain and adding schema and project rules context. |
| **`agent-handoff-protocol`** | [`.agents/skills/agent-handoff-protocol`](file:///.agents/skills/agent-handoff-protocol/SKILL.md) | Manages structured context transfer between agents in multi-agent |
| **`context-budget-monitor`** | [`.agents/skills/context-budget-monitor`](file:///.agents/skills/context-budget-monitor/SKILL.md) | Audits the token budget of the current agent session by measuring skill size. |
| **`conflict-resolution-arbitrator`** | [`.agents/skills/conflict-resolution-arbitrator`](file:///.agents/skills/conflict-resolution-arbitrator/SKILL.md) | Detects, analyzes, and safely resolves file modification conflicts. |
| **`ephemeral-skill-cleanup`** | [`.agents/skills/ephemeral-skill-cleanup`](file:///.agents/skills/ephemeral-skill-cleanup/SKILL.md) | Scans, identifies, and retires expired, stale, deprecated, duplicate, or draft skills from the workspace skills repository. Use after a sprint or hackathon, when skill count is hig |
| **`multi-agent-orchestration`** | [`.agents/skills/multi-agent-orchestration`](file:///.agents/skills/multi-agent-orchestration/SKILL.md) | Параллельные агенты: дизайн+copy+performance, orchestration protocol, handoff between skills. Активировать при комплексных задачах требующих несколько скиллов, при параллельной раб |
| **`round-table-planning`** | [`.agents/skills/round-table-planning`](file:///.agents/skills/round-table-planning/SKILL.md) | Runs before complex multi-step web development tasks on Smmplan. Uses a simulated round-table of |
| **`skill-activation-logger`** | [`.agents/skills/skill-activation-logger`](file:///.agents/skills/skill-activation-logger/SKILL.md) | Logs and audits the agents autonomous skill activation process. |
| **`skill-deduplication-audit`** | [`.agents/skills/skill-deduplication-audit`](file:///.agents/skills/skill-deduplication-audit/SKILL.md) | Detects overlapping, duplicate, and conflicting skills across the installed skill ecosystem. |
| **`skill-governance-policy`** | [`.agents/skills/skill-governance-policy`](file:///.agents/skills/skill-governance-policy/SKILL.md) | Enforces enterprise and team governance rules for creating, modifying, |
| **`skill-health-checker`** | [`.agents/skills/skill-health-checker`](file:///.agents/skills/skill-health-checker/SKILL.md) | Lints and validates SKILL.md files for structural integrity, frontmatter correctness, |
| **`skills-co-pilot`** | [`.agents/skills/skills-co-pilot`](file:///.agents/skills/skills-co-pilot/SKILL.md) | Interactively monitors code modifications and developer behavior via git |
| **`token-cost-estimator`** | [`.agents/skills/token-cost-estimator`](file:///.agents/skills/token-cost-estimator/SKILL.md) | Estimates token consumption and monetary cost of agent tasks before execution. |

---

## 📦 Дополнительные & Специализированные Скиллы

| Скилл | Папка | Описание & Назначение |
|---|---|---|
| **`antigravity`** | [`.agents/skills/antigravity`](file:///.agents/skills/antigravity/SKILL.md) | Комплексный аудит и обеспечение безопасности баз данных PostgreSQL в проекте. |
| **`ex-1-init`** | [`.agents/skills/ex-1-init`](file:///.agents/skills/ex-1-init/SKILL.md) | ПЕРВЫЙ ШАГ. Активируй когда начинаешь новый проект или сессию. |
| **`ex-2-plan`** | [`.agents/skills/ex-2-plan`](file:///.agents/skills/ex-2-plan/SKILL.md) | ВТОРОЙ ШАГ каскада. Активируй после ex-1-init. |
| **`ex-3-build`** | [`.agents/skills/ex-3-build`](file:///.agents/skills/ex-3-build/SKILL.md) | ТРЕТИЙ ШАГ каскада. Активируй после ex-2-plan. |
| **`ex-4-check`** | [`.agents/skills/ex-4-check`](file:///.agents/skills/ex-4-check/SKILL.md) | ЧЕТВЁРТЫЙ ШАГ каскада. Активируй после ex-3-build. |
| **`ex-5-handoff`** | [`.agents/skills/ex-5-handoff`](file:///.agents/skills/ex-5-handoff/SKILL.md) | ПЯТЫЙ ШАГ каскада. Финальный шаг перед передачей Reviewerу. |
| **`feasibility-check`** | [`.agents/skills/feasibility-check`](file:///.agents/skills/feasibility-check/SKILL.md) | Проверка реализуемости дизайн-решений по 4 осям: контент, техника, бренд, ресурсы. Активировать после выбора дизайн-решения, при оценке можем ли мы это сделать, перед promises клие |
| **`figma-mcp`** | [`.agents/skills/figma-mcp`](file:///.agents/skills/figma-mcp/SKILL.md) | Connects to Figma via MCP, scans Figma design files, analyzes UI components, |
| **`gsd-auditor-agent`** | [`.agents/skills/gsd-auditor-agent`](file:///.agents/skills/gsd-auditor-agent/SKILL.md) | Audits developer payloads, validates architecture and reliability, and checks files. |
| **`gsd-client-orientation`** | [`.agents/skills/gsd-client-orientation`](file:///.agents/skills/gsd-client-orientation/SKILL.md) | Enforces client-orientation principles across UI/UX implementations in Smmplan. |
| **`gsd-grill-focus-group`** | [`.agents/skills/gsd-grill-focus-group`](file:///.agents/skills/gsd-grill-focus-group/SKILL.md) | Simulates, grills, critiques, and validates architecture plans, implementation plans, and UI/UX designs using a synthetic focus group of AI personas. Use when analyzing technical p |
| **`gsd-maker-agent`** | [`.agents/skills/gsd-maker-agent`](file:///.agents/skills/gsd-maker-agent/SKILL.md) | Decomposes tasks, performs double-pass planning, writes code, and prepares payloads. |
| **`gsd-plan-re-evaluation`** | [`.agents/skills/gsd-plan-re-evaluation`](file:///.agents/skills/gsd-plan-re-evaluation/SKILL.md) | Double-pass planning agent with automated plan density and AGENTS.md contract compliance checks. Use when creating an implementation plan, before displaying the plan to the user, o |
| **`gsd-production-critic`** | [`.agents/skills/gsd-production-critic`](file:///.agents/skills/gsd-production-critic/SKILL.md) | Audits implemented code, validates security, and scans for race conditions in a project. |
| **`internationalization-localization`** | [`.agents/skills/internationalization-localization`](file:///.agents/skills/internationalization-localization/SKILL.md) | i18n и l10n: полная архитектура от code-level до культурной адаптации. RTL, text expansion, ICU Message Format, Intl API, визуальная локализация, правовые требования по рынкам, pse |
| **`legal-localization`** | [`.agents/skills/legal-localization`](file:///.agents/skills/legal-localization/SKILL.md) | Legal Localization: правовые требования по рынкам (GDPR, 152-ФЗ, CCPA, ADA, FTC, ICP China, MENA культурные требования). Активировать при проектировании для EU/Россия/США/MENA/Chin |
| **`mcp-server-health-check`** | [`.agents/skills/mcp-server-health-check`](file:///.agents/skills/mcp-server-health-check/SKILL.md) | Validates, pings, checks, and audits external MCP server availability and tool schemas. |
| **`multilingual-typography`** | [`.agents/skills/multilingual-typography`](file:///.agents/skills/multilingual-typography/SKILL.md) | Multilingual Typography: шрифтовые стратегии по скриптам (Latin, Cyrillic, Arabic, CJK, Hebrew), Unicode font coverage, line-height по скриптам, @font-face с unicode-range. Активир |
| **`owasp-security-auditor`** | [`.agents/skills/owasp-security-auditor`](file:///.agents/skills/owasp-security-auditor/SKILL.md) | Performs a comprehensive OWASP-based security audit of a software project. |
| **`performance-design`** | [`.agents/skills/performance-design`](file:///.agents/skills/performance-design/SKILL.md) | Core Web Vitals → дизайн-решения: LCP, FID, CLS оптимизация через дизайн. 57% уходят если >3с загрузки. Активировать при оптимизации производительности, при влиянии дизайна на скор |
| **`react-expert`** | [`.agents/skills/react-expert`](file:///.agents/skills/react-expert/SKILL.md) | Use when the user requests to analyze, research, or audit React API behaviors. This skill analyzes tests and source code to validate Flow and TypeScript signatures before writing d |
| **`rtl-design`** | [`.agents/skills/rtl-design`](file:///.agents/skills/rtl-design/SKILL.md) | RTL Design: CSS logical properties, зеркалирование layout/иконок, bidi контент, Arabic/Hebrew typography. Активировать при RTL поддержке, при арабском/иврите, при зеркалировании la |
| **`ru-cis-market-design`** | [`.agents/skills/ru-cis-market-design`](file:///.agents/skills/ru-cis-market-design/SKILL.md) | Designed for Russian and CIS market projects. Scans user interfaces to align layout density with local visual expectations. Use this skill when adapting Western designs to RuNet, b |
| **`ru-cyrillic-typography`** | [`.agents/skills/ru-cyrillic-typography`](file:///.agents/skills/ru-cyrillic-typography/SKILL.md) | Designed for Cyrillic typography optimization. Scans interface texts to verify line-height and text expansion adjustments (+15-20% for Russian). Use this skill when selecting fonts |
| **`ru-visual-culture`** | [`.agents/skills/ru-visual-culture`](file:///.agents/skills/ru-visual-culture/SKILL.md) | Designed for visual aesthetics in the CIS region. Scans page colors and grid structures to ensure alignment with Russian visual culture. Use this skill when defining dark mode styl |
| **`skill-localization`** | [`.agents/skills/skill-localization`](file:///.agents/skills/skill-localization/SKILL.md) | Enforces locale and language preferences for agent-generated artifacts. |
| **`skill-versioning`** | [`.agents/skills/skill-versioning`](file:///.agents/skills/skill-versioning/SKILL.md) | Manages semantic versioning, history snapshots, changelog generation, and rollback for SKILL.md files. |
| **`smm-legal-marketing-symbiosis`** | [`.agents/skills/smm-legal-marketing-symbiosis`](file:///.agents/skills/smm-legal-marketing-symbiosis/SKILL.md) | Разработка клиентоориентированных, но юридически защищенных ответов на претензии и угрозы пользователей SMM-панелей. Симбиоз маркетинга и права. |
| **`steal-adapt-reject`** | [`.agents/skills/steal-adapt-reject`](file:///.agents/skills/steal-adapt-reject/SKILL.md) | Матрица решений для адаптации конкурентных решений: STEAL (взять), ADAPT (адаптировать), REJECT (отклонить). Активировать при работе с референсами конкурентов, когда нужно решить ч |
| **`tech-relevance-auditor`** | [`.agents/skills/tech-relevance-auditor`](file:///.agents/skills/tech-relevance-auditor/SKILL.md) | Audits the workspace technical stack, including NPM library versions, |
| **`technical-debt-annotator`** | [`.agents/skills/technical-debt-annotator`](file:///.agents/skills/technical-debt-annotator/SKILL.md) | Detects, annotates, and tracks technical debt in code. Finds hardcoded |
| **`text-expansion`** | [`.agents/skills/text-expansion`](file:///.agents/skills/text-expansion/SKILL.md) | Text Expansion для i18n: German Test, expansion rates по языкам, pseudo-localization, CSS решения для кнопок/nav/cards/tables. Активировать при проверке layout на переполнение при |
| **`visual-localization`** | [`.agents/skills/visual-localization`](file:///.agents/skills/visual-localization/SKILL.md) | Visual Localization: культурная адаптация изображений, иконок, цветов. СТОП-лист культурно-чувствительных иконок, безопасные универсальные иконки, directional иконки для RTL, cultu |
| **`workspace-snapshot`** | [`.agents/skills/workspace-snapshot`](file:///.agents/skills/workspace-snapshot/SKILL.md) | Scans, creates, restores, backs up, and validates local workspace states to prevent code loss. |

---

## 🚀 Инструкция: Как вызывать и использовать скиллы

1. **Автоматический вызов агентом**: Antigravity/Cursor/Claude автоматически активирует нужный скилл при совпадении с контекстом задачи.
2. **Явный вызов разработчиком в чате**:
   - Назовите имя скилла: *"Используй скилл `zero-hallucination-coder` для генерации типов"*
   - Или запросите аудит: *"Прогони `page-cro` по странице /dashboard/deposit"*
3. **Регламент расширения**: Новые скиллы добавляются строго в директорию `.agents/skills/<skill-name>/` с валидным файлом `SKILL.md`.
