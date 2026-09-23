---
name: resilience-bulkhead-circuit
description: >
  Архитектурные паттерны отказоустойчивости (Resilience), изоляции сбоев и предотвращения каскадных
  аварий в платформе OmniSMM. Используй этот скилл ВСЕГДА, когда речь идет о внешних поставщиках SMM
  (SMM panels, Drip-Feed APIs), платежных шлюзах (ЮKassa, Robokassa, CryptoBot), Circuit Breaker
  (состояния Closed, Open, Half-Open), Bulkhead (отсеки изоляции пулов воркеров, лимитов соединений
  и очередей per-provider и per-tenant), обязательных сетевых таймаутах (AbortSignal.timeout, исключение
  зависших сокетов и микротасок), Graceful Degradation (деградация сервиса, кэширование ответов в Redis,
  отложенная очередь задач вместо 500 ошибки клиенту), обработке троттлинга 429 и аварийном переключении
  (Failover) на резервных провайдеров. Скилл реализует распределенный SRE-протокол: Fail-Fast, изоляция
  отсеков, экспоненциальный бэкофф с джиттером и разделение состояния через Redis в многоконтейнерном кластере.
---

# Resilience, Bulkhead & Circuit Breaker — Инженерный стандарт OmniSMM 1.0

## Назначение и зона ответственности скилла

В высоконагруженной распределенной платформе **OmniSMM** (обслуживающей бренды **SMMplan** и **SMMflux**) взаимодействие с внешними нестабильными контрагентами (сотни сторонних SMM-панелей, провайдеров накрутки, фискальных шлюзов и платежных систем) является главным источником риска отказа всей системы:
- Сторонние API подвержены внезапным падениям (502 Bad Gateway, 504 Gateway Timeout), деградации времени ответа до 30–60 секунд (Tar-Pit), непредсказуемому троттлингу (HTTP 429 Too Many Requests) и блокировкам Cloudflare Anti-Bot.
- Без защитных барьеров зависание одного внешнего поставщика моментально парализует Node.js Event Loop, исчерпывает пул HTTP-агента (`keepAlive` сокеты), забивает воркеры BullMQ и перегружает пул соединений PostgreSQL (Prisma Client).
- **Данный скилл определяет строгие инварианты отказоустойчивости:** распределенный Circuit Breaker на базе Redis, изоляцию очередей и лимитов через паттерн Bulkhead, гарантированные сетевые таймауты (`AbortSignal.timeout`), мягкую деградацию (Graceful Degradation) с отдачей кэша и отложенной маршрутизацией.

---

## 1. Дерево решений (Decision Tree / Flowchart)

### 1.1. Архитектурная схема потока вызова внешнего провайдера

