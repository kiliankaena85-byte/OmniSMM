# RESPONSIVE LAYOUT & DOM ARCHITECTURE STANDARD (RLS-2026)
## Стандарт адаптивной верстки и DOM-архитектуры платформы OmniSMM 1.0 (2026)

> **Статус:** MANDATORY / OBLIGATORY FOR ALL AI AGENTS & ENGINEERS  
> **Область действия:** SMMplan (`smmplan.pro`), SMMflux (`smmflux.ru`), админ-панель OmniSMM, лендинги и виджеты.  
> **Целевые устройства:** Смартфоны (320px–390px), Планшеты (768px), Ноутбуки (1366px), Десктопы (1920px+).

---

## 1. Фундаментальные инварианты геометрии (Geometry Invariants)

### 1.1. Zero Horizontal Scroll Invariant (Правило 100% Viewport Fit)
- ❌ **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО** использовать класс `w-screen` или `100vw`.
  - *Причина:* В Windows и Linux браузерах `100vw` включает ширину полосы прокрутки (15–17px), вызывая постоянный горизонтальный скролл на десктопе.
  - ✅ **ОБЯЗАТЕЛЬНО:** Использовать `w-full max-w-full`.
- ❌ **ЗАПРЕЩЕНО** задавать фиксированную ширину блокам без адаптивного префикса или ограничителя (например, `w-[500px]` или `min-w-[800px]`).
  - ✅ **ОБЯЗАТЕЛЬНО:** `w-full sm:w-[500px] max-w-full`.

### 1.2. Zero-Squash Invariant (Защита от сплющивания иконок и элементов)
- ❌ **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО** размещать SVG-элементы, Lucide-иконки, аватары или бейджи внутри `flex`-контейнеров без явного указания `shrink-0`.
  - *Причина:* При сужении экрана до 320–375px flexbox по умолчанию имеет `flex-shrink: 1`, сжимая иконку в сплющенный эллипс или 0px.
  - ✅ **ОБЯЗАТЕЛЬНО:** Любая иконка обязана содержать класс `shrink-0` (например, `w-4 h-4 shrink-0`).

### 1.3. Flex Text Truncation Invariant (Правило усечения текста)
- ❌ **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО** использовать класс `truncate` на ребенке `flex`-контейнера без `min-w-0`.
  - *Причина:* По спецификации CSS Flexbox минимальная ширина flex-элемента по умолчанию равна `auto` (размер контента). Длинный текст распирает flex-контейнер и выталкивает верстку вправо.
  - ✅ **ОБЯЗАТЕЛЬНО:**
    ```tsx
    <div className="flex items-center gap-2 min-w-0">
      <span className="truncate min-w-0">{longTitle}</span>
    </div>
    ```

### 1.4. iOS Safari Auto-Zoom Immunity (Защита от авто-зума на iPhone)
- ❌ **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО** устанавливать в полях `<input>`, `<select>`, `<textarea>` размер шрифта менее 16px на мобильных экранах (`text-xs`, `text-sm`, `text-[12px]`).
  - *Причина:* iOS WebKit при фокусе на input со шрифтом $< 16\text{px}$ принудительно увеличивает всю страницу (Auto-Zoom), сбивая разметку и ломая фиксированные хедеры.
  - ✅ **ОБЯЗАТЕЛЬНО:**
    ```tsx
    <input className="text-base sm:text-sm px-3 py-2" />
    ```

### 1.5. Dynamic Viewport Height (DVH) Invariant
- ❌ **ЗАПРЕЩЕНО** использовать `100vh` или `min-h-screen` для полноэкранных модалок и мобильных страниц.
  - *Причина:* При скрытии/показе адресной строки и панели навигации в Safari/Chrome на iOS и Android значение `vh` вызывает резкие прыжки верстки.
  - ✅ **ОБЯЗАТЕЛЬНО:** `min-h-dvh` или `h-dvh` с поддержкой отступов `pb-safe`.

---

## 2. Инварианты DOM-вложенности и семантики (DOM Nesting Invariants)

### 2.1. Строгий запрет недопустимой вложенности HTML5
Следующие комбинации вызывают краш гидратации React 19, разрыв DOM-дерева и блокировку кликов:
1. ❌ **`<button>` внутри `<button>`:** Запрещено. Использовать `asChild`, `div` с `role="button"` или выносить экшены на один уровень.
2. ❌ **`<a>` внутри `<a>` (или `<Link>` внутри `<Link>`):** Запрещено.
3. ❌ **`<p>` внутри `<p>`:** Запрещено. Браузер закрывает внешний `<p>` перед открытием внутреннего, ломая дерево React. Использовать `<div>` или `<span>`.
4. ❌ **Блочные элементы (`<div>`, `<section>`, `<ul>`) внутри инлайновых (`<span>`, `<p>`):** Запрещено.

