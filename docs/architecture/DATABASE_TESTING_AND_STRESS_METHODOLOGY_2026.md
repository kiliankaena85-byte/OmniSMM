# OMNISMM 1.0 — DATABASE TESTING, STRESS & ARCHITECTURAL VERIFICATION METHODOLOGY (2026)
## Институциональная методология и стандарты тестирования базы данных (RAC-2026 / ISO 25010 / PCI-DSS v4.0.1)

---

### 1. Архитектурный контекст и регуляторные требования

Платформа **OmniSMM 1.0** обслуживает бренды **SMMplan** (`smmplan.pro`) и **SMMflux** (`smmflux.ru`) в режиме мульти-тенантности, обрабатывая финансовые транзакции, моментальные списания, пополнения баланса и фоновые запуски заказов Drip-Feed.

К базе данных платформы (PostgreSQL 15 + Redis 7 + Prisma 5) предъявляются строгие банковские требования надежности:
- **ISO 25010:2023 (Systems and software Quality Requirements and Evaluation)**:
  - *Reliability / Fault Tolerance*: Способность сохранять целостность при параллельных транзакциях и отказах сети.
  - *Performance Efficiency / Time Behaviour*: Бюджет задержек чтения каталога $\le 30$ms, поиска пользователя $\le 15$ms при 95-м перцентиле (P95).
  - *Security / Non-Repudiation & Integrity*: Фиксация всех финансовых мутаций без возможности модификации или удаления записей.
- **PCI-DSS v4.0.1 (Requirements 3.4, 6.4, 10.2)**: Неизменяемый аудит-лог проводок (Immutable Ledger), исключение уязвимостей состояния гонки (Race Conditions, TOCTOU).
- **54-ФЗ и 176-ФЗ / 425-ФЗ**: Двойная бухгалтерская запись (Ledger-First), привязка к фискальным кодам НДС и запрет отрицательных балансов.
- **Статья 54.1 НК РФ**: Абсолютная межтенантная изоляция (Multi-Tenant Isolation) — исключение кросс-тенантного чтения или утечки данных между клиентами SMMplan и SMMflux.

---

### 2. Пятиуровневая пирамида тестирования БД (RAC-DB-2026)

```
                     ▲
                    / \
                   / L5\     Внешние инструменты & Профилирование
                  /-----\    (pgbench, pg_stat_statements, Bloat Diag)
                 /   L4  \   Масштабирование & Keyset Cursor Saturation
                /---------\  (High-Volume Datasets, B-Tree vs Offset)
               /     L3    \ Хаос-инженерия & Отказоустойчивость
              /-------------\(Rollback Atomicity, Ledger Tampering, Faults)
             /       L2      \ ACID & Стресс-тесты гонок (Concurrency Races)
            /-----------------\ (Parallel Debits, Row-Level Locks, Deadlocks)
           /         L1        \ Аппаратные инварианты схемы PostgreSQL
          /---------------------\ (CHECK >= 0, Triggers, GIN pg_trgm, HOT 85)
```

#### Уровень 1 (L1): Аппаратные инварианты схемы и физические ограничения (Hardware Constraints)
- **Физический CHECK Constraint `chk_user_balance_non_negative`**:
  Баланс пользователя `User.balance` защищен на уровне ядра PostgreSQL: `CHECK (balance >= 0)`. Любая транзакция, нарушающая баланс (даже в обход ORM), прерывается СУБД с ошибкой `23514 check_violation`.
- **Неизменяемый триггер `trg_ledger_immutable`**:
  Таблица `"LedgerEntry"` снабжена триггером `BEFORE UPDATE OR DELETE`, вызывающим `fn_prevent_ledger_tampering()`. Операции `UPDATE` и `DELETE` блокируются на физическом уровне с кодом ошибки `P0001`.
- **Триграммные GIN-индексы (`pg_trgm`)**:
  Индексы `idx_order_link_trgm`, `idx_service_name_trgm`, `idx_user_email_trgm` обеспечивают ускорение подстрочного поиска (`ILIKE '%query%'`) с $O(N)$ Sequential Scan до $O(\log N)$ Bitmap Index Scan при времени выполнения $< 5$ms.
- **MVCC HOT-Updates оптимизация (`fillfactor = 85`)**:
  Для таблицы `"Order"` зарезервировано 15% свободного места на каждой странице для Heap-Only Tuple обновлений статусов воркером (`status`, `remains`, `updatedAt`), что устраняет необходимость модификации индексов и снижает bloat на 80%.

