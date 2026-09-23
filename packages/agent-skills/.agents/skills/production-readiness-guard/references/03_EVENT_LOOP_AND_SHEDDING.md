# Справочник 03: Event Loop, Скрытый O(N²) и Сброс Нагрузки (Load Shedding)

> **Стандарт:** OmniSMM Production Readiness Standard (v2026)  
> **Ключевой инвариант:** `INV-PROD-03` — Запрещено блокировать Event Loop дольше 15 мс; внедрение Active Load Shedding при перегрузке.

---

## 1. Физика Event Loop: Как один запрос убивает 10 000 пользователей

Node.js выполняет JavaScript в **одном потоке** (Single-threaded). Если синхронная функция выполняется 500 мс, **все остальные 10 000 входящих HTTP-запросов стоят в очереди и не получают ни одного байта ответа**.

```
                       ┌─────────────────────────┐
                       │   ВХОДЯЩИЕ HTTP ЗАПРОСЫ │
                       └───────────┬─────────────┘
                                   │
                                   ▼
┌────────────────────── LIBUV EVENT LOOP ─────────────────────────┐
│                                                                 │
│   ┌───────────────┐     ┌────────────────┐     ┌────────────┐   │
│   │ 1. TIMERS     │ ──> │ 2. POLL (I/O)  │ ──> │ 3. CHECK   │   │
│   │ setTimeout    │     │ Sockets, DB, FS│     │setImmediate│   │
│   └───────────────┘     └────────────────┘     └────────────┘   │
│           ▲                                            │        │
│           └────────────────────────────────────────────┘        │
│                                                                 │
│   [ MICROTASKS QUEUE: process.nextTick(), Promise.then() ]      │
│   * Выполняются СРАЗУ после каждой фазы. Бесконечный промис     │
│     полностью замораживает фазу POLL (Starvation)!              │
└─────────────────────────────────────────────────────────────────┘
                                   │
                    💥 СИНХРОННАЯ ОПЕРАЦИЯ 800 мс:
             Event Loop замер. Все Healthcheck падают!
```

---

## 2. Антипаттерн: Скрытый O(N²) в массивах

Кандидаты часто используют методы массивов JavaScript, забывая об их алгоритмической сложности.

### ❌ Антипаттерн (Катастрофа на 20 000 элементов):
```typescript
// Задача: Найти заказы, которых нет в черном списке
// items = 50 000 элементов, blacklistedIds = 10 000 элементов
export function filterOrders(items: Order[], blacklistedIds: string[]) {
  return items.filter(item => {
    // 💥 O(N * M): Для КАЖДОГО заказа вызывается поиск по массиву blacklistedIds!
    // Итого: 50 000 * 10 000 = 500 000 000 итераций!
    // Время блокировки Event Loop: ~4.8 секунды!
    return !blacklistedIds.includes(item.userId);
  });
}
```

### ✅ Production-Grade (Хэш-сет O(1) доступ):
```typescript
export function filterOrdersFast(items: Order[], blacklistedIds: string[]) {
  // 1. Построение Set занимает O(M) времени
  const blacklistSet = new Set(blacklistedIds);

  // 2. Поиск в Set выполняется за O(1)
  // Итоговая сложность: O(N + M) вместо O(N * M)!
  // Время выполнения: 4 миллисекунды (ускорение в 1200 раз, 0 мс задержки Loop)
  return items.filter(item => !blacklistSet.has(item.userId));
}
```

---

## 3. Чанкование и уступка потока (Yielding via setImmediate)

Если необходимо обработать массив из 100 000 элементов без создания Worker Thread, синхронный цикл разобьет Event Loop на куски.

```typescript
// ✅ Безопасная обработка тяжелой коллекции без замирания сервера
export async function processInBatches<T>(
  items: T[], 
  batchSize: number, 
  handler: (item: T) => void
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    // Обрабатываем порцию
    for (const item of batch) {
      handler(item);
    }

    // УСТУПАЕМ ПОТОК (Yield to Event Loop):
    // Даем Node.js обработать сетевые пакеты и таймеры между порциями
    if (i + batchSize < items.length) {
      await new Promise(resolve => setImmediate(resolve));
    }
  }
}
```

---

## 4. Active Load Shedding (Сброс нагрузки вместо краха)

Теория очередей (**Закон Литтла** $L = \lambda W$) гласит: если система перегружена, увеличение очереди приводит к взрывному росту задержки.
Вместо того чтобы держать соединения открытыми до таймаута балансировщика, сервер обязан **моментально сбрасывать избыточные запросы с кодом HTTP 429 / 503**.

```typescript
// middleware или proxy guard
import { monitorEventLoopDelay } from 'node:perf_hooks';

// Мониторинг задержки Event Loop с 99-м перцентилем
const h = monitorEventLoopDelay({ resolution: 20 });
h.enable();

export function checkSystemLoad(): { overloaded: boolean; lagMs: number } {
  const p99LagMs = h.percentile(99) / 1e6; // наносекунды в мс

  // Если задержка цикла > 75 мс, сервер перегружен!
  if (p99LagMs > 75) {
    return { overloaded: true, lagMs: p99LagMs };
  }

  return { overloaded: false, lagMs: p99LagMs };
}

// Использование в эндпоинтах:
export async function safeRouteHandler(req: Request) {
  const { overloaded, lagMs } = checkSystemLoad();
  if (overloaded) {
    // Отдаем мгновенный отказ, сохраняя ресурсы для завершения текущих задач
    return new Response(JSON.stringify({ 
      error: 'Server is overloaded. Please retry later.',
      retryAfterSeconds: 5 
    }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': '5'
      }
    });
  }

  // Штатная обработка...
}
```

---

## 5. Чеклист готовности Event Loop

1. [ ] В горячих циклах отсутствуют методы `.find()`, `.filter()`, `.includes()` по массивам (заменены на `Map`/`Set`).
2. [ ] Отсутствуют вызовы `JSON.parse(JSON.stringify())` для объектов $> 100$ Кб.
3. [ ] Регулярные выражения проверены на ReDoS (отсутствуют вложенные квантификаторы вида `(a+)+`).
4. [ ] Длительные итерации используют `setImmediate()` для уступки управления планировщику.
5. [ ] При превышении лимита Event Loop Lag срабатывает Load Shedding.
