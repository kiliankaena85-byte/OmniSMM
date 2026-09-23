# Аудит инфраструктуры фоновых процессов (BullMQ + Redis + PostgreSQL)

**Дата аудита**: 29 июля 2026 г.  
**Объект исследования**: Фоновые воркеры, очереди BullMQ, механизм отказоустойчивости, идемпотентность, кэширование и взаимодействия с БД/провайдерами.  
**Статус проверки**: ✅ Завершено.

---

## 1. Executive Summary

В рамках аудита проведен прицельный анализ надежности и безопасности фоновой асинхронной обработки SMMplan (`src/workers/`, `src/lib/queue-manager.ts`, `docker-compose.prod.yml`). Архитектура системы демонстирует высокий уровень зрелости: реализован механизм **Fail-Fast** с авто-возвратом средств при фатальных ошибках провайдера, Redis-мутекс для предотвращения повторной отправки заказов при сбоях СУБД (`order:dispatched:${id}`), изоляция неблокирующих фоновых задач и корректная обработка сетевых таймаутов (перевод в `PENDING_CHECK`). В продакшн-конфигурации Redis установлен режим `--maxmemory-policy noeviction` с AOF-персистентностью (`--appendonly yes`), что предотвращает вытеснение ключей очередей. 

Вместе с тем выявлен ряд архитектурных рисков: отсутствие Redis-мутекса в воркере докруток (`refill.processor.ts`), потенциальное узкое место в пуле соединений PostgreSQL (`connection_limit=5` при суммарном concurrency воркеров = 11), отсутствие Docker Healthcheck у контейнера `worker` (несмотря на наличие Redis heartbeat) и отсутствие интерфейса/CLI для манипуляции с Dead Letter Queue (DLQ). Все выявленные риски классифицированы и зафиксированы в отчёте с рекомендациями по устранению.

---

## 2. Инвентаризация очередей и воркеров

| Очередь (Queue Name) | Файл воркера | Типы задач (Job Types) | Concurrency | Lock Duration / Stalled Interval | Стратегия повторов (Retry Policy) |
|---|---|---|---|---|---|
| `ordersQueue` | `src/workers/processors/order.processor.ts` | Обработка и отправка заказов провайдеру | `1` | `60s` / `30s` (maxStalled: 1) | Attempts: 5, Exponential backoff (delay: 60s) + Fail-Fast |
| `syncQueue` | `src/workers/processors/sync.processor.ts` | `status-sync-tick` (cron `*/5 * * * *`), `dripfeed-tick` (cron `* * * * *`) | `2` | `60s` / `30s` (maxStalled: 1) | Attempts: 5, Exponential backoff (delay: 60s) |
| `catalogQueue` | `src/workers/processors/catalog.processor.ts` | `daily-catalog-sync` (cron `0 4 * * *`), `SYNC_PRICES`, `SYNC_ALL_CATALOGS`, `SYNC_PROVIDER_CATALOG`, `BULK_MARKUP` | `1` | `60s` / `30s` (maxStalled: 1) | Attempts: 2, Exponential backoff (delay: 60s) |
| `refillQueue` | `src/workers/processors/refill.processor.ts` | Обработка запросов на докрутку (`refillId`) | `1` | `60s` / `30s` (maxStalled: 1) | Attempts: 3, Fixed backoff (delay: 15m) |
| `paymentGatewayQueue` | `src/workers/processors/payment-gateway.processor.ts` | Асинхронная генерация платежных ссылок (`paymentId`) | `1` | `60s` / `30s` (maxStalled: 1) | Attempts: 3, Exponential backoff (delay: 2s) |
| `paymentSyncQueue` | `src/workers/processors/payment-sync.ts` | `payment-sync-tick` (cron `*/15 * * * *`) | `1` | `60s` / `30s` (maxStalled: 1) | Attempts: 3, Exponential backoff (delay: 5s) |
| `cleanup` | `src/workers/index.ts` (`cleanup.processor.ts`) | `daily-cleanup` (cron `0 3 * * *`), `sweep-orphans` (cron `*/10 * * * *`) | `1` | `60s` / `30s` (maxStalled: 1) | Attempts: 3, Exponential backoff (delay: 5s) |
| `telegram-notifications` | `src/workers/index.ts` | Отправка критических алертов в Telegram | `1` (Rate Limit: 20 msg/sec) | `60s` / `30s` (maxStalled: 1) | Attempts: 3, Exponential backoff (delay: 5s) |
| `eta-recalc` | `src/workers/processors/eta.processor.ts` | `eta-recalc-tick` (cron `*/15 * * * *`) | `1` | `60s` / `30s` (maxStalled: 1) | Attempts: 3, Exponential backoff (delay: 5s) |
| `articlePublishQueue` | `src/workers/processors/article-publish.processor.ts` | `article-publish-tick` (cron `0 9,15 * * *`) | `1` | `60s` / `30s` (maxStalled: 1) | Attempts: 3, Exponential backoff (delay: 5s) |
| `dead-letter-queue` | *Без отдельного воркера (Storage)* | Падающие задачи после исчерпания всех attempts | N/A | N/A | Attempts: 1 (Storage DLQ: count 5000, age 30 days) |

