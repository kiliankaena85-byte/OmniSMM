---
name: onboarding-engineering
description: "Time-to-Value архитектура: first value moment < 5 минут, progressive onboarding, aha-moment, retention engineering. Активировать при проектировании onboarding, первого опыта, trial, signup flow, при оптимизации retention. ALWAYS activate for onboarding design, first-time user experience, trial optimization, retention engineering, when Time-to-Value matters. Use this skill to scan, check, and validate when auditing or implementing this topic."
version: 1.0.0
---

# Onboarding Engineering — Time-to-Value архитектура

## When to activate

- Проектируется onboarding flow для нового продукта
- Оптимизируется first-time user experience
- Создаётся trial или freemium механизм
- Пользователь спрашивает про retention, churn, first value
- Нужен «aha moment» — момент когда пользователь понимает ценность

## Core Principle: Time-to-Value < 5 минут

Retention определяется в первую сессию. Если пользователь не получил ценность за 5 минут — вероятность возвращения падает на 70%. Каждый экран onboarding должен приближать к first value moment.

## Архитектура Onboarding

### Фаза 1: Welcome (< 30 секунд)
- Минимум текста, максимум действия
- Один выбор максимум на каждом экране
- Skip option на каждом шаге (кроме критичных)

### Фаза 2: Setup (1-3 минуты)
- Smart defaults вместо ручной настройки
- Import из существующих инструментов
- Template selection вместо blank canvas

### Фаза 3: First Value (3-5 минут)
- «Aha moment» — пользователь видит результат
- Real data > demo data (если возможно)
- Immediate feedback на каждое действие

### Фаза 4: Habit Hook (5+ минут)
- Trigger → Action → Variable Reward → Investment
- Настройка первого reminder/notification
- Social proof: «X пользователей уже сделали это»

## Анти-паттерны Onboarding

- Туториал на 10 экранов без действия
- Обязательная заполненная анкета до первого value
- Demo data без возможности попробовать с реальными данными
- Progress bar без смысла (заполнение ради заполнения)
- Tooltip-спам при загрузке

## Step-by-step execution protocol

1. **Map value path**: Определить кратчайший путь от signup до first value moment
2. **Identify aha moment**: Сформулировать что конкретно должно «щёлкнуть» в голове пользователя
3. **Design welcome**: Минимальный welcome screen, ведущий к действию
4. **Design setup**: Smart defaults, import options, template selection
5. **Design first value**: Экран где пользователь видит реальный результат
6. **Measure TTW**: Измерить Time-to-Value в минутах
7. **Add habit hooks**: Встроить триггеры для возвращения
8. **Iterate**: A/B тест вариантов onboarding, оптимизировать TTW

## Scope boundaries

### DOES
- Проектировать onboarding flow с фокусом на Time-to-Value
- Определять и оптимизировать «aha moment»
- Устранять анти-паттерны onboarding
- Интегрировать с micro-commitment ladder

### DOES NOT
- Проектировать весь продукт (только onboarding flow)
- Заменять user research (наблюдение за реальными новичками)
- Гарантировать конкретный retention rate
- Создавать контент для onboarding (только структуру)

## Error handling

| Scenario | Response |
|----------|----------|
| Продукт слишком сложный для 5-минутного TTW | Разбить на micro-onboarding: quick win → progressive depth |
| Нет данных для first value (пустой продукт) | Предложить seed data, templates, примеры из индустрии |
| Пользователь пропускает onboarding | Настроить contextual help, progressive disclosure при следующем визите |
| Aha moment неочевиден | Провести 5 пользовательских интервью для выявления |

## References

- [SMMplan Design Specification](file:///d:/SMM_plan_2/docs/design_specification.md)
- [SMMplan Legal Audits](file:///d:/SMM_plan_2/production_readiness_audit.md)