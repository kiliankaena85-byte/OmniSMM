# UI_KNOWLEDGE.md — Smmplan Design System Knowledge File
# Единый источник правды о дизайн-токенах, визуальных правилах и компонентных конвенциях.
# Этот файл ОБЯЗАТЕЛЬНО подаётся в контекст AI при любой UI-задаче.

## 1. Design Tokens (из globals.css @theme)

### Colors
| Token | Hex | Использование |
|---|---|---|
| `--color-background` | `#f8fafc` (slate-50) | Фон страниц |
| `--color-foreground` | `#0f172a` (slate-900) | Основной текст |
| `--color-card` | `#ffffff` | Карточки, панели |
| `--color-card-foreground` | `#0f172a` | Текст внутри карточек |
| `--color-primary` | `#0ea5e9` (sky-500) | CTA кнопки, ссылки, активные элементы |
| `--color-primary-foreground` | `#ffffff` | Текст на primary фоне |
| `--color-secondary` | `#f1f5f9` (slate-100) | Вторичные кнопки, подложки |
| `--color-secondary-foreground` | `#0f172a` | Текст на secondary |
| `--color-muted` | `#f1f5f9` | Фон для мутированных зон |
| `--color-muted-foreground` | `#64748b` (slate-500) | Лейблы, подписи |
| `--color-accent` | `#f1f5f9` | Подсветка при hover |
| `--color-destructive` | `#f43f5e` (rose-500) | Ошибки, удаление |
| `--color-border` | `#e2e8f0` (slate-200) | Границы |
| `--color-ring` | `#0ea5e9` | Focus rings |

### Radius
| Token | Value |
|---|---|
| `--radius` | `0.75rem` (12px) |

### Shadows (рекомендуемые)
```css
--shadow-card: 0 1px 3px 0 rgb(0 0 0 / 0.1);      /* Карточки */
--shadow-elevated: 0 4px 12px -2px rgb(0 0 0 / 0.1); /* Поднятые элементы */
--shadow-glow: 0 0 20px rgb(14 165 233 / 0.15);      /* Primary glow */
```

### Transitions
```css
--transition-fast: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-smooth: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
```

---

## 2. Typography Scale

| Роль | Tailwind Classes |
|---|---|
| **Page Title** | `text-2xl font-bold text-foreground tracking-tight` |
| **Section Header** | `text-lg font-semibold text-foreground` |
| **Card Title** | `text-base font-medium text-foreground` |
| **Body Text** | `text-sm text-foreground/80` |
| **Label (uppercase)** | `text-xs uppercase tracking-wider text-muted-foreground font-semibold` |
| **Helper/Description** | `text-xs text-muted-foreground` |
| **Data (numbers)** | `text-sm font-mono tabular-nums text-foreground` |
| **Badge** | `text-xs font-medium px-2 py-0.5 rounded-md` |

---

## 3. Component Library: HeroUI v3

### API Convention (Dot Notation)
```tsx
// ✅ CORRECT — HeroUI v3
<Table aria-label="Users table">
  <Table.Header>
    <Table.Column>Name</Table.Column>
  </Table.Header>
  <Table.Body>
    <Table.Row key="1">
      <Table.Cell>John</Table.Cell>
    </Table.Row>
  </Table.Body>
</Table>

// ❌ WRONG — HeroUI v2 named imports
import { TableHeader, TableColumn } from "@heroui/table";
```

### Key Components
| Component | Import | Usage |
|---|---|---|
| `Button` | `@heroui/button` | CTA, actions |
| `Table` | `@heroui/table` | Data tables (dot notation) |
| `Modal` | `@heroui/modal` | Dialogs (dot notation) |
| `Dropdown` | `@heroui/dropdown` | Menus (dot notation) |
| `Input` | `@heroui/input` | Form inputs |
| `Chip` | `@heroui/chip` | Status badges |
| `Card` | `@heroui/card` | Content containers |
| `Tooltip` | `@heroui/tooltip` | Info hints |

---

## 4. The 9 Pillars (Visual Rules & Neuroscience)

### Pillar 1: Progressive Disclosure
- Скрывайте вторичные действия под Dropdown или Sheet.
- `truncate` для длинных ID, полное значение по hover.
- Не показывайте > 5 действий одновременно.

### Pillar 2: No-Line Architecture
- ❌ `border-solid`, `divide-y` для каждой строки таблицы.
- ✅ Тональный контраст: `bg-card` элемент на `bg-background` подложке.
- ✅ `shadow-sm` вместо borders.
- Если border необходим: `border-border/50` (полупрозрачный).

