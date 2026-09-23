---
name: iterative-loop-orchestrator
description: Управляет закольцованной мультиагентной системой (Orchestrator -> Generator -> Auditor/Checker loop), гарантируя непрерывную работу субагентов до 100% выполнения критериев и фиксацию знаний в MEMORY.md.
---

# Iterative Loop Orchestrator (Закольцованный мультиагентный цикл)

Этот навык реализует автономный итеративный цикл работы субагентов по методологии **Loop Engineering (Ralph Loop / Maker-Checker / Generator-Reflector)**.

---

## 1. Архитектура цикла

```
                  ┌─────────────────────────────────┐
                  │ 1. Чтение AGENTS.md + MEMORY.md │
                  │     и установка критериев       │
                  │    в .planning/task_state.md    │
                  └────────────────┬────────────────┘
                                   │
                                   ▼
                  ┌─────────────────────────────────┐
                  │  2. GENERATOR (Субагент-кодер)  │ ◄──────────┐
                  │     Реализация / Исправление     │            │
                  └────────────────┬────────────────┘            │
                                   │                             │
                                   ▼                             │
                  ┌─────────────────────────────────┐            │
                  │ 3. AUDITOR (Субагент-проверщик) │            │
                  │    (tsc, vitest, security, UI)  │            │
                  └────────────────┬────────────────┘            │
                                   │                             │
                        [STATUS: REJECTED]                       │
                     (Замечания + лог ошибок)                    │
                                   ├─────────────────────────────┘
                                   │
                        [STATUS: APPROVED]
                                   │
                                   ▼
                  ┌─────────────────────────────────┐
                  │ 4. Фиксация опыта в MEMORY.md   │
                  │    и сдача готового результата  │
                  └─────────────────────────────────┘
```

---

## 2. Инициализация субагентов через `define_subagent`

Оркестратор выбирает профильных специалистов из Реестра экспертов:
👉 Полный каталог промптов и ролей: [`.agents/skills/expert-roles-registry/SKILL.md`](file:///d:/SMM_plan_2/.agents/skills/expert-roles-registry/SKILL.md)

Доступные роли:
1. `@frontend_architect` — интерфейсы, HeroUI v3, Tailwind 4, адаптивность.
2. `@backend_architect` — Server Actions, Prisma 5, PostgreSQL, Shadow Catalog.
3. `@security_auditor` — аудит безопасности, IDOR, Trust Boundary (только чтение).
4. `@fintech_specialist` — 54-ФЗ, НДС 2026 (22%), ЮKassa/Robokassa, WalletOps.
5. `@qa_engineer` — автотесты Vitest, Playwright, typecheck.
6. `@seo_specialist` — Multi-Tenant SEO, OpenGraph, Canonical URLs, JSON-LD.
7. `@ux_copywriter` — тексты ошибок, конверсионный UX-копирайтинг.

### Базовая связка по умолчанию (Maker + Checker):
- **Maker (Исполнитель):** `@code_generator` (или профильный специалист выше)
- **Checker (Контролер):** `@quality_auditor` (или `@security_auditor`)


---

## 3. Пошаговый протокол выполнения

1. **Фаза 1: Подготовка**
   - Выполнить RAG-поиск: `npx tsx scripts/query-rag.ts "<контекст задачи>"`.
   - Обновить `.planning/task_state.md`, задав номер итерации `1 / 5` и критерии готовности.

2. **Фаза 2: Вызов Генератора**
   - Запустить `invoke_subagent` с `TypeName: "code_generator"` и подробным описанием задачи.
   - Получить результат работы.

3. **Фаза 3: Вызов Аудитора**
   - Запустить `invoke_subagent` с `TypeName: "quality_auditor"` для проверки измененных файлов.
   - Получить вердикт.

4. **Фаза 4: Анализ вердикта (Закольцовка)**
   - Если вердикт **`[STATUS: REJECTED]`**:
     - Увеличить счетчик итераций в `.planning/task_state.md`.
     - Записать замечания аудитора в `task_state.md`.
     - Отправить сообщение Генератору через `send_message` с текстом замечаний.
     - Вернуться на Фазу 3.
   - Если вердикт **`[STATUS: APPROVED]`**:
     - Пометить все критерии в `.planning/task_state.md` как `[x]`.
     - При наличии важных новых архитектурных находок добавить запись в `MEMORY.md`.
     - Предоставить финальный отчет пользователю.
