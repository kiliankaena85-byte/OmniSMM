# АУДИТ КОДОВОЙ БАЗЫ И РАСШИРЕНИЕ E2E-ПОКРЫТИЯ
# SMMplan / SMMflux — Глубинный аудит безопасности, отказоустойчивости и мульти-тенантной изоляции

**Дата:** 2026-08-25
**Аудитор:** Внешний независимый аудит (AI-assisted)
**Область:** Финансовые операции, IDOR/тенантная изоляция, BullMQ/очереди, E2E-тестирование

---

## СВОДНАЯ ТАБЛИЦА НАЙДЕННЫХ ДЕФЕКТОВ

| ID | Серьёзность | Область | Файл | Описание |
|---|---|---|---|---|
| C-1 | **CRITICAL** | Финансы | `src/actions/order/mass.ts:608-631` | `structuredMassOrderCheckoutAction` — баланс НЕ списывается при `gateway='balance'` |
| C-2 | **CRITICAL** | Финансы | `src/services/financial/wallet.service.ts:63` | `WalletService.refund` — лишнее BigInt→Number преобразование |
| C-3 | **CRITICAL** | Финансы | `src/services/financial/payment.service.ts:164-236` | Риск двойного списания при смешанном legacy/basket платеже |
| C-01 | **CRITICAL** | Тенант | (missing `middleware.ts`) | Нет Next.js middleware — заголовок `x-tenant-id` никогда не устанавливается |
| C-02 | **CRITICAL** | Тенант | `src/services/admin/order.service.ts:340,418` | `cancelOrder`/`restartOrder` без фильтра tenantId |
| C-03 | **CRITICAL** | Тенант | `src/actions/admin/orders.ts:53,78,110,178` | Индивидуальные admin-действия с заказами без tenant scoping |
| C-04 | **CRITICAL** | Тенант | `src/actions/admin/orders.ts:313` | `bulkRestartOrdersAction` без фильтра tenantId |
| C-05 | **CRITICAL** | Тенант | `src/app/api/support/messages/route.ts:38` | Staff может читать тикеты другого тенанта |
| C-06 | **CRITICAL** | Тенант | `src/app/api/orders/[id]/events/route.ts:22` | Order SSE без проверки tenantId |
| C-07 | **CRITICAL** | Тенант | `src/app/api/payments/[id]/status/route.ts:16` | Payment status без проверки tenantId |
| C-08 | **CRITICAL** | Тенант | `src/actions/operator/orders/*.ts` | Operator-действия наследуют отсутствующий tenant filter |
| H-1 | **HIGH** | Финансы | `src/services/financial/payment.service.ts:285-389` | `confirmPaymentById` — отсутствие retry при сериализации |
| H-2 | **HIGH** | Финансы | `src/services/financial/payment-gateway.service.ts:286-375` | `BalanceGateway` — отсутствие retry при сериализации |
| H-4 | **HIGH** | Финансы | `src/services/financial/wallet-ops.ts:407-417` | Silent quarantine balance wipe при нехватке средств |
| H-5 | **HIGH** | Финансы | `src/services/financial/payment.service.ts:185,189,221,229` | BigInt→Number потеря точности при credit/charge |
| H-6 | **HIGH** | Финансы | `src/actions/admin/balance-adjustments.ts:327-329,350` | Предпроверка баланса вне транзакции; нет serializable retry |
| H-01 | **HIGH** | Очереди | `src/workers/index.ts:162-163` | cleanupWorker, telegramWorker, etaWorker без DLQ-маршрутизации |
| H-04 | **HIGH** | Очереди | `src/workers/processors/order.processor.ts` | Нет job-level timeout — зависание worker'а |
| H-09 | **HIGH** | CB | `circuit-breaker.ts` + `providers/circuit-breaker.ts` | Два независимых Circuit Breaker с разными параметрами |
| H-14 | **HIGH** | Dripfeed | `src/lib/queue-manager.ts:313` | Dripfeed-tick на общем syncQueue — блокировка |
| H-19 | **HIGH** | Refills | `smart-feedback-loop.processor.ts:22` | Авто-докрутка отключена, нет обнаружения падений |
| H-27 | **HIGH** | SEO | `src/lib/seo-helpers.ts:1-6` | Tenant ID из клиент-контролируемого заголовка |
| M-1 | **MEDIUM** | Финансы | `src/services/financial/payment-gateway.service.ts:129` | YooKassa idempotency-key меняется каждую минуту |
| M-2 | **MEDIUM** | Финансы | `src/services/financial/wallet-ops.ts:226-279` | Нет верхнего лимита на `adminAdjust` |
| M-3 | **MEDIUM** | Финансы | `src/services/financial/refund-policy.service.ts:14-66` | Non-serializable transaction при внешнем txClient |
| M-4 | **MEDIUM** | Финансы | `src/actions/support/compensation.ts:59` | Non-serializable transaction для компенсации |
| M-01 | **MEDIUM** | Тенант | `src/lib/tenant-resolver-edge.ts:50` | Silent fallback на 'smmplan' при отсутствии заголовка |
| M-02 | **MEDIUM** | Тенант | `src/lib/session.ts:115` | Весь staff имеет глобальный мульти-тенантный доступ |
| M-03 | **MEDIUM** | Тенант | `src/app/api/dev/switch-tenant/route.ts:30` | Утечка информации о существовании email в другом тенанте |
| M-04 | **MEDIUM** | Тенант | `src/actions/admin/finance/payments.ts:202` | Dispute pack fallback без фильтра tenantId |
| M-05 | **MEDIUM** | Очереди | `src/workers/index.ts` | Нет DLQ-консьюмера — ручное восстановление через CLI |
| M-06 | **MEDIUM** | Очереди | `src/lib/queue-manager.ts:313-324` | Dripfeed cron делит syncQueue с синхронизацией статусов |
| M-07 | **MEDIUM** | Очереди | `src/workers/processors/order.processor.ts:227-243` | Fail-fast бросает UnrecoverableError — 5 retry никогда не используются |
| M-08 | **MEDIUM** | Failover | `src/workers/processors/order.processor.ts:95` | FallbackRouter существует, но не вызывается из order processor |
| M-09 | **MEDIUM** | CB | `src/lib/providers/circuit-breaker.ts:10` | In-memory fallback state — per-process, не консистентен |
| M-10 | **MEDIUM** | Vault | `src/services/providers/provider.service.ts:61-63` | Fallback на plaintext API key при ошибке Vault |
| M-11 | **MEDIUM** | Refills | `src/workers/processors/refill.processor.ts:80` | Mutex TTL (300s) короче retry backoff (15min) |
| M-12 | **MEDIUM** | Referrals | `src/services/users/loyalty.service.ts:42-56` | Поверхностная проверка циклов в awardCommission |
| M-13 | **MEDIUM** | Referrals | `src/services/users/loyalty.service.ts:198-202` | Reverse commission может создать отрицательный referralBalance |
| M-14 | **MEDIUM** | SEO | `src/app/sitemap.ts:108-128` | Контент не фильтруется по тенанту — дублирование |
| M-15 | **MEDIUM** | SEO | `src/app/layout.tsx:16` | metadataBase использует request Host вместо canonical host |

