---
name: conversion-intelligence
description: "Конверсионный интеллект: pre-design checklist, post-design validation, метрики конверсии. Активировать при проектировании лендингов, форм, checkout, при оптимизации конверсии, когда нужен CTR/CVR анализ. ALWAYS activate for landing page design, checkout optimization, form design, CTA placement, conversion rate optimization. Use this skill to scan, check, and validate when auditing or implementing this topic."
version: 1.0.0
---

# Conversion Intelligence — конверсионный интеллект

## When to activate

- Проектируется лендинг, форма регистрации, checkout
- Пользователь спрашивает про конверсию, CTR, CVR
- Нужна оптимизация существующей страницы
- Перед запуском A/B теста
- Обсуждаются CTA, форма, pricing page

## Pre-Design Checklist (ДО любой генерации UI)

- [ ] Что является метрикой успеха этой страницы? (Conversion rate / Time on page / Scroll depth / CTR)
- [ ] Кто конкретный пользователь? (не «все» — Имя-персона, задача, устройство, контекст)
- [ ] Какие 3 главных возражения мешают конверсии? (Каждое должно быть снято на странице)
- [ ] Что конкурент делает на этой странице? (Скриншот + анализ что работает / что нет)
- [ ] Какой единственный CTA? (Если несколько — иерархия: primary / secondary / ghost)

## Post-Design Validation

- [ ] CTA виден без скролла на mobile?
- [ ] Есть ли social proof в первом экране?
- [ ] Форма: минимально возможное количество полей?
- [ ] Заголовок отвечает на «это для меня» за 3 секунды?
- [ ] Есть ли trust signals рядом с формой/кнопкой?
- [ ] Страница грузится < 2 секунд?
- [ ] Работает ли основной флоу без JavaScript?

## Step-by-step execution protocol

1. **Define metric**: Уточнить ключевую метрику страницы (CVR, CTR, scroll depth)
2. **Identify user**: Сформировать конкретную персону (не «все»)
3. **Map objections**: Определить 3 главных возражения к конверсии
4. **Competitor check**: Сделать screenshot audit ключевых конкурентов
5. **CTA hierarchy**: Определить единственный primary CTA + secondary
6. **Design with intent**: Спроектировать страницу, где каждый блок снимает одно возражение
7. **Validate**: Прогнать Post-Design Checklist
8. **Iterate**: Исправить найденные проблемы

## Scope boundaries

### DOES
- Определять конверсионные метрики и цели страницы
- Формировать списки возражений и сопоставлять с блоками страницы
- Проводить pre-design и post-design валидацию
- Оптимизировать CTA placement и иерархию

### DOES NOT
- Заменять A/B тестирование
- Гарантировать конкретный рост конверсии
- Анализировать реальное поведение пользователей (нужна аналитика)
- Проектировать весь UI (только конверсионные элементы)

## Error handling

| Scenario | Response |
|----------|----------|
| Не определена метрика успеха | Не приступать к дизайну, запросить у клиента |
| Слишком много CTA на странице | Предложить иерархию, убрать всё кроме primary + secondary |
| Нет данных о конкурентах | Запустить competitor-decode skill |
| Клиент хочет «красиво» а не «конверсионно» | Объяснить что красота без конверсии = декорация |

## References

- [SMMplan Design Specification](file:///d:/SMM_plan_2/docs/design_specification.md)
- [SMMplan Legal Audits](file:///d:/SMM_plan_2/production_readiness_audit.md)