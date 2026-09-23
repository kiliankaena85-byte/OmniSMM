---
name: adaptive-context
description: "Контекстная адаптация интерфейса: по источнику трафика, устройству, времени, роли. Активировать при персонализации UI, адаптивном дизайне, contextual UX, когда 'один размер не подходит всем'. ALWAYS activate for personalization, contextual UI, adaptive interfaces, when different user segments need different experiences. Use this skill to scan, check, and validate when auditing or implementing this topic."
version: 1.0.0
---

# Adaptive Context — интерфейс, меняющийся под контекст

## When to activate

- Разные сегменты пользователей приходят с разными потребностями
- Нужна персонализация landing page по источнику трафика
- Проектируется адаптивный интерфейс для разных устройств
- Пользователь упоминает «разные версии для разных аудиторий»
- Есть данные о разных поведениях на разных устройствах

## Контекстные вариации одной страницы

### По источнику трафика

#### from: Google Ads «цена CRM»
→ hero: pricing-first layout, ROI calculator сразу
→ НЕ показывать: длинный features list

#### from: LinkedIn пост CEO
→ hero: thought-leadership tone, enterprise social proof
→ НЕ показывать: «бесплатный тариф»

#### from: Referral от клиента
→ hero: «Вас порекомендовал [Name]» персонализация
→ Показывать: exclusive offer для referral

### По устройству

- **Mobile** → thumb-zone navigation, swipe-based
- **Tablet на совещании** → presentation mode, large typography
- **Desktop 9am** → productivity focus, dense UI
- **Desktop 6pm** → relaxed pace, more whitespace

### По роли

- **Admin** → settings-first, full access indicators
- **End user** → task-focused, simplified navigation
- **Viewer** → read-only, emphasise content over actions

## Step-by-step execution protocol

1. **Map user segments**: Идентифицировать все сегменты пользователей и их контексты
2. **Identify sources**: Определить основные источники трафика и их намерения
3. **Design variants**: Для каждого контекста — создать вариант hero и key sections
4. **Prioritize**: Выбрать 2-3 приоритетных контекста для первой реализации
5. **Implementation plan**: Определить технический подход (URL params / cookies / server-side)
6. **Content matrix**: Составить матрицу «контекст → контент → CTA»
7. **Build**: Реализовать адаптивные варианты
8. **Measure**: Настроить аналитику по сегментам для оценки эффективности

## Scope boundaries

### DOES
- Проектировать контекстные варианты страниц
- Адаптировать UI по источнику трафика, устройству, роли
- Создавать матрицы «контекст → контент → CTA»
- Персонализировать первый экран

### DOES NOT
- Заменять серверную персонализацию (только UX-рекомендации)
- Создавать полностью разные сайты для каждого контекста
- Игнорировать общие элементы brand identity
- Гарантировать рост конверсии без A/B теста

## Error handling

| Scenario | Response |
|----------|----------|
| Нет данных о источниках трафика | Запросить Google Analytics данные, или предложить universal default |
| Слишком много сегментов | Приоритизировать top 3 по объёму трафика |
| Технически сложно реализовать адаптацию | Предложить progressive enhancement: сначала по device, потом по source |
| Клиент хочет «полностью разные сайты» | Объяснить риск потери brand consistency, предложить модульную систему |

## References

- [SMMplan Design Specification](file:///d:/SMM_plan_2/docs/design_specification.md)
- [SMMplan Legal Audits](file:///d:/SMM_plan_2/production_readiness_audit.md)