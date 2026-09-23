---
name: first-impression
description: "Оптимизация первых 50мс: иерархия доверия, trust signals, anti-trust patterns. 94% первых впечатлений связаны с дизайном. Активировать при проектировании hero, landing page, при оптимизации доверия, при audit первой страницы. ALWAYS activate for hero section design, landing page first screen, trust optimization, first impression audit. Use this skill to scan, check, and validate when auditing or implementing this topic."
version: 1.0.0
---

# First Impression — первые 50 миллисекунд

## When to activate

- Проектируется hero section или первый экран landing page
- Нужна оптимизация доверия к сайту
- Пользователь спрашивает про «первое впечатление»
- Audit существующей страницы — есть ли trust signals
- Bounce rate высокий на первой странице

## Иерархия доверия (первые 50мс)

1. **Визуальный вес** → левый верхний угол = самый доверенный
2. **Контраст** → primary CTA должна «выпрыгивать» из фона
3. **Whitespace** → пустое пространство = сигнал премиума
4. **Типографика** → один шрифт, максимум два веса в герое

## Trust Signals — обязательные элементы

- Social proof в fold (цифры, логотипы клиентов, отзывы)
- Security indicators рядом с формами
- Реальные фотографии > иллюстрации для B2B
- Конкретные цифры: «2,847 teams» > «thousands of teams»

## Anti-trust patterns (ЗАПРЕТ)

- Stock photos с людьми в костюмах и улыбками
- Счётчики «X посетителей онлайн» (воспринимаются как фейк)
- «100% satisfaction guaranteed» без верификации
- Generic testimonials без фото, должности, компании
- Popup/модалка при первом визите

## Step-by-step execution protocol

1. **Screenshot current hero**: Захватить первый экран через Browser Agent
2. **50ms test**: Оценить что пользователь видит за первые 50мс (визуальный вес, контраст, whitespace)
3. **Trust signals audit**: Проверить наличие social proof, security indicators, конкретных данных
4. **Anti-trust check**: Найти элементы, разрушающие доверие
5. **CTA visibility**: Убедиться что primary CTA виден без скролла
6. **Mobile check**: Проверить первый экран на мобильном (viewport 375px)
7. **Recommend improvements**: Предложить конкретные изменения с приоритетами
8. **Compare before/after**: Показать что изменится после внедрения рекомендаций

## Scope boundaries

### DOES
- Оценивать первое впечатление страницы (первые 50мс)
- Аудитить trust signals и anti-trust patterns
- Оптимизировать hero section для доверия
- Проверять видимость CTA на первом экране

### DOES NOT
- Анализировать весь user journey (используйте adaptive-context)
- Заменять heatmap-анализ
- Проектировать полный landing page (только первый экран)
- Оценивать конверсию (используйте conversion-intelligence)

## Error handling

| Scenario | Response |
|----------|----------|
| Нет social proof данных | Предложить временные решения: «Trusted by teams at...» с логотипами |
| Конкурент использует anti-trust pattern и это «работает» | Объяснить краткосрочный vs долгосрочный эффект на доверие |
| Hero перегружен контентом | Приоритизировать по иерархии доверия, убрать второстепенное |
| Мобайл: trust signals не влезают | Использовать compact формат: логотипы в строку, цифры рядом с CTA |

## References

- [SMMplan Design Specification](file:///d:/SMM_plan_2/docs/design_specification.md)
- [SMMplan Legal Audits](file:///d:/SMM_plan_2/production_readiness_audit.md)