### 2.2. Modal & Popover Hoisting Invariant
- ❌ **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО** рендерить модальные окна (`Modal`, `Dialog`), выпадающие меню (`DropdownMenu`) или тултипы внутри контейнеров с `overflow-hidden`, `overflow-x-auto` или `isolate`.
  - *Причина:* Выпадающее меню обрезается границей родительского блока.
  - ✅ **ОБЯЗАТЕЛЬНО:** Использовать React Portal (`<Portal>` / Radix Portal) или поднимать состояние модала на уровень корня экрана (Modal Hoisting).

---

## 3. Таблицы и Zero Horizontal Scroll в админ-панели

1. Таблицы данных в OmniSMM обязаны на 100% умещаться по ширине в экран пользователя (`w-full`) без появления полосы горизонтальной прокрутки.
2. Лимит колонок: от 7 до 9 емких столбцов.
3. Компактная плотность ячеек: `px-2 py-1.5` / `px-2.5 py-2`, размер шрифта `text-xs` / `text-[11px]`.
4. Длинные текстовые блоки обязаны иметь ограничение ширины `max-w-[160px]` и `truncate` с `title`.
5. Кнопки действий: компактные `h-7 w-7` с `shrink-0`.

---

## 4. Канонический порядок классов Tailwind для Layout (Canonical Utility Order)

Для предотвращения конфликтов и обеспечения читаемости классы компонентов верстки форматируются в следующем строгом порядке:

```
[Display & Positioning] -> [Box Sizing & Dimensions] -> [Spacing] -> [Typography] -> [Visuals & Borders] -> [States & Transitions]
```

1. **Display & Position:** `flex`, `grid`, `inline-flex`, `relative`, `absolute`, `fixed`, `z-10`, `inset-0`.
2. **Dimensions & Flex Props:** `w-full`, `max-w-full`, `min-w-0`, `h-auto`, `shrink-0`, `grow`.
3. **Flex/Grid Alignment & Spacing:** `items-center`, `justify-between`, `gap-2`, `p-4`, `px-3`, `my-2`.
4. **Typography:** `text-base`, `sm:text-sm`, `font-medium`, `truncate`, `leading-none`.
5. **Visuals & Decoration:** `bg-surface`, `text-foreground`, `border`, `border-border`, `rounded-xl`, `shadow-sm`.
6. **Transitions & Interactivity:** `transition-colors`, `hover:bg-accent`, `focus-visible:ring-2`.

---

## 5. Инструментарий автоматической проверки и лечения

Платформа оснащена CLI и MCP-инструментами:
- **`npm run layout:audit`**: статический и AST-аудит компонентов на дефекты верстки и вложенности.
- **`npm run layout:fix`**: автоматическое исправление (Auto-Healer) с инъекцией `shrink-0`, `min-w-0`, `w-full max-w-full`, `pb-safe`, `type="button"` и коррекцией шрифтов инпутов.
- **`npm run layout:fix -- --dry-run`**: предварительный просмотр изменений без модификации файлов.
- **`npm run layout:mcp`**: запуск Model Context Protocol сервера с живым Playwright Chromium DOM-пробингом.

---

## 6. Синтез лучших практик индустрии (Claude, Gemini, Cursor, Vercel, GitHub)

| Вектор / Источник | Ключевая концепция | Архитектурная реализация в OmniSMM 1.0 |
|---|---|---|
| **Anthropic (Claude)** | Defensive CSS & Fail-Closed Boundaries | Защита от распирания контейнеров: связки `truncate min-w-0`, `break-words`, `shrink-0`, `isolation: isolate`. |
| **Google DeepMind (Gemini)** | Touch Ergonomics & Zero-Slop Design | Сенсорная область $\ge 44 \times 44\text{px}$ (WCAG 2.2 AA), расстояние $\ge 8\text{px}$, bespoke дизайн без шаблонных ИИ-клише. |
| **Cursor (.cursorrules)** | Predictable Tailwind Stream & Anti-Bleed | Канонический порядок классов, строгий запрет `w-screen`, авто-лечение дефектов через Codemod AST. |
| **Vercel (Next.js 16)** | Zero CLS & Hybrid Responsive Modals | Резервирование геометрии скелетонов `Suspense` (`aspect-*`, `min-h-*`), шторка (Drawer) на мобилке, диалог на десктопе. |
| **GitHub (Primer DS)** | High-Density Data Grid & Viewport 100% Fit | Вписывание таблиц в видимый экран 1366px без скролла, лимит 7–9 емких колонок, вынос деталей в popovers. |

