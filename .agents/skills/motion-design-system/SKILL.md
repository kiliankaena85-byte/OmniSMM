---
name: motion-design-system
description: "Motion = коммуникация, не украшение: timing, easing, choreography, meaningful transitions. Активировать при проектировании анимаций, transitions, micro-interactions, motion system. ALWAYS activate for animation design, transition engineering, micro-interactions, motion system architecture, when motion must communicate not decorate. Use this skill to scan, check, and validate when auditing or implementing this topic."
version: 1.0.0
---

# Motion Design System — motion = коммуникация

## When to activate

- Проектируются анимации и transitions
- Создаётся motion system / animation library
- Пользователь просит «добавить анимации»
- Нужны micro-interactions для feedback
- Motion должен соответствовать бренду (playful vs professional)

## Принцип: Motion = коммуникация

Каждая анимация должна отвечать на вопрос «что она сообщает пользователю?». Если анимация не несёт информации — она декоративна и должна быть удалена или минимизирована.

## Timing Scale

```text
instant:   0ms    → feedback (hover, press)
fast:      100ms  → micro-transitions (toggle, check)
normal:    200ms  → standard transitions (expand, collapse)
slow:      350ms  → complex transitions (page, modal)
dramatic:  500ms  → emphasis (hero entrance, celebration)
```

## Easing Functions

```text
ease-out:      → entering elements (appearing)
ease-in:       → exiting elements (disappearing)
ease-in-out:   → moving elements (repositioning)
spring:        → playful interactions (drag, bounce)
```

## Choreography Rules

1. Elements enter in reading order (top-left → bottom-right)
2. Stagger < 50ms between related elements
3. Only ONE element moves at a time for primary attention
4. Exit before enter (old content leaves → new content arrives)
5. Shared axis transitions for hierarchical navigation

## Запрещено

- Анимация ради анимации (decorative motion без смысла)
- Autoplay carousel (снижает доверие на 35%)
- Looping animations в periphery (отвлекает)
- Flashing / strobing (accessibility violation)
- animation-duration > 1s для некритичных элементов

## Step-by-step execution protocol

1. **Audit existing motion**: Проанализировать текущие анимации на странице
2. **Define motion personality**: Определить motion-стиль бренда (playful / professional / editorial)
3. **Create timing scale**: Зафиксировать timing tokens (instant / fast / normal / slow / dramatic)
4. **Define easing palette**: Выбрать easing functions для каждого типа движения
5. **Design choreography**: Спроектировать последовательность входа/выхода элементов
6. **Implement tokens**: Создать CSS custom properties / JS motion tokens
7. **Build component motion**: Добавить motion к каждому компоненту с обоснованием
8. **Test performance**: Проверить что анимации не падают ниже 60fps

## Scope boundaries

### DOES
- Проектировать motion system с обоснованным timing и easing
- Создавать motion tokens (timing, easing, choreography)
- Обучать принципу «motion = коммуникация»
- Интегрировать motion с brand personality

### DOES NOT
- Создавать конкретные CSS/JS анимации (только спецификацию)
- Заменять GSAP / Framer Motion реализацию
- Гарантировать 60fps на всех устройствах
- Проектировать 3D / WebGL анимации

## Error handling

| Scenario | Response |
|----------|----------|
| Клиент хочет «больше анимаций» | Объяснить принцип motion = коммуникация, предложить meaningful transitions |
| Производительность падает | Уменьшить animated properties, использовать will-change, упростить easing |
| Motion conflict с accessibility | Предложить prefers-reduced-motion fallback |
| Нет motion library в стеке | Рекомендовать Framer Motion (React) / GSAP (vanilla) |

## References

- [SMMplan Design Specification](file:///d:/SMM_plan_2/docs/design_specification.md)
- [SMMplan Legal Audits](file:///d:/SMM_plan_2/production_readiness_audit.md)