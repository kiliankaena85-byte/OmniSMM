---
name: event-driven-reliability
description: >
  Архитектурный скилл обеспечения надежности асинхронного взаимодействия, очередей фоновых задач и транзакционного обмена сообщениями в OmniSMM.
  Применяй этот скилл ВСЕГДА, когда затрагиваются: Transactional Outbox (таблица ProviderOutbox / Outbox), устранение уязвимости Dual-Write,
  интеграция и конфигурация очередей BullMQ (ordersQueue, syncQueue, paymentSyncQueue, criticalQueue), дедупликация задач (jobId = eventId),
  гарантия Exactly-Once / At-Least-Once доставки, идемпотентные воркеры и консьюмеры (Check-Then-Set, lease locks),
  политики повторов с экспоненциальным backoff и джиттером (jitteredBackoff), маршрутизация в Dead-Letter Queue (DLQ / dead-letter-queue),
  алертинг в Telegram и SecurityAlertService, а также Graceful Shutdown жизненного цикла воркеров при деплое.
---

# Event-Driven Reliability — Транзакционный Outbox, надежные очереди BullMQ и отказоустойчивость OmniSMM

## Назначение скилла

Скилл `event-driven-reliability` регламентирует архитектуру асинхронных событий, очередей задач и межсистемного взаимодействия в платформе OmniSMM (бренды SMMplan и SMMflux).

В микросервисной и распределенной среде Next.js + PostgreSQL + Redis + внешние SMM-провайдеры передача сообщений подвержена фундаментальным сбоям распределенных систем:
- **Уязвимость Dual-Write (Двойная запись):** попытка одновременно записать данные в PostgreSQL (`tx.order.create()`) и опубликовать задачу в очередь Redis (`queue.add()`). При сбое сети к Redis база данных зафиксирует заказ, но задача не будет создана, оставляя заказ навсегда зависшим в статусе `PENDING`. Если же сначала слать задачу в Redis, а транзакция в PostgreSQL упадет, воркер выполнит фантомную задачу для несуществующего заказа.
- **Дублирование сообщений (At-Least-Once Delivery):** временные сетевые таймауты между воркером и Redis приводят к повторной доставке задачи, вызывая повторное списание средств или двойную отправку заказа внешнему поставщику.
- **Ядовитые сообщения (Poison Pills):** задачи с поврежденным payload, вызывающие необработанный крэш процесса воркера, блокирующие очередь и сжигающие системные ресурсы.
- **Потеря сообщений при рестарте контейнеров (Ungraceful Shutdown):** обрыв выполнения длительной фоновой задачи по сигналу `SIGKILL` при деплое новой версии.

Данный скилл предписывает использование паттерна **Transactional Outbox**, дедупликации задач в **BullMQ**, строгой идемпотентности воркеров и обязательной маршрутизации исчерпанных задач в **Dead-Letter Queue (DLQ)**.

---

## 1. Дерево решений (Decision Tree / Flowchart)

### 1.1. Архитектурная блок-схема асинхронного пайплайна