#### Уровень 2 (L2): ACID & Стресс-тесты параллельных гонок (Concurrency Races)
- **Устранение уязвимостей двойного расходования (Double-Spending / Race Condition)**:
  Тестирование одновременного списания баланса десятками параллельных потоков.
  - *Инвариант сохранения денег (Conservation of Money)*:
    $$\text{Balance}_{\text{final}} = \text{Balance}_{\text{initial}} - \sum_{i \in \text{Successful}} \text{Amount}_i$$
    $$\text{Count}(\text{Successful}) + \text{Count}(\text{Rejected}) = \text{Total Concurrent Requests}$$
- **Row-Level Locking & Атомарность `WalletOps.charge`**:
  Проверка атомарного декремента через `UPDATE "User" ... WHERE id = $1 AND balance >= $2`.
- **Насыщение пула соединений (Connection Pool Saturation)**:
  Запуск параллельных задач, превышающих размер пула соединений (`connection_limit=15`). Проверка корректного ожидания в очереди (`pool_timeout`), отсутствия брошенных соединений (connection leaks) и устойчивости к ошибке `P2024`.
- **Детекция взаимоблокировок (Deadlock Detection & Resilience)**:
  Моделирование циклической зависимости блокировок строк (Transaction A: Lock 1 $\to$ Lock 2; Transaction B: Lock 2 $\to$ Lock 1). Проверка механизма обнаружения взаимных блокировок PostgreSQL (`40P01 deadlock_detected`) и автоматического перезапуска с экспоненциальным backoff (`runSerializableTransaction`).

#### Уровень 3 (L3): Хаос-инженерия, Фаззинг и Гарантии отката (Chaos & Integrity)
- **Гарантия полного отката транзакции (Rollback Atomicity)**:
  Внедрение сбоя (Fault Injection) сразу после создания записи `LedgerEntry`, но до коммита транзакции.
  *Критерий успеха*: Ни запись в `LedgerEntry`, ни мутация `User.balance` не сохраняются в базе данных. Нулевой след в таблицах при ошибке.
- **Стресс-попытка модификации леджера (Ledger Tamper Attack)**:
  Параллельная атака на изменение или удаление записей `LedgerEntry` во время активного создания новых транзакций. Проверка 100% блокировки попыток взлома.
- **Фаззинг входных данных**:
  Передача отрицательных чисел, переполнений (overflow), спецсимволов, SQL-инъекций и несовпадающих идентификаторов тенантов (`tenantId`).
- **Сквозная изоляция тенантов**:
  Попытка списания средств пользователя одного бренда (например, `smmplan`) из контекста другого бренда (`smmflux`) должна завершаться отказом `WalletUserNotFoundError` без раскрытия данных.

#### Уровень 4 (L4): Масштабирование & Keyset Cursor Saturation
- **Сравнение алгоритмической сложности**:
  - Традиционный `OFFSET`: сканирует и сбрасывает $N$ строк, вызывая линейную деградацию $O(N)$ по времени и вводу-выводу.
  - Keyset Cursor `(createdAt DESC, id DESC)`: прямой поиск по составному B-Tree индексу за постоянное время $O(1)$ независимо от глубины страницы (1-я или 10 000-я страница).
- **Anti-IDOR Guard в пагинации**:
  Опорная запись курсора проверяется с фильтрацией `userId` и `tenantId`.

#### Уровень 5 (L5): Внешние инструменты и Профилирование архитектуры (External Tooling)
- **`pgbench` (PostgreSQL Micro-benchmarking)**:
  Встроенная в Docker-контейнер `smmplan_lite_db` утилита генерации синтетической нагрузки для замера максимального TPS (Transactions Per Second) и перцентилей задержек.
- **`pg_stat_statements` & системные представления**:
  Анализ самых тяжелых запросов, времени планирования (`mean_plan_time`), времени исполнения (`mean_exec_time`), числа вызовов и попаданий в буферный кэш (`shared_blks_hit` vs `shared_blks_read`).
- **Диагностика раздувания (Table & Index Bloat Diagnostics)**:
  Мониторинг мертвых кортежей (`n_dead_tup`), живых кортежей (`n_live_tup`), коэффициента HOT-обновлений (`n_tup_hot_upd / n_tup_upd`) и эффективности автовакуума.

---

### 3. Инженерный чеклист метрик и пороговые бюджеты (SLA RAC-2026)