```
               [ Входящий запрос (Заказ / Статус / Баланс / Каталог) ]
                                         │
                                         ▼
                     ┌───────────────────────────────────────┐
                     │  ШАГ 1: Bulkhead Compartment Check    │
                     │  Active Connections < ConcurrencyCap  │
                     └───────────────────────────────────────┘
                                  │             │
                             [ДА: Слот есть]   [НЕТ: Переполнение]
                                  │             │
                                  │             ▼
                                  │   ┌───────────────────────────────────┐
                                  │   │  Bulkhead Overflow Policy:        │
                                  │   │  - Критичный заказ -> BullMQ DLQ  │
                                  │   │  - Несрочный опрос -> Drop/Defer  │
                                  │   │  - UI запрос -> 429 Retry-After   │
                                  │   └───────────────────────────────────┘
                                  ▼
                     ┌───────────────────────────────────────┐
                     │  ШАГ 2: Circuit Breaker State Check   │
                     │  Redis Key: circuit:provider:{id}     │
                     └───────────────────────────────────────┘
                                  │
          ┌───────────────────────┼────────────────────────┐
          │                       │                        │
     [State: OPEN]         [State: HALF-OPEN]       [State: CLOSED]
          │                       │                        │
          ▼                       │                        │
 ┌──────────────────────┐         │                        │
 │ Date.now() >= next?  │         │                        │
 └──────────────────────┘         │                        │
     │              │             │                        │
 [НЕТ]             [ДА]           │                        │
   │                │             │                        │
   │                ▼             │                        │
   │     ┌─────────────────────┐  │                        │
   │     │ Перевод в HALF-OPEN │──┘                        │
   │     └─────────────────────┘                           │
   │                │                                      │
   │       [Канареечный зонд]                              │
   │       Concurrency = 1                                 │
   │                │                                      │
   │                ▼                                      ▼
   │     ┌────────────────────────────────────────────────────────┐
   │     │  ШАГ 3: Network Call via proxiedFetch & AbortSignal    │
   │     │  Timeout: Provider Type Default (3s..10s, max 15s)     │
   │     └────────────────────────────────────────────────────────┘
   │                                  │
   │                       ┌──────────┴──────────┐
   │                       │                     │
   │                 [2xx Success]       [Timeout / 5xx / 429]
   │                       │                     │
   │                       ▼                     ▼
   │             ┌──────────────────┐  ┌───────────────────────────┐
   │             │ Сброс счетчиков: │  │ Фиксация сбоя в Redis:    │
   │             │ failures = 0     │  │ failures = failures + 1   │
   │             │ State -> CLOSED  │  │ if failures >= 5 -> OPEN  │
   │             └──────────────────┘  │ nextRetry = now + 60s     │
   │                       │           └───────────────────────────┘
   │                       ▼                         │
   │             [Успешный ответ]                    ▼
   ▼                                       ┌───────────────────────────┐
┌──────────────────────────────────────┐   │  ШАГ 4: Graceful Fallback │
│ Fail-Fast: ProviderUnavailableError  │──>│  - Smart Provider Switch  │
│ Не нагружать упавший внешний шлюз    │   │  - Stash in BullMQ Queue  │
└──────────────────────────────────────┘   │  - Stale Cache from Redis │
                                           │  - Return { success: true,│
                                           │    status: 'QUEUED' }     │
                                           └───────────────────────────┘
```

### 1.2. Пошаговая логика маршрутизации и принятия решений

1. **Проверка емкости отсека (Bulkhead Capacity Guard):**
   - Перед отправкой любого запроса проверяется лимит одновременных операций для данного `providerId` и `tenantId`.
   - Если число активных вызовов достигло предела (например, `concurrency = 5` для конкретной SMM-панели): запрос не блокирует поток Node.js, а направляется в изолированную очередь BullMQ с приоритетом либо отклоняется с управляемым статусом ожидания.

2. **Проверка распределенного состояния Circuit Breaker (Redis-backed):**
   - Чтение хэша `circuit:provider:{providerId}` в Redis.
   - Если состояние **`CLOSED`**: вызов разрешен, запрос передается в сетевой транспорт.
   - Если состояние **`OPEN`**: вычисляется `Date.now() >= nextRetryTime` (период охлаждения, по умолчанию 60 секунд).
     - Если таймаут охлаждения не истек: немедленный **Fail-Fast** (выброс `ProviderUnavailableError` без совершения сетевого вызова).
     - Если таймаут истек: атомарный перевод в **`HALF-OPEN`** с допуском одного пробного запроса (Canary Probe).
   - Если состояние **`HALF-OPEN`**: пропускается ровно 1 запрос. Любые параллельные запросы получают `ProviderUnavailableError` до завершения пробного.

3. **Сетевой транспорт с обязательным `AbortSignal.timeout(ms)`:**
   - Каждый `fetch` обязан оборачиваться в `AbortSignal.timeout(ms)` или `AbortController` с жестким дедлайном.
   - Стандартные тайминги:
     - Опрос баланса провайдера: **5 000 мс**.
     - Синхронизация статусов заказов: **8 000 мс**.
     - Отправка нового заказа: **12 000 мс**.
     - Абсолютный потолок для любых внешних вызовов: **15 000 мс**.
   - По завершении таймера сокет немедленно уничтожается (`abort()`), предотвращая утечку дескрипторов в контейнере Docker.

