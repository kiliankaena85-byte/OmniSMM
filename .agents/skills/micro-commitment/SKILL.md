---
name: micro-commitment
description: "Лестница микро-обязательств: от нулевого трения к полному commitment. 4 уровня: анонимно, email, профиль, платёж. Активировать при проектировании funnel, onboarding, signup, trial, при оптимизации воронки. ALWAYS activate for funnel design, signup flow, onboarding engineering, trial optimization, when reducing friction in conversion paths. Use this skill to scan, check, and validate when auditing or implementing this topic."
version: 1.0.0
---

# Micro-Commitment — лестница микро-обязательств

## When to activate

- Проектируется signup flow или onboarding
- Оптимизируется воронка конверсии
- Создаётся freemium / trial механизм
- Пользователь спрашивает «как уменьшить трение в воронке»
- Перед проектированием checkout

## Принцип: от маленького «да» к большому «да»

### УРОВЕНЬ 1 — Нулевое трение (анонимно)
- Calculator: «Посчитай свой ROI»
- Quiz: «Какой план подойдёт вам?»
- Checker: «Проверь свой сайт бесплатно»
- Preview: «Посмотри 3 примера без регистрации»

### УРОВЕНЬ 2 — Минимальное трение (email)
- «Получи результаты на email»
- «Сохрани свой расчёт»
- Waitlist с прогресс-баром позиции в очереди

### УРОВЕНЬ 3 — Средний commitment (профиль)
- «Настрой под свою компанию»
- Onboarding с прогрессом (gamification)
- First value moment в < 5 минут

### УРОВЕНЬ 4 — Полный commitment (платёж)
- Только ПОСЛЕ того, как пользователь испытал реальную ценность продукта
- «Вы уже сэкономили X — хотите продолжить?»

## Дизайн-правило

Каждый уровень должен давать немедленную ценность ПЕРЕД запросом следующего. Никогда не проси commitment прежде чем дал value.

## Step-by-step execution protocol

1. **Map current funnel**: Визуализировать текущую воронку конверсии
2. **Identify friction points**: Найти где пользователи отваливаются
3. **Design Level 1**: Создать элемент с нулевым трением (calculator / quiz / checker)
4. **Design Level 2**: Определить момент запроса email (после value от Level 1)
5. **Design Level 3**: Спроектировать onboarding с first value moment < 5 мин
6. **Design Level 4**: Определить триггер для запроса платежа (после подтверждённой ценности)
7. **Validate**: Проверить что каждый уровень даёт value ПЕРЕД запросом следующего
8. **Measure**: Настроить метрики для каждого уровня воронки

## Scope boundaries

### DOES
- Проектировать многоуровневые воронки конверсии
- Определять моменты запроса commitment
- Снижать трение на каждом уровне
- Связывать каждый уровень с value для пользователя

### DOES NOT
- Создавать манипулятивные dark patterns
- Скрывать реальную стоимость до последнего момента
- Форсировать платёж без демонстрации ценности
- Заменять A/B тестирование воронок

## Error handling

| Scenario | Response |
|----------|----------|
| Нет возможности создать Level 1 (нулевой трение) | Предложить email-only вход с минимальными полями |
| Продукт не имеет freemium | Предложить extended trial или money-back guarantee |
| Слишком длинный onboarding на Level 3 | Разбить на micro-steps с value на каждом |
| Пользователь не видит value перед Level 4 | Добавить «aha moment» — демонстрацию ключевой функции |

## References

- [SMMplan Design Specification](file:///d:/SMM_plan_2/docs/design_specification.md)
- [SMMplan Legal Audits](file:///d:/SMM_plan_2/production_readiness_audit.md)