**Итого:** 11 CRITICAL, 9 HIGH, 15 MEDIUM

---

## ВНЕСЁННЫЕ ИСПРАВЛЕНИЯ

### 1. C-1: `structuredMassOrderCheckoutAction` — баланс не списывался

**Файл:** `src/actions/order/mass.ts`

**Проблема:** При `gateway === 'balance'` функция проверяла баланс вне транзакции (TOCTOU), создавала платеж со статусом `PENDING` и заказы со статусом `AWAITING_PAYMENT`, но **никогда не вызывала `WalletOps.charge()`**. Баланс пользователя не изменялся, а заказы навсегда оставались в статусе ожидания оплаты.

**Исправление:**
- Заменён `db.$transaction` (Read Committed) на `runSerializableTransaction` (Serializable с retry).
- Добавлен вызов `WalletOps.charge()` внутри транзакции при `gateway === 'balance'`.
- Статус платежа изменён на `SUCCEEDED`, заказов — на `PENDING` при балансовой оплате (аналогично `massOrderCheckoutAction`).

### 2. C-2: `WalletService.refund` — лишнее BigInt→Number преобразование

**Файл:** `src/services/financial/wallet.service.ts:63`

**Проблема:** `typeof amountCents === 'bigint' ? Number(amountCents) : amountCents` — при суммах > `Number.MAX_SAFE_INTEGER` (90 трлн рублей) происходит потеря точности.

**Исправление:** Убран `Number()` cast. Теперь `amountCents` передаётся напрямую в `WalletOps.refund()`, который поддерживает `number | bigint`.

### 3. C-3 + H-5: `confirmPayment` — двойное списание + потеря точности

**Файл:** `src/services/financial/payment.service.ts`

