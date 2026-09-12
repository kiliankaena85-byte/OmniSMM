---
name: adr-architect
description: >
  Управление архитектурными решениями (Architecture Decision Records — ADR) по стандарту MADR 3.0
  в платформе OmniSMM 1.0 (SMMplan / SMMflux). Используй этот скилл ВСЕГДА, когда принимаются новые
  структурные решения, изменяется системный дизайн, выбираются библиотеки или протоколы, а также при
  проведении аудита существующих решений (src/proxy.ts vs middleware.ts, Tailscale Funnel vs Cloudflare,
  BigInt копейки vs Float, ExactMath Half-Even, мульти-тенантность OmniSMM).
  Скилл предотвращает «архитектурную амнезию» и регрессии, регламентирует оформление MADR 3.0
  (Context, Decision, Consequences, Alternatives Considered, Validation Strategy), правила изменения статусов
  (PROPOSED, ACCEPTED, DEPRECATED, SUPERSEDED) и синхронизацию с GraphRAG памятью платформы на http://localhost:8100/api/decision.
---

# SKILL: adr-architect — Архитектурные решения (ADR) по стандарту MADR 3.0 в OmniSMM

> **Статус:** Обязательный архитектурный стандарт платформы OmniSMM 1.0 (SMMplan & SMMflux).  
> **Формат:** MADR 3.0 (Markdown Architectural Decision Records).  
> **Интеграция:** GraphRAG Knowledge Memory (`http://localhost:8100/api/decision`), директория `docs/architecture/`.

---

## 1. Дерево решений (Decision Tree / Flowchart)

Архитектурный агент обязан следовать данному дереву при любом изменении архитектуры, добавлении интеграций или пересмотре ключевых соглашений:

```mermaid
flowchart TD
    Start(["Архитектурная инициатива / Рефакторинг"]) --> CheckNeed{"Требуется ли оформление ADR?"}

    CheckNeed -->|"Точечный багфикс / Правка стилей"| NoADR["ADR не требуется (достаточно комментария в PR и коммите)"]
    CheckNeed -->|"Изменение структуры БД, протокола, сети, фреймворка, денег, multi-tenant"| YesADR["ОБЯЗАТЕЛЬНО: Оформление ADR в формате MADR 3.0"]

    YesADR --> CheckAudit{"Существует ли уже ADR на эту тему в docs/architecture/?"}
    
    %% Поиск и актуализация
    CheckAudit -->|"Да (Существует)"| ExistStatus{"Каков текущий статус ADR?"}
    ExistStatus -->|"ACCEPTED (Действующий)"| CheckChange{"Новое решение отменяет или развивает старое?"}
    CheckChange -->|"Отменяет / Заменяет"| MarkSuper{"Новый ADR получает статус ACCEPTED, старый помечается как SUPERSEDED"}
    CheckChange -->|"Уточняет без отмены"| UpdateAddendum["Добавить раздел Addendum к существующему ADR"]
    ExistStatus -->|"DEPRECATED / SUPERSEDED"| NewADR["Создать новый ADR с ссылкой на предшественника"]

    %% Создание нового
    CheckAudit -->|"Нет (Новое решение)"| CreateMADR["Создать файл docs/architecture/ADR-YYYY-NN-SLUG.md"]
    CreateMADR --> MADR_Sections{"Заполнены ли все обязательные секции MADR 3.0?"}
    MADR_Sections -->|"Пропущены альтернативы или последствия"| FillSections["ЗАПРЕТ: Заполнить Context, Decision, Consequences, Alternatives, Validation"]
    MADR_Sections -->|"Все секции заполнены"| GraphRAG_Sync{"Отправлено ли решение в GraphRAG память?"}
    
    GraphRAG_Sync -->|"Нет"| SyncAPI["Выполнить POST http://localhost:8100/api/decision или npx tsx scripts/memory-client.ts"]
    GraphRAG_Sync -->|"Да"| VerifyChecklist["Прогнать Чеклист верификации и зафиксировать в ADR"]
    
    MarkSuper --> CreateMADR
    UpdateAddendum --> GraphRAG_Sync
    SyncAPI --> VerifyChecklist
    VerifyChecklist --> Done(["ADR зафиксирован в кодовой базе"])

    classDef danger fill:#fee2e2,stroke:#ef4444,stroke-width:2px;
    classDef success fill:#dcfce7,stroke:#22c55e,stroke-width:2px;
    classDef warning fill:#fef3c7,stroke:#f59e0b,stroke-width:2px;
    class FillSections danger;
    CheckNeed,CheckAudit,ExistStatus,CheckChange,MADR_Sections,GraphRAG_Sync warning;
    NoADR,Done,VerifyChecklist success;
```

