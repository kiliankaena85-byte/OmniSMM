---
name: postgres-query-doctor
description: >
  Архитектурный скилл диагностики, профилирования и глубокой оптимизации запросов PostgreSQL и Prisma 5
  в платформе OmniSMM 1.0. Используй этот скилл ВСЕГДА, когда создаются или изменяются: выборки из БД,
  фильтры каталога, списки заказов и проводок в админке, пагинация, Prisma queries, сложные агрегации,
  индексы или настройки пула соединений (PgBouncer / Prisma connection_limit). Предотвращает проблемы N+1,
  деградацию времени отклика при глубоком OFFSET, исчерпание пула соединений и долгие блокировки таблиц.
---

# SKILL: postgres-query-doctor — Оптимизация и аудит запросов PostgreSQL & Prisma

> **Статус:** Обязательный стандарт производительности базы данных OmniSMM 1.0 (BGS-2026 / RAC-2026).  
> **Целевые NFR-бюджеты:** P95 запроса к БД $\le 30\text{ms}$, админ-дашборд $\le 200\text{ms}$, 0 N+1 запросов.

---

## 1. Дерево решений (Decision Tree)

```mermaid
flowchart TD
    Start(["Проверка / Оптимизация запроса к БД"]) --> QueryType{"Какой тип запроса оптимизируется?"}
    
    QueryType -->|"Пагинация больших таблиц"| Page_Check["Анализ пагинации"]
    QueryType -->|"Связанные данные (Relations)"| Rel_Check["Анализ связей (N+1)"]
    QueryType -->|"Фильтрация и поиск"| Index_Check["Анализ индексов"]
    QueryType -->|"Транзакции и мутации"| Lock_Check["Анализ блокировок"]

    %% Pagination Checks
    Page_Check --> Offset_Guard{"Используется ли 'skip: N' при N > 1000?"}
    Offset_Guard -->|"Да (КАТАСТРОФА)"| FixOffset["ЗАПРЕТ: Заменить OFFSET на Keyset-пагинацию (cursor: { id })!"]
    Offset_Guard -->|"Нет"| Page_Pass(["Пагинация валидирована"])

    %% Relation Checks
    Rel_Check --> Loop_Prisma{"Вызывается ли db.*findUnique внутри .map / for-loop?"}
    Loop_Prisma -->|"Да (КАТАСТРОФА N+1)"| FixNPlusOne["ЗАПРЕТ: Заменить на один findMany({ where: { id: { in: ids } } }) или include!"]
    Loop_Prisma -->|"Нет"| Rel_Pass(["N+1 дефекты отсутствуют"])

    %% Index Checks
    Index_Check --> Filter_Index{"Есть ли покрывающий B-Tree индекс на фильтруемые поля?"}
    Filter_Index -->|"Нет"| AddIndex["Создать индекс через CREATE INDEX CONCURRENTLY"]
    Filter_Index -->|"Да"| Tenant_Index{"Индекс включает поле tenantId первым сегментом?"}
    Tenant_Index -->|"Нет"| FixComposite["Добавить tenantId в составной индекс (tenantId, createdAt)"]
    Tenant_Index -->|"Да"| Index_Pass(["Индексы валидированы"])

    %% Lock Checks
    Lock_Check --> Lock_Limit{"Задан ли lock_timeout для DDL / транзакции?"}
    Lock_Limit -->|"Нет"| AddLockTimeout["Установить SET lock_timeout = '2s';"]
    Lock_Limit -->|"Да"| Lock_Pass(["Блокировки безопасны"])
```

---

## 2. Жесткие инварианты производительности БД (Hard Invariants)

1. **Keyset Cursor Pagination Invariant:**
   * Запрещено использовать классический `skip: page * pageSize` на таблицах свыше 10 000 строк (`Order`, `LedgerEntry`, `AuditLog`, `TicketMessage`).
   * Пагинация обязана использовать курсор:
   ```typescript
   const orders = await prisma.order.findMany({
     take: pageSize + 1,
     cursor: cursorId ? { id: cursorId } : undefined,
     skip: cursorId ? 1 : 0,
     where: { tenantId },
     orderBy: { id: 'desc' },
   });
   ```
2. **Zero N+1 Query Invariant:**
   * Запрещено выполнять запросы к БД внутри циклов `.map()`, `forEach()`, `for...of`.
   * Все связанные сущности загружаются пакетно через `include`, `select` или предварительную выборку `where: { id: { in: ids } }` с маппингом через `Map<string, Entity>`.
3. **Tenant-First Composite Indexes:**
   * Любой составной индекс на таблицах с мульти-тенантностью обязан начинаться с `tenantId`:
   ```prisma
   @@index([tenantId, status, createdAt(sort: Desc)])
   @@index([tenantId, userId, createdAt(sort: Desc)])
   ```
4. **Selective Fields Projection:**
   * Запрещено запрашивать таблицы целиком (`select *`) на страницах витрины и в API. Всегда явно перечислять только необходимые поля через `select: { id: true, title: true, price: true }`, снижая объем передаваемых данных по сети и сериализации RSC.

---

## 3. Чеклист верификации производительности SQL

- [ ] Запрос проверен через `EXPLAIN (ANALYZE, BUFFERS)` — отсутствуют Sequential Scans на таблицах свыше 5 000 строк.
- [ ] Количество одновременных соединений Prisma ограничено параметром `connection_limit=10` в `DATABASE_URL`.
- [ ] Тяжелые аналитические агрегации вынесены в фоновый воркер или материализованные кэши Redis с TTL.
- [ ] Отсутствуют долгие открытые транзакции (`$transaction`), содержащие сетевые HTTP-вызовы или криптографические циклы.