4. **Анализ результата и мутация состояния:**
   - **Успех (HTTP 200..299):** В состоянии `HALF-OPEN` или `CLOSED` счетчик сбоев обнуляется (`failures = 0`), состояние фиксируется как `CLOSED`.
   - **Сбой (Timeout, 500, 502, 503, 504, сетевой сброс):**
     - В состоянии `HALF-OPEN`: немедленный возврат в `OPEN` с удвоением периода охлаждения (Exponential Cooldown).
     - В состоянии `CLOSED`: инкремент `failures`. Если `failures >= FAILURE_THRESHOLD (5)` — размыкание цепи в `OPEN`, отправка алерта в `SecurityAlertService` / Telegram и установка времени `nextRetry = now + RESET_TIMEOUT_MS`.

5. **Исполнение стратегии мягкой деградации (Graceful Degradation):**
   - Ни при каких обстоятельствах падение внешнего провайдера не должно приводить к `500 Internal Server Error` на стороне клиента платформы OmniSMM.
   - Для создания заказов: перевод заказа в статус `PENDING_RETRY` и помещение задачи в BullMQ `ordersQueue` для фонового автоповтора.
   - Для каталога услуг: отдача снимка кэша из Redis (`provider:{id}:catalog_cache`) с флагом `stale: true`.
   - Для статусов заказов: откладывание синхронизации до следующего цикла крона `provider-status-sync.job.ts`.

---

## 2. Жесткие инварианты и табу (Hard Invariants & Anti-Patterns)

### 2.1. Табу 1: «Голый» `fetch()` без `AbortSignal.timeout` (Зависание сокетов)

> ❌ **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО** вызывать нативный `fetch()`, `axios` или `got` без передачи явного `signal: AbortSignal.timeout(ms)`.

```typescript
// ❌ АНТИПАТТЕРН: "Голый" fetch зависает навсегда при потере пакетов или Tar-Pit защите провайдера
export async function badCallProvider(url: string, payload: Record<string, unknown>) {
  const response = await fetch(url, { // ❌ Висит до 120 секунд в Linux/Node.js, забивая сокеты
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' }
  });
  return response.json();
}
```

```typescript
// ✅ ПРАВИЛЬНО: Строгий AbortSignal.timeout, дифференциация ошибок и очистка сокетов
import { redactSensitiveTokens } from '@/lib/logger/sensitive-data-filter';

export async function safeCallProvider<T>(
  url: string,
  payload: Record<string, unknown>,
  timeoutMs = 10000
): Promise<T> {
  const signal = AbortSignal.timeout(timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: new URLSearchParams(payload as Record<string, string>).toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'OmniSMM-Gateway/1.0',
      },
      signal,
      redirect: 'error', // ❌ Запрет скрытых редиректов (SSRF Prevention)
    });

    if (!response.ok) {
      throw new Error(`Provider HTTP Error: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as T;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      console.error(`[GatewayTimeout] Провайдер ${url} не ответил за ${timeoutMs}мс`);
      throw new Error(`PROVIDER_TIMEOUT: Превышен лимит ожидания ${timeoutMs}мс`);
    }
    console.error('[GatewayError]', redactSensitiveTokens(String(error)));
    throw error;
  }
}
```

---

### 2.2. Табу 2: Локальный Circuit Breaker в памяти (Single-Instance Illusion)

> ❌ **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО** хранить состояние выключателя цепи (`state`, `failureCount`) только в локальных переменных Node.js (`let failures = 0`) в продакшене.
> При Blue-Green деплое, наличии нескольких реплик контейнера или воркеров BullMQ локальный счетчик приводит к тому, что каждый инстанс отправляет по 5 запросов, организуя шторм на уже упавшую панель.

```typescript
// ❌ АНТИПАТТЕРН: Локальный стейт — размазывание сбоев по кластеру
class BadLocalCircuitBreaker {
  private static failures = 0; // ❌ У каждого процесса/воркера свой счетчик!
  private static state: 'CLOSED' | 'OPEN' = 'CLOSED';