```
                   [Бизнес-операция (Создание заказа / Событие биллинга)]
                                             │
                                             ▼
                     ┌────────────────────────────────────────────────┐
                     │ ТАБУ НА DUAL-WRITE:                            │
                     │ Запрещено отправлять напрямую в Redis / BullMQ!│
                     └────────────────────────────────────────────────┘
                                             │
                                             ▼
                     ┌────────────────────────────────────────────────┐
                     │ ЕДИНАЯ АТОМАРНАЯ ТРАНЗАКЦИЯ POSTGRESQL (tx):   │
                     │ 1. tx.order.create(...)                        │
                     │ 2. tx.providerOutbox.create({                  │
                     │      status: 'PENDING',                        │
                     │      idempotencyKey: uniqueKey,                │
                     │      payload: jobData                          │
                     │    })                                          │
                     └────────────────────────────────────────────────┘
                                             │
                                       COMMIT В БД
                                             │
                                             ▼
                     ┌────────────────────────────────────────────────┐
                     │ OUTBOX RELAY / POLLER WORKER                   │
                     │ SELECT * FROM "ProviderOutbox"                 │
                     │ WHERE status = 'PENDING'                       │
                     │ ORDER BY "createdAt" ASC                       │
                     │ LIMIT 50                                       │
                     │ FOR UPDATE SKIP LOCKED                         │
                     └────────────────────────────────────────────────┘
                                             │
                                             ▼
                     ┌────────────────────────────────────────────────┐
                     │ ПУБЛИКАЦИЯ В ОЧЕРЕДЬ BULLMQ (ordersQueue):     │
                     │ ordersQueue.add('dispatch-order', payload, {   │
                     │   jobId: outbox.idempotencyKey,                │
                     │   attempts: 5,                                 │
                     │   backoff: { type: 'exponential', delay: 5000 }│
                     │ })                                             │
                     └────────────────────────────────────────────────┘
                                             │
                                             ▼
                     ┌────────────────────────────────────────────────┐
                     │ ОБРАБОТЧИК BULLMQ WORKER (OrderProcessor)      │
                     └────────────────────────────────────────────────┘
                                             │
                               Проверка идемпотентности:
                             Задача уже была обработана?
                                  ┌──────────┴──────────┐
                                 ДА                     НЕТ
                                  │                      │
                                  ▼                      ▼
                     ┌──────────────────────┐ ┌───────────────────────┐
                     │ Пропустить (NOOP)    │ │ Захватить execution   │
                     │ ACK job в BullMQ     │ │ lease в Redis/БД      │
                     └──────────────────────┘ └───────────────────────┘
                                                         │
                                                         ▼
                                              ┌───────────────────────┐
                                              │ Выполнить внешнюю     │
                                              │ интеграцию (API шлюз) │
                                              └───────────────────────┘
                                                         │
                                               Успешно выполнено?
                                           ┌─────────────┴─────────────┐
                                          ДА                           НЕТ
                                           │                            │
                                           ▼                            ▼
                      ┌─────────────────────────┐  ┌─────────────────────────┐
                      │ 1. tx.order.update(...) │  │ BullMQ Retry с          │
                      │ 2. outbox.status='SENT' │  │ Jittered Backoff        │
                      │ 3. ACK job в очереди    │  │ (Попытки 1..5)          │
                      └─────────────────────────┘  └─────────────────────────┘
                                                                │
                                                    Попытки исчерпаны?
                                                    (attemptsMade >= 5)
                                                                │
                                                                ▼
                                                   ┌─────────────────────────┐
                                                   │ DEAD-LETTER QUEUE (DLQ) │
                                                   │ 1. dlqQueue.add(...)    │
                                                   │ 2. outbox.status=FAILED │
                                                   │ 3. Telegram Alert       │
                                                   │ 4. SecurityAlertService │
                                                   └─────────────────────────┘
```

### 1.2. Пошаговые правила надежного жизненного цикла

1. **Гарантия фиксации события (Transactional Outbox):**
   - Любое асинхронное действие обязано сохраняться в таблицу `ProviderOutbox` (или профильную outbox-таблицу) **в той же физической транзакции**, что и доменная сущность.
   - Запрещено выполнять сетевые вызовы в Redis или к внешним API внутри транзакции PostgreSQL.
2. **Параллельная доставка без гонок (`FOR UPDATE SKIP LOCKED`):**
   - Несколько экземпляров воркера Poller считывают записи из `ProviderOutbox` пачками по 50 штук с использованием PostgreSQL-директивы `FOR UPDATE SKIP LOCKED`.
   - Это гарантирует, что две параллельные ноды никогда не захватят одну и ту же запись outbox, и исключает блокировки таблицы.
3. **Дедупликация задач в BullMQ:**
   - Каждая задача регистрируется в BullMQ со строгим детерминированным идентификатором: `jobId = outbox.idempotencyKey`.
   - Если задача с таким `jobId` уже находится в очереди (активна, ожидает или отложена), BullMQ прозрачно игнорирует повторное добавление.
