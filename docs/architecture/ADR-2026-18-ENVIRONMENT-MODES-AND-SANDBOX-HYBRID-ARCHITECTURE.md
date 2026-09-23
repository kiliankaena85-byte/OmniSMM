# ADR-2026-18: Architecture of Operational Modes (Sandbox, Hybrid, Acquiring Test, Production)

## Метаданные
- **Платформа:** OmniSMM 1.0 (SMMplan / SMMflux)
- **Статус:** ACCEPTED
- **Дата:** 2026-09-15
- **Автор(ы):** Antigravity ADR Architect & Fullstack Core Team
- **Теги:** [admin, environment-mode, sandbox, hybrid, acquiring-test, production, yookassa, security, multitenant]

---

## 1. Context & Problem Statement (Контекст и постановка проблемы)

В административной панели платформы OmniSMM 1.0 предусмотрен глобальный переключатель режимов окружения (`EnvironmentModeSwitcher`), разделяющий жизненный цикл заказов на два независимых контура: **контур биллинга / эквайринга** и **контур исполнения поставщиками (Fulfillment)**.

Пользователь запросил архитектурный аудит данных режимов:
> *«/adr-architect проверь архитектуру режимов в админ панели, песочница, гибрид, и так далее. Мне нужен просто реальный тестовый прогон через юкассу, что связка работает»*

В ходе аудита кодовой базы (`src/components/admin/EnvironmentModeSwitcher.tsx`, `src/actions/admin/environment-mode.ts`, `src/lib/settings.ts`, `src/services/financial/payment-gateway.service.ts`, `src/services/providers/provider.service.ts`) было исследовано текущее состояние архитектуры и выявлены 3 критических архитектурных зазора.

---

## 2. Архитектурная матрица 4 режимов платформы (Canonical Mode Matrix)

| Режим (`EnvironmentMode`) | Контур оплаты (Payment Gateway) | Контур исполнения (SMM Provider) | Финансовый риск | Расход баланса поставщика | Назначение |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`SANDBOX` (Песочница)** | 100% Mock (0 ₽, без реального шлюза) | Виртуальный Mock SMM (эмуляция исполнения) | **0 ₽** | **0 ₽** | Локальная разработка, E2E тесты, обучение операторов |
| **`HYBRID` (Гибридный тест)** | 100% Mock (0 ₽, без списания с клиента) | **РЕАЛЬНЫЙ поставщик (VexBoost/др.)** | 0 ₽ для клиента | **Списывается с баланса OmniSMM у провайдера** | Проверка качества реальной накрутки в соцсети без затрат на эквайринг |
| **`ACQUIRING_TEST` (Тест эквайринга)** | **РЕАЛЬНЫЙ тестовый/боевой эквайринг (ЮKassa)** | Виртуальный Mock SMM (эмуляция исполнения) | По тарифу эквайринга (в тестовом режиме — 0 ₽) | **0 ₽** | **Проверка связки эквайринга и вебхуков без затрат на соцсети (требование пользователя)** |
| **`PRODUCTION` (Боевой)** | Боевой эквайринг (ЮKassa / СБП / CryptoBot) | Реальный поставщик (VexBoost) | Реальный оборот | Реальный расход | Боевая эксплуатация платформы клиентами |

---

## 3. Выявленные архитектурные зазоры (Gap Analysis)

### Зазор №1: Архитектурная амнезия при холодном перезапуске Redis
- **Текущее поведение:** Значение режима (`SANDBOX`, `HYBRID`, `ACQUIRING_TEST`, `PRODUCTION`) сохраняется в Redis по ключу `settings:${tenantId}:environmentMode`. При этом в таблице `SystemSettings` в PostgreSQL хранится только бинарный флаг `isTestMode: Boolean`.
- **Риск:** При перезапуске Redis или сбросе кэша метод `getEnvironmentMode()` делает фоллбэк:
  ```typescript
  const isTest = await this.isTestMode(activeTenantId);
  return isTest ? 'SANDBOX' : 'PRODUCTION';
  ```
  Режимы `HYBRID` и `ACQUIRING_TEST` автоматически деградируют до `SANDBOX`.

