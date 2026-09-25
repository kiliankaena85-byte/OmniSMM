# CORE: client-hydration-perf-guard (React 19 & Zero CLS Guard)

## 🛑 HARD INVARIANTS
1. **Zero CLS (< 0.05):** Все изображения, видео и скелетоны `Suspense` обязаны иметь фиксированное геометрическое резервирование (`aspect-*`, `min-h-*`), исключая сдвиги макета при рендере.
2. **Strict HTML5 Nesting:** Категорический запрет `<button>` в `<button>`, `<p>` в `<p>`, `<a>` в `<a>`. Использовать паттерн `asChild` (Radix/HeroUI) для вложенных триггеров.
3. **SSR Date/Time Isolation:** Динамические даты и часовые пояса обязаны содержать атрибут `suppressHydrationWarning` или рендериться строго после монтирования (`mounted`).
4. **SVG Collision Guard:** Все `clipPath`, `linearGradient` и маски в SVG обязаны иметь уникальные префиксированные ID, предотвращая конфликт стилей при гидратации.
5. **Fail-Closed Boundaries:** Каждая критическая секция оборачивается в `<ErrorBoundary>` с изолированным fallback-UI.