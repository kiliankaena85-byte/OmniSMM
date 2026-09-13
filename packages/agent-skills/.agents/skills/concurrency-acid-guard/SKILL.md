---
name: concurrency-acid-guard
description: >
  Архитектурный скилл защиты от состояний гонки (Race Conditions, TOCTOU, Lost Updates)
  и обеспечения ACID-гарантий в финансовых транзакциях, списаниях баланса и обработке заказов OmniSMM.
  Применяй этот скилл ВСЕГДА, когда затрагиваются: User.balance, WalletOps, LedgerEntry,
  параллельное списание или пополнение средств, списание квот, изменение статусов заказов,
  блокировки строк в PostgreSQL (SELECT ... FOR UPDATE, FOR UPDATE SKIP LOCKED),
  уровни изоляции транзакций (Read Committed, Repeatable Read, Serializable),
  детекция утечек контекста транзакции (Transaction Escape: db.* внутри tx: PrismaTx),
  распределенные блокировки в Redis (Redlock / ioredis SET NX EX), точные финансовые вычисления
  ExactMath в копейках (BigInt) с банковским округлением (Half-Even), а также предотвращение
  двойных трат (Double-Spending) и дедупликация через idempotencyKey (P2002).
---

# Concurrency & ACID Guard — Защита от состояний гонки и финансовая целостность OmniSMM

## Назначение скилла

Скилл `concurrency-acid-guard` — это обязательный инженерный стандарт платформы OmniSMM (бренды SMMplan и SMMflux), регламентирующий проектирование и реализацию всех конкурентных операций, влияющих на балансы пользователей, финансовые проводки (`LedgerEntry`), лимиты сотрудников и распределение заказов.

В высоконагруженной системе параллельные HTTP-запросы от веб-интерфейса, входящие вебхуки платежных шлюзов (ЮKassa, Robokassa, CryptoBot), фоновые воркеры BullMQ и внешние API-клиенты постоянно обращаются к одним и тем же записям в базе данных. Несоблюдение правил изоляции и конкурентности неминуемо приводит к критическим финансовым инцидентам:
- **TOCTOU (Time-of-Check to Time-of-Use):** проверка баланса прошла успешно в одной сессии, но параллельный запрос уже успел списать средства до фиксации мутации, приводя к отрицательному балансу.
- **Lost Updates (Потерянные обновления):** два параллельных инкремента считывают текущий баланс $1000$ ₽, вычисляют $+500$ ₽ и $+300$ ₽, после чего последняя запись перезаписывает предыдущую, теряя деньги клиента или платформы.
- **Transaction Escape:** вызов глобального синглтона `db.*` внутри колбэка `$transaction(async (tx) => { ... })`, из-за чего мутация уходит вне контекста транзакции, не откатывается при ошибке и провоцирует взаимные блокировки (Deadlocks).
- **Floating-Point Drift:** ошибки округления в IEEE-754 при сложении долей копеек и процентов наценки, накапливающие расхождения между суммой строк леджера и балансом пользователя.

---

## 1. Дерево решений (Decision Tree / Flowchart)

### 1.1. Архитектурная блок-схема выбора механизма конкурентности

