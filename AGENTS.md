# AGENTS.md — Smmplan AI Developer Contract (v4.1)
# Этот файл — единый источник правды для ЛЮБОГО AI-ассистента (Cursor, Claude Code, Gemini, Antigravity).
# Все генерируемые изменения ОБЯЗАНЫ строго соблюдать эти правила.

## 0. ⛔ SESSION INIT — ОБЯЗАТЕЛЬНЫЙ ПЕРВЫЙ ШАГ (BLOCKING)

> ❌ **ЗАПРЕЩЕНО** начинать любую работу без выполнения этого раздела.
> Это не рекомендация — это блокирующее требование контракта.

## 0.5. 🛑 ZERO-DEFECT BLUE-GREEN STAGE & DEPLOYMENT GATE (CRITICAL RULE — BGS-2026)
> ⚠️ **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО напрямую пересобирать или перезапускать рабочий боевой контейнер (In-Place Production Rebuild).**
> **Любое изменение обязано проходить 5-шаговый пайплайн безопасного релиза (Blue-Green Deployment Protocol):**
> 1. **Изоляция и сборка в Stage-контуре (Port 3005):**
>    - Боевой контейнер (`:3000`) остается неприкосновенным.
>    - Изменения собираются и запускаются в изолированном проверочном инстансе/контейнере (`smmplan_stage` на порту `3005`).
> 2. **Автоматический визуальный аудит в браузере (Puppeteer MCP / Headless Chrome):**
>    - Агент обязан запустить браузер, авторизоваться под ключевыми ролями (`USER`, `SUPPORT`, `OWNER`) на порту `3005`, снять скриншоты измененных страниц (`/dashboard`, `/admin/dashboard`, `/add-funds` и др.) и проверить отсутствие ошибок рендеринга, наложения элементов и утечек данных.
> 3. **Отчет для человека с визуальными доказательствами (Human Approval Gate):**
>    - Агент ОБЯЗАН предоставить подробный отчет со скриншотами и списком изменений:
>      - Что конкретно изменено (файлы и логика).
>      - Результаты браузерных тестов и скриншоты.
>      - Подтверждение отсутствия утечек секретов (`check-bundle-secrets.mjs`) и 100% прохождения тестов безопасности OWASP Top 10 (2025/2026).
>      - Контроль Git (`git status`, атомарный коммит и `git push` в `origin/main`).
> 4. **Прямое подтверждение пользователя:**
>    - ❌ **ЗАПРЕЩЕНО** переключать рабочий контейнер до явного сообщения пользователя: *«Одобряю»*, *«Выкатывай»*.
> 5. **Мгновенное переключение (Zero-Downtime Cutover) & Гарантия отката (5s Instant Rollback):**
>    - Только после согласования трафик переключается на проверенную версию. Предыдущий рабочий образ сохраняется как `smmplan_backup` для возможности моментального отката за 5 секунд.

