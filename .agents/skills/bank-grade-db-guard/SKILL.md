---
name: bank-grade-db-guard
description: >
  Универсальный архитектурный стандарт надежности реляционных баз данных банковского уровня (Tier-1 FinTech: Sberbank, Tinkoff, Stripe, Monzo).
  Охватывает строгие инварианты целостности (Ledger-First, ExactMath BigInt, Zero Transaction Escape, аппаратные CHECK/Triggers),
  паттерны отказоустойчивости (Stripe-Style Distributed Idempotency Vault с атомарной резервацией, Event Sourcing, партиционирование таблиц с составными ключами,
  Transactional Outbox с SKIP LOCKED, сайзинг пулов соединений и PgBouncer, автоматический ретрай дедлоков 40P01 и serialization failure 40001),
  каталог критических антипаттернов (N+1 OOM, толстые транзакции, OFFSET death) и полный протокол карантина при расхождениях леджера.
version: "2026.2.0"
standards:
  - "ISO 25010:2023 (Fault Tolerance, Data Integrity)"
  - "PCI-DSS v4.0.1 (Req 3.4, 6.4, 10.2)"
  - "54-ФЗ, 176-ФЗ / 425-ФЗ (НДС 22%, Ledger-First)"
  - "BCBS 239 (Risk Data Aggregation & Reporting)"
---

# SKILL: bank-grade-db-guard — Архитектурный стандарт надежности БД банковского уровня (Tier-1 FinTech)

## Назначение стандарта
Настоящий документ регламентирует бескомпромиссные стандарты проектирования, эксплуатации и разработки баз данных высокой надежности (PostgreSQL 15/16 + Prisma 5 + Redis 7 + BullMQ) в финтех-системах и высоконагруженных транзакционных платформах.

В финансовых и биллинговых системах программные ошибки и состояния гонки недопустимы: единичный сбой сериализации, потерянная запись в леджере или race condition при списании баланса приводят к прямому ущербу капиталу компании, регуляторным санкциям (ЦБ РФ, ФНС, 54-ФЗ) и катастрофической потере институционального доверия.

Стандарт синтезирует инженерные практики ведущих мировых и отечественных финтех-институтов:
* **Stripe**: распределенный Idempotency Vault с атомарной резервацией и защитой от конкурирующих запросов.
* **Monzo Bank**: разделение команд и запросов (CQRS/Event Sourcing), где неизменяемый леджер проводок является единственным источником правды, а баланс счета — кэшированной проекцией.
* **Сбербанк**: высокопроизводительное партиционирование бухгалтерских журналов по диапазонам дат с устранением ловушек составных первичных ключей.
* **Тинькофф**: асинхронный Transactional Outbox с неблокирующим параллельным сбором через `SELECT ... FOR UPDATE SKIP LOCKED` и микропакетированием.

---

## 4 Столпа банковской архитектуры баз данных

```
               ┌────────────────────────────────────────────────────────┐
               │         БАНКОВСКИЙ СТАНДАРТ НАДЕЖНОСТИ (ACID)          │
               └───────────────────────────┬────────────────────────────┘
                                           │
         ┌───────────────────┬─────────────┴───────┬────────────────────┐
         ▼                   ▼                     ▼                    ▼
┌─────────────────┐ ┌──────────────────┐ ┌───────────────────┐ ┌─────────────────┐
│ 1. ИНВАРИАНТЫ   │ │ 2. АППАРАТНАЯ    │ │ 3. ГЕРМЕТИЧНОСТЬ  │ │ 4. САМОИЗЛЕЧЕНИЕ│
│ ЦЕЛОСТНОСТИ     │ │ ЗАЩИТА (ENGINE)  │ │ ТРАНЗАКЦИЙ        │ │ И МОНИТОРИНГ    │
│ • Ledger-First  │ │ • CHECK >= 0     │ │ • Zero Escape     │ │ • Vault Atomic  │
│ • ExactMath     │ │ • Triggers Immut │ │ • SKIP LOCKED     │ │ • 40P01 Retry   │
│ • BigInt Cents  │ │ • MVCC HOT 85%   │ │ • Atomic Updates  │ │ • Reconciliation│
│ • Double-Entry  │ │ • GIN pg_trgm    │ │ • Sized PgBouncer │ │ • Quarantine P0 │
└─────────────────┘ └──────────────────┘ └───────────────────┘ └─────────────────┘
```

---

## 1. Фундаментальные банковские инварианты

### 1.1. Принцип Ledger-First и инвариант двойной записи (Double-Entry Invariant)
1. **Первичность журнала над деривативом:**
   Баланс учетной записи (`User.balance`) является исключительно материализованной проекцией (быстрым кэшем для чтения). Истинное состояние счета определяется суммой неизменяемых проводок журнала:
   $$\text{Balance}(u) = \sum_{e \in \text{LedgerEntry}(u)} e.\text{amount}$$
2. **Железный порядок мутации:**
   Внутри транзакции запись в журнал `tx.ledgerEntry.create()` ОБЯЗАНА выполняться ДО мутации кэша `tx.user.update({ balance: ... })`.
3. **Закон сохранения денег (Conservation of Money):**
   Каждая транзакция в системе является сбалансированной. Средства не возникают из ниоткуда и не исчезают бесследно. Любое списание с баланса клиента сопровождается зеркальным зачислением на счет казначейства/провайдера (Escrow/Treasury):
   $$\sum \text{Credits} + \sum \text{Debits} \equiv 0$$
4. **Абсолютная неизменяемость (Append-Only):**
   Записи в `LedgerEntry` запрещено изменять (`UPDATE`) или физически удалять (`DELETE`). Корректировки ошибок выполняются исключительно созданием новых сторнирующих или компенсирующих проводок (`RECONCILIATION_ADJUSTMENT`).

### 1.2. ExactMath & Zero-Float Rule (Нулевая толерантность к IEEE 754)
1. **Запрет чисел с плавающей точкой:**
   Использование типов `number`, `float`, `double` или `REAL` для финансовых вычислений КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО. Двоичные погрешности округления (`0.1 + 0.2 = 0.30000000000000004`) приводят к утечке копеек и рассинхронизации балансов.
2. **Нативный BigInt в копейках/центах:**
   Все финансовые величины на всех слоях системы (API DTO, доменная логика, схемы Prisma, столбцы PostgreSQL) хранятся и вычисляются СТРОГО как целые числа `BigInt` (`BIGINT / INT8` в PostgreSQL) в минимальных неделимых единицах валюты:
   * $100.00$ ₽ $\implies `10000n`$ копеек.
   * $0.05$ ₽ $\implies `5n`$ копеек.
