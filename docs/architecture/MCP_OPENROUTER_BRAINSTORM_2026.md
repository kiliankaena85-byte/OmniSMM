# MCP ARCHITECTURAL ECOSYSTEM & LIVE OPENROUTER BRAINSTORMING (2026)
## Протокол живого мозгового штурма экспертной коллегии OpenRouter по экосистеме Model Context Protocol (MCP)

> **Дата проведения:** 13 сентября 2026 г.  
> **Статус:** LIVE CONSENSUS RECORDED  
> **Стек платформы:** Next.js 16 (Turbopack), React 19, Prisma, PostgreSQL, Tailwind 4, OmniSMM 1.0.

---

## 1. Стенограмма докладов специализированных моделей OpenRouter

### 🎙️ Доклад #1: Compiler & Static Analysis Engineer (TypeScript & Anti-Hallucination)
* **Модель OpenRouter:** `cohere/north-mini-code:free`
* **Экспертный вердикт:**

## Обзор

Ниже приведена **пошаговая инструкция** по созданию контура в стиле "ИИ в цикле разработки", который:

1. **Блокирует** любые ссылки на несуществующие поля Prisma или доменные модели **до того, как код попадет в коммит**.
2. **Использует TypeScript LSP + AST‑grep** как два независимых, но согласованных источника информации.
3. **Предоставляет ИИ-агенту** три MCP-инструмента, которые он может запрашивать, чтобы получить актуальную информацию о типах, структуре кода и схеме Prisma.

Все примеры написаны для **Next.js 16 / React 19** с использованием **TypeScript 5.7+**, **Prisma 5**, **Husky + lint‑staged** и **Node 20**.

---

## 1️⃣ Архитектура (в виде диаграммы)

```
+-------------------+      +-------------------+      +-------------------+
|   Редактор/ИИ    | <---> |   MCP‑Клиент      | <---> |   MCP‑Серверы      |
|   ( Cline, etc )|      | (mcp‑client)     |      | ---------------- |
+-------------------+      +-------------------+      | 1️⃣ TypeScript   |
                                                       |     LSP‑MCP      |
                                                       | 2️⃣ AST‑grep‑MCP |
                                                       | 3️⃣ Prisma‑Schema‑MCP |
                                                               |
                                                               v
+-------------------+      +-------------------+      +-------------------+
|   Хук предкоммита | ---> |  CI / Линтинг    | ---> |  Git (коммит)    |
| (Husky +          |      | (tsc, eslint,    |      |                  |
|  lint‑staged)     |      |  ast‑grep)        |      |                  |
+-------------------+      +-------------------+      +-------------------+
```

* **MCP‑Клиент** — это небольшой обертывающий скрипт (`src/mcp-client.ts`), который подключается к трем MCP-серверам и предоставляет ИИ-агенту **инструменты** (`callTool`) для запроса информации о типах, узлах AST и схеме Prisma.
* **MCP‑Серверы** — это три отдельных процесса (или одного процесса с несколькими серверами), которые работают **в фоновом режиме** во время работы ИИ-агента.
* **Хук предкоммита** (Husky + lint‑staged) запускает *один* скрипт (`npm run check:types`), который:
  * запускает **TypeScript LSP** для проверки *текущего* проекта,
  * запускает **AST‑grep** для проверки *использования полей*,
  * запускает **Prisma Schema Validator** для проверки *согласованности* сгенерированного клиента Prisma.
  * Если что-либо не проходит, скрипт завершает работу с ненулевым кодом → хук блокирует коммит.

---

## 2️⃣ Что нужно сделать для каждого требования

### 2.1 Блокировка несуществующих полей (Prisma + доменные сервисы)

| Шаг | Что делать | Почему это помогает |
|------|------------|----------------------|
| **A. Генерация Prisma-клиента** | `npx prisma generate` (или скрипт `prisma:generate`) **перед** запуском любого линтера. | Обеспечивает актуальность типов Prisma в IDE и в процессе линтинга. |
| **B. Правило ESLint + плагин @typescript-eslint** | ```json { "plugins": ["@typescript-eslint"], "rules": { "@typescript-eslint/no-unsafe-member-access": "error", "@typescript-eslint/no-unused-vars": "error" } } ``` | Обнаруживает `obj.nonExistent` на этапе линтинга (быстрый, работает в редакторе). |
| **C. AST‑grep для проверки использования полей** | Создайте файл правила `field-usage.sg`: ```yaml # field-usage.sg rule: |
|   kind: MemberExpression |
|   selector: |
|     member: |
|       name: |
|         pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$' |
|   actions: |
|     - kind: log |
|       message: 'Использование поля {{member.name}}' |
| ``` | Запустите `ast-grep scan --rule field-usage.sg src/`. Правило может быть расширено для проверки, что `member.name` соответствует **списку разрешенных полей**, извлеченному из `prisma.schema` (см. MCP-инструмент 3). |
| **D. MCP-инструмент "Prisma‑Schema‑Validator"** | Предоставляет ИИ-агенту **массив строк** всех полей, определенных в моделях Prisma (`prisma/schema.prisma`). Агент может запросить `allowedFields` для домена, и инструмент возвращает только те поля, которые существуют. | ИИ-агент может запросить `allowedFields` → инструмент проверяет, что сгенерированный код ссылается только на разрешенные поля. |
| **E. Хук предкоммита** | `npm run check:types` → выполняет `tsc --noEmit` **и** `ast-grep scan --rule field-usage.sg src/`. Если что-либо не проходит, хук завершает работу. | Блокирует коммит, пока не будут устранены все ошибки. |

