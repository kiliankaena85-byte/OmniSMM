---
name: design-system-management
description: "Стадии зрелости дизайн-системы + Design Debt management: от ad-hoc к systematized. Активировать при создании дизайн-системы, при оценке зрелости, при управлении design debt. ALWAYS activate for design system creation, maturity assessment, design debt management, component library architecture. Use this skill to scan, check, and validate when auditing or implementing this topic."
version: 1.0.0
---

# Design System Management — стадии зрелости + Design Debt

## When to activate

- Создаётся или масштабируется дизайн-система
- Нужна оценка зрелости текущей системы
- Накопился design debt и нужен план его устранения
- Команда растёт и нужна консистентность
- Пользователь упоминает design system, component library

## Стадии зрелости дизайн-системы

### Стадия 1: Ad-hoc
- Каждый проект = с нуля
- Нет общих компонентов
- Стили inline или копируются
- **Цель:** Создать первые tokens и базовые компоненты

### Стадия 2: Emerging
- Есть базовые компоненты (Button, Input, Card)
- Цвета и типографика частично систематизированы
- Компоненты не документированы
- **Цель:** Документация + design tokens

### Стадия 3: Systematized
- Полный набор tokens (Primitive → Semantic → Component)
- Компонентная библиотека с документацией
- Dark mode / multi-theme поддержка
- **Цель:** Adoption + contribution model

### Стадия 4: Optimized
- Automated testing (visual regression)
- Contribution от всех команд
- Metrics: adoption rate, component coverage
- **Цель:** Continuous improvement + innovation

## Design Debt Management

### Типы Design Debt
1. **Visual debt** — несогласованные стили, different shades of grey
2. **Component debt** — дублирование компонентов, не-shared код
3. **Token debt** — hardcoded values вместо tokens
4. **Documentation debt** — компоненты без описания

### Формула Debt Score
```text
Design Debt = (Visual debt items × 1) + (Component debt × 2) + (Token debt × 3) + (Documentation debt × 1)
```

### Погашение Design Debt
- Каждые 2 недели: 20% спринта на debt reduction
- Каждое новое feature: не увеличивать debt
- Квартальный audit: полный пересчёт debt score

## Step-by-step execution protocol

1. **Assess maturity**: Определить текущую стадию дизайн-системы (1-4)
2. **Calculate debt**: Подсчитать Design Debt Score по 4 типам
3. **Set target stage**: Определить целевую стадию на следующий квартал
4. **Prioritize debt**: Ранжировать debt items по влиянию на консистентность
5. **Create roadmap**: Составить план перехода к следующей стадии
6. **Setup tokens**: Если Стадия < 3 — запустить design-tokens skill
7. **Document**: Создать документацию для каждого компонента
8. **Measure adoption**: Настроить метрики adoption rate и coverage

## Scope boundaries

### DOES
- Оценивать зрелость дизайн-системы
- Управлять design debt
- Создавать roadmap развития дизайн-системы
- Настраивать метрики (adoption, coverage, debt score)

### DOES NOT
- Проектировать конкретные UI-компоненты (только систему)
- Заменять Storybook / Chromatic (рекомендует)
- Управлять командой дизайнеров
- Создавать бренд-гайд (используйте client-dna)

## Error handling

| Scenario | Response |
|----------|----------|
| Нет дизайн-системы вообще | Начать со Стадии 1: tokens + 3 базовых компонента |
| Команда сопротивляется adoption | Показать ROI: скорость разработки, консистентность |
| Слишком много debt для одного спринта | Приоритизировать: Token debt (×3) > Component debt (×2) |
| Legacy код с inline стилями | Постепенная миграция: новые компоненты → tokens, legacy — по мере рефакторинга |

## References

- [SMMplan Design Specification](file:///d:/SMM_plan_2/docs/design_specification.md)
- [SMMplan Legal Audits](file:///d:/SMM_plan_2/production_readiness_audit.md)