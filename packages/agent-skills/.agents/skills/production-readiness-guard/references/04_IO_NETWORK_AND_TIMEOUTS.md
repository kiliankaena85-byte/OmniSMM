# Справочник 04: Сеть, Таймауты Сокетов и Защита от Каскадных Сбоев

> **Стандарт:** OmniSMM Production Readiness Standard (v2026)  
> **Ключевой инвариант:** `INV-PROD-03` — 100% внешних сетевых вызовов обязаны иметь детерминированный таймаут `AbortSignal.timeout(ms)`.

---

## 1. Проблема «Зависшего Сокета» (The Hanging Socket Nightmare)

В современном JavaScript и Node.js стандартная функция `fetch()` **не имеет встроенного таймаута по умолчанию**:

```typescript
// ❌ АНТИПАТТЕРН: Мина замедленного действия
const response = await fetch('https://provider-api.com/v2/orders');
```

### Что происходит при сбое на стороне провайдера:
1. Если удаленный сервер завис (Deadlock, зависший TLS-хэндшейк, отвал маршрута в сети), сокет в операционной системе Linux переходит в состояние ожидания.
2. Дефолтный таймаут TCP Keepalive в Linux составляет **7200 секунд (2 часа)**!
3. Каждый такой вызов держит открытый сокет и дескриптор файла.
4. При 100 входящих заказах в минуту через 10 минут пул сокетов Node.js (`maxSockets`) и дескрипторы ОС полностью исчерпываются.
5. **Итог:** Сервер больше не может сделать **ни одного** сетевого запроса (включая обращения к БД и платежным шлюзам) и падает.

---

## 2. Антипаттерн vs Production-Grade: Сетевой вызов

### ❌ Антипаттерн:
```typescript
// Лабораторный код без таймаута и обработки ошибок
export async function createExternalOrder(payload: any) {
  const res = await fetch('https://provider.com/api', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return await res.json();
}
```

### ✅ Production-Grade (Таймаут + Jitter Retry + Circuit Breaker):
```typescript
import { logger } from '@/lib/logger';

interface RequestOptions {
  timeoutMs?: number;
  maxRetries?: number;
}

export async function safeFetchWithRetry<T>(
  url: string,
  init: RequestInit,
  options: RequestOptions = {}
): Promise<T> {
  const { timeoutMs = 5000, maxRetries = 3 } = options;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // 1. Детерминированный таймаут на КАЖДУЮ попытку
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Проверка HTTP-статуса
      if (!response.ok) {
        // Ошибки клиента (400, 401, 403, 422) не имеют смысла для повтора!
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          throw new Error(`HTTP Client Error ${response.status}: ${await response.text()}`);
        }
        throw new Error(`HTTP Server Error ${response.status}`);
      }

      return (await response.json()) as T;
    } catch (err: any) {
      clearTimeout(timeoutId);
      lastError = err;

      // Если это последняя попытка — выходим
      if (attempt === maxRetries - 1) break;

      // 2. Exponential Backoff с обязательным Full Jitter (Защита от Thundering Herd)
      // Формула: random(0, min(maxBackoff, base * 2^attempt))
      const baseDelay = 300;
      const exponentialDelay = Math.min(3000, baseDelay * Math.pow(2, attempt));
      const jitterDelay = Math.floor(Math.random() * exponentialDelay);

      logger.warn({
        msg: 'Retrying failed request',
        url,
        attempt: attempt + 1,
        delayMs: jitterDelay,
        error: err.message
      });

      await new Promise(resolve => setTimeout(resolve, jitterDelay));
    }
  }

  throw lastError ?? new Error(`Request to ${url} failed after ${maxRetries} attempts`);
}
```

---

## 3. Физика Thundering Herd и формула Full Jitter

Если упавший сервис восстановился, и 5000 ваших инстансов начнут слать повторы строго синхронно (например, каждые 1000 мс), сервис **мгновенно упадет повторно** от пикового шторма запросов.

```
[ Синхронный Backoff: 1000мс ] ───> ВСЕ 5000 ЗАПРОСОВ БЬЮТ В ОДНУ МИЛЛИСЕКУНДУ! 💥 Провайдер умер.
[ Full Jitter: Math.random() ] ───> Запросы равномерно размазаны по времени.      ✅ Провайдер ожил.
```

---

## 4. Паттерн Circuit Breaker (Предохранитель)

Когда внешний провайдер полностью недоступен, нет смысла тратить 5 секунд таймаута на каждый входящий запрос клиента. 
**Circuit Breaker** переходит в состояние `OPEN` и **мгновенно отдает отказ (Fail-Fast)**, не совершая реального сетевого вызова:

```
          ┌──────────────────────────────────────────────┐
          │                                              │
          ▼                                              │
   ┌──────────────┐   Порог ошибок превышен   ┌──────────────┐
   │    CLOSED    │ ────────────────────────> │     OPEN     │ (Мгновенный отказ
   │ (Нормальная  │                           │(Запросы НЕ   │  без вызова сети)
   │  работа)     │ <──────────────────────── │  идут)       │
   └──────────────┘   Успешный пробный запрос └──────────────┘
          ▲                                              │
          │                                              ▼ Истек coolDownMs
          │                                   ┌──────────────┐
          └────────────────────────────────── │  HALF-OPEN   │ (Проверка 1 запроса)
                                              └──────────────┘
```

---

## 5. Чеклист готовности сетевого слоя

1. [ ] Каждый вызов `fetch()` содержит `signal: AbortSignal.timeout(ms)` или привязан к `AbortController`.
2. [ ] Таймаут не превышает допустимый SLA (рекомендуется $\le 5000$ мс, для синхронного чекаута $\le 3000$ мс).
3. [ ] Повторные запросы (Retries) используют формулу **Full Jitter** и не повторяют клиентские 4xx ошибки.
4. [ ] Внешние провайдеры обернуты в Circuit Breaker (изоляция сбоев).
5. [ ] Запросы в фоновых воркерах обрабатываются через Transactional Outbox.
