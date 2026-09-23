# SPEC-2026-09-19: Clean Architecture Dependency Guard & Topology IR (Uncle Bob Pattern)

## 1. Контекст и цели
Вдохновлено проектом [unclebob/uml-viewer](https://github.com/unclebob/uml-viewer) (Роберт «Uncle Bob» Мартин, сентябрь 2026).
Цель спецификации:
1. Зафиксировать формальные уровни и инварианты направления зависимостей (Dependency Rule) в платформе OmniSMM 1.0 (Next.js 16 App Router / TypeScript).
2. Разработать нативный AST-валидатор без внешних тяжелых зависимостей для проверки границ слоев в Vitest и CI.
3. Сформировать схему промежуточного представления графа архитектуры (Topology IR: `artifacts/architecture-topology.json`) для последующего использования в изолированном Docker-просмотрщике для разработчиков.

---

## 2. Формализация слоев Clean Architecture в OmniSMM

Каждый модуль в директории `src/` относится к строго определенному уровню:

| Уровень (Level) | Слой | Пути в проекте | Допустимые зависимости (Inward Rule) |
| :--- | :--- | :--- | :--- |
| **Level 0** | **Domain & Core Invariants** | `src/types/`, `src/lib/financial/`, `src/lib/wallet/` | Никаких зависимостей от внешних слоев. Только чистые структуры данных, математика (`ExactMath`), типы и интерфейсы. |
| **Level 1** | **Domain Services & Engine** | `src/services/` (`provider/`, `analyzer/`, `pricing/`, `telegram/`, `sync/`) | Может зависеть только от **Level 0**. Не знает об HTTP-запросах, куках, Server Actions и UI-компонентах. |
| **Level 2** | **Application, Adapters & Gateways** | `src/actions/`, `src/app/api/`, `src/workers/`, `src/bot/` | Может зависеть от **Level 0** и **Level 1**. Оркестрирует пользовательские сценарии, проверяет права доступа (RBAC), обращается к БД/кэшу. |
| **Level 3** | **Presentation & Shell** | `src/components/`, `src/app/**/page.tsx`, `src/app/**/layout.tsx` | Может зависеть от **Level 0** (типы DTO) и **Level 2** (Server Actions). **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО** напрямую зависеть от инфраструктуры БД/Redis. |

> **Правило зависимостей Дяди Боба (The Dependency Rule):**
> Ребро зависимости $A \to B$ является нарушающим (**Violating Edge / Red Alert**), если $\text{Level}(A) < \text{Level}(B)$.
> Зависимости обязаны указывать строго внутрь системы (к более высокоуровневым доменным абстракциям).

---

## 3. Правила валидации и исключения

1. **Type-Only Imports:**
   - Импорты типов (`import type { ... }` или отдельные спецификаторы `import { type MyDto }`) **НЕ порождают runtime-зависимостей** в JavaScript бандле и разрешены для передачи контрактов DTO между слоями.
2. **Turbopack Client/Server Boundary:**
   - Клиентские компоненты (`'use client'`) **НЕ имеют права** импортировать runtime-модули `src/lib/db.ts`, `@prisma/client`, `ioredis` или серверные утилиты шифрования.
3. **Circular Dependencies (Zero-Cycle Guard):**
   - Внутри графа зависимостей недопустимы циклические связи ($A \to B \to \dots \to A$), так как они приводят к утечкам памяти и проблемам порядка инициализации модулей в Turbopack/Webpack.

---

## 4. Схема Topology IR (`artifacts/architecture-topology.json`)

Схема контракта графа для будущего автономного Docker-просмотрщика:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "OmniSMM Architecture Topology",
  "generatedAt": "ISO-8601 string",
  "levels": [
    { "level": 0, "name": "Domain", "color": "#22c55e" },
    { "level": 1, "name": "Services", "color": "#3b82f6" },
    { "level": 2, "name": "Application", "color": "#a855f7" },
    { "level": 3, "name": "Presentation", "color": "#eab308" }
  ],
  "nodes": [
    {
      "id": "src/types/service-dto.ts",
      "label": "service-dto.ts",
      "level": 0,
      "layer": "Domain",
      "linesCount": 45,
      "isClientComponent": false,
      "exportsCount": 3
    }
  ],
  "edges": [
    {
      "source": "src/actions/order/checkout.ts",
      "target": "src/lib/wallet/wallet-ops.ts",
      "kind": "dependency",
      "isTypeOnly": false,
      "isViolating": false
    }
  ],
  "violations": [],
  "cycles": [],
  "metrics": {
    "totalFiles": 0,
    "totalEdges": 0,
    "violationsCount": 0,
    "cyclesCount": 0
  }
}
```
