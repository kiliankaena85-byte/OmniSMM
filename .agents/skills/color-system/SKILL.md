---
name: color-system
description: "OKLCH автогенерация палитры из одного цвета, perceptual uniformity, semantic color naming, dark mode. Активировать при создании цветовой системы, при генерации палитры, при настройке dark mode цветов. ALWAYS activate for color palette generation, OKLCH color system, semantic color naming, dark mode color remapping. Use this skill to scan, check, and validate when auditing or implementing this topic."
version: 1.0.0
---

# Color System — OKLCH автогенерация палитры

## When to activate

- Создаётся цветовая палитра для проекта
- Нужна автогенерация shades из одного brand color
- Реализуется dark mode цветовая схема
- Пользователь упоминает OKLCH, color system, palette generation
- Нужна semantic naming для цветов

## Почему OKLCH?

OKLCH (Oklch color space) обеспечивает perceptual uniformity — равномерное воспринимаемое изменение яркости при одинаковой дельте lightness. В HSL изменение L на 10% даёт разный perceived контраст для разных hue. В OKLCH — одинаковый.

```text
/* HSL: разные hue — разный perceived contrast */
hsl(0, 80%, 50%)    /* красный — яркий */
hsl(120, 80%, 50%)  /* зелёный — тусклый */
hsl(240, 80%, 50%)  /* синий — средний */

/* OKLCH: одинаковый L = одинаковая perceived brightness */
oklch(0.63 0.26 25)  /* красный */
oklch(0.63 0.26 145) /* зелёный */
oklch(0.63 0.26 265) /* синий */
```

## Генерация палитры из одного brand color

```css
:root {
  /* Brand hue — одно значение, палитра генерируется автоматически */
  --brand-hue: 250;

  /* Auto-generated shades */
  --color-brand-50:  oklch(0.97 0.03 var(--brand-hue));
  --color-brand-100: oklch(0.93 0.05 var(--brand-hue));
  --color-brand-200: oklch(0.85 0.08 var(--brand-hue));
  --color-brand-300: oklch(0.75 0.12 var(--brand-hue));
  --color-brand-400: oklch(0.65 0.15 var(--brand-hue));
  --color-brand-500: oklch(0.55 0.18 var(--brand-hue));
  --color-brand-600: oklch(0.45 0.18 var(--brand-hue));
  --color-brand-700: oklch(0.37 0.15 var(--brand-hue));
  --color-brand-800: oklch(0.30 0.12 var(--brand-hue));
  --color-brand-900: oklch(0.23 0.08 var(--brand-hue));
}
```

## Semantic Color Naming

```text
color-action-primary     → main CTA color
color-action-secondary   → secondary actions
color-action-destructive → delete, remove
color-surface-primary    → main background
color-surface-elevated   → cards, modals
color-text-primary       → main text
color-text-secondary     → captions, hints
color-feedback-success   → positive outcomes
color-feedback-warning   → caution
color-feedback-error     → errors, problems
color-feedback-info      → informational
```

## Dark Mode = Remapping

```css
[data-theme="dark"] {
  --color-surface-primary: oklch(0.15 0.01 250);
  --color-surface-elevated: oklch(0.20 0.01 250);
  --color-text-primary: oklch(0.95 0.01 250);
  --color-action-primary: oklch(0.70 0.18 250);
}
```

## Step-by-step execution protocol

1. **Choose brand hue**: Определить brand hue (из логотипа или preference)
2. **Generate palette**: Автогенерировать 10 shades в OKLCH
3. **Define neutral scale**: Создать neutral палитру (warm / cool / true grey)
4. **Create semantic names**: Определить semantic color names для проекта
5. **Map to components**: Привязать semantic colors к UI-компонентам
6. **Design dark mode**: Создать ремаппинг semantic tokens для dark theme
7. **Test contrast**: Проверить WCAG contrast ratios для всех комбинаций
8. **Output tokens**: Сгенерировать CSS variables / Tailwind config

## Scope boundaries

### DOES
- Генерировать цветовые палитры в OKLCH
- Создавать semantic color naming systems
- Проектировать dark mode через ремаппинг
- Проверять WCAG contrast ratios

### DOES NOT
- Выбирать brand color (решение клиента/дизайнера)
- Создавать gradient systems
- Проектировать color-blindness simulations (рекомендует инструменты)
- Заменять визуальный audit цветов на реальных экранах

## Error handling

| Scenario | Response |
|----------|----------|
| OKLCH не поддерживается браузерами | Предложить CSS color-mix() fallback или PostCSS plugin |
| Brand color не работает в OKLCH | Конвертировать из hex/rgb, проверить perceptual accuracy |
| Dark mode contrast недостаточный | Увеличить chroma или уменьшить lightness для dark variants |
| Слишком много semantic tokens | Консолидировать по назначению, убрать дубли |

## References

- [SMMplan Design Specification](file:///d:/SMM_plan_2/docs/design_specification.md)
- [SMMplan Legal Audits](file:///d:/SMM_plan_2/production_readiness_audit.md)