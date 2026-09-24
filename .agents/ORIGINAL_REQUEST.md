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

## 2026-09-14T05:29:03Z

Комплексный аналитический аудит, классификация пограничных сценариев (edge cases) и разработка спецификации с интерактивным опросником для валидатора ссылок, многокатегорийных услуг и динамических полей заказа платформы SMMplan/OmniSMM.

Working directory: c:\Users\Shadow\Documents\SMM
Integrity mode: development

## Reference Materials
- Архитектура валидатора: `src/services/link-engine/` (`unified-link-engine.ts`, `link-rules-registry.ts`, `link-canonicalizer.ts`, `link-domain-router.ts`)
- Семантика типов услуг: `src/utils/target-type-mapper.ts` (`resolveServiceTargetType`)
- Текущие схемы и орхестратор: `src/components/landing/order-engine/useCheckoutOrchestrator.ts`, `src/actions/order/checkout.ts`, `prisma/schema.prisma`
- Существующие стресс- и unit-тесты: `src/__tests__/unit/unified-link-engine.test.ts`, `src/__tests__/stress/link-validator-stress.test.ts`

## Requirements

### R1. Систематизация пограничных случаев (Edge Cases Matrix)
Провести глубокий аудит базы данных услуг и каталога соцсетей (Telegram, VK, YouTube, Instagram, TikTok, Twitch, Rutube, Дзен, X/Twitter, Discord и др.) и составить полную таксономическую матрицу нестандартных типов услуг:
1. **Многокатегорийная применимость (1 ссылка -> N категорий):** например, ссылка на канал Telegram подходит под «Подписчики», «Просмотры на будущие посты», «Реакции», «Бусты/Голоса». Описать правила разрешения конфликтов, приоритеты и интерфейс выбора намерения пользователя.
2. **Автоматические и подписочные услуги:** услуги с интервалами, авто-просмотрами на X будущих публикаций, отслеживанием стримов/онлайна.
3. **Закрытые и приватные сущности:** приватные Telegram-каналы/чаты (`t.me/+hash`, `t.me/joinchat/...`), закрытые профили Instagram/VK, пригласительные ссылки Discord.
4. **Услуги с динамическими дополнительными полями ввода:**
   - Пользовательские комментарии (список строк, разделители, минимальное/максимальное количество строк, валидация цензуры/эмодзи).
   - Выбор эмодзи/реакций (одиночные, множественные, кастомные).
   - Медиагруппы и альбомы (ссылки на конкретное фото/видео внутри карусели).
   - Опросы и голосования (номер/текст варианта ответа).
   - Списки логинов (для услуг упоминаний/рассылок).
5. **Специфика форматов URL соцсетей:** истории/сториз (`/s/`), форумные топики (`/topic/`), клипы/Reels/Shorts, прямые эфиры/трансляции, репосты/реплаи.

### R2. Интерактивный опросник и протокол согласования (User Elicitation Guide)
Разработать исчерпывающий структурированный опросник для владельца продукта / оператора по каждому спорному или неоднозначному пограничному случаю:
- Для каждого сценария сформулировать: описание ситуации, почему возникает развилка, возможные варианты поведения системы (UX визарда, валидация бэкенда, ошибки и подсказки), рекомендуемый вариант и последствия для смежных контуров (биллинг, провайдеры API, автодоставка).
- Опросник должен быть готов к проведению интерактивной сессии согласования бизнес-логики.

### R3. Спецификация контрактов и архитектуры (Specification Document)
Создать спецификацию в `docs/specs/SPEC-2026-LINK-EDGE-CASES.md`, формализующую:
- DTO и Zod-схемы для всех кастомных полей ввода (`customData`, `comments`, `reactions`, `targetPosts`).
- Инварианты совместимости типов ссылок и категорий (`isLinkCompatibleWithCategory`).
- Поведение 4-шагового визарда заказа при пересечении категорий и вводе сложных ссылок.
- Ограничения безопасности (SSRF, ReDoS, XSS в комментариях, лимиты памяти).

### R4. Набор верификационных тест-кейсов и векторов (Test Vector Suite)
Сформировать структурированный эталонный набор верификационных данных (не менее 60 тестовых векторов):
- Позитивные ссылки и параметры для каждого пограничного типа.
- Негативные ссылки с проверкой корректности и понятности сообщений об ошибках.
- Граничные условия для дополнительных полей (пустые строки, оверквоты, спецсимволы).
- Подготовить тест-сьют для Vitest (`src/__tests__/unit/edge-cases-matrix.test.ts`), готовый к исполнению.

## Acceptance Criteria

### Полнота матрицы (Coverage)
- [ ] Охвачены все активные платформы и категории каталога без пробелов.
- [ ] Каждый пограничный случай категоризирован по уровню критичности (Critical, Major, Minor) с четким описанием входов и выходов.

### Готовность опросника (Actionable Elicitation)
- [ ] Опросник разбит по тематическим блокам с готовыми вариантами выбора и критериями приемки.
- [ ] Отсутствуют открытые «размытые» вопросы без вариантов решений.

### Качество спецификации (Spec Integrity)
- [ ] Документ спецификации оформлен в `docs/specs/SPEC-2026-LINK-EDGE-CASES.md` согласно регламенту SDD/RAC-2026.
- [ ] Zod-схемы и интерфейсы TypeScript строго типизированы (strict mode, no any).

