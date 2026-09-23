---
name: visual-regression-testing
description: "Screenshot diff pipeline: автоматическая защита от визуальных багов, pixel-level comparison, CI/CD integration. Активировать при настройке visual testing, при защите от regression, при CI/CD для UI. ALWAYS activate for visual regression testing setup, screenshot diff pipeline, visual QA automation, CI/CD for UI. Use this skill to scan, check, and validate when auditing or implementing this topic."
version: 1.0.0
---

# Visual Regression Testing — screenshot diff pipeline

## When to activate

- Настраивается CI/CD pipeline для UI
- Нужна защита от визуальных багов при изменениях
- Пользователь упоминает visual testing, screenshot comparison
- Проект достиг стадии когда regression — реальный риск
- Нужен automated visual QA

## Архитектура Pipeline

```text
Code Change → Build → Screenshot → Compare → Report
                                          ↓
                                    Diff > threshold?
                                    YES → Block merge + notify
                                    NO  → Pass
```

## Key Decisions

### Threshold
- 0% threshold: идеал, но много false positives
- 0.1% threshold: баланс (антиалиасинг, font rendering)
- 1% threshold: либеральный, пропустит мелкие баги

### Viewports
- Desktop: 1440px, 1024px
- Tablet: 768px
- Mobile: 375px

### Сценарии тестирования
- Default state (light theme)
- Dark theme
- Different content lengths (empty, normal, overflow)
- Interactive states (hover, focus, active)
- Form validation error states (e.g. attempting to pay on specific services without checking the confirmation checkbox)

## Инструменты

- **Chromatic** — для Storybook-проектов
- **Percy** — BrowserStack интеграция
- **Playwright screenshots** — для кастомных решений
- **BackstopJS** — open-source вариант

## Step-by-step execution protocol

1. **Choose tool**: Выбрать инструмент (Chromatic / Percy / Playwright / BackstopJS)
2. **Define test pages**: Определить страницы/компоненты для тестирования
3. **Define interactive states and warning scenarios**: Написать тесты на валидацию блокирующих форм и появление предупреждений.
4. **Capture baseline**: Сделать baseline скриншоты для всех viewport и тем
4. **Setup pipeline**: Интегрировать в CI/CD (GitHub Actions / GitLab CI)
5. **Define threshold**: Установить порог различия (0.1% рекомендуется)
6. **Setup notifications**: Настроить уведомления о failed diffs
7. **Create review process**: Определить кто одобряет/отклоняет diffs
8. **Iterate**: Уточнять baseline и threshold по результатам

## Scope boundaries

### DOES
- Проектировать visual regression testing pipeline
- Выбирать инструменты и threshold
- Настраивать CI/CD интеграцию
- Определять viewports и сценарии

### DOES NOT
- Реализовывать CI/CD pipeline (только спецификацию)
- Заменять функциональное тестирование
- Проводить кросс-браузерное тестирование
- Настраивать Storybook / Chromatic

## Error handling

| Scenario | Response |
|----------|----------|
| Слишком много false positives | Увеличить threshold, добавить ignore regions для dynamic content |
| Diff обнаружен, но это intentional change | Обновить baseline, добавить в changelog |
| Нет CI/CD pipeline | Предложить локальный запуск через npm script |
| Команда игнорирует visual tests | Показать примеры пойманных багов, добавить в PR checklist |

## References

- [SMMplan Design Specification](file:///d:/SMM_plan_2/docs/design_specification.md)
- [SMMplan Legal Audits](file:///d:/SMM_plan_2/production_readiness_audit.md)