# Аудит интеграционного Panel API v2 (PerfectPanel / SmartPanel Compatible)

**Дата аудита**: 29 июля 2026 г.  
**Объект исследования**: API эндпоинт `POST /api/v2` (`src/app/api/v2/route.ts`), схемы аутентификации (`src/lib/api-auth.ts`), форматирование каталога (`src/services/marketing.service.ts`), финансовый слой списания (`src/services/core/order.service.ts`).  
**Статус аудита**: ✅ Завершено.

---

## 1. Executive Summary

В рамках аудита проведен всесторонний анализ Panel API v2 проекта SMMplan, проектируемого как внешняя точки интеграции для автоматического подключения сторонних SMM-панелей (согласно отраслевому стандарту PerfectPanel / SmartPanel / JustAnotherPanel API v2). Исследование показало высочайшую степень финансовой и мультитенентной защищённости бэкенда: списание баланса реселлера производится атомарно внутри `Serializable` транзакций СУБД с защитой от гонок (Race Conditions) и мгновенным откатом при нехватке средств, API-ключи хранятся исключительно в виде SHA-256 хэшей, а кросс-тенентный доступ между `smmplan` и `smmflux` моментально пресекается с фиксацией инцидентов `CRITICAL` уровня в `SecurityEvent`.

Вместе с тем выявлено 4 ключевых отклонения от международного стандарта PerfectPanel API v2 во внешнем контракте ответов. Главные несоответствия включают: возвращение полей `min` и `max` в виде строк (вместо целых чисел), возвращение кастомной структуры `{ "success": true, "message": "..." }` при отмене заказов (`action=cancel`) вместо канонического `{ "cancel": true }` или `{ "cancel": 1 }`, использование нетипового статуса `"Fail"` при ошибке заказа (вместо стандартного `"Canceled"`), а также отсутствие таблицы полнотекстового логирования API-запросов (`api_request_log`) для арбитража споров с реселлерами.

---

## 2. Инвентаризация Panel API v2 (`POST /api/v2`)

| Action | Внутренний Handler | Валидация входных данных | Формат успешного ответа | HTTP Status |
|---|---|---|---|---|
| `services` | `handleServices()` | `offset` (min 0, max 1000) | JSON Array объектов с услугами реселлера | `200 OK` |
| `add` | `handleAdd()` | Zod `addSchema` (service, link, quantity, runs, interval) | `{ "order": 12345 }` (numericId, integer) | `200 OK` |
| `add_multi` | `handleAddMulti()` | JSON Array / form-encoded `orders[i]`, max 50 шт. | `[{ "order": 12345 }, { "error": "..." }]` | `200 OK` |
| `status` | `handleStatus()` | Single (`order`) или Multiple (`orders`, max 100) | Single: `{ charge, start_count, status, remains, currency }`<br>Multi: `{ "123": { ... }, "124": { ... } }` | `200 OK` |
| `balance` | `handleBalance()` | Только валидный `key` | `{ "balance": "150.0000", "currency": "RUB" }` | `200 OK` |
| `refill` | `handleRefill()` | `order` (int) | `{ "error": "Refill is only available manually..." }` | `400 Bad Request` |
| `refill_status` | `handleRefillStatus()` | Single (`refill`) или Multiple (`refills`, max 100) | Single: `{ status: "Completed" }`<br>Multi: `[{ refill: 1, status: "Completed" }]` | `200 OK` |
| `cancel` | `handleCancel()` | Single (`order`) или Multiple (`orders`, max 100) | Single: `{ "success": true, "message": "..." }`<br>Multi: `{ "123": "Cancelled and refunded" }` | `200 OK` / `400` |

---

## 3. Матрица совместимости со стандартом PerfectPanel API v2

