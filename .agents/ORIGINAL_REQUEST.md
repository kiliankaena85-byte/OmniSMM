# Original User Request

## 2026-08-17T07:54:31Z

Разработка и интеграция модулей операционной и финансовой надежности в панель администратора платформы SMMplan / SMMflux: мониторинг балансов провайдеров в реальном времени, автоматическая сверка проводок Ledger, курсорная пагинация и клавиатурная эргономика.

Working directory: d:/SMM_plan_2
Integrity mode: development

## Requirements

### R1. Provider Health & Balance Monitor
- Реализовать автоматический опрос и отображение текущих балансов всех активных провайдеров на странице `/admin/providers` и в сводном виджете дашборда.
- Добавить цветовую индикацию статуса (Зеленый: >50$, Желтый: 10-50$, Красный алерт: <10$) для предотвращения зависания заказов из-за исчерпания средств.
- Реализовать фоновый кэш балансов в Redis с TTL 60 секунд для исключения блокировки UI.

### R2. Ledger Reconciliation Guard (Финансовая Сверка)
- Создать дашборд автоматической сверки проводок в разделе `/admin/finance`.
- Проверять соответствие суммы всех дебетовых/кредитовых проводок в `LedgerEntry` текущему `User.balance` для каждого пользователя.
- При обнаружении расхождений подсвечивать аномальные аккаунты с кнопкой аудита транзакций.

### R3. Keyset Pagination & B-Tree Index Optimization
- Оптимизировать выборку данных в административных таблицах (`Orders`, `Ledger`, `Users`) с использованием курсорной пагинации (`cursor` по `id` + `createdAt`).
- Гарантировать время отклика запросов < 30ms при объемах базы данных свыше 50 000 записей.

### R4. Keyboard-First & Range Selection Ergonomics
- Реализовать выбор диапазона строк через `Shift + Click` в таблице каталога (`catalog-table-v2.tsx`) и таблице заказов.
- Добавить шорткат модального окна справки по горячим клавишам (клавиша `?`).

## Acceptance Criteria

### Automated Verification & Integrity
- [ ] `npx tsc --noEmit` завершается с кодом 0 (0 ошибок типизации).
- [ ] Все новые финансовые операции проводятся строго через `WalletOps` в копейках (`BigInt`) с `idempotencyKey`.
- [ ] Рейтинг Дизайн-Гильдии сохраняется на уровне 100/100 (`npx tsx scripts/harness/design-guild.ts audit admin`).
- [ ] Прогон тестов `npx vitest run` проходит без регрессий.

## 2026-09-11T05:25:49Z

Разработать и внедрить полный комплект из 11 специализированных архитектурных скиллов (Architectural Skills Suite) для AI-ассистентов платформы OmniSMM в директории `.agents/skills/` с параллельным распределением задач по 4 доменным кластерам.

Working directory: c:/Users/Shadow/Documents/SMM/.agents/skills
Integrity mode: development

## Requirements

### R1. Кластер 1 — Доменные границы и системный дизайн (Domain & Boundary Cluster)
Создать 3 скилла с полным описанием, деревьями решений, антипаттернами и чеклистами:
- `arch-boundary-guard`: Защита границ слоев (Hexagonal/Clean Architecture), предотвращение спагетти-зависимостей, разделение DTO <-> Domain <-> DB Model, контроль размера компонентов и Server Actions.
- `ddd-aggregate-invariants`: Инварианты агрегатов, транзакционная граница «1 транзакция = 1 агрегат», запрет мутации дочерних сущностей в обход корня агрегата.
- `adr-architect`: Формат MADR (Context, Decision, Consequences, Alternatives), аудит существующих решений и предотвращение регрессий и «архитектурной амнезии».

### R2. Кластер 2 — Распределенные данные, транзакции и надежность (Distributed & Concurrency Cluster)
Создать 3 скилла для критических сценариев работы с данными:
- `concurrency-acid-guard`: Защита от состояний гонки (TOCTOU, Lost Updates), Row-Level Locking (`SELECT ... FOR UPDATE`), Ledger-First, ExactMath, детекция Transaction Escape (`db` vs `tx`), паттерны идемпотентности.
- `db-evolution-zero-downtime`: Паттерн Expand/Contract для миграций PostgreSQL без простоя, безопасные DDL, детекция блокировок таблиц.
- `event-driven-reliability`: Transactional Outbox, защита от Dual-Write, идемпотентные консьюмеры (BullMQ), Dead-Letter Queue (DLQ) с экспоненциальным backoff.

### R3. Кластер 3 — Отказоустойчивость, изоляция и мульти-тенантность (Resilience & Multi-Tenant Cluster)
Создать 2 скилла для изоляции сбоев и тенантов:
- `resilience-bulkhead-circuit`: Circuit Breaker (Closed/Open/Half-Open), Bulkhead per-tenant/per-provider, изоляция пулов коннектов, обязательные сетевые таймауты (`AbortSignal.timeout`), Graceful Degradation.
- `multi-tenant-isolation-arch`: Полная изоляция тенантов (OmniSMM / SMMplan / SMMflux), tenant-aware кэширование, RLS / обязательный скоупинг `where: { tenantId }`, барьер ст. 54.1 НК РФ для юрлиц и касс.

### R4. Кластер 4 — Контракты API, аудит влияния и производительность (API, Blast Radius & NFR Cluster)
Создать 3 скилла для долгосрочной стабильности кодовой базы:
- `api-contract-evolver`: Contract-First подход, детекция Breaking Changes в схемах и DTO до слияния, версионирование и плавное устаревание (Deprecation).
- `impact-blast-radius`: Анализ радиуса поражения (Blast Radius Mapping), расчет связанности (Afferent/Efferent coupling), моделирование отказа на 3 шага вперед (Pre-Mortem Failure Simulation).
- `nfr-performance-budget`: Контроль нефункциональных требований (P95/P99 latency budget, детекция N+1 запросов в Prisma, Tree-shaking, лимиты пула соединений).

### R5. Каталогизация и документация
- Создать единый реестр `.agents/skills/INDEX.md` с описанием каждого скилла, ключевыми словами для триггера, сценариями применения и кросс-ссылками.

## Acceptance Criteria

### Структурная полнота
- [ ] Для всех 11 скиллов создана отдельная директория в `c:/Users/Shadow/Documents/SMM/.agents/skills/<skill-name>/` с валидным файлом `SKILL.md`.
- [ ] Каждый `SKILL.md` содержит корректный YAML frontmatter (`name`, `description`).
- [ ] Каждый скилл содержит 4 обязательных раздела: 
  1. *Дерево решений (Decision Tree / Flowchart)*
  2. *Жесткие инварианты и табу (Hard Invariants & Anti-Patterns)*
  3. *Премортем-анализ и моделирование отказов (Failure Scenarios)*
  4. *Чеклист верификации (Verification Checklist)*
- [ ] Создан файл `c:/Users/Shadow/Documents/SMM/.agents/skills/INDEX.md` с полным реестром всех 11 скиллов.

### Качество и отсутствие дефектов
- [ ] Тексты скиллов точно адаптированы под реальный стек проекта: Next.js 16 (App Router), React 19, Tailwind 4, Prisma 5, PostgreSQL, BullMQ, Redis, Vitest.
- [ ] Отсутствуют заглушки `TODO`, плейсхолдеры и битые относительные ссылки.