```
                   [Входящая финансовая / статусная операция]
                                      │
                                      ▼
             ┌──────────────────────────────────────────────────┐
             │ Присутствует уникальный idempotencyKey в запросе?│
             └──────────────────────────────────────────────────┘
                            │                       │
                           НЕТ                      ДА
                            │                       │
                            ▼                       ▼
            ┌────────────────────────┐  ┌─────────────────────────────────┐
            │ Сгенерировать UUIDv4   │  │ Проверить LedgerEntry по ключу  │
            │ или детерминированный  │  │ (Fail-Closed / Fast Idempotency)│
            │ ключ: action+id+salt   │  └─────────────────────────────────┘
            └────────────────────────┘                  │
                            │             Запись уже найдена в БД?
                            │                  ┌────────┴────────┐
                            │                 ДА                 НЕТ
                            │                  │                  │
                            │                  ▼                  │
                            │     ┌────────────────────────┐      │
                            │     │ Вернуть кэшированный   │      │
                            │     │ результат (cached:true)│      │
                            │     │ БЕЗ повторного списания│      │
                            │     └────────────────────────┘      │
                            │                                     │
                            └──────────────────┬──────────────────┘
                                               │
                                               ▼
                         ┌──────────────────────────────────────────┐
                         │ Какова природа и охват конкурирующих     │
                         │ мутаций между процессами/нодами?         │
                         └──────────────────────────────────────────┘
                                  │                       │
                    Одна база PostgreSQL             Распределенная операция
                    (Балансы, Леджер, Заказы)        (Внешние шлюзы, Multi-Node)
                                  │                       │
                                  ▼                       ▼
      ┌──────────────────────────────────────┐  ┌──────────────────────────────────┐
      │ Требуется ли строгая сериализация?   │  │ Применить Redis Distributed Lock │
      └──────────────────────────────────────┘  │ (ioredis SET key token NX PX)   │
             │                      │           └──────────────────────────────────┘
        Высокая нагрузка       Критическая                    │
        на один аккаунт        бизнес-цепочка                 ▼
        (High Concurrency)     (Сверка/Аудит)   ┌──────────────────────────────────┐
             │                      │           │ Защитить критическую секцию;     │
             ▼                      ▼           │ Освобождать строго через Lua     │
┌─────────────────────────┐ ┌────────────────┐  │ с проверкой токена владельца     │
│ Read Committed +        │ │ Serializable   │  └──────────────────────────────────┘
│ Атомарный UPDATE с      │ │ Транзакция с   │                │
│ защитным WHERE (gte)    │ │ Jitter-Retry   │                │
│ + Row-Level Locking     │ │ (P2034/40001)  │                │
└─────────────────────────┘ └────────────────┘                │
             │                      │                         │
             └──────────────────────┼─────────────────────────┘
                                    │
                                    ▼
                 ┌───────────────────────────────────────┐
                 │        LEDGER-FIRST INVARIANT         │
                 │ 1. tx.ledgerEntry.create(...)         │
                 │    ПЕРВОЙ операцией в транзакции!     │
                 │ 2. Обработать ошибку P2002            │
                 │    (race-condition duplicate)         │
                 │ 3. tx.user.updateMany с декрементом   │
                 │    и проверкой balance >= amount      │
                 │ 4. Если count === 0 -> Insufficient   │
                 │    funds (Откат транзакции!)          │
                 │ 5. Зафиксировать аудит-лог через      │
                 │    await auditAdminAwaitable(tx)      │
                 └───────────────────────────────────────┘
                                    │
                                    ▼
                 ┌───────────────────────────────────────┐
                 │ УСПЕШНЫЙ COMMIT И ФИНАНСОВЫЙ ВОЗВРАТ  │
                 └───────────────────────────────────────┘
```

### 1.2. Пошаговый алгоритм выполнения операции

1. **Нормализация денежной суммы:**
   - Преобразовать входные рубли/копейки строго в `bigint` через `ExactMath.rublesToKopecks()`.
   - Проверить границы: `rawCents > 0n` и `rawCents <= MAX_SINGLE_CHARGE_CENTS` (защитный потолок 1 000 000 ₽). При нарушении выбросить `WalletInvalidAmountError`.
2. **Идемпотентный барьер:**
   - Если передан `idempotencyKey`, выполнить предварительную проверку `tx.ledgerEntry.findFirst({ where: { idempotencyKey } })`.
   - Если запись уже существует, вернуть существующий баланс и проводку с флагом `cached: true`.
