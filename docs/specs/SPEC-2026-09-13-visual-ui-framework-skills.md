# SPEC-2026-09-13: Visual, UI & Frameworks Architectural Skills Suite

## 1. Контекст и Проблема
В стеке платформы OmniSMM 1.0 (Next.js 16, React 19, HeroUI v3, Tailwind 4) возникают фронтенд-дефекты:
- Использование устаревшего плоского синтаксиса HeroUI v2 вместо Compound Components dot-notation.
- Игнорирование примитивов React 19 (`useActionState`, `useOptimistic`, `useFormStatus`).
- Сбои гидратации (`Hydration Mismatch`) при рендеринге дат и клиентских свойств.
- Появление горизонтального скролла на экранах 1366px и поломка Viewport 100% Fit.
- Ошибки монтирования модальных окон внутри выпадающих списков (нарушение Modal Hoisting).
- Нарушение W3C WCAG 2.2 AA (Touch Targets < 44px на мобильных устройствах).

## 2. Архитектурная декомпозиция (6 Скиллов)

### Блок 1: Визуал, Лейаут и Дизайн-Система
1. **`ui-design-system-steward`**: Токены Tailwind 4 (`@theme` в `globals.css`), строгий запрет хардкода цветов, изоляция брендов SMMplan и SMMflux.
2. **`viewport-responsive-density`**: Zero Horizontal Scroll, Viewport 100% Fit, компактная плотность таблиц данных (`px-2 py-1.5`), Modal Hoisting.
3. **`mobile-cro-interaction`**: Mobile-First UX, Touch Target Floor $\ge 44\text{px}$, numeric input auto-select, sticky CTA bar, `pb-safe`.

### Блок 2: Фреймворк и Компонентные Библиотеки
4. **`heroui-v3-compound-guard`**: Compound Components dot-notation (`<Table.Header>`, `<Modal.Content>`), controlled Selection Sets, disabled states.
5. **`react-19-next-16-ui-engine`**: React 19 Action-First (`useActionState`), Optimistic UI с 10–12s TTL таймером отката, Streaming SSR с `<Suspense>`.
6. **`client-hydration-perf-guard`**: Zero Hydration Mismatch, dynamic imports (`next/dynamic`) с `ssr: false` для графиков, First Load JS < 150 КБ, Safe SVG.

## 3. Требования к L1/L2 формату
- Каждый скилл содержит компактный L1 `CORE.md` ($\le 65$ строк) с секциями:
  * `## 🛑 HARD INVARIANTS`
  * `## ⚡ FAST RULES & FORMULAS`
  * `## 🔍 PRE-MORTEM QUICK CHECK`
- А также полный архитектурный L2 `SKILL.md` с деревьями решений.
