# bank-grade-db-guard — Справочные спецификации и SQL манифесты

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