3. **Изоляция транзакции и Transaction Client:**
   - Любая модификация баланса выполняется строго внутри колбэка `runSerializableTransaction` или `db.$transaction(async (tx) => { ... })`.
   - **Запрещено** использовать глобальный `db` внутри колбэка. Все операции проводятся строго через аргумент `tx: PrismaTx`.
4. **Фиксация проводки (Ledger-First Principle):**
   - Создать запись в `tx.ledgerEntry.create({ data: { userId, amount: -rawCents, reason, idempotencyKey, ... } })` **ДО** списания баланса.
   - Если параллельный поток попытался вставить тот же `idempotencyKey`, СУБД выбросит ошибку уникальности `P2002`. Перехватить `P2002` и корректно вернуть существующую запись, предотвратив дублирование списания.
5. **Атомарная мутация баланса с защитным фильтром:**
   - Выполнить `tx.user.updateMany({ where: { id: userId, balance: { gte: rawCents } }, data: { balance: { decrement: rawCents }, totalSpent: { increment: rawCents } } })`.
   - Если `updatedUserBatch.count === 0`, баланса недостаточно (или аккаунт заблокирован/удален). Выбросить `WalletInsufficientFundsError`, что приведет к автоматическому `ROLLBACK` всей транзакции и отмене записи в леджере.
6. **Верификация конечного состояния:**
   - Запросить финальное состояние через `tx.user.findUniqueOrThrow({ where: { id: userId }, select: { balance: true } })`.
   - Зафиксировать запись аудита через `await auditAdminAwaitable()` внутри транзакции.

---

## 2. Жесткие инварианты и табу (Hard Invariants & Anti-Patterns)

### Инвариант 1: Ledger-First Invariant
> **ТАБУ:** Категорически запрещено обновлять `User.balance` до создания проводки в `LedgerEntry`. Запрещено создавать проводку леджера "вдогонку" после мутации баланса.

**Почему это критично:** Если приложение сначала меняет `User.balance`, а при создании `LedgerEntry` происходит сбой валидации, разрыв соединения или нехватка памяти, баланс изменяется без следа в бухгалтерском аудите. Принцип Ledger-First гарантирует, что если проводку создать не удалось, баланс не изменится никогда.

#### ❌ ПЛОХО (Сначала мутация баланса, потом леджер):
```typescript
// АНТИПАТТЕРН: Нарушение Ledger-First и риск потери финансового следа
export async function badCharge(tx: PrismaTx, userId: string, amount: bigint) {
  // 1. Изменили баланс
  await tx.user.update({
    where: { id: userId },
    data: { balance: { decrement: amount } },
  });

  // 2. Если здесь произойдет сбой (или валидация упадет), баланс уже уплыл,
  // а при неверно настроенной транзакции запись в леджер не попадет!
  await tx.ledgerEntry.create({
    data: {
      userId,
      amount: -amount,
      reason: 'Order charge',
      // Забыли idempotencyKey!
    },
  });
}
```

#### ✅ ХОРОШО (Строгий Ledger-First с защитой от гонки):
```typescript
// ЭТАЛОН OmniSMM: Ledger-First + P2002 Catch + Атомарный декремент
export async function goodCharge(
  tx: PrismaTx,
  userId: string,
  rawCents: bigint,
  reason: string,
  idempotencyKey?: string,
  tenantId?: string
) {
  // 1. Создаем проводку в Леджере ПЕРВОЙ операцией
  try {
    const entry = await tx.ledgerEntry.create({
      data: {
        userId,
        tenantId: tenantId ?? 'smmplan',
        amount: -rawCents,
        reason,
        status: 'APPROVED',
        idempotencyKey,
        transactionType: 'ORDER_CHARGE',
      },
    });

    // 2. Атомарно декрементируем баланс СТРОГО при условии balance >= rawCents
    const updateResult = await tx.user.updateMany({
      where: {
        id: userId,
        balance: { gte: rawCents },
        ...(tenantId ? { tenantId } : {}),
      },
      data: {
        balance: { decrement: rawCents },
        totalSpent: { increment: rawCents },
      },
    });

    if (updateResult.count === 0) {
      // Денег не хватило в момент попытки списания — транзакция откатится
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { balance: true },
      });
      throw new WalletInsufficientFundsError(rawCents, user?.balance ?? 0n);
    }

    const finalUser = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { balance: true },
    });

    return { success: true, balance: finalUser.balance, cached: false, entry };
  } catch (error: unknown) {
    // 3. Обработка P2002: параллельный запрос с тем же idempotencyKey уже создал запись
    if (
      idempotencyKey &&
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      const existing = await tx.ledgerEntry.findFirst({
        where: { idempotencyKey },
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
}
```

