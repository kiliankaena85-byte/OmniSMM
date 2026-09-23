# SMMplan API v2

**Стандарт SMM-панели** — совместим с экосистемой автоматизации SMM-агентств (reseller-панели, боты, скрипты).

**Base URL:**
- `https://smmplan.pro/api/v2` (форм-данные `POST`)
- `https://smmflux.ru/api/v2` (форм-данные `POST`)

> **Все запросы** используют метод `POST` с `Content-Type: application/x-www-form-urlencoded`.

---

## Authentication

Передайте ваш API-ключ в теле каждого запроса:

```
key=smm_xxxxxxxxxxxxxxxxxxxxxxxx
```

Ключ начинается с `smm_` и выдаётся в личном кабинете → **Настройки → API**.

### Получение ключа

1. Зарегистрируйтесь на [smmplan.pro](https://smmplan.pro)
2. Перейдите: Профиль → Настройки → API-ключ
3. Нажмите «Создать ключ»

> ⚠️ Храните ключ в безопасности. Ключ связан с вашим балансом и историей заказов.

---

## Rate Limits

| Лимит | Значение |
|-------|----------|
| Запросов в минуту | 50 на ключ |
| Заказов в пакете (`add_multi`) | max 50 |
| Заказов в статусе (batch `status`) | max 100 |
| Максимальный размер запроса | 500 KB |

При превышении возвращается `HTTP 429`:
```json
{"error": "Too many requests. Limit 50/minute."}
```

---

## Endpoints (Actions)

Все actions передаются параметром `action=...` в теле POST-запроса.

### `action=balance` — Баланс

Возвращает текущий баланс аккаунта.

**Запрос:**
```bash
curl -X POST https://smmplan.pro/api/v2 \
  -d "key=smm_your_key&action=balance"
```

**Ответ:**
```json
{
  "balance": "1500.0000",
  "currency": "RUB"
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| `balance` | string | Баланс с 4 знаками после запятой |
| `currency` | string | Валюта (всегда `RUB`) |

---

### `action=services` — Список услуг

Возвращает каталог активных услуг.

**Запрос:**
```bash
curl -X POST https://smmplan.pro/api/v2 \
  -d "key=smm_your_key&action=services"
```

**Параметры:**
| Параметр | Тип | Обязательный | Описание |
|---------|-----|:---:|---------|
| `offset` | integer | Нет | Смещение пагинации (max 1000) |

**Ответ** (массив):
```json
[
  {
    "service": 1001,
    "name": "Telegram — Подписчики (Реальные)",
    "type": "Default",
    "category": "Telegram — Подписчики",
    "rate": "2.5000",
    "min": 100,
    "max": 100000,
    "dripfeed": false,
    "refill": false,
    "cancel": false
  }
]
```

| Поле | Тип | Описание |
|------|-----|----------|
| `service` | integer | Числовой ID услуги для заказа |
| `name` | string | Название услуги |
| `type` | string | Тип услуги (`Default`, `Drip Feed`) |
| `category` | string | Категория |
| `rate` | string | Цена за 1000 единиц в рублях |
| `min` | integer | Минимальное количество |
| `max` | integer | Максимальное количество |
| `dripfeed` | boolean | Поддержка Drip Feed |
| `refill` | boolean | Поддержка пополнения |
| `cancel` | boolean | Поддержка отмены |

---

### `action=add` — Создание заказа

**Запрос:**
```bash
curl -X POST https://smmplan.pro/api/v2 \
  -d "key=smm_your_key&action=add&service=1001&link=https://t.me/mychannel&quantity=1000"
```

**Параметры:**
| Параметр | Тип | Обязательный | Описание |
|---------|-----|:---:|---------|
| `service` | integer | ✅ | ID услуги из `action=services` |
| `link` | string | ✅ | Ссылка на объект (канал, пост, профиль) |
| `quantity` | integer | ✅ | Количество (в рамках min/max услуги) |
| `runs` | integer | Нет | Для Drip Feed: количество запусков |
| `interval` | integer | Нет | Для Drip Feed: интервал в минутах |

**Ответ (успех):**
```json
{"order": 98765}
```

**Ответ (ошибка):**
```json
{"error": "Not enough funds on balance"}
```

> При Drip Feed: `quantity` = количество **на один запуск**. Итоговое = `quantity × runs`.

---

### `action=add_multi` — Массовое создание заказов

Позволяет создать до **50 заказов** одним запросом.

**Запрос (JSON-массив):**
```bash
curl -X POST https://smmplan.pro/api/v2 \
  -d 'key=smm_your_key&action=add_multi&orders=[{"service":1001,"link":"https://t.me/chan1","quantity":500},{"service":1002,"link":"https://t.me/chan2","quantity":200}]'
```

**Запрос (form-urlencoded):**
```bash
curl -X POST https://smmplan.pro/api/v2 \
  -d "key=smm_your_key&action=add_multi&orders[0][service]=1001&orders[0][link]=https://t.me/chan1&orders[0][quantity]=500"
```

**Ответ** (массив, один элемент на каждый входной заказ):
```json
[
  {"order": 98765},
  {"error": "Not enough funds on balance"}
]
```

---

### `action=status` — Статус заказа(ов)

**Запрос (один заказ):**
```bash
curl -X POST https://smmplan.pro/api/v2 \
  -d "key=smm_your_key&action=status&order=98765"
```

**Запрос (несколько, через запятую, max 100):**
```bash
curl -X POST https://smmplan.pro/api/v2 \
  -d "key=smm_your_key&action=status&orders=98765,98766,98767"
```

**Ответ (один заказ):**
```json
{
  "charge": "2.5000",
  "start_count": "0",
  "status": "In progress",
  "remains": "750",
  "currency": "RUB"
}
```

**Ответ (несколько):**
```json
{
  "98765": {"charge": "2.5000", "start_count": "0", "status": "Completed", "remains": "0", "currency": "RUB"},
  "98766": {"error": "Incorrect order ID"}
}
```

**Статусы заказа:**
| Статус API | Описание |
|-----------|---------|
| `Pending` | Ожидает обработки |
| `In progress` | Выполняется |
| `Completed` | Завершён |
| `Partial` | Частично выполнен |
| `Canceled` | Отменён |
| `Fail` | Ошибка выполнения |

---

### `action=cancel` — Отмена заказа(ов)

Отмена доступна только для заказов в статусе `Pending` / `Awaiting Payment`.

**Запрос (один):**
```bash
curl -X POST https://smmplan.pro/api/v2 \
  -d "key=smm_your_key&action=cancel&order=98765"
```

**Запрос (несколько):**
```bash
curl -X POST https://smmplan.pro/api/v2 \
  -d "key=smm_your_key&action=cancel&orders=98765,98766"
```

**Ответ (один заказ, успех):**
```json
{"success": true, "message": "Cancelled and refunded"}
```

**Ответ (один заказ, ошибка):**
```json
{"error": "Cancellation via API is not supported. Contact support."}
```

---

### `action=refill` — Запрос на пополнение

> ℹ️ Автоматическое пополнение недоступно через API. Для запроса пополнения используйте тикет поддержки.

**Ответ:**
```json
{"error": "Refill is only available manually via support ticket for reseller platforms."}
```

---

### `action=refill_status` — Статус пополнения

**Запрос (одно):**
```bash
curl -X POST https://smmplan.pro/api/v2 \
  -d "key=smm_your_key&action=refill_status&refill=12345"
```

**Запрос (несколько):**
```bash
curl -X POST https://smmplan.pro/api/v2 \
  -d "key=smm_your_key&action=refill_status&refills=12345,12346"
```

**Ответ (одно):**
```json
{"status": "Completed"}
```

**Статусы пополнения:**
| Статус | Описание |
|--------|---------|
| `Pending` | Ожидает |
| `In progress` | Обрабатывается |
| `Completed` | Выполнено |
| `Rejected` | Отклонено |
| `Fail` | Ошибка |

---

## Error Codes

| HTTP | JSON error | Причина |
|------|-----------|---------|
| 400 | `API key is required` | Ключ не передан |
| 400 | `Incorrect request or API key` | Неверный ключ |
| 400 | `Incorrect action` | Неизвестное действие |
| 400 | `Incorrect parameters` | Неверные параметры заказа |
| 400 | `Incorrect service ID` | Услуга не найдена или не активна |
| 400 | `Quantity out of bounds` | Кол-во выходит за пределы min/max |
| 400 | `Not enough funds on balance` | Недостаточно средств |
| 400 | `Missing order parameter` | Не передан order/orders |
| 400 | `Incorrect order ID` | Заказ не найден или чужой |
| 400 | `Payload too large (max 500KB)` | Слишком большой запрос |
| 413 | `Payload too large (max 500KB)` | Превышен лимит размера |
| 429 | `Too many requests. Limit 50/minute.` | Превышен rate limit |
| 500 | `Internal server error` | Ошибка сервера |

---

## Совместимость

API совместим со стандартными SMM-панельными платформами. Если ваш сервис поддерживает стандарт SMM API v2 (например, JustAnotherPanel, SMMFollows), укажите:

- **API URL:** `https://smmplan.pro/api/v2`
- **API Key:** ваш ключ из личного кабинета
- **Формат ответа:** JSON (стандарт)

---

## Примеры на Python

```python
import requests

API_KEY = "smm_your_key_here"
BASE_URL = "https://smmplan.pro/api/v2"

def get_balance():
    r = requests.post(BASE_URL, data={"key": API_KEY, "action": "balance"})
    return r.json()

def get_services():
    r = requests.post(BASE_URL, data={"key": API_KEY, "action": "services"})
    return r.json()

def place_order(service_id: int, link: str, quantity: int):
    r = requests.post(BASE_URL, data={
        "key": API_KEY,
        "action": "add",
        "service": service_id,
        "link": link,
        "quantity": quantity
    })
    return r.json()

def check_status(order_id: int):
    r = requests.post(BASE_URL, data={
        "key": API_KEY,
        "action": "status",
        "order": order_id
    })
    return r.json()

# Пример использования
print(get_balance())
# {"balance": "1500.0000", "currency": "RUB"}

result = place_order(1001, "https://t.me/mychannel", 1000)
print(result)
# {"order": 98765}
```

---

## Changelog

| Версия | Дата | Изменения |
|--------|------|-----------|
| v2.0 | 2025-01 | Первая версия API |
| v2.1 | 2025-06 | Rate limiting, payload size limit, security fixes |
| v2.2 | 2026-01 | Batch cancel (`orders`), cross-tenant security audit |
