---
name: bias-to-design
description: "Когнитивные биасы → дизайн-решения: Social Proof, Scarcity, Anchoring, Loss Aversion, Peak-End Rule. Активировать при проектировании pricing, checkout, hero, при оптимизации конверсии через психологию. ALWAYS activate for pricing page design, checkout optimization, persuasive design, when applying cognitive biases ethically to UI. Use this skill to scan, check, and validate when auditing or implementing this topic."
version: 1.0.0
---

# Bias-to-Design — когнитивные биасы → дизайн-решения

## When to activate

- Проектируется pricing page (anchoring, scarcity)
- Оптимизируется checkout flow (loss aversion)
- Создаются social proof элементы
- Нужна persuasive design без манипуляции
- Пользователь спрашивает «как увеличить конверсию психологически»

## Social Proof (Социальное доказательство)

**Биас:** «Если другие делают — значит правильно»
**Дизайн:** живые счётчики пользователей, логотипы клиентов, «X человек смотрят это прямо сейчас»
**Где:** hero, pricing page, checkout

## Scarcity + Urgency (Дефицит)

**Биас:** то, чего мало — ценнее
**Дизайн:** «Осталось 3 места», прогресс-бары заполненности, countdown только для реальных дедлайнов
**Важно:** ТОЛЬКО честные данные — ложный дефицит убивает доверие

## Anchoring (Якорение)

**Биас:** первое число = точка отсчёта
**Дизайн:** показывай premium plan первым, зачёркнутая цена рядом с текущей, «Сэкономьте $X/год» рядом с ценой

## Loss Aversion (Боязнь потери)

**Биас:** потеря ощущается сильнее, чем эквивалентная прибыль
**Дизайн:** «Не теряйте данные» > «Сохраните данные», «Бесплатно до 30 апреля» > «Скидка 30%», Framing: что потеряет пользователь БЕЗ продукта

## Peak-End Rule (Правило пика и финала)

**Биас:** запоминают пик переживания и финал
**Дизайн:** onboarding = восхитительный момент открытия, offboarding = достойное прощание с retention-попыткой, Success state = micro-celebration

## Этическое правило

Ложный дефицит, фейковые отзывы и манипулятивный urgency — ЗАПРЕЩЕНЫ. Когнитивные биасы должны использоваться для помощи пользователю в принятии решения, а не для принуждения.

## Step-by-step execution protocol

1. **Identify page type**: Определить тип страницы (pricing / checkout / hero / onboarding)
2. **Map relevant biases**: Выбрать 2-3 биаса, релевантных для этого типа страницы
3. **Design elements**: Для каждого биаса — спроектировать конкретный UI-элемент
4. **Ethics check**: Убедиться что каждый элемент использует честные данные
5. **Integrate with client-dna**: Сверить что биасы соответствуют tone of voice бренда
6. **A/B plan**: Предложить план A/B тестирования для каждого элемента
7. **Implement**: Реализовать элементы в коде
8. **Measure**: Определить метрики для оценки эффективности

## Scope boundaries

### DOES
- Применять когнитивные биасы к UI-дизайну этично
- Проектировать pricing, checkout, hero с учётом психологии
- Проверять этичность каждого применения биаса
- Интегрировать с client-dna для соответствия бренду

### DOES NOT
- Использовать ложный дефицит или фейковые данные
- Манипулировать пользователями (только помогать принимать решения)
- Заменять A/B тестирование
- Гарантировать рост конверсии от конкретного биаса

## Error handling

| Scenario | Response |
|----------|----------|
| Клиент просит «фейковый countdown» | Отказать, объяснить риск потери доверия, предложить честную альтернативу |
| Биас противоречит tone of voice | Адаптировать: premium бренд — subtle anchoring вместо агрессивного |
| Несколько биасов конфликтуют на одной странице | Приоритизировать по влиянию на ключевую метрику |
| Нет данных для social proof | Предложить собрать данные ДО реализации, не использовать фейковые |

## References

- [SMMplan Design Specification](file:///d:/SMM_plan_2/docs/design_specification.md)
- [SMMplan Legal Audits](file:///d:/SMM_plan_2/production_readiness_audit.md)