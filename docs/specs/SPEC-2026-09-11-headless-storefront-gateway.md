# SPEC-2026-09-11: Headless Storefront Gateway (Витрины инвесторов N-Tenants)

## 1. Контекст и бизнес-цели

Платформа **OmniSMM 1.0** расширяет свою мульти-тенантную экосистему архитектурой **Headless Storefront Gateway (Storefront API v1)**.
Данная подсистема позволяет внешним инвесторам и партнерам запускать собственные брендированные витрины и клиентские приложения:
- Собственные веб-витрины (Next.js, Nuxt, SvelteKit, Astro, Shopify/WooCommerce плагины).
- Мобильные приложения (iOS / Android на Flutter или React Native).
- Telegram Mini Apps (TMA) и Telegram Web Apps ботов.
- Закрытые VIP-клубы и Panel APIы с индивидуальной ценовой политикой.

Storefront Gateway проектируется как **чистый REST/JSON API**, изолированный от устаревшего SMM Panel API v2 (`application/x-www-form-urlencoded`), с криптографической аутентификацией, автоматическим скоупингом через **Prisma Tenant Enforcer** (`AsyncLocalStorage`), защитой от утечек данных поставщиков (Information Disclosure) и юридическим барьером по ст. 54.1 НК РФ.

---

## 2. Архитектурные требования и инварианты

### 2.1. Изоляция тенантов и BOLA/IDOR Immunity
1. **Принцип нулевого доверия к клиентским идентификаторам:** Идентификатор тенанта никогда не принимается как доверенный параметр в теле запроса или строке URL (`?tenantId=...`).
2. **Строгая аутентификация через Storefront Keys:**
   - `X-Storefront-Key` (или `Authorization: Bearer <key>`):
     * `pk_live_<hash>` (Publishable Key): Публичный ключ для браузерных и мобильных витрин. Разрешает безопасные операции чтения (`GET /config`, `GET /catalog`, чтение статуса заказа по номеру и проверочному email).
     * `sk_live_<hash>` (Secret Key): Секретный серверный ключ инвестора. Разрешает создание заказов, управление балансом инвестора, настройку вебхуков.
   - Fallback на доменную привязку: Запрос с кастомного домена инвестора (`investor-store.ru`), зарегистрированного в `Tenant.customDomain`, автоматически связывается с соответствующим тенантом.
3. **Автоматический скоупинг в ядре:** Каждый запрос к Storefront Gateway исполняется внутри блока `runWithTenant(tenant.slug, async () => { ... })`, где Prisma Tenant Enforcer гарантирует, что запросы к БД физически не могут выйти за рамки тенанта инвестора.

### 2.2. Защита конфиденциальных данных (Zero Vendor Leaks)
В ответах Storefront Gateway **СТРОГО ЗАПРЕЩЕНО** возвращать:
- Имена и ID внешних поставщиков (`providerId`, `providerServiceId`, Vexboost, SMMtoolbox и др.).
- Себестоимость услуг (`providerCost`, `providerCostCents`).
- Внутренние технические логи и ошибки провайдеров (`error`, `stack`).
- Данные других тенантов платформы.

### 2.3. Ценообразование и наценки витрины
- Инвестор задает базовую валюту витрины (`currency`: RUB, USD, EUR, KZT) и глобальную либо категорийную наценку (`markupPercent`).
- Все денежные расчеты ведутся строго через `ExactMath` в целочисленных копейках/центах (`BigInt`) с правилом банковского округления (Half-Even).

### 2.4. Безопасность и Rate Limiting (OWASP Top 10 & RFC 9331)
- Лимит частоты запросов: до 120 запросов в минуту на один `StorefrontKey` с хранением состояния в Redis (`RateLimitService`).
- RFC 9331 заголовки: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, `RateLimit-Policy`.
- Валидация всех входящих DTO через строгие схемы Zod с защитой от DoS (ограничение размера тела запроса <= 256 КБ).

---

## 3. Спецификация контрактов Storefront API v1

