---
name: browser-visual-qa
description: "Visual QA через Browser Sub-Agent: screenshot verification, comparison с эталоном, pre-flight check. Активировать после генерации UI, при визуальной проверке, при сравнении с дизайн-макетом. ALWAYS activate after UI generation, for visual QA, screenshot comparison, design-to-code verification. Use this skill to scan, check, and validate when auditing or implementing this topic."
version: 1.0.0
---

# Browser Visual QA — визуальная верификация

## When to activate

- Сгенерирован UI и нужна визуальная проверка
- Пользователь просит проверить что «всё выглядит правильно»
- Нужен screenshot comparison с дизайн-макетом
- Перед ship — нужен pre-flight check
- После изменений в CSS/layout — нужна регрессия

## Browser Agent Integration

Antigravity включает Browser Sub-Agent с экземпляром Chromium. Агент может «видеть» веб-приложение:

```text
agent.screenshot(current_page)
agent.compare(screenshot, reference_design)
agent.check([
  "button_centered",
  "color_matches_spec",
  "typography_hierarchy",
  "spacing_consistent"
])
```

## Pre-Flight Checklist

- [ ] CTA виден без скролла на desktop и mobile
- [ ] Типографическая иерархия чёткая (h1 > h2 > body > caption)
- [ ] Spacing consistent (все отступы из design tokens)
- [ ] Цвета соответствуют спецификации
- [ ] Изображения загрузились (no broken images)
- [ ] Mobile layout не сломан
- [ ] Dark mode работает корректно
- [ ] Отсутствуют избыточные пустые зоны на мобильных экранах (отступы py-24, pb-40 адаптированы)
- [ ] Тарифная сетка переведена в 1-колоночный стек на мобильных, отсутствуют сжатые карточки

## Step-by-step execution protocol

1. **Launch browser**: Запустить Browser Agent, открыть страницу
2. **Capture screenshots**: Сделать скриншоты на desktop (1440px, 1024px) и mobile (375px)
3. **Check responsive layout**: Убедиться в отсутствии пустых областей более 80px на mobile и проверить читаемость текстов в тарифах.
4. **Compare with spec**: Сравнить с дизайн-макетом или specification
5. **Run checks**: Проверить типографику, spacing, цвета, иерархию
5. **Identify issues**: Зафиксировать все визуальные проблемы
6. **Classify severity**: Классифицировать: Critical / Major / Minor
7. **Generate report**: Сформировать отчёт со скриншотами и рекомендациями
8. **Fix and verify**: Исправить проблемы, повторить проверку

## Scope boundaries

### DOES

- Делать скриншоты и визуально проверять UI
- Сравнивать результат с дизайн-макетом
- Выявлять визуальные баги (spacing, alignment, typography)
- Проверять responsive layout

### DOES NOT

- Заменять кросс-браузерное тестирование
- Проверять JavaScript функциональность
- Проводить accessibility аудит (используйте accessibility-advantage)
- Заменять performance profiling

## Error handling

| Scenario | Response |
|----------|----------|
| Страница не загружается | Проверить URL, сообщить пользователю, предложить localhost проверку |
| Скриншот не совпадает с макетом | Классифицировать отличие, предложить конкретный CSS-fix |
| Тёмная тема недоступна | Отметить как «dark mode not implemented», проверить light mode |
| Mobile layout сломан | Зафиксировать проблему, предложить responsive fix |

## References

- [SMMplan Design Specification](file:///d:/SMM_plan_2/docs/design_specification.md)
- [SMMplan Legal Audits](file:///d:/SMM_plan_2/production_readiness_audit.md)