---
name: gsd-tailwind-v4-manifest
description: Манифест Tailwind CSS v4 для Smmplan. @theme directive, CSS-first config, PostCSS, HeroUI integration, breaking changes v3→v4, design tokens и Smmplan-конвенции.
---

# 🎨 Скилл: Tailwind CSS v4 Reference (gsd-tailwind-v4-manifest)

Единственный источник правды по стилизации в проекте Smmplan.

**Стек:** Tailwind CSS 4.2, @tailwindcss/postcss, HeroUI v3, Next.js 16

---

## 🔴 ЧАСТЬ 1: BREAKING CHANGES v3 → v4

### 1. Установка и конфигурация

```bash
# v4 — через PostCSS plugin:
npm install tailwindcss @tailwindcss/postcss
```

```js
// postcss.config.mjs (Smmplan):
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
export default config;
```

```css
/* globals.css — импорт v4: */
@import "tailwindcss";

/* НЕ используем @tailwind base/components/utilities — это v3 синтаксис! */
```

### 2. @theme vs tailwind.config

В v4 **основная** конфигурация — через CSS `@theme` directive. JS config (`tailwind.config.js`) поддерживается для **совместимости** через `@config`.

```css
/* globals.css (Smmplan): */
@import "tailwindcss";
@config "../../tailwind.config.js";  /* ← HeroUI plugin compatibility */

@theme {
  --color-background: #ffffff;
  --color-foreground: #171717;
}
```

> **Smmplan:** Используем **оба** — `@config` для HeroUI plugin + `@theme` для custom tokens.

### 3. Ключевые изменения v3 → v4

| Было (v3) | Стало (v4) | Описание |
|-----------|-----------|----------|
| `@tailwind base;` | `@import "tailwindcss";` | Единый импорт |
| `tailwind.config.js` (JS) | `@theme {}` (CSS) | CSS-first config |
| `theme.extend.colors` | `--color-{name}: value;` | CSS variables |
| `theme.extend.fontFamily` | `--font-{name}: value;` | Fonts as CSS vars |
| `@apply` везде | `@apply` ограничен | Не работает с новыми v4 features |
| `opacity: 50` shorthand | `text-black/50` | Модификатор через `/` |
| `ring-offset-*` | `ring-offset-*` deprecated | Используйте `outline` |

### 4. CSS Variables в @theme

```css
@theme {
  /* Colors */
  --color-background: #ffffff;
  --color-foreground: #171717;
  --color-primary: #0ea5e9;
  --color-danger: #ef4444;
  
  /* Fonts — значение = CSS font-family string */
  --font-sans: "Inter", "system-ui", sans-serif;
  --font-mono: "JetBrains Mono", monospace;
  
  /* Spacing (custom) */
  --spacing-sidebar: 280px;
  
  /* Breakpoints */
  --breakpoint-xs: 480px;
}
```

### 5. @layer в v4

```css
@layer base {
  body {
    background-color: var(--color-background);
    color: var(--color-foreground);
    @apply antialiased;
  }
}

@layer components {
  .btn-primary {
    @apply px-4 py-2 bg-sky-600 text-white font-medium
           hover:bg-sky-700 transition-colors;
  }
}
```

---

## 🟢 ЧАСТЬ 2: ПРАВИЛЬНЫЕ ПАТТЕРНЫ

### 6. Utility-первый подход

```tsx
// ✅ ПРАВИЛЬНО — утилиты напрямую:
<div className="flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
  {children}
</div>

// ❌ НЕПРАВИЛЬНО — @apply для кастомного класса (brittleness):
// globals.css:
.card-wrapper {
  @apply flex items-center gap-3 px-4 py-3 bg-white border border-slate-200;
}
```

### 7. Responsive Design

```tsx
// Mobile-first breakpoints:
<div className="
  grid grid-cols-1       // Mobile: 1 column
  md:grid-cols-2         // Tablet: 2 columns
  lg:grid-cols-4         // Desktop: 4 columns
  gap-4
">
```

### 8. Dark Mode & Custom Themes (next-themes)

```tsx
// Smmplan использует next-themes для переключения (class attribute):
<html className="dark">
  
// Стили:
<div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
```

