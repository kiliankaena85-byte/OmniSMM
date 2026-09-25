# Architecture, Security & Boundary Invariants (OmniSMM 1.0)
# Архитектурные границы, финансовая безопасность, изоляция тенантов и безопасность секретов

## 1. Server/Client Boundary & Error Handling
- **Server Components** по умолчанию. `'use client'` только при наличии React hooks или Browser APIs.
- **Server Actions** строго в `src/actions/` с обязательным guard `requireAdmin()` или `requireStaffPermission()`.
- ❌ **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО** ставить `"use server"` в Page Components (`page.tsx`) — вызывает краш приложения.
- ❌ **ЗАПРЕЩЕНО** выбрасывать необработанные `throw new Error(...)` внутри Server Actions (Next.js в production маскирует их в `"An unexpected response was received from the server."`).
- ✅ Все Server Actions обязаны возвращать типизированный результат: `return { success: false, error: 'Понятное сообщение' }`.
- ❌ **ЗАПРЕЩЕНО** добавлять стандартные библиотеки (`ioredis`, `sanitize-html`, `bullmq`) в `serverExternalPackages` в `next.config.mjs` (вызывает сбой поиска хэшированных модулей в standalone).
- ✅ **Standalone Сборка:** Для сборки продакшен-бандла использовать `next build --webpack`. Перед перезапуском Docker (`docker-compose up -d --build web`) всегда запускать `npm run build` на хосте.

## 2. Multi-Tenant Architecture & OmniSMM 1.0 Engine
- **Материнская платформа / Движок администрирования называется строго OmniSMM 1.0** (в сайдбаре, заголовках, Telegram-алертах и шапке).
- Платформа OmniSMM обслуживает витрины и бренды: **SMMplan** (`smmplan.pro`) и **SMMflux** (`smmflux.ru`) с возможностью динамического масштабирования на новые тенанты.
- ❌ **Брендов Lovable и SMMboost НЕ существует.** Запрещено добавлять фантомные бренды в код, конфиги или макеты. Алиас `normalizeTenantId('lovable')` -> `'flux'` сохранен для обратной совместимости.
- ✅ **Глобальный переключатель сайтов в Header:** Переключение между тенантами (`SMMplan` / `SMMflux`) осуществляется **ГЛОБАЛЬНО в верхней панели (Header/Navbar)** через `<GlobalSiteSwitcher />` с сохранением в куке `x_admin_tenant` и параметре `?tenant=...`.
- ❌ **ЗАПРЕЩЕНО** хардкодить хосты (`smmplan.pro`, `smmflux.ru`) в коде. Использовать `getTenantHost(tenantId)`.
- ✅ **Canonical URLs** обязаны быть абсолютными через `absoluteCanonical(tenantId, path)`.
- ✅ Кэш-ключи в `unstable_cache` обязаны включать `tenantId` (например, `catalog-${tenantId}`).

## 3. Official Tunnel & Network Binding Invariants (Tailscale Funnel)
- ❌ **Cloudflare API и Cloudflare Tunnel заблокированы на территории РФ** и вызывают сбои TLS handshake и таймауты. ЗАПРЕЩЕНО использовать Cloudflare API и контейнеры cloudflared.
- ✅ **Официальный туннель платформы — Tailscale Funnel:** Все внешние запросы маршрутизируются через ноду `https://desktop-25m6el7.tailbb9d28.ts.net`, стабильно проксирующую на `http://127.0.0.1:3000`.
- ✅ **Сетевой биндинг:** Сервер Next.js обязан запускаться с `HOSTNAME="0.0.0.0"` и `PORT="3000"`, обеспечивая стабильный доступ для Tailscale Funnel и браузерных E2E-тестов.

## 4. Финансовая Безопасность (Trust Boundary) & Ledger Invariants
- ❌ **ЗАПРЕЩЕНО** менять `User.balance` напрямую или доверять ценам из клиентского UI.
- ✅ Все операции с балансом — ТОЛЬКО через `WalletOps.credit()`, `WalletOps.debit()`, `WalletOps.refund()`, `WalletOps.charge()`, `WalletOps.adminAdjust()`.
- ❌ **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО** Transaction Escape: использовать глобальный инстанс `db.*` (PrismaClient) внутри методов, принимающих `tx: PrismaTx`. Все вызовы и catch-блоки обязаны использовать `tx.*`.
- ❌ **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО** выполнять внешние сетевые вызовы (`fetch`, HTTP/API поставщиков, AI-классификаторы, SMTP, Telegram) ВНУТРИ `runSerializableTransaction` или `db.$transaction`. Все сетевые запросы выполняются ДО транзакции либо в Deferred Post-Commit Hook ПОСЛЕ фиксации.
- ✅ **Ledger-First Principle:** Запись в `tx.ledgerEntry.create()` ОБЯЗАНА создаваться ДО мутации `tx.user.update({ balance: ... })`.
- ✅ **Atomic Balance Non-Negative Guard:** Списание баланса ОБЯЗАНО выполняться через `tx.user.updateMany` с предикатом `{ where: { id: userId, balance: { gte: absAmount } } }` во избежание TOCTOU-гонок и ошибок PostgreSQL `23514 check_violation`.
- ✅ **Multi-Tenant Fallback:** В финансовых операциях tenantId обязан разрешаться строго через цепочку: `tenantId || user?.tenantId || 'smmplan'`.
- ✅ Все денежные суммы — строго в `BigInt` (копейки). Все финансовые логи — через `await auditAdminAwaitable()`.
- ✅ Каждая финансовая транзакция обязана содержать строго ДЕТЕРМИНИРОВАННЫЙ `idempotencyKey` (запрещено использовать `Date.now()`, ведущий к двойным списаниям при повторах).