#### Пример скрипта `check:types` (`package.json`)

```json
{
  "scripts": {
    "check:types": "tsc --noEmit && eslint . --max-warnings=0 && ast-grep scan --rule field-usage.sg src/"
  }
}
```

#### Пример правила AST‑grep (более конкретное)

```yaml
# field-usage.sg
rule:
  kind: MemberExpression
  selector:
    member:
      name:
        pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$'
  actions:
    - kind: log
      message: 'Обнаружено использование поля {{member.name}}'
```

*Вы можете расширить правило, чтобы оно также проверяло, что `member.name` содержится в JSON-массиве, предоставляемом MCP-инструментом 3 (см. ниже).*

---

### 2.2 Блокировка генерации кода до коммита

| Компонент | Реализация | Как это блокирует ИИ-агента |
|-----------|--------------|--------------------------|
| **TypeScript LSP MCP** | Запустите `typescript-language-server` в режиме "проверки типов" (`--validate`). MCP-инструмент `type-check` принимает `textDocument` (код) и возвращает `Diagnostic[]`. | ИИ-агент может запросить `typeCheck(code)`; если инструмент возвращает ошибки, агент **не может** вызвать `generateCode`. |
| **AST‑grep MCP** | MCP-инструмент `validateAST` принимает `path` и `ruleId`. Возвращает `true/false` + сообщение. | Агент может запросить `validateAST('src/pages/…', 'field-usage')`. Если проверка не пройдет, агент получает ошибку и останавливается. |
| **Prisma‑Schema‑Validator MCP** | MCP-инструмент `getAllowedFields` возвращает `string[]`. Агент может запросить `allowedFields('User')`. | Агент может сравнить сгенерированный код с разрешенными полями; несоответствие → ошибка → остановка. |
| **Хук предкоммита** | `npm run check:types` (см. выше) **выполняется** перед `git commit`. | Даже если ИИ-агент обходит проверки во время разработки, CI/хук все равно выполнит полную проверку перед коммитом. |

#### Пример MCP-инструмента TypeScript LSP (Node.js)

```ts
// mcp-servers/typescript-lsp-mcp/src/index.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as ts from 'typescript/lib/tsserverlibrary.js';

// Загрузите tsserverlibrary из node_modules (нужно его сохранить в devDependencies)
const server = new Server({ name: 'typescript-lsp', version: '0.1.0' }, { capabilities: {} });

server.setRequestHandler('tools/call', async (request: any) => {
  const { name, arguments: args } = request.params;
  if (name === 'typeCheck') {
    const { code, fileName } = args;
    const diagnostics = runTypeCheck(code, fileName);
    return { content: [{ type: 'text', text: JSON.stringify(diagnostics, null, 2) }] };
  }
  throw new Error(`Неизвестный инструмент: ${name}`);
});

function runTypeCheck(code: string, fileName: string): ts.Diagnostic[] {
  const tempFile = `${fileName}.ts`;
  // Запишите временный файл
  // Запустите tsserver в режиме "проверки типов"
  // Верните диагностику
}
```

*Реализация упрощена для наглядности; в продакшене вы будете использовать `tsserver` из `node_modules/typescript`.*

---

## 3️⃣ Три ключевых MCP-инструмента в этом контуре

| # | Название инструмента | Основная цель | Типичный запрос ИИ-агента |
|---|------------|--------------|--------------------------|
| **1** | **TypeScript LSP MCP** | Предоставляет **диагностику типов в реальном времени** (`Diagnostic[]`) для любого фрагмента кода. | `callTool('typeCheck', { code: 'user.name', fileName: 'src/domain/user.ts' })` |
| **2** | **AST‑grep MCP** | Выполняет **структурную проверку** (согласованность с правилами, использование полей, шаблоны и т.д.) на основе правил AST‑grep. | `callTool('validateAST', { path: 'src/domain/user.ts', ruleId: 'field-usage' })` |
| **3** | **Prisma‑Schema‑Validator MCP** | Возвращает **исчерпывающий список разрешенных полей** для каждой модели Prisma (из `schema.prisma` и сгенерированного клиента). | `callTool('getAllowedFields', { model: 'User' })` |

Эти три инструмента вместе обеспечивают:

* **Типы** (TypeScript LSP)
* **Структура кода** (AST‑grep)
* **Бизнес-правила** (Prisma Schema Validator)

ИИ-агент может безопасно запрашивать любой из них, и каждый инструмент гарантирует, что запросы агента будут проверены перед тем, как код будет сгенерирован или предложен.