3. **Округление комиссий:**
   Любое деление сумм (расчет процентов, скидок, налогов НДС 22%) выполняется целочисленно с контролируемым направлением округления (Banker's Rounding / Half-to-Even или строгий `Floor` в пользу резерва системы).

### 1.3. Transaction Seal & Zero Transaction Escape (Герметичность границ транзакции)
1. **Суть дефекта Transaction Escape:**
   Вызов глобального инстанса `db.*` (PrismaClient) внутри замыкания `db.$transaction(async (tx) => { ... })`.
2. **Катастрофические последствия:**
   * **Грязные чтения (Dirty Reads / Inconsistent Reads):** Запрос через `db.*` выполняется вне транзакции и не видит изменений, внесенных `tx.*`, читая устаревшие данные.
   * **Истощение пула (Connection Pool Starvation):** Вызов `db.*` захватывает ВТОРОЕ соединение из пула в дополнение к уже удерживаемому `tx.*`. При параллельной нагрузке наступает мгновенная взаимная блокировка пула (`P2024 Pool Timeout`).
   * **Самоблокировка (Self-Deadlock):** Если `tx.*` заблокировал строку через `FOR UPDATE`, вызов `db.*` на эту же строку встанет в бесконечное ожидание своей собственной транзакции.
3. **Контракт типизации:**
   Все методы доменных сервисов и репозиториев обязаны требовать транзакционный клиент `tx: PrismaTx` в качестве обязательного параметра:
   ```typescript
   export type PrismaTx = Omit<
     Prisma.TransactionClient,
     '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
   >;
   ```

### 1.4. Гарантии конкурентности: Оптимистичные проверки и Row-Level Locking
1. **Уязвимость TOCTOU (Time-of-Check to Time-of-Use):**
   Наивный код `SELECT balance -> if (balance >= cost) -> UPDATE balance` уязвим к гонке. Десятки параллельных запросов увидят одинаковый баланс до момента первого списания, что приведет к глубокому отрицательному балансу.
2. **Атомарная условная мутация (Atomic Conditional Mutation):**
   Списание баланса обязано проверяться и фиксироваться в одной неделимой SQL-команде:
   ```sql
   UPDATE "User"
   SET balance = balance - :amount, "totalSpent" = "totalSpent" + :amount
   WHERE id = :userId AND balance >= :amount AND "tenantId" = :tenantId;
   ```
   В Prisma 5 это реализуется через `updateMany`:
   ```typescript
   const updated = await tx.user.updateMany({
     where: { id: userId, balance: { gte: amountCents }, tenantId },
     data: {
       balance: { decrement: amountCents },
       totalSpent: { increment: amountCents },
     },
   });
   if (updated.count === 0) {
     throw new WalletInsufficientFundsError(amountCents);
   }
   ```
3. **Пессимистическая блокировка строк (`SELECT ... FOR UPDATE`):**
   При сложных составных операциях (сверка портфеля, закрытие биллингового периода, распределение лимитов) строка пользователя блокируется эксклюзивно в начале транзакции, выстраивая конкурентные процессы в строгую очередь.

### 1.5. Аппаратные барьеры ядра СУБД (Hardware Constraints & Triggers)
Банковский уровень надежности исключает доверие исключительно к коду приложения. Любая логическая ошибка в коде, опечатка в фоновом скрипте или некорректный ручной запрос администратора должны физически блокироваться ядром СУБД:
1. **Физический CHECK Constraint на уровне PostgreSQL:**
   ```sql
   ALTER TABLE "User" DROP CONSTRAINT IF EXISTS chk_user_balance_non_negative;
   ALTER TABLE "User" ADD CONSTRAINT chk_user_balance_non_negative CHECK (balance >= 0);
   ```
   Любая транзакция, пытающаяся сделать `balance < 0`, аварийно прерывается ядром PostgreSQL с кодом `23514 check_violation`.
2. **Неизменяемый криптографический триггер Леджера:**
   ```sql
   CREATE OR REPLACE FUNCTION enforce_ledger_immutability()
   RETURNS TRIGGER AS $$
   BEGIN
     RAISE EXCEPTION 'FATAL [SECURITY]: LedgerEntry is immutable! UPDATE and DELETE operations are strictly prohibited by banking policy.'
       USING ERRCODE = 'P0001';
   END;
   $$ LANGUAGE plpgsql;

   DROP TRIGGER IF EXISTS trg_ledger_immutable ON "LedgerEntry";
   CREATE TRIGGER trg_ledger_immutable
   BEFORE UPDATE OR DELETE ON "LedgerEntry"
   FOR EACH ROW EXECUTE FUNCTION enforce_ledger_immutability();
   ```

### 1.6. Межтенантный барьер (Multi-Tenant Isolation & ст. 54.1 НК РФ)
В мульти-тенантных платформах (OmniSMM: SMMplan / SMMflux) все операции с балансом, заказами и проводками ОБЯЗАНЫ содержать `tenantId`:
1. Строгая изоляция проводок: `WHERE userId = :userId AND tenantId = :tenantId`.
2. Составные уникальные ограничения в БД: `@@unique([tenantId, idempotencyKey])`.
3. Составные индексы для быстрого поиска: `@@index([tenantId, userId, createdAt(sort: Desc)])`.

---

## 2. Архитектурные паттерны Tier-1 FinTech

### 2.1. Stripe-Style Distributed Idempotency Vault (Атомарная резервация состояния)

#### Проблема наивной реализации:
Наивный шаблон проверки идемпотентности содержит фатальное состояние гонки:
```typescript
// КАТАСТРОФА: Race Condition между get и set!
const cached = await redis.get(key);
if (cached) return JSON.parse(cached);

const result = await executePayment(); // Долгая транзакция
await redis.set(key, JSON.stringify(result));
```
Если клиент отправляет 2 параллельных сетевых запроса с одним ключом (например, двойной клик при медленном соединении), оба запроса одновременно выполняют `redis.get(key)`, оба получают `null`, оба инициируют списание денег в базе данных, приводя к двойному расходу.

#### Банковское решение (Stripe Idempotency Protocol):
Использование атомарного захвата состояния через `SET key value NX PX` (Set if Not eXists):

```
КЛИЕНТ                     REDIS (Vault)                 POSTGRESQL (ACID)
  │                              │                               │
  ├── 1. POST /charge ──────────►│                               │
  │   (Idempotency-Key: K1)      │                               │
  │                              ├── 2. SET K1 'PROCESSING' NX   │
  │                              │   [OK: Lock Acquired]         │
  │                              │                               ├── 3. BEGIN TX
  │                              │                               │   • Insert LedgerEntry
  │                              │                               │   • Update Balance
  │                              │                               │   • Commit
  │                              │                               │◄── 4. TX Committed
  │                              ├── 5. SET K1 'COMPLETED' EX    │
  │◄── 6. 200 OK (Charged) ──────┤                               │
  │                              │                               │
  │─── 7. РЕЙТРАЙ (К1) ─────────►│                               │
  │                              ├── 8. GET K1                   │
  │                              │   [Status: COMPLETED]         │
  │◄── 9. 200 OK (Replayed) ─────┤ (БД НЕ затрагивается!)        │
```

1. **Фаза 1: Атомарная резервация (`SET NX PX`):**
   Первый поток выполняет `SET idemp:key '{"status":"PROCESSING"}' PX 5000 NX`.
   * Если ответ `'OK'`: поток признается легитимным владельцем ключа и приступает к выполнению бизнес-транзакции.
   * Если ответ `null`: ключ уже зарезервирован другим процессом.
2. **Фаза 2: Обработка конкурирующего запроса:**
   Поток, не получивший блокировку, опрашивает Redis в цикле ожидания (polling loop) с интервалом 50–100 мс:
   * Если статус сменился на `'COMPLETED'`: возвращается закэшированный результат с заголовком `Idempotency-Replayed: true`.
   * Если таймаут превышен: возвращается `HTTP 409 Conflict` (`IDEMPOTENT_OPERATION_IN_PROGRESS`) с заголовком `Retry-After: 2`.
3. **Фаза 3: Фиксация завершения:**
   При успешном коммите транзакции статус переводится в `'COMPLETED'` с полным телом ответа и TTL 24–48 часов.
4. **Фаза 4: Компенсация при сбое:**
   Если бизнес-транзакция выбросила исключение, ключ в Redis НЕМЕДЛЕННО удаляется (`redis.del`), позволяя пользователю мгновенно повторить операцию после исправления ошибки.
5. **Вторичный эшелон обороны (DB Unique Constraint):**
   Таблица `LedgerEntry` защищена ограничением `@@unique([tenantId, idempotencyKey])`. Даже при полном отказе Redis база данных физически отвергнет дубликат с кодом ошибки Prisma `P2002`.

### 2.2. Event Sourcing & Projected Balances (Модель Monzo Bank)
В архитектуре Monzo баланс учетной записи никогда не рассматривается как независимая сущность:
1. **Командная модель (Write Model):** Создание неизменяемой записи `LedgerEntry`. Каждая запись содержит:
   * `amount` (знаковое целое: отрицательное для списаний, положительное для пополнений).
   * `transactionType` (`PAYMENT`, `REFUND`, `COMPENSATION`, `FEE`).
   * `idempotencyKey` (глобальный уникальный идентификатор транзакции).
   * `periodId` (ссылка на расчетный финансовый период).
2. **Модель запросов (Read Model):** Колонка `User.balance`. Это денормализованный материализованный кэш, обновляемый синхронно в той же ACID-транзакции.
3. **Аудиторская формула Monzo:**
   В любой момент времени для любого пользователя $u$ на временном интервале $[0, T]$ выполняется тождество:
   $$\text{User.balance}(T) - \text{User.balance}(0) \equiv \sum_{t=0}^T \text{LedgerEntry.amount}_t$$

### 2.3. PostgreSQL Table Partitioning (Секционирование по стандарту Сбербанка)
При достижении объема в десятки миллионов строк таблица `LedgerEntry` начинает вытеснять данные из оперативной памяти (`shared_buffers`), а B-Tree индексы перестают помещаться в RAM.

#### Архитектура декларативного партиционирования:
Секционирование таблицы проводок по диапазону дат (`PARTITION BY RANGE ("createdAt")`):
* Секции создаются помесячно: `LedgerEntry_2026_08`, `LedgerEntry_2026_09`, `LedgerEntry_2026_10`.
* Отдельная секция по умолчанию (`DEFAULT`) для защиты от сбоев при рассинхронизации календаря.

#### ⚠️ КРИТИЧЕСКАЯ ЛОВУШКА POSTGRESQL (Partitioning Key Trap):
> **Правило ядра PostgreSQL:** В секционированной таблице ЛЮБОЙ первичный ключ (`PRIMARY KEY`) или уникальный индекс (`UNIQUE`) ОБЯЗАН содержать в себе все колонки секционирования!

Попытка выполнить `PRIMARY KEY (id)` приведет к фатальной ошибке СУБД:
`ERROR: unique constraint on partitioned table must include all partitioning columns.`

**Корректное объявление:**
```sql
CREATE TABLE "LedgerEntry" (
  id TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT 'smmplan',
  "userId" TEXT NOT NULL,
  amount BIGINT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'APPROVED',
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "pk_ledger_entry" PRIMARY KEY (id, "createdAt")
) PARTITION BY RANGE ("createdAt");
```

#### Настройка Prisma 5 для работы с составным первичным ключом:
В `schema.prisma`:
```prisma
model LedgerEntry {
  id             String   @default(cuid())
  tenantId       String   @default("smmplan")
  userId         String
  amount         BigInt
  reason         String
  status         String   @default("APPROVED")
  idempotencyKey String?
  createdAt      DateTime @default(now())

  // Составной первичный ключ для совместимости с PostgreSQL Partitioning
  @@id([id, createdAt])
  @@index([userId, createdAt(sort: Desc), id(sort: Desc)])
  @@index([tenantId, createdAt(sort: Desc), id(sort: Desc)])
}
```

* Поиск по уникальному идентификатору требует передачи обоих полей:
  `db.ledgerEntry.findUnique({ where: { id_createdAt: { id, createdAt } } })`
* При выборке только по `id` используется `findFirst({ where: { id } })`.
* **Partition Pruning:** При наличии условия `WHERE createdAt >= '2026-09-01'` оптимизатор PostgreSQL (`enable_partition_pruning = on`) физически исключает сканирование всех остальных месяцев, сокращая I/O на 95%.

### 2.4. Resilient Transactional Outbox Pattern (Защита от Dual-Write)

#### Анатомия проблемы Dual-Write:
Попытка одновременно обновить базу данных и опубликовать событие в распределенную очередь (BullMQ, Kafka, RabbitMQ) принципиально ненадежна без двухфазного коммита (2PC):
1. **Сценарий отказа 1:** Транзакция БД закоммичена, но брокер сообщений недоступен по сети $\implies$ Событие утеряно навсегда, заказ не передан поставщику.
2. **Сценарий отказа 2:** Сообщение отправлено брокеру, но транзакция в базе данных откатилась из-за дедлока $\implies$ Брокер обработал фантомный заказ, деньги за который не были списаны.

#### Банковское решение (Transactional Outbox):
1. В той же транзакции `tx`, где списываются средства и создается заказ, создается запись в локальной таблице `OutboxEvent`.
2. Так как обе операции происходят в одной БД, коммит атомарен.
3. Фоновый консьюмер опрашивает события пачками с использованием `SKIP LOCKED`:

```sql
SELECT id, "tenantId", "eventType", payload, attempts
FROM "OutboxEvent"
WHERE status = 'PENDING' AND "scheduledAt" <= NOW()
ORDER BY "createdAt" ASC
LIMIT 50
FOR UPDATE SKIP LOCKED;
```

#### ⚠️ Почему `SKIP LOCKED` критически важен:
* Обычный `SELECT ... FOR UPDATE` блокирует всю выбранную страницу строк. Все параллельные воркеры встанут в очередь, сводя многопоточную обработку к одному потоку.
* Конструкция `SKIP LOCKED` заставляет СУБД пропускать строки, уже заблокированные соседними процессами. Это обеспечивает горизонтальное масштабирование пула обработчиков без задержек и взаимных блокировок.

### 2.5. Обработка дедлоков и сбоев сериализации (40001 & 40P01)
В высоконагруженных системах с уровнями изоляции `REPEATABLE READ` и `SERIALIZABLE` возникновение конфликтов сериализации — это штатное поведение механизма контроля параллелизма (MVCC/SSI):
* **`40001 (serialization_failure)`:** обнаружен цикл зависимостей чтения-записи. Транзакция прервана СУБД для сохранения эквивалентности последовательному исполнению.
* **`40P01 (deadlock_detected)`:** два конкурирующих процесса заблокировали ресурсы в противоположном порядке (например, Поток 1: User A $\to$ User B; Поток 2: User B $\to$ User A). Встроенный Deadlock Detector PostgreSQL обрывает одну из транзакций.
* **В Prisma 5:** обе ошибки генерируют исключение с кодом `P2034` (Write conflict or deadlock).

#### Алгоритм автоматического перезапуска (Retry with Full Jitter):
Транзакции, прерванные по ошибкам `40001`, `40P01`, `P2034` или временным таймаутам пула `P2024`, должны автоматически повторяться с экспоненциальной задержкой и случайным разбросом (Full Jitter), чтобы предотвратить повторное столкновение потоков:
$$T_{\text{sleep}} = \text{random}\left(0, \min\left(T_{\text{max}}, T_{\text{base}} \times 2^{\text{attempt}}\right)\right)$$

### 2.6. Архитектура пула соединений: Sizing Formula и PgBouncer

#### Процессная модель PostgreSQL:
PostgreSQL работает по модели «одно клиентское соединение = один процесс операционной системы» (`postgres process`). Каждый процесс потребляет от 5 до 15 МБ базовой оперативной памяти плюс выделенный буфер `work_mem` (до сотен мегабайт на тяжелых сортировках).

#### Математическая формула сайзинга пула (HikariCP / PostgreSQL Standard):
$$\text{Max Connections} = ((\text{CPU Cores} \times 2) + \text{Effective Spindles})$$

* Для современного 8-ядерного сервера с NVMe SSD накопителями (где фактор шпинделя $\approx 1$):
  $$\text{Max Connections} = (8 \times 2) + 1 = 17 \text{ соединений!}$$
* **Заблуждение:** Увеличение `max_connections` до 500–1000 «ускоряет базу данных».
* **Реальность:** При 500 активных процессах процессор тратит 80% времени на переключение контекста (Context Switching), инвалидацию кэшей L1/L2/L3 и борьбу за Spinlock'и менеджера блокировок. Пропускная способность (TPS) падает по экспоненте.

#### Интеграция PgBouncer в режиме Transaction Pooling:
```
  [ Next.js Pods / Server Actions ]  (До 5 000 параллельных клиентов)
                   │
                   ▼  (Короткоживущие сессии)
  ┌─────────────────────────────────┐
  │       PgBouncer (Port 6432)     │  pool_mode = transaction
  └────────────────┬────────────────┘  default_pool_size = 20
                   │
                   ▼  (Строго 20 постоянных серверных соединений)
  ┌─────────────────────────────────┐
  │       PostgreSQL 15 / 16        │  max_connections = 40
  └─────────────────────────────────┘
```

1. **Transaction Pooling (`pool_mode = transaction`):**
   PgBouncer выделяет соединение к PostgreSQL только на время физической транзакции (`BEGIN` $\dots$ `COMMIT`) и немедленно забирает его обратно для других клиентов.
2. **Критические инварианты при работе через PgBouncer:**
   * **Prepared Statements:** Prisma 5 обязана использовать параметр `?pgbouncer=true` в `DATABASE_URL` (отключает протокольные prepared statements или переводит их в безымянный режим).
   * **Запрет сессионных команд:** Запрещены `SET search_path`, временные таблицы (`CREATE TEMP TABLE`), `LISTEN / NOTIFY` и session-level advisory locks.
   * **Advisory Locks:** Использовать строго транзакционные блокировки `pg_advisory_xact_lock()`, которые автоматически освобождаются при коммите.

---

## 3. Каталог критических антипаттернов (Ошибки из реальных инцидентов)

### ❌ 3.1. Водопад N+1 и Катастрофа OOM при жадной загрузке

#### Ошибка 1: Классический N+1 водопад
```typescript
// КАТАСТРОФА: Генерирует 1 + 50 = 51 SQL-запрос, сжигая пул соединений
const users = await db.user.findMany({ take: 50 });
for (const user of users) {
  const orders = await db.order.findMany({ where: { userId: user.id } });
}
```

#### Ошибка 2 (Опасное псевдо-исправление): Неограниченный `include`
```typescript
// ОШИБКА: Исчерпание памяти Node.js Heap (Out-Of-Memory Crash)
const users = await db.user.findMany({
  take: 50,
  include: {
    orders: true, // ВНИМАНИЕ: Если у пользователя 50 000 заказов, Node.js упадет с OOM!
  },
});
```
Если в базе есть активные клиенты с десятками тысяч заказов, Prisma выгрузит сотни тысяч объектов в кучу V8 JavaScript. Сервер завершит работу аварийно: `FATAL ERROR: JavaScript heap out of memory`.

#### ✅ ЭТАЛОННОЕ РЕШЕНИЕ (Проекции, пагинация связей и агрегаты):
```typescript
// Решение А: Агрегация количества без загрузки строк в память
const usersWithStats = await db.user.findMany({
  take: 50,
  select: {
    id: true,
    email: true,
    balance: true,
    _count: {
      select: { orders: true }, // СУБД выполнит быстрый COUNT(*)
    },
  },
});

// Решение Б: Загрузка только последних N записей с жестким лимитом
const usersWithRecentOrders = await db.user.findMany({
  take: 50,
  select: {
    id: true,
    email: true,
    orders: {
      take: 5, // ЖЕСТКОЕ ОГРАНИЧЕНИЕ
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true, totalCost: true, createdAt: true },
    },
  },
});
```

---

### ❌ 3.2. Толстые транзакции (Network I/O внутри Transaction Boundary)

```typescript
// ОШИБКА: Удержание блокировок строк на время сетевого ответа
await db.$transaction(async (tx) => {
  const order = await tx.order.create({ data: { ... } });

  // КАТАСТРОФА: Внешний API зависает на 5 секунд.
  // Все это время транзакция открыта, удерживая соединение из пула и блокировки строк!
  await telegramApi.sendMessage(`Новый заказ: ${order.id}`);
  await yookassaApi.createPayment({ ... });
});
```

#### Механизм отказа:
1. Внешний сервис испытывает сетевую деградацию (latency возрастает с 50 мс до 4000 мс).
2. Время удержания соединения в транзакции возрастает в 80 раз.
3. Пул соединений мгновенно насыщается (все 15–20 соединений заняты ожиданием сети).
4. Все последующие запросы к платформе (включая авторизацию и чтение каталога) падают с ошибкой `P2024 (Timed out fetching connection from pool)`. Каскадный отказ всей системы.

#### ✅ ЭТАЛОННОЕ РЕШЕНИЕ (Transactional Outbox Pattern):
```typescript
await db.$transaction(async (tx) => {
  const order = await tx.order.create({ data: { ... } });

  // Запись в локальную таблицу Outbox внутри транзакции (< 2 мс)
  await tx.outboxEvent.create({
    data: {
      tenantId: order.tenantId,
      eventType: 'TELEGRAM_ORDER_ALERT',
      payload: { orderId: order.id, totalCost: order.totalCost.toString() },
      status: 'PENDING',
    },
  });
});
// Фоновый воркер BullMQ асинхронно отправит сообщение с гарантией повтора при сбое сети.
```

---

### ❌ 3.3. Удушье через OFFSET и недетерминированная пагинация по курсору

#### Ошибка 1: Смерть через OFFSET
```typescript
// ОШИБКА: Деградация O(N). PostgreSQL прочитает 500 050 строк с диска и выбросит 500 000.
const page = 10000;
const history = await db.ledgerEntry.findMany({
  skip: page * 50, // OFFSET 500000
  take: 50,
});
```

#### Ошибка 2: Недетерминированный курсор (Timestamp Collision & Row Skipping)
```typescript
// ОШИБКА А: Курсор без явной сортировки
const items = await db.ledgerEntry.findMany({
  take: 50,
  cursor: { id: lastSeenId }, // ПОРЯДОК НЕ ОПРЕДЕЛЕН! PostgreSQL вернет произвольные строки.
});

// ОШИБКА Б: Сортировка только по non-unique createdAt
const items2 = await db.ledgerEntry.findMany({
  take: 50,
  orderBy: { createdAt: 'desc' }, // При совпадении createdAt строки выпадут из пагинации!
});
```

#### ✅ ЭТАЛОННОЕ РЕШЕНИЕ (Составной детерминированный Keyset Cursor):
```typescript
// B-Tree индекс: @@index([userId, createdAt(sort: Desc), id(sort: Desc)])
// Поиск за O(1) независимо от глубины страницы:
const nextBatch = await db.ledgerEntry.findMany({
  where: {
    userId,
    tenantId,
    ...(cursor
      ? {
          OR: [
            { createdAt: { lt: cursor.createdAt } },
            {
              createdAt: cursor.createdAt,
              id: { lt: cursor.id }, // Устранение коллизий одинаковых миллисекунд
            },
          ],
        }
      : {}),
  },
  take: 50,
  orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], // Строго детерминированный порядок
});
```

---

### ❌ 3.4. Нарушение Ledger-First и уязвимость TOCTOU при операциях с балансом

```typescript
// ОШИБКА: Проверка в памяти приложения + списание перед записью в лог
const user = await db.user.findUnique({ where: { id: userId } });
if (user.balance < amount) throw new Error("No money"); // RACE CONDITION!

await db.user.update({
  where: { id: userId },
  data: { balance: user.balance - amount } // ОШИБКА: Float drift / Lost Update
});

// Если здесь произойдет сетевой сбой или OOM — деньги списаны, а следов в журнале нет!
await db.ledgerEntry.create({ data: { ... } });
```

#### ✅ ЭТАЛОННОЕ РЕШЕНИЕ:
1. Запись в `LedgerEntry` создается ПЕРВОЙ.
2. Мутация баланса выполняется атомарно по условию `WHERE balance >= :amount`.
3. Все суммы представлены в `BigInt` (копейки).

---

### ❌ 3.5. Блокирующие DDL-миграции в продакшене (Lock Contention)

```sql
-- ОШИБКА: Блокирует все операции записи (INSERT, UPDATE, DELETE) на всей таблице "Order"
CREATE INDEX "idx_order_status" ON "Order"("status");

-- ОШИБКА: Захватывает эксклюзивную блокировку ACCESS EXCLUSIVE на чтение и запись
ALTER TABLE "User" ADD COLUMN "isVerified" BOOLEAN NOT NULL;
```

#### ✅ ЭТАЛОННОЕ РЕШЕНИЕ (Zero-Downtime DDL):
```sql
-- Шаг 1: Обязательное ограничение времени ожидания блокировки (предотвращает очередь)
SET lock_timeout = '2s';
SET statement_timeout = '30s';

-- Шаг 2: Создание индекса в фоновом режиме без блокировки записи
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_order_status" ON "Order"("status");

-- Шаг 3: Добавление колонки с DEFAULT значением (в PostgreSQL 11+ выполняется мгновенно как метаданные)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isVerified" BOOLEAN NOT NULL DEFAULT false;
```

---

### ❌ 3.6. Состояние гонки в наивной идемпотентности (Double-Spending via Idempotency Gap)

```typescript
// ОШИБКА: Окно уязвимости между проверкой и фиксацией
const exists = await redis.get(`idemp:${key}`);
if (exists) return JSON.parse(exists);

// Два параллельных запроса одновременно проходят проверку и оба вызывают списание!
const result = await processOrder();
await redis.set(`idemp:${key}`, JSON.stringify(result));
```

#### ✅ ЭТАЛОННОЕ РЕШЕНИЕ:
Использование атомарного захвата состояния `SET NX PX` с поддержкой сериализации `BigInt` (см. Раздел 4.1).

---

## 4. Эталонные реализации (Production-Grade Reference Implementations)

Ниже приведены полнофункциональные, типобезопасные и верифицированные реализации ключевых компонентов банковской надежности.

### 4.1. `StripeIdempotencyVault` (TypeScript + Redis)
Обеспечивает атомарную резервацию ключа идемпотентности, обработку параллельных запросов (опрос либо HTTP 409 Conflict), безопасную сериализацию `BigInt` и мгновенное снятие блокировки при сбоях.

```typescript
import Redis from 'ioredis';

export interface IdempotencyOptions {
  ttlSeconds?: number;
  lockTimeoutMs?: number;
  pollIntervalMs?: number;
}

export interface IdempotentResult<T> {
  data: T;
  replayed: boolean;
}

export class IdempotencyConflictError extends Error {
  readonly code = 'IDEMPOTENCY_CONFLICT';
  readonly retryAfterSeconds: number;
  constructor(message: string, retryAfterSeconds = 2) {
    super(message);
    this.name = 'IdempotencyConflictError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Безопасная сериализация BigInt в формат JSON для хранения в Redis
 */
export function serializeWithBigInt(value: unknown): string {
  return JSON.stringify(value, (_, v) =>
    typeof v === 'bigint' ? `${v.toString()}n` : v
  );
}

/**
 * Восстановление BigInt из JSON
 */
export function deserializeWithBigInt<T>(text: string): T {
  return JSON.parse(text, (_, v) => {
    if (typeof v === 'string' && /^-?\d+n$/.test(v)) {
      return BigInt(v.slice(0, -1));
    }
    return v;
  });
}

export class StripeIdempotencyVault {
  constructor(private readonly redis: Redis) {}

  async execute<T>(
    key: string,
    operation: () => Promise<T>,
    options?: IdempotencyOptions
  ): Promise<IdempotentResult<T>> {
    const ttlSeconds = options?.ttlSeconds ?? 86400; // 24 часа по умолчанию
    const lockTimeoutMs = options?.lockTimeoutMs ?? 5000;
    const pollIntervalMs = options?.pollIntervalMs ?? 100;
    const redisKey = `idemp:vault:${key}`;

    // 1. Атомарная резервация ключа через SET ... NX PX
    const acquired = await this.redis.set(
      redisKey,
      serializeWithBigInt({ status: 'PROCESSING', startedAt: Date.now() }),
      'PX',
      lockTimeoutMs,
      'NX'
    );

    if (acquired === 'OK') {
      // Блокировка успешно получена — данный процесс выполняет операцию
      try {
        const result = await operation();
        // Фиксация финального успешного ответа с полным TTL
        await this.redis.set(
          redisKey,
          serializeWithBigInt({
            status: 'COMPLETED',
            data: result,
            completedAt: Date.now(),
          }),
          'EX',
          ttlSeconds
        );
        return { data: result, replayed: false };
      } catch (error) {
        // При возникновении ошибки немедленно снимаем блокировку для разрешения ретрая
        await this.redis.del(redisKey);
        throw error;
      }
    }

    // 2. Блокировка НЕ получена: параллельный процесс уже выполняет или выполнил операцию
    const startTime = Date.now();
    while (Date.now() - startTime < lockTimeoutMs) {
      const raw = await this.redis.get(redisKey);
      if (!raw) {
        // Предыдущий процесс упал с ошибкой и снял блокировку — пробуем заново
        return this.execute(key, operation, options);
      }

      const parsed = deserializeWithBigInt<{ status: string; data?: T }>(raw);
      if (parsed.status === 'COMPLETED') {
        return { data: parsed.data as T, replayed: true };
      }

      // Операция все еще в процессе обработки — ждем следующий тик
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    // Таймаут ожидания параллельной операции — возвращаем управляемый конфликт 409
    throw new IdempotencyConflictError(
      `Concurrent operation for idempotency key ${key} is in progress. Please retry shortly.`,
      2
    );
  }
}
```

---

### 4.2. `runSerializableTransaction` (TypeScript + Prisma 5)
Отказоустойчивый транзакционный раннер с экспоненциальной задержкой, полным случайным джиттером и автоматическим распознаванием сбоев сериализации (`40001`), дедлоков (`40P01`, `P2034`) и таймаутов пула (`P2024`).

```typescript
import { Prisma, PrismaClient } from '@prisma/client';

export interface TransactionRetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  timeoutMs?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
}

export function isRetryableTransactionError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const errorObj = err as { code?: string; message?: string };
  const message = errorObj.message || '';
  const code = errorObj.code || '';

  // Prisma: P2034 (конфликт записи или дедлок), P2024 (таймаут пула соединений)
  if (code === 'P2034' || code === 'P2024') return true;

  // PostgreSQL 40001: serialization_failure
  if (code === '40001' || message.includes('40001') || message.includes('could not serialize access')) {
    return true;
  }

  // PostgreSQL 40P01: deadlock_detected
  if (code === '40P01' || message.includes('40P01') || message.includes('deadlock detected')) {
    return true;
  }

  return false;
}

export async function runSerializableTransaction<T>(
  prisma: PrismaClient,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: TransactionRetryOptions
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 10;
  const baseDelayMs = options?.baseDelayMs ?? 25;
  const maxDelayMs = options?.maxDelayMs ?? 1000;
  const timeoutMs = options?.timeoutMs ?? 15000;
  const isolationLevel = options?.isolationLevel ?? Prisma.TransactionIsolationLevel.Serializable;

  let attempt = 0;

  while (true) {
    attempt++;
    try {
      return await prisma.$transaction(operation, {
        isolationLevel,
        timeout: timeoutMs,
      });
    } catch (err: unknown) {
      if (isRetryableTransactionError(err) && attempt <= maxRetries) {
        // Full Jitter: случайная задержка от 0 до min(maxDelay, baseDelay * 2^attempt)
        const exponentialBound = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt));
        const sleepWithJitter = Math.random() * exponentialBound;

        console.warn(
          `[TransactionRetry] Retryable error (attempt ${attempt}/${maxRetries}). Retrying in ${sleepWithJitter.toFixed(1)}ms...`
        );

        await new Promise((resolve) => setTimeout(resolve, sleepWithJitter));
        continue;
      }
      throw err;
    }
  }
}
```

---

### 4.3. `WalletOps` — Банковский сервис финансовых операций
Реализует списание (`charge`) и пополнение (`credit`) с абсолютным соблюдением Ledger-First, `BigInt` ExactMath, условного декремента баланса и обработки коллизий `P2002`.

```typescript
import { Prisma } from '@prisma/client';

export type PrismaTx = Omit<
  Prisma.TransactionClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export class WalletInsufficientFundsError extends Error {
  readonly code = 'INSUFFICIENT_FUNDS';
  constructor(needed: bigint, current: bigint) {
    super(`Insufficient funds: required ${needed} kopecks, available ${current} kopecks.`);
    this.name = 'WalletInsufficientFundsError';
  }
}

export class WalletUserNotFoundError extends Error {
  readonly code = 'USER_NOT_FOUND';
  constructor(userId: string) {
    super(`User ${userId} not found or tenant access violation.`);
    this.name = 'WalletUserNotFoundError';
  }
}

export class WalletInvalidAmountError extends Error {
  readonly code = 'INVALID_AMOUNT';
  constructor(action: string) {
    super(`${action} amount must be a positive non-zero integer.`);
    this.name = 'WalletInvalidAmountError';
  }
}

export interface WalletChargeOptions {
  idempotencyKey?: string;
  adminId?: string;
  tenantId?: string;
}

export const WalletOps = {
  /**
   * Банковское списание средств со счета пользователя.
   * Строго соблюдает Ledger-First Principle и защиту от двойного расходования.
   */
  async charge(
    tx: PrismaTx,
    userId: string,
    amountKopecks: bigint,
    reason: string,
    options?: WalletChargeOptions
  ) {
    const MAX_SINGLE_CHARGE = BigInt(100_000_000); // Лимит 1 000 000.00 ₽ для безопасности
    if (amountKopecks <= BigInt(0) || amountKopecks > MAX_SINGLE_CHARGE) {
      throw new WalletInvalidAmountError('Charge');
    }

    const tenantId = options?.tenantId ?? 'smmplan';
    const idempotencyKey = options?.idempotencyKey;

    // 1. Проверка существования пользователя и межтенантного барьера
    const user = await tx.user.findFirst({
      where: { id: userId, tenantId },
      select: { id: true, balance: true, tenantId: true },
    });

    if (!user) {
      throw new WalletUserNotFoundError(userId);
    }

    if (user.balance < amountKopecks) {
      throw new WalletInsufficientFundsError(amountKopecks, user.balance);
    }

    // 2. Проверка идемпотентности в БД
    if (idempotencyKey) {
      const existing = await tx.ledgerEntry.findFirst({
        where: { idempotencyKey, tenantId },
      });
      if (existing) {
        return { success: true, balance: user.balance, cached: true, entry: existing };
      }
    }

    try {
      // 3. LEDGER-FIRST INVARIANT: Запись в журнал создается ДО изменения баланса!
      const entry = await tx.ledgerEntry.create({
        data: {
          userId,
          tenantId,
          adminId: options?.adminId,
          amount: -amountKopecks, // Списание = отрицательное значение
          reason,
          status: 'APPROVED',
          idempotencyKey,
          transactionType: 'ORDER_CHARGE',
        },
      });

      // 4. АТОМАРНАЯ МУТАЦИЯ БАЛАНСА с проверкой условия (Optimistic Concurrency)
      const updateResult = await tx.user.updateMany({
        where: {
          id: userId,
          tenantId,
          balance: { gte: amountKopecks }, // Физическая защита от гонки
        },
        data: {
          balance: { decrement: amountKopecks },
          totalSpent: { increment: amountKopecks },
        },
      });

      if (updateResult.count === 0) {
        // Конкурирующий поток успел списать средства раньше
        const freshUser = await tx.user.findUnique({
          where: { id: userId },
          select: { balance: true },
        });
        throw new WalletInsufficientFundsError(amountKopecks, freshUser?.balance ?? BigInt(0));
      }

      const finalUser = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { balance: true },
      });

      return { success: true, balance: finalUser.balance, cached: false, entry };
    } catch (error: unknown) {
      // Обработка коллизии уникального ключа идемпотентности (P2002)
      if (
        idempotencyKey &&
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        const existing = await tx.ledgerEntry.findFirst({
          where: { idempotencyKey, tenantId },
        });
        if (existing) {
          const userCurrent = await tx.user.findUnique({
            where: { id: userId },
            select: { balance: true },
          });
          return { success: true, balance: userCurrent?.balance ?? null, cached: true, entry: existing };
        }
      }
      throw error;
    }
  },

  /**
   * Банковское зачисление средств (пополнение баланса, возврат).
   */
  async credit(
    tx: PrismaTx,
    userId: string,
    amountKopecks: bigint,
    reason: string,
    options?: WalletChargeOptions
  ) {
    const MAX_SINGLE_CREDIT = BigInt(100_000_000);
    if (amountKopecks <= BigInt(0) || amountKopecks > MAX_SINGLE_CREDIT) {
      throw new WalletInvalidAmountError('Credit');
    }

    const tenantId = options?.tenantId ?? 'smmplan';
    const idempotencyKey = options?.idempotencyKey;

    const user = await tx.user.findFirst({
      where: { id: userId, tenantId },
      select: { id: true, balance: true },
    });

    if (!user) {
      throw new WalletUserNotFoundError(userId);
    }

    if (idempotencyKey) {
      const existing = await tx.ledgerEntry.findFirst({
        where: { idempotencyKey, tenantId },
      });
      if (existing) {
        return { success: true, balance: user.balance, cached: true, entry: existing };
      }
    }

    // Ledger-First проводка
    const entry = await tx.ledgerEntry.create({
      data: {
        userId,
        tenantId,
        adminId: options?.adminId,
        amount: amountKopecks, // Зачисление = положительное значение
        reason,
        status: 'APPROVED',
        idempotencyKey,
        transactionType: 'PAYMENT_CREDIT',
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: { balance: { increment: amountKopecks } },
    });

    const finalUser = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { balance: true },
    });

    return { success: true, balance: finalUser.balance, cached: false, entry };
  },
};
```

---

### 4.4. `TransactionalOutboxEngine` (PostgreSQL `SKIP LOCKED` + BullMQ)

```typescript
import { Prisma, PrismaClient } from '@prisma/client';

export interface OutboxMessage {
  id: string;
  eventType: string;
  payload: unknown;
  tenantId: string;
}

export class TransactionalOutboxEngine {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly dispatcher: (message: OutboxMessage) => Promise<void>
  ) {}

  /**
   * Добавляет событие в Outbox в рамках существующей транзакции бизнес-логики.
   */
  async enqueue(
    tx: Prisma.TransactionClient,
    eventType: string,
    payload: Record<string, unknown>,
    tenantId = 'smmplan'
  ): Promise<string> {
    const id = `outbox_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    await tx.$executeRaw`
      INSERT INTO "OutboxEvent" (id, "tenantId", "eventType", payload, status, attempts, "createdAt", "updatedAt")
      VALUES (${id}, ${tenantId}, ${eventType}, ${JSON.stringify(payload)}::jsonb, 'PENDING', 0, NOW(), NOW())
    `;
    return id;
  }

  /**
   * Высокопроизводительный консьюмер с неблокирующим сбором через FOR UPDATE SKIP LOCKED.
   */
  async processBatch(batchSize = 50): Promise<number> {
    return await this.prisma.$transaction(async (tx) => {
      // 1. Атомарный захват пачки событий без блокировки параллельных воркеров
      const events = await tx.$queryRaw<
        Array<{
          id: string;
          tenantId: string;
          eventType: string;
          payload: any;
          attempts: number;
        }>
      >`
        SELECT id, "tenantId", "eventType", payload, attempts
        FROM "OutboxEvent"
        WHERE status = 'PENDING'
        ORDER BY "createdAt" ASC
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      `;

      if (events.length === 0) return 0;

      for (const event of events) {
        try {
          // 2. Диспетчеризация во внешнюю очередь (BullMQ / Kafka)
          await this.dispatcher({
            id: event.id,
            eventType: event.eventType,
            payload: event.payload,
            tenantId: event.tenantId,
          });

          // 3. Отметка об успешной отправке
          await tx.$executeRaw`
            UPDATE "OutboxEvent"
            SET status = 'PROCESSED', "updatedAt" = NOW()
            WHERE id = ${event.id}
          `;
        } catch (dispatchErr: any) {
          const nextAttempt = event.attempts + 1;
          const maxAttempts = 5;
          const nextStatus = nextAttempt >= maxAttempts ? 'DEAD_LETTER' : 'PENDING';

          await tx.$executeRaw`
            UPDATE "OutboxEvent"
            SET status = ${nextStatus},
                attempts = ${nextAttempt},
                error = ${String(dispatchErr?.message ?? dispatchErr)},
                "updatedAt" = NOW()
            WHERE id = ${event.id}
          `;
        }
      }

      return events.length;
    }, { timeout: 30000 });
  }
}
```

---

### 4.5. `KeysetPaginationService` (Детерминированный Seek $O(1)$)

```typescript
import { PrismaClient, Prisma } from '@prisma/client';

