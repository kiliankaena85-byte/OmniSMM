# SPEC-2026-09-15: Харденинг режимов окружения и авто-сверки платежей (CDD-TDD 2026)

## Метаданные
- **Статус:** APPROVED
- **Дата:** 2026-09-15
- **Платформа:** OmniSMM 1.0 (SMMplan / SMMflux)
- **Стандарт:** Contract-Driven Development & Test-Driven Development (CDD-TDD 2026)
- **Связанные документы:** ADR-2026-18

---

## 1. Context & Business Need (Контекст и цели)

В ходе архитектурного аудита режимов окружения платформы OmniSMM 1.0 выявлены 7 критических зазоров:
1. **Зазор №1 (Cold Cache Resilience):** Потеря режимов HYBRID и ACQUIRING_TEST при сбросе Redis.
2. **Зазор №2 (Mock Gateway Bypass):** Прямой вызов YooKassaGateway в checkoutAction вместо MockGateway в режиме SANDBOX.
3. **Зазор №3 (Tenant Secret Vaulting):** Отсутствие тестовых реквизитов ЮKassa в SystemSettings БД тенанта smmplan.
4. **Зазор №4 (Hybrid Worker Collision):** Блокировка тестовых заказов в order.processor.ts в режиме HYBRID, где заказы должны отправляться реальному провайдеру.
5. **Зазор №5 (Payment Reconciliation Live Credential Leak):** Использование боевых ключей ЮKassa и хардкод isTest: false в фоновом демоне авто-сверки payment-reconciliation.ts.
6. **Зазор №6 (Demo Payment Boundary):** Разрешение фейковых демо-платежей в режиме ACQUIRING_TEST (где должен работать реальный тестовый эквайринг).
7. **Зазор №7 (Local DNS Isolation):** Перехват api.yookassa.ru локальным прокси Clash Verge.

---

## 2. Impact Radius Mapping (Радиус поражения изменений)

| Компонент | Изменение | Смежные системы под риском | Защитный барьер |
|---|---|---|---|
| src/services/financial/payment-gateway.service.ts | Поддержка опции isMockPayment в PaymentGatewayFactory.getGateway | Все оплаты и чекаут | Если isMockPayment=true и не balance, возвращается MockGateway |
| src/actions/order/checkout.ts | Передача флага isMockPayment в getGateway | Форма заказа | Изоляция сетевого шлюза в SANDBOX |
| src/workers/payment-reconciliation.ts | Динамический выбор тестовых/боевых ключей и флага isTest | Сверка платежей | Передача корректного isTest в confirmPayment |
| src/actions/order/demo-payment.action.ts | Запрет вызова при !isMockPaymentEnabled | Демо-платежи | Блокировка в ACQUIRING_TEST и PRODUCTION |
| src/workers/processors/order.processor.ts | Проверка isMockProviderEnabled вместо бинарного isTestMode | Исполнение заказов | Заказы в HYBRID исполняются реальным поставщиком |

---

## 3. Pre-Mortem Failure Simulation (Моделирование отказов)

| № | Сценарий гипотетического отказа | Вероятность x Влияние | Защитный механизм в коде |
|---|---|---|---|
| 1 | Рестарт Redis в процессе тестового прогона: Режим сбрасывается в SANDBOX | Средняя (3) x Высокая (4) = 12 | Режим сохраняется с персистентным ключом |
| 2 | Авто-сверка подтверждает тестовый платеж как боевой | Высокая (4) x Критическое (5) = 20 | payment-reconciliation.ts проверяет isTestMode тенанта платежа |
| 3 | Воркер отправляет тестовый заказ реальному поставщику | Средняя (3) x Критическое (5) = 15 | providerService.getWorkerProviderInstance перенаправляет на mock |

---

## 4. Plan: Red Phase -> Green Phase -> Verification

1. Red Phase: Написание тестов в `src/__tests__/unit/environment-modes-reconciliation.test.ts`.
2. Green Phase: Внедрение исправлений в `payment-gateway.service.ts`, `checkout.ts`, `payment-reconciliation.ts`, `demo-payment.action.ts`, `order.processor.ts`.
3. Verification: `vitest` pass, `tsc --noEmit` pass, `check-bundle-secrets.mjs` pass.
