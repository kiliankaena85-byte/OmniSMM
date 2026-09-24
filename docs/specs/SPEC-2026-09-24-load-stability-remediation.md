# SPEC-2026-09-24: Пакет №1 — Стабильность под нагрузкой и отказоустойчивость ядра (Prisma Pool, Transaction Purity, Redis Isolation)

## 1. Context & Problem Statement
В ходе комплексного технического аудита кодовой базы OmniSMM 1.0 (Next.js 16, Prisma ORM, BullMQ, Redis, PostgreSQL) подтверждены критические дефекты уровня **P0 (Tier 1: High Reliability & Concurrency Risk)**, способные приводить к каскадному отказу платформы при всплесках нагрузки или сбоях сети:

1. **[DEF-001] Исчерпание пула соединений PostgreSQL (Prisma Connection Starvation — P0)**:
   - *Файл:* `src/lib/db.ts:32-40`
   - *Проблема:* `new PrismaClient()` создаётся без параметров управления пулом (`connection_limit`, `pool_timeout`). При запуске Next.js сервера, Telegram-бота и 12+ BullMQ-воркеров каждый процесс Node.js инициализирует собственный пул соединений (дефолт Prisma: $\text{CPUs} \times 2 + 1 \approx 9\dots 17$). Суммарное число соединений мгновенно превышает `max_connections` (100) на уровне PostgreSQL, вызывая ошибки P2024: `Timed out fetching a new connection from the connection pool`. При этом URL разворачивается в непулированный `POSTGRES_URL_NON_POOLING`, игнорируя PgBouncer.
   - *Сопутствующий дефект [DEF-010]:* В `src/lib/db.ts:33` и `db.ts:115` в `globalForPrisma.prisma` сохраняется уже обёрнутый в `$extends` клиент. При переинициализации или горячей перезагрузке инстанс переиспользует уже расширенный клиент и повторно накладывает extensions, удваивая цепочку перехватчиков `tenant-enforcer`.

2. **[DEF-002] Удержание блокировок БД при внешних сетевых вызовах внутри `$transaction` (Transaction Holding & Starvation — P0)**:
   - *Файлы:* `src/workers/processors/sync.processor.ts:232-242`, `sync.processor.ts:184-201`
   - *Проблема:* Внутри транзакции `db.$transaction(async (tx) => { ... })` вызывается `sendOrderCompletedMail(...)` (сетевой SMTP-вызов). При сетевых задержках SMTP-шлюза (до 15–30 секунд) транзакция и соединение с БД остаются открытыми и заблокированными. При пачке завершенных заказов это блокирует строки в `orders` и исчерпывает пул соединений Postgres.

3. **[DEF-003] Зависание Health-Check и метрик из-за единого Redis с `maxRetriesPerRequest: null` (Redis Degradation Cascade — P0)**:
   - *Файлы:* `src/lib/queue-manager.ts:71`, `src/services/telemetry/system-telemetry.service.ts:212-217`
   - *Проблема:* Клиент очереди `getRedisConnection()` использует `maxRetriesPerRequest: null` (требование BullMQ для блокирующих команд `BRPOPLPUSH` / `BLPOP`). Однако этот же инстанс или методы очередей `ordersQueue.getWaitingCount()` вызываются в телеметрии и health-check эндпоинтах. При временной недоступности или реконнекте Redis вызовы с `null` не отклоняются с ошибкой, а бесконечно буферизуются в памяти, подвешивая промис `Promise.all` и вызывая таймаут всех системных диагностик.

---

## 2. Architectural Invariants & Decisions

### Инвариант 1: Строгое разделение ролей пула Prisma (Pool Budgeting & PgBouncer First)
1. В `src/lib/db.ts`:
   - Если задан `POSTGRES_PRISMA_URL` или URL содержит `pgbouncer=true`, система приоритетно использует пулируемый URL с флагом `pgbouncer=true`.
   - Внедряются явные лимиты соединений через параметр URL `connection_limit`:
     - Для фоновых воркеров / CLI-скриптов (`process.env.IS_WORKER === 'true'` или `process.env.APP_ROLE === 'worker'`): `connection_limit = 3..5`.
     - Для веб-сервера Next.js: `connection_limit = 10` (настраивается через `DATABASE_POOL_SIZE` с безопасным дефолтом).
     - Добавляются явные таймауты: `pool_timeout = 10` (секунд) и `connect_timeout = 5` (секунд) для исключения вечного зависания в очереди пула.
