# MCP ARCHITECTURAL ECOSYSTEM & ADVERSARIAL BRAINSTORMING (2026)
## Протокол мозгового штурма экспертной коллегии по интеграции Model Context Protocol (MCP) в платформу OmniSMM 1.0

> **Дата проведения:** 13 сентября 2026 г.  
> **Формат:** Экспертный мозговой штурм (5 гетерогенных архитектурных ролей: Systems Architecture, Cybersecurity, Frontend/UX, Static Analysis/Compilers, Fintech/DB).  
> **Цель:** Выстроить отказоустойчивую обвязку и конвейер (Pipeline) подключения MCP-серверов для предотвращения галлюцинаций ИИ (выдумывание переменных, типов, полей БД), автоматизации визуального аудита и соблюдения контрактов платформы.

---

## 1. Состав экспертной коллегии мозгового штурма

1. **Эксперт 1: Lead Systems Architect (Фокус: IPC, масштабируемость, надежность)**
2. **Эксперт 2: Principal Cybersecurity Sentinel (Фокус: OWASP, изоляция процессов, Zero-Trust)**
3. **Эксперт 3: Senior Frontend & Responsive UX Steward (Фокус: BGS-2026, Puppeteer, Zero-Scroll)**
4. **Эксперт 4: Compiler & Static Analysis Engineer (Фокус: TypeScript LSP, AST-grep, Type-Safety)**
5. **Эксперт 5: Fintech & Data Integrity Custodian (Фокус: Prisma, PostgreSQL, ExactMath, 54-FZ)**

---

## 2. Стенограмма дебатов и ключевые тезисы консилиума

### Раунд 1: Как физически предотвратить галлюцинации ИИ (выдумывание переменных, методов, полей БД)?

* **Compiler & Static Analysis Engineer:**
  > «Главная болезнь LLM в 2025–2026 гг. — писать код «по памяти», когда модель ориентируется на статистические вероятности токенов, а не на реальные типы. Чтобы модель не придумывала несуществующие поля, ей нужен **TypeScript Language Server (LSP) MCP**. 
  > Перед модификацией любого файла агент обязан выполнить tool call `get_type_definition` или `get_diagnostics`. Если компилятор возвращает ошибку `Property 'xyz' does not exist on type 'User'`, код бракуется ДО того, как агент объявит задачу завершенной.»

* **Fintech & Data Integrity Custodian:**
  > «Поддерживаю. В нашей платформе критически опасны галлюцинации в балансе: если ИИ придумает поле `user.bonus_balance` или метод `WalletOps.addMoney()`, произойдет финансовая катастрофа.
  > Нам необходим **Prisma Introspect & PostgreSQL Schema MCP**. Вместо того чтобы скармливать в контекст весь файл `schema.prisma` на 2500 строк (тратя окно контекста), агент должен иметь возможность точечно запросить схему: `mcp_get_table_schema("User")`. База данных должна быть подключена в **СТРОГО Read-Only режиме** с пользователем `smmplan_readonly`, чтобы ИИ не мог случайно выполнить мутацию в продакшн-БД через MCP.»

* **Principal Cybersecurity Sentinel (ВЕТО / ПРЕДУПРЕЖДЕНИЕ):**
  > «Ставлю жесткое условие безопасности: **Ни один MCP-сервер не должен иметь доступ к чтению файла `.env` напрямую**. 
  > Все параметры подключения (строки БД, ключи API) передаются серверам MCP через санированные переменные окружения родительского процесса-оркестратора. Запрещено давать MCP-серверам команду `fs.readFile('.env')`!»

---

### Раунд 2: Визуальный аудит и проверка вёрстки без человеческих глаз

