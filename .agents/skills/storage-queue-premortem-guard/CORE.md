# storage-queue-premortem-guard (L1 Core Invariants)
> **Статус:** CRITICAL ARCHITECTURAL GATE | **Бюджет:** < 450 токенов | **Слой:** L1 Fast Core

## 🛑 HARD INVARIANTS (КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО)
1. **Zero-FTS & Bounded Queries:** ЗАПРЕЩЕН `findMany` без явного `take`. Максимальный лимит страницы `take <= 500`. Нарушение вызывает вымывание кэша диска (IOPS Thrashing).
2. **Keyset Cursor Pagination Only:** ЗАПРЕЩЕН `skip > 1000`. На таблицах свыше 10 000 строк пагинация выполняется ИСКЛЮЧИТЕЛЬНО по курсору `(createdAt, id)`.
3. **Zero O(N) Redis Commands:** ЗАПРЕЩЕНЫ команды `KEYS *`, `HGETALL` и `SMEMBERS` без жесткого ограничения размера. Замена на курсорный `SCAN ... COUNT 100`.
4. **Universal TTL Invariant:** Любая запись динамических данных в Redis обязана содержать опцию истечения срока (`EX` или `PX`). Бессмертные кэши вызывают OOM.
5. **Job Queue Auto-Purge:** ЗАПРЕЩЕНО регистрировать задачи BullMQ без параметров `removeOnComplete` и `removeOnFail`. Завершённые задачи пожирают оперативную память.
6. **Zero Dual-Write in Transactions:** ЗАПРЕЩЕН вызов `queue.add()` или мутация Redis внутри `$transaction(async (tx) => { ... })`. Использовать Transactional Outbox или Deferred Hook.
7. **Foreign Key Index Invariant:** Любое поле внешнего ключа (`@relation`) обязано быть покрыто B-Tree индексом для исключения `ShareLock` при `UPDATE`/`DELETE`.

## ⚡ FAST RULES & FORMULAS
- **Сайзинг пула БД:** $N_{conn} = 2 \times \text{CPU Cores} + \text{Effective Spindles}$ (`DATABASE_POOL_SIZE = 10`, `worker = 5`).
- **Keyset-предикат:** `WHERE (created_at, id) < (:cursorTime, :cursorId) ORDER BY created_at DESC, id DESC LIMIT 50`.
- **HOT Updates (Postgres):** `ALTER TABLE "User" SET (fillfactor = 85);` — исключает перезапись индексов при мутациях баланса.
- **BullMQ Purge:** `REPEATABLE_JOB_CLEANUP_OPTS = { removeOnComplete: { count: 100, age: 3600 }, removeOnFail: { count: 500, age: 86400 } }`.
- **XFetch Stampede Guard:** Проверка `delta * beta * ln(random()) > (expiry - now)` для фонового прогрева до экспирации.

## 🔍 PRE-MORTEM QUICK CHECK
- [ ] Задан ли `take <= 500` во всех `findMany`?
- [ ] Используется ли Keyset-курсор вместо `skip: N`?
- [ ] Проверен ли составной индекс на фильтруемые поля (`tenantId`, `createdAt`)?
- [ ] Задан ли TTL (`EX`/`PX`) на каждый ключ кэша?
- [ ] Заданы ли `removeOnComplete` и `removeOnFail` для BullMQ?
- [ ] Вынесены ли внешние I/O и сетевые вызовы за пределы `tx`?

---
*Для полного дерева решений, пре-мортем матрицы и примеров см. [SKILL.md](./SKILL.md) (L2 Deep).*