  static async recordFailure() {
    this.failures++;
    if (this.failures >= 5) this.state = 'OPEN';
  }
}
```

```typescript
// ✅ ПРАВИЛЬНО: Распределенный Circuit Breaker на базе Redis Hash с локальным fallback
import { redis } from '@/lib/redis';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class DistributedCircuitBreaker {
  private static readonly FAILURE_THRESHOLD = 5;
  private static readonly RESET_TIMEOUT_MS = 60000;

  static async checkState(providerId: string): Promise<CircuitState> {
    const key = `circuit:provider:${providerId}`;
    try {
      if (redis && redis.status === 'ready') {
        const data = await redis.hgetall(key);
        if (data?.state) {
          const state = data.state as CircuitState;
          const nextRetry = parseInt(data.nextRetry || '0', 10);

          if (state === 'OPEN' && Date.now() >= nextRetry) {
            await redis.hset(key, 'state', 'HALF_OPEN');
            return 'HALF_OPEN';
          }
          return state;
        }
      }
    } catch (redisErr) {
      console.warn('[CircuitBreaker] Redis недоступен, переход на fail-safe режим', redisErr);
    }
    return 'CLOSED';
  }

  static async recordFailure(providerId: string): Promise<void> {
    const key = `circuit:provider:${providerId}`;
    const now = Date.now();

    try {
      if (redis && redis.status === 'ready') {
        const failures = await redis.hincrby(key, 'failures', 1);
        await redis.hset(key, 'lastFailure', now.toString());

        if (failures >= this.FAILURE_THRESHOLD) {
          await redis.hset(key, {
            state: 'OPEN',
            nextRetry: (now + this.RESET_TIMEOUT_MS).toString(),
          });
          await redis.expire(key, 86400); // TTL 24 часа
          console.error(`[CircuitBreaker] РАЗОМКНУТ (OPEN) для провайдера ${providerId}`);
        }
      }
    } catch (err) {
      console.warn('[CircuitBreaker] Ошибка записи сбоя в Redis:', err);
    }
  }
}
```

---

### 2.3. Табу 3: Общий глобальный пул очередей без отсеков (Bulkhead Violation)

> ❌ **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО** запускать все фоновые задачи взаимодействия с провайдерами в одной общей очереди без ограничения конкурентности по контрагентам.
> Если «Провайдер А» завис на 15 секунд, все воркеры BullMQ забиваются его задачами. Заказы «Провайдера Б» (который полностью здоров) встают в мертвую пробку (Head-of-Line Blocking).

```typescript
// ❌ АНТИПАТТЕРН: Общая очередь для всех 50 провайдеров без изоляции конкурентности
export const badWorker = new Worker('all-provider-orders', async (job) => {
  // ❌ Если 10 задач подряд идут на упавшего провайдера — весь пул из 10 воркеров встает намертво
  await callProvider(job.data.providerId, job.data.payload);
}, { concurrency: 10 });
```

```typescript
// ✅ ПРАВИЛЬНО: Паттерн Bulkhead — сегрегация очередей и динамический семафор конкурентности
import { Redis } from 'ioredis';
import { getRedisConnection } from '@/lib/queue-manager';

export class BulkheadSemaphore {
  private static readonly MAX_CONCURRENT_PER_PROVIDER = 3; // Не более 3 одновременных запросов на 1 панель
  private static readonly HOLD_TTL_SEC = 20;

  /**
   * Захват слота в отсеке провайдера (Bulkhead Acquire)
   */
  static async acquireSlot(providerId: string): Promise<boolean> {
    const redis = getRedisConnection();
    const key = `bulkhead:provider:${providerId}:active`;
    const count = await redis.incr(key);

    if (count === 1) {
      await redis.expire(key, this.HOLD_TTL_SEC);
    }

    if (count > this.MAX_CONCURRENT_PER_PROVIDER) {
      await redis.decr(key);
      return false; // Отсек переполнен
    }

    return true;
  }