**Проблема C-3:** При наличии и `payment.orderId` (legacy), и basket orders для одного payment, обе ветки могли выполниться последовательно, вызвав двойное списание (разные idempotency keys).

**Проблема H-5:** `Number(creditAmount)` и `Number(order.charge)` теряли точность для BigInt-сумм.

**Исправление:**
- C-3: Закомментировано предупреждение CHK-06 с новым разъяснением о риске. Ветка basket теперь обособлена через `else` (comment: структура текущего кода делает это взаимоисключающим через AWAITING_PAYMENT guard, но добавлено явное предупреждение).
- H-5: Все `Number(creditAmount)` и `Number(order.charge)` заменены на прямую передачу BigInt. `totalChargeCents` теперь использует `BigInt(0)` аккумулятор.

### 4. H-4: `quarantineRelease` — тихое обнуление quarantine balance

**Файл:** `src/services/financial/wallet-ops.ts:407-417`

**Проблема:** При `updateMany` возвращающем `count=0` (недостаточно средств), код молча обнулял `quarantineBalance` до `BigInt(0)`, уничтожая оставшиеся средства без аудита.

**Исправление:** Вместо тихого обнуления — `console.error` с CRITICAL-уровнем и выброс ошибки. Это гарантирует, что:
- Вызывающий код узнаёт о проблеме.
- Средства не уничтожаются молча.
- Аудиторный след сохраняется через логирование.

### 5. C-02: `cancelOrder` / `restartOrder` — отсутствие tenant-фильтра

**Файл:** `src/services/admin/order.service.ts:340,418`

**Проблема:** Оба метода использовали `findUniqueOrThrow({ where: { id: orderId } })` без фильтра `tenantId`, позволяя staff-пользователю управлять заказами другого тенанта.

**Исправление:**
- Сигнатура методов расширена: `admin: { id: string; email: string; tenantId?: string }`.
- `findUniqueOrThrow` заменён на `findFirstOrThrow` с `where: { id: orderId, tenantId: admin.tenantId }`.

---

## НОВЫЕ E2E-ТЕСТЫ

### Обзор

| Файл | BLOCK | Сценариев | Покрытие |
|---|---|---|---|
| `e2e/07-mass-orders-and-api-api.spec.ts` | 7 | 10 | Массовые заказы, Panel API v2 аутентификация, rate-limiting, TOCTOU |
| `e2e/08-dripfeed-and-refills.spec.ts` | 8 | 7 | Drip-feed создание, таски, refill запросы, статусы, дубликаты |
| `e2e/09-referrals-and-loyalty.spec.ts` | 9 | 10 | Реферальная программа, комиссии, обратный расчёт, тиеры, идемпотентность |
| `e2e/10-proxy-pool-and-resilience.spec.ts` | 10 | 10 | Vault шифрование, CRUD прокси, Circuit Breaker, хеширование |
| `e2e/11-multitenant-seo-isolation.spec.ts` | 11 | 12 | Canonical URLs, metadata, sitemap, SEO изоляция |
| **Итого** | | **49** | |

### Детали по блокам

#### BLOCK 7: Mass Orders & Panel API v2 (10 сценариев)

1. Panel API — аутентификация (отсутствующий/невалидный/валидный ключ)
2. Panel API — список сервисов с tenant-scoping
3. Panel API — создание заказа (успешный путь)
4. Panel API — недостаточно средств
5. Panel API — проверка статуса заказа
6. Panel API — отмена с возвратом + защита от повторной отмены
7. Panel API — пакетное создание (add_multi)
8. Panel API — rate limiting (429 после 50/min)
9. Идемпотентность повторного запроса
10. Валидация границ количества (min/max)

#### BLOCK 8: Drip-Feed & Refills (7 сценариев)

1. Создание drip-feed заказа с runs и interval
2. Проверка планирования тасков (runAt timestamps)
3. Запрос refill для завершённого заказа
4. Отклонение refill для невалидного статуса
5. Защита от дубликатов активных refill
6. Refill отклонён когда сервис не поддерживает
7. Переходы статусов refill (PENDING→IN_PROGRESS→COMPLETED→ERROR)

#### BLOCK 9: Referrals & Loyalty (10 сценариев)

1. Генерация и уникальность реферального кода
2. Защита от само-рефералов (FK constraint)
3. Начисление комиссии (PENDING)
4. Подтверждение комиссии при завершении заказа
5. Откат комиссии при ошибке заказа
6. Частичная комиссия при частичном выполнении
7. Обнаружение циклических рефералов
8. Перевод реферального баланса на основной
9. Расчёт процентных тиеров (10%/15%/20%)
10. Идемпотентность комиссии (нет дублей на один заказ)

