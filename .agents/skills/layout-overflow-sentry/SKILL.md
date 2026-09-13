---
name: layout-overflow-sentry
description: >
  Архитектурный скилл для выявления, предотвращения и автоматического устранения (Auto-Healer) поплывшей
  верстки, нежелательного горизонтального скролла, сплющивания элементов, некорректной DOM-вложенности и
  мобильных аномалий (iOS Auto-Zoom, 100vh jumping, Safe Area Insets) через CLI и Model Context Protocol (MCP).
---

# SKILL: layout-overflow-sentry — Детектор и Авто-исправитель верстки (RLS-2026)

> **Статус:** Обязательный стандарт фронтенд-верстки и UI-эргономики платформы OmniSMM 1.0.  
> **Нормативная база:** [RLS-2026 Standard](../../docs/standards/RESPONSIVE_LAYOUT_STANDARD_2026.md), W3C CSS Box Model, WCAG 2.2 AA (Target Size & Reflow), Apple Human Interface Guidelines (Touch Ergonomics), ISO 9241-110:2020.

---

## 1. Дерево решений детекции и исправления (Decision Tree)

```mermaid
flowchart TD
    Start(["Проверка верстки компонента / экрана"]) --> DefectType{"Какой симптом дефекта обнаружен?"}
    
    DefectType -->|"Горизонтальный скролл"| HorizScroll["Элемент вылезает за правый край вьюпорта"]
    DefectType -->|"Иконка / бейдж сплющены"| Squashed["Элемент сжат флекс-родителем (квадрат -> овал)"]
    DefectType -->|"Зум в iOS при клике в поле"| IOSZoom["Вход в input приближает экран в Safari"]
    DefectType -->|"Выпадающий список обрезан"| ClippedMenu["Дропдаун срезан границей карточки"]
    DefectType -->|"Таблица не влезает в экран"| TableOverflow["Появление нижнего скроллбара в таблице"]
    DefectType -->|"Ошибки гидратации / DOM"| NestingError["Невалидная вложенность (button в button, p в p)"]

    %% Horiz Fixes
    HorizScroll --> HasFixedW{"Используется w-screen или фиксированная ширина?"}
    HasFixedW -->|"w-screen"| ReplaceWScreen["Заменить на w-full max-w-full (Auto-Healer)"]
    HasFixedW -->|"w-[...px]"| AddMaxW["Заменить на w-full max-w-[...px]"]
    HasFixedW -->|"Нет"| HasFlexNoMinW{"Flex-потомок без min-w-0 с длинным текстом?"}
    HasFlexNoMinW -->|"Да"| AddMinW0["Добавить min-w-0 и truncate (Auto-Healer)"]
    HasFlexNoMinW -->|"Нет"| CheckNegativeMargin["Проверить отрицательные -mx без overflow-hidden"]

    %% Squash Fixes
    Squashed --> AddShrink0["ДОБАВИТЬ класс 'shrink-0' на Lucide Icon / Avatar / Badge!"]

    %% iOS Zoom Fixes
    IOSZoom --> CheckFontSize{"Размер шрифта в <input> меньше 16px (text-xs / text-sm)?"}
    CheckFontSize -->|"Да"| FixFont["Заменить на 'text-base sm:text-sm' (Auto-Healer)"]

    %% Menu Clipping Fixes
    ClippedMenu --> CheckOverflowHidden{"Родитель имеет overflow-hidden / overflow-clip?"}
    CheckOverflowHidden -->|"Да"| FixModalHoisting["Убрать overflow-hidden или рендерить дропдаун через Portal"]

    %% Table Fixes
    TableOverflow --> FixTableRule["Применить Viewport 100% Fit: лимит 7-8 колонок, убрать min-w-[1200px]"]

    %% Nesting Fixes
    NestingError --> FixNestingRule["Разделить теги, использовать asChild или span/div"]
```

---

## 2. Кодовые анти-паттерны и решения (Bad vs Good)

### 2.1. Искоренение горизонтального скролла (Zero Horizontal Scroll)
```tsx
// ❌ ПЛОХО: Фиксированная ширина на мобильном экране вызовет горизонтальный скролл
<div className="w-[420px] p-6 bg-card">
  <p>{user.email}</p> {/* Длинный email разорвет контейнер */}
</div>

// ✅ ХОРОШО: Эластичная ширина с ограничением и защита длинных строк
<div className="w-full max-w-[420px] min-w-0 p-4 sm:p-6 bg-card">
  <p className="truncate font-medium" title={user.email}>{user.email}</p>
</div>
```

### 2.2. Защита от сплющивания иконок и бейджей (Zero-Squash Invariant)
```tsx
// ❌ ПЛОХО: Во флекс-контейнере иконка Lucide сплющится при узком экране
<div className="flex items-center gap-3">
  <Zap className="w-5 h-5 text-primary" />
  <span className="text-sm">Очень длинное наименование услуги с описанием</span>
</div>

// ✅ ХОРОШО: shrink-0 гарантирует сохранение геометрии 20x20px
<div className="flex items-center gap-3 min-w-0">
  <Zap className="w-5 h-5 shrink-0 text-primary" />
  <span className="text-sm truncate">Очень длинное наименование услуги с описанием</span>
</div>
```