---

### Инвариант 2: Transaction Escape Taboo
> **ТАБУ:** Категорически запрещено использовать глобальный клиент базы данных `db.*` внутри функций или колбэков, принимающих контекст транзакции `tx: PrismaTx`. Все запросы, чтения, обновления и вызовы аудита обязаны использовать `tx.*`.

**Почему это критично:** Вызов `db.*` открывает отдельное независимое физическое соединение из пула PostgreSQL вне активной транзакции:
1. Запрос через `db.*` не видит изменений, сделанных в `tx` (изоляция транзакций).
2. Запрос через `db.*` может заблокироваться на строке, которую удерживает `tx`, вызывая вечный дедлок (Deadlock Timeout).
3. При ошибке в `tx` всё, что было сделано через `db.*`, **НЕ ОТКАТИТСЯ**!

#### ❌ ПЛОХО (Transaction Escape):
```typescript
// АНТИПАТТЕРН: Использование db внутри транзакционного контекста
export async function processOrderEscaping(tx: PrismaTx, orderId: string, userId: string) {
  // Мутация в транзакции
  await tx.order.update({
    where: { id: orderId },
    data: { status: 'IN_PROGRESS' },
  });

  // ГРУБЕЙШАЯ ОШИБКА: Запрос мимо транзакции через глобальный `db`!
  // Не видит обновления статуса orderId и может зависнуть на блокировке!
  const user = await db.user.findUnique({ where: { id: userId } });

  // ГРУБЕЙШАЯ ОШИБКА: Запись аудита мимо транзакции!
  // Если транзакция упадет ниже, аудит-лог останется в базе!
  await db.auditLog.create({
    data: { userId, action: 'ORDER_STARTED' }
  });
}
```

#### ✅ ХОРОШО (Полная герметичность транзакции):
```typescript
// ЭТАЛОН: Все операции строго через tx
export async function processOrderSealed(tx: PrismaTx, orderId: string, userId: string) {
  const updatedOrder = await tx.order.update({
    where: { id: orderId },
    data: { status: 'IN_PROGRESS' },
  });

  const user = await tx.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, balance: true, tenantId: true },
  });

  await tx.auditLog.create({
    data: {
      userId,
      tenantId: user.tenantId,
      action: 'ORDER_STARTED',
      details: { orderId, previousStatus: 'PENDING' },
    },
  });

  return { order: updatedOrder, user };
}
```

---

### Инвариант 3: Row-Level Locking (SELECT ... FOR UPDATE) & Atomic Updates
> **ТАБУ:** Запрещено выполнять наивные паттерны проверки баланса в стиле: `const u = await tx.user.findUnique(); if (u.balance >= cost) { await tx.user.update({ data: { balance: u.balance - cost } }) }`.

**Почему это критично:** Между чтением `findUnique` и записью `update` проходит ненулевое время (сетевой раунд-трип). Десять параллельных запросов прочитают одно и то же значение `u.balance = 1000` ₽, все десять пройдут условие `1000 >= 1000`, и все десять спишут по 1000 ₽, уведя баланс в минус 9000 ₽.