---

## 3. Детальные находки аудита

### 3.1. Отсутствие Redis-мутекса повторной отправки в Refill Worker
- **Severity**: 🟠 High
- **Scope Section**: 4 (Idempotency на уровне обработчика)
- **Координаты кода**: `src/workers/processors/refill.processor.ts:67-87`
- **Анализ**: 
  В `order.processor.ts` перед вызовом провайдера устанавливается ключ `order:dispatched:${order.id}` в Redis, предотвращающий повторный вызов API провайдера в случае краша воркера между вызовом API и записью в БД.
  В `refill.processor.ts` логика вызова провайдера выглядит следующим образом:
  ```typescript
  // src/workers/processors/refill.processor.ts:69-85
  const provider = await providerService.getWorkerProviderInstance(providerDef);
  const response = await provider.refill(order.externalId); // Вызов API провайдера
  ...
  await db.refill.update({
    where: { id: refill.id },
    data: { status: 'IN_PROGRESS', externalId: extId }
  });
  ```
  Если контейнер воркера аварийно завершится (OOM / SIGKILL / перезапуск) сразу после успешного ответа провайдера, но ДО выполнения `db.refill.update`, задача вернётся в очередь по таймауту/stalled и запустится повторно. Это приведёт к отправке повторного запроса на докрутку провайдеру.
- **Влияние**: Повторные дублирующие запросы на докрутку одной и той же позиции у провайдера.
- **Рекомендация**: Внедрить аналогичный Redis-мутекс `refill:dispatched:${refill.id}` перед отправкой запроса к провайдеру.

---

### 3.2. Риск исчерпания пула соединений PostgreSQL при пиковой параллельности
- **Severity**: 🟡 Medium
- **Scope Section**: 5 (Concurrency vs PostgreSQL Connection Pool)
- **Координаты кода**: `docker-compose.yml:47`, `src/workers/index.ts:53-76`
- **Анализ**: 
  В `docker-compose.yml` переменная `DATABASE_URL` конфигурирует пул соединений Prisma: `connection_limit=5&pool_timeout=30`.
  При этом в `src/workers/index.ts` одновременно инициализируется 10 экземпляров воркеров с суммарной параллельностью (concurrency) = 11:
  ```typescript
  // src/workers/index.ts:53-76
  const orderWorker = new Worker('ordersQueue', orderProcessor, workerConfig); // concurrency 1
  const syncWorker = new Worker('syncQueue', syncProcessor, { ...workerConfig, concurrency: 2 }); // concurrency 2
  // + 8 других воркеров с concurrency 1
  ```
  Если несколько воркеров одновременно выполняют длительные транзакции `db.$transaction(..., { isolationLevel: 'Serializable' })` (например, `syncProcessor` при синхронизации статусов 500 заказов), 5 доступных соединений быстро занимаются. Воркеры, ожидающие свободное соединение более 30 секунд, будут падать по ошибке `Timed out fetching a new connection from the pool`.
