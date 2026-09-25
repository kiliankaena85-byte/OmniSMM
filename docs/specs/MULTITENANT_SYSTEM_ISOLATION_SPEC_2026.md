# 🏛️ OmniSMM 1.0 — Архитектурная спецификация и матрица доказательной изоляции мультитенантности (2026)

> **Статус:** `APPROVED & VERIFIED`  
> **Роль:** Ведущий системный аналитик & Архитектор кибербезопасности OmniSMM  
> **Стандарты:** OWASP Top 10:2025 (A01 Broken Access Control / BOLA / IDOR), PCI DSS v4.0.1, 152-ФЗ / GDPR ст. 32, ст. 54.1 НК РФ  
> **Дата:** 25 сентября 2026 г.  
> **Контур:** True Multi-Tenancy (N-Tenants Dynamic Scaling)

---

## 1. Исполнительное резюме (Executive Summary)

В платформе **OmniSMM 1.0** реализована бескомпромиссная **мультитенантная архитектура нулевого доверия (Zero-Trust Multi-Tenancy)**, позволяющая обслуживать произвольное количество независимых брендов (Core: **SMMplan** `smmplan.pro`, **SMMflux** `smmflux.ru`, а также $N$ динамических партнерских White-Label витрин) на единой кодовой базе и кластере PostgreSQL/Redis.

Настоящая спецификация и верификационная система разработаны системным аналитиком для доказательного подтверждения:
1. **100% изоляции данных и исключения утечек (Zero Data Leakage / Zero Brand Bleeding)**;
2. **Изоляции финансовых балансов и леджера копейка-в-копейку (ExactMath BigInt & Ledger-First)**;
3. **Строгой границы аутентификации и сессий (Fail-Closed Edge Gate & Token Partitioning)**;
4. **Полной защиты обращений техподдержки (Zero-IDOR / BOLA Immunity в тикетах)**;
5. **Изоляции жизненного цикла заказов и B2B API ключей**.

---

## 2. Четырехуровневая модель изоляции (4-Tier Isolation Architecture)

