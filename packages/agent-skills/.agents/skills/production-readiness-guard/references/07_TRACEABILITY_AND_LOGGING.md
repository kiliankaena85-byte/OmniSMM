# Справочник 07: Телеметрия, Сквозная Трассировка (AsyncLocalStorage) и Маскирование PII

> **Стандарт:** OmniSMM Production Readiness Standard (v2026)  
> **Ключевой инвариант:** `INV-PROD-08` — Все логи структурированы в JSON со сквозным `traceId` и автоматическим маскированием PII/секретов.

---

## 1. Проблема «Слепоты в логах» (Logging Blindness)

В продакшене под нагрузкой 500 RPS обычный `console.log` превращает мониторинг в ад:

```
[12:40:01] Payment failed
[12:40:01] User created order
[12:40:01] Error: ECONNRESET
[12:40:01] Balance debited 500
[12:40:01] User id: user_123
```
Какой `Payment failed` относится к какому юзеру? Какой заказ упал с `ECONNRESET`? 
Понять это постфактум **невозможно**, если в логах нет сквозного идентификатора трассировки (`traceId`).

Кроме того, вывод полного объекта `console.log(user)` или `console.log(req.body)` приводит к **утечке паролей, токенов и платежных реквизитов (PII Leak)** в централизованные системы логирования (Datadog, Grafana Loki, ELK), что влечет штрафы регуляторов и отзыв сертификатов безопасности.

---

## 2. Сквозной контекст через AsyncLocalStorage (Zero Prop Drilling)

В Node.js встроен модуль `node:async_hooks`, позволяющий хранить контекст запроса во всей цепочке асинхронных вызовов без необходимости прокидывать объект контекста через 20 аргументов функций.

### Реализация контекста трассировки:
```typescript
// src/lib/telemetry/context.ts
import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  traceId: string;
  userId?: string;
  tenantId?: string;
}

export const requestStorage = new AsyncLocalStorage<RequestContext>();

// Обертка для корневого обработчика (Route Handler / Middleware / Worker)
export function runWithContext<T>(context: RequestContext, fn: () => Promise<T>): Promise<T> {
  return requestStorage.run(context, fn);
}

export function getTraceId(): string {
  return requestStorage.getStore()?.traceId ?? 'trace-orphan';
}
```

---

## 3. Маскирование персональных данных (PII & Secret Redactor)

Перед выводом любого объекта в поток `stdout`, все приватные поля обязаны заменяться на маску `[REDACTED]`.

```typescript
// src/lib/telemetry/redactor.ts
const SENSITIVE_KEYS = new Set([
  'password', 'token', 'apikey', 'secret', 'authorization', 
  'cardnumber', 'cvv', 'card_number', 'refreshtoken'
]);

export function sanitizePayload(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map(sanitizePayload);
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizePayload(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
```

---

## 4. Production-Grade Логгер в формате JSON

```typescript
// src/lib/logger.ts
import { requestStorage } from './telemetry/context';
import { sanitizePayload } from './telemetry/redactor';

export const logger = {
  info(msg: string, metadata: Record<string, unknown> = {}) {
    this.log('INFO', msg, metadata);
  },
  warn(msg: string, metadata: Record<string, unknown> = {}) {
    this.log('WARN', msg, metadata);
  },
  error(msg: string, err?: unknown, metadata: Record<string, unknown> = {}) {
    const errorDetails = err instanceof Error ? {
      name: err.name,
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    } : { rawError: String(err) };

    this.log('ERROR', msg, { ...metadata, error: errorDetails });
  },

  log(level: string, msg: string, metadata: Record<string, unknown>) {
    const store = requestStorage.getStore();
    
    // Единый машиночитаемый JSON-формат (1 строка = 1 лог)
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      msg,
      traceId: store?.traceId ?? 'system',
      userId: store?.userId,
      tenantId: store?.tenantId ?? 'smmplan',
      meta: sanitizePayload(metadata)
    };

    // В продакшене пишем строго одну строку JSON
    process.stdout.write(JSON.stringify(entry) + '\n');
  }
};
```

---

## 5. Чеклист готовности телеметрии

1. [ ] В кодовой базе нет сырых `console.log()`, `console.dir()`.
2. [ ] Все фоновые задачи (BullMQ) и HTTP-запросы оборачиваются в `runWithContext({ traceId })`.
3. [ ] Логи выводятся в структурированном JSON-формате (для Datadog/ELK).
4. [ ] Поля паролей, токенов и платежных данных гарантированно санитизируются.
5. [ ] В production-окружении отключен шумный вывод уровня DEBUG.
