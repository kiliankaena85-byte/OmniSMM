---
name: analytics-to-design
description: "Данные → Гипотеза → Тест: аналитика как источник дизайн-решений, A/B тестирование, data-driven дизайн. Активировать при работе с аналитикой, при формулировании гипотез, при A/B тестировании. ALWAYS activate for data-driven design, A/B testing, analytics-based decisions, when design hypotheses need validation. Use this skill to scan, check, and validate when auditing or implementing this topic."
version: 1.0.0
---

# Analytics → Design — данные → гипотеза → тест

## When to activate

- Есть данные аналитики и нужно принять дизайн-решение
- Формулируется A/B тест
- Пользователь спрашивает «что показывают данные»
- Нужна data-driven оптимизация конверсии
- Перед запуском A/B теста — нужна гипотеза

## Цикл «Данные → Гипотеза → Тест»

```text
АНАЛИТИКА → ИНСАЙТ → ГИПОТЕЗА → ТЕСТ → РЕЗУЛЬТАТ
     ↑                                        │
     └────────── Обучение ←──────────────────┘
```

### Шаг 1: Данные → Инсайт
- Heatmap: куда кликают / куда не кликают
- Scroll depth: где теряют внимание
- Funnel: на каком шаге отваливаются
- Session recording: где «застревают»

### Шаг 2: Инсайт → Гипотеза
Формат: «Если мы [изменим X], то [метрика Y] [улучшится на Z%], потому что [причина]»

Пример: «Если мы переместим CTA выше fold, то CTR увеличится на 15%, потому что 60% пользователей не скроллят ниже hero»

### Шаг 3: Гипотеза → Тест
- Minimum sample size: 100 конверсий на вариант
- Duration: минимум 1 бизнес-цикл (обычно 2 недели)
- One metric: одна primary metric per test
- Statistical significance: 95% confidence

## Аналитические сигналы для дизайн-решений

| Сигнал | Что значит | Дизайн-действие |
|--------|-----------|-----------------|
| High bounce на mobile | Mobile UX проблема | Audit mobile layout |
| Scroll depth < 50% | Контент не виден | Переставить CTA выше |
| Form abandonment на шаге 3 | Слишком сложно | Уменьшить поля, добавить прогресс |
| CTR на secondary CTA > primary | Иерархия нарушена | Пересмотреть CTA дизайн |
| Rage clicks | Элемент не интерактивен | Сделать кликабельным или убрать |

## Step-by-step execution protocol

1. **Collect data**: Собрать данные из Google Analytics / Hotjar / Mixpanel
2. **Identify signals**: Найти аномалии и паттерны в поведении
3. **Formulate insight**: Перевести данные в понятное наблюдение
4. **Write hypothesis**: Оформить гипотезу в формате «Если... то... потому что...»
5. **Design test variant**: Создать вариант страницы для тестирования
6. **Setup A/B test**: Настроить сплит-тест с правильным sample size
7. **Run test**: Запустить на минимум 2 недели
8. **Analyze results**: Оценить statistical significance, принять решение

## Scope boundaries

### DOES
- Переводить аналитические данные в дизайн-гипотезы
- Формулировать A/B тесты с правильной методологией
- Идентифицировать аналитические сигналы для дизайн-оптимизации
- Создавать data-driven roadmap улучшений

### DOES NOT
- Настраивать Google Analytics / Hotjar (только интерпретировать данные)
- Проводить статистический анализ (только базовую significance)
- Заменять qualitative research (интервью, usability tests)
- Гарантировать конкретный результат A/B теста

## Error handling

| Scenario | Response |
|----------|----------|
| Нет данных аналитики | Предложить установить GA4 + Hotjar, начать с baseline |
| Слишком мало трафика для A/B теста | Использовать qualitative методы (5 user tests) |
| Результат A/B теста неоднозначен | Увеличить sample size или изменить metric |
| Несколько гипотез конфликтуют | Приоритизировать по ICE score (Impact × Confidence × Ease) |

## References

- [SMMplan Design Specification](file:///d:/SMM_plan_2/docs/design_specification.md)
- [SMMplan Legal Audits](file:///d:/SMM_plan_2/production_readiness_audit.md)