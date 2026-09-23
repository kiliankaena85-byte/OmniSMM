# SPEC-2026-09-11: Multi-Tenant Isolation Architecture & Headless Investor Storefront Protocol

> **Статус:** APPROVED & IN EXECUTION  
> **Версия спецификации:** 1.1.0  
> **Целевой стандарт:** SDD-TDD 2026, OWASP Top 10:2026 (A01: Broken Access Control / IDOR / BOLA), ст. 54.1 НК РФ, 54-ФЗ, 425-ФЗ (НДС 22%), Headless Storefront Architecture.  
> **Затрагиваемые компоненты:** `.agents/skills/multi-tenant-isolation-arch/*`, `scripts/lint-tenant-isolation.ts`, `src/__tests__/architecture/tenant-isolation-ast.test.ts`, `package.json`.

---

## 1. Контекст и Проблематика

Материнская платформа **OmniSMM 1.0** спроектирована как высокопроизводительное многоарендное (Multi-Tenant) ядро. Платформа обслуживает:
1. **SMMplan (`smmplan.pro`):** Classic Panel API для оптовых заказчиков и реселлеров.
2. **SMMflux (`smmflux.ru`):** Витрина в стиле Radiant Aurora для розничных создателей контента.
3. **N-Tenants Scaling & Investor Headless Storefronts:** Подключение произвольного числа партнерских сайтов и внешних фронтендов инвесторов (Next.js, React, Vue, Flutter, iOS/Android) с собственной брендированной витриной, индивидуальными ценами, личными клиентами и независимым эквайрингом.

### Критические требования надежности:
- **Zero Cross-Tenant Data Leak (BOLA/IDOR):** Ни при каких условиях клиенты инвестора или SMMplan не должны видеть или модифицировать чужие заказы, балансы, платежи или тикеты.
- **Headless Storefront Integration (Investor Ready):** Внешний фронтенд инвестора должен подключаться по открытому API-протоколу с поддержкой динамического CORS и аутентификации через `X-Tenant-Key` / `X-Tenant-Id`.
- **Zero Brand Bleeding & Zero Brand Ghosting:** Изоляция кэша каталога (`catalog-${tenantId}`) и полное искоренение фантомных брендов (`Lovable`, `SMMboost`).
- **Юридический барьер (ст. 54.1 НК РФ):** Разделение юрлиц, счетов, эквайринга (Shop ID ЮKassa инвестора) и онлайн-касс по 54-ФЗ для предотвращения рисков «дробления бизнеса».

---

## 2. Headless Investor Storefront Integration Protocol (N-Tenants)

### 2.1. Схема взаимодействия внешнего фронтенда с ядром OmniSMM 1.0

```
┌────────────────────────────────────────────────────────┐
│        Кастомный Фронтенд Инвестора (Storefront)        │
│        (например, https://investor-smm.com)            │
└──────────────────────────┬─────────────────────────────┘
                           │
              HTTPS + Header: X-Tenant-Key / X-Tenant-Id
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│        OmniSMM 1.0 Edge Proxy & Gateway (src/proxy.ts)  │
│  1. Dynamic CORS: Origin https://investor-smm.com       │
│  2. Tenant Resolution: Slug "investor"                 │
│  3. Rate Limiting: 120 req/min per IP / Token Bucket   │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│           Headless Storefront Public API               │
│  - GET  /api/v1/storefront/catalog (цены инвестора)    │
│  - POST /api/v1/storefront/orders  (создание заказа)   │
│  - GET  /api/v1/storefront/orders/:id (статус)         │
│  - POST /api/v1/storefront/payments (касса инвестора)  │
│  - POST /api/v1/storefront/auth/register (клиенты)     │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│       Multi-Tenant Isolation Core (PostgreSQL)         │
│   WHERE tenantId = 'investor' (Полная изоляция!)       │
│   - Пользователи инвестора не видят пользователей API │
│   - Выручка идет на расчетный счет инвестора (54.1 НК) │
└────────────────────────────────────────────────────────┘
```

### 2.2. Архитектура онбординга нового сайта инвестора
1. **Запись в PostgreSQL `model Tenant`:**
   - `id`: CUID.
   - `slug`: уникальный идентификатор (`investor_alpha`).
   - `domain`: первичный хост (`investor-smm.com`).
   - `customDomain`: дополнительный домен (например, `app.investor-smm.com`).
   - `isActive`: флаг активности.
2. **Запись в `model SystemSettings` (Изоляция по ст. 54.1 НК РФ):**
   - Собственные реквизиты инвестора (ИНН, ОГРНИП, юридический адрес).
   - Индивидуальный `yookassaShopId` и `yookassaSecretKey` инвестора.
   - Настройки наценки (`globalMarkup`) и порог карантина цен.
