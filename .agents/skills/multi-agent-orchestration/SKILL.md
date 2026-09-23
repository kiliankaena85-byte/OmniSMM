---
name: multi-agent-orchestration
description: "Параллельные агенты: дизайн+copy+performance, orchestration protocol, handoff between skills. Активировать при комплексных задачах требующих несколько скиллов, при параллельной работе, при orchestration. ALWAYS activate for complex multi-skill tasks, parallel agent coordination, design+copy+performance orchestration. Use this skill to scan, check, and validate when auditing or implementing this topic."
version: 1.0.0
---

# Multi-Agent Orchestration — параллельные агенты

## When to activate

- Задача требует одновременной работы нескольких скиллов
- Нужна координация между design, copy и performance
- Пользователь просит комплексный редизайн
- Нужен parallel workflow для ускорения
- Результат одного скилла = вход для другого

## Orchestration Patterns

### Pattern 1: Sequential Pipeline
```text
client-dna → competitor-decode → steal-adapt-reject → design-tokens → UI generation → visual-qa
```
Каждый шаг зависит от предыдущего. Используется для новых проектов.

### Pattern 2: Parallel Fan-out
```text
               → design-tokens (colors, spacing)
client-dna  → → copywriting-ux-writing (texts)
               → onboarding-engineering (flow)
```
Независимые задачи запускаются параллельно. Используется когда контекст известен.

### Pattern 3: Iterative Loop
```text
design → visual-qa → fix → visual-qa → ship
```
Повторять до достижения качества. Используется для polish.

## Handoff Protocol

При передаче работы между скиллами:

1. **Output spec**: Каждый скилл формирует структурированный output
2. **Context bag**: Передать контекст (client-dna, constraints, decisions)
3. **Validation**: Следующий скилл валидирует input перед работой
4. **Traceability**: Каждое решение связано с источником

## Common Orchestration Scenarios

### New Landing Page
```text
1. client-dna (5 мин) →
2. competitor-decode + conversion-intelligence (parallel, 10 мин) →
3. steal-adapt-reject (5 мин) →
4. design-tokens + copywriting-ux-writing + cognitive-load (parallel, 15 мин) →
5. UI generation (20 мин) →
6. browser-visual-qa + accessibility-advantage (parallel, 10 мин)
```

### Redesign
```text
1. analytics-to-design (data review) +
   competitor-decode (market audit) (parallel) →
2. steal-adapt-reject →
3. design-tokens (update) + copywriting-ux-writing (rewrite) (parallel) →
4. UI update →
5. visual-regression-testing + browser-visual-qa (parallel)
```

## Step-by-step execution protocol

1. **Analyze task**: Определить какие скиллы нужны для задачи
2. **Choose pattern**: Выбрать orchestration pattern (sequential / parallel / iterative)
3. **Define handoffs**: Определить что каждый скилл передаёт следующему
4. **Execute Phase 1**: Запустить первые скиллы (обычно client-dna + research)
5. **Execute Phase 2**: Запустить параллельные дизайн-скиллы
6. **Execute Phase 3**: Сгенерировать UI с учётом всех входных данных
7. **Execute Phase 4**: Запустить QA скиллы параллельно
8. **Synthesize**: Объединить результаты, сформировать финальный output

## Scope boundaries

### DOES
- Координировать работу нескольких скиллов
- Выбирать оптимальный orchestration pattern
- Определять handoff protocol между скиллами
- Управлять зависимостями между задачами

### DOES NOT
- Заменять отдельные скиллы (только координирует)
- Выполнять работу за скиллы (делегирует)
- Гарантировать что orchestration быстрее чем sequential
- Управлять приоритетами (решает пользователь)

## Error handling

| Scenario | Response |
|----------|----------|
| Скилл возвращает ошибку | Пропустить, продолжить с available данными, отметить gap в отчёте |
| Параллельные результаты конфликтуют | Приоритизировать: client-dna > competitor data > general principles |
| Недостаточно контекста для handoff | Запустить недостающий скилл синхронно перед продолжением |
| Слишком много скиллов для одной задачи | Упростить: выбрать top 3 по влиянию на результат |

## References

- [SMMplan Design Specification](file:///d:/SMM_plan_2/docs/design_specification.md)
- [SMMplan Legal Audits](file:///d:/SMM_plan_2/production_readiness_audit.md)