| Action / Поле | Спецификация PerfectPanel | Реализация в SMMplan | Статус | Комментарий |
|---|---|---|---|---|
| **HTTP Method** | `POST` only (GET -> 405) | `POST` route handler (Next.js App Router) | ✅ **100%** | Вызов `GET` на `/api/v2` нативно отлонится с `405 Method Not Allowed`. |
| **Content-Type** | `application/x-www-form-urlencoded` | `request.formData()` | ✅ **100%** | Дополнительно установлена защита от DoS (`Content-Length` > 500KB -> `413`). |
| **Auth Error** | `{ "error": "Incorrect request or API key" }` | `{ "error": "Incorrect request or API key" }` (HTTP 401) | ✅ **100%** | Текст ошибки точно совпадает со стандартом. |
| **`services.service`** | `integer` | `integer` (`s.numericId`) | ✅ **100%** | Уникальный цифровой ID услуги. |
| **`services.rate`** | `string` (4 decimals) | `string` (`finalRatePer1000.toFixed(4)`) | ✅ **100%** | Цена за 1000 штук с учётом персональной скидки реселлера. |
| **`services.min`** | `integer` или `string` | `string` (`s.minQty.toString()`) | ⚠️ **Отклонение** | Стандарт PerfectPanel ожидает число `100`. Рекомендуется привести к `integer`. |
| **`services.max`** | `integer` или `string` | `string` (`s.maxQty.toString()`) | ⚠️ **Отклонение** | Стандарт PerfectPanel ожидает число `10000`. Рекомендуется привести к `integer`. |
| **`services.type`** | `string` (`"Default"`, `"Custom Comments"`) | `"Default"` | ✅ **100%** | Совпадает. |
| **`services.refill`** | `boolean` | `boolean` (`s.isRefillEnabled`) | ✅ **100%** | `true` / `false`. |
| **`services.cancel`** | `boolean` | `boolean` (`s.isCancelEnabled`) | ✅ **100%** | `true` / `false`. |
| **`add.order`** | `{ "order": 12345 }` (integer) | `{ "order": createdOrder.numericId }` (integer) | ✅ **100%** | Формат совпадает. |
| **`add.dripfeed`** | `quantity` = кол-во за 1 запуск | `totalQuantity = quantity * runs` | ✅ **100%** | Реселлер присылает разовый qty, SMMplan корректно умножает на runs. |
| **`status.charge`** | `string` (4 decimals) | `string` (`(charge/100).toFixed(4)`) | ✅ **100%** | Формат совпадает. |
| **`status.start_count`**| `string` | `"0"` (hardcoded) | ⚠️ **Заглушка** | На бэкенде пока не сохраняется стартовый счетчик до и после старта. |
| **`status.status`** | `"Pending"`, `"In progress"`, `"Completed"`, `"Partial"`, `"Canceled"` | `"Pending"`, `"In progress"`, `"Completed"`, `"Partial"`, `"Canceled"`, `"Fail"` | ⚠️ **Отклонение** | Внутренний статус `ERROR` мапится в `"Fail"`. В PerfectPanel используется `"Canceled"`. |
| **`balance.balance`** | `string` (4 decimals) | `string` (`(balance/100).toFixed(4)`) | ✅ **100%** | Формат совпадает. |
| **`balance.currency`**| `string` (e.g. `"USD"`, `"RUB"`) | `"RUB"` | ✅ **100%** | Возвращается текущая валюта панели. |
| **`cancel` response** | `{ "cancel": true }` или `{ "123": { "cancel": 1 } }` | `{ "success": true, "message": "Cancelled..." }` | ❌ **Несовместимо** | Кастомный формат ответа, который не распарсится сторонними SMM-панелями! |

---

## 4. Детальные находки аудита

