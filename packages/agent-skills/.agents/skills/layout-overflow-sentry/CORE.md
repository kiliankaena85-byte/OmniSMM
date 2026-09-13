# CORE: layout-overflow-sentry — Детектор поплывшей верстки и переполнений
> **Назначение:** Обнаружение и устранение горизонтального скролла, сплющенных элементов и дефектов верстки на смартфонах и мониторах.

## 5 Железных инвариантов верстки
1. **Zero Horizontal Scroll:** `scrollWidth <= innerWidth`. Любой `w-[Xpx]` обязан иметь `max-w-full`; во flex-контейнерах обязателен `min-w-0`.
2. **Zero-Squash Icons:** Все иконки Lucide, SVG, аватарки и бейджи во flex-строках обязаны иметь класс `shrink-0`.
3. **Touch & iOS Auto-Zoom Guard:** Шрифты `<input>` на мобилках $\ge 16\text{px}$ (`text-base sm:text-sm`). Использовать `dvh` вместо `vh` и `pb-safe`.
4. **Modal & Popover Hoisting:** Запрещен `overflow-hidden` вокруг Dropdown/Popover без рендеринга через Portal в `document.body`.
5. **Table 100% Width Fit:** Запрещен фиксированный `min-w-[1200px]` в таблицах. Лимит 7–8 колонок, компактная плотность `px-2 py-1.5`.

## Команда аудита
```bash
npm run layout:audit                   # Полный аудит компонентов и DOM
npm run layout:audit -- --scan-code    # Только статический анализ кода
npm run layout:audit -- --viewport 375 # Тест вьюпорта мобильного экрана
```
