# SPEC-2026-09-13: Декомпозиция монолита SmmplanOrderWizard (SDD-TDD 2026)

## 1. Контекст и Проблема
Монолит \src/components/orders/SmmplanOrderWizard.tsx\ насчитывает 1739 строк кода и объединяет в одном файле:
- Загрузку публичного каталога и сервисов по категориям.
- Синхронизацию шагов с URL SearchParams и восстановление состояния.
- Интеллектуальный анализатор ссылок (debounced 300ms).
- Расчет цен и применение промокодов (\calculatePriceAction\).
- Логику Drip-Feed (\dripRuns\, \dripInterval\, валидацию).
- Оформление заказа через Server Action \checkoutAction\.
- 4 шага визарда (соцсети, категории, услуги, чекаут) + режим быстрого ввода ссылок \UniversalOrderForm\.
- Обработку Shake-анимаций и фокуса при невалидном вводе.

Такой размер затрудняет сопровождение, нарушает лимит компонентов (<= 200 строк) согласно скиллам \lash-component-decomposer\, \ntigravity-flash-ui-refactor\ и \omnismm-checkout-integrity-guard\.

---

## 2. 7 Жестких Инвариантов Декомпозиции
1. **ExactMath Mirror:** Расчет цен на клиенте строго совпадает с бэкендом (целочисленные копейки, Half-Even).
2. **Drip-Feed Floor Invariant:** Объем заказа в Drip-Feed >= service.minQty * N.
3. **Multi-Tenant Identity Flow:** Проброс \	enantId\ в \getPublicCatalogAction\, \getServicesByCategoryAction\, \checkoutAction\.
4. **Active CTA & Shake Feedback:** Кнопка подтверждения никогда не \disabled\ при незаполненных данных (Shake-анимация + фокус).
5. **Hardening Contract Immunity:** Сохранение токенов \setShakeKey(prev => prev + 1)\, \nimate-shake\, \
ewErrors.email\, \
ewErrors.quantity\, \
ewErrors.link\ в \SmmplanOrderWizard.tsx\ для прохождения теста \swarm-100-percent-hardening.test.ts\.
6. **Zero-Props-Loss:** Сохранение всех пропсов (\userEmail\, \userBalanceCents\, \initialReorderData\, \	enantId\) и внешнего контракта \<SmmplanOrderWizard />\.
7. **Компонентный лимит:** Каждый выделяемый субкомпонент в \src/components/orders/wizard/\ обязан быть <= 200 строк.

---

## 3. Целевая Архитектура Модулей

\\\
src/components/orders/
├── SmmplanOrderWizard.tsx             # Оркестратор (< 200 строк, Shake, Submit, Routing)
└── wizard/
    ├── types.ts                       # Типы состояния, DTO, ошибки формы
    ├── helpers.ts                     # URL-нормализация, подсказки типов целей, бейджи
    ├── useSmmplanOrderWizard.ts       # Кастомный хук каталога, аналитики URL, цен и промокодов
    ├── WizardHeader.tsx               # Шапка визарда и переключатель режимов (< 70 строк)
    ├── WizardStepIndicator.tsx        # Прогресс-бар шагов 1-4 (< 60 строк)
    ├── WizardStepNetwork.tsx          # Шаг 1: Поиск и сетка соцсетей (< 90 строк)
    ├── WizardStepCategory.tsx         # Шаг 2: Поиск, категории, Smart Filter (< 140 строк)
    ├── WizardStepService.tsx          # Шаг 3: Тарифы, segmented control, бейджи (< 180 строк)
    ├── WizardStepCheckout.tsx         # Шаг 4: Форма ввода данных, Drip-Feed, оплата (< 200 строк)
    └── sub/
        ├── CheckoutLinkInput.tsx      # Поле ввода ссылки с подсказкой и модалкой (< 140 строк)
        ├── CheckoutDripFeed.tsx       # Блок параметров Drip-Feed (< 80 строк)
        └── CheckoutPaymentMethod.tsx  # Выбор шлюза (Баланс, ЮKassa, CryptoBot) (< 90 строк)
\\\

---

## 4. План Верификации
- **Unit & Integration:** \src/__tests__/orders/smmplan-order-wizard-decomposition.test.ts\ (проверка декомпозиции, экспортов, инвариантов).
- **Security & Hardening:** \src/__tests__/security/swarm-100-percent-hardening.test.ts\ (100% PASS).
- **Checkout Guard:** \src/__tests__/skills/checkout-integrity-guard.test.ts\ (100% PASS).
- **Strict TypeScript:** \
px tsc --noEmit\ (0 ошибок).
- **CI Secrets:** \
ode scripts/check-bundle-secrets.mjs\ (0 утечек).