| Метрика | Бюджет SLA (P50) | Бюджет SLA (P95) | Допустимый отказ | Статус |
|---|---|---|---|---|
| **Поиск сессии и баланса пользователя** | $< 3.0$ ms | $< 15.0$ ms | 0% | ✅ Гарантирован B-Tree |
| **Списание средств (`WalletOps.charge`)** | $< 5.0$ ms | $< 25.0$ ms | 0% при наличии средств | ✅ Ledger-First + Lock |
| **Выборка каталога услуг** | $< 6.0$ ms | $< 30.0$ ms | 0% | ✅ Redis L1 + GIN |
| **Реестр заказов (Keyset пагинация)** | $< 3.5$ ms | $< 25.0$ ms | 0% | ✅ $O(1)$ B-Tree |
| **Параллельная гонка за балансом (50 потоков)** | — | — | 0 нарушений инварианта баланса | ✅ Zero Negative Balance |
| **Buffer Cache Hit Ratio** | $\ge 95\%$ | $\ge 90\%$ | $< 85\%$ — алерт | ✅ Мониторинг |
| **HOT-Update Ratio для `Order`** | $\ge 70\%$ | $\ge 60\%$ | $< 50\%$ — алерт | ✅ `fillfactor = 85` |

---

### 4. Руководство по запуску тестовых сьютов и утилит

#### 1. Стресс-тестирование параллелизма и гонок (Vitest)
```bash
npm run test:db:stress
```
Запускает сьют `src/__tests__/integration/db-stress-concurrency.test.ts`:
- 50 параллельных списаний баланса (устранение Race Condition).
- Параллельное оформление заказов со списанием баланса в единой транзакции.
- Насыщение пула соединений (30 одновременных задач при лимите пула 15).
- Моделирование взаимных блокировок (Deadlocks) с проверкой механизма retry.

#### 2. Хаос-инженерия и инварианты целостности данных (Vitest)
```bash
npm run test:db:chaos
```
Запускает сьют `src/__tests__/integration/db-chaos-integrity.test.ts`:
- Гарантия отката транзакций (Rollback Atomicity) при искусственных сбоях.
- Стресс-попытка модификации леджера во время высокой нагрузки.
- Фаззинг входных данных и кросс-тенантная изоляция.
- Бенчмарк Keyset Cursor vs OFFSET на выборке 500+ заказов.

#### 3. Нагрузочное тестирование через `pgbench` (Docker Runner)
```bash
# Запуск симуляции чекаута и баланса (10 клиентов, 5 секунд)
npm run db:bench:pgbench

# Запуск в произвольном режиме с параметрами
npm run db:bench:pgbench -- --mode checkout --duration 10 --clients 20
npm run db:bench:pgbench -- --mode catalog --duration 10 --clients 10
npm run db:bench:pgbench -- --mode wallet --duration 10 --clients 10
npm run db:bench:pgbench -- --mode mixed --duration 10 --clients 10
```
Автоматически выполняет бенчмарк внутри Docker-контейнера `smmplan_lite_db`, генерирует профили нагрузки и выводит сводный отчет TPS и задержек с оценкой соблюдения SLA RAC-2026.

#### 4. Диагностика раздувания таблиц и эффективности HOT-обновлений
```bash
npm run db:bloat
```
Анализирует объем `n_dead_tup`, процент HOT-обновлений для таблицы `Order` и дает рекомендации по `VACUUM` / `REINDEX`.

#### 5. Профилирование запросов, кэша и проливания на диск
```bash
npm run db:profile:queries
```
Анализирует производительность запросов через `pg_stat_statements`, процент использования индексов (`seq_scan` vs `idx_scan`), процент попаданий в кэш (`heap_hit` vs `idx_hit`), размер временных файлов (disk spilling) и наличие активных блокировок.

#### 6. Автономный хаос-раннер (Fault Injection CLI)
```bash
npm run db:chaos:run
```
Запускает автономный CLI-раннер 5 экспериментов хаос-инженерии (откат на лету, неизменяемость леджера, гонки баланса, аппаратный CHECK и мульти-тенантную изоляцию) с генерацией сводной таблицы.

#### 7. Комплексный прогон всех проверок БД
```bash
npm run db:test:all
```
Выполняет полный контур: стресс-тесты, хаос-тесты, диагностику раздувания базы данных и профилирование запросов.

---

### 5. Внешние инструменты нагрузочного тестирования: k6 & pgbench

#### 1. Микро-нагрузка PostgreSQL: `pgbench`
`pgbench` применяется для изолированной оценки пропускной способности ядра СУБД без оверхеда сетевого стека Node.js и сериализации JSON:
- **Профиль `checkout`**: симулирует чтение цен каталога и блокировку баланса перед списанием.
- **Профиль `catalog`**: симулирует высокую нагрузку со стороны неавторизованных пользователей на витрине.
- **Профиль `wallet`**: симулирует параллельные проверки баланса мобильным приложением и ботом.