## 5. Безопасность Секретов и Вебхуков (Fail-Closed & Timing-Safe)
- ❌ **ЗАПРЕЩЕНО** писать Fail-Open проверки вебхуков вида `if (secret && signature) { verify() }`.
- ✅ **Fail-Closed:** Если секрет вебхука не настроен — немедленный 500 error; если подпись отсутствует или не совпадает — немедленный 401/403 с алертом в `SecurityAlertService`.
- ✅ Сравнение любых токенов, HMAC-подписей и секретов — СТРОГО через `crypto.timingSafeEqual`.
- ❌ **ЗАПРЕЩЕНО** использовать fallback-секреты для `NEXT_PUBLIC_*` (`process.env.NEXT_PUBLIC_SECRET || 'fallback'`). Секреты не должны попадать в клиентский бандл.

## 6. Zero-Trust, RBAC & Lifecycle Boundaries (CRITICAL INVARIANTS)
- ❌ **ЗАПРЕЩЕНО** писать проверки IDOR вида `if (sessionUser && item.userId !== sessionUser.id)` без обработки гостевого контекста.
- ✅ **Guest-Proof IDOR:** Если сущность принадлежит пользователю (`item.userId`), доступ разрешается СТРОГО при `if (item.userId && (!sessionUser || item.userId !== sessionUser.id)) { return { error: 'Access denied' }; }`.
- ❌ **ЗАПРЕЩЕНО** включать статусы неоплаченных заказов (`AWAITING_PAYMENT`, `PENDING`) в фильтры поиска вебхуков провайдеров (`src/app/api/webhooks/provider/`). Провайдерские вебхуки могут модифицировать СТРОГО заказы со статусами `IN_PROGRESS` или `PENDING_CHECK`.
- ❌ **ЗАПРЕЩЕНО** интерполировать переменные в Cypher-запросы Neo4j без проверки по белому списку `VALID_LABELS = {'class', 'module', 'function', 'file'}`.
- ❌ **ЗАПРЕЩЕНО** позволять сотрудникам назначать роли самим себе (`admin.id === targetUserId`) или выдавать права, превышающие их собственный набор полномочий (`Grant Ceiling`).
- ❌ **ЗАПРЕЩЕНО** переименовывать `src/proxy.ts` в `src/middleware.ts` — в Next.js 16 App Router для платформы зафиксирован `src/proxy.ts`.

## 7. Каталог и Провайдеры (Shadow Catalog)
- ❌ **ЗАПРЕЩЕНО** импортировать сырые каталоги провайдеров (5000+ позиций) напрямую в PostgreSQL `Service`.
- ✅ Все каталоги провайдеров буферизуются в Redis (`provider:{id}:catalog`). В БД попадают только одобренные админом услуги (Cherry-Pick).
- ✅ **Ценообразование в UI:** пользователь ВСЕГДА видит розничную цену за 1 штуку (`pricePerUnitRub`), подпись строго: `₽ / шт`. Запрещено писать `/ 1000 шт` или умножать цену на 1000 на клиенте.

## 8. Сетевая Надежность, Фоновые Очереди и Redis
- ❌ **ЗАПРЕЩЕНО** выполнять `fetch()` без явного таймаута. Каждый исходящий запрос ОБЯЗАН иметь `signal: AbortSignal.timeout(ms)` (5000 мс для проверок/API, 15000–30000 мс для скачивания).
- ❌ **ЗАПРЕЩЕНО** создавать повторяющиеся/свипер задачи BullMQ со статичными `jobId` без временных меток во избежание дедлока дедупликации. Использовать: `jobId: \`dispatch-${id}-${Date.now()}\``.
- ✅ Все очереди BullMQ обязаны иметь автоочистку: `removeOnComplete: 100`, `removeOnFail: 500`.
- ✅ В операциях `Promise.race` с таймерами дескриптор таймера ОБЯЗАН очищаться через `clearTimeout(timerId)` в блоке `finally` для защиты Event Loop от утечек памяти.
- ✅ Все ключи Redis обязаны быть изолированы тенантом: `smart:${tenantId}:disabled`, `catalog:${tenantId}:cache`.