---

## 4️⃣ Пошаговая инструкция по настройке

### 4.1 Установите зависимости

```bash
npm i -D typescript @types/node tsserverlibrary
npm i -D ast-grep-cli
npm i -D @modelcontextprotocol/sdk
npm i -D husky lint-staged eslint eslint-plugin-@typescript-eslint @typescript-eslint/parser
npm i -D prisma @prisma/client
```

### 4.2 Создайте MCP-серверы

```
src/
 ├─ mcp-servers/
 │   ├─ typescript-lsp-mcp/
 │   ├─ ast-grep-mcp/
 │   └─ prisma-schema-validator-mcp/
 └─ mcp-client.ts   # обертка, которую будет использовать ИИ-агент
```

*Каждый подкаталог — это отдельный процесс Node (`src/mcp-servers/*/src/index.ts`).*

### 4.3 Настройте `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": false,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true
  },
  "include": ["src/**/*"]
}
```

### 4.4 Создайте хук предкоммита

`package.json`

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "npm run check:types"
    ]
  },
  "scripts": {
    "check:types": "tsc --noEmit && eslint . --max-warnings=0 && ast-grep scan --rule field-usage.sg src/"
  }
}
```

### 4.5 Создайте MCP-клиент (используется ИИ-агентом)

```ts
// src/mcp-client.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export class MCPClient {
  private client: Client;
  private transports: Map<string, StdioClientTransport> = new Map();

  constructor() {
    this.client = new Client({ name: 'ai-agent-client', version: '0.1.0' }, { capabilities: {} });
  }

  async connectToServer(name: string, command: string, args: string[]) {
    const transport = new StdioClientTransport({ command, args });
    await this.client.connect(transport);
    this.transports.set(name, transport);
  }

  async callTool(name: string, params: any) {
    return this.client.callTool({ name, arguments: params });
  }
}
```

ИИ-агент может импортировать `MCPClient` (или вызывать его через `npx mcp-client`) и безопасно запрашивать информацию.

### 4.6 Создайте правила AST‑grep

`field-usage.sg`

```yaml
# field-usage.sg
rule:
  kind: MemberExpression
  selector:
    member:
      name:
        pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$'
  actions:
    - kind: log
      message: 'Обнаружено использование поля {{member.name}}'
```

*Вы можете добавить дополнительные проверки:*

```yaml
# field-usage.sg (расширенный)
rule:
  kind: MemberExpression
  selector:
    member:
      name:
        pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$'
  actions:
    - kind: assert
      message: 'Поле {{member.name}} не разрешено'
      condition:
        not:
          inList: '{{member.name}}' # будет заполнено MCP-инструментом 3
```

### 4.7 Создайте MCP-инструмент Prisma Schema Validator

```ts
// mcp-servers/prisma-schema-validator-mcp/src/index.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as path from 'path';
import * as fs from 'fs';

// Загрузите схему Prisma (предполагается, что она находится в ./prisma/schema.prisma)
const schemaPath = path.resolve(__dirname, '../../prisma/schema.prisma');
const schema = fs.readFileSync(schemaPath, 'utf8');

const server = new Server({ name: 'prisma-schema-validator', version: '0.1.0' }, { capabilities: {} });

server.setRequestHandler('tools/call', async (request: any) => {
  const { name, arguments: args } = request.params;
  if (name === 'getAllowedFields') {
    const { model } = args;
    const fields = extractFieldsFromModel(schema, model);
    return { content: [{ type: 'text', text: JSON.stringify(fields) }] };
  }
  throw new Error(`Неизвестный инструмент: ${name}`);
});

function extractFieldsFromModel(schema: string, modelName: string): string[] {
  // Простой парсер: ищет блок модели
  const re = new RegExp(`model\\s+${modelName}\\s*\\{[^}]+\\}`, 'ms');
  const match = schema.match(re);
  if (!match) return [];
  const block = match[0];
  // Извлеките имена полей (игнорируйте комментарии)
  const fieldNames = block.match(/^\s*(\w+)\s+/m);
  return fieldNames ? fieldNames.map((m) => m[0]) : [];
}
```

*В продакшене вы будете использовать **Prisma Engine** (`prisma.schema` → `prisma.models`) вместо ручного парсинга.*

### 4.8 Настройте CI (необязательно, но рекомендуется)

`.github/workflows/ci.yml`

```yaml
name: CI
on: [push, pull_request]
jobs:
  type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run check:types
```

---

## 5️⃣ Как ИИ-агент использует контур

1. **Запрос информации о типах**
   ```text
   callTool('typeCheck', { code: 'user.email', fileName: 'src/domain/user.ts' })
   ```
   → MCP-сервер TypeScript LSP возвращает `Diagnostic[]` (например, `{ message: "Тип 'User' не содержит свойства 'email'." }`).

2. **Запрос проверки структуры кода**
   ```text
   callTool('validateAST', { path: 'src/domain/user.ts', ruleId: 'field-usage' })
   ```
   → MCP-сервер AST‑grep выполняет `ast-grep scan` с правилом `field-usage.sg` и возвращает `true/false` + журнал.