### Пошаговый регламент работы с архитектурными решениями:
1. **Шаг 1. Критерии инициации ADR**:
   ADR создается в обязательном порядке при наличии хотя бы одного условия:
   - Выбор нового архитектурного паттерна или библиотеки (например: `ExactMath` для биллинга, `UniversalProvider` для интеграций).
   - Изменение протоколов сети, проксирования или деплоя (например: переход на `Tailscale Funnel` вместо `Cloudflare`, миграция на `src/proxy.ts`).
   - Изменение финансовых инвариантов (например: переход на расчет в копейках `BigInt`, фискализация 54-ФЗ с НДС 22%).
   - Модификация схемы изоляции тенантов OmniSMM (SMMplan / SMMflux).
2. **Шаг 2. Размещение и нумерация**:
   - Файлы сохраняются в директории `docs/architecture/`.
   - Именование: `ADR-YYYY-NN-SLUG.md` (например, `ADR-2026-09-UNIFIED-ORDER-ENGINE.md`, `ADR-2026-17-EXACT-MATH-LEDGER.md`).
3. **Шаг 3. Регистрация в GraphRAG (Векторная память)**:
   - Для предотвращения «архитектурной амнезии» у последующих агентов решение регистрируется в локальной RAG-памяти:
     ```bash
     curl -X POST http://localhost:8100/api/decision \
       -H "Content-Type: application/json" \
       -d '{"title": "<Заголовок>", "decision": "<Суть решения>", "consequences": "<Последствия>", "tags": ["nextjs16", "fintech", "omnismm"]}'
     ```
   - Либо через скрипт-клиент:
     ```bash
     npx tsx scripts/memory-client.ts searchContext "<тема решения>"
     ```

---

## 2. Жесткие инварианты и табу (Hard Invariants & Anti-Patterns)

### Золотой канон принятых архитектурных решений OmniSMM (Grand Decisions)

Каждый агент **ОБЯЗАН** знать и соблюдать следующие зафиксированные решения. Попытка откатить их расценивается как архитектурная диверсия и регрессия:

#### Решение 1: Next.js 16 Proxy Architecture (`src/proxy.ts` vs `src/middleware.ts`)
> 📜 **Статус:** ACCEPTED & LOCKED (Next.js 16 Official Migration).  
> ❌ **ТАБУ:** Создавать или переименовывать файл в `src/middleware.ts`!  
> **Контекст:** В Next.js 16 `middleware.ts` официально устарел (deprecated). В проекте OmniSMM внедрен `src/proxy.ts` (`export function proxy(req)`).  
> **Преимущество:** `proxy.ts` работает в среде **Node.js Runtime** (а не в урезанном Edge Runtime). Это позволяет использовать нативные Node.js криптографические модули (`crypto.timingSafeEqual`, `crypto.randomUUID`), производить глубокую проверку сессий и динамическую маршрутизацию тенантов без хаков.

```typescript
// ✅ ПРАВИЛЬНО: src/proxy.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(req: NextRequest) {
  // Нативная среда Node.js Runtime с поддержкой всех API
  const res = NextResponse.next();
  // Маршрутизация тенантов и инжекция Nonce
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

---

#### Решение 2: Официальный туннель платформы (Tailscale Funnel vs Cloudflare)
> 📜 **Статус:** ACCEPTED & LOCKED (Sovereign Network Access 2026).  
> ❌ **ТАБУ:** Использовать Cloudflare Tunnel (`cloudflared`) или Cloudflare API на хосте разработки в РФ!  
> **Контекст:** В связи с блокировками инфраструктуры Cloudflare на ТСПУ (РКН) в РФ Cloudflare API и туннели вызывают систематические сбои TLS Handshake и таймауты.  
> **Решение:** Официальным внешним шлюзом платформы зафиксирован **Tailscale Funnel** (`https://desktop-25m6el7.tailbb9d28.ts.net`), стабильно проксирующий трафик на локальный инстанс `http://127.0.0.1:3000`.  
> **Инвариант биндинга:** Сервер Next.js обязан слушать `HOSTNAME="0.0.0.0"` и `PORT="3000"`.

---