Базовый путь: `/api/storefront/v1`

### 3.1. `GET /api/storefront/v1/config`
Возвращает публичную конфигурацию витрины инвестора для фронтенда.
- **Аутентификация:** `pk_live_*`, `sk_live_*` или Host domain.
- **Ответ 200 OK:**
```json
{
  "success": true,
  "data": {
    "tenantId": "investor_alpha",
    "brandName": "Alpha SMM",
    "siteDescription": "Премиальное продвижение в соцсетях",
    "currency": "RUB",
    "supportContact": "@alpha_support",
    "legalEntity": "ИП Иванов И.И., ОГРНИП 321...",
    "features": {
      "dripFeedEnabled": true,
      "smartDripEnabled": true,
      "promoCodesEnabled": true
    },
    "paymentMethods": [
      { "id": "card_rub", "name": "Банковская карта (РФ)", "minAmountRub": 10 },
      { "id": "sbp", "name": "СБП (Система быстрых платежей)", "minAmountRub": 10 },
      { "id": "crypto", "name": "Криптовалюта (USDT, TON, BTC)", "minAmountRub": 100 }
    ]
  }
}
```

### 3.2. `GET /api/storefront/v1/catalog`
Возвращает каталог доступных на витрине услуг, сгруппированных по категориям и социальным сетям.
- **Аутентификация:** `pk_live_*`, `sk_live_*` или Host domain.
- **Query-параметры:**
  * `category` (string, optional) - фильтр по слагу категории.
  * `targetType` (string, optional) - фильтр по типу цели.
- **Ответ 200 OK:**
```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "id": "cat_tg_subs",
        "name": "Telegram Подписчики",
        "slug": "telegram-subscribers",
        "icon": "telegram",
        "network": "TELEGRAM",
        "services": [
          {
            "id": "srv_101",
            "name": "Живые подписчики РФ (Без отписок)",
            "description": "Плавный старт, высокое качество, гарантия 30 дней.",
            "minQuantity": 50,
            "maxQuantity": 50000,
            "pricePerUnitRub": 0.45,
            "pricePer1000Rub": 450.0,
            "dripFeedSupported": true,
            "targetType": "CHANNEL"
          }
        ]
      }
    ]
  }
}
```

### 3.3. `POST /api/storefront/v1/orders`
Оформление нового заказа клиентом или сервером инвестора.
- **Аутентификация:** `sk_live_*` (серверная витрина) или `pk_live_*` (клиентская витрина с переходом на оплату).
- **Request Body (JSON):**
```json
{
  "serviceId": "srv_101",
  "link": "https://t.me/my_channel",
  "quantity": 500,
  "runs": 1,
  "interval": 0,
  "email": "customer@example.com",
  "idempotencyKey": "ord_req_987654321",
  "promoCode": "WELCOME10"
}
```
- **Ответ 201 Created:**
```json
{
  "success": true,
  "data": {
    "orderId": "cly1234567890",
    "numericId": 14022,
    "status": "PENDING",
    "serviceName": "Живые подписчики РФ (Без отписок)",
    "link": "https://t.me/my_channel",
    "quantity": 500,
    "totalRub": 202.50,
    "paymentRequired": true,
    "paymentUrl": "https://smmplan.pro/payment-redirect?id=pay_998877",
    "createdAt": "2026-09-11T12:00:00.000Z"
  }
}
```

### 3.4. `GET /api/storefront/v1/orders/:id`
Проверка статуса заказа.
- **Аутентификация:** `sk_live_*` или `pk_live_*` (с обязательным query-параметром `?email=...` для защиты от перечисления ID).
- **Ответ 200 OK:**
```json
{
  "success": true,
  "data": {
    "orderId": "cly1234567890",
    "numericId": 14022,
    "status": "IN_PROGRESS",
    "serviceName": "Живые подписчики РФ (Без отписок)",
    "link": "https://t.me/my_channel",
    "quantity": 500,
    "remains": 120,
    "startCount": 1050,
    "createdAt": "2026-09-11T12:00:00.000Z",
    "updatedAt": "2026-09-11T12:15:00.000Z"
  }
}
```