> **⚠️ КРИТИЧЕСКОЕ ПРАВИЛО ДЛЯ КАСТОМНЫХ ТЕМ (emerald, violet и др.):**
> Если вы создаете кастомные темы (например, `emerald`, `violet`), помните, что `next-themes` **ЗАМЕНЯЕТ** класс на теге `<html>` (класс `.dark` удаляется при выборе `emerald`).
> 
> **Причинно-следственная связь:** Если вы объявите базовый темный фон ТОЛЬКО для `.dark`, то при переключении на `.emerald` сайт "ослепнет" (фон станет белым). Более того, по правилам **CSS Cascade** селекторы с одинаковой специфичностью переопределяют друг друга в зависимости от порядка в файле.
> 
> **ПРАВИЛЬНЫЙ ПАТТЕРН в `globals.css`:**
> 1. Объедините все темные темы в базовом селекторе, чтобы они наследовали темный фон:
>    `.dark, .emerald, .violet { --color-background: #0f172a; ... }`
> 2. **ОБЯЗАТЕЛЬНО** помещайте блоки переопределения акцентных цветов (`.emerald { --color-primary: #059669; }`) **В САМЫЙ НИЗ ФАЙЛА** (ниже базового `.dark`), иначе базовые стили перезапишут кастомный акцент!

### 9. Conditional Classes (clsx + tailwind-merge)

```tsx
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// ✅ Smmplan utility:
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Usage:
<div className={cn(
  'px-4 py-2 rounded-lg',
  isActive && 'bg-sky-600 text-white',
  isDisabled && 'opacity-50 cursor-not-allowed'
)} />
```

---

## 🔵 ЧАСТЬ 3: SMMPLAN DESIGN SYSTEM

### 10. Color Palette

| Token | Цвет | Использование |
|-------|------|---------------|
| `slate-50` | Фон подложки | Table headers, subtle backgrounds |
| `slate-100` | Границы | Borders, dividers |
| `slate-500` | Muted text | Labels, secondary text |
| `slate-700` | Body text | Table cells, descriptions |
| `slate-800/900` | Primary text | Headings, emphasis |
| `sky-600` | Links/Actions | Links, interactive elements |
| `indigo-600` | Primary accent | Buttons, selections |
| `emerald-500/600` | Success | Status badges, positive values |
| `amber-500` | Warning | Pending states, cautions |
| `red-500/600` | Danger | Error states, destructive actions |

### 11. Typography

```tsx
// Tabular numbers (для денег/ID/дат):
<span className="tabular-nums">1,250.00 ₽</span>

// Monospace (для API ключей, ID):
<span className="font-mono">clk8xyz123</span>

// Uppercase labels:
<span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
  Статус
</span>
```

### 12. Industrial Aesthetic (Zero-radius)

```tsx
// Smmplan использует rounded-none для "industrial" look в некоторых местах:
<Card className="rounded-none">

// НО: в DataTable — rounded-xl для более мягкого отображения:
<div className="rounded-xl border border-slate-200 overflow-hidden">
```

---

## 🟡 ЧАСТЬ 4: АНТИПАТТЕРНЫ

```css
/* ❌ v3 синтаксис — крэш в v4: */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* ✅ v4 синтаксис: */
@import "tailwindcss";
```

```css
/* ❌ tilde import в Turbopack: */
@import '~@heroui/theme/dist/theme.css';

/* ✅ Прямой import: */
@import '@heroui/theme/dist/theme.css';
```

```tsx
// ❌ HeroUI radius prop (не существует в v3):
<Card radius="none">

// ✅ Через className:
<Card className="rounded-none">
```

```css
/* ❌ theme() функция в v4 — работает по-другому: */
.custom { color: theme('colors.sky.600'); }

/* ✅ CSS variable: */
.custom { color: var(--color-sky-600); }
```

---

## 📋 ЧАСТЬ 5: КОНФИГУРАЦИЯ SMMPLAN

### Файлы конфигурации:

| Файл | Назначение |
|------|-----------|
| `postcss.config.mjs` | `@tailwindcss/postcss` plugin |
| `tailwind.config.js` | HeroUI plugin + content paths |
| `src/app/globals.css` | `@import`, `@config`, `@theme`, `@layer base` |

### Текущий tailwind.config.js:
```js
const { heroui } = require("@heroui/theme");

module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}"
  ],
  plugins: [heroui()],
};
```

> **⚠️ Примечание:** `tailwind.config.js` используется через `@config` directive в globals.css для HeroUI compatibility. Основная конфигурация — в `@theme`.

### Чеклист:

| # | Правило | Статус |
|---|---------|--------|
| 1 | `@import "tailwindcss"` (не `@tailwind`) | ✅ |
| 2 | `@tailwindcss/postcss` (не `tailwindcss` CLI) | ✅ |
| 3 | `@config` для HeroUI plugin | ✅ |
| 4 | `@theme` для custom tokens | ✅ |
| 5 | `cn()` utility (clsx + twMerge) | ✅ |
| 6 | Нет tilde imports | ✅ |
| 7 | `tabular-nums` для денег | ✅ |