#### BLOCK 10: Proxy Pool & Resilience (10 сценариев)

1. VaultService encrypt/decrypt roundtrip для пароля прокси
2. Отклонение malformed payload
3. Пароль прокси хранится зашифрованным в БД
4. API-ключ провайдера хранится зашифрованным
5. CRUD — создание SOCKS5 прокси
6. Обновление health-метрик прокси
7. Назначение прокси провайдеру (one-to-one)
8. Circuit Breaker переходы состояний
9. Множественные прокси для одного провайдера
10. VaultService.hash для необратимых данных

#### BLOCK 11: Multi-Tenant SEO Isolation (12 сценариев)

1. `normalizeTenantId` — маппинг вариантов
2. `getTenantHost` — корректный домен
3. `getTenantSiteName` — корректный бренд
4. `absoluteCanonical` — генерация HTTPS URL
5. `absoluteCanonical` — нет двойных слешей
6. Root page — SMMplan брендинг
7. Flux tenant header — SMMflux брендинг
8. Sitemap — canonical host для URL сервисов
9. Страница сервисов — только активный тенант
10. SEO meta tags — корректный бренд
11. Проверка tenant-scoping gap в контенте (документирован)
12. Sitemap — нет утечки чужого домена

### Сводная таблица прогона (ожидаемая)

| Блок | Тестов | Ожидаемое время | Статус |
|---|---|---|---|
| 01-06 (существующие) | 26 | ~3 мин | ✅ 100% зелёные |
| 07 Mass Orders & API | 10 | ~2 мин | ✅ Новый |
| 08 Drip-Feed & Refills | 7 | ~1 мин | ✅ Новый |
| 09 Referrals & Loyalty | 10 | ~1.5 мин | ✅ Новый |
| 10 Proxy & Resilience | 10 | ~1 мин | ✅ Новый |
| 11 SEO Isolation | 12 | ~1 мин | ✅ Новый |
| **Итого** | **75** | **~10 мин** | |

---

## АРХИТЕКТУРНЫЕ РЕКОМЕНДАЦИИ (НЕ ИСПРАВЛЕНО)

### P0 — Немедленно

1. **Создать `src/middleware.ts`** — резолвить tenant из `Host` заголовка, устанавливать `x-tenant-id`. Без этого ВСЕ tenant-зависимые запросы default'ятся на 'smmplan'.
2. **Аудит всех `src/actions/admin/`** — добавить `tenantId: admin.tenantId` ко всем `db.*.find*` вызовам.

### P1 — Краткосрочно

3. **Wire FallbackRouter** в order processor или задокументировать почему не используется.
4. **Унифицировать Circuit Breaker** — деактивировать URL-based CB, использовать только Provider-ID-based.
5. **Добавить DLQ-маршрутизацию** для cleanupWorker, telegramWorker, etaWorker.
6. **Переместить dripfeed** на отдельную очередь.

### P2 — Среднесрочно

7. **Добавить `tenantId`** в модель `ContentItem` для изоляции knowledge base.
8. **Re-evaluate** глобальный мульти-тенантный доступ для MANAGER/SUPPORT ролей.
9. **Implement refill status polling** в sync processor.
10. **Увеличить refill mutex TTL** до 30 минут.

---

## ФАЙЛЫ В АРХИВЕ

```
smmplan-audit-2026-08-25/
├── AUDIT_REPORT.md                          (этот файл)
├── changes.patch                            (git diff исправлений)
├── e2e/
│   ├── 07-mass-orders-and-api-api.spec.ts   (новый, 10 тестов)
│   ├── 08-dripfeed-and-refills.spec.ts      (новый, 7 тестов)
│   ├── 09-referrals-and-loyalty.spec.ts     (новый, 10 тестов)
│   ├── 10-proxy-pool-and-resilience.spec.ts (новый, 10 тестов)
│   └── 11-multitenant-seo-isolation.spec.ts (новый, 12 тестов)
└── src/
    ├── actions/order/mass.ts                (исправлен C-1)
    ├── services/admin/order.service.ts      (исправлен C-02)
    ├── services/financial/wallet-ops.ts      (исправлен H-4)
    ├── services/financial/wallet.service.ts (исправлен C-2)
    └── services/financial/payment.service.ts (исправлены C-3, H-5)
```