### Pillar 3: Typography Hierarchy
- Каждый уровень должен визуально отличаться (weight + color + size).
- Никогда не делать весь текст одного размера/цвета.
- Числа: `tabular-nums` для ровных колонок.

### Pillar 4: Premium Sky Palette
- Primary: `sky-500` / `sky-600` — CTA, active state.
- Surface: `white` карточки на `slate-50` фоне.
- Navigation: `slate-950` с тонировкой для sidebar.
- ❌ Запрет: raw `red-500`, `green-500`. Только `rose-500`, `emerald-500`.
- ❌ Запрет: `text-black`. Только `text-foreground` (slate-900).

### Pillar 5: Interaction & Motion
- Все кнопки/ссылки: `transition-all duration-200`.
- Hover карточки: `hover:shadow-md hover:-translate-y-0.5`.
- Hover строки таблицы: `hover:bg-accent/50`.
- Запрет дёрганой анимации (> 300ms ease-in-out).

### Pillar 6: Contextual Harmony & Clean Chrome
- Scrollbars: `.scrollbar-hide` class или `scrollbar-width: none`.
- Sticky headers: `bg-card/80 backdrop-blur-md border-b border-border/50`.
- Glassmorphism для overlays: `bg-card/80 backdrop-blur-lg`.
- Никакого дизайна в вакууме: элементы должны наследовать цвета окружения.

### Pillar 7: Spatial Cognition (Математический дизайн)
- Строгая 8-пиксельная сетка. Использование только шагов: `2 (8px), 4 (16px), 6 (24px), 8 (32px)`.
- Никаких случайных отступов (`p-3`, `mt-5`, `gap-3`).

### Pillar 8: Neuroaesthetics & Cognitive Load
- Правило NASA-TLX: Не более 3-4 интерактивных/ярких элементов на экране.
- IKEA Effect (Стратегическое трение): Финансовые действия требуют микро-шага подтверждения.
- Визуальная симметрия в блоках оплаты.

### Pillar 9: Enterprise Accessibility (WCAG AAA & A11y)
- Навигация по Tab с кастомным кольцом фокуса (`focus-visible:ring-2 focus-visible:ring-primary/50`).
- Screen-reader friendly (спрятанные тексты через `sr-only` для иконок).
- Цветовой контраст текста минимум 4.5:1.

---

## 5. Layout Patterns

### Admin Dashboard
```
┌─ Sidebar (w-64, bg-slate-950) ─┐─── Main Content (bg-background) ───┐
│  Logo                          │  TopBar (sticky, blur)              │
│  Nav Items                     │  ┌────────────────────────────────┐ │
│  ...                           │  │  Page Title + Actions          │ │
│                                │  │  ┌──────┐ ┌──────┐ ┌──────┐  │ │
│                                │  │  │ Stat  │ │ Stat │ │ Stat │  │ │
│                                │  │  └──────┘ └──────┘ └──────┘  │ │
│                                │  │  ┌────────────────────────┐   │ │
│                                │  │  │  Data Table / Grid     │   │ │
│                                │  │  └────────────────────────┘   │ │
│                                │  └────────────────────────────────┘ │
└────────────────────────────────┘─────────────────────────────────────┘
```

### Stat Cards
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  <Card className="bg-card shadow-sm border-0">
    <Card.Body className="gap-1 p-4">
      <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
        Revenue
      </span>
      <span className="text-2xl font-bold text-foreground tabular-nums">
        ₽ 1,234,567
      </span>
    </Card.Body>
  </Card>
</div>
```

---

## 6. Anti-Patterns (ЗАПРЕЩЕНО)

```tsx
// ❌ Inline colors
<div className="text-white bg-blue-600 border border-gray-200">

// ✅ Semantic tokens
<div className="text-primary-foreground bg-primary border-border">

// ❌ Hard-coded pixel values
<div style={{ padding: '16px', fontSize: '14px' }}>

// ✅ Tailwind utilities
<div className="p-4 text-sm">

// ❌ Giant monolithic component (500+ lines)
// ✅ Decompose into <TableHeader>, <TableRow>, <TableActions>

// ❌ Custom CSS selectors in component files
// ✅ All custom CSS in globals.css @layer utilities

// ❌ Rewriting entire files for small changes
// ✅ Use multi_replace_file_content with targeted diffs
```

---

## 7. Status Badge Convention

| Status | HeroUI Chip | Color |
|---|---|---|
| Active / Success | `<Chip color="success" variant="flat">` | emerald |
| Pending / Processing | `<Chip color="warning" variant="flat">` | amber |
| Error / Failed | `<Chip color="danger" variant="flat">` | rose |
| Inactive / Cancelled | `<Chip color="default" variant="flat">` | slate |
| Info / New | `<Chip color="primary" variant="flat">` | sky |
