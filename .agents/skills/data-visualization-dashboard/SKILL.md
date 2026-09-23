---
name: data-visualization-dashboard
description: "Chart Decision Tree, Dashboard UX, data ink ratio, правильный выбор визуализации. SaaS = дашборды. Активировать при проектировании дашбордов, графиков, data viz, при выборе типа chart. ALWAYS activate for dashboard design, chart selection, data visualization, KPI panels, when choosing the right chart type. Use this skill to scan, check, and validate when auditing or implementing this topic."
version: 1.0.0
---

# Data Visualization & Dashboard — Chart Decision Tree

## When to activate

- Проектируется dashboard или analytics page
- Нужно выбрать тип графика для конкретных данных
- Создаются KPI panels и метрики
- Пользователь спрашивает «какой график использовать»
- Оптимизируется data ink ratio

## Chart Decision Tree

### Что вы показываете?

**Сравнение категорий** → Bar chart (horizontal для длинных labels, vertical для коротких)
**Изменение во времени** → Line chart (≤ 7 линий, > 7 → small multiples)
**Часть от целого** → Donut chart (≤ 5 сегментов, > 5 → treemap)
**Распределение** → Histogram (continuous) / Bar chart (discrete)
**Корреляция** → Scatter plot (+ trend line)
**Иерархия** → Treemap / Sunburst
**Поток/воронка** → Funnel chart / Sankey diagram

### Запрещённые визуализации

- Pie chart с > 5 сегментами (используйте donut или bar)
- 3D charts (искажают восприятие пропорций)
- Dual-axis charts (вводят в заблуждение)
- Radar charts с > 6 осей (невозможно сравнить)

## Dashboard UX Principles

### Информационная иерархия
1. **Level 1 — KPI cards**: 3-5 ключевых метрик с trend indicators
2. **Level 2 — Primary charts**: 2-3 основных графика
3. **Level 3 — Detail tables**: детальные данные по запросу

### Data Ink Ratio (Tufte)
- Максимизируйте «data ink» (чернила, несущие информацию)
- Минимизируйте «non-data ink» (gridlines, borders, decoration)
- Цель: > 80% ink должно нести информацию

### Scan Pattern
- Z-pattern для overview dashboards
- F-pattern для detail-heavy dashboards
- Single focal point для real-time monitors

## Step-by-step execution protocol

1. **Define metrics**: Определить 3-5 ключевых метрик (KPI)
2. **Choose chart types**: Использовать Chart Decision Tree для каждого dataset
3. **Design hierarchy**: Расположить KPI → primary charts → detail
4. **Optimize ink ratio**: Убрать non-data ink (gridlines, borders, decoration)
5. **Add interactivity**: Filters, drill-down, tooltips
6. **Design empty/error states**: Что показывать когда нет данных
7. **Mobile adaptation**: Определить что показывать на маленьких экранах
8. **Validate with users**: Проверить что пользователи могут ответить на свои вопросы

## Scope boundaries

### DOES
- Выбирать правильный тип визуализации для данных
- Проектировать информационную иерархию dashboard
- Оптимизировать data ink ratio
- Создавать KPI panels и trend indicators

### DOES NOT
- Реализовывать графики в коде (только спецификацию)
- Заменять data engineering (ETL, aggregation)
- Создавать D3.js / ECharts компоненты
- Анализировать данные (только визуализировать)

## Error handling

| Scenario | Response |
|----------|----------|
| Слишком много метрик для KPI section | Приоритизировать top 5, остальные → secondary panel |
| Нет данных для графика | Показать empty state с пояснением, не пустой график |
| Данные меняются в реальном времени | Добавить auto-refresh с индикатором последнего обновления |
| Пользователь не понимает график | Упростить: убрать decoration, добавить annotations |

## References

- [SMMplan Design Specification](file:///d:/SMM_plan_2/docs/design_specification.md)
- [SMMplan Legal Audits](file:///d:/SMM_plan_2/production_readiness_audit.md)