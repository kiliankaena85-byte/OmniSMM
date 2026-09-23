# SPEC-2026-09-13: OmniSMM Checkout Integrity Guard

## 1. Metadata
- **Status:** APPROVED
- **Author:** Principal Fullstack Systems Analyst & Lead Architect
- **Risk-Tier:** Tier 1 (Critical Financial, Order Flow & UI Integrity Skill)
- **Target Stack:** Next.js 16 (App Router), React 19, ExactMath, Drip-Feed Engine, Tailwind CSS 4, HeroUI v3

---

## 2. Problem Statement & Motivation
На бэкенде платформы OmniSMM 1.0 реализована бескомпромиссная финансовая и архитектурная безопасность (ACID Ledger-First, BigInt ExactMath, BullMQ).
Однако фронтенд-компоненты оформления заказов и визарды представляют собой огромные монолиты (`SmmplanOrderWizard.tsx` — 1739 строк, `FluxDashboardOrderWizard.tsx` — 60 КБ), где бизнес-правила бэкенда соприкасаются с версткой React 19 и мобильным интерфейсом.
При создании и рефакторинге этих компонентов возникают риски:
- Дрейф копеек (Float Drift): разница в 1 коп. между UI и сервером из-за `Math.ceil(price * 100 * qty)`.
- Drip-Feed Floor Asymmetry: декремент объема ниже `service.minQty * runs`, приводящий к ошибке чекаута.
- Потеря `tenantId` при вызове Server Actions.
- Заблокированные (disabled) кнопки, скрывающие причины валидации.
- Проблемы мобильного тача (перекрытие полей плавающим CTA, отсутствие `numeric` инпутов, зум на iOS).

Скилл `omnismm-checkout-integrity-guard` закрепляет 7 жестких инвариантов для любого рефакторинга и создания компонентов витрин и чекаута.

---

## 3. Core Architectural Invariants

### 3.1. INV-1: ExactMath Mirror & Zero Float Drift
- Запрещено вычислять стоимость заказа в клиенте через `price * qty` с `toFixed(2)`.
- Расчет в клиенте обязан зеркалировать серверный `ExactMath`: перевод в копейки (`rublesToKopecks`), умножение в целых числах и канонический формат `₽ / шт`.

### 3.2. INV-2: Drip-Feed Floor Dynamic Synchronizer
- При переключении Drip-Feed ($N$ запусков) минимальный порог объема обязан автоматически повышаться:
  `minQty_total = service.minQty * N`.
- Запрещено позволять пользователю уменьшить объем ниже этого порога; в UI выводится явная подсказка.

### 3.3. INV-3: Explicit Tenant Binding & Zero Brand Bleeding
- Все формы чекаута обязаны явно пробрасывать `tenantId` в вызов `checkoutAction({ ..., tenantId })`.
- Запрещено подмешивать токены или компоненты SMMplan (`<Plan*>`) в витрину SMMflux и наоборот.

### 3.4. INV-4: Active CTA & Non-Blocking Validation Protocol
- Кнопки отправки заказа НИКОГДА не должны быть `disabled`.
- При невалидной форме клик вызывает шейк-анимацию (`animate-shake`), плавный скролл к ошибке и вывод текста ошибки непосредственно над кнопкой CTA.

### 3.5. INV-5: Mobile Ergonomics & Focus Auto-Select
- Все числовые поля используют `type="text"`, `inputMode="numeric"`, `pattern="[0-9]*"` и авто-выделение при тапе (`onFocus select`).
- Размер шрифта инпутов строго >= 16px на мобильных экранах (защита от зума iOS).
- Контейнер визарда на мобильных устройствах обязан иметь отступ `pb-28` при наличии плавающей панели `MobileStickyCTA`.

### 3.6. INV-6: HeroUI v3 Compound & Modal Hoisting Protocol
- Компоненты используют синтаксис HeroUI v3 dot-notation (`<Table.Header>`, `<Modal.Content>`).
- Контролируемый выбор `selectedKeys` строго через `Set<Key>`.
- Все модалки выносятся на верхний уровень дерева страницы (Modal Hoisting).

### 3.7. INV-7: React 19 Action Purity & Size Budget (<= 200 lines)
- Использование `useActionState` и `useTransition` вместо ручных лоадеров `useState(false)`.
- Декомпозиция монолитов на субкомпоненты объемом <= 200 строк с сохранением единого контракта пропсов.

---

## 4. Verification & Testing Strategy
- Unit-тесты контрактов в `src/__tests__/skills/checkout-integrity-guard.test.ts`.
- Тесты маршрутизации через JIT Router `routeSkillIntent`.
- Проверка типов `tsc --noEmit`, аудит секретов и валидация пакета (71/71).
