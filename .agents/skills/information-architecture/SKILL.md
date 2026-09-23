---
name: information-architecture
description: "Navigation Decision Tree, IA audit, организация контента, findability. Уходят не из-за дизайна, а из-за 'не найти'. Активировать при проектировании навигации, структуры сайта, при audit findability, при card sorting. ALWAYS activate for navigation design, site structure, information architecture, content organization, findability optimization. Use this skill to scan, check, and validate when auditing or implementing this topic."
version: 1.0.0
---

# Information Architecture — Navigation Decision Tree

## When to activate

- Проектируется навигация и структура сайта
- Пользователи жалуются «не могу найти нужное»
- Нужен IA audit текущего сайта
- Создаётся новый раздел и нужно определить его место в структуре
- Проводится card sorting или tree testing

## Navigation Decision Tree

### Сколько уровней навигации?

**1 уровень** (≤ 5 страниц): Single nav bar
**2 уровня** (6-15 страниц): Nav bar + dropdown / mega menu
**3 уровня** (16-50 страниц): Nav bar + sidebar + breadcrumbs
**4+ уровня** (> 50 страниц): Hub-and-spoke + search + breadcrumbs

### Тип навигации по контексту

| Контекст | Тип навигации | Пример |
|----------|--------------|--------|
| Marketing site | Horizontal nav + CTA | SaaS landing |
| Dashboard | Sidebar + tabs | Analytics tool |
| Documentation | Sidebar + search + breadcrumbs | API docs |
| E-commerce | Mega menu + filters + breadcrumbs | Online store |
| Application | Command palette + sidebar | IDE / Design tool |

## IA Audit Checklist

- [ ] Каждая страница доступна за ≤ 3 клика от homepage
- [ ] Breadcrumbs на всех внутренних страницах
- [ ] Search для сайтов с > 20 страницами
- [ ] 404 page с навигацией и поиском
- [ ] URL структура отражает IA (/products/category/item)
- [ ] Текущая страница выделена в навигации

## Findability Metrics

- Time to find: среднее время поиска конкретной информации
- Success rate: % пользователей нашедших нужное
- Navigation depth: среднее количество кликов до цели
- Search-to-click ratio: сколько используют поиск vs навигацию

## Step-by-step execution protocol

1. **Content inventory**: Составить полный список всех страниц и контента
2. **Card sorting**: Провести открытый/закрытый card sorting с пользователями
3. **Create tree structure**: Построить иерархию на основе результатов
4. **Design navigation**: Выбрать тип навигации по контексту (Decision Tree)
5. **Validate with tree testing**: Проверить findability без визуального дизайна
6. **Implement breadcrumbs**: Добавить breadcrumbs на все внутренние страницы
7. **Add search**: Интегрировать поиск для > 20 страниц
8. **Measure findability**: Настроить метрики (time to find, success rate)

## Scope boundaries

### DOES
- Проектировать информационную архитектуру и навигацию
- Проводить IA audit
- Рекомендовать тип навигации по контексту
- Определять findability metrics

### DOES NOT
- Проектировать визуальный дизайн навигации (только структуру)
- Заменять user research (card sorting с реальными пользователями)
- Создавать контент (только организовывать)
- Настраивать search engine

## Error handling

| Scenario | Response |
|----------|----------|
| Слишком много разделов для одного уровня | Создать хаб-страницы, группирующие связанные разделы |
| Конфликт между IA и бизнес-приоритетами | Приоритет — IA, но предложить featured links для бизнес-целей |
| Flat vs deep hierarchy | A/B тест: flat (много в меню) vs deep (много кликов) |
| Нет бюджета на card sorting | Использовать reverse card sorting с существующими аналитиками |

## References

- [SMMplan Design Specification](file:///d:/SMM_plan_2/docs/design_specification.md)
- [SMMplan Legal Audits](file:///d:/SMM_plan_2/production_readiness_audit.md)