### 2.3. Защита от неконтролируемого iOS Auto-Zoom в формах
```tsx
// ❌ ПЛОХО: Шрифт 12px (text-xs) заставляет iOS Safari автоматически зумить страницу
<input type="text" className="text-xs px-3 py-2 rounded-lg" />

// ✅ ХОРОШО: На мобильных устройствах строгие 16px (text-base), на ПК компактные 14px (sm:text-sm)
<input type="text" className="text-base sm:text-sm px-3 py-2.5 rounded-lg" />
```

### 2.4. Динамическая высота экрана (Dynamic Viewport Height)
```tsx
// ❌ ПЛОХО: 100vh прыгает при открытии/закрытии панели навигации в Safari/Chrome
<div className="min-h-screen"> ... </div>

// ✅ ХОРОШО: min-h-dvh учитывает появление мобильной клавиатуры и адресной строки
<div className="min-h-dvh pb-safe"> ... </div>
```

### 2.5. Modal & Popover Hoisting Invariant
```tsx
// ❌ ПЛОХО: Вложенные модалки и всплывающие окна внутри контейнеров с overflow-hidden/overflow-x-auto
<div className="overflow-x-auto">
  <DropdownMenu>
    <DropdownMenuContent> ... </DropdownMenuContent>
  </DropdownMenu>
</div>

// ✅ ХОРОШО: Вынос порталов модалок и поповеров на уровень корня экрана (Modal & Popover Hoisting)
<Portal>
  <DropdownMenuContent> ... </DropdownMenuContent>
</Portal>
```

### 2.6. DOM Nesting Invariants (Защита от невалидной вложенности)
```tsx
// ❌ ПЛОХО: Вложенные кнопки или параграфы вызывают разрыв DOM и сбой гидратации React 19
<button onClick={handleCardClick}>
  <button onClick={handleDelete}>Удалить</button>
</button>

// ✅ ХОРОШО: Разделение действий на один уровень или использование asChild
<div className="flex items-center justify-between" role="group">
  <button onClick={handleCardClick} className="grow text-left">Открыть</button>
  <button onClick={handleDelete} className="shrink-0 p-2">Удалить</button>
</div>
```

---

## 3. DOM-скрипт детекции поплывших элементов в браузере

При аудите страниц через Playwright / Puppeteer агент инжектирует следующий скрипт для локализации виновников переполнения:

```javascript
(() => {
  const docWidth = document.documentElement.clientWidth;
  const culprits = [];

  document.querySelectorAll('*').forEach((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.right > docWidth + 1) {
      culprits.push({
        element: el.tagName.toLowerCase(),
        classes: el.className,
        width: rect.width,
        overflowPixels: Math.round(rect.right - docWidth),
        snippet: el.outerHTML.slice(0, 150)
      });
    }
  });

  return culprits;
})();
```

---

## 4. Инструментарий агента: Auto-Healer Codemod & CLI

Скилл оснащен автоматическим исправителем дефектов верстки:
```bash
# Просмотр возможных исправлений без записи (Dry Run)
npm run layout:heal

# Автоматическое исправление файлов кодовой базы
npm run layout:fix

# Точечный запуск по директории или компоненту
npx tsx scripts/ui/layout-healer.ts --fix --scope=src/components/dashboard

# Проверка в CI (завершается с ошибкой 1, если есть дефекты)
npx tsx scripts/ui/layout-healer.ts --check
```

---

## 5. Интеграция Model Context Protocol (MCP Server)

Для взаимодействия с внешними автономными агентами (Claude, Gemini, Antigravity) скилл реализует протокол MCP JSON-RPC 2.0:

```bash
# Запуск MCP сервера через stdio
npm run layout:mcp
```

### Доступные MCP-инструменты:
1. `layout_audit`: сканирование директории или файла на дефекты верстки и вложенности.
2. `layout_autofix`: запуск авто-лечения (`shrink-0`, `min-w-0`, `w-screen`, `iOS zoom`) с опцией `dryRun`.
3. `layout_dom_probe`: измерение реального DOM на порту 3000/3005 для нахождения элементов, выходящих за экран.

---

## 6. Чеклист проверки верстки перед релизом
- [ ] Экран `375px` (iPhone SE): отсутствие горизонтального скроллбара (`scrollWidth === clientWidth`).
- [ ] Экран `390px` (iPhone 14/15/16): все интерактивные кнопки $\ge 44\text{px}$, кликабельные зоны не накладываются.
- [ ] Поля `<input>`: размер шрифта $\ge 16\text{px}$ для защиты от авто-зума.
- [ ] Все иконки Lucide во flex-блоках имеют атрибут `shrink-0`.
- [ ] Все таблицы растянуты на 100% ширины без горизонтального скролла на ноутбуках 1366x768.
- [ ] Выпадающие меню (`DropdownMenu`, `Popover`) не обрезаются границами карточек.
- [ ] Отсутствуют ошибки DOM Nesting (`<button>` в `<button>`, `<p>` в `<p>`, `<a>` в `<a>`).
