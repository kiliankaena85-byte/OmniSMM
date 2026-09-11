/**
 * seed-ai-methodologies-memory.ts
 * Скрипт регистрации 2026 AI-методологий и архитектурных инвариантов
 * в долговременную память OmniSMM (GraphRAG / SmmplanMemoryClient).
 */

import { SmmplanMemoryClient, ArchitecturalDecisionEntry } from './memory-client';

const methodologies: ArchitecturalDecisionEntry[] = [
  {
    title: 'SDD-TDD 2026: Spec-Driven & Test-Driven Development Pipeline',
    context: 'Исключение когнитивной предвзятости (Confirmation Bias), галлюцинаций типов и поломки контрактов при генерации кода ИИ-агентами.',
    decision: 'Внедрен строгий 5-фазный пайплайн: 1) Спецификация контрактов и инвариантов в docs/specs/ (Zod DTOs + FSM + Edge Cases Matrix); 2) Human Approval Gate; 3) Написание падающих тестов в Vitest (Red Phase); 4) Минимальная реализация кода (Green Phase); 5) Актуализация living docs. Градация рисков: Tier 1 (Critical) — 100% SDD+TDD; Tier 2 (Standard) — Light-SDD; Tier 3 (Cosmetic) — Direct + Visual Audit.',
    rationale: 'Предотвращает написание "тестов задним числом", гарантирует объективную функцию потерь для LLM через падающий assertion, исключает дрейф контрактов между бэкендом и UI.',
    tags: ['sdd', 'tdd', 'spec_driven', 'methodology', 'quality_gate', 'vitest', 'zod'],
    importance: 1.0,
    decayRate: 0.0,
  },
  {
    title: 'OmniSMM Architectural Skills Suite: 11 Доменных Инвариантов платформы',
    context: 'Предотвращение архитектурной эрозии, спагетти-кода и транзакционного побега при автономной работе агентов.',
    decision: 'Развернут и закреплен в AGENTS.md нормативный комплект из 11 специализированных архитектурных скиллов в .agents/skills/ (arch-boundary-guard, ddd-aggregate-invariants, adr-architect, concurrency-acid-guard, db-evolution-zero-downtime, event-driven-reliability, resilience-bulkhead-circuit, multi-tenant-isolation-arch, api-contract-evolver, impact-blast-radius, nfr-performance-budget) и мастер-реестр INDEX.md.',
    rationale: 'Каждый скилл дает агенту четкое дерево решений (Decision Tree), список абсолютных табу (Hard Invariants), премортем-моделирование и чеклист верификации перед коммитом.',
    tags: ['architecture', 'skills', 'invariants', 'hexagonal', 'acid', 'resilience', 'blast_radius'],
    importance: 1.0,
    decayRate: 0.0,
  },
  {
    title: 'Maker-Checker Protocol: Двухагентное разделение контекста разработки и ревью',
    context: 'Авторский когнитивный сдвиг (Author Bias): одна модель не замечает собственных архитектурных и логических ошибок.',
    decision: 'Разделение ролей на Maker (агент с доступом к записи, создающий код и тесты по спеке) и Checker (изолированный Read-Only субагент qa_reviewer). Checker проверяет соответствие контрактам, отсутствие any/TODO, утечек секретов и соответствие семантическим токенам без возможности править код.',
    rationale: 'Полная изоляция ревьюера от промежуточных рассуждений создателя гарантирует непредвзятый аудит и блокирует мерж некачественного кода.',
    tags: ['maker_checker', 'dual_agent', 'qa_reviewer', 'adversarial_review', 'code_quality'],
    importance: 0.95,
    decayRate: 0.0,
  },
  {
    title: 'Ephemeral Sandbox & Visual Verification Loop (BGS-2026)',
    context: 'Невозможность гарантировать визуальную корректность UI, верстки и z-index исключительно через консольные юнит-тесты.',
    decision: 'Любое изменение собирается в изолированном Stage-контуре (:3005) smmplan_stage без трогания продакшна (:3000). Проводится автоматизированный Headless аудит через Puppeteer под 4 ролями (Гость, B2C User, Support, Owner) с контролем ошибок гидратации, отсутствия горизонтального скролла и снятием скриншотов перед Human Approval.',
    rationale: 'Исключает падение боевого контейнера, гарантирует соответствие W3C WCAG 2.2 AA и NN/g эвристикам, обеспечивает 5-секундный мгновенный откат.',
    tags: ['blue_green', 'stage_3005', 'puppeteer', 'visual_audit', 'e2e', 'wcag'],
    importance: 0.95,
    decayRate: 0.0,
  },
  {
    title: 'Continuous Architectural Memory & Temporal GraphRAG (4-Tier Memory)',
    context: 'Архитектурная амнезия при длинных сессиях и сменах контекста между независимыми агентами.',
    decision: 'Внедрение 4-уровневой системы памяти: 1) Working Memory (активная задача); 2) Episodic Memory (.planning/episodes/); 3) Semantic Memory (Neo4j граф зависимостей + локальный кэш .planning/memory_cache.json); 4) Procedural Memory (валидаторы и доказательные пакеты .planning/evidence_packs). Учет фактора затухания (Temporal Decay) для устаревших законов и протоколов.',
    rationale: 'Сохраняет преемственность архитектурных решений, связывает функции с таблицами БД и ADR через топологический граф.',
    tags: ['graphrag', 'memory', 'temporal_decay', 'neo4j', 'episodic_memory', 'knowledge_graph'],
    importance: 1.0,
    decayRate: 0.0,
  },
  {
    title: 'LLM Mutation Testing & Adversarial Red Teaming',
    context: 'Ложное чувство надежности от 100% покрытия кода бессмысленными тестами-пустышками без реальных ассертов.',
    decision: 'Применение состязательного агента-мутатора, внедряющего микро-дефекты в код (ExactMath мутации, инверсия условий Drip-Feed Floor, снятие tenantId скоупинга). Тестовый сьют обязан обнаружить мутацию и упасть (Mutation Score >= 85%). Выжившие мутанты отправляются Maker-агенту на доработку тестов.',
    rationale: 'Тестирует не код, а качество самих тестов. Гарантирует, что тесты отлавливают реальные логические и финансовые сбои.',
    tags: ['mutation_testing', 'red_teaming', 'adversarial', 'test_quality', 'fuzzing'],
    importance: 0.9,
    decayRate: 0.0,
  },
  {
    title: 'Multi-Model Jury System: Консилиум разнородных семейств LLM',
    context: 'Семейные слепые пятна отдельных языковых моделей при аудите критических финансовых и инфраструктурных узлов.',
    decision: 'Для Tier 1 Critical задач план и спецификация отправляются вслепую (Blind Review) 3 независимым семействам моделей (напр. Claude 3.7 Sonnet, OpenAI o3-mini/GPT-4o, DeepSeek V3/R1). Для одобрения требуется консенсус >= 2/3 голосов при отсутствии категорических вето (Zero Blocker).',
    rationale: 'Устраняет зависимость от индивидуальных ошибок одной модели, объединяя архитектурную строгость Claude, пентест-экспертизу OpenAI и математическую точность DeepSeek.',
    tags: ['multi_model', 'jury', 'consensus', 'blind_review', 'openrouter'],
    importance: 0.9,
    decayRate: 0.0,
  },
  {
    title: 'Policy-as-Code & AST-Grep Syntactic Guardrails',
    context: 'Текстовые правила в системных промптах нарушаются агентами при переполнении контекстного окна.',
    decision: 'Преобразование ключевых архитектурных инвариантов в машинные AST-линтеры (ast-grep / custom ESLint): блокировка вызова db.* внутри prisma.$transaction (Transaction Escape), запрет "use server" в page.tsx, запрет float-чисел в расчете баланса. Нарушение вызывает мгновенный Build Fail на этапе tsc/pre-commit.',
    rationale: 'Создает непреодолимые компиляционные рельсы, физически блокирующие агенту генерацию некорректных конструкций.',
    tags: ['policy_as_code', 'ast_grep', 'guardrails', 'linters', 'syntax_tree', 'fail_closed'],
    importance: 0.95,
    decayRate: 0.0,
  },
  {
    title: 'Closed-Loop Autonomous Self-Healing & Telemetry OODA Loop',
    context: 'Длительный MTTR (4-24 часа) при ручном разборе продакшн-ошибок разработчиком.',
    decision: 'Замкнутый цикл реакции на продакшн-инциденты: 1) Observe: перехват необработанного исключения из логов/Sentry; 2) Orient: обезличивание PII и автогенерация воспроизводящего падающего юнит-теста; 3) Decide: поиск коммита-виновника и формулирование минимального хотфикса; 4) Act: верификация фикса на тесте, проверка на Stage (:3005) и формирование 1-кнопочного отчета для человека.',
    rationale: 'Сокращает время устранения сбоев с часов до минут при сохранении полного контроля человека через Human Approval Gate.',
    tags: ['self_healing', 'ooda_loop', 'telemetry', 'incident_management', 'automated_hotfix'],
    importance: 0.9,
    decayRate: 0.0,
  },
];

async function main() {
  const client = new SmmplanMemoryClient();
  console.log('🚀 [MemorySeeder] Seeding 2026 AI Methodologies into OmniSMM Memory System...\n');

  for (const item of methodologies) {
    await client.recordDecision(item);
  }

  console.log('\n✅ [MemorySeeder] Successfully seeded all 9 foundational methodologies into memory!');
  console.log('🔍 [MemorySeeder] Running verification search...');

  const results = await client.searchContext('sdd-tdd spec-driven');
  console.log(`\nFound ${results.length} results for 'sdd-tdd spec-driven':`);
  results.forEach((r, i) => {
    console.log(`[${i + 1}] ${r.title} (score: ${r.score})`);
  });
}

main().catch((err) => {
  console.error('❌ [MemorySeeder] Failed to seed memory:', err);
  process.exit(1);
});