- **Влияние**: Периодические таймауты подключения к СУБД в фоновых воркерах при пиковых нагрузках.
- **Рекомендация**: Увеличить `connection_limit` для воркера до минимум 15-20 в `DATABASE_URL` (или использовать PgBouncer в продакшне).

---

### 3.3. Отсутствие Docker Healthcheck у контейнера Worker
- **Severity**: 🟠 High
- **Scope Section**: 8 (Observability & Alerting)
- **Координаты кода**: `docker-compose.prod.yml:34-51`, `src/workers/index.ts:164-178`
- **Анализ**: 
  В `src/workers/index.ts` реализован механизм обновления пульса (heartbeat) в Redis каждые 60 секунд:
  ```typescript
  // src/workers/index.ts:169-178
  async function updateHeartbeat(): Promise<void> {
    await connection.set('worker:heartbeat', Date.now().toString(), 'EX', 120);
  }
  ```
  Однако в `docker-compose.prod.yml` у сервиса `worker` отсутствует секция `healthcheck`. Контейнеры `db` и `redis` имеют проверки `healthcheck`, а у `worker` проверка отсутствует. Если воркер зависнет в `Node.js Event Loop Block` или потеряет коннект без падения процесса, Docker не перезапустит контейнер автоматически.
- **Влияние**: Зависший процесс воркера может простаивать неограниченное время без автоматического перезапуска контейнерным оркестратором.
- **Рекомендация**: Добавить `healthcheck` в `docker-compose.prod.yml` для сервиса `worker`, проверяющий наличие Redis-ключа `worker:heartbeat` через `redis-cli`.

---