Для предотвращения этого в OmniSMM применяются два подхода:
1. **Атомарный декремент с предикатом:** `tx.user.updateMany({ where: { id, balance: { gte: cost } }, data: { balance: { decrement: cost } } })`.
2. **Явная пессимистическая блокировка строки (Row-Level Lock):** `SELECT ... FOR UPDATE` через `tx.$queryRaw`.

#### ✅ Пример пессимистической блокировки через Prisma Raw Query:
```typescript
// Пессимистическая блокировка строки пользователя в PostgreSQL
export async function lockUserForUpdate(tx: PrismaTx, userId: string): Promise<{ id: string; balance: bigint }> {
  const lockedUsers = await tx.$queryRaw<Array<{ id: string; balance: bigint }>>`
    SELECT id, balance 
    FROM "User" 
    WHERE id = ${userId} 
    FOR UPDATE
  `;

  if (!lockedUsers || lockedUsers.length === 0) {
    throw new WalletUserNotFoundError(userId);
  }

  return lockedUsers[0];
}
```

---

### Инвариант 4: ExactMath Invariant (No Floats in Money)
> **ТАБУ:** Категорически запрещено использовать тип `number` (IEEE-754 float) для хранения, сложения, умножения наценок и списания денег в коде бэкенда. Все денежные значения хранятся строго в `BigInt` (в неделимых копейках / центах).

**Правила расчета стоимости заказов и наценок:**
1. Все вычисления стоимости производятся через утилиту `ExactMath.calculateOrderCostKopecks()`.
2. Округление до копеек выполняется строго по банковскому правилу **Banker's Rounding (Round Half to Even)**: при остатке ровно $0.5$ число округляется к ближайшему четному числу, исключая систематический положительный дрейф инфляции на миллионах операций.
3. Наценки задаются строго в базисных пунктах: $1\% = 100 \text{ bps}$, $300\% = 30000 \text{ bps}$.
4. Минимальная стоимость любого ненулевого заказа строго $\ge 1$ копейка (`minChargeKopecks = 1n`).

#### ❌ ПЛОХО (Использование float для денег):
```typescript
// КАТАСТРОФА: Float drift и потеря денег
const pricePer1k = 120.5; // 120.50 руб
const quantity = 15;
const markup = 1.15; // 15%

// 120.5 * 15 / 1000 * 1.15 = 2.078625 (двоичный float дает 2.0786250000000003)
const totalRub = (pricePer1k * quantity / 1000) * markup;
const userBalance = user.balance - totalRub; // Погрешность в копейках неизбежна!
```

#### ✅ ХОРОШО (ExactMath в BigInt копейках):
```typescript
import { ExactMath } from '@/lib/financial/exact-math';

// Преобразование ставки в целые копейки (120.50 руб -> 12050n копеек)
const ratePer1kKopecks = ExactMath.rublesToKopecks('120.50');
const marginBps = 1500n; // 15.00% маржинальности

// Строгий расчет стоимости заказа в неделимых копейках с банковским округлением
const costKopecks: bigint = ExactMath.calculateOrderCostKopecks(
  15, // quantity
  ratePer1kKopecks,
  marginBps,
  1n // minChargeKopecks floor
);
```

---

### Инвариант 5: Distributed Locking (Redlock / ioredis SET NX EX)
> **ТАБУ:** Запрещено полагаться только на блокировку в памяти Node.js (`async-mutex`, локальные переменные) при координации операций между несколькими инстансами/контейнерами Next.js.

Для операций, требующих синхронизации распределенных процессов (например, пакетный пересчет курса валют ЦБ РФ, согласование балансов провайдеров, предотвращение одновременной отправки одного заказа двум внешним поставщикам), обязателен распределенный лок в Redis с защитным TTL и атомарным освобождением через Lua-скрипт.

