# 🏛️ OmniSMM Architectural Skills Suite & AI Contracts (v1.0.0)

> **Полная экосистема из 56 инженерных скиллов, нормативных контрактов `AGENTS.md` и инвариантов надежности для ИИ-ассистентов (Google Antigravity, Cursor, Claude Code, Windsurf, Roo Code, GitHub Copilot).**

---

## 🌟 О проекте

**OmniSMM Architectural Skills Suite** — это производственный стандарт инженерных практик, архитектурных контрактов и проверенных шаблонов проектирования, разработанный для высоконагруженных платформ (OmniSMM 1.0, SMMplan, SMMflux).

Пакет позволяет любому AI-ассистенту действовать как Senior Fullstack & System Architect:
1. **Предотвращать регрессии:** моделировать сбои на 3 шага вперед и картировать радиус поражения (Impact Blast Radius).
2. **Гарантировать финансовую целостность:** Ledger-First принцип, чистый `BigInt` (копейки ExactMath), идемпотентность P2002.
3. **Обеспечивать пентест-иммунитет:** защита по OWASP Top 10:2025, ASVS v4.0.3 Level 2, Timing-Safe HMAC, RFC 9331 RateLimit, Strict-Dynamic Nonce.
4. **Соблюдать фискальный комплаенс 2026:** онлайн-чеки 54-ФЗ, НДС 22%, порог УСН 20 млн ₽ (ФЗ № 176-ФЗ / 425-ФЗ).
5. **Изолировать тенанты:** предотвращение Brand Bleeding между доменами и защита по ст. 54.1 НК РФ.
6. **Контролировать UX/UI:** Zero Horizontal Scroll, Touch Target $\ge 44\text{px}$, Tailwind CSS 4.

---

## 🚀 Быстрая установка (Installation)

### Способ 1: В проект на Windows (PowerShell)
```powershell
# Установка в текущий проект
powershell -ExecutionPolicy Bypass -File packages/agent-skills/scripts/install.ps1

# Установка в другой проект с настройкой Cursor и Claude Code
powershell -ExecutionPolicy Bypass -File packages/agent-skills/scripts/install.ps1 -TargetDir "C:\Path\To\YourProject" -SetupCursor -SetupClaude
```

### Способ 2: В проект на Linux / macOS (Bash)
```bash
# Установка в текущую директорию
bash packages/agent-skills/scripts/install.sh

# Установка в целевой репозиторий
bash packages/agent-skills/scripts/install.sh /path/to/target-project
```

### Способ 3: Глобальная установка в Google Antigravity
```powershell
# Устанавливает все 56 скиллов в профиль Antigravity (~/.gemini/antigravity/skills/)
powershell -ExecutionPolicy Bypass -File packages/agent-skills/scripts/install.ps1 -GlobalAntigravity
```

### Способ 4: Ручная установка
1. Скопируйте папку `.agents/` в корень вашего проекта.
2. Скопируйте файл `AGENTS.md` в корень вашего проекта.
3. Добавьте в правила вашей IDE ссылку на `AGENTS.md` (шаблоны лежат в `templates/`).

---

## 🛠️ Интеграция с AI IDE

| Среда разработки | Способ подключения | Конфигурационный файл |
| :--- | :--- | :--- |
| **Google Antigravity** | Нативная поддержка директорий `.agents/skills` и `~/.gemini/antigravity/skills` | `AGENTS.md` и `.agents/skills/*/SKILL.md` |
| **Cursor IDE** | Файл правил в корне репозитория | `.cursorrules` (шаблон в `templates/.cursorrules`) |
| **Claude Code** | Контекстный файл проекта | `CLAUDE.md` (шаблон в `templates/CLAUDE.md`) |
| **Windsurf / Cascade** | Файл системных инструкций | `.windsurfrules` (шаблон в `templates/.windsurfrules`) |
| **Roo Code / Cline** | Пользовательские промпты и скиллы | `.roomodes` / `.clinerules` |

---

## 📚 Каталог и Матрица Скиллов (56 Скиллов)

