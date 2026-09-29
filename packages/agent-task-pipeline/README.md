# @omnismm/agent-task-pipeline

> **Автономный конвейер декомпозиции задач (WBS) и детерминированного принятия решений (Action Arbiter) для ИИ-агентов.**
> Стандарт архитектуры 2026: **0 токенов расхода на арбитраж**, декомпозиция $\le 2$ файлов на задачу, 100% автономия без ручных переспросов человека.

[![TypeScript Strict](https://img.shields.io/badge/TypeScript-5.7+-blue.svg)](https://www.typescriptlang.org/)
[![Model Context Protocol](https://img.shields.io/badge/MCP-1.6.0-green.svg)](https://modelcontextprotocol.io/)
[![Zero Token Overhead](https://img.shields.io/badge/Token_Cost-0_tokens-brightgreen.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🌟 Возможности и Архитектура

Модуль спроектирован по **Гексагональной архитектуре (Ports & Adapters)** и полностью изолирован от внешних баз данных или сторонних сервисов:

```
                      ┌─────────────────────────────────────────┐
                      │    AI-Агент (Antigravity / Claude /     │
                      │          Cursor / VS Code / CI)         │
                      └────────────────────┬────────────────────┘
                                           │
                ┌──────────────────────────┼──────────────────────────┐
                │                          │                          │
        ┌───────▼────────┐        ┌────────▼────────┐        ┌────────▼────────┐
        │   MCP Server   │        │   CLI Adapter   │        │  Node / TS SDK  │
        │  (stdio JSON)  │        │ (task-pipeline) │        │ (Programmatic)  │
        └───────┬────────┘        └────────┬────────┘        └────────┬────────┘
                │                          │                          │
                └──────────────────────────┼──────────────────────────┘
                                           │
                      ┌────────────────────▼────────────────────┐
                      │             STANDALONE CORE             │
                      │  ├─ WbsDecomposer (Декомпозиция WBS)    │
                      │  ├─ ActionArbiter (Матрица арбитража)   │
                      │  └─ Types & Contracts (0 токенов)       │
                      └─────────────────────────────────────────┘
```

1. **WbsDecomposer (Инженерная декомпозиция задач):**
   - Разбивает бизнес-требования на атомарные шаги с жестким лимитом: **не более 2 файлов на 1 задачу**;
   - Строит граф зависимостей (`dependencies`) и вычисляет критический путь (`criticalPath`);
   - Автоматически назначает критерии приемки (юнит-тесты, `tsc --noEmit`, No-Crutch Policy).

2. **ActionArbiter (Детерминированная модель принятия решений, 0 токенов):**
   - Заменяет ненадежную схему «нейронка проверяет нейронку» на математическую матрицу рисков;
   - Автоматически выносит 4 типа вердиктов:
     - `🟢 PROCEED` — мгновенное исполнение без участия человека;
     - `🟡 REDIRECT_SAFE` — автоматический отказ от костылей в пользу безопасной архитектуры;
     - `🔴 ESCALATE_TO_HUMAN` — обращение к человеку строго при риске необратимых потерь;
     - `🚫 REJECT` — категорический отказ при попытке взлома инвариантов безопасности.

3. **Dual Agent Self-Improving Loop (Maker-Checker):**
   - Агент-Maker генерирует код $\to$ Пакет валидируется ActionArbiter и WBS $\to$ Агент-Checker проводит состязательную ревизию без участия человека до получения `STRICT PASS`.

---

## 📦 Быстрый старт

### 1. Установка как независимого пакета

Внутри любого проекта:
```bash
npm install @omnismm/agent-task-pipeline
# или
pnpm add @omnismm/agent-task-pipeline
```

### 2. Экспорт в отдельный Git-репозиторий

Модуль не содержит зависимостей от родительского монорепозитория и готов к самостоятельной жизни:
```bash
cd packages/agent-task-pipeline
git init
git add .
git commit -m "feat: initial commit of standalone agent-task-pipeline v1.0.0"
git remote add origin git@github.com:your-org/agent-task-pipeline.git
git push -u origin main
```

---

## 🔌 Способы подключения к любому агенту

### Вариант А: Подключение через Model Context Protocol (MCP)

Добавьте конфигурацию в `antigravity.json`, `claude_desktop_config.json` или Cursor MCP settings:

```json
{
  "mcpServers": {
    "agent-task-pipeline": {
      "command": "node",
      "args": ["/path/to/packages/agent-task-pipeline/dist/adapters/cli/cli.js", "mcp"]
    }
  }
}
```

Доступные MCP-инструменты агента:
- `decompose_task` — декомпозиция бизнес-задачи на цепочку атомарных WBS-шагов.
- `decide_action` — детерминированный арбитраж вариантов действий (0 токенов расхода).

---

### Вариант Б: Использование через консоль (CLI)

```bash
# Декомпозиция сложной фичи на цепочку атомарных шагов (<= 2 файлов на шаг):
npx task-pipeline decompose "Внедрить систему кеширования" --files "src/cache.ts,src/redis.ts,src/api.ts"

# Принятие детерминированного решения по пулу вариантов:
npx task-pipeline decide --proposal ./proposals/cache_strategy.json
```

---

### Вариант В: Использование в коде (TypeScript / Node.js SDK)

```typescript
import { WbsDecomposer, ActionArbiter } from '@omnismm/agent-task-pipeline';

// 1. Декомпозиция
const decomposer = new WbsDecomposer();
const plan = decomposer.decompose({
  title: 'Интеграция СБП и чекаут',
  description: 'Создание шлюза СБП и модального окна чекаута',
  impactedFiles: [
    'src/services/sbp.ts',
    'src/actions/sbp.ts',
    'src/components/sbp-modal.tsx'
  ],
  constraints: ['ExactMath BigInt', 'No-Crutch Policy']
});

console.log(`Всего шагов: ${plan.totalTasks}. Соответствует WBS: ${plan.isWbsCompliant}`);

// 2. Автономный арбитраж действий
const arbiter = new ActionArbiter();
const decision = arbiter.decide({
  intent: 'Выбор архитектуры шлюза',
  category: 'FEATURE_IMPLEMENTATION',
  options: [
    {
      id: 'OPT-1',
      title: 'Быстрый хак с any и Math.round',
      isDestructive: false,
      technicalDebtRisk: 'HIGH',
      financialRisk: 'HIGH',
      confidenceScore: 30
    },
    {
      id: 'OPT-2',
      title: 'Канонический сервис на BigInt ExactMath',
      isDestructive: false,
      technicalDebtRisk: 'NONE',
      financialRisk: 'NONE',
      confidenceScore: 98
    }
  ]
});

// Агент проверяет вердикт:
if (decision.verdict === 'PROCEED' || decision.verdict === 'REDIRECT_SAFE') {
  // АВТОНОМНО ИСПОЛНЯЕМ решение decision.selectedOptionId БЕЗ переспроса человека!
  console.log(`Выбран вариант: ${decision.selectedOptionTitle} (токены: ${decision.tokenCost})`);
}
```

---

## 🛡️ Контракт автономности (Правило 0.12)

При работе с данным модулем агент руководствуется следующим принципом:
- Если `ActionArbiter` вернул `PROCEED` или `REDIRECT_SAFE` — **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО** переспрашивать пользователя «делать или не делать?». Агент обязан исполнить решение автономно и предоставить готовый отчет с доказательствами.
- Человек привлекается исключительно при вердикте `ESCALATE_TO_HUMAN`.

---

## 🧪 Тестирование и Сборка

```bash
# Запуск тестов
npm test

# Сборка TypeScript
npm run build
```