### 4.1. Формат ответа при отмене заказа (`action=cancel`) не соответствует спецификации
- **Severity**: 🔴 Critical / P0 (API Совместимость)
- **Scope Section**: 2 (Совместимость со стандартом PerfectPanel / SmartPanel)
- **Координаты кода**: `src/app/api/v2/route.ts:454-464`
- **Анализ**: 
  При выполнении одиночного запроса `action=cancel&order=12345` код SMMplan возвращает:
  ```json
  { "success": true, "message": "Cancelled and refunded" }
  ```
  Однако стандартные API софты реселлеров (JustAnotherPanel, PerfectPanel, SmartPanel) ожидают строго следующий JSON:
  ```json
  { "cancel": true }
  ```
  Или при ошибке отмены:
  ```json
  { "error": "Cancellation via API is not supported. Contact support." }
  ```
  Текущий кастомный ответ `{ "success": true, ... }` вызывает ошибку парсинга на стороне внешней SMM-панели реселлера.
- **Влияние**: Реселлеры не могут автоматизировать отмену заказов через Panel API.
- **Рекомендация**: Привести ответ к каноническому виду:
  ```typescript
  if (!formData.get('orders') && ids.length === 1) {
    const resultMsg = resultMap[ids[0].toString()];
    if (resultMsg === 'Cancelled and refunded') {
      return NextResponse.json({ cancel: true });
    }
    return NextResponse.json({ error: resultMsg }, { status: 400 });
  }
  ```

---

### 4.2. Использование нетипового статуса `"Fail"` вместо `"Canceled"` в `action=status`
- **Severity**: 🟠 High / P1 (API Совместимость)
- **Scope Section**: 2 (Совместимость status)
- **Координаты кода**: `src/app/api/v2/route.ts:15-26`
- **Анализ**: 
  В функции маппинга статусов `mapInternalStatus`:
  ```typescript
  const statusMap: Record<string, string> = {
    'AWAITING_PAYMENT': 'Pending',
    'PENDING': 'Pending',
    'IN_PROGRESS': 'In progress',
    'COMPLETED': 'Completed',
    'PARTIAL': 'Partial',
    'CANCELED': 'Canceled',
    'ERROR': 'Fail' // <-- НЕСТАНДАРТНЫЙ СТАТУС
  };
  ```
  В стандарте API v2 PerfectPanel/SmartPanel разрешёнными статусами заказа являются строго: `Pending`, `Processing`, `In progress`, `Completed`, `Partial`, `Canceled`. Статуса `"Fail"` в спецификации нет. Внешняя панель реселлера при получении `"Fail"` либо зависает в статусе `In progress`, либо выдаёт ошибку парсинга.
- **Влияние**: Невозможность корректной синхронизации статуса забракованных провайдером заказов на стороне реселлера.
- **Рекомендация**: Заменить `'ERROR': 'Fail'` на `'ERROR': 'Canceled'` (поскольку при статусе ERROR на бэкенде SMMplan клиенту всегда производится 100% авто-возврат средств).

---

### 4.3. Типы полей `min` и `max` в каталоге `action=services` возвращаются строками
- **Severity**: 🟡 Medium / P2 (Совместимость типов)
- **Scope Section**: 2 (Совместимость services)
- **Координаты кода**: `src/services/marketing.service.ts:232-233`
- **Анализ**: 
  В методе `getAPIFormattedServices`:
  ```typescript
  min: s.minQty.toString(),
  max: s.maxQty.toString(),
  ```
  Поля приводятся к строке (`"100"`, `"10000"`). По стандарту PerfectPanel полем `rate` является строка с 4 знаками (`"1.5000"`), а `min`, `max` и `service` должны быть целыми числами (`100`, `10000`). Хотя большинство современный библиотек парсинга умеет приводить типы, строгие клиенты на Golang/Rust/C# падают с ошибкой раскодирования типа `int` from `string`.
- **Влияние**: Потенциальные конфликты строгой типизации у ряда реселлеров.
- **Рекомендация**: Изменить форматирование на целые числа:
  ```typescript
  min: s.minQty,
  max: s.maxQty,
  ```

---