### Кластер 1: Архитектурные границы & DDD (Domain Purity)
- [**`arch-boundary-guard`**](./.agents/skills/arch-boundary-guard/SKILL.md) — Чистота слоев Clean Architecture, запрет прямого доступа к БД из UI, DTO без секретов, лимит компонентов $\le 200$ строк.
- [**`ddd-aggregate-invariants`**](./.agents/skills/ddd-aggregate-invariants/SKILL.md) — «1 транзакция = 1 агрегат», Ledger-First, Drip-Feed Floor Invariant, буфер Shadow Catalog в Redis.
- [**`catalog-taxonomy-curator`**](./.agents/skills/catalog-taxonomy-curator/SKILL.md) — Каноническое дерево категорий ($\le 9$ на сеть), авто-токенизация, слияние дублей.
- [**`provider-catalog-importer`**](./.agents/skills/provider-catalog-importer/SKILL.md) — AI-мастер импорта каталогов провайдеров, HITL-арбитраж, автоматический расчет маржи.
- [**`adr-architect`**](./.agents/skills/adr-architect/SKILL.md) — Ведение архитектурных решений по стандарту MADR 3.0, синхронизация с RAG-памятью, защита канона.
- [**`compliance-54fz-auditor`**](./.agents/skills/compliance-54fz-auditor/SKILL.md) — Фискальный комплаенс 54-ФЗ, НДС 2026 (22% и лимит УСН 20 млн ₽), реквизиты ФФД 1.2, ст. 54.1 НК РФ.

### Кластер 2: Распределенные системы & Финансы (ACID & Concurrency)
- [**`concurrency-acid-guard`**](./.agents/skills/concurrency-acid-guard/SKILL.md) — Защита от TOCTOU, Lost Updates и Double-Spending; `BigInt` ExactMath, дедупликация `idempotencyKey` (P2002), Row-Level Locking.
- [**`db-evolution-zero-downtime`**](./.agents/skills/db-evolution-zero-downtime/SKILL.md) — Паттерн Expand/Contract, запрет In-Place Breaking DDL, безопасные индексы `CREATE INDEX CONCURRENTLY`, лимиты `lock_timeout`.
- [**`event-driven-reliability`**](./.agents/skills/event-driven-reliability/SKILL.md) — Защита от Dual-Write через Transactional Outbox, Exactly-Once доставка, BullMQ воркеры с Check-Then-Set, DLQ.
- [**`payment-gateway-fuzzer`**](./.agents/skills/payment-gateway-fuzzer/SKILL.md) — Фаззинг и стресс-тестирование шлюзов (ЮKassa, Robokassa, CryptoBot), гонки вебхуков, защита от Double-Crediting.

### Кластер 3: Отказоустойчивость & Мульти-тенантность (Resilience)
- [**`resilience-bulkhead-circuit`**](./.agents/skills/resilience-bulkhead-circuit/SKILL.md) — Распределенный Circuit Breaker в Redis (Closed/Open/Half-Open), изоляция отсеков Bulkhead, таймауты `AbortSignal.timeout`.
- [**`multi-tenant-isolation-arch`**](./.agents/skills/multi-tenant-isolation-arch/SKILL.md) — Изоляция тенантов в БД (`where: { tenantId }`), tenant-aware кэширование, разделение касс 54-ФЗ.

### Кластер 4: Контракты API, Радиус поражения & Производительность (NFR)
- [**`api-contract-evolver`**](./.agents/skills/api-contract-evolver/SKILL.md) — Contract-First на базе Zod, 100% обратная совместимость (Zero Breaking Changes), RFC 8594 Sunset/Deprecation.
- [**`impact-blast-radius`**](./.agents/skills/impact-blast-radius/SKILL.md) — Картирование радиуса поражения через `grep_search`, моделирование отказа на 3 шага вперед.
- [**`nfr-performance-budget`**](./.agents/skills/nfr-performance-budget/SKILL.md) — Контроль бюджетов задержек (Admin P95 < 200ms, DB Query < 30ms), запрет `OFFSET` (Keyset cursor), искоренение N+1.
- [**`production-readiness-guard`**](./.agents/skills/production-readiness-guard/SKILL.md) — 10 производственных инвариантов: O(1) RAM Streams, Zero Unbounded Cache, Deterministic Timeouts.
- [**`postgres-query-doctor`**](./.agents/skills/postgres-query-doctor/SKILL.md) — Профилирование PostgreSQL и Prisma 5, Keyset-пагинация, Tenant-First составные индексы.