#### Решение 3: Финтех и биллинг на `BigInt` (Копейки) и `ExactMath` Half-Even
> 📜 **Статус:** ACCEPTED & LOCKED (PCI DSS 4.0 & 54-ФЗ Integrity).  
> ❌ **ТАБУ:** Хранить деньги в `Float`, `Double` или округлять с помощью `Math.round()` / `toFixed()`!  
> **Контекст:** Вещественные числа с плавающей запятой в JavaScript (`0.1 + 0.2 = 0.30000000000000004`) приводят к финансовым расхождениям при начислениях и сверках Леджера.  
> **Решение:**  
> 1. Все денежные суммы в базе данных (`User.balance`, `LedgerEntry.amount`, `Order.charge`, `Order.providerCost`) хранятся строго в **копейках / центах как `BigInt`**.  
> 2. Все расчеты стоимости заказов и наценок проводятся через специализированную библиотеку `ExactMath.calculateOrderCostKopecks()` с применением **банковского округления (Half-Even)**.  
> 3. Минимальная стоимость единицы услуги ограничена защитным порогом: $\ge 1$ копейка.

```typescript
// ✅ ПРАВИЛЬНО: Использование ExactMath для вычисления стоимости
import { ExactMath } from '@/lib/financial/exact-math';

const orderCostKopecks = ExactMath.calculateOrderCostKopecks({
  pricePerUnitCents: service.pricePerUnitCents, // BigInt
  quantity: orderQuantity,                      // number
  marginBasisPoints: 1500,                      // 15% наценка (1500 bps)
  discountCents: promoDiscountKopecks           // BigInt
});
// Результат гарантированно BigInt без погрешностей Float
```

---

#### Решение 4: Двухбрендовый движок OmniSMM 1.0 (Dual-Brand Multi-Tenant)
> 📜 **Статус:** ACCEPTED & LOCKED (OmniSMM Platform Architecture).  
> ❌ **ТАБУ:** Хардкодить домены (`smmplan.pro`, `smmflux.ru`) или добавлять фантомные бренды (`Lovable`, `SMMboost`)!  
> **Контекст:** Платформа OmniSMM 1.0 управляет двумя брендами из единой кодовой базы:
> 1. **SMMplan (`smmplan.pro`):** Классическая B2B-панель для оптовиков и агентств (стиль B2B Classic, компоненты `<PlanButton>`, `<PlanCard>`).
> 2. **SMMflux (`smmflux.ru`):** Ритейл-витрина для блогеров и инфлюенсеров (стиль Radiant Aurora, компоненты `<FluxButton>`, `<FluxCard>`).
> 
> **Инварианты:**
> - Переключение между брендами для операторов осуществляется **глобально в Header** через компонент `<GlobalSiteSwitcher />`.
> - Тенант сохраняется в cookie `x_admin_tenant` и query-параметре `?tenant=...`.
> - Все ключи кэша в `unstable_cache` обязаны содержать префикс тенанта: `catalog-${tenantId}`.
> - Канонические ссылки формируются только через функцию `absoluteCanonical(tenantId, path)`.

---

### Эталонный шаблон MADR 3.0 для платформы OmniSMM

Каждый новый файл ADR обязан следовать строгому стандарту:

```markdown
# ADR-YYYY-NN: [Краткое название решения]

## Метаданные
- **Платформа:** OmniSMM 1.0 (SMMplan / SMMflux)
- **Статус:** [PROPOSED | ACCEPTED | DEPRECATED | SUPERSEDED by ADR-YYYY-NN]
- **Дата:** YYYY-MM-DD
- **Автор(ы):** [Имя или роль архитектора]
- **Теги:** [nextjs16, security, fintech, rbac, multi-tenant]

---

## 1. Context & Problem Statement (Контекст и постановка проблемы)
[Подробное описание проблемы. Какие технические или бизнес-факторы делают текущее состояние неудовлетворительным? Ссылки на инциденты, замеры производительности или требования регуляторов.]

---

## 2. Decision Drivers (Ключевые факторы решения)
- [Фактор 1: например, совместимость с Next.js 16 App Router]
- [Фактор 2: например, соблюдение требований 54-ФЗ и PCI DSS 4.0]
- [Фактор 3: например, суверенная сетевая доступность в РФ / ТСПУ]

---

## 3. Considered Options (Рассмотренные альтернативы)
1. **Вариант А:** [Название и краткое описание]
2. **Вариант Б (Выбранный):** [Название и краткое описание]
3. **Вариант В:** [Название и краткое описание]

---

## 4. Decision Outcome (Принятое решение)
**Выбран Вариант Б**, потому что [подробное обоснование].

### Архитектурная схема (Mermaid):
\`\`\`mermaid
flowchart TD
  [Схема нового решения]
\`\`\`

---

## 5. Consequences (Последствия)
### Положительные (Positive)
- [Плюс 1]
- [Плюс 2]

### Отрицательные и технический долг (Negative)
- [Минус 1: например, необходимость миграции старых данных]
- [Минус 2: увеличение времени билда]

### Нейтральные (Neutral)
- [Нейтральное изменение]

---

## 6. Validation & Test Strategy (Стратегия валидации)
- [Тест 1: Юнит-тест Vitest]
- [Тест 2: E2E Playwright тест]
- [Тест 3: Нагрузочный бенчмарк latency P95 < 30ms]
```