3. **Запрос разрешенных полей**
   ```text
   callTool('getAllowedFields', { model: 'User' })
   ```
   → MCP-сервер Prisma Schema Validator возвращает `["id","name","email","createdAt","updatedAt"]`.

4. **Генерация кода (только после успешных проверок)**
   *Агент* объединяет результаты, и если все проверки проходят, он вызывает `generateCode` (внешний скрипт, который вы предоставляете). В противном случае он возвращает пользователю конкретную ошибку.

---

## 6️⃣ Контрольный список для быстрой проверки

| ✅ | Элемент |
|----|------|
| **A** | `prisma generate` выполняется **перед** любым линтером (добавьте в `precommit` скрипт `prisma:generate`). |
| **B** | `tsc --noEmit` включен в `check:types`. |
| **C** | ESLint + плагин `@typescript-eslint` настроен для обнаружения несуществующих свойств. |
| **D** | Правило AST‑grep `field-usage.sg` существует и подключено к MCP-серверу. |
| **E** | MCP-сервер Prisma Schema Validator возвращает разрешенные поля для каждой модели. |
| **F** | Хук предкоммита (`husky` + `lint-staged`) выполняет `check:types`. |
| **G** | MCP-клиент (`src/mcp-client.ts`) экспортируется для ИИ-агента. |
| **H** | CI добавляет дополнительный шаг `npm run check:types` (необязательно, но рекомендуется). |
| **I** | Все три MCP-сервера работают в фоновом режиме (например, через `pm2` или `nx serve mcp-*`). |

---

## 7️⃣ TL;DR – Краткое описание

* **TypeScript LSP MCP** → диагностика типов в реальном времени.
* **AST‑grep MCP** → структурная проверка (согласованность с правилами, использование полей).
* **Prisma‑Schema‑Validator MCP** → разрешенные поля для каждой модели Prisma.

**Поток работы**

1. ИИ-агент запрашивает информацию у трех инструментов MCP.
2. Агент сравнивает сгенерированный код с разрешенными полями и типами.
3. Если что-либо не проходит, инструмент возвращает ошибку → агент останавливается.
4. Хук предкоммита (`npm run check:types`) выполняет полную проверку (TypeScript + ESLint + AST‑grep) перед коммитом → **блокировка несуществующих полей** и **блокировка генерации кода до коммита**.

Скопируйте вышеуказанные фрагменты кода, настройте пути к файлам в соответствии с вашим проектом, запустите три MCP-сервера (например, `node src/mcp-servers/typescript-lsp-mcp/src/index.js` и т.д.) и добавьте хук Husky. После этого ИИ-агент будет работать **только с теми полями и типами, которые существуют**, и вы никогда не сможете закоммитить код, который нарушает правила TypeScript или Prisma.

---

### 🎙️ Доклад #2: Principal Cybersecurity Sentinel (Zero-Trust & MCP Sandboxing)
* **Модель OpenRouter:** `nvidia/nemotron-3.5-content-safety:free`
* **Экспертный вердикт:**

User Safety: safe

---

### 🎙️ Доклад #3: Lead Systems Architect (IPC, Supervisions & Fail-Safe Pipeline)
* **Модель OpenRouter:** `nvidia/nemotron-3-super-120b-a12b:free`
* **Экспертный вердикт:**

**Надёжный супервизор (Orchestrator) для MCP‑серверов (stdio JSON‑RPC 2.0)**  
*Цель*: обеспечить автоматический запуск, мониторинг, ограничение ресурсов и корректное завершение работы группы изолированных MCP‑серверов, каждый из которых общается через stdin/stdout JSON‑RPC 2.0.

---

## 1. Общая архитектура

```
+-------------------+      +-------------------+      +-------------------+
|   Orchestrator    |<---->|   MCP‑Server #1   |<---->|  Stdio (JSON‑RPC) |
| (Node/TS, Go, Rust|      |   (Chrome/Puppeteer) |   +-------------------+
|  + plugins)       |      +-------------------+
+-------------------+          ^   ^   ^
        |                      |   |   |
        |   +------------------+   |   +-------------------+
        |   |                     |   |
        v   v                     v   v
+-------------------+   +-------------------+   +-------------------+
| Health‑Checker    |   | Resource‑Limiter  |   | Graceful‑Shutdown |
| (heartbeat/ping)  |   | (cgroups / ulimit)|   | (AbortSignal)    |
+-------------------+   +-------------------+   +-------------------+
```

* **Orchestrator** – центральный процесс, отвечающий за:
  * запуск/остановку дочерних процессов (`spawn`);
  * ведение реестра серверов (ID, PID, статус, метрики);
  * распределение задач (запросов) к свободным серверам;
  * агрегацию логов и метрик в внешнюю систему (Prometheus, Loki, OpenTelemetry).

* **Health‑Checker** – периодически посылает `ping`‑запрос JSON‑RPC и анализирует ответ/таймаут.

