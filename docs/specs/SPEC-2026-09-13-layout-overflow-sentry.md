# SPEC-2026-09-13-LAYOUT-OVERFLOW-SENTRY (v2.0 Deep Healer & MCP)

## 1. Назначение и контекст
Платформа OmniSMM 1.0 (SMMplan / SMMflux) обслуживает пользователей на широком спектре клиентских устройств: от компактных смартфонов (iPhone SE 375px, бюджетные Android 360px) до ультрашироких 4K-мониторов.
Любые дефекты верстки («поплывшие» элементы, горизонтальный скроллинг, сплющенные иконки, некорректная DOM-вложенность, наложение слоев и обрезание дропдаунов) резко снижают конверсию (CRO) и нарушают пользовательский опыт.
Скилл **`layout-overflow-sentry`** представляет собой глубокий архитектурный комбайн, включающий:
1. **TypeScript AST & Regex сканер** для детекции нарушений.
2. **Auto-Healer Codemod Engine** для мгновенного автоматического устранения дефектов в кодовой базе.
3. **Model Context Protocol (MCP) Server** для автономного использования ИИ-агентами по стандарту JSON-RPC 2.0.
4. **Нормативный стандарт верстки RLS-2026** (`docs/standards/RESPONSIVE_LAYOUT_STANDARD_2026.md`).

---

## 2. 5 Железных инвариантов верстки (Layout Hard Invariants)

1. **Zero Horizontal Scroll Invariant:**
   - Ширина содержимого `document.documentElement.scrollWidth` обязана быть $\le \text{window.innerWidth}$.
   - Запрещен `w-screen` (вызывает появление горизонтального скроллбара в Windows/Linux). Обязательно: `w-full max-w-full`.
   - Внутри flex-контейнеров с текстовыми или гибкими дочерними элементами обязателен класс `min-w-0`.
   - Неразрывные строки (email, хеши, ссылки, токены) обязаны иметь `truncate` или `break-all` / `break-words`.

2. **Zero-Squash Element Invariant:**
   - Все векторные иконки (Lucide, SVG), аватарки, статусные бейджи и кнопки степперов внутри flex-контейнеров обязаны содержать класс `shrink-0`.

3. **Touch Ergonomics & iOS Viewport Invariant:**
   - Размер шрифта в полях ввода `<input>`, `<textarea>`, `<select>` на мобильных устройствах обязан быть $\ge 16\text{px}$ (`text-base sm:text-sm`), чтобы предотвратить принудительный зум в iOS Safari.
   - Полноэкранные высоты используют `min-h-dvh` или `h-dvh` вместо `h-screen` / `100vh`.
   - Нижние плавающие панели используют безопасные отступы `pb-safe` / `env(safe-area-inset-bottom)`.

4. **DOM Nesting & Modal Hoisting Invariant:**
   - Строгий запрет невалидной вложенности HTML5: `<button>` внутри `<button>`, `<a>` внутри `<a>`, `<p>` внутри `<p>`.
   - Запрещено вешать класс `overflow-hidden` на родительский контейнер, содержащий дропдауны или поповеры, если они не рендерятся через `Portal` в `document.body`.

5. **Responsive Grid & Table Invariant:**
   - Никаких раздутых фиксированных ширин таблиц (`min-w-[1200px]`). Таблицы обязаны масштабироваться по ширине экрана (`w-full`).
   - Лимит видимых колонок на экранах $< 1280\text{px}$ — не более 7–8. Вторичные поля выносятся в Tooltip или модальные окна деталей.

---

## 3. Матрица брейкпоинтов и устройств
| Профиль | Разрешение | Типичные устройства | Проверяемые риски |
|---|---|---|---|
| **Mobile Compact** | `375 x 667` | iPhone SE, компактные Android | Переполнение Bento-карточек, сжатие кнопок, перенос букв |
| **Mobile Standard** | `390 x 844` | iPhone 14/15/16, Galaxy S23 | Touch target $\ge 44$px, iOS Auto-Zoom, Safe Area Inset |
| **Tablet** | `768 x 1024` | iPad Mini / Air, планшеты | Сетка 2 колонки vs 3 колонки, сайдбар overlay vs static |
| **Laptop Budget** | `1366 x 768` | 14"–15.6" ноутбуки в РФ | Таблицы админки, отсутствие горизонтального скролла |
| **Desktop Full** | `1920 x 1080` | Full HD мониторы | Разреженность, центрирование `max-w-7xl mx-auto` |

---

## 4. Архитектура Auto-Healer Codemod (`scripts/ui/layout-healer.ts`)
- **Режимы работы:**
  - `--fix`: безопасное внесение изменений в исходные `.tsx` файлы.
  - `--dry-run`: предварительный просмотр диффов без записи на диск.
  - `--check`: проверка для CI с кодом возврата 1 при наличии дефектов.
  - `--scope=<path>`: ограничение области действия конкретным каталогом или файлом.
- **Типы автоматических исправлений:**
  1. `INJECT_SHRINK_0`: добавление `shrink-0` к SVG/Lucide элементам во flex-контейнерах.
  2. `REPLACE_W_SCREEN`: замена `w-screen` на `w-full max-w-full`.
  3. `ADD_MIN_W_0`: добавление `min-w-0` к элементам с `truncate` во flexbox.
  4. `FIX_IOS_INPUT_ZOOM`: повышение `text-xs` в `<input>` до `text-base sm:text-xs`.
  5. `TABLE_W_FULL`: замена тяжелых `min-w-[1000px]` таблиц на `w-full`.

---

## 5. Model Context Protocol (MCP) Server (`scripts/ui/layout-mcp-server.ts`)
- Протокол: JSON-RPC 2.0 stdio transport.
- Предоставляет инструменты для ИИ-агентов (Antigravity, Cursor, Claude Code):
  - `layout_audit`: сканирование AST и регулярных выражений компонентов.
  - `layout_autofix`: запуск авто-лечения кодовой базы.
  - `layout_dom_probe`: headless браузерный замер геометрии реального DOM на порту 3000/3005.

---

## 6. Верификация и приемочные критерии
- [x] Стандарт верстки `docs/standards/RESPONSIVE_LAYOUT_STANDARD_2026.md` утвержден.
- [x] L1 `CORE.md` $\le 25$ строк (18 строк).
- [x] L2 `SKILL.md` содержит полные инструкции, Mermaid диаграмму и стандарты.
- [x] Набор автоматических тестов `src/__tests__/skills/layout-overflow-sentry.test.ts` (10/10 PASS — 100%).
- [x] TypeScript Strict Mode: `npx tsc --noEmit` (0 ошибок).
- [x] Безопасность бандла: `node scripts/check-bundle-secrets.mjs` (0 утечек).
- [x] CLI скрипты: `layout:audit`, `layout:heal`, `layout:fix`, `layout:mcp` зарегистрированы в `package.json`.
