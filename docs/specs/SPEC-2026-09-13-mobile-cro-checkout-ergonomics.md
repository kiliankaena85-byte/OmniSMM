# SPEC-2026-09-13: Мобильный чекаут и тач-эргономика витрин SMMplan и SMMflux

## 1. Контекст и цели
В соответствии со стандартами платформы OmniSMM 1.0 (AGENTS.md, RLS-2026, WCAG 2.2 Level AA), мобильные пользователи составляют более 75% общего трафика платформы.
Цель данной спецификации — обеспечить эталонную тач-эргономику, исключить миссклики, предотвратить баги мобильных браузеров (iOS Safari Auto-Zoom) и зафиксировать бизнес-инвариант Drip-Feed Floor на экранах оформления заказа обеих витрин: **SMMplan** (`smmplan.pro`) и **SMMflux** (`smmflux.ru`).

---

## 2. Нормативные инварианты (Hard Invariants)

### 2.1. Touch Target Floor (WCAG 2.2 AA Success Criterion 2.5.8)
- Все интерактивные элементы (кнопки степпера `–`/`+`, переключатели Drip-Feed, кнопки открытия подсказок, чекбоксы чек-листа, карточки платежных шлюзов, кнопка отправки формы) обязаны иметь физическую область касания не менее **$44 \times 44\text{px}$**.
- Зазор между соседними интерактивными тач-таргетами обязан составлять не менее **$8\text{px}$** (`gap-2`), предотвращая случайные нажатия смежных кнопок при работе одной рукой.

### 2.2. iOS Safari Auto-Zoom Guard (Font Floor $\ge 16\text{px}$)
- Все поля ввода (`<input>`, `<textarea>`) на мобильных экранах (`< 640px`) обязаны иметь размер шрифта **$\ge 16\text{px}$** (`text-base sm:text-sm`).
- Не допускается использование `text-sm` (14px) или `text-xs` (12px) на мобильных инпутах, так как это вызывает принудительный зум всего экрана в WebKit / iOS Safari.

### 2.3. Zero Horizontal Scroll (Дельта переполнения = 0px)
- На всех целевых мобильных вьюпортах:
  - **360 x 800** (Бюджетные и стандартные Android-устройства)
  - **375 x 667** (iPhone SE, компактные смартфоны)
  - **390 x 844** (iPhone 14/15/16 Pro, флагманские смартфоны)
  дельта горизонтального переполнения обязана быть строго **$0\text{px}$** (`document.documentElement.scrollWidth <= window.innerWidth`).

### 2.4. Drip-Feed Floor Invariant (DDD & Billing Integrity)
- При включении Drip-feed порция объема на один запуск обязана удовлетворять условию:
  $$\lfloor Q / N \rfloor \ge \text{service.minQty}$$
- Минимальный суммарный объем заказа обязан быть не менее:
  $$Q_{\text{total}} \ge \text{service.minQty} \times N$$
- При включении тумблера Drip-Feed или изменении количества запусков $N$, поле объема автоматически масштабируется до расчетного минимума, исключая отправку некорректных заказов на шлюзы поставщиков.

---

## 3. Архитектурный скоуп изменений

### 3.1. Витрина SMMplan
1. `src/components/orders/wizard/WizardStepCheckout.tsx`:
   - Кнопки степпера `–`/`+`: класс `w-11 h-11 min-w-[44px] min-h-[44px] gap-2`.
   - Поля ввода (`order-url`, `quantity`, `customData`, `email`, `promo`): класс `text-base sm:text-sm`.
   - Вспомогательные кнопки («Изменить», «Как скопировать ссылку?», «Есть промокод?»): область тапа $\ge 44\text{px}$.
   - Чек-лист подтверждения: контейнер-лейбл с `min-h-[44px] flex items-center`.
2. `src/components/orders/wizard/sub/CheckoutDripFeed.tsx`:
   - Контейнер тумблера Drip-Feed: `min-w-[44px] min-h-[44px] flex items-center justify-center`.
   - Инпуты запусков и интервала: `text-base sm:text-sm min-h-[44px]`.
   - Drip-Feed Floor auto-scale: при включении гарантирует `quantity >= selectedService.minQty`.
3. `src/components/orders/wizard/sub/CheckoutPaymentMethod.tsx`:
   - Кнопки шлюзов: `min-h-[52px]` с защитой от сжатия.

### 3.2. Витрина SMMflux
1. `src/components/ab-test/FluxOrderClient.tsx`:
   - Кнопки навигации и очистки ссылки: `min-w-[44px] min-h-[44px]`.
   - Кнопка подтверждения ссылки: `w-11 h-11 min-w-[44px] min-h-[44px]`.
   - Поля ввода (`quantity`, `customData`, `link`, `email`): `text-base sm:text-sm`.
   - Тумблер Drip-Feed: тач-контейнер `min-w-[44px] min-h-[44px] flex items-center justify-center`.
   - Инпуты Drip-Feed: `text-base sm:text-sm min-h-[44px]`.
   - Автоматическое масштабирование до минимума при включении Drip-Feed.

---

## 4. План верификации и контрольные тесты
1. **Unit-тесты контракта и инвариантов:** `src/__tests__/orders/mobile-checkout-cro-ergonomics.test.ts`.
2. **Playwright замеры физической геометрии в реальном браузере Chromium:** `scripts/mobile/audit-mobile-checkout-cro.ts`.
   - 3 вьюпорта: 360px, 375px, 390px.
   - 2 витрины: SMMplan и SMMflux.
   - Замер `scrollWidth - innerWidth` (ожидается строго 0).
   - Замер `boundingBox` всех кнопок степпера и тумблеров (ожидается `width >= 44 && height >= 44`).
   - Замер `fontSize` всех инпутов на мобильных устройствах (ожидается `fontSize >= 16px`).
   - Снятие доказательных скриншотов в `.planning/mobile_visuals/`.
3. **Отчет аудита:** `docs/audits/MOBILE_CHECKOUT_CRO_REPORT.md`.
4. **Статический аудит и сборка:** `npx tsc --noEmit` и `node scripts/check-bundle-secrets.mjs`.