4. **Идемпотентный консьюмер:**
   - Перед вызовом внешнего API воркер проверяет текущий статус заказа в БД. Если статус уже `IN_PROGRESS` или `COMPLETED`, обработка завершается без повторного обращения к провайдеру.
5. **Экспоненциальный Backoff с джиттером:**
   - Повторы при сбоях настраиваются со случайным разбросом $\pm 20\%$ (`jitteredBackoff`), чтобы исключить эффект "громоподобного стада" (Thundering Herd) на внешние API.
6. **Маршрутизация в DLQ и оповещение:**
   - При исчерпании всех попыток задача перемещается в `dlqQueue`. Запрещено молча удалять упавшую задачу (`removeOnFail: false` для DLQ).
   - Формируется критический алерт в `telegramQueue` с уровнем `CRITICAL`.

---

## 2. Жесткие инварианты и табу (Hard Invariants & Anti-Patterns)

### Инвариант 1: Transactional Outbox vs Dual-Write Vulnerability
> **ТАБУ:** Категорически запрещено создавать запись в базе данных PostgreSQL и затем напрямую вызывать `queue.add()` или внешний HTTP API в теле того же роута/Server Action.

#### ❌ ПЛОХО (Классический Dual-Write с риском потери заказа):
```typescript
// АНТИПАТТЕРН: Dual-Write — прямой путь к потере синхронизации
export async function createOrderDualWrite(userId: string, serviceId: string, quantity: number) {
  // 1. Создали заказ в БД
  const order = await db.order.create({
    data: { userId, serviceId, quantity, status: 'PENDING' },
  });

  // 2. ОШИБКА: Если здесь упадет сеть к Redis, упадет процесс или перезагрузится сервер,
  // заказ останется в БД навсегда в статусе PENDING, а клиент потеряет деньги!
  await ordersQueue.add('process-order', { orderId: order.id });

  return order;
}
```

#### ✅ ХОРОШО (Атомарный Transactional Outbox в единой транзакции):
```typescript
// ЭТАЛОН OmniSMM: Атомарная запись в Order и ProviderOutbox
import { runSerializableTransaction } from '@/lib/transactions';
import crypto from 'crypto';

export async function createOrderWithOutbox(
  userId: string,
  serviceId: string,
  providerId: string,
  quantity: number,
  costKopecks: bigint
) {
  return await runSerializableTransaction(async (tx) => {
    // 1. Создаем заказ
    const order = await tx.order.create({
      data: {
        userId,
        serviceId,
        providerId,
        quantity,
        costKopecks,
        status: 'PENDING',
      },
    });

    // 2. Генерируем детерминированный ключ идемпотентности
    const idempotencyKey = `outbox:order:${order.id}:${crypto.randomUUID()}`;

    // 3. В ТОЙ ЖЕ ТРАНЗАКЦИИ создаем запись в Outbox
    const outboxRecord = await tx.providerOutbox.create({
      data: {
        orderId: order.id,
        providerId,
        idempotencyKey,
        status: 'PENDING',
        payload: {
          orderId: order.id,
          serviceId,
          quantity,
          providerId,
        },
      },
    });

    return { order, outboxRecord };
  });
}
```

---

### Инвариант 2: Outbox Poller Concurrency (`FOR UPDATE SKIP LOCKED`)
> **ТАБУ:** Запрещено выбирать записи из outbox простым `SELECT ... WHERE status = 'PENDING'` без блокировки строк `SKIP LOCKED`.

Без `FOR UPDATE SKIP LOCKED` два параллельно работающих экземпляра воркера (например, в Docker-контейнерах `smmplan_web_1` и `smmplan_web_2`) выберут абсолютно одинаковый набор из 50 строк и отправят 50 дублирующих задач в очередь.