* **Senior Frontend & Responsive UX Steward:**
  > «Мы уже создали `layout-overflow-sentry` MCP, который ищет дефекты верстки на уровне AST. Но статический анализ не видит реального сдвига пикселей (Layout Shift), наложений z-index или обрезания модалок системным скроллбаром Windows.
  > Нам нужен сквозной визуальный конвейер:
  > 1. `layout-sentry` MCP делает первичную AST-проверку и авто-исправление (`shrink-0`, `min-w-0`, `w-full`).
  > 2. `puppeteer-mcp` (Playwright) открывает страницу на изолированном порту 3005 (`smmplan_stage`), устанавливает мобильные вьюпорты (375px, 390px, 768px, 1366px), делает замер `scrollWidth <= innerWidth` и делает доказательные скриншоты.
  > 3. ИИ получает JSON-результат проверки геометрии и скриншот для визуального подтверждения.»

* **Lead Systems Architect:**
  > «Чтобы запуск браузера не подвешивал память хоста (помним инцидент с утечкой RAM и swap-трэшингом), `puppeteer-mcp` обязан запускаться с лимитами Chrome: `--disable-dev-shm-usage`, `--no-sandbox`, `--disable-gpu`, а инстанс браузера обязан закрываться сразу после серии скриншотов с таймаутом `AbortSignal.timeout(15000)`.»

---

### Раунд 3: Архитектура единого оркестратора (MCP Pipeline Orchestrator)

* **Lead Systems Architect:**
  > «Сейчас каждый MCP сервер запускается как отдельный процесс со своим stdio. Если один сервер упадет (например, упал процесс TypeScript LSP из-за нехватки памяти), агент теряет связь.
  > Нам нужен **Единый супервизор / пайплайн-менеджер** (`scripts/mcp/mcp-pipeline-orchestrator.ts`), который:
  > 1. Читает декларативную конфигурацию `.mcp/mcp-servers.json`.
  > 2. Запускает сертифицированные серверы по требованию (Lazy Startup).
  > 3. Пингует их через стандартный JSON-RPC `ping`.
  > 4. Агрегирует список доступных инструментов в единый каталог.
  > 5. Реализует Fail-Safe изоляцию: падение одного сервера не крашит остальные.»

---

## 3. Финальный вердикт консилиума: Архитектурный контур MCP-2026

Консилиум единогласно утвердил трехуровневую пирамиду MCP-экосистемы OmniSMM:

```mermaid
graph TD
    subgraph AI Agent Layer
        Agent[Cursor / Claude Code / Antigravity / Gemini]
    end

    subgraph MCP Pipeline Orchestrator
        Orchestrator[scripts/mcp/mcp-pipeline-orchestrator.ts]
        HealthCheck[HealthCheck & Heartbeat Ping]
        SafeGuard[Zero-Trust Secret Redactor & Read-Only Guard]
    end

    subgraph Level 1: Anti-Hallucination & Types
        LSP[TypeScript Language Server MCP]
        PrismaMCP[Prisma / PostgreSQL Schema MCP]
        ASTGrep[ast-grep Structural Code Search MCP]
        RAG[GraphRAG Knowledge Memory MCP :8100]
    end

    subgraph Level 2: Visual & Responsive Layout
        LayoutSentry[Layout Sentry & Auto-Healer MCP]
        PuppeteerMCP[Playwright / Puppeteer Headless MCP]
    end

    subgraph Level 3: DevOps & Container Integrity
        DockerMCP[Docker Memory & Lean Build MCP]
        GitMCP[Git & Diff Sentinel MCP]
    end

    Agent <--> Orchestrator
    Orchestrator --> HealthCheck & SafeGuard
    Orchestrator <--> Level 1
    Orchestrator <--> Level 2
    Orchestrator <--> Level 3
```

---

## 4. Резолюция мозгового штурма (Принято к реализации)

1. **Разработать нормативную спецификацию:** `docs/specs/SPEC-2026-09-13-mcp-ecosystem-pipeline.md`.
2. **Создать единый манифест конфигурации:** `.mcp/mcp-servers.json`.
3. **Реализовать исполнительный движок-оркестратор:** `scripts/mcp/mcp-pipeline-orchestrator.ts`.
4. **Внедрить автоматические тесты здоровья:** `src/__tests__/mcp/mcp-pipeline.test.ts`.
5. **Зарегистрировать CLI команду:** `"mcp:pipeline": "tsx scripts/mcp/mcp-pipeline-orchestrator.ts"` в `package.json`.
