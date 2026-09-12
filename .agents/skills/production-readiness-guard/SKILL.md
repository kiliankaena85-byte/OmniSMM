---
name: production-readiness-guard
description: >
  Архитектурный скилл стандартов производственной зрелости (Production-Ready Engineering Standards) и защиты от «лабораторного» кода в платформе OmniSMM 1.0 (Next.js 16, React 19, Prisma, PostgreSQL, Redis).
  Используй этот скилл ВСЕГДА, когда создаются, рефакторятся или проверяются: алгоритмы обработки данных, работа с файлами и стримами, запросы к БД и пагинация, интеграция с внешними HTTP-сервисами, Server Components и RSC Payload, конкурентные мутации и балансы, обработка ошибок и логирование, устойчивость к сбоям и управление жизненным циклом (Graceful Shutdown).
---

# Production Readiness Guard — Кодекс Производственной Зрелости OmniSMM 1.0 (2026)

## Назначение и контекст создания скилла

В индустрии разработки программного обеспечения существует непреодолимая пропасть между **«функционально корректным кодом»** (Happy Path, лабораторные тесты, $N=10$, идеальное сетевое окружение) и **«производственным кодом» (Production-Grade Engineering)**.

Типичная причина отказа сильным алгоритмистам и разработчикам на собеседованиях Senior/Lead уровней и код-ревью в HighLoad:
> *«Кандидат написал абсолютно рабочий код, тесты прошли, результат верный. Но код не выдержит продакшена: он сжирает память при росте $N$, блокирует Event Loop на тяжелых структурах, оставляет сокеты висеть вечно, порождает N+1 запросов в БД, ломается при первой параллельной гонке и удушает сервер при перезапуске контейнера.»*

Настоящий скилл — это нормативный кодекс инженерных практик, запретов и шаблонов, гарантирующих, что **любая строка кода, попадающая в платформу OmniSMM 1.0, спроектирована под пиковые нагрузки, нештатные отказы и деградацию инфраструктуры**.

---

## 1. Сравнительная матрица: «Лабораторный код» (Day 1) vs «Production-Grade» (Day 100)

| Область | Как пишет «Лабораторный программист» (Day 1) | Как требует Production-Grade Инженер (Day 100) | Справочник |
| :--- | :--- | :--- | :--- |
| **Память и I/O** | Читает файлы и тела запросов целиком в буфер (`fs.readFile`, `buffer.concat`). Аллокация $O(N)$ RAM. | Строго потоковая обработка (Streams, Generators, `pipeline`). Потребление памяти константно $O(1)$ вне зависимости от размера. | [`01_MEMORY_AND_STREAMING.md`](./references/01_MEMORY_AND_STREAMING.md) |
| **Next.js & RSC** | Отдает сырые модели Prisma из Server Component прямо в `props` Client Component (`<Table data={users} />`). | Строгий DTO Mapping со срезанием лишних полей. Лимит элементов страницы. Защита RSC Payload от раздувания HTML. | [`02_NEXTJS_RSC_AND_BUNDLE.md`](./references/02_NEXTJS_RSC_AND_BUNDLE.md) |
| **CPU и Event Loop** | Вложенные поиски $O(N^2)$ через `.find()` / `.includes()`, `JSON.parse(JSON.stringify())`, ReDoS-уязвимые Regex. | Индексация в `Map`/`Set` ($O(1)$ поиск), чанкование через `setImmediate`, Worker Threads для тяжелых задач, Load Shedding. | [`03_EVENT_LOOP_AND_SHEDDING.md`](./references/03_EVENT_LOOP_AND_SHEDDING.md) |
| **Сеть и Сокеты** | Обычный `await fetch(url)`. При сбое сокет висит часами, пока не исчерпается пул соединений ОС. | Обязательный `AbortSignal.timeout(ms)`. Изоляция через Circuit Breaker, Exponential Backoff с Jitter, DNS Cache. | [`04_IO_NETWORK_AND_TIMEOUTS.md`](./references/04_IO_NETWORK_AND_TIMEOUTS.md) |
| **База Данных** | `SELECT *`, запросы в цикле `for (...) await db.find()`, пагинация через `OFFSET 100000 LIMIT 20`. | Батчинг (DataLoader, `IN (...)`), Keyset пагинация (`WHERE id > :lastId`), выборка строго нужных колонок (`select`). | [`05_DATABASE_KEYS_AND_LOCKS.md`](./references/05_DATABASE_KEYS_AND_LOCKS.md) |
| **Конкурентность** | Проверил условие $\to$ изменил запись (TOCTOU). При двух кликах пользователя деньги списываются дважды. | Атомарные SQL-операции, Row-Level Locks (`SELECT FOR UPDATE`), дедупликация через уникальный `idempotencyKey`. | [`06_CONCURRENCY_AND_IDEMPOTENCY.md`](./references/06_CONCURRENCY_AND_IDEMPOTENCY.md) |
| **Телеметрия** | `console.log(err)` или `console.log(hugePayload)`. Логи забивают память, текут пароли и токены (PII). | Структурированный JSON-лог, сквозной `traceId` через `AsyncLocalStorage`, автоматическое маскирование персональных данных. | [`07_TRACEABILITY_AND_LOGGING.md`](./references/07_TRACEABILITY_AND_LOGGING.md) |
| **Ошибки и Сбои** | `try { ... } catch (e) { return null }` (проглатывание) или падение всего процесса от `unhandledRejection`. | Четкое разделение: Expected Domain Errors (`Result<T, E>`) vs Unhandled Panics. Безопасные Fallbacks. | [`08_ERROR_BOUNDARIES.md`](./references/08_ERROR_BOUNDARIES.md) |
| **Жизненный цикл** | Контейнер убивается по `SIGTERM`, обрывая платежи и недописанные файлы на середине. | Graceful Shutdown: остановка приема новых запросов, drain фоновых транзакций (15-30s), закрытие пулов БД. | [`09_INTERVIEW_AND_PROD_CHECKLIST.md`](./references/09_INTERVIEW_AND_PROD_CHECKLIST.md) |