#### ✅ Безопасный Poller через Prisma Raw Query:
```typescript
// workers/outbox-poller.ts
import { db } from '@/lib/db';
import { ordersQueue } from '@/lib/queue-manager';

export async function pollOutboxBatch(batchSize: number = 50) {
  return await db.$transaction(async (tx) => {
    // Атомарно выбираем и блокируем строки, пропуская уже заблокированные другими воркерами
    const pendingItems = await tx.$queryRaw<Array<{
      id: string;
      orderId: string;
      providerId: string;
      idempotencyKey: string;
      payload: any;
      attempts: number;
    }>>`
      SELECT id, "orderId", "providerId", "idempotencyKey", payload, attempts
      FROM "ProviderOutbox"
      WHERE status = 'PENDING'
      ORDER BY "createdAt" ASC
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    `;

    for (const item of pendingItems) {
      // Публикуем задачу в BullMQ с дедупликацией по idempotencyKey
      await ordersQueue.add('dispatch-to-provider', item.payload, {
        jobId: item.idempotencyKey,
        attempts: 5,
        backoff: { type: 'exponential', delay: 5000 },
      });

      // Переводим статус в PROCESSING, освобождая лок
      await tx.providerOutbox.update({
        where: { id: item.id },
        data: {
          status: 'PROCESSING',
          lastAttemptAt: new Date(),
          attempts: { increment: 1 },
        },
      });
    }

    return pendingItems.length;
  });
}
```

---

### Инвариант 3: Strict Consumer Idempotency
> **ТАБУ:** Запрещено доверять тому, что воркер получит задачу ровно один раз. Любой обработчик задачи (Worker Processor) обязан быть идемпотентным и защищенным от повторного исполнения.

#### ✅ Эталонная реализация процессора с защитой от повторного выполнения:
```typescript
// workers/processors/order.processor.ts
import { Job } from 'bullmq';
import { db } from '@/lib/db';
import { OrderJobPayload } from '@/lib/queue-manager';
import { sendToProviderApi } from '@/lib/providers/gateway';

export async function processOrderJob(job: Job<OrderJobPayload>) {
  const { orderId } = job.data;

  // 1. Проверяем актуальное состояние сущности в базе данных
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, providerOrderId: true, providerId: true },
  });

  if (!order) {
    console.warn(`[OrderProcessor] Заказ ${orderId} не найден. Пропуск.`);
    return { skipped: true, reason: 'ORDER_NOT_FOUND' };
  }

  // Защитный барьер: если заказ уже отправлен провайдеру, прерываем повторное выполнение
  if (order.status !== 'PENDING' || order.providerOrderId) {
    console.info(`[OrderProcessor] Заказ ${orderId} уже обработан (status=${order.status}). Идемпотентный выход.`);
    return { skipped: true, reason: 'ALREADY_PROCESSED' };
  }

  // 2. Вызываем внешний API поставщика с внешним таймаутом
  const providerResponse = await sendToProviderApi(order.providerId!, order.id);

  // 3. Атомарно обновляем заказ и статус в Outbox
  await db.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: 'IN_PROGRESS',
        providerOrderId: providerResponse.providerOrderId,
      },
    });

    await tx.providerOutbox.updateMany({
      where: { orderId: order.id, status: 'PROCESSING' },
      data: {
        status: 'SENT',
        providerOrderId: providerResponse.providerOrderId,
        responseBody: providerResponse.raw,
      },
    });
  });

  return { success: true, providerOrderId: providerResponse.providerOrderId };
}
```

---

### Инвариант 4: Worker Lifecycle and Graceful Shutdown
> **ТАБУ:** Запрещено убивать процесс воркеров жестким `process.exit(0)` или `SIGKILL` без ожидания завершения текущих активных задач.

При развертывании новой версии на хосте Docker передает контейнеру сигнал `SIGTERM`. Если воркер не перехватывает сигнал, он обрывается прямо во время отправки запроса к шлюзу поставщика, создавая "зависшие" заказы.

