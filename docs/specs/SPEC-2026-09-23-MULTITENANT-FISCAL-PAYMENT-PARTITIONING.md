# SPEC-2026-09-23: Multi-Tenant Fiscal & Payment Gateway Partitioning (54-ФЗ & Anti-Commingling)

## 1. Контекст и Проблема
OmniSMM 1.0 развивается как масштабируемая White-Label платформа («Tenants as Data»).
При подключении произвольных витрин (N-tenants) критически важно обеспечить строгую изоляцию платежей и фискализации:
1. **Защита от смешения выручки (ст. 54.1 НК РФ, ст. 145/164 НК РФ, 54-ФЗ)**:
   Если сторонний тенант не настроил собственные платежные ключи в панели управления, система не имеет права списывать деньги через мерчант головного бренда (`process.env.YOOKASSA_SHOP_ID`), так как это создает состав налогового правонарушения (незаконное дробление бизнеса и неверное указание продавца/ИНН в чеке 54-ФЗ).
2. **Многоклиентские вебхуки платежей**:
   Платежные шлюзы (ЮKassa, Robokassa, CryptoBot) должны поддерживать как централизованные эндпоинты (`/api/webhooks/<gateway>`), так и параметризованные URL витрин (`/api/webhooks/<gateway>/[tenantId]`), исключая неоднозначность при проверке HMAC/подписей.
3. **Zero-Migration Compliance**:
   Использование существующей таблицы `SystemSettings` (`id = <tenantId>`), исключающее миграции DDL PostgreSQL.

---

## 2. Архитектурное Решение

### 2.1 Изоляция хранилища секретов (`src/lib/settings.ts`)
- В методе `SettingsProvider.getPaymentSecrets(tenantId)`:
  - Если `tenantId === 'smmplan'` (или отсутствует), разрешен фоллбэк на переменные окружения `process.env.YOOKASSA_*`, `process.env.ROBOKASSA_*`, `process.env.CRYPTO_BOT_TOKEN`.
  - Для **любых других тенантов** (`flux`, сторонние white-label магазины): фоллбэк на переменные окружения категорически запрещен. Если ключи не заданы в `SystemSettings`, метод возвращает `null`.
  - Попытка создать платеж без настроенных ключей завершается понятной ошибкой: «Платёжный шлюз не настроен для данного магазина...».

### 2.2 Устранение остаточных бинарных тернариев
- Замена тернарных конструкций `tenantId === 'flux' ? 'SMMflux' : 'SMMplan'` в:
  - `src/services/financial/payment-gateway.service.ts`
  - `src/services/admin/settings.service.ts`
  - `src/actions/admin/settings/settings-diagnostics.action.ts`
  на динамический резолвер `getTenantFallbackBranding(tenantId).name`.

### 2.3 Параметризованные маршруты вебхуков
- `POST /api/webhooks/yookassa/[tenantId]`
- `POST /api/webhooks/robokassa/[tenantId]`
  Оба маршрута:
  - Проверяют принадлежность IP к официальным диапазонам шлюзов.
  - Проверяют криптографическую подпись/HMAC с использованием секрета целевого тенанта.
  - Проводят платеж через `paymentService.confirmPayment` с сохранением изоляции леджера.

### 2.4 Изоляция фискальных чеков (54-ФЗ)
- Подсчет порога выручки 20 млн ₽ (`checkVatThreshold(tenantId)`) строго изолирован по `where: { tenantId }`.
- Формирование фискального чека (ЮKassa ФФД 1.2 `vat_code: 1` vs `4` / `10`, Robokassa `tax: "none"` vs `"vat22"`) осуществляется на основе оборота конкретного юридического лица.

---

## 3. Критерии Приемки (Acceptance Criteria)
1. `SettingsProvider.getPaymentSecrets('custom-store')` возвращает `null` при отсутствии ключей в БД, не раскрывая `process.env.YOOKASSA_SHOP_ID`.
2. `PaymentGatewayFactory.getGateway('yookassa').createPayment({ tenantId: 'unconfigured-tenant' })` выбрасывает исключение и не отправляет запрос в ЮKassa с ключами `smmplan`.
3. Поддерживается прием вебхуков по маршрутам `/api/webhooks/yookassa/[tenantId]` и `/api/webhooks/robokassa/[tenantId]`.
4. 100% прохождение сьюта `multitenant-payment-partitioning.test.ts`.
5. 0 ошибок `tsc --noEmit`, 0 блокеров `lint:tenant`, 0 утечек секретов.