```
┌────────────────────────────────────────────────────────────────────────┐
│                   УРОВЕНЬ 1: EDGE GATEWAY & INGRESS                     │
│  • Host / SNI Routing (DomainRegistryService L1 Memory + L2 Redis)      │
│  • Edge Proxy Guard (src/proxy.ts): Tenant Mismatch -> 307 + Clear Cookie│
│  • RSC 401 Unauthorized for Cross-Tenant Action / API Requests         │
│  • Client Header Spoofing Override: x-tenant-id forced from Host       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│              УРОВЕНЬ 2: АУТЕНТИФИКАЦИЯ И УПРАВЛЕНИЕ СЕССИЯМИ           │
│  • Составная уникальность пользователя: @@unique([email, tenantId])    │
│  • AuthToken & Magic Link: composite lookup token_tenantId             │
│  • Reseller API v2: verifyAPIKey enforces normRequired === normUserTenant│
│  • Dual-Read Cookie Store: __Host-session_token & session_token        │
│  • Defense-in-Depth verifySession(): Secondary Server-Side Tenant Gate │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│             УРОВЕНЬ 3: ФИНАНСЫ, БАЛАНСЫ И LEDGER-FIRST                │
│  • WalletOps (charge, credit, refund, adminAdjust) strict tenant-check │
│  • Fail-Closed: throws WalletUserNotFoundError on tenantId mismatch    │
│  • Неизменяемый LedgerEntry: запись в леджер ДО изменения баланса     │
│  • Идемпотентность: @@unique([idempotencyKey, tenantId])                │
│  • ExactMath: BigInt (копейки) без округлений и плавающей точки        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│            УРОВЕНЬ 4: БИЗНЕС-МОДУЛИ, ТИКЕТЫ И ЗАКАЗЫ                   │
│  • Тикеты: User & Support actions изолированы по session.tenantId       │
│  • BOLA/IDOR Guard: запрос чужого тикета возвращает null / Access Denied│
│  • Заказы: orderService.cancelPendingOrderClient validates tenantId    │
│  • B2B Storefront Keys: pk_live_ / sk_live_ resolve to owner tenantId  │
│  • Turnkey White-Label: клонирование каталога с наценкой               │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Матрица векторов угроз и защитных механизмов (STRIDE Matrix)

| Вектор угрозы | Модель атаки | Потенциальный ущерб | Реализованный защитный механизм в коде | Статус защиты |
| :--- | :--- | :--- | :--- | :---: |
| **V1: Session Hijacking across Tenants** | Пользователь авторизуется на `smmplan.pro`, копирует сессионную куку и отправляет запрос на `smmflux.ru`. | Несанкционированный доступ, утечка профиля. | `src/proxy.ts` (строка 734): `isTenantMismatch = (!payload \|\| payload.tenantId !== finalTenantId)`. Возврат 307 на `/login` + `clearSessionCookiesOnResponse()`. Для RSC — HTTP 401. | 🛡️ **IMPERVIOUS** |
| **V2: Support Ticket BOLA / IDOR** | Клиент или оператор бренда A запрашивает тикет `ticketId` из бренда B. | Утечка переписки с клиентом, скриншотов, ссылок на соцсети. | `src/actions/support/ticket.ts` (строка 140): `ticket = isStaff ? db.ticket.findFirst({ where: { id, tenantId } }) : db.ticket.findFirst({ where: { id, userId, tenantId } })`. При несовпадении возврат `{ success: false, error: 'Тикет не найден или доступ запрещён' }`. | 🛡️ **IMPERVIOUS** |
| **V3: Financial Balance Cross-Drain** | Попытка списать баланс пользователя с одинаковым email, зарегистрированного на другом сайте. | Кража средств, расхождение бухгалтерского баланса. | `WalletOps.charge()` / `WalletOps.credit()`: проверка `if (tenantId && user.tenantId !== tenantId) throw new WalletUserNotFoundError()`. Балансы привязаны к `user.id` и строго изолированы. | 🛡️ **IMPERVIOUS** |
| **V4: Cross-Tenant Order Cancel / Refill** | Пользователь бренда A отправляет команду отмены заказа `orderId`, созданного на бренде B. | Несанкционированная отмена, возврат чужих средств. | `orderService.cancelPendingOrderClient()`: `if (!order \|\| (tenantId && order.tenantId !== tenantId)) return { success: false, error: 'Заказ не найден или доступ ограничен' }`. | 🛡️ **IMPERVIOUS** |
| **V5: Reseller API Key Replay** | Партнер использует API-ключ от `smmplan` для отправки заказов через `/api/v2` на домен `smmflux.ru`. | Перекрестное исполнение, нарушение тарифов и скидок. | `src/lib/api-auth.ts`: `verifyAPIKey()` проверяет `normRequired !== normUserTenant`. При расхождении возвращает `null` (401 Unauthorized). | 🛡️ **IMPERVIOUS** |
| **V6: B2B Storefront Key Hijacking** | Использование ключа витрины `pk_live_...` бренда A на домене бренда B. | Подмена витрины, утечка настроек тем оформления. | `StorefrontKeyService.verifyKey()` резолвит ключ строго к `keyRecord.tenantId` и сопоставляет с активным доменом. | 🛡️ **IMPERVIOUS** |
| **V7: Brand Bleeding & PII Leakage** | Утечка реферальных кодов, email техподдержки, Telegram-ботов между сайтами. | Размытие бренда, нарушение 152-ФЗ / GDPR. | `getTenantFallbackBranding(tenantId)` генерирует независимые адреса поддержки (`support@smmplan.pro` vs `support@smmflux.ru`), независимых ботов, а `request-magic-link.ts` ищет реферера строго с фильтром `{ referralCode, tenantId }`. | 🛡️ **IMPERVIOUS** |
| **V8: Phantom Brand Ghosting** | Появление жестко зашитых устаревших брендов (`lovable`, `smmboost`). | Ошибки маршрутизации, регрессия кода. | AST Линтер `scripts/lint-tenant-isolation.ts` блокирует появление любых упоминаний фантомных брендов на этапе CI/CD (Правило 3: `no-phantom-brand-ghosting`). | 🛡️ **IMPERVIOUS** |

---

## 4. Система статического контроля в коде (AST Tenant Guard)

В платформе функционирует встроенный статический анализатор синтаксических деревьев TypeScript — `TenantIsolationLinter` (`scripts/lint-tenant-isolation.ts`), проверяющий каждый коммит:
1. **Rule `tenant-where-clause-required` (BLOCKER):**  
   Любой запрос к моделям `Order`, `User`, `Payment`, `Ticket`, `Service`, `Category`, `LedgerEntry`, `CustomerGroup` обязан содержать `where: { tenantId }`. Запросы `findUnique` обязаны валидировать принадлежность записи тенанту.
2. **Rule `tenant-cache-key-required` (MAJOR):**  
   Все вызовы `unstable_cache` обязаны включать `tenantId` в массив ключей кэша и тэгов для исключения Brand Bleeding.
3. **Rule `no-phantom-brand-ghosting` (BLOCKER):**  
   Запрещены любые строковые литералы устаревших брендов (`lovable`, `smmboost`).
4. **Rule `tenant-worker-wrapper-required` (BLOCKER):**  
   Все процессоры очередей BullMQ обязаны вызывать `runWithTenant(job.data.tenantId, ...)`.

---

## 5. Программа E2E-тестирования (End-to-End Test Matrix)

Тестовый сьют `src/__tests__/multitenant-e2e-matrix.test.ts` включает **8 модулей** и **22 сквозных сценария**, моделирующих как штатные операции, так и вредоносные атаки нарушителя:

1. **Модуль 1: Gateway, Reverse Proxy & Routing Isolation**
   - 1.1: Резолвинг хостов `smmplan.pro` $\to$ `smmplan`, `smmflux.ru` $\to$ `flux`.
   - 1.2: Переопределение поддельного заголовка `x-tenant-id` от клиента на реальный хост.
   - 1.3: Блокировка сессии `smmplan` на домене `flux` (307 Redirect на `/login` + стирание Cookie).
   - 1.4: Блокировка RSC-запроса с чужого тенанта с кодом `401 Unauthorized`.
   - 1.5: Регистрация и мгновенная маршрутизация произвольного кастомного домена N-го тенанта.

2. **Модуль 2: Authentication & Session Boundaries**
   - 2.1: Dual-Identity: один email на двух сайтах создает две независимые учетные записи с разными `userId`.
   - 2.2: AuthToken / Magic Link: токен от `smmplan` возвращает `null` при проверке на `flux`.
   - 2.3: B2B Reseller API Key: ключ пользователя `smmplan` возвращает `null` при вызове с `requiredTenantId = 'flux'`.
   - 2.4: Secondary Defense `verifySession`: возврат `null` и очистка Cookie при несовпадении тенанта сессии и хоста.

3. **Модуль 3: Balance, Financial Ledger & ExactMath**
   - 3.1: Независимость балансов: списание 50 000 копеек на `smmplan` оставляет баланс на `flux` без изменений.
   - 3.2: Fail-Closed Guard: попытка вызвать `WalletOps.charge` с чужим `tenantId` выбрасывает `WalletUserNotFoundError`.
   - 3.3: Изоляция леджера: одинаковый `idempotencyKey` на `smmplan` и `flux` не конфликтует и создает раздельные записи.

4. **Модуль 4: Support Tickets & Zero-IDOR Defense**
   - 4.1: Создание тикета привязывает его строго к `session.tenantId`.
   - 4.2: Клиент `smmplan` пытается ответить в тикет `flux` $\to$ `{ success: false, error: 'Тикет не найден или доступ запрещён' }`.
   - 4.3: Оператор поддержки `SUPPORT` тенанта `smmplan` пытается ответить в тикет `flux` $\to$ доступ запрещен.
   - 4.4: Заказ из `flux` невозможно привязать к тикету на `smmplan`.

5. **Модуль 5: Orders, Refills & Cancellation**
   - 5.1: Выборка заказов строго фильтрует по `tenantId`, исключая появление чужих заказов.
   - 5.2: Клиент `smmplan` пытается отменить заказ из `flux` через `cancelPendingOrderClient` $\to$ отказ `{ success: false, error: 'Заказ не найден или доступ ограничен' }`.

6. **Модуль 6: B2B Storefront Keys & Custom Domains**
   - 6.1: Ключи `pk_live_...` и `sk_live_...` привязываются и резолвятся строго в тенанта-владельца.
   - 6.2: Запрос к публичной витрине по кастомному домену возвращает контекст соответствующего бренда.

7. **Модуль 7: Data Leakage, PII & Referral Protection**
   - 7.1: Реферальный код `smmplan` не находится и не активируется на сайте `flux`.
   - 7.2: Изоляция контактов поддержки и Telegram-ботов между брендами.

8. **Модуль 8: Dynamic Scalability (N-Tenants Scaling)**
   - 8.1: Регистрация $N$-го тенанта в рантайме без правки кода.
   - 8.2: Клонирование каталога White-Label с наценкой +15% с сохранением чистой изоляции.