### 4.4. Отсутствие таблицы `api_request_log` для аудита API-трафика и разрешения финансовых споров
- **Severity**: 🟡 Medium / P2 (Аудит и Наблюдаемость)
- **Scope Section**: 8 (Логирование и аудит)
- **Координаты кода**: `src/app/api/v2/route.ts:40-102`
- **Анализ**: 
  В `POST /api/v2` при невалидных действиях или кросс-тенентных попытках пишется запись в `db.securityEvent`. Однако подробные входящие данные и ответы (body payload, action, IP, duration, HTTP response code) для успешных операций `add` / `cancel` / `balance` никуда асинхронно не сохраняются.
  При возникновении финансовых споров с реселлером ("Мы отправляли заказ #555, с вашего баланса списалось, а у вас его нет") операторам придется искать логи в консоли Nginx/Docker.
- **Влияние**: Сложность разбора спорных инцидентов и биллинга реселлеров.
- **Рекомендация**: Добавить неблокирующую асинхронную запись лога API-запроса вRedis/СУБД или специализированную таблицу `api_request_log`.

---

## 5. Матрица покрытия Scope (10 пунктов)

| # | Пункт аудита (Scope Area) | Статус | Комментарий / Координаты |
|---|---|---|---|
| 1 | **Инвентаризация и маршрутизация** | ✅ **100%** | `POST /api/v2/route.ts`. Только `POST`, `GET` даёт 405. Лимит тела 500KB. |
| 2 | **Совместимость со стандартом** | ⚠️ **Частично** | Нарушены контракты `cancel` (P0), `ERROR status` (P1) и `min/max` types (P2). |
| 3 | **Аутентификация и авторизация** | ✅ **100%** | SHA-256 хэширование ключей (`api-auth.ts:10`), проверка `key` до выполнения action. |
| 4 | **Rate Limiting & Anti-Abuse** | ✅ **100%** | Redis-лимитер по SHA-256 хэшу ключа (50 req/min). Лимит пакета `add_multi` до 50 шт. |
| 5 | **Списание баланса и финансовая логика** | ✅ **100%** | `runSerializableTransaction` + `WalletOps`. Идемпотентность и защита от гонок. |
| 6 | **Обработка ошибок провайдера** | ✅ **100%** | Реселлер не видит стек-трейсы или имена провайдеров. При сбое — авто-refund. |
| 7 | **Callback / Webhook уведомления** | ℹ️ **Н/Д** | Webhook-уведомления об изменении статуса для API реселлеров пока не предусмотрены. |
| 8 | **Логирование и аудит** | ⚠️ **Частично** | Фиксируются только `securityEvent` (P0/P1), отсутствует полный API audit trail log. |
| 9 | **Безопасность (SSRF, IDOR, SQLi)** | ✅ **100%** | Кросс-тенентная защита по `userTenantId`, Zod-валидация, отсутствие raw SQL. |
| 10 | **Документация и DX** | ✅ **100%** | Присутствует полный маппинг ошибок и типов параметров. |

---

## 6. Remediation Roadmap (План исправления)

### Приоритет P0 (Исправить немедленно до подключения реселлеров):
1. **Канонический ответ `action=cancel`**: В `src/app/api/v2/route.ts` изменить возвращаемый объект при отмене одиночного заказа с `{ "success": true, "message": "..." }` на `{ "cancel": true }`.

### Приоритет P1 (Высокий приоритет):
2. **Исправление маппинга статуса `ERROR`**: В `mapInternalStatus()` заменить `'ERROR': 'Fail'` на `'ERROR': 'Canceled'`, чтобы сторонние панели корректно обрабатывали отменённые заказы.

### Приоритет P2 (Средний приоритет):
3. **Числовые типы для `min`/`max` в каталоге**: В `src/services/marketing.service.ts` передавать `minQty` и `maxQty` целыми числами без вызова `.toString()`.
4. **API Audit Trail Logging**: Добавить сохранение метаданных API-запросов (user, action, status, latency) для арбитража споров.