#### ✅ Эталон распределенной блокировки через Redis:
```typescript
import { getRedisConnection } from '@/lib/queue-manager';
import crypto from 'crypto';

export class RedisDistributedLock {
  private static readonly RELEASE_LUA_SCRIPT = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;

  /**
   * Захватывает распределенный лок в Redis.
   * @param lockKey Ключ ресурса (например, 'lock:order:dispatch:123')
   * @param ttlMs Время жизни лока в миллисекундах (защита от зависания процесса)
   */
  public static async acquire(lockKey: string, ttlMs: number = 10000): Promise<string | null> {
    const redis = getRedisConnection();
    const lockToken = crypto.randomUUID();

    // SET key token NX PX ttlMs — атомарная операция в Redis
    const result = await redis.set(lockKey, lockToken, 'PX', ttlMs, 'NX');
    return result === 'OK' ? lockToken : null;
  }

  /**
   * Освобождает распределенный лок строго при совпадении токена владельца.
   */
  public static async release(lockKey: string, lockToken: string): Promise<boolean> {
    const redis = getRedisConnection();
    const result = await redis.eval(this.RELEASE_LUA_SCRIPT, 1, lockKey, lockToken);
    return result === 1;
  }
}
```

---

## 3. Премортем-анализ и моделирование отказов (Failure Scenarios / Pre-Mortem)

| Сценарий отказа | Вероятность x Влияние | Механизм защиты в коде OmniSMM | Восстановление и самоисцеление |
| :--- | :---: | :--- | :--- |
| **1. Атака на параллельное списание (Concurrent Double-Spend)**<br>Злоумышленник запускает 50 параллельных запросов на покупку услуги при балансе ровно на 1 заказ. | **Высокая x Критическое** | 1. Предикат `where: { id: userId, balance: { gte: rawCents } }` в `tx.user.updateMany`.<br>2. Проверка `updatedUserBatch.count === 0` с немедленным выбросом `WalletInsufficientFundsError` и полным `ROLLBACK`. | Транзакция откатывается СУБД. Никаких отрицательных балансов. В аудит-лог пишется событие подозрительной активности. |
| **2. Всплеск конфликтов сериализации (Serialization Failure Storm)**<br>При пиковой нагрузке несколько воркеров одновременно обращаются к общему счетчику, вызывая код ошибки PostgreSQL `40001` / Prisma `P2034`. | **Средняя x Высокое** | Обертка `runSerializableTransaction` перехватывает `P2034` / `could not serialize access` / `40001` и автоматически повторяет транзакцию до 15 раз с экспоненциальным backoff и jitter: `Math.min(200, 2^attempt * 10) + random * 30`. | Запросы не завершаются 500 ошибкой, а прозрачно разрешаются в течение 20–150 мс. |
| **3. Разрыв соединения после создания проводки Леджера, но до ответа клиенту**<br>Клиентский HTTP-запрос отваливается по таймауту 30s, хотя транзакция в БД успешно закоммичена. | **Средняя x Высокое** | Клиентский слой шлет повторный запрос с тем же `idempotencyKey`. Метод `WalletOps.charge` находит существующий `LedgerEntry` и возвращает результат без повторного списания с флагом `cached: true`. | Полная идемпотентность. Пользователь видит успешное завершение операции без двойного снятия денег. |
| **4. Утечка контекста транзакции (Transaction Escape Deadlock)**<br>Разработчик по ошибке вызвал `db.user.update` внутри `tx`, вызвав взаимную блокировку двух коннектов из пула соединений Prisma. | **Низкая x Критическое** | 1. Статический линтинг и типизация `PrismaTx` (тип `PrismaTx` не содержит `$transaction`).<br>2. Жесткий тайм-аут транзакции `timeout: 30000` в `runSerializableTransaction`. | При превышении 30s транзакция принудительно обрывается, освобождая удерживаемые блокировки строк в Postgres. |
| **5. Истечение времени жизни распределенного лока (Lock Lease Expiration)**<br>Воркер взял лок в Redis на 10с, но завис на внешнем медленном API поставщика на 15с. Лок снялся по TTL, и второй воркер начал параллельную обработку. | **Средняя x Среднее** | 1. Освобождение лока выполняется строго через Lua-скрипт с проверкой уникального `lockToken`. Поздний воркер не сможет случайно удалить лок нового владельца.<br>2. Все изменения в БД страхуются внутренними строковыми блокировками PostgreSQL. | Защита от split-brain: внешний лок синхронизирует трафик, а внутренние ACID-транзакции PostgreSQL гарантируют целостность данных. |

