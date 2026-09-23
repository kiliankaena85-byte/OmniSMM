---
name: cognitive-load
description: "Управление когнитивной нагрузкой в UI: Progressive Disclosure, закон Хика, закон Фиттса, анти-паттерны перегрузки. Активировать при проектировании форм, onboarding, dashboard, при жалобах на 'слишком сложно', при оптимизации UX. ALWAYS activate when designing forms, onboarding flows, dashboards, complex interfaces, or when cognitive overload is suspected. Use this skill to scan, check, and validate when auditing or implementing this topic."
version: 1.0.0
---

# Cognitive Load — управление когнитивной нагрузкой

## When to activate

- Проектируется форма с более чем 3 полями
- Создаётся onboarding flow
- Dashboard с множеством виджетов и данных
- Пользователь жалуется что «слишком сложно» или «не понятно»
- На странице больше 3 CTA
- При проектировании Progressive Disclosure

## Принцип Progressive Disclosure

- Показывай ТОЛЬКО ключевые действия на первом экране
- Дополнительные опции — только по запросу или при скролле
- Максимум 3 CTA на странице
- Каждая страница = одна главная цель

## Закон Хика в UI

Время принятия решений растёт вместе с количеством вариантов. Снижение когнитивной нагрузки на 10% может увеличить конверсию до 30% — особенно в onboarding и e-commerce флоу.

- Минимизируй количество выборов на каждом шаге
- Группируй похожие опции
- Default values для большинства полей
- Smart defaults вместо ручного ввода

## Закон Фиттса в UI

- Primary CTA: минимум 44x44px, в зоне большого пальца
- Деструктивные действия: маленькие и далеко от primary CTA
- Hover area > visual area на 20%
- Touch targets на мобильных: минимум 48x48px

## Запрещено

- Три и более равнозначных CTA в герое
- Carousel с автопрокруткой (снижает доверие на 35%)
- Модалки при первом визите
- Формы с более чем 7 полями без прогресс-индикатора
- Tooltip-спам при загрузке страницы

## Step-by-step execution protocol

1. **Audit current state**: Проанализировать существующую страницу на предмет когнитивной перегрузки
2. **Count decisions**: Посчитать количество решений, которые пользователь должен принять на каждом экране
3. **Apply Hick's Law**: Уменьшить количество выборов, сгруппировать опции, добавить defaults
4. **Apply Fitts's Law**: Проверить размеры и позиции интерактивных элементов
5. **Progressive Disclosure**: Определить что показывать сразу, что по запросу, что при скролле
6. **Validate CTA count**: Убедиться что не более 3 CTA, иерархия чёткая
7. **Mobile check**: Проверить touch targets и thumb zones
8. **Measure**: Оценить когнитивную нагрузку до и после (самоотчёт + heatmap если доступно)

## Scope boundaries

### DOES
- Оценивать когнитивную нагрузку интерфейсов
- Применять Progressive Disclosure, законы Хика и Фиттса
- Идентифицировать анти-паттерны перегрузки
- Рекомендовать упрощение форм, onboarding, dashboards

### DOES NOT
- Заменять юзабилити-тестирование с реальными пользователями
- Проектировать информационную архитектуру (используйте information-architecture skill)
- Оценивать визуальную иерархию (используйте first-impression skill)
- Гарантировать рост конверсии (нужен A/B тест)

## Error handling

| Scenario | Response |
|----------|----------|
| Клиент хочет «все функции на одном экране» | Показать данные о снижении конверсии при перегрузке, предложить Progressive Disclosure |
| Невозможно уменьшить количество полей формы | Предложить multi-step wizard с прогресс-индикатором |
| Dashboard требует много виджетов | Предложить кастомизируемый layout с дефолтным набором |
| Мобайл: не хватает места для CTA 44px | Использовать sticky bottom bar для primary CTA |

## References

- [SMMplan Design Specification](file:///d:/SMM_plan_2/docs/design_specification.md)
- [SMMplan Legal Audits](file:///d:/SMM_plan_2/production_readiness_audit.md)