### Кластер 5: AI Governance & Мульти-агентный Консилиум
- [**`maker-checker-protocol`**](./.agents/skills/maker-checker-protocol/SKILL.md) — Разделение Создатель vs Ревизор, закон эпистемической изоляции, физический запрет записи (Zero-Write Sandbox).
- [**`multi-model-jury`**](./.agents/skills/multi-model-jury/SKILL.md) — Слепой арбитраж 3 гетерогенных LLM (Claude, OpenAI, DeepSeek), право абсолютного вето при блокерах.
- [**`llm-mutation-testing`**](./.agents/skills/llm-mutation-testing/SKILL.md) — Состязательный взлом кода (Adversarial Red Team), инъекция семантических мутаций в финансы и безопасность.
- [**`ephemeral-sandbox-visual-loop`**](./.agents/skills/ephemeral-sandbox-visual-loop/SKILL.md) — Изоляция Blue-Green Stage (:3005), многоролевой Headless аудит в Chromium, No Horizontal Scroll.
- [**`self-healing-ooda-loop`**](./.agents/skills/self-healing-ooda-loop/SKILL.md) — Замкнутый цикл OODA (Observe-Orient-Decide-Act), авто-тест репродукции (Red Phase), синтез хотфикса.
- [**`gsd-round-table`**](./.agents/skills/gsd-round-table/SKILL.md) — Нативный мульти-агентный круглый стол из 9 отраслевых экспертов.
- [**`gsd-chunked-auditor`**](./.agents/skills/gsd-chunked-auditor/SKILL.md) — Подготовка чанкованных промптов для внешних моделей аудита.
- [**`gsd-qa-tester`**](./.agents/skills/gsd-qa-tester/SKILL.md) — Автоматизированный инженер контроля качества (Vitest + Playwright).

### Кластер 6: Инфраструктура, Docker & Host Ops
- [**`docker-lean-build-ops`**](./.agents/skills/docker-lean-build-ops/SKILL.md) — Бережливая сборка без зависания ПК (BelowNormal, CPU Affinity), очистка .next/cache и Docker-мусора, защита WSL2 VHDX.
- [**`docker-memory-ops`**](./.agents/skills/docker-memory-ops/SKILL.md) — SRE-контроль памяти: cgroups v2, headroom, drop_caches, V8 heap dump, Golden Ratio RAM.
- [**`clash-verge-atomics`**](./.agents/skills/clash-verge-atomics/SKILL.md) — 3-уровневый Profile Enhancement (Merge/Script/Rules), Named Pipe IPC, стабильный туннель в РФ.

### Кластер 7: Кибербезопасность & Защита от Угроз
- [**`owasp-asvs-sentinel`**](./.agents/skills/owasp-asvs-sentinel/SKILL.md) — Пентест-иммунитет OWASP Top 10:2025 и ASVS v4.0.3 L2, Guest-Proof IDOR, Timing-Safe HMAC, RFC 9331 RateLimit, Strict-Dynamic Nonce.
- [**`competitor-threat-shield`**](./.agents/skills/competitor-threat-shield/SKILL.md) — Защита от гибридных атак конкурентов: дренаж провайдеров, Drip-Feed Floor, кардинг/чарджбэки, фискальный DDoS.

### Кластер 8: Spec-Driven Development (21 Скилл SpecKit)
Полный цикл проектирования и реализации спецификаций:
- `speckit-specify`, `speckit-clarify`, `speckit-plan`, `speckit-tasks`, `speckit-implement`, `speckit-converge`
- `speckit-assess-intake`, `speckit-assess-define`, `speckit-assess-research`, `speckit-assess-shape`, `speckit-assess-decide`
- `speckit-bug-assess`, `speckit-bug-fix`, `speckit-bug-test`
- `speckit-git-initialize`, `speckit-git-feature`, `speckit-git-commit`, `speckit-git-validate`, `speckit-git-remote`
- `speckit-checklist`, `speckit-analyze`, `speckit-agent-context-update`, `speckit-constitution`

---

## 📋 Проверка целостности (Verification)
Запустите скрипт проверки целостности всех скиллов:
```bash
npm run verify
# или
npx tsx scripts/verify-skills.ts
```
Вывод подтверждает 100% готовность:
```
Verified 56/56 architectural skills (100% valid).
```

---

## 📄 Лицензия
MIT © OmniSMM Engineering Team
