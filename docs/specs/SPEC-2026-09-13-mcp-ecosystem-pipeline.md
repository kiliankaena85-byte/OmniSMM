# SPEC-2026-09-13-MCP-ECOSYSTEM-PIPELINE (v1.0)

## 1. Контекст и цели
В платформе OmniSMM 1.0 (SMMplan / SMMflux) ИИ-агенты (Cursor, Claude Code, Gemini, Antigravity) участвуют в написании фронтенда, бэкенда, Server Actions и финансовых операций.
При отсутствии жесткого контура заземления (Grounding) агенты склонны к следующим критическим дефектам:
1. **Галлюцинации типов и переменных:** Выдумывание несуществующих свойств моделей Prisma (например, `user.points`, `order.tracking_number`), импорт несуществующих функций и вызов устаревших методов.
2. **Слепота к реальной геометрии вьюпортов:** Генерация вёрстки, которая статически выглядит валидной, но ломается при рендере в мобильном браузере (горизонтальный скролл, обрезание меню, авто-зум на iPhone).
3. **Нарушение архитектурных границ:** Попытка импортировать серверные библиотеки в клиентские компоненты или выполнять мутации БД в обход `WalletOps`.

**Цель спецификации:**  
Зафиксировать архитектурный стандарт, декларативную конфигурацию и управляющий конвейер (MCP Pipeline) для интеграции сертифицированных серверов Model Context Protocol стандарта 2026 года.

---

## 2. Архитектурная топология MCP-экосистемы (3-Уровневая модель)

### Уровень 1: Защита от галлюцинаций и контроль типов (Anti-Hallucination & Type-Safety)
1. **`typescript-lsp` (TypeScript Language Server):**
   - Протокол: Language Server Protocol via MCP.
   - Команды: `ts_get_diagnostics`, `ts_get_type_definition`, `ts_get_completions`.
   - Инвариант: Код бракуется на этапе генерации при наличии TypeScript ошибок компилятора.
2. **`prisma-schema` (Database Schema Introspection):**
   - Роль: Предоставление агенту актуальной схемы Prisma и колонок PostgreSQL без раскрытия чувствительных данных пользователей.
   - Защитный барьер: **Strict Read-Only Guard**. Запрещены любые SQL DDL/DML мутации (`INSERT`, `UPDATE`, `DELETE`, `DROP`).
3. **`ast-grep` (Structural Code Search):**
   - Роль: Точный семантический поиск по AST-дереву (поиск всех вызовов `WalletOps.credit`, нахождение клиентских компонентов с импортом `db`).
4. **`graphrag-memory` (Knowledge & ADR Memory):**
   - Роль: Доступ к долговременной памяти GraphRAG (порт 8100) с реестром архитектурных решений (ADR) и правилами платформы.

### Уровень 2: Визуальный аудит и мобильная эргономика (Visual & Responsive Layout)
1. **`layout-sentry` (In-House Specialized Layout Healer):**
   - Путь: `scripts/ui/layout-mcp-server.ts`.
   - Инструменты: `layout_audit`, `layout_autofix`, `layout_dom_probe`.
   - Назначение: Автоматическое исправление вложенности DOM, `shrink-0`, `min-w-0`, `w-screen` и iOS Safari Auto-Zoom.
2. **`puppeteer-visual` (Headless Chromium Agent):**
   - Инструменты: `puppeteer_navigate`, `puppeteer_screenshot`, `puppeteer_evaluate`.
   - Назначение: Эмуляция мобильных вьюпортов (iPhone SE 375px, iPhone 16 390px, Tablet 768px, Laptop 1366px) в изолированном Stage-контуре (:3005).

### Уровень 3: Инфраструктурный контроль и безопасность (DevOps & Security)
1. **`git-sentinel`:**
   - Инструменты: `git_status`, `git_diff_check`, `git_secret_scan`.
   - Назначение: Проверка атомарности изменений и гарантия отсутствия секретов перед коммитом.
2. **`docker-ops`:**
   - Инструменты: `docker_health_probe`, `docker_mem_stats`.
   - Назначение: Мониторинг потребления RAM контейнерами (предотвращение OOM Exit 137).

---

## 3. Требования кибербезопасности (Zero-Trust & Sandbox Rules)

1. **Изоляция секретов (Secret Masking):**
   - Ни один MCP-сервер не должен иметь прав на прямое чтение файла `.env` или `.env.local`.
   - Все параметры передаются через санированный объект переменных среды родительского процесса.
2. **Read-Only Database Sandbox:**
   - Подключение Prisma/PostgreSQL MCP выполняется под пользователем с правами строго `SELECT` на системные каталоги (`information_schema`, `pg_catalog`).
3. **Headless Browser Safety:**
   - Запуск Chrome/Playwright строго с флагами `--no-sandbox`, `--disable-dev-shm-usage`, `--disable-gpu`.
   - Ограничение времени жизни сессии браузера: таймаут `15 000 ms`.

---

## 4. Декларативный манифест `.mcp/mcp-servers.json`

```json
{
  "$schema": "https://json.schemastore.org/mcp-servers.json",
  "version": "2026.1",
  "servers": {
    "layout-sentry": {
      "type": "stdio",
      "command": "npx",
      "args": ["tsx", "scripts/ui/layout-mcp-server.ts"],
      "enabled": true,
      "tier": "LEVEL_2_VISUAL"
    },
    "puppeteer-visual": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-puppeteer"],
      "enabled": true,
      "tier": "LEVEL_2_VISUAL"
    },
    "typescript-lsp": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-typescript"],
      "enabled": true,
      "tier": "LEVEL_1_TYPES"
    },
    "graphrag-memory": {
      "type": "http",
      "url": "http://127.0.0.1:8100/api/mcp",
      "enabled": true,
      "tier": "LEVEL_1_TYPES"
    }
  }
}
```

---

## 5. Протокол оркестратора `scripts/mcp/mcp-pipeline-orchestrator.ts`

Оркестратор выполняет роль единого шлюза:
1. `initPipeline()`: парсинг конфигурации `.mcp/mcp-servers.json`.
2. `healthCheck()`: пинг серверов через JSON-RPC `ping` / эмуляцию stdio.
3. `getRegistry()`: агрегация всех доступных инструментов в единый каталог с указанием Tier.
4. `runPreflightAudit()`: автоматический предрелизный запуск `layout_audit` и проверки типов перед коммитом.