3. **Регистрация в runtime-реестре тенантов:**
   - Функция `registerValidTenant(slug)` динамически добавляет новый слаг в `VALID_TENANTS`.
   - Внешний фронтенд может отправлять запросы без пересборки Docker-контейнеров.

---

## 3. Архитектура и Правила AST-Линтера (`scripts/lint-tenant-isolation.ts`)

Движок анализа реализуется на нативном TypeScript Compiler API (`ts.createSourceFile`) для обеспечения субсекундной скорости проверки (< 2 сек.) без внешних бинарных зависимостей.

### 3.1. Каталог Tenant-Scoped моделей
В схеме Prisma моделями со строгим скоупом арендатора признаются:
- `Order`
- `User`
- `Payment`
- `Ticket`
- `Service`
- `Category`
- `LedgerEntry`
- `Invoice`
- `CustomerGroup`
- `TicketFeedback`
- `AuditLog`
- `PromoCode`

### 3.2. Правило 1: `tenant-where-clause-required` (BLOCKER)
При вызове методов Prisma Client (`db.<model>.<method>` или `tx.<model>.<method>`):
- **Целевые методы:** `findMany`, `findFirst`, `findUnique`, `count`, `update`, `updateMany`, `delete`, `deleteMany`, `aggregate`, `groupBy`.
- **Инвариант:** Аргумент запроса ОБЯЗАН содержать блок `where`, включающий свойство `tenantId` (либо составное условие, либо вызов через расширенный клиент `getTenantScopedDb(tenantId)`).
- **Исключения:** Вызовы внутри системных сервисов (cron, фоновый Outbox Poller, миграторы), помеченные директивой:
  ```typescript
  // tenant-isolation-ignore: <понятное обоснование>
  ```

### 3.3. Правило 2: `tenant-cache-key-required` (MAJOR)
При использовании функции Next.js `unstable_cache`:
- **Инвариант:** Массив ключей кэша (второй аргумент) ОБЯЗАН содержать переменную `tenantId` (или `cleanTenant`).
- **Инвариант тегов:** Массив тегов в опциях ОБЯЗАН содержать динамический тег с интерполяцией тенанта (например, `` `catalog-${tenantId}` ``).

### 3.4. Правило 3: `no-phantom-brand-ghosting` (BLOCKER)
- **Инвариант:** Запрещено использование строковых литералов `'lovable'` или `'smmboost'` (в любом регистре) в исходном коде компонентов, страниц, Server Actions и API.
- **Единственное исключение:** Функция `normalizeTenantId` в `src/lib/tenant.ts` / `src/lib/tenant-resolver-edge.ts`, поддерживающая исторический алиас для обратной совместимости.

### 3.5. Правило 4: `fiscal-context-per-tenant` (MAJOR)
- **Инвариант:** Платежные функции и обработчики пополнения обязаны получать параметры эквайринга строго через `getTenantPaymentContext(tenantId)`, запрещая хардкод единых `process.env.YOOKASSA_SHOP_ID` в межтенантном коде.

### 3.6. Правило 5: `dynamic-tenant-parameterization` (WARNING)
- **Инвариант:** Общая бизнес-логика не должна содержать жестких проверок вида `tenantId === 'smmplan'`, которые ломают поддержку произвольных тенантов инвесторов ($N$-Tenants). Ветвление должно строиться на основе конфигурации тенанта (`getTenantConfig(tenantId)` или `systemSettings`).

---

## 4. Матрица верификации (TDD Acceptance Criteria)

| ID | Тестовый сценарий | Ожидаемый результат |
| :--- | :--- | :--- |
| **TC-01** | Анализ Prisma `order.findMany({ where: { status: 'PENDING' } })` без `tenantId` | Детекция нарушения `tenant-where-clause-required` с уровнем BLOCKER |
| **TC-02** | Анализ Prisma `order.findMany({ where: { status: 'PENDING', tenantId } })` | 0 нарушений (PASS) |
| **TC-03** | Запрос с директивой `// tenant-isolation-ignore: cron worker processing` | 0 нарушений (Игнор подтвержден) |
| **TC-04** | Анализ `unstable_cache` с ключом `['catalog']` без `tenantId` | Детекция нарушения `tenant-cache-key-required` с уровнем MAJOR |
| **TC-05** | Анализ кода, содержащего литерал `'lovable'` в UI-компоненте | Детекция нарушения `no-phantom-brand-ghosting` с уровнем BLOCKER |
| **TC-06** | Поддержка N-тенантов: вызов `registerValidTenant('investor_brand')` и валидация через `normalizeTenantId` | Валидация успешна, возвращает `'investor_brand'` вместо дефолтного `'smmplan'` |
| **TC-07** | Прогон полного сканера по `src/` | 0 непроверенных нарушений, вывод структурированного отчета |