### Верифицируемость (Test Harness)
- [ ] Создан воспроизводимый датасет верификационных векторов.
- [ ] Написаны и задокументированы тесты соответствия контрактам в Vitest.

## 2026-09-14T21:56:42Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview
> Requested team: [none — teamwork routes from the description]

Implement an explicit warning toast when a user pastes multiple links on the B2C landing page, replacing the current silent truncation behavior.

Working directory: e:\SMM

## Requirements

### R1. Prevent Silent Data Loss
When a user pastes text containing multiple lines or links into `HeroInput.tsx` or `MobileStep1Link.tsx`, the system currently silently discards all but the first line. Change this behavior so that if multiple lines are detected during a paste event, a clear toast notification is shown to the user informing them that only the first link was kept for quick checkout, and directing them to use their dashboard for mass orders.

### R2. Adhere to SIL-2026 Zero-Regression Protocol
Ensure that single links, emails, and bare handles continue to paste perfectly. Do not re-introduce the legacy `UniversalOrderForm` into the B2C landing page. Update any tests if necessary to ensure `vitest` passes without errors.

## Acceptance Criteria

### UX & Functionality
- [ ] Pasting a multi-line string triggers a specific toast warning.
- [ ] The first link of the pasted text is successfully set in the input field.
- [ ] Single links, emails, and handles are processed normally without the multi-line toast.
- [ ] `tsc --noEmit` and `vitest` pass with zero regressions.

## 2026-09-24T05:56:59Z

Комплексный статический и аналитический аудит кодовой базы OmniSMM 1.0 (Next.js 16, Prisma ORM, PostgreSQL, BullMQ, Redis) с целью выявления скрытых дефектов, антипаттернов работы с базой данных (Prisma N+1, утечки транзакций, неоптимальные индексы), узких мест в очередях фоновых задач (BullMQ / Redis) и узких мест производительности, замедляющих время отклика системы (P95/P99 latency). Результатом является подробный ранжированный отчёт (P0/P1/P2) с изолированными воспроизводящими тестами без изменения продуктового кода.

Working directory: c:/Users/Shadow/omnismm
Integrity mode: development

## Requirements

### R1. Аудит слоя базы данных и Prisma ORM (Prisma & Database Reliability)
Выявить антипаттерны запросов к PostgreSQL: детекция скрытых N+1 циклов, запросы без необходимых индексов по `tenantId` / `status` / `createdAt`, отсутствие лимитов и пагинации при выборках, потенциальные утечки контекста транзакций (`tx` vs глобальный `db`) и долгие блокировки строк (Row-Level Locking).

### R2. Анализ фоновых очередей задач и воркеров (BullMQ & Redis Architecture)
Проанализировать обработчики фоновых задач и очередей: выявить риски зависания джобов (отсутствие таймаутов `AbortSignal.timeout()`), отсутствие корректной обработки Dead Letter Queue (DLQ), утечки памяти в процессах воркеров, коллизии повторной обработки и нарушение идемпотентности.

### R3. Профилирование узких мест производительности (Performance & Event Loop Bottlenecks)
Найти критические участки, вызывающие задержки обработки запросов (P95/P99 latency): блокировки Node.js Event Loop тяжелыми синхронными вычислениями (crypto, тяжелая сериализация/парсинг JSON, регулярные выражения с катастрофическим бэктрекингом), избыточные повторные вызовы внешних провайдеров без кэширования, неэффективные Server Actions.

### R4. Аудит параллелизма и целостности финансовых транзакций (Concurrency & ACID Audit)
Проверить операции с балансом пользователя (`WalletOps`), оформление заказов и вебхуки на предмет уязвимостей типа Time-of-Check to Time-of-Use (TOCTOU), гонок параллельных запросов (Race conditions) и обхода идемпотентности.

### R5. Воспроизводящие тесты и итоговый отчёт (Evidence-Based Reporting & Benchmarks)
Каждая найденная критическая уязвимость или узкое место производительности (P0 и P1) должна сопровождаться точным файлом и диапазоном строк кода, сценарием воспроизведения и изолированным воспроизводящим тестом (Vitest) в `src/__tests__/audit/` или минимальным скриптом воспроизведения, демонстрирующим проблему.

## Acceptance Criteria

### 1. Полнота охвата и качество отчёта
- [ ] Сформирован подробный итоговый документ `AUDIT_PERFORMANCE_AND_RELIABILITY_2026.md` с классификацией всех найденных проблем по уровням критичности: P0 (критические сбои/утечки/гонки), P1 (существенные деградации/N+1), P2 (рекомендации по оптимизации архитектуры).
- [ ] Для каждой обнаруженной проблемы указаны: точный путь к файлу, диапазон строк, природа дефекта (почему это замедляет систему или приводит к ошибкам) и конкретная рекомендация по исправлению.

### 2. Объективная верификация через тесты (Reproducibility)
- [ ] Для подтверждённых проблем категорий P0 и P1 созданы изолированные воспроизводящие тесты в `src/__tests__/audit/`, фиксирующие сбой, избыточное число запросов или деградацию производительности.
- [ ] Все существующие тесты проекта (`npx vitest run -c vitest.unit.config.ts`) продолжают успешно проходить (100% PASS), подтверждая отсутствие непреднамеренных регрессий в кодовой базе.

### 3. Инвариант неизменности боевого кода
- [ ] Никакие файлы в `src/` (за исключением новой тестовой директории `src/__tests__/audit/`) не модифицированы — продуктовый код платформы остаётся строго неприкосновенным до явного согласования внедрения исправлений.
