# СПЕЦИФИКАЦИЯ (SDD-TDD — RAC-2026)
# Комплексное устранение скрытых рассинхронов мульти-тенантности OmniSMM 1.0 (SMMplan & SMMflux)

> **Статус:** APPROVED & IN PROGRESS  
> **Версия:** 1.0.0 (OmniSMM 1.0 RAC-2026)  
> **Дата:** 17.09.2026  
> **Контур:** Tier 1 (Финансовый леджер, платежи, чекаут, SMTP-транспорт, фоновый кэш, реферальная антифрод-система)  
> **Методология:** SDD (Spec-Driven Development) + TDD (Test-Driven Development)

---

## 1. Контекст инцидентов и выявленные уязвимости

После перехода на архитектуру OmniSMM 1.0 (обслуживание витрин `smmplan.pro` и `smmflux.ru`) аудит выявил следующие скрытые точки отказа:

### Инцидент №1: Потеря тенанта при повторной оплате заказа (`retryCheckoutPayment`)
В `src/actions/order/checkout.ts` при повторной попытке оплаты заказа клиентом метод `retryCheckoutPayment` вызывал `tx.payment.create` без явного указания `tenantId`. Вследствие `@default("smmplan")` в схеме Prisma, повторный платёж для заказа SMMflux привязывался к `smmplan`.
- **Нарушение:** Смешение финансовых потоков брендов, искажение отчётов о выручке, угроза ст. 54.1 НК РФ.

### Инцидент №2: Brand Bleeding в почтовом транспорте (`src/lib/smtp.ts`)
Функция `getTransporter()` в `src/lib/smtp.ts` не принимала `tenantId` и вызывала `SettingsProvider.getEmailSettings()` без параметров. В результате письма для SMMflux (включая Magic Link авторизации, чеки и коды сброса) отправлялись с адреса `no-reply@smmplan.pro` через сервер SMMplan.
- **Нарушение:** Эрозия доверия пользователей, нарушение контракта изоляции брендов.

### Инцидент №3: Застревание кэша каталога при фоновой синхронизации цен
Воркер `src/workers/processors/catalog.processor.ts` при обновлении цен вызывал инвалидацию по тегам `['catalog', 'services']`, тогда как витрины используют теги `catalog-smmplan` и `catalog-flux`.
- **Нарушение:** Витрины отображали устаревшие цены до 600 секунд после завершения фонового процесса.

### Инцидент №4: Межтенантные реферальные связи
`ReferralValidatorService` не валидировал совпадение тенантов пригласителя и приглашенного. Пользователь `smmplan` мог стать реферером пользователя `smmflux`, что приводило к начислению партнерских выплат между несвязанными проектами.

### Инцидент №5: Блокировки AST-линтера изоляции
Запросы `updateMany` и `aggregate` в `payment.service.ts`, `orders.ts` и `clients.ts` выполнялись без обязательного условия `where: { tenantId }`.

---

## 2. Архитектурный контракт и жесткие инварианты

1. **Payment Tenant Integrity:** Любой вызов `tx.payment.create` ОБЯЗАН содержать поле `tenantId`, наследуемое от связанного `Order.tenantId` или `User.tenantId`.
2. **Tenant-Aware Transporter:** Почтовый транспорт `getTransporter(tenantId)` ОБЯЗАН загружать настройки `SettingsProvider.getEmailSettings(tenantId)` и выставлять соответствующий `fromEmail`.
3. **Multi-Tenant Cache Invalidation:** Фоновые процессы обновления каталога обязаны инвалидировать как общие теги, так и теги конкретных витрин (`catalog-smmplan`, `catalog-flux`).
4. **Referral Tenant Boundary:** Реферальная связь разрешена СТРОГО внутри одного тенанта: `inviter.tenantId === context.tenantId`.
5. **Brand-Agnostic Author Fallback:** Роли и подписи авторов по умолчанию не должны содержать жестко захардкоженных имен брендов-конкурентов.

---

## 3. Волновой план реализации (Wave Rollout Plan)

- **Волна 1: Платежи, чекаут и рефералы (P0)**
  - Фикс `retryCheckoutPayment` в `src/actions/order/checkout.ts`.
  - Фикс `transferReferralBalanceAction` в `src/actions/user/referral.action.ts`.
  - Валидация тенанта в `src/services/referral/referral-validator.service.ts`.
  - Добавление `tenantId` в `cancelPayment` (`payment.service.ts`) и подсчет возвратов (`orders.ts`).

- **Волна 2: Email-транспорт и ликвидация Brand Bleeding (P0/P1)**
  - Параметризация `getTransporter(tenantId)` в `src/lib/smtp.ts`.
  - Нейтрализация дефолтной роли автора в `src/actions/knowledge.ts`.

- **Волна 3: Фоновая синхронизация кэша и прохождение линтера (P0/P1)**
  - Инвалидация `catalog-smmplan` и `catalog-flux` в `catalog.processor.ts`.
  - Устранение замечаний `scripts/lint-tenant-isolation.ts`.

---

## 4. План верификации (TDD)
1. Разработка модульного теста `src/__tests__/architecture/multitenant-checkout-and-payment-retry.test.ts` (Red -> Green).
2. Запуск сьюта изоляции `src/__tests__/multitenant-isolation.test.ts`.
3. Проверка AST-линтера: `npx tsx scripts/lint-tenant-isolation.ts`.
4. Проверка сборщика типов: `npx tsc --noEmit`.