#### ✅ Корректная обработка сигналов завершения:
```typescript
// workers/index.ts
import { Worker } from 'bullmq';
import { getRedisConnection } from '@/lib/queue-manager';
import { processOrderJob } from './processors/order.processor';

const orderWorker = new Worker('ordersQueue', processOrderJob, {
  connection: getRedisConnection(),
  concurrency: 10,
  lockDuration: 30000,
});

async function gracefulShutdown(signal: string) {
  console.log(`[Worker] Получен сигнал ${signal}. Начало мягкой остановки...`);

  // Прекращаем прием новых задач из очереди
  await orderWorker.pause(true);

  // Ожидаем завершения текущих активных задач (таймаут 15 секунд)
  const closePromise = orderWorker.close();
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Graceful shutdown timeout exceeded')), 15000)
  );

  try {
    await Promise.race([closePromise, timeoutPromise]);
    console.log('[Worker] Все активные задачи корректно завершены.');
  } catch (err) {
    console.error('[Worker] Принудительное закрытие из-за таймаута:', err);
  } finally {
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

---

### Инвариант 5: Dead-Letter Queue (DLQ) & Alerting Invariant
> **ТАБУ:** Запрещено настраивать очереди с `attempts: 1` без сохранения упавших задач или использовать автоматическое удаление `removeOnFail: true` на критических очередях платежей и заказов.

Если задача исчерпала все 5 попыток повтора (провайдер недоступен более 30 минут или произошла фатальная ошибка аутентификации API), событие обязано переместиться в `dlqQueue`, а администраторы должны получить мгновенное уведомление в Telegram.

#### ✅ Слушатель событий очереди и маршрутизация в DLQ:
```typescript
// workers/dlq-router.ts
import { ordersQueue, dlqQueue, telegramQueue } from '@/lib/queue-manager';
import { db } from '@/lib/db';