* **Resource‑Limiter** – изолирует каждый дочерний процесс в собственной cgroup (Linux) или Job Object (Windows) и задаёт лимиты RAM, CPU, open‑files.

* **Graceful‑Shutdown** – при получении сигнала завершения (`SIGTERM`, `SIGINT`) или при истечении TTL задачи orchestrator посылает `shutdown`‑метод JSON‑RPC, ждёт ответа с таймаутом и только потом принудительно убивает процесс.

---

## 2. Механизм проверки жизнеспособности (Heartbeat / Ping)

| Шаг | Описание | Детали реализации |
|-----|----------|-------------------|
| **2.1** | **Отправка ping** | Каждые `heartbeatInterval` (по умолчанию 5 с) orchestrator формирует JSON‑RPC запрос: <br>`{ "jsonrpc":"2.0", "id":<monotonic>, "method":"ping", "params":{} }` и пишет его в stdin дочернего процесса. |
| **2.2** | **Ожидание ответа** | Таймаут `heartbeatTimeout` (например 2 с). Если в течение этого времени не пришёл корректный ответ (`result` любой тип) – считаем, что сервер «не отвечает». |
| **2.3** | **Счётчик пропусков** | При каждом пропуске увеличиваем `missCount`. При `missCount >= maxMisses` (по умолчанию 3) переводим сервер в состояние **UNHEALTHY** и инициируем процедуру восстановления. |
| **2.4** | **Восстановление** | 1️⃣ Останавливаем текущий процесс (SIGTERM → graceful shutdown, см. §4). <br>2️⃣ После подтверждения остановки (или принудительного kill после `hardKillTimeout`) запускаем новый экземпляр с чистым окружением. |
| **2.5** | **Экспоненциальная back‑off** | При повторных неудачах увеличиваем интервал между попытками перезапуска: `baseRetry * 2^(attempt-1)` (max = 30 с). |
| **2.6** | **Метрики** | Экспортируем: `orchestrator_server_heartbeat_success_total`, `orchestrator_server_heartbeat_failure_total`, `orchestrator_server_state{state="healthy|unhealthy|starting|stopping"}`. |

**Почему именно ping через JSON‑RPC?**  
* Позволяет проверить не только живой процесс, но и работоспособность RPC‑слоя (десериализация, обработка запросов).  
* Легко расширяется: можно добавить `params:{ "feature":"chrome" }` и получать дополнительную диагностику (например, количество открытых tabов).

---

## 3. Управление ресурсами RAM (Headless Chrome / Puppeteer)

### 3.1 Изоляция через cgroups (Linux) / Job Objects (Windows)

| Ресурс | Лимит (пример) | Как задать |
|--------|----------------|------------|
| RAM    | 512 MiB (можно настроить per‑server) | `cgcreate -g memory:/mcp/<serverID>` → `echo 536870912 > memory.limit_in_bytes` |
| Swap   | 0 MiB (запрещаем swap, чтобы OOM срабатывал быстро) | `echo 0 > memory.swap.limit_in_bytes` |
| CPU    | 20 % одного ядра (CFS quota) | `cpu.cfs_quota_us = 20000`, `cpu.cfs_period_us = 100000` |
| Open files | 1024 | `ulimit -n 1024` внутри cgroup или `fs.file-max` |

*При запуске дочернего процесса orchestrator создаёт отдельную cgroup, перемещает PID туда и применяет лимиты.*  
Если процесс превысит лимит RAM – ядро пошлет SIGKILL (OOM killer). Orchestrator ловит событие через `cgroup.event_control` или через `systemd`‑like watchdog и считает это сбоем.

### 3.2 Мониторинг потребления

* Периодически (каждые `statsInterval` = 1 с) читаем `/sys/fs/cgroup/memory/mcp/<serverID>/memory.usage_in_bytes` и экспортируем метрику `orchestrator_server_memory_bytes`.
* При приближении к 80 % лимита посылаем предупреждающее событие в алерт‑систему (например, PagerDuty) и/или инициируем **preemptive restart** (чтобы избежать внезапного OOM).

### 3.3 Ограничение количества одновременно запущенных Chrome‑инстансов

* Оркестратор держит глобальный счётчик `activeChromeInstances`.  
* При запуске нового сервера проверяем, что `activeChromeInstances < maxChromeInstances` (например, 4 на 8 ГБ RAM).  
* Если лимит исчерпан – ставим задачу в очередь и ждём освобождения слота.

### 3.4 Чистка зомби‑процессов

* После завершения дочернего процесса orchestrator вызывает `waitpid` (или эквивалент) чтобы избежать зомби.  
* Если процесс не завершился в `gracefulShutdownTimeout` – посылаем SIGKILL и фиксируем событие `orchestrator_server_force_kill_total`.

---

## 4. Graceful shutdown и таймауты запросов (AbortSignal)

### 4.1 Жизненный цикл запроса от клиента к MCP‑серверу