---

## 3. Премортем-анализ и моделирование отказов (Failure Scenarios / Pre-Mortem)

Таблица рисков архитектурной деградации при отсутствии дисциплины ADR:

| Сценарий отказа | Вероятность x Влияние | Механизм защиты в коде / процессе | Стратегия восстановления |
| :--- | :--- | :--- | :--- |
| **1. «Архитектурная амнезия» (Откат на middleware.ts новым агентом)** | Высокая (4) x Фатальное (5) = **20** | Наличие данного скилла `adr-architect`, жесткое правило в `AGENTS.md`, pre-commit проверка отсутствия `middleware.ts`. | Мгновенный откат коммита, запуск codemod `middleware-to-proxy`, фиксация нарушения. |
| **2. Внедрение чисел с плавающей точкой в новые платежные модули** | Средняя (3) x Критическое (5) = **15** | Строгая типизация Prisma (`balance: BigInt`), линтер запрета `Math.round` над денежными типами, юнит-тесты `fast-check.pricing.test.ts`. | Рефакторинг на `ExactMath`, пересчет леджера через `NightlyLedgerAuditService`. |
| **3. Появление фантомных брендов в UI (Lovable/SMMboost)** | Средняя (3) x Средняя (3) = **9** | Автотест `tests/brands/no-phantom-brands.test.ts`, сканирующий репозиторий на недопустимые токены брендов. | Автоматическая замена на канонические идентификаторы (`flux` / `smmplan`). |
| **4. Потеря контекста при смене состава разработчиков/агентов** | Высокая (4) x Высокая (4) = **16** | Обязательная регистрация всех решений в MADR 3.0 в `docs/architecture/` и синхронизация с GraphRAG. | Запрос к GraphRAG `searchContext`, восстанавливающий дерево решений за 1 секунду. |
| **5. Конфликт версий ADR при параллельной разработке** | Низкая (2) x Средняя (3) = **6** | Именование файлов с датой и порядковым номером (`ADR-YYYY-NN`), статусная модель MADR (PROPOSED $\to$ ACCEPTED). | Проведение Архитектурного Круглого Стола (Round Table) для разрешения противоречий. |

---

## 4. Чеклист верификации (Verification Checklist)

При подготовке и защите нового архитектурного решения (ADR) проверьте выполнение каждого пункта:

### 1. Проверка структуры документа MADR 3.0
- [ ] Файл создан в директории `docs/architecture/ADR-YYYY-NN-<slug>.md`.
- [ ] Присутствуют метаданные: Заголовок, Номер, Дата, Статус (`PROPOSED` / `ACCEPTED` / `SUPERSEDED`), Автор, Стек.
- [ ] Присутствует раздел **Context & Problem Statement** с четким описанием бизнес-проблемы и технических ограничений.
- [ ] Присутствует раздел **Decision** с конкретным описанием выбранного подхода и диаграммой (Mermaid).
- [ ] Присутствует раздел **Consequences** с разбивкой:
  - Положительные последствия (Positive).
  - Отрицательные последствия и технический долг (Negative).
  - Нейтральные последствия (Neutral).
- [ ] Присутствует раздел **Alternatives Considered** (минимум 2 отвергнутые альтернативы с обоснованием отказа).
- [ ] Присутствует раздел **Validation Strategy** (какими автотестами и метриками проверяется успешность решения).

### 2. Верификация синхронизации с GraphRAG памятью
- [ ] Проверить доступность локального сервиса GraphRAG:
  ```bash
  curl -s http://localhost:8100/health || echo "GraphRAG offline"
  ```
- [ ] Зарегистрировать новое решение в базе знаний платформы:
  ```bash
  curl -X POST http://localhost:8100/api/decision \
    -H "Content-Type: application/json" \
    -d "{\"title\": \"ADR-YYYY-NN: Название\", \"decision\": \"Описание решения\", \"consequences\": \"Последствия\", \"status\": \"ACCEPTED\"}"
  ```

### 3. Регрессионный аудит кодовой базы
- [ ] Убедиться, что новое решение не нарушает ни один из четырех Grand Decisions (proxy.ts, Tailscale Funnel, BigInt ExactMath, OmniSMM dual-brand).
- [ ] Прогнать тесты на целостность архитектурных контрактов:
  ```bash
  npx vitest run src/__tests__/ai-data-math-and-schema-integrity.test.ts
  npx vitest run src/__tests__/catalog-multitenant-e2e.test.ts
  ```