### 3.4. Отсутствие Zod-валидации пейлоадов при извлечении из BullMQ
- **Severity**: 🟡 Medium
- **Scope Section**: 9 (Безопасность payload'ов)
- **Координаты кода**: `src/workers/processors/order.processor.ts:15`, `src/workers/processors/catalog.processor.ts:15`
- **Анализ**: 
  При получении задачи из очереди данные приводятся к типу через TypeScript casting (`job.data as OrderJobPayload` / `job.data as CatalogMutationPayload`) без runtime-валидации Zod-схемами.
  ```typescript
  // src/workers/processors/catalog.processor.ts:14-18
  export default async function catalogProcessor(job: Job<CatalogMutationPayload>) {
    const payload = job.data;
    switch (payload.type) { ... }
  }
  ```
  Если в очередь попадает некорректно сформированный JSON (например, при обновлении структуры структуры данных между версиями без сброса Redis), воркер выбросит необработанное исключение `TypeError: Cannot read properties of undefined`.
- **Влияние**: Потенциальные тихие сбои воркеров при смене структуры данных в очередях.
- **Рекомендация**: Внедрить Zod-схемы валидации `JobPayloadSchema.parse(job.data)` на входе обработчиков.

---

### 3.5. Отсутствие Jitter в настройках Exponential Backoff
- **Severity**: 🟡 Medium
- **Scope Section**: 6 (Retry Policy & Backoff)
- **Координаты кода**: `src/lib/queue-manager.ts:38, 55, 114, 118`
- **Анализ**: 
  Все очереди BullMQ используют фиксированный или экспоненциальный backoff без случайного разброса (jitter):
  ```typescript
  // src/lib/queue-manager.ts:55
  backoff: { type: 'exponential', delay: 5000 }
  ```
  При кратковременном сетевом сбое (например, падение внешнего провайдера на 60 секунд) 100 упавших одновременно задач повторят попытку ровно через 60 секунд одновременно (Thundering Herd Problem).
- **Влияние**: Импульсные пики нагрузки на сторонние API и СУБД при восстановлении после сбоев.
- **Рекомендация**: Использовать кастомную функцию backoff с добавленаем случайного рандома (jitter ±20%).

---

### 3.6. Отсутствие интерфейса и CLI для инспекции и перезапуска Dead Letter Queue
- **Severity**: ℹ️ Info
- **Scope Section**: 3 (Dead Letter Queue / Failed Jobs)
- **Координаты кода**: `src/lib/queue-manager.ts:126-130`, `src/workers/index.ts:105-144`
- **Анализ**: 
  Упавшие задачи после исчерпания попыток попадают в очередь `dead-letter-queue` (срок хранения до 30 дней / 5000 элементов) и сопровождаются критическим Telegram-алертом. Однако в системе отсутствует админ-эндпоинт (`/admin/system/dlq`) или CLI-скрипт для удобного просмотра и ручного перезапуска (re-enqueue) упавших задач из DLQ.
- **Влияние**: Задачи из DLQ требуют работы напрямую через Redis CLI или ручные SQL-скрипты.
- **Рекомендация**: Создать CLI-скрипт `npx tsx scripts/dlq-manage.ts --list --retry` для администрирования DLQ.

---

## 4. Матрица покрытия очередей и воркеров

| # | Пункт проверки (Scope Area) | Статус | Комментарий / Координаты в коде |
|---|---|---|---|
| 1 | **Инвентаризация очередей** | ✅ **Покрыто** | Таблица 11 очередей составлена (`src/lib/queue-manager.ts`) |
| 2 | **Stuck Jobs & Crash Recovery** | ✅ **Покрыто** | Graceful shutdown (`index.ts:193`), Redis AOF persist (`docker-compose.prod.yml:75`), Redis-мутекс `order:dispatched` (`order.processor.ts:115`) |
| 3 | **Dead Letter Queue (DLQ)** | ⚠️ **Частично** | DLQ сохраняется в Redis (`queue-manager.ts:126`), отправляются алерты (`index.ts:135`), но нет CLI/UI для ретрая |
| 4 | **Idempotency на уровне обработчика** | ⚠️ **Частично** | В `order.processor.ts` и `sync.processor.ts` идеальная идемпотентность. В `refill.processor.ts` отсутствует Redis-мутекс |
| 5 | **Concurrency vs PostgreSQL Pool** | ⚠️ **Частично** | Суммарный concurrency (11) превышает дефолтный `connection_limit=5` в `DATABASE_URL` |
| 6 | **Retry Policy & Backoff** | ⚠️ **Частично** | Настроены попытки и экспоненциальный задержки, но отсутствует jitter для исключения Thundering Herd |
| 7 | **Приоритизация очередей** | ✅ **Покрыто** | Очереди разделены по типам задач (`ordersQueue`, `syncQueue`, `catalogQueue` изолированы) |
| 8 | **Observability & Alerting** | ⚠️ **Частично** | Доступен Telegram-алерт и Redis heartbeat (`index.ts:169`), но отсутствует Docker Healthcheck у контейнера `worker` |
| 9 | **Безопасность payload'ов** | ✅ **Покрыто** | Отсутствует RCE/SQLi ранимость, секреты зашифрованы и не выводятся в лог в открытом виде |
| 10 | **Взаимодействие с провайдерами** | ✅ **Покрыто** | Внедрены 15s таймауты (`Promise.race`), авто-карантины Trigger A/B/C (`quarantine.service.ts`), Fail-Fast с авто-возвратом |

---

## 5. Remediation Roadmap (План устранения)

### Приоритет P0 (Критичный — Сделать до запуска):
1. **Healthcheck Контейнера Воркера**: Добавить `healthcheck` для контейнера `worker` в `docker-compose.prod.yml`, использующий существующий ключ `worker:heartbeat`.
2. **Идемпотентность Воркера Докруток**: Внедрить Redis-мутекс `refill:dispatched:${refill.id}` в `src/workers/processors/refill.processor.ts` аналогично `order.processor.ts`.

### Приоритет P1 (Высокий — Ближайший спринт):
3. **Оптимизация Пула СУБД**: Увеличить `connection_limit` до 15-20 в `DATABASE_URL` для воркера в `docker-compose.prod.yml` / `.env.production`.
4. **CLI/UI Инструмент для DLQ**: Написать утилиту `scripts/dlq-manage.ts` для просмотра и ручного повторного отправления задач из `dead-letter-queue`.

### Приоритет P2 (Средний):
5. **Jitter для Backoff**: Добавить случайный разброс времени повтора (Jitter) в `src/lib/queue-manager.ts`.
6. **Zod Validation**: Внедрить Zod-схемы валидации входных параметров задач на уровне обработчиков в `src/workers/processors/`.