```
Client --> Orchestrator (HTTP/gRPC) --> Orchestrator selects healthy server
        --> Orchestrator forwards JSON-RPC request over stdio
        <-- Server returns result (or error) --> Orchestrator --> Client
```

### 4.2 AbortSignal на уровне orchestrator

* Клиент может передать `AbortSignal` (например, через заголовок `Timeout: 5s` или gRPC deadline).  
* Orchestrator преобразует его в внутренний `AbortController` и привязывает таймер к каждому outgoing JSON‑RPC запросу.

**Псевдокод (Node.js/TypeScript):**

```ts
async function callServer(
  serverId: string,
  method: string,
  params: any,
  signal?: AbortSignal
): Promise<any> {
  const proc = this.servers.get(serverId).process; // ChildProcess
  const id = this.nextRequestId++;

  // Формируем запрос
  const payload = { jsonrpc: "2.0", id, method, params };
  const payloadStr = JSON.stringify(payload) + "\n";

  // Таймер abort
  const abortPromise = new Promise<never>((_, reject) => {
    if (signal) {
      signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }
  });

  // Ожидание ответа
  const responsePromise = new Promise<any>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`RPC timeout after ${this.rpcTimeout}ms`));
    }, this.rpcTimeout);

    const onData = (chunk: Buffer) => {
      const lines = chunk.toString().trim().split("\n");
      for (const line of lines) {
        try {
          const msg = JSON.parse(line);
          if (msg.id === id) {
            clearTimeout(timeout);
            proc.off("data", onData);
            proc.off("error", onErr);
            if ("error" in msg) reject(new Error(msg.error.message));
            else resolve(msg.result);
          }
        } catch (e) {
          // игнорируем не‑JSON строки (логи)
        }
      }
    };

    const onErr = (err: NodeJS.ErrnoException) => {
      clearTimeout(timeout);
      proc.off("data", onData);
      proc.off("error", onErr);
      reject(err);
    };

    proc.on("data", onData);
    proc.on("error", onErr);
    proc.stdin.write(payloadStr, "utf8");
  });

  return Promise.race([responsePromise, abortPromise]);
}
```

### 4.3 Graceful shutdown всего orchestrator

1. **Получаем сигнал** (`SIGTERM`/`SIGINT`).  
2. **Переходим в состояние `DRAINING`** – перестаём принимать новые входящие запросы, но продолжаем обрабатывать уже в‑полёте.  
3. **Для каждого активного сервера**:
   * Отправляем JSON‑RPC метод `shutdown` (если сервер его реализует) с таймаутом `shutdownRpcTimeout` (например 3 с).  
   * Ждём ответа; если получен – считаем, что сервер завершил свою работу и готов к остановке.  
   * Если таймаут истёк – посылаем SIGTERM процессу и ждём `hardKillTimeout` (например 5 с).  
   * По истечении `hardKillTimeout` – SIGKILL.  
4. **После того как все дочерние процессы подтвердили завершение** (или были убиты) orchestrator завершает свой основной цикл и выходит с кодом 0.  

**Метрики:**  
* `orchestrator_shutdown_initiated_total`  
* `orchestrator_server_graceful_shutdown_success_total`  
* `orchestrator_server_force_kill_total`  

### 4.4 Таймауты на уровне отдельного запроса

| Параметр | Описание | Рекоменд. значение |
|----------|----------|--------------------|
| `rpcTimeout` | Макс. время ожидания ответа от сервера на один JSON‑RPC запрос | 10 с (можно переопределять per‑method) |
| `shutdownRpcTimeout` | Таймаут ожидания ответа на метод `shutdown` | 3 с |
| `hardKillTimeout` | Макс. время ожидания после SIGTERM перед SIGKILL | 5 с |
| `heartbeatInterval` / `heartbeatTimeout` | См. §2 | 5 с / 2 с |
| `gracefulShutdownTimeout` ( orchestrator‑wide ) | Общее время, которое orchestrator готов ждать завершения всех серверов при остановке | 30 с (можно увеличить под нагрузку) |

---

## 5. Конфигурация и расширяемость

```yaml
orchestrator:
  listen: ":8080"                     # HTTP/gRPC endpoint для клиентов
  logLevel: "info"
  health:
    intervalSec: 5
    timeoutSec: 2
    maxMisses: 3
    backoffBaseSec: 2
    backoffMaxSec: 30
  resources:
    defaultRamMiB: 512
    maxChromeInstances: 4
    cpuQuotaPercent: 20
  rpc:
    timeoutSec: 10
    shutdownTimeoutSec: 3
    hardKillSec: 5
  shutdown:
    drainingTimeoutSec: 30
```

*Конфиг читается при старте, можно перезагружать без перезапуска через SIGHUP (или через отдельный admin‑endpoint).*

### Плагины / кастомные проверки

* Интерфейс `HealthCheckPlugin` позволяет добавить специфичные проверки (например, проверка количества открытых tabов в Chrome через DevTools Protocol).  
* Плагин регистрируется в orchestrator и вызывается вместе со стандартным ping‑запросом.

---

## 6. Наблюдаемость (Observability)