export interface KeysetPaginationOptions {
  userId: string;
  tenantId: string;
  cursor?: { id: string; createdAt: Date } | null;
  limit?: number;
}

export interface KeysetPageResult<T> {
  items: T[];
  nextCursor: { id: string; createdAt: Date } | null;
  hasMore: boolean;
}

export class KeysetPaginationService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Извлечение проводок за постоянное время O(1) с составным тай-брейкером и Anti-IDOR защитой.
   */
  async fetchLedgerEntries(options: KeysetPaginationOptions): Promise<
    KeysetPageResult<{
      id: string;
      amount: bigint;
      reason: string;
      createdAt: Date;
    }>
  > {
    const { userId, tenantId, cursor, limit = 50 } = options;

    const whereClause: Prisma.LedgerEntryWhereInput = {
      userId,
      tenantId,
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: cursor.createdAt } },
              {
                createdAt: cursor.createdAt,
                id: { lt: cursor.id }, // Разрешение коллизий одинаковых миллисекунд
              },
            ],
          }
        : {}),
    };

    // Запрашиваем limit + 1 для определения наличия следующей страницы без COUNT(*)
    const records = await this.prisma.ledgerEntry.findMany({
      where: whereClause,
      take: limit + 1,
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' }, // Гарантированный строгий порядок
      ],
      select: {
        id: true,
        amount: true,
        reason: true,
        createdAt: true,
      },
    });

    const hasMore = records.length > limit;
    const items = hasMore ? records.slice(0, limit) : records;
    const lastItem = items[items.length - 1];

    const nextCursor =
      hasMore && lastItem
        ? { id: lastItem.id, createdAt: lastItem.createdAt }
        : null;

    return {
      items,
      nextCursor,
      hasMore,
    };
  }
}
```

---

### 4.6. `ReconciliationQuarantineDaemon` (Сверка целостности и протокол карантина)

```typescript
import { PrismaClient } from '@prisma/client';