---

## 4. Схема данных и сервис аутентификации витрин

### 4.1. Разрешение контекста витрины (`src/lib/storefront/storefront-auth.ts`)
1. Читает `X-Storefront-Key` (или `Authorization: Bearer <key>`) из заголовков.
2. Валидирует формат (`pk_live_*` или `sk_live_*`).
3. Сопоставляет ключ с тенантом инвестора (через `Tenant` / `SystemSettings` конфигурацию).
4. Проверяет активность тенанта (`tenant.isActive`).
5. Возвращает контекст `StorefrontContext`:
```typescript
export interface StorefrontContext {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  keyType: 'publishable' | 'secret';
  rateLimit: number;
}
```

---

## 5. Премортем-анализ рисков (Failure Simulation)

| Сценарий отказа | Вероятность x Влияние | Механизм защиты в коде |
| :--- | :---: | :--- |
| **1. IDOR через Storefront API (Инвестор А запрашивает заказ инвестора Б)** | **Высокая (4/5)** x **Критическое (5/5)** = **20/25** | Все вызовы БД исполняются строго внутри `runWithTenant(ctx.tenantSlug)`. Prisma Tenant Enforcer автоматически подмешивает `tenantId` в `findFirst` и `findMany`. Попытка доступа к чужому заказу возвращает 404 Not Found. |
| **2. Утечка себестоимости или имени провайдера (Information Leak)** | **Средняя (3/5)** x **Высокое (4/5)** = **12/25** | Строгий маппинг в DTO через Zod/мапперы без передачи исходной модели Prisma наружу. Поля `providerCost`, `providerId`, `externalId` физически не включены в Storefront DTO. |
| **3. DoS-атака или перебор статусов заказов через публичный API** | **Средняя (3/5)** x **Среднее (3/5)** = **9/25** | Per-Key Token Bucket Rate Limiting в Redis (120 req/min). При использовании `pk_live_*` проверка статуса требует обязательного совпадения `email` заказчика. |
| **4. Отрицательный или некорректный объем заказа (Drip-Feed Floor)** | **Средняя (3/5)** x **Высокое (4/5)** = **12/25** | Zod-валидация Drip-Feed Floor Invariant (floor(Q/N) >= minQty) и проверка соответствия ссылки выбранной категории через `IntelligenceLinkAnalyzer`. |

---

## 6. План верификации (TDD & Maker-Checker)

1. **Maker-Checker аудит спецификации:**
   Запуск независимого аудитора через OpenRouter Free Tier (`scripts/verify-storefront-spec.ts` с моделью `cohere/north-mini-code:free`).
2. **Red Phase (Написание тестов до реализации кода):**
   `src/__tests__/storefront/storefront-gateway.test.ts`:
   - Тест аутентификации по `pk_live_*` и `sk_live_*`.
   - Тест отсечения невалидных/чужих ключей.
   - Тест изоляции каталога тенанта (услуги тенанта A не видны в тенанте B).
   - Тест BOLA/IDOR (попытка получить заказ другого тенанта возвращает 404).
   - Тест отсутствия полей `providerId` и `providerCost` в ответах.
   - Тест Rate Limiting (RFC 9331 заголовки).
3. **Green Phase (Реализация роутов и сервисов):**
   - `src/lib/storefront/storefront-auth.ts`
   - `src/lib/storefront/storefront-dto.ts`
   - `src/app/api/storefront/v1/config/route.ts`
   - `src/app/api/storefront/v1/catalog/route.ts`
   - `src/app/api/storefront/v1/orders/route.ts`
   - `src/app/api/storefront/v1/orders/[id]/route.ts`
4. **Компиляция и линтеры:**
   - `npx tsc --noEmit` -> 0 ошибок.
   - `node scripts/check-bundle-secrets.mjs` -> 0 утечек.