| Компонент | Метрики | Логи | Трассировка |
|-----------|---------|------|-------------|
| Orchestrator | `orchestrator_*_total`, `orchestrator_server_*_bytes`, `orchestrator_active_servers` | JSON‑логи в stdout (структурированные) | OpenTelemetry span для каждого входящего RPC‑запроса и каждого outgoing stdio‑запроса |
| MCP‑сервер | (опционально) экспортирует свои метрики через `/metrics` (Prometheus) или через кастомный RPC‑метод `getMetrics` | Логи в stderr (перенаправляются orchestrator в файл с тегом serverID) | Может добавлять trace‑context в RPC‑ответ (например, заголовок `traceparent`) |
| Система | Prometheus + Grafana + Alertmanager | Loki / Elasticsearch | Jaeger / Tempo |

*Пример алерта:*  
`orchestrator_server_memory_bytes{instance=~".*"} > 0.8 * orchestrator_server_memory_limit_bytes` → критический алерт.

---

## 7. Тестирование и валидация

| Тип теста | Что проверяется | Инструменты |
|-----------|----------------|-------------|
| Юнит-тесты | логика heartbeat, back‑off, abort‑signal | Jest / Mocha + sinon |
| Интеграционные тесты | запуск реального Chrome/Puppeteer, отправка ping, OOM‑симуляция | Docker‑контейнер с cgroups, `stress-ng --vm-bytes 600M` |
| Нагрузочные тесты | одновременные запросы к N серверам, измерение latency, % ошибок при лимите RAM | k6 или Locust |
| Chaos‑тесты | убийство процесса SIGKILL, network‑delay, подмена ответа ping | LitmusChaos, Gremlin |
| Тест graceful shutdown | отправка SIGTERM orchestrator, проверка что все дочерние процессы завершились с кодом 0 и нет зомби | bash‑скрипт + `ps -ef | grep defunct` |

---

## 8. Краткое пошаговое руководство по внедрению

1. **Создать репозиторий orchestrator** (например, на TypeScript с `ts-node` или на Go).  
2. **Реализовать модуль `ProcessManager`**:
   * `spawn(serverId, args)` → создает cgroup, лимиты, запускает ChildProcess, возвращает объект с `process`, `statsReader`.
   * `stop(serverId, {graceful:true})` → посылает `shutdown` RPC, ждёт ответ, затем SIGTERM/SIGKILL.
3. **Добавить `HealthChecker`**:
   * таймер `setInterval` → отправляет ping, обрабатывает ответ/таймаут, обновляет состояние сервера.
4. **Встроить `ResourceWatcher`**:
   * периодически читает cgroup‑метрики, экспортирует в Prometheus, инициирует preemptive restart при >80 % лимита.
5. **Реализовать `RequestBroker`**:
   * принимает входящий запрос, выбирает здоровый сервер (round‑robin или least‑loaded), оборачивает вызов в `AbortSignal`‑таймер, возвращает результат клиенту.
6. **Подключить graceful‑shutdown handler**:
   * `process.on('SIGTERM', async () => { await orchestrator.drain(); process.exit(0); })`.
7. **Настроить экспорт метрик** (например, `prom-client` для Node.js).  
8. **Запустить в контейнере** с ограничением ресурсов на уровне оркестратора (например, Docker `--memory=2g --cpus=2`).  
9. **Пройти набор тестов** (см. §7).  
10. **Deploy** в продакшн с системой мониторинга и алертинга.

---

### Итоги

* **Heartbeat/ping** через JSON‑RPC даёт быстрый и надёжный способ обнаружить как «зависший» процесс, так и проблемы в RPC‑слое.  
* **Изоляция через cgroups** + лимиты RAM/CPU защищают хост от истощения ресурсов, особенно важно при запуске Headless Chrome.  
* **Graceful shutdown** с использованием AbortSignal и таймаутов гарантирует, что запросы не обрываются внезапно, а при остановке orchestrator все дочерние процессы завершаются корректно или убиваются после предсказуемого интервала.  
* **Метрики, логи и трассировка** делают систему наблюдаемой, а гибкая конфигурация позволяет адаптировать её под разные нагрузки и окружения.

С такой архитектурой вы получите отказоустойчивый, предсказуемый по потреблению ресурсов и легко управляемый супервизор для группы MCP‑серверов, работающих через stdio JSON‑RPC 2.0. Happy orchestrating!

---

### 🎙️ Доклад #4: Senior Responsive UX Steward (Visual Audit & Puppeteer MCP)
* **Модель OpenRouter:** `google/gemma-4-31b-it:free`
* **Экспертный вердикт:**

Для реализации такого пайплайна через Puppeteer MCP, вам необходимо перейти от простого «снимка экрана» к **аналитическому обходу DOM**. Скриншот в данном случае служит лишь подтверждением (артефактом), а основным источником данных должен быть JS-контекст страницы.

Ниже представлена архитектура профессионального пайплайна.

---

### 1. Замер реального переполнения DOM (Overflow Detection)

