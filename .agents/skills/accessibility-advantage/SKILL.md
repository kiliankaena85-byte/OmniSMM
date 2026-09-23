---
name: accessibility-advantage
description: "A11y = SEO + UX + юридическая защита: WCAG 2.1 AA, keyboard nav, screen reader, ARIA. Активировать при audit accessibility, при проектировании для инклюзивности, при compliance. ALWAYS activate for accessibility audit, WCAG compliance, keyboard navigation, screen reader optimization, inclusive design. Use this skill to scan, check, and validate when auditing or implementing this topic."
version: 1.0.0
---

# Accessibility Advantage — A11y = бизнес-преимущество

## When to activate

- Проектируется интерфейс для широкой аудитории
- Нужен accessibility audit текущего сайта
- Требуется WCAG compliance (юридический / корпоративный)
- Пользователь упоминает accessibility, A11y, inclusive design
- Перед ship — нужен A11y checklist

## Бизнес-кейс Accessibility

- 15% населения имеет инвалидность — это 1.3 млрд потенциальных клиентов
- A11y = SEO (semantic HTML = поисковая видимость)
- ADA/EAA lawsuit risk: $50K-$200K за нарушение
- Бренд-репутация: inclusive = современный

## WCAG 2.1 AA — Ключевые правила

### Perceivable
- Color contrast: 4.5:1 для text, 3:1 для large text
- Не использовать цвет как единственный индикатор
- Alt text для всех meaningful images
- Captions для video content

### Operable
- Full keyboard navigation (Tab, Enter, Escape)
- Focus indicators видимые (minimum 2px solid)
- Skip navigation link
- No keyboard traps
- Motion: prefers-reduced-motion support

### Understandable
- Consistent navigation across pages
- Error identification + suggestions
- Labels for all form inputs
- Language attribute on HTML

### Robust
- Valid HTML (semantic elements)
- ARIA labels где semantic HTML недостаточно
- No auto-playing media
- Progressive enhancement

## Quick Wins (80/20)

1. Alt text для изображений
2. Keyboard navigation + focus indicators
3. Color contrast проверка
4. Semantic HTML (header, nav, main, footer)
5. Form labels + error messages
6. Skip navigation link
7. prefers-reduced-motion

## Step-by-step execution protocol

1. **Run automated audit**: Запустить Lighthouse accessibility audit
2. **Keyboard test**: Пройти весь основной флоу только клавиатурой
3. **Screen reader test**: Проверить с VoiceOver / NVDA
4. **Color contrast check**: Проверить все text/background combinations
5. **Fix critical issues**: Приоритизировать: keyboard > contrast > ARIA > semantic
6. **Add quick wins**: Реализовать 7 quick wins из списка
7. **Setup CI check**: Добавить axe-core / pa11y в CI pipeline
8. **Document**: Создать accessibility statement для проекта

## Scope boundaries

### DOES
- Проводить accessibility audit по WCAG 2.1 AA
- Идентифицировать и приоритизировать A11y проблемы
- Рекомендовать конкретные исправления
- Интегрировать A11y в дизайн-процесс

### DOES NOT
- Проводить юридический compliance audit
- Заменять user testing с людьми с инвалидностью
- Гарантировать 100% WCAG compliance (только рекомендации)
- Создавать ARIA widgets с нуля (рекомендует existing patterns)

## Error handling

| Scenario | Response |
|----------|----------|
| Красивый дизайн не соответствует contrast | Предложить альтернативы: darker shade, larger text, outline style |
| Keyboard navigation «ломает» визуальную иерархию | Предложить skip links + roving tabindex |
| ARIA markup слишком сложный | Использовать semantic HTML вместо ARIA где возможно |
| Нет бюджета на полный A11y audit | Реализовать Quick Wins (80/20), составить roadmap для остального |

## References

- [SMMplan Design Specification](file:///d:/SMM_plan_2/docs/design_specification.md)
- [SMMplan Legal Audits](file:///d:/SMM_plan_2/production_readiness_audit.md)