2. Устранение [DEF-010]: Разделение `globalForPrisma.rawPrisma` (чистый инстанс `PrismaClient`) и экспортируемого `db` (расширенный клиент). `rawPrisma` сохраняется в globals отдельно, что исключает повторное наслоение `$extends`.

### Инвариант 2: Транзакционная чистота (Zero External I/O inside DB Transactions)
1. Категорически запрещено выполнять внешние сетевые вызовы (HTTP, SMTP, Webhooks, Push-уведомления) внутри `db.$transaction` или `txClient`.
2. В `src/workers/processors/sync.processor.ts`:
   - Отправка email (`sendOrderCompletedMail`) выносится **СТРОГО ПОСЛЕ** успешного завершения блока `db.$transaction`.
   - Использование паттерна "Post-Commit Hook / Deferred Effect": транзакция фиксирует изменения в БД и возвращает флаг необходимости отправки email (`shouldSendMail: true`), после чего сетевой вызов выполняется в фоновом режиме через `Promise.resolve().then(...)` или `void sendMail().catch(...)`.

### Инвариант 3: Изоляция Redis-клиентов и Fail-Fast Guard для телеметрии
1. В `src/lib/queue-manager.ts`:
   - Четкое разделение: подключение воркеров BullMQ использует `maxRetriesPerRequest: null`, но для любых обычных команд и проверок очередей вводится защитный таймаут `AbortSignal.timeout(3000)` или обёртка `withTimeout(promise, 3000)`.
2. В `src/services/telemetry/system-telemetry.service.ts`:
   - Вызовы `ordersQueue.getWaitingCount()`, `ordersQueue.getActiveCount()`, `ordersQueue.getFailedCount()` и `syncQueue.getWaitingCount()` оборачиваются в безопасную функцию с жестким таймаутом (2000 мс). При деградации Redis промис мгновенно падает в fallback (`0` или статус `DEGRADED`), предотвращая зависание health-checks.

---

## 3. Blast Radius & Regression Analysis (3 Шага Вперёд)

| Потенциальный отказ / Риск | Механизм защиты в коде | Радиус поражения |
| :--- | :--- | :--- |
| Нехватка соединений при `connection_limit=5` для воркеров | Пул динамически конфигурируется через `DATABASE_POOL_SIZE`, для транзакций предусмотрен `pool_timeout=10` с информативным логированием | BullMQ workers, Cron jobs |
| Сбой отправки email после коммита транзакции | Email не влияет на финансовую консистентность заказа. Ошибка логируется через `log.error`, не приводя к откату уже завершенного заказа в БД | Клиентские уведомления |
| Преждевременный таймаут telemetry при медленном Redis | Таймаут установлен в 2000 мс (достаточно для локального/облачного Redis в пределах 1-5 мс), при таймауте возвращается `status: 'WARNING'`, сервис продолжает жить | `/api/health`, `/api/admin/telemetry` |
| Поломка тестов Vitest, мокающих `db.$transaction` | Тесты мокают `db.$transaction` как passthrough `cb(db)` — вынос вызовов наружу транзакции на 100% совместим со всеми существующими моками | Сьют тестов `sync.processor.test.ts` |

---

## 4. Acceptance Criteria & Test Plan

1. **Unit & Integration Tests (Red -> Green):**
   - `src/__tests__/audit/load-stability-prisma-pool.test.ts`: Проверка корректного формирования datasource URL с `connection_limit`, `pool_timeout` и исключения повторного `$extends` в `db.ts`.
   - `src/__tests__/audit/transaction-purity-sync-processor.test.ts`: Проверка, что `sendOrderCompletedMail` и внешние эффекты не вызываются внутри контекста `tx`, а выполняются строго после фиксации транзакции.
   - `src/__tests__/audit/redis-telemetry-failfast.test.ts`: Проверка, что при медленном или зависшем ответе очередей BullMQ метод сбора телеметрии завершается по таймауту (fail-fast $\le 2000$ мс) и возвращает статус без зависания.

2. **Quality Gate:**
   - `npx tsc --noEmit` — 0 ошибок типов.
   - `npx vitest run -c vitest.unit.config.ts` — 100% существующих тестов проходят (PASS).
   - Нулевые изменения логики расчета баланса или бизнес-правил Drip-Feed.
