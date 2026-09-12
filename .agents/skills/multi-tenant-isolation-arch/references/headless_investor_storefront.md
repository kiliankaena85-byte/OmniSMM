# Headless Investor Storefront Integration Protocol — Руководство разработчика

> **Стандарт:** OmniSMM 1.0 Headless Multi-Tenant Architecture  
> **Аудитория:** Внешние разработчики инвесторов, интеграторы, фронтенд-инженеры партнерских витрин.

---

## 1. Концепция и Архитектура

Платформа **OmniSMM 1.0** позволяет партнерам и инвесторам развертывать собственные брендированные витрины (Next.js, Nuxt, React SPA, Mobile Apps Flutter / React Native) и подключать их к нашему бэкенд-движку.

### Что обеспечивает OmniSMM для инвестора:
1. **Готовый каталог и исполнение заказов:** 900+ реальных услуг (Telegram, VK, YouTube, Instagram и др.) с автоматической маршрутизацией провайдерам, повторами, проверками и воркерами BullMQ.
2. **Изолированная база клиентов:** Пользователи, зарегистрированные через витрину инвестора, привязываются строго к его `tenantId`.
3. **Собственный эквайринг и касса (ст. 54.1 НК РФ):** Выручка поступает напрямую на счет инвестора (ЮKassa / Банк), чеки бьются по его онлайн-кассе 54-ФЗ.
4. **Индивидуальная ценовая политика:** Собственные наценки и тарифы, настраиваемые через административную панель.

---

## 2. Способы подключения внешнего фронтенда

### Вариант A: Client-Side SPA / Mobile App (через `X-Tenant-Id` + CORS)
Входящие запросы из браузера или приложения отправляются на API-шлюз OmniSMM:
- **Заголовок идентификации:** `X-Tenant-Id: <investor_slug>`
- **CORS:** Домен фронтенда инвестора (например, `https://investor-smm.com`) регистрируется в поле `customDomain` модели `Tenant`. Наш `proxy.ts` автоматически разрешает этот Origin.

### Вариант B: Server-Side Rendering (SSR Next.js / Node.js)
Входящие запросы от сервера инвестора авторизуются через защищенный сервисный токен:
- **Заголовок:** `Authorization: Bearer <tenant_service_key>`
- **Заголовок:** `X-Tenant-Id: <investor_slug>`

---

## 3. Спецификация REST API для фронтенда инвестора

Базовый URL: `https://api.smmplan.pro/api/v1/storefront` (или партнерский CNAME).

### 3.1. Получение каталога услуг с наценками тенанта
`GET /api/v1/storefront/catalog`
* **Headers:** `X-Tenant-Id: <slug>`
* **Query:** `?category=telegram` (опционально)
* **Response:**
```json
{
  "success": true,
  "tenant": "investor_alpha",
  "services": [
    {
      "id": "srv_123",
      "name": "Telegram Подписчики (Быстрые)",
      "platform": "telegram",
      "category": "subscribers",
      "pricePerUnitRub": 0.45,
      "minQty": 50,
      "maxQty": 50000,
      "dripfeed": true
    }
  ]
}
```

### 3.2. Регистрация и Авторизация клиента инвестора
`POST /api/v1/storefront/auth/register`
* **Body:** `{ "email": "user@investor.com", "password": "...", "tosAccepted": true }`
* **Behavior:** Создает пользователя в `User` со строгим `tenantId: "investor_alpha"`.
* **Response:** JWT сессионный токен с полезной нагрузкой `{ userId, tenantId: "investor_alpha" }`.

### 3.3. Создание заказа
`POST /api/v1/storefront/orders`
* **Headers:** `Authorization: Bearer <user_token>`, `X-Tenant-Id: <slug>`, `Idempotency-Key: <uuid>`
* **Body:**
```json
{
  "serviceId": "srv_123",
  "link": "https://t.me/channel",
  "quantity": 1000,
  "runs": 1,
  "interval": 0
}
```
* **Behavior:** 
  1. Проверяет баланс пользователя в рамках `tenantId`.
  2. Атомарно списывает копейки через `WalletOps.charge()`.
  3. Сохраняет задачу в `ProviderOutbox` со скоупом тенанта.

### 3.4. Создание платежа (Пополнение баланса)
`POST /api/v1/storefront/payments/create`
* **Headers:** `Authorization: Bearer <user_token>`, `X-Tenant-Id: <slug>`
* **Body:** `{ "amountRub": 1000, "gateway": "yookassa" }`
* **Behavior:**
  1. Извлекает `yookassaShopId` инвестора из `SystemSettings`.
  2. Генерирует платеж в ЮKassa с фискализацией по кассе инвестора.
  3. Возвращает ссылку на оплату `confirmation_url`.

---

## 4. Чек-лист безопасности для инвестора
1. **HTTPS Only:** Любой трафик между фронтендом и API обязан быть защищен TLS 1.3.
2. **Idempotency-Key:** Настоятельно рекомендуется передавать UUID при создании заказов и платежей для защиты от дублирования при обрывах связи.
3. **Хранение секретов:** Сервисный ключ `tenant_service_key` никогда не должен утекать в клиентский JavaScript-бандл.