## 0.6. 📋 RELEASE ACCEPTANCE CRITERIA (RAC-2026 STANDARDS GATE — CRITICAL)
> 🛡️ **Каждое обновление платформы ОБЯЗАНО соответствовать действующим стандартам 2025–2026 гг., зафиксированным в [`docs/RELEASE_ACCEPTANCE_CRITERIA_2026.md`](file:///d:/SMM_plan_2/docs/RELEASE_ACCEPTANCE_CRITERIA_2026.md):**
> 1. **Кибербезопасность & Pentest Immunity:** OWASP Top 10:2025 (A01-A10), OWASP ASVS v4.0.3 Level 2, PCI DSS v4.0.1 (Req 3.4, 6.4, 8.3, 10.2), RFC 9116 (`security.txt`), RFC 9331 (`RateLimit`), 152-ФЗ / GDPR.
> 2. **Финтех, Биллинг & Фискализация:** 54-ФЗ + 176-ФЗ/425-ФЗ (НДС 22%, порог УСН 20 млн ₽, `vat_code`), чистый `BigInt` (копейки, ExactMath), Ledger-First принцип, `idempotencyKey`.
> 3. **UX/UI, Дизайн-система & Доступность:** W3C WCAG 2.2 Level AA (Touch Target $\ge 44\text{px}$, Контраст $\ge 4.5:1$), ISO 9241-110:2020, NN/g 10 эвристик (Best Match Rule, единая витрина шлюзов, Zero Horizontal Scroll).
> 4. **Бизнес-логика & Multi-Tenant:** OmniSMM 1.0 (SMMplan / SMMflux), Drip-Feed Floor Invariant ($\lfloor Q/N \rfloor \ge \text{minQty}$), Shadow Catalog buffer.
> 5. **Качество кода & CI/CD:** Server Actions typed `{ success, error }`, TypeScript strict (0 errors), Vitest (100% pass), CI-гейты секретов.

## 0.7. 🛡️ ZERO-REGRESSION & IMPACT RADIUS PROTOCOL (ПРАВИЛО ПРЕДОТВРАЩЕНИЯ РЕГРЕССИЙ И АНАЛИЗ НА 3 ШАГА ВПЕРЁД — CRITICAL)
> ⚠️ **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО вносить изменения в изолированную функцию без проверки радиуса поражения и сквозного тестирования смежных контуров («Починил одно — сломал другое»).**
> 
> **Обязательный 3-шаговый алгоритм действий перед КАЖДЫМ редактированием:**
> 1. **Шаг 1: Оценка радиуса поражения (Impact Radius Mapping):**
>    - Перед изменением общей функции, хука, Server Action, утилиты или схемы БД выполни поиск всех зависимостей (`grep_search`).
>    - Если компонент используется в 2+ местах (например, в лендинге, в дашборде и в админке), правка обязана быть обратно-совместимой.
> 2. **Шаг 2: Мозговой штурм на 3 шага вперёд (Pre-Mortem Failure Simulation):**
>    - Проанализируй: *«Если эта правка сработает иначе, какие 3 смежные функции могут пострадать?»* (Аутентификация, баланс/леджер, кэширование, мобильный визард, вебхуки, мульти-тенантность).
>    - Заложи защитные барьеры (Fail-Closed guards, валидаторы типов, Fallback-значения) ДО применения правки.
> 3. **Шаг 3: Сквозная верификация всей системы (Full-Spectrum Regression Gate):**
>    - ❌ **ЗАПРЕЩЕНО** проверять только один точечный файл.
## 0.8. 🚀 MANDATORY PRODUCTION HARDENING GATE (PROD-SEC-2026 — CRITICAL GATE)
> ⚠️ **ПРАВИЛО ОБЯЗАТЕЛЬНОГО ВЫПОЛНЕНИЯ ПЕРЕД ВЫКАТКОЙ В ПРОДАКШН:**
> При подготовке и выкатке платформы на боевой продакшн-сервер (Production Rollout) агент **ОБЯЗАН** закрыть и верифицировать следующие три задачи безопасности из бэклога:
> 1. **[SEC-001] Redis Authentication & Encryption (Hardening):** В боевом окружении `REDIS_URL` обязан использовать защищенный протокол с авторизацией (`rediss://...` или `redis://:<STRONG_PASSWORD>@...`), устраняя ворнинг `Redis is running in production without explicit authentication`.
> 2. **[SEC-002] Content-Security-Policy (Strict-Dynamic Migration):** Провести зачистку `'unsafe-inline'` и `'unsafe-eval'` из директивы `script-src` в `src/proxy.ts`, обеспечив полную совместимость клиентских компонентов с криптографическим Nonce.
> 3. **[SEC-003] Production Direct SMTP Verification:** Проверить прямую доставку почты по порту 465 без локальных прокси/TUN-адаптеров (`test-connection` к SMTP Яндекса/Mail.ru на целевом хосте), подтвердив успешную отправку Magic Link реальному пользователю.
> ❌ **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО** объявлять продакшн-релиз завершённым без закрытия этих трёх условий.

## 0.9. 🛑 MANDATORY FULLSTACK ANALYST & HUMAN APPROVAL PROTOCOL (CRITICAL RULE — FA-2026)
> ⚠️ **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО вносить ЛЮБЫЕ изменения, правки в код, конфигурации (Docker, DNS, Cloudflare, туннели, сетевые маршруты) без предварительного глубокого аудита через Fullstack-аналитика и явного прямого согласования с пользователем.**
> 
> **Железный порядок действий:**
> 1. **Fullstack Анализ (Предварительный аудит):** Любая задача или проблема сначала разбирается комплексно (архитектура, безопасность, суверенная доступность в РФ / ТСПУ, UX, радиус поражения).
> 2. **Согласование с пользователем (Human Approval Gate):** Агент обязан предоставить понятный план и варианты решения и **ждать явного одобрения пользователя** («Делай», «Согласовано»).
> 3. **Строгий запрет самовольных действий:** ❌ **ЗАПРЕЩЕНО** самовольно перенастраивать DNS, поднимать/гасить сторонние шлюзы, менять проксирование или вносить изменения за рамками согласованного скоупа.

## 0.10. 🏛️ MANDATORY ARCHITECTURAL SKILLS SUITE GATE (ARCH-SKILLS-2026 — CRITICAL CONTRACT)
> ⚠️ **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО вносить архитектурные, инфраструктурные или структурные изменения в платформу без сверки с профильным архитектурным скиллом из единого реестра [`.agents/skills/INDEX.md`](file:///c:/Users/Shadow/Documents/SMM/.agents/skills/INDEX.md).**
> 
> Перед изменением кода агент **ОБЯЗАН** активировать соответствующий скилл и соблюдать его Decision Tree, Hard Invariants и Pre-Mortem чеклист:
> 1. **Слои и компоненты:** [`arch-boundary-guard`](file:///c:/Users/Shadow/Documents/SMM/.agents/skills/arch-boundary-guard/SKILL.md) — чистота Clean Architecture, разделение DTO/Domain/DB, запрет `"use server"` в `page.tsx`, лимит компонентов $\le 200$ строк.
> 2. **Агрегаты и бизнес-правила:** [`ddd-aggregate-invariants`](file:///c:/Users/Shadow/Documents/SMM/.agents/skills/ddd-aggregate-invariants/SKILL.md) — «1 транзакция = 1 агрегат», Drip-Feed Floor ($\lfloor Q/N \rfloor \ge \text{minQty}$), Shadow Catalog buffer в Redis.
> 3. **Архитектурные решения:** [`adr-architect`](file:///c:/Users/Shadow/Documents/SMM/.agents/skills/adr-architect/SKILL.md) — стандарт MADR 3.0, фиксация контекста/последствий, предотвращение «архитектурной амнезии».
> 4. **Деньги, баланс, гонки:** [`concurrency-acid-guard`](file:///c:/Users/Shadow/Documents/SMM/.agents/skills/concurrency-acid-guard/SKILL.md) — TOCTOU, Row-Level Locking, Ledger-First, ExactMath (копейки BigInt), детекция Transaction Escape (`db` vs `tx`), `idempotencyKey`.
> 5. **Миграции и DDL БД:** [`db-evolution-zero-downtime`](file:///c:/Users/Shadow/Documents/SMM/.agents/skills/db-evolution-zero-downtime/SKILL.md) — Expand/Contract pattern, `CREATE INDEX CONCURRENTLY`, лимиты `lock_timeout`.
> 6. **Очереди и события:** [`event-driven-reliability`](file:///c:/Users/Shadow/Documents/SMM/.agents/skills/event-driven-reliability/SKILL.md) — Transactional Outbox (защита от Dual-Write), идемпотентные консьюмеры BullMQ, DLQ.
> 7. **Внешние API и сбои:** [`resilience-bulkhead-circuit`](file:///c:/Users/Shadow/Documents/SMM/.agents/skills/resilience-bulkhead-circuit/SKILL.md) — Circuit Breaker (Redis), Per-Tenant/Per-Provider Bulkhead, обязательные таймауты `AbortSignal.timeout()`.
> 8. **Мульти-тенантность:** [`multi-tenant-isolation-arch`](file:///c:/Users/Shadow/Documents/SMM/.agents/skills/multi-tenant-isolation-arch/SKILL.md) — изоляция OmniSMM (SMMplan / SMMflux), tenant-aware кэши, барьер ст. 54.1 НК РФ.
> 9. **API и DTO:** [`api-contract-evolver`](file:///c:/Users/Shadow/Documents/SMM/.agents/skills/api-contract-evolver/SKILL.md) — Contract-First (Zod), Zero Breaking Changes, RFC 8594 Sunset/Deprecation.
> 10. **Анализ влияния:** [`impact-blast-radius`](file:///c:/Users/Shadow/Documents/SMM/.agents/skills/impact-blast-radius/SKILL.md) — картирование зависимостей через `grep_search`, моделирование отказа на 3 шага вперед.
> 11. **Производительность:** [`nfr-performance-budget`](file:///c:/Users/Shadow/Documents/SMM/.agents/skills/nfr-performance-budget/SKILL.md) — P95/P99 latency budgets, детекция N+1 в Prisma, Keyset пагинация, connection pool limits.

## 0.11. 📐 MANDATORY SPEC-DRIVEN & TEST-DRIVEN PIPELINE (SDD-TDD 2026 — CRITICAL GATE)
> ⚠️ **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО писать продуктовый код без предварительно созданной спецификации в `docs/specs/` и написанных падающих тестов (Red Phase).**
> 
> **Трехуровневая классификация рисков (Risk-Tiering):**
> 1. **Tier 1 (Critical):** Финансы (`WalletOps`, баланс, леджер), заказы, Drip-Feed, миграции БД, очереди BullMQ, аутентификация/секреты, платежные вебхуки.
>    - **Строгий протокол:** Создание `docs/specs/SPEC-YYYY-MM-DD-<slug>.md` $\to$ Согласование пользователем $\to$ Написание тестов в `src/__tests__/` (Red Phase — тесты обязаны упасть) $\to$ Реализация минимального кода (Green Phase) $\to$ `tsc --noEmit` & аудит секретов.
> 2. **Tier 2 (Standard):** Новые страницы админки, Server Actions, API роуты, сложные формы и фильтры каталога.
>    - **Light-SDD:** Файл спецификации в `docs/specs/` (Zod DTOs + Edge Cases) $\to$ Согласование пользователем $\to$ Тесты контракта $\to$ Реализация.
> 3. **Tier 3 (Cosmetic):** Стили Tailwind, тексты, замена иконок, верстка существующих компонентов.
>    - Прямая реализация с визуальным аудитом в браузере (Puppeteer MCP) без избыточного оверхеда спек.



### При каждом старте сессии в этом проекте:

1. **Прочитай файл-якорь** → `d:\SMM_plan_2\CURRENT_STATE.md`
   - Убедись, что знаешь текущую активную вкладку и список завершённых экранов
   - Выведи 1-строчное резюме: "Активная задача: X. Завершено: A, B, C."

2. **Запроси RAG-память** (для нетривиальных задач) → `http://localhost:8100/api/search`
   ```bash
   npx tsx scripts/memory-client.ts searchContext "<тема задачи>"
   ```
   Или через curl: `POST http://localhost:8100/api/search` с `{"query": "...", "collections": ["architecture_decisions","business_rules"], "top_k": 5}`

3. **После завершения задачи — немедленно обнови:**
   - `d:\SMM_plan_2\CURRENT_STATE.md` — статус текущего экрана
   - `d:\SMM_plan_2\MEMORY.md` — раздел 2, если задача существенная
   - GraphRAG: `POST http://localhost:8100/api/decision` — если принято архитектурное решение

---


## 1. Стек и окружение
- **Framework**: Next.js 16.x (App Router, Turbopack)
- **UI**: React 19.x
- **Styling**: Tailwind CSS 4.0.0 (`@theme` в `src/app/globals.css`, CSS-first config)
- **Component Library**: HeroUI v3 (dot notation API: `<Table.Header>`, `<Table.Column>`)
- **ORM**: Prisma 5 (PostgreSQL)
- **Language**: TypeScript 5.7+ (strict mode)
- **AI Models**: `gemini-3-flash` или `gemini-3-flash-preview`
- **Linting & Testing**: ESLint 10 (Flat Config — `eslint.config.mjs`) | Vitest 4
- **CI / GitHub Actions**: Node.js 24 runner standard (`actions/checkout@v7`, `actions/setup-node@v7`)

---

## 2. Архитектурные границы и безопасность (CRITICAL)

### Server/Client Boundary & Error Handling
- **Server Components** по умолчанию. `'use client'` только при наличии React hooks или Browser APIs.
- **Server Actions** строго в `src/actions/` с обязательным guard `requireAdmin()` или `requireStaffPermission()`.
- ❌ **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО** ставить `"use server"` в Page Components (`page.tsx`) — вызывает краш приложения.
- ❌ **ЗАПРЕЩЕНО** выбрасывать необработанные `throw new Error(...)` внутри Server Actions (Next.js в production маскирует их в `"An unexpected response was received from the server."`).
- ✅ Все Server Actions обязаны возвращать типизированный результат: `return { success: false, error: 'Понятное сообщение' }`.
- ❌ **ЗАПРЕЩЕНО** добавлять стандартные библиотеки (`ioredis`, `sanitize-html`, `bullmq`) в `serverExternalPackages` в `next.config.mjs` (вызывает сбой поиска хэшированных модулей в standalone).
- ✅ **Standalone Сборка:** Для сборки продакшен-бандла использовать `next build --webpack`. Перед перезапуском Docker (`docker-compose up -d --build web`) всегда запускать `npm run build` на хосте.

### Multi-Tenant Architecture & OmniSMM 1.0 Engine
- **Материнская платформа / Движок администрирования называется строго OmniSMM 1.0** (в сайдбаре, заголовках, Telegram-алертах и шапке).
- Платформа OmniSMM обслуживает витрины и бренды: **SMMplan** (`smmplan.pro`) и **SMMflux** (`smmflux.ru`) с возможностью динамического масштабирования на новые тенанты.
- ❌ **Брендов Lovable и SMMboost НЕ существует.** Запрещено добавлять фантомные бренды в код, конфиги или макеты. Алиас `normalizeTenantId('lovable')` -> `'flux'` сохранен для обратной совместимости.
- ✅ **Глобальный переключатель сайтов в Header:** Переключение между тенантами (`SMMplan` / `SMMflux`) осуществляется **ГЛОБАЛЬНО в верхней панели (Header/Navbar)** через `<GlobalSiteSwitcher />` с сохранением в куке `x_admin_tenant` и параметре `?tenant=...`.
- ❌ **ЗАПРЕЩЕНО** хардкодить хосты (`smmplan.pro`, `smmflux.ru`) в коде. Использовать `getTenantHost(tenantId)`.
- ✅ **Canonical URLs** обязаны быть абсолютными через `absoluteCanonical(tenantId, path)`.
- ✅ Кэш-ключи в `unstable_cache` обязаны включать `tenantId` (например, `catalog-${tenantId}`).

### Official Tunnel & Network Binding Invariants (Tailscale Funnel)
- ❌ **Cloudflare API и Cloudflare Tunnel заблокированы на территории РФ** и вызывают сбои TLS handshake и таймауты. ЗАПРЕЩЕНО использовать Cloudflare API и контейнеры cloudflared.
- ✅ **Официальный туннель платформы — Tailscale Funnel:** Все внешние запросы маршрутизируются через ноду `https://desktop-25m6el7.tailbb9d28.ts.net`, стабильно проксирующую на `http://127.0.0.1:3000`.
- ✅ **Сетевой биндинг:** Сервер Next.js обязан запускаться с `HOSTNAME="0.0.0.0"` и `PORT="3000"`, обеспечивая стабильный доступ для Tailscale Funnel и браузерных E2E-тестов.

### Финансовая безопасность (Trust Boundary) & Ledger Invariants
- ❌ **ЗАПРЕЩЕНО** менять `User.balance` напрямую или доверять ценам из клиентского UI.
- ✅ Все операции с балансом — ТОЛЬКО через `WalletOps.credit()`, `WalletOps.debit()`, `WalletOps.refund()`, `WalletOps.charge()`, `WalletOps.adminAdjust()`.
- ❌ **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО** Transaction Escape: использовать глобальный инстанс `db.*` (PrismaClient) внутри методов, принимающих `tx: PrismaTx`. Все вызовы и catch-блоки обязаны использовать `tx.*`.
- ✅ **Ledger-First Principle:** Запись в `tx.ledgerEntry.create()` ОБЯЗАНА создаваться ДО мутации `tx.user.update({ balance: ... })`.
- ✅ **Multi-Tenant Fallback:** В финансовых операциях tenantId обязан разрешаться строго через цепочку: `tenantId || user?.tenantId || 'smmplan'`.
- ✅ Все денежные суммы — строго в `BigInt` (копейки). Все финансовые логи — через `await auditAdminAwaitable()`.
- ✅ Каждая финансовая транзакция обязана содержать уникальный `idempotencyKey`.

### Безопасность секретов и Вебхуков (Fail-Closed & Timing-Safe)
- ❌ **ЗАПРЕЩЕНО** писать Fail-Open проверки вебхуков вида `if (secret && signature) { verify() }`.
- ✅ **Fail-Closed:** Если секрет вебхука не настроен — немедленный 500 error; если подпись отсутствует или не совпадает — немедленный 401/403 с алертом в `SecurityAlertService`.
- ✅ Сравнение любых токенов, HMAC-подписей и секретов — СТРОГО через `crypto.timingSafeEqual`.
- ❌ **ЗАПРЕЩЕНО** использовать fallback-секреты для `NEXT_PUBLIC_*` (`process.env.NEXT_PUBLIC_SECRET || 'fallback'`). Секреты не должны попадать в клиентский бандл.

### Zero-Trust, RBAC & Lifecycle Boundaries (CRITICAL INVARIANTS)
- ❌ **ЗАПРЕЩЕНО** писать проверки IDOR вида `if (sessionUser && item.userId !== sessionUser.id)` без обработки гостевого контекста.
- ✅ **Guest-Proof IDOR:** Если сущность принадлежит пользователю (`item.userId`), доступ разрешается СТРОГО при `if (item.userId && (!sessionUser || item.userId !== sessionUser.id)) { return { error: 'Access denied' }; }`.
- ❌ **ЗАПРЕЩЕНО** включать статусы неоплаченных заказов (`AWAITING_PAYMENT`, `PENDING`) в фильтры поиска вебхуков провайдеров (`src/app/api/webhooks/provider/`). Провайдерские вебхуки могут модифицировать СТРОГО заказы со статусами `IN_PROGRESS` или `PENDING_CHECK`.
- ❌ **ЗАПРЕЩЕНО** интерполировать переменные в Cypher-запросы Neo4j без проверки по белому списку `VALID_LABELS = {'class', 'module', 'function', 'file'}`.
- ❌ **ЗАПРЕЩЕНО** позволять сотрудникам назначать роли самим себе (`admin.id === targetUserId`) или выдавать права, превышающие их собственный набор полномочий (`Grant Ceiling`).
- ❌ **ЗАПРЕЩЕНО** переименовывать `src/proxy.ts` в `src/middleware.ts` — в Next.js 16 App Router для платформы зафиксирован `src/proxy.ts`.

### Каталог и провайдеры (Shadow Catalog)
- ❌ **ЗАПРЕЩЕНО** импортировать сырые каталоги провайдеров (5000+ позиций) напрямую в PostgreSQL `Service`.
- ✅ Все каталоги провайдеров буферизуются в Redis (`provider:{id}:catalog`). В БД попадают только одобренные админом услуги (Cherry-Pick).
- ✅ **Ценообразование в UI:** пользователь ВСЕГДА видит розничную цену за 1 штуку (`pricePerUnitRub`), подпись строго: `₽ / шт`. Запрещено писать `/ 1000 шт` или умножать цену на 1000 на клиенте.

---

## 3. Стандарты верстки, UX и Дизайн-Системы (CRITICAL)

### Dual-Brand Design System Tokens & UI Forge Harness
- ❌ **НИКОГДА** не используй inline-цвета и сырые стили: `text-white`, `bg-black`, `text-blue-500`, `border-[1px]`, `rounded-[17px]`.
- ❌ **ЗАПРЕЩЕНО** писать сырые `<button>` и `<input>` в пользовательском UI.
- ✅ **ВСЕГДА** используй компоненты UI Арсенала из `@/components/ui`:
  - **SMMflux (Radiant Aurora):** `<FluxButton>`, `<FluxInput>`, `<FluxCard>`, `<FluxBadge>`, `<NumberTicker>`, `<BorderBeam>`, `<TiltCard>`, `<Marquee>`, `<Confetti>`.
  - **SMMplan (Classic API):** `<PlanButton>`, `<PlanCard>`, `<PlanBadge>`, `<PlanTable>`, `<PlanTableHeader>`, `<PlanTableRow>`, `<PlanTableCell>`.
- ⚡ **UI Forge Harness CLI:** Агенты обязаны использовать харнес для автоматизации:
  - `npx tsx scripts/harness/ui-forge.ts list` — просмотр доступных компонентов
  - `npx tsx scripts/harness/ui-forge.ts validate` — проверка токенов кодовой базы
  - `npx tsx scripts/harness/ui-forge.ts scaffold --brand=smmplan <slug>` — генерация API-страницы для SMMplan
  - `npx tsx scripts/harness/ui-forge.ts scaffold --brand=flux <slug>` — генерация страницы для SMMflux
- ✅ **ВСЕГДА** используй семантические токены из `globals.css`: `text-foreground`, `bg-background`, `bg-card`, `text-primary`, `text-muted-foreground`, `border-border`.
- Все интерактивные элементы обязаны иметь `transition-all duration-200`. Компоненты декомпозируются (до 150–200 строк).

### UX форм и валидации
- ❌ **ЗАПРЕЩЕНО** делать кнопки отправки (Submit / Оплатить / Сохранить) неактивными (`disabled`) при невалидных полях.
- ✅ Главные кнопки **ВСЕГДА активны**. При невалидной форме клик перехватывается (`e.preventDefault()`), вызывается `animate-shake` (с уникальным ключом `key={Date.now()}`) и плавный скролл (`scrollIntoView`) к первому ошибочному полю.
- ✅ Общие серверные ошибки отображаются **непосредственно над кнопкой Submit** в фокусе внимания пользователя.

### Пошаговый мастер заказа (Order Wizard) & Drip-Feed Invariant (CRITICAL)
- Заказ проходит строгие шаги: **1. Соцсеть** → **2. Категория** → **3. Услуга** → **4. Checkout** (Количество, Ссылка, Email).
- ✅ **Полноэкранный чекаут (Single-Screen View):** Оформление заказа после выбора тарифа открывается как чистый полноэкранный экран (в стиле SMM-Flux / `PlanFullscreenCheckout.tsx`) с верхним баром навигации `[← Назад к тарифам]` и автоскроллом `top: 0` без затемняющих модальных попапов.
- ❌ **ЗАПРЕЩЕНО** добавлять навязчивые чипсы пресетов количества (`[100, 500, 1000]`), загромождающие экран. Поле объема использует строгий прямой инпут и степпер `–` / `+`.
- Поле «Количество» автоматически инициализируется минимальным значением (`service.minQty`).
- ❌ **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО** допускать оформление Drip-Feed заказов с объемом на один запуск меньше `service.minQty` ($\lfloor \text{quantity} / \text{runs} \rfloor < \text{service.minQty}$).
- ✅ **Drip-Feed Floor Invariant:** При активации Drip-Feed ($N$ запусков) или Smart Drip ($D$ дней) нижняя граница допустимого количества (`min`) и текущее значение в UI **ОБЯЗАНЫ автоматически масштабироваться** минимум до $\text{service.minQty} \times N$. Степперы и валидаторы форм обязаны запрещать декремент ниже этого значения.
- ✅ **Fail-Closed Backend Check:** `checkoutAction` обязан строго валидировать `Math.floor(totalQuantity / runs) >= service.minQty` и отклонять невалидные запросы с понятной ошибкой до списания средств.

### Каталог, таксономия и валидация типов услуг (TargetType Resolution Invariant)
- ❌ **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО** писать проверки вида `s.targetType || inferTargetTypeFromName(s.name)` или `selectedService.targetType || inferTargetTypeFromCategory(...)`.
- В схеме Prisma `Service.targetType` имеет `@default("POST")`, поэтому поле всегда является truthy-строкой, и правая часть `||` никогда не выполняется (short-circuit баг). Это приводит к блокировке услуг каналов (`LinkType.CHANNEL` не совместим с `POST`), делая каталог пустым при вводе ссылок `t.me/*`.
- ✅ **ОБЯЗАТЕЛЬНО** использовать `resolveServiceTargetType(service)` из `@/utils/target-type-mapper`. Функция безопасно переопределяет дефолтный `"POST"` или `"CUSTOM"` на реальный семантический тип (`CHANNEL`, `VIDEO`, `POLL`, `STORY`, `BOT`) на основе анализа названия услуги.

### Таблицы и компоновка данных (No Horizontal Scroll & Zero Column Clipping Rule)
- ❌ **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО** допускать появление горизонтального скролла в таблицах данных и административных интерфейсах.
- ❌ **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО** обрезать столбцы или скрывать правые колонки (действия, цены, статусы) за пределами видимой области экрана.
- ✅ **Интерфейс ОБЯЗАН на 100% умещаться по ширине в видимый экран (Viewport 100% Width Fit):**
  1. **Приоритезация и лимит колонок:** в основной таблице отображаются только критически важные для оператора данные (до 7–9 емких колонок). Вторичные технические поля (дата создания, ID провайдера, хэши данных) переносятся во всплывающие подсказки (Tooltips) или модальные окна деталей (`OrderDetailsModal`, `AdminPricingIntelligenceModal`).
  2. **Компактная плотность ячеек:** отступы ячеек строго `px-2 py-1.5` / `px-2.5 py-2`, размер шрифта `text-xs` и `text-[11px]`.
  3. **Контроль ширины текстовых блоков:** длинные названия услуг и категорий ограничиваются (`max-w-[180px]`, `truncate`) с атрибутом `title="..."` для полного просмотра при наведении.
  4. **Компактные управляющие элементы:** поля ввода наценок и цен — фиксированные `w-14` / `w-18`, кнопки действий — компактные `h-7 w-7` / `h-8 w-8`.
  5. **Адаптивность:** таблица должна автоматически растягиваться на 100% доступной ширины родителя (`w-full`) без фиксированных раздутых `min-w-[1400px]`.

### Модальные окна, Viewport Density и Realtime/Optimistic UI (CRITICAL)
- ❌ **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО** рендерить `<Modal>` или `<Dialog>` внутри `DropdownMenuContent`, `Popover` или `Tooltip` (приводит к Context Clamping или анмаунту при закрытии дропдауна).
- ✅ **Modal Hoisting:** Состояние открытия модалов объявляется строго на уровне экрана/страницы (`unified-workspace.tsx`), а дочерние кнопки в дропдаунах передают колбэки (`onOpenModal`).
- ❌ **ЗАПРЕЩЕНО** размещать более 3 фиксированных элементов с `w-max` в flex-шапках без `min-w-0` и адаптивного сворачивания в меню на экранах `< 1536px`.
- ✅ **Idempotent Telegram Daemon:** Запуск `bot.launch()` ОБЯЗАН сбрасывать вебхуки через `await bot.telegram.deleteWebhook({ drop_pending_updates: true })` для предотвращения ошибки `409 Conflict`.
- ✅ **Optimistic UI Hygiene:** Любое оптимистичное сообщение/мутация с `temp-id` ОБЯЗАНА иметь 10-12s TTL таймер авто-очистки и немедленный откат стейта с возвратом текста при ошибке `{ success: false }`.

---

## 4. Качество кода и чистота (Linting & Hygiene)

- ❌ **Strict Types:** Запрещено использовать `any` (`@typescript-eslint/no-explicit-any`). Используйте `unknown` с проверкой типов.
- ❌ **Clean Scope:** Удаляйте неиспользуемые импорты и переменные (`@typescript-eslint/no-unused-vars`).
- ❌ **No Useless Wrappers:** Запрещено писать `try { ... } catch (e) { throw e; }`.
- ❌ **React 19:** Запрещен `useFormState` (используется `useActionState`).
- ✅ **Синтаксис батч-замен:** При использовании `multi_replace_file_content` всегда проверяйте баланс фигурных скобок `{}`.

---

## 5. Протокол работы с памятью и субагентами (4-Tier Memory & ACE Triad)

1. **RAG & Память перед стартом (Curator):**
   - Перед сложными задачами выполните поиск по векторной памяти: `npx tsx scripts/memory-client.ts` или `npx tsx scripts/query-rag.ts "<контекст>"`.
   - Проверьте выученные уроки в [`MEMORY.md`](file:///d:/SMM_plan_2/MEMORY.md).
2. **Логирование ошибок и эпизодов (Reflector):**
   - При сбоях тестов или регрессиях логируйте пару `(action, observation, reflection)` через `SmmplanMemoryClient.logEpisode()`.
3. **Обязательная верификация перед сдачей:**
   ```bash
   npx tsx scripts/check-design-system.ts # 0 нарушений токенов
   npx tsc --noEmit                       # 0 ошибок типизации
   npm run test                           # 100% прохождение всех Vitest тестов
   npm run audit:swarm                    # Состязательный аудит Red Team -> Blue Team -> CTO
   ```
4. **Фиксация опыта (Semantic Consolidation):** При решении сложных багов или принятии архитектурных решений сделайте короткую запись в [`MEMORY.md`](file:///d:/SMM_plan_2/MEMORY.md) и отправьте решение через `SmmplanMemoryClient.recordDecision()`.

---

## 6. Автоматический Состязательный Аудит (Adversarial Red Team & Pre-Mortem Gate)

> 🛡️ **BLOCKING QUALITY GATE.** Любые архитектурные изменения финансовой логики (`WalletOps`, `pricing`), калькулятора заказов (`Drip-Feed`), маршрутизации (`src/proxy.ts`, `auth`) или очередей (`BullMQ`, `Redis`) ОБЯЗАНЫ проходить состязательную проверку:

1. **Обязательный Pre-Mortem в Planning Mode:**
   - Перед написанием кода агент формулирует минимум 3 сценария гипотетических отказов (Premortem Failure Modes): краевые расчеты, аномалии микро-цен, блокировки очередей и фишинг.
2. **Запуск Состязательного Роя (Adversarial Swarm):**
   ```bash
   npm run audit:swarm
   ```
   - **Раунд 1 (Red Team / GLM-5.2):** Агрессивная атака и выявление 3–5 векторов отказа.
   - **Раунд 2 (Blue Team / Nemotron 550B):** Оценка реальности рисков и отсечение YAGNI.
   - **Раунд 3 (CTO Arbiter / Inkling Small):** Финальный вердикт. Запрещено объявлять задачу завершенной при наличии нерешенных `P0_BLOCKING` или `P1_REQUIRED` замечаний.
3. **Финансовая точность (ExactMath Invariant):**
   - Все расчеты сумм заказов обязаны использовать `ExactMath.calculateOrderCostKopecks()` с округлением Banker's Rounding (Half-Even) и защитным полом $\ge 1$ коп.

---

## 7. Иерархия верификации источников (Zero-Hallucination 3-Tier Hierarchy)

> 🔍 **CRITICAL ANTI-HALLUCINATION PROTOCOL.** Агентам КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО проектировать или писать код интеграций с внешними системами (платежные шлюзы, бухгалтерские системы, внешние API, налоговые протоколы 54-ФЗ), опираясь исключительно на память модели:

1. **Уровень 1 (Официальная документация):**
   - Первичная проверка по официальным источникам вендора (`read_url_content`, API Reference `yookassa.ru/developers`, `docs.robokassa.ru`, портал ФНС).
2. **Уровень 2 (Поисковая верификация):**
   - Если документация недоступна — обязательный поиск в интернете (`search_web`) актуальных протоколов (2025/2026 гг.) и выявление устаревших методов (SOAP/XML vs REST/JSON).
3. **Уровень 3 (Память модели — строго с пометкой гипотезы):**
   - Внутренняя память агента используется ТОЛЬКО как гипотеза с обязательным предупреждением пользователю: `[ГИПОТЕЗА: Требуется валидация документацией]`. Запрещено внедрять предположения без последующей проверки.

---

## 8. Безопасность по умолчанию (Security-by-Design, Pentest Immunity & Live Standards Verification)

> 🛡️ **BLOCKING SECURITY MANDATE.** При разработке ЛЮБОГО проекта, компонента или новой функциональности агент ОБЯЗАН с самого начала закладывать архитектуру с защитой от пентестов и строго соблюдать мировые стандарты безопасности:

1. **Стандарты безопасности обязательного соблюдения:**
   - **OWASP Top 10:2025** (A01 Broken Access Control, A02 Security Misconfiguration, A04 Cryptographic Failures, A05 Injection, A07 Authentication Failures, etc.).
   - **OWASP ASVS 4.0.3** (Application Security Verification Standard) & **WSTG v4.2**.
   - **PCI DSS 4.0** (TLS 1.2/1.3, запрет устаревших CBC-шифров, безопасная обработка платежных реквизитов).
   - **RFC 9116** (Обязательное наличие `/.well-known/security.txt`).
   - **RFC 9331** (Стандартизированные заголовки `RateLimit-Limit`, `RateLimit-Reset`, `RateLimit-Policy` на публичных API).

2. **Обязательная сверка стандартов перед стартом (Live Standard Verification):**
   - Перед началом проектирования или реализации фич, связанных с аутентификацией, платежами, API или маршрутизацией, агент ОБЯЗАН проверить актуальные стандарты через поиск в интернете (`search_web`) или официальную документацию (`read_url_content`).
   - Запрещено использовать устаревшие практики (например, незащищенные GET-эндпоинты прямого входа, раскрытие отладочных путей в `robots.txt`, отсутствие флагов у cookies при сбросе).

3. **Ключевые инварианты кода (Pentest Immunity Rules):**
   - ❌ **Zero-Secrets in Client Bundles:** Никаких `NEXT_PUBLIC_*_SECRET`, паролей или ключей в клиентском коде (`use client`).
   - ❌ **No Backdoor/Debug Endpoints in Production:** Все тестовые/QA эндпоинты изолируются через Server Actions со строгой проверкой `QA_SECRET_KEY` на сервере через `crypto.timingSafeEqual`.
   - ❌ **No Information Disclosure:** Запрещено раскрывать внутренние пути (`/dev`, `/operator`, `/test`) в публичном `robots.txt` (использовать `X-Robots-Tag: noindex, nofollow` в middleware).
   - ✅ **Symmetric Cookie Sanitation:** Любая очистка сессионных кук обязана содержать полный набор атрибутов: `Secure; HttpOnly; SameSite=Lax; MaxAge=0; Expires=0; Path=/`.
   - ✅ **Granular RBAC Enforcement:** Разграничение прав ролей (Owner, Admin, Manager, Support, Cashier, User) проверяется на уровне каждого Server Action через `requireStaffPermission()`.
