# CORE: layout-overflow-sentry — Детектор и авто-исправитель верстки (RLS-2026)
> **Назначение:** Поиск и авто-исправление поплывшей верстки, DOM-вложенности и переполнений (Auto-Healer & MCP).

## 5 Железных инвариантов верстки
1. **Zero Horizontal Scroll:** Запрет `w-screen` (только `w-full max-w-full`). Flex-потомкам с `truncate` обязателен `min-w-0`.
2. **Zero-Squash Icons:** Все иконки Lucide, SVG, аватарки во flex-строках обязаны иметь класс `shrink-0`.
3. **Touch & iOS Auto-Zoom Guard:** Шрифты `<input>` на мобилках $\ge 16\text{px}$ (`text-base sm:text-sm`). Использовать `dvh` и `pb-safe`.
4. **DOM Nesting & Modal Hoisting:** Запрещены `<button>` в `<button>`, `<a>` в `<a>`, `<p>` в `<p>`, модалки в `overflow-hidden`.
5. **Table 100% Width Fit:** Запрещен широкий `min-w-[1200px]` в таблицах. Лимит 7–8 колонок, плотность `px-2 py-1.5`.

## Команды аудита, лечения и MCP
```bash
npm run layout:audit       # Аудит компонентов и AST вложенности
npm run layout:fix         # Авто-исправление верстки (Auto-Healer Codemod)
npm run layout:heal        # Просмотр исправлений в режиме dry-run
npm run layout:mcp         # Model Context Protocol сервер для ИИ-агентов
```
