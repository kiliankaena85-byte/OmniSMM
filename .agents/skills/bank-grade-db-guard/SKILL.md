---
name: bank-grade-db-guard
description: "Используй этот скилл ВСЕГДА, когда Универсальный архитектурный
  стандарт надежности реляционных баз данных банковского уровня (Tier-1 FinTech:
  Sberbank, Tinkoff, Stripe, Monzo). Охватывает строгие инварианты целостности
  (Ledger-First, ExactMath BigInt, Zero Transaction Escape, аппаратные
  CHECK/Triggers), паттерны отказоустойчивости (Stripe-Style Distributed
  Idempotency Vault с атомарной резервацией, Event Sourcing, партиционирование
  таблиц с составными ключами, Transactional Outbox с SKIP LOCKED, сайзинг пулов
  соединений и PgBouncer, автоматический ретрай дедлоков 40P01 и serialization
  failure 40001), каталог критических. НЕ применять для верстки UI компонентов
  или клиентских анимаций."
metadata:
  version: 2026.2.0
  standards:
    - ISO 25010:2023 (Fault Tolerance, Data Integrity)
    - PCI-DSS v4.0.1 (Req 3.4, 6.4, 10.2)
    - 54-ФЗ, 176-ФЗ / 425-ФЗ (НДС 22%, Ledger-First)
    - BCBS 239 (Risk Data Aggregation & Reporting)
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

---

## Справочные реализации и SQL-манифесты
Полные исходные коды классов Idempotency Vault, Partitioning и SQL DDL вынесены в отдельный справочник:
- См. [references/REFERENCE.md](./references/REFERENCE.md).

## Чеклист верификации (Verification Checklist)
- [ ] Выполняется ли запись в LedgerEntry ДО мутации User.balance?
- [ ] Используются ли копейки BigInt для всех денежных величин?
- [ ] Исключен ли вызов глобального db.* внутри транзакции tx?
- [ ] Настроена ли атомарная резервация ключей в Idempotency Vault?
- [ ] Установлен ли lock_timeout <= 2s для предотвращения зависаний?
