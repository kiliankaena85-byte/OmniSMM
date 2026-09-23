# 🔬 DEEP RESEARCH v3: Meta-Prompting & Director-Worker Architecture для генерации UI в Next.js 16

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 DEEP RESEARCH v3 ► COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**Topic:** Архитектурная реализация AI-агента, пишущего промпты для другого AI-агента (Meta-Prompting / Director-Worker) в рамках генерации UI панели SMM.
**Depth:** Deep | **Domain:** Architecture / AI Integration
**Passes:** 4 | **Confidence:** HIGH
**Stack Compatibility:** Next.js 16, React 19, Vercel AI SDK 3.x, Zod
**Output:** `.planning/research/DEEP-RESEARCH-meta-prompting-ui.md`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 1. Контекст & Декомпозиция (Question Decomposition)
- **Q1:** Какой фреймворк оркестрации использовать в Next.js 16 (LangGraph.js vs Vercel AI SDK)?
- **Q2:** Как заставить "Директора" (Meta-Agent) отдавать строгий контракт для "Кодера" (Worker)?
- **Q3:** Как гарантировать соблюдение дизайн-кода (HeroUI v3, Tailwind 4) при передаче контекста между агентами?
- **Q4:** Как избежать таймаутов Serverless/Server Actions при мульти-агентных цепочках?

---

## 2. Source Map (Карта источников)

### 🔴 Priority A — Must Read / Fundamental
| # | Topic | Type | Lang | Covers Q# | Why |
|---|-------|------|------|-----------|-----|
| 1 | `Vercel AI SDK 3.x generateObject & Zod` | Docs | EN/RU | Q2, Q3 | Официальный подход для генерации структурированных контрактов (Structured Outputs) вместо текста. |
| 2 | `LangGraph.js vs Vercel AI SDK Next.js timeouts` | Architecture | EN | Q1, Q4 | Vercel AI SDK идеально ложится в Next.js Server Actions, тогда как LangGraph перегружен для frontend-стейт-машин и вызывает serverless timeouts. |

### 🟡 Priority B — Should Read
| # | Topic | Type | Lang | Covers Q# | Why |
|---|-------|------|------|-----------|-----|
| 3 | `Zod .describe() parameter as Meta-Prompting layer` | Best Practices | EN | Q2 | Ключевая техника управления вниманием LLM при генерации сложного JSON контракта. |

---

## 3. Deep Dive & Key Findings

### 3.1 Оркестрация агентов: Vercel AI SDK `generateObject` ПРЕВОСХОДИТ LangGraph.js в стеке Next.js 16
* **Факт:** Vercel AI SDK нативно интегрирован с Next.js App Router (потоковая передача, Server Actions).
* **Архитектурное решение:** Для вашей задачи не нужен тяжелый LangGraph.js. Цепочка строится через последовательный вызов `generateObject` (для Директора) -> `streamText` (или вызов локального скрипта-агента для Кодера) прямо внутри Server Action.
* **Почему:** Это избегает проблемы двойного таймаута (когда один агент ждет другого > 15 секунд).

### 3.2 Паттерн "Structured Meta-Prompting" через Zod
Агент-Директор **не должен** писать raw text. Он должен генерировать Zod-схему (UI-SPEC).
Оказалось, что лучший способ заставить Директора написать идеальный промпт для Кодера — использовать метод `.describe()` в Zod, который выступает в роли "суб-промпта" для модели.

```typescript
// Контракт, который должен заполнить Директор (Meta-Agent)
const uiSpecSchema = z.object({
  componentHierarchy: z.array(z.string()).describe("Древовидная структура компонентов HeroUI v3 (например, Table > Table.Header)"),
  stateManagement: z.enum(['server_component', 'client_component']).describe("Тип компонента в Next.js 16 (использовать 'use client' только если нужен интерактив или useActionState)"),
  forbiddenPatterns: z.array(z.string()).describe("Ограничения для кодера (например: 'Никаких text-black, использовать text-foreground')"),
  exactMarkdownPrompt: z.string().describe("Готовый Markdown-промпт, который будет отправлен UI-Кодеру без изменений")
});
```
Директор принимает эту схему + бизнес-задачу -> Возвращает жесткий JSON -> Поле `exactMarkdownPrompt` отправляется Кодеру.

### 3.3 Внедрение Манифестов (RAG Context Injection)
Чтобы Директор знал о `Tailwind 4` и `HeroUI v3`, в его системный промпт (до вызова `generateObject`) происходит инъекция содержимого ваших файлов `gsd-tailwind-v4-manifest/SKILL.md` и `gsd-heroui-v3/SKILL.md`. Директор синтезирует их в краткие правила.

### 3.4 Линтинг-петля (The Critic Loop)
После того, как Кодер (Worker Agent) выдаст `.tsx` код, необходим шаг самопроверки (TypeScript compilation).
*Паттерн:* Вы запускаете `npx tsc --noEmit` или `npx eslint --fix`. Если есть ошибка -> ошибка парсится и отправляется обратно Кодеру с префиксом *"Твой код упал с ошибкой сборки. Исправь, не меняя бизнес-логики"*.

---

## 4. Decision Log

1. **[ORCHESTRATION]**: Отказ от LangGraph.js в пользу **Vercel AI SDK Core (`generateObject`)**. Обоснование: нативная поддержка Next.js, нулевой overhead по поднятию отдельного бекенда для стейт-магины, избежание таймаутов Vercel.
2. **[DATA FLOW]**: Использование `Zod` схемы для связи агентов. Директор выдает только `JSON`. Обоснование: Защищает от того, что Директор начнет "болтать" и сломает парсинг промпта Кодером.
3. **[EXECUTION]**: Агент-Кодер выполняется не в браузерном runtime (client-side), а в **Node.js (CLI / Server Action)**, чтобы иметь доступ к файловой системе для создания `.tsx` файлов и запуска проверки `tsc`.

---

## 5. Summary & Рекомендация к внедрению

Для реализации системы в SMM панели, архитектура выглядит так:
1. Вы создаете новый GSD скрипт: `gsd-ui-architect/SKILL.md`.
2. Под капотом скрипт (написанный на Node.js / `tsx`) делает вызов к Gemini API (`gemini-3-flash`) с использованием структурированного вывода (Zod).
3. Сгенерированный JSON (UI-SPEC) сохраняется в `.planning/phases/`.
4. Скрипт триггерит второго агента (`gsd-ui-designer`), передавая ему путь к `UI-SPEC`.
5. Второй агент генерирует `.tsx` код и записывает в `src/components/...`.
6. Скрипт автономно запускает `tsc --noEmit` для валидации.

Эта архитектура:
- ✅ Полностью соответствует парадигме Ralph Loop.
- ✅ Соблюдает Zero-Defect Execution Protocol.
- ✅ Использует актуальный стек (Structured Outputs, AI SDK).