---

## 4. Чеклист верификации (Verification Checklist)

При проведении код-ревью или создании нового финансового/заказного функционала агент **ОБЯЗАН** проверить соблюдение каждого пункта:

### 4.1. Статический аудит кода (Static Inspection)
- [ ] **Отсутствие Transaction Escape:**
  ```bash
  # Проверка: нет ли обращений к глобальному db.* внутри блоков $transaction
  npx tsx scripts/harness/audit-transaction-escape.ts
  ```
- [ ] **Только BigInt в деньгах:** Ни одна переменная баланса, списания или цены не имеет тип `number` в расчетах ядра биллинга.
- [ ] **Проверка присутствия `idempotencyKey`:** Все методы `WalletOps.charge()`, `WalletOps.credit()`, `WalletOps.refund()` принимают и проверяют `idempotencyKey`.
- [ ] **Соблюдение порядка Ledger-First:** `tx.ledgerEntry.create()` вызывается строго ДО `tx.user.updateMany()` или `tx.user.update()`.

### 4.2. Автоматизированные тесты конкурентности (Vitest Concurrency Suite)
- [ ] Запущен регрессионный сьют финансовых операций:
  ```bash
  npx vitest run src/__tests__/financial/wallet-ops-safety-cap.test.ts
  npx vitest run src/services/financial/__tests__/wallet-ops.test.ts
  npx vitest run src/__tests__/financial/exact-math.test.ts
  ```
- [ ] **Стресс-тест на двойное списание (Concurrent Race Test):**
  Убедиться, что тест с 20 одновременными вызовами `WalletOps.charge()` на одном аккаунте списывает средства ровно столько раз, на сколько хватает баланса, и завершается с 0 расхождений в Леджере:
  ```typescript
  // Фрагмент проверочного теста:
  const charges = Array.from({ length: 20 }).map((_, i) =>
    runSerializableTransaction(async (tx) => {
      return WalletOps.charge(tx, testUserId, 10000n, `Parallel test ${i}`, {
        idempotencyKey: `test-race-${i}-${Date.now()}`
      });
    }).catch(err => err.code)
  );
  const results = await Promise.all(charges);
  // Проверить, что сумма списаний в точности равна изменению balance
  ```

### 4.3. Верификация базы данных (PostgreSQL Verification Queries)
- [ ] Проверка целостности балансов и леджера (нулевой дисбаланс):
  ```sql
  -- Сумма проводок леджера обязана в точности совпадать с текущим балансом пользователя
  SELECT 
    u.id AS user_id,
    u.balance AS current_balance,
    COALESCE(SUM(l.amount), 0) AS calculated_ledger_balance,
    (u.balance - COALESCE(SUM(l.amount), 0)) AS discrepancy
  FROM "User" u
  LEFT JOIN "LedgerEntry" l ON l."userId" = u.id AND l.status = 'APPROVED'
  GROUP BY u.id, u.balance
  HAVING u.balance != COALESCE(SUM(l.amount), 0);
  -- Ожидаемый результат: 0 строк.
  ```
- [ ] Проверка отсутствия дубликатов идемпотентных ключей:
  ```sql
  SELECT "idempotencyKey", COUNT(*) 
  FROM "LedgerEntry" 
  WHERE "idempotencyKey" IS NOT NULL 
  GROUP BY "idempotencyKey" 
  HAVING COUNT(*) > 1;
  -- Ожидаемый результат: 0 строк (гарантировано уникальным индексом).
  ```