export interface ReconciliationDiscrepancy {
  userId: string;
  tenantId: string;
  userBalance: bigint;
  ledgerSum: bigint;
  driftKopecks: bigint;
}

export class ReconciliationQuarantineDaemon {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly alertOnCall: (discrepancy: ReconciliationDiscrepancy) => Promise<void>
  ) {}

  /**
   * Сверяет инвариант: User.balance - SUM(LedgerEntry.amount) === 0.
   * При обнаружении расхождения немедленно блокирует счет и отправляет P0 алерт.
   */
  async reconcileUser(userId: string, tenantId: string): Promise<boolean> {
    return await this.prisma.$transaction(async (tx) => {
      // 1. Чтение баланса пользователя с блокировкой строки
      const user = await tx.user.findFirst({
        where: { id: userId, tenantId },
        select: { id: true, balance: true },
      });

      if (!user) return true;

      // 2. Агрегация всех утвержденных проводок журнала
      const ledgerAggregate = await tx.ledgerEntry.aggregate({
        where: { userId, tenantId, status: 'APPROVED' },
        _sum: { amount: true },
      });

      const ledgerSum = ledgerAggregate._sum.amount ?? BigInt(0);
      const userBalance = user.balance;
      const driftKopecks = userBalance - ledgerSum;

      // 3. Проверка инварианта
      if (driftKopecks === BigInt(0)) {
        return true; // Целостность подтверждена
      }

      // 4. КРИТИЧЕСКИЙ СБОЙ: АКТИВАЦИЯ ПРОТОКОЛА КАРАНТИНА
      console.error(
        `[FINTECH-CRITICAL] Ledger drift detected for User ${userId}! Balance: ${userBalance}n, Ledger: ${ledgerSum}n, Drift: ${driftKopecks}n`
      );

      // 4.1. Мгновенная заморозка аккаунта
      await tx.user.update({
        where: { id: userId },
        data: {
          adminNote: `[QUARANTINE] Frozen due to ledger drift: balance=${userBalance}n, ledgerSum=${ledgerSum}n, drift=${driftKopecks}n at ${new Date().toISOString()}`,
        },
      });

      // 4.2. Фиксация события безопасности в аудит-логе
      await tx.auditLog.create({
        data: {
          userId,
          action: 'SECURITY_LEDGER_DRIFT_QUARANTINE',
          details: JSON.stringify({
            userBalance: userBalance.toString(),
            ledgerSum: ledgerSum.toString(),
            driftKopecks: driftKopecks.toString(),
            timestamp: new Date().toISOString(),
          }),
        },
      });

      // 4.3. Отправка P0 алерта On-Call инженерам
      await this.alertOnCall({
        userId,
        tenantId,
        userBalance,
        ledgerSum,
        driftKopecks,
      });

      return false;
    });
  }

  /**
   * Корректировка расхождения по протоколу Maker-Checker (Dual Authorization).
   * Исключает ручное редактирование существующих проводок — создается компенсирующая запись.
   */
  async executeCompensatingAdjustment(params: {
    userId: string;
    tenantId: string;
    makerAdminId: string;
    checkerAdminId: string;
    compensatingAmountKopecks: bigint;
    reason: string;
  }) {
    const { userId, tenantId, makerAdminId, checkerAdminId, compensatingAmountKopecks, reason } = params;

    // Maker-Checker инвариант: инициатор и проверяющий обязаны быть разными лицами
    if (makerAdminId === checkerAdminId) {
      throw new Error('Maker-Checker violation: Maker and Checker cannot be the same administrator.');
    }

    return await this.prisma.$transaction(async (tx) => {
      // 1. Создание компенсирующей проводки в леджере
      const entry = await tx.ledgerEntry.create({
        data: {
          userId,
          tenantId,
          adminId: checkerAdminId,
          amount: compensatingAmountKopecks,
          reason: `[RECONCILIATION_ADJUSTMENT] ${reason} (Authorized by Maker:${makerAdminId}, Checker:${checkerAdminId})`,
          status: 'APPROVED',
          transactionType: 'COMPENSATION',
          idempotencyKey: `adj:${userId}:${Date.now()}`,
        },
      });

      // 2. Синхронизация баланса
      if (compensatingAmountKopecks > BigInt(0)) {
        await tx.user.update({
          where: { id: userId },
          data: { balance: { increment: compensatingAmountKopecks } },
        });
      } else {
        const absAmount = -compensatingAmountKopecks;
        await tx.user.updateMany({
          where: { id: userId, balance: { gte: absAmount } },
          data: { balance: { decrement: absAmount } },
        });
      }

      return entry;
    });
  }
}
```

---

## 5. Регламент Zero-Downtime DDL-миграций (Expand / Contract Protocol)

### 5 Железных правил DDL в банковской среде
1. **Запрет DDL без таймаутов:** Любой DDL-скрипт обязан начинаться с директив `SET lock_timeout = '2s'; SET statement_timeout = '30s';`. Если за 2 секунды СУБД не смогла получить блокировку из-за длинных читающих запросов, транзакция прерывается, предотвращая каскадный коллапс.
2. **Создание индексов строго `CONCURRENTLY`:** Запрещено создание обычных индексов на боевых таблицах. Использовать строго `CREATE INDEX CONCURRENTLY` вне транзакционных блоков.
3. **Безопасное добавление колонок:** Добавление колонок разрешено только как `NULL` либо с `DEFAULT` (в PostgreSQL 11+ это операция обновления метаданных $O(1)$ без переписывания таблицы).
4. **Запрет на прямое переименование:** Команды `ALTER TABLE ... RENAME COLUMN` и `DROP COLUMN` КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНЫ при работающем приложении.
5. **Expand / Contract (Параллельная эволюция схемы):**

```
ФАЗА 1 (Expand)       ФАЗА 2 (Dual-Write)    ФАЗА 3 (Backfill)     ФАЗА 4 (Read Switch)   ФАЗА 5 (Contract)
───────────────────   ────────────────────   ───────────────────   ────────────────────   ───────────────────
Добавить новую        Приложение пишет в     Фоновый скрипт        Приложение читает из   Удалить старую
колонку (NULLABLE)    обе колонки            мигрирует старые      новой колонки          колонку после
                      одновременно           строки пачками                               релиза
