# client-hydration-perf-guard (L1 Core Invariants)
> **Статус:** CRITICAL GATE | **Бюджет:** < 450 токенов | **Слой:** L1 Fast Core

## 🛑 HARD INVARIANTS (КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО)
1. **Zero Hydration Mismatch:** Запрещен рендеринг локализованных дат (`toLocaleDateString()`) на сервере без `suppressHydrationWarning` или клиентского хука `useMounted()`.
2. **Lazy Heavy Components:** Графики (Recharts), тяжелые редакторы и модалки обязаны импортироваться динамически через `next/dynamic` с `{ ssr: false, loading: () => <Skeleton /> }`.
3. **First Load JS Budget:** Объем клиентского JS на страницу не должен превышать 150 КБ. Запрещен импорт монолитных пакетов (`lodash`, `moment`).
4. **Safe SVG Icons Only:** Все кастомные SVG обязаны рендериться как изолированные React-компоненты без `dangerouslySetInnerHTML`.
5. **No Window References in SSR:** Обращения к `window`, `document`, `localStorage` допустимы только внутри `useEffect` или обработчиков событий.

## ⚡ FAST RULES & FORMULAS
- Динамический график: `const Chart = dynamic(() => import('./chart'), { ssr: false, loading: () => <ChartSkeleton /> });`.
- Безопасная дата: `<time dateTime={isoDate} suppressHydrationWarning>{formattedDate}</time>`.

## 🔍 PRE-MORTEM QUICK CHECK
- [ ] Защищен ли рендеринг дат от Hydration Mismatch?
- [ ] Обернуты ли графики в `next/dynamic` с `ssr: false`?
- [ ] Нет ли прямых вызовов `window` при первой отрисовке?

---
*Для полного руководства см. [SKILL.md](./SKILL.md) (L2 Deep).*\n