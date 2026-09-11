# SPEC-2026-09-11: Устранение дефектов аудита Maker-Checker (Clean Code & Decomposition)

- **Статус:** APPROVED by Checker (`cohere/north-mini-code:free`, Score: 10/10)
- **Уровень риска:** Tier 2: Standard (Архитектурный рефакторинг UI-компонентов и типизация клиентского чекаута)
- **Автор / Инициатор:** Antigravity (Maker-Agent) / Запрос пользователя
- **Профильные скиллы:** 
  - [`arch-boundary-guard`](file:///c:/Users/Shadow/Documents/SMM/.agents/skills/arch-boundary-guard/SKILL.md) — лимит $\le 200$ строк на компонент, разделение DTO/UI, Clean Architecture.
  - [`maker-checker-protocol`](file:///c:/Users/Shadow/Documents/SMM/.agents/skills/maker-checker-protocol/SKILL.md) — устранение блокеров ревизора, 5-векторная матрица вето.
  - [`impact-blast-radius`](file:///c:/Users/Shadow/Documents/SMM/.agents/skills/impact-blast-radius/SKILL.md) — картирование зависимостей и сохранение обратной совместимости.

---

## 1. Контекст и Бизнес-требования

Независимый AI-ревизор (`cohere/north-mini-code:free` в рамках Maker-Checker Protocol) выявил критические несоответствия контракту платформы:
1. **3 Архитектурных блокера (Vector 5: Architecture & NFR):**
   - `SmartLinkLanding.tsx` разросся до 556 строк (лимит $\le 200$).
   - `PlanFullscreenCheckout.tsx` разросся до 706 строк (лимит $\le 200$).
   - `MobileStep4Checkout.tsx` разросся до 601 строки (лимит $\le 200$).
2. **15 Мажорных дефектов чистоты кода (Vector 4: Code Hygiene):**
   - 6 мест использования нетипизированного `(res.data as any)?.redirectUrl` в `useCheckoutOrchestrator.ts`.
   - 9 мест подавления линтера через `// eslint-disable-next-line @typescript-eslint/no-unused-vars` (вместо удаления неиспользуемых переменных и использования optional catch binding `catch { }`).
3. **1 Минорный дефект дизайн-системы (No-Crutch Policy):**
   - Использование хардкодного цвета `text-white` и `bg-emerald-500` в бейдже баланса `MobileStep4Checkout.tsx:513` вместо семантического токена `bg-success text-success-foreground`.

**Бизнес-цель:** Полное устранение замечаний ревизора, обеспечение 100% стабильности пользовательского чекаута (десктоп и мобайл) и получение вердикта `PASS (10/10)` при повторном аудите Maker-Checker.

---

## 2. Трехфазный план реализации (3-Phase Architecture)

### Фаза 1: Чистота типов и дизайн-токенов (Code Hygiene & Type Safety)
1. **Строгая типизация `OrderCheckoutResultData` в `useCheckoutOrchestrator.ts`:**
   Вместо приведения к `any` фиксируется интерфейс ответа:
   ```typescript
   export interface OrderCheckoutResultData {
     orderId?: string;
     numericId?: string | number;
     paymentUrl?: string;
     paymentId?: string;
     redirectUrl?: string;
     guestOrderToken?: string;
   }
   ```
2. **Очистка неиспользуемых деструктуризаций в `SmartLinkLanding.tsx`:**
   Удаление неиспользуемых переменных `networkId`, `categoryId`, `customData`, `agreedToTerms`, `availableCategories`, `isCalculating`, `totalPriceFormatted` из деструктуризации хука `engine`. Удаление неиспользуемого импорта `SocialIcon`.
3. **Переход на ES2019+ Optional Catch Binding:**
   В `useCheckoutOrchestrator.ts` замена `catch (e)` на `catch` без подавления линтера.
4. **Семантический токен в `MobileStep4Checkout.tsx`:**
   Замена `bg-emerald-500 text-white` на семантический `bg-success text-success-foreground`.

---

### Фаза 2: Архитектурная декомпозиция компонентов (Decomposition $\le 200$ lines)

#### 2.1. Декомпозиция `SmartLinkLanding.tsx` (556 строк $\to \le 180$ строк)
Вынесение тяжелых модальных окон и секций в изолированные модули:
1. `src/components/landing/LandingCatalogModal.tsx` (~130 строк):
   - Модальное окно полного каталога услуг с поиском и переключением категорий.
2. `src/components/landing/LandingLegalModal.tsx` (~80 строк):
   - Модальное окно просмотра публичных правовых документов (Оферта, Политика, 54-ФЗ).
3. `src/components/landing/LandingHeroArea.tsx` (~140 строк):
   - Заголовок, подзаголовок, интерактивное поле ввода ссылки HeroInput и динамические предупреждения.
4. `src/components/landing/SmartLinkLanding.tsx` (Основной координирующий шелл, сокращается до ~150 строк).

#### 2.2. Декомпозиция `PlanFullscreenCheckout.tsx` (706 строк $\to \le 180$ строк)
Вынесение логических зон десктопного полноэкранного чекаута:
1. `src/components/landing/order-engine/variants/PlanCheckoutHeader.tsx` (~90 строк):
   - Кнопки «Назад», «Сбросить», бейджи категории, платформы и скорости (ETA).
2. `src/components/landing/order-engine/variants/PlanCheckoutInputs.tsx` (~150 строк):
   - Поля ввода ссылки, объема заказа, степпер, Drip-Feed переключатель и предупреждения.
3. `src/components/landing/order-engine/variants/PlanCheckoutGateways.tsx` (~140 строк):
   - Сетка платежных шлюзов (ЮKassa, СБП, Robokassa, CryptoBot, Баланс) с бейджами комиссий.
4. `src/components/landing/order-engine/variants/PlanFullscreenCheckout.tsx` (Оркестратор, сокращается до ~150 строк).

#### 2.3. Декомпозиция `MobileStep4Checkout.tsx` (601 строка $\to \le 180$ строк)
Вынесение модулей мобильного шага оформления:
1. `src/components/landing/order-engine/wizard-steps/MobileCheckoutGateways.tsx` (~140 строк):
   - Мобильный селектор платежных шлюзов с бейджами скидок и подсветкой достаточности баланса.
2. `src/components/landing/order-engine/wizard-steps/MobileCheckoutSummary.tsx` (~120 строк):
   - Блок расчета итоговой цены, скидок, промокода и чекбокса условий оферты.
3. `src/components/landing/order-engine/wizard-steps/MobileCheckoutInputs.tsx` (~130 строк):
   - Поле контакта/email, аккордеон расширенных параметров и Drip-Feed.
4. `src/components/landing/order-engine/wizard-steps/MobileStep4Checkout.tsx` (Главный контейнер шага, сокращается до ~120 строк).

---

### Фаза 3: Верификация, AST Guardrails и Maker-Checker Gate
1. **Прогон регрессионного сьюта тестов:**
   - Vitest Unit тесты типизации оркестратора.
   - Vitest DOM Smoke тесты рендеринга декомпозированных компонентов.
2. **Прогон AST Guardrails:**
   - `npm run lint:guardrails` — 0 нарушений архитектурных границ.
3. **Компиляция TypeScript:**
   - `npx tsc --noEmit` — строго 0 ошибок.
4. **Повторный аудит Maker-Checker:**
   - `npm run audit:maker-checker:full` с моделью ревизора.
   - Критерий приемки: **Verdict: PASS (10/10)**, 0 Blockers, 0 Majors.

---

## 3. Матрица граничных условий (Edge Cases Matrix)

| Сценарий | Входные данные | Ожидаемое поведение | Механизм защиты |
| :--- | :--- | :--- | :--- |
| **Оплата с баланса (redirectUrl)** | Ответ от Server Action содержит `redirectUrl` без `paymentUrl` | Редирект в личный кабинет `/dashboard/orders?...` без ошибки `any` | Строгий тип `OrderCheckoutResultData` |
| **Гостевой заказ (guestOrderToken)** | Ответ содержит `guestOrderToken` | Токен сохраняется в `localStorage`, добавляется в URL success-экрана | Защитный try/catch и строгая проверка типов |
| **Пул шлюзов недоступен** | Ошибка загрузки списка шлюзов (`res.data = null`) | Fallback на `yookassa` по умолчанию без краша рендеринга | Null-safety операторы `res.data?.[gateway]` |
| **Смена разрешения Viewport** | Переход с Mobile на Desktop во время открытого чекаута | Сохранение состояния формы в `OrderEngine` без потери введенных данных | Единый контекст `useOrderEngine` |

---

## 4. План тестирования (TDD Red Phase)

Перед внесением изменений в продуктовый код создаются 2 тестовых файла:
1. `src/__tests__/order-engine/checkout-orchestrator-types.test.ts`:
   - Проверяет типизацию результатов Server Actions без приведения к `any`.
   - Проверяет корректность обработки успешных сценариев (`paymentUrl`, `redirectUrl`, `orderId`).
2. `src/__tests__/architecture/component-size-hygiene.test.ts`:
   - Проверяет, что файлы `SmartLinkLanding.tsx`, `PlanFullscreenCheckout.tsx` и `MobileStep4Checkout.tsx` имеют $\le 200$ строк.
   - Проверяет отсутствие вхождений `as any` и `eslint-disable-next-line @typescript-eslint/no-unused-vars`.
   - На начальном этапе (Red Phase) этот тест **обязан упасть**, фиксируя текущее состояние (> 500 строк).

---

## 5. Затрагиваемые файлы и Радиус поражения

- **Новые файлы:**
  - `src/components/landing/LandingCatalogModal.tsx`
  - `src/components/landing/LandingLegalModal.tsx`
  - `src/components/landing/LandingHeroArea.tsx`
  - `src/components/landing/order-engine/variants/PlanCheckoutHeader.tsx`
  - `src/components/landing/order-engine/variants/PlanCheckoutInputs.tsx`
  - `src/components/landing/order-engine/variants/PlanCheckoutGateways.tsx`
  - `src/components/landing/order-engine/wizard-steps/MobileCheckoutGateways.tsx`
  - `src/components/landing/order-engine/wizard-steps/MobileCheckoutSummary.tsx`
  - `src/components/landing/order-engine/wizard-steps/MobileCheckoutInputs.tsx`
  - `src/__tests__/order-engine/checkout-orchestrator-types.test.ts`
  - `src/__tests__/architecture/component-size-hygiene.test.ts`
- **Модифицируемые файлы:**
  - `src/components/landing/SmartLinkLanding.tsx`
  - `src/components/landing/order-engine/variants/PlanFullscreenCheckout.tsx`
  - `src/components/landing/order-engine/wizard-steps/MobileStep4Checkout.tsx`
  - `src/components/landing/order-engine/useCheckoutOrchestrator.ts`