### Зазор №2: Рассинхронизация флага `isMockPaymentEnabled` и `PaymentGatewayFactory`
- **Текущее поведение:** В `SettingsProvider` определен метод:
  ```typescript
  static async isMockPaymentEnabled(tenantId?: string): Promise<boolean> {
    const mode = await this.getEnvironmentMode(tenantId);
    return mode === 'SANDBOX' || mode === 'HYBRID';
  }
  ```
  Однако в `checkoutAction` (`src/actions/order/checkout.ts`) вызов шлюза происходит через:
  ```typescript
  const gatewaySvc = PaymentGatewayFactory.getGateway(gateway || 'yookassa');
  ```
  Если клиент выбрал `gateway === 'yookassa'`, создается реальный инстанс `YooKassaGateway`, который делает сетевой запрос к `https://api.yookassa.ru`, даже если включен режим `SANDBOX`!
- **Риск:** В режиме `SANDBOX` форма пытается соединиться с реальным API ЮKassa вместо использования безопасного `MockGateway`.

### Зазор №3: Изоляция тестовых секретов в многопользовательской БД (Multi-Tenant Fallback)
- **Текущее поведение:** В `SystemSettings` для тенанта `smmplan` поля `yookassaTestShopId` и `yookassaTestSecretKey` содержали `null`, перекладывая ответственность на переменные окружения хоста (`.env`).
- **Требование 2026 года:** Реквизиты тестового эквайринга обязаны быть изолированы на уровне тенанта в зашифрованном хранилище (`VaultService`) в `SystemSettings`.

### Зазор №4: Конфликт `isTestMode` и режима `HYBRID` в фоновом воркере `OrderProcessor`
- **Текущее поведение:** В `src/workers/processors/order.processor.ts:72-80`:
  ```typescript
  const isTestMode = await SettingsManager.isTestMode();
  if (order.isTest && !isTestMode) {
    log.error(`[OrderProcessor] CRITICAL: Test order ${orderId} picked up in production mode. Failing safely.`);
    await orderService.failOrderTerminal(orderId, 'SYSTEM_GUARD: Попытка отправки тестового заказа реальному провайдеру прервана.');
    return;
  }
  ```
- **Проблема:** В режиме `HYBRID` флаг `isTestMode === true` (так как `mode !== 'PRODUCTION'`), но сам заказ `order.isTest` не должен блокироваться, а наоборот — должен уходить к **реальному провайдеру** (согласно определению режима `HYBRID`). В то же время диспетчер провайдера в `order.processor.ts:264` вызывает:
  ```typescript
  const provider = await providerService.getWorkerProviderInstance(route.provider);
  ```
  Который проверяет `isMockProviderEnabled(tenantId)`. Для `HYBRID` он возвращает `false` (провайдер реальный), а для `ACQUIRING_TEST` и `SANDBOX` — `true` (mock).
- **Узкое место:** Проверка `order.isTest` опирается на бинарный `isTestMode`, а не на семантику `isMockProviderEnabled()`. Если заказ помечен `order.isTest = true` в режиме `HYBRID`, он может либо случайно уйти реальному провайдеру без явного аудита оператором, либо быть сброшен при переключении режима на лету.

### Зазор №5: Утечка боевых реквизитов и отсутствие режима `isTestMode` в демоне сверки `PaymentReconciliation`
- **Текущее поведение:** В `src/workers/payment-reconciliation.ts:57-61`:
  ```typescript
  const secrets = await SettingsManager.getPaymentSecrets().catch(() => null);
  const authHeader = (secrets?.yookassaShopId && secrets?.yookassaSecretKey)
    ? 'Basic ' + Buffer.from(`${secrets.yookassaShopId}:${secrets.yookassaSecretKey}`).toString('base64')
    : 'Basic mock_auth';
  ```
  И далее в строке 100:
  ```typescript
  await paymentService.confirmPayment(
    payment.gatewayId,
    realAmount,
    payment.userId,
    false, // <-- ХАРДКОД isTest = false!
    'yookassa',
    payment.id
  );
  ```
- **Критический дефект:** 
  1. Демон авто-сверки зависших платежей всегда использует **боевые ключи** (`yookassaShopId`, `yookassaSecretKey`), даже если в платформе активен режим `ACQUIRING_TEST` или `SANDBOX`. При проверке тестового платежа через API ЮKassa боевые ключи вернут `401 Unauthorized` или `404 Not Found`, что приведет к ложному учету платежа как сироты (`report.orphans += 1`).
  2. В вызове `confirmPayment` флаг `isTest` жестко захардкожен в `false`. Если тестовый платеж будет подхвачен демоном авто-сверки, он будет подтвержден как **боевой**!