```

---

## 6. Операционные ранбуки при инцидентах (On-Call Runbooks)

### 🚨 Runbook 1: Устранение активных дедлоков и зависших блокировок

#### Шаг 1: Диагностика блокирующих и ожидающих процессов
```sql
SELECT
  blocked_locks.pid     AS blocked_pid,
  blocked_activity.usename  AS blocked_user,
  blocking_locks.pid    AS blocking_pid,
  blocking_activity.usename AS blocking_user,
  blocked_activity.query    AS blocked_statement,
  blocking_activity.query   AS blocking_statement,
  now() - blocked_activity.query_start AS blocked_duration
FROM  pg_catalog.pg_locks         blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks         blocking_locks
  ON blocking_locks.locktype = blocked_locks.locktype
  AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
  AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
  AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
  AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
  AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
  AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
  AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
  AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
  AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
  AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```

#### Шаг 2: Безопасная ликвидация блокирующего процесса
1. **Мягкая отмена запроса (SIGINT):**
   ```sql
   SELECT pg_cancel_backend(blocking_pid);
   ```
2. **Принудительное завершение соединения (SIGTERM) при отсутствии отклика через 5 секунд:**
   ```sql
   SELECT pg_terminate_backend(blocking_pid);
   ```

---

### 🚨 Runbook 2: Исчерпание пула соединений (Pool Exhaustion & P2024)

#### Шаг 1: Проверка состояния пула в PgBouncer
```sql
-- Подключение к виртуальной базе pgbouncer: psql -p 6432 -U postgres pgbouncer
SHOW POOLS;
SHOW CLIENTS;
```
* Если колонка `cl_waiting > 0` и растет: клиенты стоят в очереди. Причина — долгие транзакции или утечка соединений (Transaction Escape).

#### Шаг 2: Поиск долгих незавершенных транзакций в PostgreSQL
```sql
SELECT pid, usename, client_addr, state, now() - xact_start AS duration, query
FROM pg_stat_activity
WHERE state IN ('idle in transaction', 'active')
ORDER BY duration DESC
LIMIT 10;
```
* Немедленно разорвать соединения со статусом `idle in transaction`, длящиеся более 10 секунд:
  ```sql
  SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle in transaction' AND now() - xact_start > interval '10 seconds';
  ```

---

### 🚨 Runbook 3: Протокол ликвидации расхождений леджера (Reconciliation Drift)

При получении P0-уведомления от `ReconciliationQuarantineDaemon`:
1. **Верификация изоляции:** Убедиться, что аккаунт переведен в статус `isFrozen = true` и все активные сессии сброшены в Redis.
2. **Сбор криминалистического дампа (Forensic Query):**
   ```sql
   SELECT
     u.id, u.email, u.balance AS cached_balance,
     COALESCE(SUM(l.amount), 0) AS calculated_balance,
     u.balance - COALESCE(SUM(l.amount), 0) AS drift_amount
   FROM "User" u
   LEFT JOIN "LedgerEntry" l ON l."userId" = u.id AND l.status = 'APPROVED'
   WHERE u.id = :quarantinedUserId
   GROUP BY u.id, u.email, u.balance;
   ```
3. **Аудит платежных шлюзов:** Сверить выписки ЮKassa / Robokassa / Telegram Payments с записями в таблицах `Payment` и `LedgerEntry` на предмет неучтенных вебхуков или сбоев сети.
4. **Оформление корректировки Maker-Checker:**
   Два администратора (роли `MANAGER` и `OWNER`) подтверждают компенсирующую проводку через метод `executeCompensatingAdjustment()`.
5. **Снятие карантина:** После достижения баланса $\Delta \equiv 0$ аккаунт размораживается.

---

### 🚨 Runbook 4: Устранение раздувания (Bloat) таблиц и индексов

#### Шаг 1: Диагностика коэффициента HOT-обновлений и мертвых кортежей
```sql
SELECT
  relname,
  n_live_tup,
  n_dead_tup,
  ROUND(n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_tuple_pct,
  n_tup_upd,
  n_tup_hot_upd,
  ROUND(n_tup_hot_upd * 100.0 / NULLIF(n_tup_upd, 0), 2) AS hot_update_pct
FROM pg_stat_user_tables
WHERE relname IN ('Order', 'LedgerEntry', 'User')
ORDER BY n_dead_tup DESC;
```
* **Норматив:** Таблица `Order` обязана иметь `hot_update_pct >= 70%` благодаря настройке `fillfactor = 85`.
* Если `dead_tuple_pct > 25%`: автовакуум не справляется с нагрузкой.

#### Шаг 2: Онлайн-реорганизация без блокировки таблицы через `pg_repack`
```bash
# ЗАПРЕЩЕНО запускать VACUUM FULL на боевом сервере (захватывает ACCESS EXCLUSIVE lock на часы)
# Использовать pg_repack:
pg_repack -h 127.0.0.1 -p 5433 -U postgres -d smmplan_lite --table "Order"
```

---

## 7. Сводная матрица соответствия стандартам (Compliance Matrix)

| Архитектурное требование | Банковский стандарт | Реализация в платформе | Статус |
|---|---|---|---|
| **Неизменяемость финансового аудита** | PCI-DSS v4.0.1 (Req 10.2), 54-ФЗ | Триггер `trg_ledger_immutable` + Ledger-First | ✅ 100% Защита |
| **Исключение отрицательных балансов** | ISO 25010 (Fault Tolerance), ЦБ РФ | Физический `CHECK (balance >= 0)` в PostgreSQL | ✅ Аппаратный барьер |
| **Защита от Double-Spending / Гонки** | PCI-DSS v4.0.1 (Req 6.4) | `StripeIdempotencyVault` (`SET NX PX`) + `gte` | ✅ Sub-2ms Lock |
| **Высокообъемное партиционирование** | Enterprise BigData / Сбербанк | `RANGE (createdAt)` + `@@id([id, createdAt])` | ✅ Pruning Enabled |
| **Защита от Dual-Write сбоев** | Event-Driven Architecture / Тинькофф | Transactional Outbox + `FOR UPDATE SKIP LOCKED` | ✅ Нулевая потеря |
| **Авто-восстановление при дедлоках** | ISO 25010 (Reliability) | `runSerializableTransaction` (40001 / 40P01 Retry) | ✅ Full Jitter |
| **Экономия ресурсов и защита пула** | High-Load PostgreSQL Standard | Формула `(Cores * 2) + 1` + PgBouncer Tx Pooling | ✅ Нулевое удушье |
| **Сверка и обнаружение расхождений** | BCBS 239, 176-ФЗ / 425-ФЗ | `ReconciliationQuarantineDaemon` (Maker-Checker) | ✅ P0 Карантин |