---

## 2. Десять Заповедей Производственного Кода (The 10 Hard Invariants)

Каждое изменение в платформе OmniSMM 1.0 обязано безоговорочно соблюдать следующие 10 инвариантов:

### 🛡️ INV-PROD-01 (Constant Memory & Streaming First)
> **Категорически запрещено** считывать нелимитированные объемы данных (файлы, тела запросов, экспорт таблиц) в память целиком (`fs.readFile`, `Buffer.concat`). Любой поток данных объемом $> 64$ Кб обязан обрабатываться через `stream.Readable`, `stream.Transform` или асинхронные генераторы со строгим контролем Backpressure (`pipeline`).

### 🛡️ INV-PROD-02 (Zero Unbounded In-Memory Collections)
> **Категорически запрещено** создавать глобальные коллекции (`const cache = new Map()`, `const items = []`), время жизни которых не ограничено, а размер может расти бесконечно. Любая структура данных в памяти обязана иметь:
> 1. Жесткий лимит размера (`max: 1000`);
> 2. Политику вытеснения (LRU / FIFO);
> 3. TTL (Time-To-Live). При необходимости разделения между процессами — использовать Redis.

### 🛡️ INV-PROD-03 (Deterministic I/O Timeouts & Fail-Fast)
> **Категорически запрещено** выполнять внешние сетевые вызовы (`fetch`, HTTP/HTTPS клиенты, gRPC, вебхуки) без детерминированного таймаута `AbortSignal.timeout(ms)` или привязки к `AbortController`. Сервер не имеет права ждать стороннюю систему дольше установленного SLA (по умолчанию $\le 5000$ мс).

### 🛡️ INV-PROD-04 (Next.js RSC Boundary & Payload Capping)
> **Категорически запрещено** передавать сырые объекты БД (`Prisma models`) или массивы более 50 элементов напрямую через границу Server Component $\to$ Client Component. Любые данные, передаваемые в клиентские `props`, обязаны быть нормализованы через DTO-маппер (с удалением служебных полей, секретов и себестоимости) и ограничены пагинацией.

### 🛡️ INV-PROD-05 (No In-Loop I/O — Anti-N+1 Invariant)
> **Категорически запрещено** выполнять сетевые вызовы или запросы к базе данных внутри циклов (`for`, `forEach`, `map`). Все операции выборки и обновления обязаны объединяться в пакетные запросы (`WHERE id IN (...)`, `createMany`, `updateMany`) либо оркестрироваться через DataLoader с кешированием в рамках одного тика.

### 🛡️ INV-PROD-06 (Keyset Pagination Over Offset)
> **Категорически запрещено** использовать `OFFSET` для пагинации на рабочих и архивных таблицах объемом $> 1000$ строк. Продакшен-пагинация реализуется строго по курсору (**Keyset / Seek Method**: `WHERE (created_at, id) < (:last_date, :last_id) ORDER BY created_at DESC, id DESC LIMIT :limit`).

### 🛡️ INV-PROD-07 (Atomic Mutations & Idempotency Guard)
> **Категорически запрещено** изменять критическое разделяемое состояние (баланс, остатки, статусы заказов) по схеме TOCTOU (Read-Modify-Write). Любая мутация обязана быть либо атомарной на уровне SQL (`balance = balance - :amount WHERE balance >= :amount`), либо защищенной пессимистической блокировкой (`SELECT FOR UPDATE`), и обязательно сопровождаться уникальным `idempotencyKey`.

### 🛡️ INV-PROD-08 (Traceability & Structured Logging)
> **Категорически запрещено** использовать сырой `console.log` для бизнес-событий и ошибок. Все логи обязаны формироваться в формате структурированного JSON, содержать сквозной `traceId` (полученный через `AsyncLocalStorage`), `tenantId` и быть очищенными от PII (пароли, токены, полные номера карт) через DLP-маску.