ordersQueue.on('failed', async (job, err) => {
  if (!job) return;

  // Проверяем, исчерпаны ли все попытки
  if (job.attemptsMade >= (job.opts.attempts || 3)) {
    console.error(`[DLQ Router] Задача ${job.id} окончательно провалена: ${err.message}`);

    // 1. Помещаем в постоянную очередь DLQ для ручного разбора
    await dlqQueue.add('failed-order-job', {
      originalQueue: 'ordersQueue',
      jobId: job.id,
      payload: job.data,
      error: err.message,
      failedAt: new Date().toISOString(),
    });

    // 2. Обновляем статус в базе данных на FAILED
    if (job.data?.orderId) {
      await db.providerOutbox.updateMany({
        where: { orderId: job.data.orderId },
        data: { status: 'FAILED', error: err.message },
      });
    }

    // 3. Отправляем алерт высокой важности в Telegram
    await telegramQueue.add('send-alert', {
      severity: 'CRITICAL',
      message: `🚨 *[OmniSMM DLQ Alert]*\nЗаказ \`${job.data?.orderId}\` исчерпал лимит попыток и перемещен в DLQ!\nОшибка: \`${err.message}\``,
    });
  }
});
```

---

## 3. Премортем-анализ и моделирование отказов (Failure Scenarios / Pre-Mortem)

| Сценарий отказа | Вероятность x Влияние | Механизм защиты в коде OmniSMM | Восстановление и самоисцеление |
| :--- | :---: | :--- | :--- |
| **1. Падение Redis в момент создания заказа**<br>Клиент оплатил заказ, PostgreSQL зафиксировал заказ, но сервер Redis недоступен или перезапускается. | **Средняя x Высокое** | Заказ и событие `ProviderOutbox` фиксируются атомарно в PostgreSQL. В момент создания заказа обращений к Redis нет вообще. | Когда Redis поднимается, фоновый Poller считывает все накопившиеся `PENDING` записи из `ProviderOutbox` и без потерь доставляет их в очередь. |
| **2. Сетевой сбой при отправке ACK в Redis (Ghost Retries)**<br>Воркер успешно отправил заказ в API провайдера, но при отправке отчета об успехе в Redis произошел сетевой таймаут. BullMQ отдает задачу другому воркеру. | **Высокая x Критическое** | Идемпотентная проверка в начале процессора: `if (order.status !== 'PENDING' || order.providerOrderId) return NOOP;`. | Второй воркер видит, что `providerOrderId` уже выставлен, немедленно подтверждает задачу и завершает работу без повторного заказа у поставщика. |
| **3. Ядовитое сообщение (Poison Pill Job)**<br>В очередь попала задача с невалидным форматом JSON, приводящая к необработанному исключению `SyntaxError` в процессоре. | **Низкая x Высокое** | Защитный блок `try/catch` на уровне обработчика задачи. Ограничение `attempts: 3`. После 3 сбоев задача уходит в `dlqQueue`. | Воркер не падает в бесконечный рестарт. Очередь продолжает обрабатывать валидные заказы. Поврежденная задача изолирована в DLQ. |
| **4. Переполнение таблицы Outbox (Unbounded Growth)**<br>При объеме 100 000 заказов в сутки таблица `ProviderOutbox` разрастается, замедляя выборку `FOR UPDATE SKIP LOCKED`. | **Высокая x Среднее** | Составной индекс `@@index([providerId, status])` и фоновая периодическая задача очистки `cleanupQueue`, архивирующая успешные записи старше 14 дней. | Время выполнения запроса Poller остается константным (< 5 мс) независимо от общего размера базы данных. |
| **5. Исчерпание оперативной памяти Redis (OOMKilled)**<br>Очереди BullMQ накапливают завершенные задачи, приводя к срабатыванию `maxmemory` политики или падению Redis контейнера. | **Средняя x Критическое** | Обязательные опции хранения истории: `removeOnComplete: { count: 500, age: 3600 }` и `removeOnFail: { count: 1000, age: 86400 }` в методе `createQueue`. | Автоматическая очистка старых завершенных метаданных задач в Redis предотвращает переполнение RAM. |

---

## 4. Чеклист верификации (Verification Checklist)

При создании или аудите асинхронных очередей и обработчиков агент **ОБЯЗАН** выполнить данный чеклист:

### 4.1. Архитектурный аудит кода (Static Code Audit)
- [ ] **Исключение Dual-Write:** В кодовой базе отсутствуют вызовы `queue.add()` внутри транзакционных сервисов без предварительной записи в `Outbox`.
- [ ] **Дедупликация задач:** Каждый вызов `queue.add()` передает строгий детерминированный `jobId` (например, `jobId: outbox.idempotencyKey`).
- [ ] **Идемпотентность процессоров:** Процессор воркера перед вызовом внешнего API повторно считывает сущность из БД и проверяет защитный инвариант статуса.
- [ ] **Лимиты истории задач:** Конфигурация очереди содержит опции `removeOnComplete` и `removeOnFail` для предотвращения переполнения памяти Redis.
- [ ] **Graceful Shutdown:** Обработчики процессов содержат перехват `SIGTERM` и `SIGINT` с вызовом `worker.close()`.

### 4.2. Автоматизированные тесты очередей (Vitest Integration Tests)
- [ ] Запущен регрессионный сьют воркеров и очередей:
  ```bash
  npx vitest run src/workers/processors/order.processor.timeout.test.ts
  npx vitest run src/__tests__/bot-order-real-execution.test.ts
  ```
- [ ] Проверен сценарий изоляции сбоев: при падении внешнего шлюза провайдера задача повторяется с задержкой и после 5 попыток попадает в DLQ без потерь.

### 4.3. Инспекция очередей и Outbox в реальном времени (Telemetry & Monitoring)
- [ ] Проверка зависших записей в Outbox (должно быть 0 или минимальное число свежих записей):
  ```sql
  -- Поиск необработанных событий Outbox старше 5 минут:
  SELECT id, "orderId", status, attempts, "lastAttemptAt", error 
  FROM "ProviderOutbox" 
  WHERE status IN ('PENDING', 'PROCESSING') 
    AND "createdAt" < NOW() - INTERVAL '5 minutes';
  ```
- [ ] Мониторинг очереди Dead-Letter Queue через CLI или Redis:
  ```bash
  # Проверка количества задач в очереди ошибок
  npx tsx scripts/harness/inspect-dlq.ts --queue=dead-letter-queue
  ```
- [ ] Ручной перезапуск задач из DLQ после устранения инцидента:
  ```bash
  # Реплей упавших задач обратно в рабочий контур
  npx tsx scripts/harness/replay-dlq.ts --from=dead-letter-queue --to=ordersQueue --limit=100
  ```