### Зазор №6: Ограничение `createDemoPaymentAction` устаревшим флагом `isTestMode`
- **Текущее поведение:** В `src/actions/order/demo-payment.action.ts:29-39`:
  ```typescript
  const isProd = process.env.NODE_ENV === 'production';
  let isTestMode = false;
  try {
    const { SettingsManager } = await import('@/lib/settings');
    isTestMode = await SettingsManager.isTestMode();
  } catch {}
  if (isProd && !isTestMode) {
    throw new Error('Демо-платежи доступны только в тестовом режиме');
  }
  ```
- **Проблема:** Экшен проверяет только бинарный `isTestMode`. В режиме `ACQUIRING_TEST` (`isTestMode === true`) создание демо-платежа разрешено, хотя в `ACQUIRING_TEST` платежи должны проходить через **реальный тестовый эквайринг ЮKassa**, а не генерировать фейковые демо-ссылки в обход шлюза. Проверка должна учитывать `isMockPaymentEnabled()`.

### Зазор №7: Сетевой барьер DNS-резолюции `api.yookassa.ru` на хосте разработки (Clash Verge FakeIP)
- **Текущее поведение:** На хосте разработки запущен прокси-клиент Clash Verge (порт 7890, режим TUN/FakeIP).
- **Симптом:** DNS-запросы к `api.yookassa.ru` перехватываются внутренним DNS Clash и разрешаются в Fake IP `198.18.0.140`. Прямые HTTPS-запросы к этому IP зависают, так как прокси пытается маршрутизировать российский защищенный хост ЮKassa через внешний туннель вместо прямого соединения (`DIRECT`).
- **Следствие:** Любой реальный запрос от Node.js или curl к `api.yookassa.ru` на хосте разработки падает по таймауту 10 сек, пока в активном профиле Clash Verge не будет применено правило `DOMAIN-SUFFIX,yookassa.ru,DIRECT`.

---

## 4. Decision Outcome (Архитектурное решение и целевое состояние)

Для надежной работы тестовых прогонов и предотвращения финансовых сбоев зафиксированы следующие решения:

1. **Режим для тестового прогона пользователя:**
   - Для задачи пользователя (проверка реальной связки с тестовой ЮKassa без отправки реальных накруток в соцсети) целевым является режим **`ACQUIRING_TEST`** с установленными тестовыми ключами ЮKassa.
2. **Инвариант шлюзов в `PaymentGatewayFactory`:**
   - Фабрика платежных шлюзов обязана учитывать флаг `isMockPayment`. Если активен `isMockPaymentEnabled` и не включен режим прямого теста эквайринга, фабрика отдает `MockGateway`.
   - В режимах `ACQUIRING_TEST` и `PRODUCTION` фабрика использует реальный `YooKassaGateway`.
3. **Разделение ключей Live / Test в `YooKassaGateway` и `PaymentReconciliation`:**
   - При `isTestMode: true` шлюз и демон авто-сверки обязаны использовать `yookassaTestShopId` / `yookassaTestSecretKey` (префикс `test__`).
   - Использование боевых ключей в тестовом режиме категорически заблокировано на уровне валидатора.
   - В `PaymentReconciliation` параметр `isTest` обязан динамически разрешаться через `SettingsManager.isTestMode(payment.tenantId)`.
4. **Безопасность фискализации (54-ФЗ):**
   - В тестовом режиме ЮKassa чеки формируются с корректными признаками расчета (ФФД 1.2, ставки НДС), но не передаются оператором фискальных данных в ФНС РФ, исключая налоговые обязательства.
5. **Нормализация DNS-маршрутизации (DIRECT bypass):**
   - Домены эквайринга РФ (`api.yookassa.ru`, `yoomoney.ru`, `auth.robokassa.ru`) зафиксированы в `IMMUTABLE_DIRECT_PATTERNS` и обязаны идти напрямую минуя любые туннели.

---

## 5. Verification Strategy (План верификации)

1. **Юнит-тесты Vitest:**
   - Тестирование переключения 4 режимов: `src/__tests__/tenant/environment-modes-and-layout-verification.test.ts`.
   - Тестирование жизненного цикла заказа и оплаты: `src/__tests__/unit/user-journey-order-payment-lifecycle.test.ts`.
2. **CI-гейты:**
   - Строгая проверка типов: `npx tsc --noEmit` (0 ошибок).
   - Защита от утечки секретов: `node scripts/check-bundle-secrets.mjs` (0 утечек).