### 🛡️ INV-PROD-09 (Zero Error Swallowing & Typed Results)
> **Категорически запрещено** использовать пустые catch-блоки (`catch (e) {}`) или возвращать `null`/`false` без сохранения контекста ошибки. Ожидаемые бизнес-ошибки обязаны возвращаться как строго типизированный Result `{ success: false, error: string, code?: string }`. Фатальные сбои инфраструктуры обязаны логироваться и эскалироваться до ErrorBoundary.

### 🛡️ INV-PROD-10 (Graceful Lifecycle & Resource Cleanup)
> **Категорически запрещено** завершать процесс без обработки сигналов `SIGTERM` и `SIGINT`. Сервер обязан:
> 1. Остановить прием новых подключений;
> 2. Предоставить grace-период (15-30 сек) на завершение выполняющихся транзакций;
> 3. Корректно закрыть соединения с БД, Redis и очередями BullMQ;
> 4. Освободить все файловые дескрипторы через блоки `try...finally` или `using` (TS 5.2+).

---

## 3. Дерево решений разработчика (Production Decision Tree)

Перед написанием или коммитом любого фрагмента кода выполни пошаговую проверку:

```
[ НАЧАЛО: Написание бизнес-логики ]
               │
               ▼
   [ 1. Объем данных известен заранее? ]
        ├── НЕТ (Файл, поток, API, таблица) ──> ИСПОЛЬЗУЙ STREAMS / GENERATORS (O(1) RAM)
        └── ДА (Лимитированный массив <= 50) ─> Валидируй Zod-схемой с .max()
               │
               ▼
   [ 2. Есть обращение к Сети или БД? ]
        ├── ДА ──> Добавь AbortSignal.timeout()! Проверь отсутствие вызова в цикле!
        └── НЕТ ─> Переходи к следующему шагу
               │
               ▼
   [ 3. Данные передаются на клиент (RSC -> Client)? ]
        ├── ДА ──> Отрежь лишние поля через DTO (DTO-Mapper), проверь вес бандла
        └── НЕТ ─> Логика остается изолированной на бэкенде
               │
               ▼
   [ 4. Изменяется разделяемое состояние (деньги, статусы)? ]
        ├── ДА ──> ACID транзакция + SELECT FOR UPDATE + idempotencyKey
        └── НЕТ ─> Read-only операция
               │
               ▼
   [ 5. Добавлен лог или обработка ошибки? ]
        ├── Лог ──> Проверь отсутствие паролей/PII, используй logger.info({ traceId })
        └── Catch ─> Запрещено проглатывать! Верни { success: false, error }
               │
               ▼
[ ФИНИШ: Код готов к Production Code Review ]
```

---

## 4. Карта Справочников и Углубленных Руководств

Для детального погружения в каждую тему используй специализированные справочники скилла:

1. [`01_MEMORY_AND_STREAMING.md`](./references/01_MEMORY_AND_STREAMING.md) — Руководство по V8 Heap, стримам, генераторам и бескомпромиссному контролю Backpressure.
2. [`02_NEXTJS_RSC_AND_BUNDLE.md`](./references/02_NEXTJS_RSC_AND_BUNDLE.md) — Защита RSC Payload, Hydration, DTO Mapping, предотвращение раздувания HTML и бандла.
3. [`03_EVENT_LOOP_AND_SHEDDING.md`](./references/03_EVENT_LOOP_AND_SHEDDING.md) — Борьба со скрытым $O(N^2)$, защита Event Loop, Load Shedding (HTTP 429) при перегрузке.
4. [`04_IO_NETWORK_AND_TIMEOUTS.md`](./references/04_IO_NETWORK_AND_TIMEOUTS.md) — Сетевые таймауты, пулы сокетов, DNS-кеш, Circuit Breaker и повторы с Jitter.
5. [`05_DATABASE_KEYS_AND_LOCKS.md`](./references/05_DATABASE_KEYS_AND_LOCKS.md) — Искоренение N+1, Keyset пагинация, лимиты транзакций, предотвращение дедлоков.
6. [`06_CONCURRENCY_AND_IDEMPOTENCY.md`](./references/06_CONCURRENCY_AND_IDEMPOTENCY.md) — Борьба с TOCTOU, реализация ключей идемпотентности, Row-Level Locks в PostgreSQL.
7. [`07_TRACEABILITY_AND_LOGGING.md`](./references/07_TRACEABILITY_AND_LOGGING.md) — Сквозная трассировка через AsyncLocalStorage, JSON-логирование, маскирование PII.
8. [`08_ERROR_BOUNDARIES.md`](./references/08_ERROR_BOUNDARIES.md) — Архитектура Result<T, E>, защита от проглатывания ошибок, границы устойчивости.
9. [`09_INTERVIEW_AND_PROD_CHECKLIST.md`](./references/09_INTERVIEW_AND_PROD_CHECKLIST.md) — 30 критических пунктов для прохождения собеседования Staff/Lead и ревью техлида.