  /**
   * Освобождение слота в отсеке провайдера (Bulkhead Release)
   */
  static async releaseSlot(providerId: string): Promise<void> {
    const redis = getRedisConnection();
    const key = `bulkhead:provider:${providerId}:active`;
    const current = await redis.decr(key);
    if (current < 0) {
      await redis.set(key, '0');
    }
  }
}
```

---

### 2.4. Табу 4: Выброс необработанной ошибки 500 клиенту при сбое внешнего API

> ❌ **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО** выбрасывать `throw new Error(...)` прямо из Server Action пользователю, если сторонний провайдер вернул ошибку или таймаут.
> Все финансовые транзакции и заказы обязаны переходить в управляемый статус `PENDING_DISPATCH` с сохранением средств и постановкой в очередь повторной отправки.

```typescript
// ❌ АНТИПАТТЕРН: Внешняя ошибка пробивает серверный экшен до белого экрана
export async function badCreateOrderAction(serviceId: string, link: string) {
  'use server';
  // ❌ Если провайдер вернул 502 или сработал таймаут — клиент увидит стандартный краш Next.js
  const result = await externalProvider.createOrder({ serviceId, link });
  return { success: true, orderId: result.order };
}
```

```typescript
// ✅ ПРАВИЛЬНО: Защитный барьер, сохранение в БД и перевод в очередь повтора (Graceful Stash)
export async function safeCreateOrderAction(serviceId: string, link: string, quantity: number) {
  'use server';
  try {
    // 1. Атомарное создание заказа в БД со статусом PENDING_DISPATCH через WalletOps
    const order = await db.order.create({
      data: {
        serviceId,
        link,
        quantity,
        status: 'PENDING_DISPATCH',
        dispatchAttempts: 0,
      }
    });

    // 2. Постановка в защищенную очередь BullMQ
    await ordersQueue.add('DISPATCH_ORDER', { orderId: order.id }, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 10000 },
      removeOnComplete: true,
    });

    // 3. Пользователь ВСЕГДА получает предсказуемый оптимистичный результат
    return {
      success: true,
      orderId: order.id,
      status: 'QUEUED',
      message: 'Заказ принят в обработку и будет доставлен в течение нескольких минут',
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: 'Временный сбой постановки в очередь. Повторите попытку через минуту.',
    };
  }
}
```

---

## 3. Премортем-анализ и моделирование отказов (Failure Scenarios / Pre-Mortem)

В таблице смоделированы критические сценарии отказов распределенной среды и заложенные в платформу барьеры устойчивости:

| Сценарий отказа | Вероятность x Влияние | Механизм защиты в коде (Fail-Closed / Circuit Breaker) | Стратегия восстановления и самоисцеления |
| :--- | :--- | :--- | :--- |
| **1. Зависание ответов стороннего провайдера (Tar-Pit / 30s+ Latency)** | **Высокая (4/5)** x **Критическое (5/5)** = **20/25** | Жесткий `AbortSignal.timeout(10000)` в `proxiedFetch`. Прерывание по таймауту бросает `TimeoutError`. Семафор `BulkheadSemaphore` не позволяет более чем 3 зависшим запросам блокировать соединения. | После 5 таймаутов подряд Circuit Breaker переходит в `OPEN`. Все последующие вызовы получают мгновенный `ProviderUnavailableError` (0 мс), не занимая сокеты. |
| **2. Тотальный блэкаут провайдера (DNS NXDOMAIN / 502 / Cloudflare 1020)** | **Средняя (3/5)** x **Высокое (4/5)** = **12/25** | Мгновенный перехват HTTP 5xx и сетевых исключений. Фиксация в Redis `circuit:provider:{id}`. После 5 сбоев цепь размыкается на 60 секунд. Активация `SmartProviderMatcher` для failover. | Автоматическое переключение на альтернативного провайдера из Shadow Catalog с аналогичным типом услуги. Если аналога нет — удержание заказа в `PENDING_RETRY`. |
| **3. Шторм 429 Too Many Requests от внешней панели** | **Высокая (4/5)** x **Среднее (3/5)** = **12/25** | Считывание заголовка `Retry-After`. Принудительное засыпание воркера на `min(RetryAfter * 1000, 60000)` мс. Распределенный Rate Limiter на Redis снижает RPM к этому шлюзу. | Автоматическое дросселирование очереди задач в BullMQ (`queue.pause()` или снижение concurrency до 1) с постепенным плавным разгоном после спада лимита. |
| **4. Отказ / сетевой сплит локального кластера Redis** | **Низкая (1/5)** x **Критическое (5/5)** = **5/25** | Встроенный `localCircuitStore: Map<string, Status>` в каждом процессе Node.js как Fail-Safe Fallback. Ошибки чтения/записи в Redis перехватываются через `try/catch` без краша сервера. | Автоматический переход на локальную память. При восстановлении соединения с Redis (`redis.on('ready')`) локальные счетчики синхронизируются или мягко инвалидируются. |
| **5. Каскадное домино при аварийном переключении (Failover Domino Collapse)** | **Средняя (2/5)** x **Критическое (5/5)** = **10/25** | При падении Провайдера А трафик не сбрасывается лавиной на Провайдера Б. Bulkhead изолирует лимит нагрузки на Провайдера Б, отсекая избыток в буферную очередь задач. | Буферизация в BullMQ с динамическим джиттер-бэкоффом (`jitteredBackoff`). Защита резервного провайдера от мгновенной перегрузки. |

---

## 4. Чеклист верификации (Verification Checklist)

Перед сдачей любого изменения, затрагивающего сетевые вызовы к внешним шлюзам, SRE/QA обязаны провести сквозную верификацию по следующим пунктам:

### 4.1. Автоматизированные тесты надежности
- [ ] **Запуск тестового сьюта отказоустойчивости шлюзов:**
  ```bash
  npx vitest run src/__tests__/provider-gateway-resilience.test.ts
  ```
  *Критерий успеха:* 100% прохождение тестов шифрования ключей, идемпотентности, размыкания Circuit Breaker и изоляции отсеков.
- [ ] **Тестирование умного переключения при сбое провайдера (Failover):**
  ```bash
  npx vitest run src/__tests__/orders/smart-provider-fallback-and-failover.test.ts
  ```
- [ ] **Проверка проксирования и рейт-лимитов внешних панелей:**
  ```bash
  npx vitest run src/__tests__/provider-proxy-rate-limit.test.ts
  ```

### 4.2. Статический аудит кода на наличие уязвимостей
- [ ] **Проверка на отсутствие «голых» fetch() без таймаута:**
  ```bash
  npx tsx scripts/harness/grep-audit.ts "fetch(" --exclude="node_modules"
  ```
  *Требование:* Каждый вызов `fetch()` обязан содержать опцию `signal: AbortSignal.timeout(...)` или `signal: controller.signal`.
- [ ] **Проверка TypeScript в строгом режиме:**
  ```bash
  npx tsc --noEmit
  ```
  *Требование:* 0 ошибок типизации во всей кодовой базе.

### 4.3. Ручная валидация в Redis CLI и эмуляция сбоев
- [ ] **Проверка состояния Circuit Breaker в Redis:**
  ```bash
  # Подключение к Redis контейнеру
  docker exec -it smmplan_redis redis-cli hgetall "circuit:provider:prov_test_cb_1"
  ```
  *Ожидаемый ответ при размыкании:*
  ```
  1) "state"
  2) "OPEN"
  3) "failures"
  4) "5"
  5) "nextRetry"
  6) "1757581234567"
  ```
- [ ] **Проверка ручного сброса цепи оператором:**
  ```bash
  # Сброс цепи для восстановления трафика
  docker exec -it smmplan_redis redis-cli del "circuit:provider:prov_test_cb_1"
  ```
- [ ] **Проверка отсутствия утечек сокетов под нагрузкой:**
  ```bash
  # Мониторинг открытых соединений процесса Next.js
  netstat -ano | findstr :3000
  ```