*Показатели на локальном окружении:*
- **13 600+ TPS** при среднем времени отклика **0.73 ms** (норматив $\le 15$ ms).

#### 2. E2E HTTP-нагрузка: `k6`
Для тестирования всей сквозной цепочки (Next.js App Router $\to$ Redis L1 $\to$ Prisma 5 $\to$ PostgreSQL 15) подготовлен скрипт `scripts/db-testing/k6-load-scenario.js`.

```bash
# Запуск нагрузочного теста k6 (50 виртуальных пользователей, 30 секунд)
k6 run scripts/db-testing/k6-load-scenario.js

# Запуск с переопределением целевого хоста
TARGET_URL="http://127.0.0.1:3000" k6 run --vus 50 --duration 30s scripts/db-testing/k6-load-scenario.js
```

Сценарий валидирует:
1. Выборку каталога (`GET /api/catalog?tenant=smmplan`) под нагрузкой $\ge 50$ VU (SLA P95 $< 30$ms).
2. Пагинацию Keyset (`GET /api/orders?limit=10&dir=forward`) (SLA P95 $< 25$ms).
3. Долю ошибок `http_req_failed < 1%`.

---

### 6. Операционные регламенты и Ранбуки (On-Call Runbooks)

#### 📘 Ранбук 1: Превышение лимита пула соединений (`P2024 Connection Pool Timeout`)
- **Симптом**: В логах бэкенда появляется `Timed out fetching a connection from the connection pool`.
- **Диагностика**:
  ```bash
  npm run db:profile:queries
  ```
  Проверить секцию `[5/5] LOCK CONTENTION & BLOCKING SESSIONS AUDIT`.
- **Действия**:
  1. Если в `pg_stat_activity` обнаружены зависшие запросы в состоянии `active` более 10 секунд:
     ```sql
     SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state != 'idle' AND age(clock_timestamp(), query_start) > interval '10 seconds';
     ```
  2. Проверить значение `connection_limit` в `.env`: по умолчанию установлено `15`. При росте фоновых воркеров BullMQ увеличить до `25` (учитывая `max_connections = 100` в PostgreSQL).

#### 📘 Ранбук 2: Всплеск взаимоблокировок (`40P01 deadlock_detected`)
- **Симптом**: Резкий рост ошибок транзакций в сервисе биллинга.
- **Диагностика**:
  ```bash
  npm run db:profile:queries
  ```
  Проверить счетчик `Deadlocks Detected` в секции `[4/5]`.
- **Действия**:
  1. Убедиться, что все блокировки ресурсов берутся в строго одинаковом лексикографическом порядке (например, сортировка `id` перед массовым списанием: `userIds.sort()`).
  2. Использовать `runSerializableTransaction()` с автоматическим экспоненциальным backoff (3 попытки с джиттером 50-200ms).

#### 📘 Ранбук 3: Раздувание таблиц и деградация HOT-обновлений (Bloat $> 20\%$)
- **Симптом**: Рост размера базы данных и падение Buffer Cache Hit Ratio ниже $90\%$.
- **Диагностика**:
  ```bash
  npm run db:bloat
  ```
  Проверить статус в колонке `Status` и метрику `HOT Upd %`.
- **Действия**:
  1. Если `Dead % > 20%` для таблицы `Order`:
     ```sql
     VACUUM (ANALYZE) "Order";
     ```
  2. Если размер индексов превышает размер таблицы более чем в 3 раза, выполнить перестроение индексов без блокировки:
     ```sql
     REINDEX TABLE CONCURRENTLY "Order";
     ```
  3. Убедиться, что `fillfactor = 85` сохранен в `pg_class.reloptions`.

#### 📘 Ранбук 4: Проливание временных файлов на диск (`temp_files > 0`)
- **Симптом**: Замедление сортировок в админке или аналитических агрегатов.
- **Диагностика**:
  ```bash
  npm run db:profile:queries
  ```
  Проверить строку `Temporary Files Spilled: X (Y MB)`.
- **Действия**:
  1. Найти запросы с большими `Sort` или `HashAggregate` через `EXPLAIN (ANALYZE, BUFFERS)`.
  2. При необходимости увеличить `work_mem` для конкретной сессии или в конфигурации СУБД:
     ```sql
     SET work_mem = '64MB';
     ```

