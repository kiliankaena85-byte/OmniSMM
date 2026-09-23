---
name: design-tokens
description: "Design Tokens: трёхуровневая архитектура Primitive→Semantic→Component по W3C DTCG 2025.10. OKLCH color space, dark mode как ремаппинг, Style Dictionary pipeline. Активировать при создании дизайн-системы, token-архитектуры, при настройке тем, при генерации палитр. ALWAYS activate for design system setup, token architecture, theme creation, color palette generation, spacing/typography scales, dark mode imple... Use this skill to scan, check, and validate when auditing or implementing this topic."
version: 1.0.0
---

# Design Tokens — операционная система дизайна

## When to activate

- Создаётся дизайн-система с нуля
- Нужна архитектура токенов (цвета, spacing, типографика)
- Реализуется dark mode / multi-theme
- Пользователь упоминает design tokens, CSS variables, theme
- Проект разрастается и нужен единый источник правды для стилей
- При генерации цветовой палитры

## Трёхуровневая архитектура (W3C DTCG 2025.10)

### PRIMITIVE (сырые значения)
```text
color-blue-500: #3B82F6
color-blue-600: #2563EB
space-4: 16px
space-8: 32px
radius-md: 8px
```

### SEMANTIC (смысловые)
```text
color-action-primary: {color-blue-500}
color-action-primary-hover: {color-blue-600}
space-component-md: {space-4}
space-component-lg: {space-8}
radius-button: {radius-md}
```

### COMPONENT (компонентные)
```text
button-primary-background: {color-action-primary}
button-primary-hover: {color-action-primary-hover}
button-padding-y: {space-component-md}
button-border-radius: {radius-button}
```

## Ключевые правила

1. Компоненты ВСЕГДА ссылаются на semantic токены, никогда на primitive
2. Semantic описывают НАЗНАЧЕНИЕ, не ВНЕШНОСТЬ
3. Dark mode = ремаппинг semantic токенов, не инверсия
4. OKLCH color space для perceptual uniformity

## Dark Mode как ремаппинг

```css
/* Light mode (default) */
:root {
  --color-bg-primary: var(--color-neutral-0);
  --color-text-primary: var(--color-neutral-900);
  --color-action-primary: var(--color-blue-500);
}

/* Dark mode = ремаппинг semantic токенов */
[data-theme="dark"] {
  --color-bg-primary: var(--color-neutral-900);
  --color-text-primary: var(--color-neutral-0);
  --color-action-primary: var(--color-blue-400);
}
```

## OKLCH для цветовых палитр

OKLCH обеспечивает perceptual uniformity — равномерное воспринимаемое изменение яркости при изменении lightness на одинаковую величину.

```text
/* Генерация палитры из одного hue */
--color-brand-50:  oklch(0.97 0.03 {hue});
--color-brand-100: oklch(0.93 0.05 {hue});
--color-brand-200: oklch(0.85 0.08 {hue});
--color-brand-300: oklch(0.75 0.12 {hue});
--color-brand-400: oklch(0.65 0.15 {hue});
--color-brand-500: oklch(0.55 0.18 {hue});
--color-brand-600: oklch(0.45 0.18 {hue});
--color-brand-700: oklch(0.37 0.15 {hue});
--color-brand-800: oklch(0.30 0.12 {hue});
--color-brand-900: oklch(0.23 0.08 {hue});
```

## Style Dictionary Pipeline

```text
tokens/
├── primitive/
│   ├── colors.json
│   ├── spacing.json
│   └── typography.json
├── semantic/
│   ├── colors.json
│   └── spacing.json
└── component/
    ├── button.json
    ├── card.json
    └── input.json
        ↓ Style Dictionary
├── css/variables.css
├── js/tokens.js
├── scss/_tokens.scss
└── tailwind/tokens.js
```

## Step-by-step execution protocol

1. **Audit existing styles**: Проанализировать текущие CSS variables / Tailwind config
2. **Define primitives**: Создать primitive токены (colors, spacing, typography, radius, shadows)
3. **Build semantic layer**: Определить semantic назначения (action, surface, text, feedback)
4. **Map components**: Связать каждый компонент с semantic токенами
5. **Implement dark mode**: Создать ремаппинг semantic токенов для тёмной темы
6. **Generate OKLCH palette**: Сгенерировать цветовую палитру в OKLCH
7. **Setup Style Dictionary**: Настроить pipeline для генерации CSS/JS/SCSS
8. **Validate**: Проверить что ни один компонент не ссылается напрямую на primitive

## Scope boundaries

### DOES
- Проектировать трёхуровневую архитектуру токенов
- Генерировать OKLCH цветовые палитры
- Реализовывать dark mode через ремаппинг
- Настраивать Style Dictionary pipeline
- Создавать единый источник правды для стилей

### DOES NOT
- Проектировать конкретные UI-компоненты (только их токены)
- Заменять Figma design tokens (дополняет)
- Генерировать иконки и изображения
- Определять layout систему (только spacing/typography scales)

## Error handling

| Scenario | Response |
|----------|----------|
| Существующий проект без токенов | Начать с audit, создать migration plan: inline → primitives → semantics |
| Компонент ссылается на primitive | Пометить как нарушение, создать промежуточный semantic token |
| OKLCH не поддерживается в целевых браузерах | Предложить fallback через CSS color-mix() или postcss plugin |
| Слишком много semantic токенов | Консолидировать по назначению, убрать дубли |

## References

- [SMMplan Design Specification](file:///d:/SMM_plan_2/docs/design_specification.md)
- [SMMplan Legal Audits](file:///d:/SMM_plan_2/production_readiness_audit.md)