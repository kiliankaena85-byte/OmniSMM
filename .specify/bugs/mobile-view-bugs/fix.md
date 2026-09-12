# Bug Fix Report: mobile-view-bugs

**Bug Slug:** `mobile-view-bugs`  
**Assessment Reference:** `.specify/bugs/mobile-view-bugs/assessment.md`  
**Status:** `RESOLVED`  
**Date:** 2026-09-12  

---

## 1. Overview of Fixes Applied

Все 5 дефектов адаптивности и мобильного UX в интерфейсе OmniSMM 1.0 полностью устранены:

| ID | Дефект | Затронутые файлы | Реализованное исправление |
|---|---|---|---|
| **BUG-01** | Горизонтальный дефицит хедера при авторизованном пользователе | `src/components/landing/Header.tsx` | Кнопки «Личный кабинет» и «Выйти» скрыты на мобильных экранах (`hidden sm:flex`). На экранах `< 640px` все действия пользователя вынесены в компактное гамбургер-меню (`DropdownMenu`). |
| **BUG-02** | Повторные циклические запросы шлюзов в `MobileStep4Checkout` | `src/components/landing/order-engine/wizard-steps/MobileStep4Checkout.tsx` | `useEffect` переведен на однократную инициализацию на mount (`[]`) с защитой через флаг `isMounted` для отмены setState при unmount. Исключены паразитные ре-фетчи `getAvailableGatewaysAction()` при переключении `selectedGateway`. |
| **BUG-03** | Ломаная динамическая интерполяция классов в сетке платежей | `src/components/landing/order-engine/wizard-steps/MobileCheckoutGateways.tsx` | Динамическая конкатенация `sm:grid-cols-${gateways.length}` заменена на детерминированные статические ветки классов Tailwind 4: `grid-cols-2 sm:grid-cols-3` / `grid-cols-2 sm:grid-cols-4`. |
| **BUG-04** | Перекрытие нижнего контента плавающим `MobileStickyCTA` | `src/components/landing/order-engine/MobileWizard.tsx` | Основной мобильный контейнер визарда получил безопасный нижний отступ `pb-28`, предотвращающий перекрытие поля промокода, чекбоксов и кнопок плавающей панелью `fixed bottom-0`. |
| **BUG-05** | Монолитный `MobileStep1Link.tsx` (308 строк) превышал норматив $\le 200$ строк | `src/components/landing/order-engine/wizard-steps/MobileStep1Link.tsx`, `MobileStep1DetectionBadge.tsx`, `MobileStep1Summary.tsx`, `MobileStep1CatalogActions.tsx` | Файл декомпозирован на 3 изолированных субкомпонента. Размер `MobileStep1Link.tsx` сокращен до **197 строк**, каждый субкомпонент занимает $\le 55$ строк. Архитектурный инвариант Clean Architecture строго выполнен. |

---

## 2. Architectural Invariants Preserved

1. **Компонентная гигиена (`arch-boundary-guard`):**
   - Все затронутые React-компоненты имеют длину $\le 200$ строк (`MobileStep1Link.tsx` = 197 строк).
2. **Tailwind CSS 4.0 Compatibility:**
   - Полное отсутствие динамических строковых шаблонов классов. Все классы статически резолвятся компилятором `@theme`.
3. **WCAG 2.2 AA Touch Targets:**
   - Все интерактивные кнопки визарда и хедера имеют размеры $\ge 44 \times 44\text{ px}$.
4. **Zero State Flashing:**
   - Состояния сетевых шлюзов и детекции ссылок отображаются плавно без скачков макета и ре-рендеров.

---

## 3. Verification & Quality Gates

- **Vitest Suite (`mobile-wizard-hygiene.test.ts`):**  
  `✓ src/__tests__/architecture/mobile-wizard-hygiene.test.ts (5 tests) — PASS`
- **TypeScript Strict Compilation:**  
  `npx tsc --noEmit` — 0 ошибок.
- **CI Secrets Audit:**  
  `node scripts/check-bundle-secrets.mjs` — 0 запрещенных секретов и бэкдоров.

---

## 4. Modified Files Checklist

- [x] `src/components/landing/Header.tsx`
- [x] `src/components/landing/order-engine/wizard-steps/MobileStep4Checkout.tsx`
- [x] `src/components/landing/order-engine/wizard-steps/MobileCheckoutGateways.tsx`
- [x] `src/components/landing/order-engine/MobileWizard.tsx`
- [x] `src/components/landing/order-engine/wizard-steps/MobileStep1Link.tsx`
- [x] `src/components/landing/order-engine/wizard-steps/MobileStep1DetectionBadge.tsx` [NEW]
- [x] `src/components/landing/order-engine/wizard-steps/MobileStep1Summary.tsx` [NEW]
- [x] `src/components/landing/order-engine/wizard-steps/MobileStep1CatalogActions.tsx` [NEW]
- [x] `src/__tests__/architecture/mobile-wizard-hygiene.test.ts` [NEW]
- [x] `vitest.unit.config.ts`