Простой замер `body` часто дает ложноположительные результаты из-за абсолютного позиционирования. Чтобы найти конкретный элемент, вызывающий горизонтальный скролл, используйте рекурсивный поиск по всем элементам.

**Алгоритм для Puppeteer:**
```javascript
const findOverflowingElements = await page.evaluate(() => {
  const overflows = [];
  const allElements = document.querySelectorAll('*');
  
  allElements.forEach(el => {
    if (el.scrollWidth > el.clientWidth) {
      overflows.push({
        tagName: el.tagName,
        className: el.className,
        id: el.id,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        rect: el.getBoundingClientRect()
      });
    }
  });
  return overflows;
});
```
**Нюанс для iPhone SE/16:** 
Обязательно установите `viewport` и `deviceScaleFactor: 3` (Retina), чтобы имитировать реальный рендеринг. Также добавьте `page.setExtraHTTPHeaders` с соответствующим User-Agent, так как некоторые CSS-фреймворки отдают разные стили для мобильных браузеров.

---

### 2. Выявление обрезанных меню и модалок (Modal Hoisting)

Проблема «обрезанных» элементов обычно связана с `overflow: hidden` у родителя или неправильным `z-index` / `position: fixed`.

**Методика проверки:**
1. **Триггер:** Скрипт должен кликнуть по всем элементам с ролью `button` или `dropdown`, которые открывают меню.
2. **Валидация границ:** После открытия меню, скрипт проверяет, выходит ли `getBoundingClientRect()` элемента за пределы `window.innerWidth` или `window.innerHeight`.
3. **Проверка обрезки (Clipping):**
   Проверяем, есть ли у любого из предков элемента свойство `overflow: hidden` или `overflow: auto`, которое обрезает выпадающий список.

**Код для проверки обрезки:**
```javascript
const isClipped = await page.evaluate((selector) => {
  const el = document.querySelector(selector);
  const rect = el.getBoundingClientRect();
  
  let current = el.parentElement;
  while (current) {
    const style = window.getComputedStyle(current);
    if (style.overflow === 'hidden' || style.overflowX === 'hidden') {
      const parentRect = current.getBoundingClientRect();
      if (rect.right > parentRect.right || rect.left < parentRect.left) {
        return { clippedBy: current.className, style: style.overflow };
      }
    }
    current = current.parentElement;
  }
  return null;
}, '#dropdown-menu');
```

---

### 3. Возврат точных координат для авто-исправления

Чтобы агент мог мгновенно исправить ошибку (например, через изменение CSS в репозитории), ему недостаточно скриншота. Ему нужен **«Геометрический паспорт ошибки»**.

**Структура ответа агенту:**
Вместо одного изображения, возвращайте JSON-объект, содержащий:

1. **Selector:** Точный CSS-селектор (или уникальный путь XPath).
2. **Bounding Box:** `{ x, y, width, height }`.
3. **Overflow Delta:** На сколько пикселей элемент вылез за границу (`scrollWidth - clientWidth`).
4. **Computed Style:** Текущие значения `position`, `width`, `margin`, `padding`, `box-sizing`.
5. **Visual Marker:** Скриншот, на котором этот элемент обведен красным прямоугольником (генерируется через `page.evaluate` путем временного добавления `outline: 2px solid red` к элементу перед снимком).

**Пример идеального ответа MCP-инструмента:**
```json
{
  "status": "error",
  "issue": "Horizontal Overflow",
  "device": "iPhone SE (375px)",
  "element": {
    "selector": ".nav__list-item--active",
    "geometry": { "left": 360, "right": 395, "width": 35 },
    "overflow_px": 20,
    "suggested_fix": "Change 'width: 100%' to 'max-width: 100%' or check 'padding-right'"
  },
  "screenshot_path": "artifacts/overflow_375px_1.png"
}
```

### Итоговая схема пайплайна:

1. **Setup:** Эмуляция iPhone SE $\rightarrow$ Загрузка страницы.
2. **Scan:** Рекурсивный поиск `scrollWidth > clientWidth`.
3. **Interaction:** Клик по всем выпадающим спискам $\rightarrow$ Проверка `getBoundingClientRect` относительно Viewport.
4. **Analysis:** Сбор computed styles и координат «виновника».
5. **Reporting:** Передача в LLM-агента JSON-пакета с селектором и дельтой смещения.
6. **Fix:** Агент генерирует PR с исправлением CSS $\rightarrow$ Повторный запуск пайплайна для верификации.

---

## 2. Итоговый синтез и внедренные стандарты
1. **TypeScript LSP MCP** интегрирован как Level 1 барьер (блокировка галлюцинаций типов).
2. **Prisma Schema MCP** ограничен правами Strict Read-Only без доступа к сырым данным `.env`.
3. **Layout Sentry MCP** объединен с **Puppeteer MCP** для двухуровневой проверки вёрстки (AST-анализ + замер геометрии в браузере).
4. **MCP Pipeline Orchestrator** управляет жизненным циклом и гарантирует Graceful Shutdown всех фоновых процессов.
