---
name: layout-overflow-sentry
description: >
  Архитектурный скилл для выявления, предотвращения и устранения поплывшей верстки, нежелательного
  горизонтального скролла, сплющивания элементов, наложения слоев и мобильных аномалий (iOS Auto-Zoom,
  100vh jumping, Safe Area Insets) на смартфонах, планшетах и десктопных мониторах платформы OmniSMM 1.0.
---

# SKILL: layout-overflow-sentry — Детектор поплывшей верстки и переполнений

> **Статус:** Обязательный стандарт фронтенд-верстки и UI-эргономики платформы OmniSMM 1.0.  
> **Нормативная база:** W3C CSS Box Model, WCAG 2.2 AA (Target Size & Reflow), Apple Human Interface Guidelines (Touch Ergonomics), ISO 9241-110:2020.

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

    %% Horiz Fixes
    HorizScroll --> HasFixedW{"Используется фиксированная ширина w-[...px]?"}
    HasFixedW -->|"Да"| AddMaxW["Заменить на w-full max-w-[...px]"]
    HasFixedW -->|"Нет"| HasFlexNoMinW{"Flex-потомок без min-w-0 с длинным текстом?"}
    HasFlexNoMinW -->|"Да"| AddMinW0["Добавить min-w-0 и truncate / break-words"]
    HasFlexNoMinW -->|"Нет"| CheckNegativeMargin["Проверить отрицательные -mx без overflow-hidden"]

    %% Squash Fixes
    Squashed --> AddShrink0["ДОБАВИТЬ класс 'shrink-0' на Lucide Icon / Avatar / Badge!"]

    %% iOS Zoom Fixes
    IOSZoom --> CheckFontSize{"Размер шрифта в <input> меньше 16px (text-xs / text-sm)?"}
    CheckFontSize -->|"Да"| FixFont["Заменить на 'text-base sm:text-sm' (16px на мобилке, 14px на ПК)"]

    %% Menu Clipping Fixes
    ClippedMenu --> CheckOverflowHidden{"Родитель имеет overflow-hidden / overflow-clip?"}
    CheckOverflowHidden -->|"Да"| FixModalHoisting["Убрать overflow-hidden или рендерить дропдаун через Portal"]

    %% Table Fixes
    TableOverflow --> FixTableRule["Применить Viewport 100% Fit: лимит 7-8 колонок, убрать min-w-[1200px]"]
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

## 4. Чеклист проверки верстки перед релизом
- [ ] Экран `375px` (iPhone SE): отсутствие горизонтального скроллбара (`scrollWidth === clientWidth`).
- [ ] Экран `390px` (iPhone 14/15/16): все интерактивные кнопки $\ge 44\text{px}$, кликабельные зоны не накладываются.
- [ ] Поля `<input>`: размер шрифта $\ge 16\text{px}$ для защиты от авто-зума.
- [ ] Все иконки Lucide во flex-блоках имеют атрибут `shrink-0`.
- [ ] Все таблицы растянуты на 100% ширины без горизонтального скролла на ноутбуках 1366x768.
- [ ] Выпадающие меню (`DropdownMenu`, `Popover`) не обрезаются границами карточек.
