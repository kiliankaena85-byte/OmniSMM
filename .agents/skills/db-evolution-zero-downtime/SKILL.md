---
name: db-evolution-zero-downtime
description: "Используй этот скилл ВСЕГДА, когда Комплексный архитектурный скилл
  проведения миграций схемы базы данных PostgreSQL без простоя (Zero-Downtime
  Database Evolution) с использованием Prisma 5. Применяй этот скилл ВСЕГДА,
  когда планируются изменения структуры БД: добавление, переименование или
  удаление колонок, таблиц и внешних ключей (FK), реализация паттерна
  Expand/Contract (двухфазное расширение и сжатие схемы), создание и удаление
  индексов без блокировки таблиц (CREATE INDEX CONCURRENTLY), безопасные
  DDL-операции, настройка lock_timeout и statement_timeout для предотвращения
  очередей блокировок (Lock Queue Starvation), фоновый. НЕ применять для верстки
  UI или правок клиентских стилей."
---

# Zero-Downtime Database Evolution — Безопасная эволюция схемы PostgreSQL и Prisma 5 в OmniSMM

## Назначение скилла

Скилл `db-evolution-zero-downtime` устанавливает обязательные инженерные протоколы для любых изменений схемы базы данных PostgreSQL платформы OmniSMM (бренды SMMplan и SMMflux). 

В режиме непрерывной работы 24/7/365 с миллионами заказов (`Order`), проводок леджера (`LedgerEntry`) и пользовательских транзакций недопустим даже кратковременный простой базы данных. Стандартные миграции ORM (такие как наивный запуск `prisma migrate dev` или `ALTER TABLE ... ADD COLUMN ... NOT NULL DEFAULT ...`) захватывают тяжелые эксклюзивные блокировки (`ACCESS EXCLUSIVE`), которые:
1. Выстраивают за собой очередь из всех входящих HTTP-запросов и воркеров (`Lock Queue Starvation`).
2. Быстро исчерпывают пул соединений к PostgreSQL (PgBouncer / Prisma connection pool).
3. Приводят к каскадному падению всего бэкенда с ошибками `504 Gateway Timeout` и потерей платежных вебхуков.

Данный скилл предписывает строгий переход от одномоментных разрушающих изменений к **многофазному эволюционному паттерну Expand/Contract** и безопасным неблокирующим DDL-операциям.

---

## 1. Дерево решений (Decision Tree / Flowchart)

### 1.1. Архитектурная блок-схема выбора стратегии миграции

```
                    [Запрос на изменение схемы PostgreSQL]
                                      │
                                      ▼
                      ┌───────────────────────────────┐
                      │ Какой тип изменения вносится? │
                      └───────────────────────────────┘
                                      │
         ┌──────────────────┬─────────┴─────────┬──────────────────┐
         │                  │                   │                  │
         ▼                  ▼                   ▼                  ▼
  [Добавление]        [Изменение/         [Удаление           [Создание/
   Колонки/Таблицы     Переименование]     Колонки/Таблицы]    Удаление Индекса]
         │                  │                   │                  │
         ▼                  ▼                   ▼                  ▼
┌──────────────────┐┌──────────────────┐┌──────────────────┐┌──────────────────┐
│ Колонка Nullable ││ ПАТТЕРН EXPAND/  ││ ФАЗА CONTRACT:   ││ ТАБУ: Обычный    │
│ или с простым    ││ CONTRACT:        ││ 1. Пометить      ││ CREATE INDEX     │
│ дефолтом?        ││ 1. Expand: новая ││    @ignore в     ││ блокирует запись!│
└──────────────────┘│    колонка       ││    Prisma        │└──────────────────┘
   │            │   │ 2. Dual-Write в  ││ 2. Релиз кода    │         │
  ДА           НЕТ  │    коде          ││    (убрать чтения│         ▼
   │            │   │ 3. Backfill      ││ 3. Безопасный    │┌──────────────────┐
   │            │   │ 4. Switch Read   ││    DROP через DDL││ CREATE INDEX     │
   │            │   │ 5. Contract      │└──────────────────┘│ CONCURRENTLY     │
   │            │   └──────────────────┘                    │ вне транзакции с │
   │            ▼                                           │ lock_timeout     │
   │   ┌───────────────────────────┐                        └──────────────────┘
   │   │ Добавление NOT NULL:      │
   │   │ 1. ADD COLUMN nullable    │
   │   │ 2. Фоновый Backfill       │
   │   │ 3. ADD CONSTRAINT CHECK   │
   │   │    (col IS NOT NULL)      │
   │   │    NOT VALID              │
   │   │ 4. VALIDATE CONSTRAINT    │
   │   │ 5. ALTER COLUMN SET NOT   │
   │   │    NULL (fast catalog update)
   │   └───────────────────────────┘
   │
   ▼
┌──────────────────────────────────────┐
│ Safe DDL Execution Rule:             │
│ SET lock_timeout = '2s';             │
│ SET statement_timeout = '10s';       │
│ ALTER TABLE "Target" ADD COLUMN ...; │
└──────────────────────────────────────┘
```

### 1.2. Пошаговые сценарии реализации

1. **Добавление Nullable колонки:**
   - В PostgreSQL 11+ добавление колонки с константным значением по умолчанию (`DEFAULT 'some_value'`) не переписывает таблицу физически, а обновляет только системный каталог `pg_attribute`. Это безопасно при наличии `lock_timeout`.
2. **Переименование колонки (Rename):**
   - **Категорическое табу на `ALTER TABLE RENAME COLUMN` в боевой БД.**
   - Приводит к падению старых инстансов приложений во время Rolling Update (старый код ищет `old_col`, а его уже нет в БД).
   - Выполняется строго через 4-фазный цикл:
     * *Фаза 1 (Expand):* Добавить `new_col` (nullable).
     * *Фаза 2 (Dual-Write & Backfill):* Код приложения пишет синхронно в `old_col` и `new_col`, читает из `old_col`. Фоновый скрипт батчами переносит старые данные.
     * *Фаза 3 (Switch Read):* Код приложения переключает чтение на `new_col`.
     * *Фаза 4 (Contract):* Удаление записи в `old_col` из кода, затем удаление колонки `old_col` из БД.
3. **Создание индексов (Indexes):**
   - Создание индекса на таблицах свыше 10 000 строк (`Order`, `LedgerEntry`, `TicketMessage`) выполняется **СТРОГО** через `CREATE INDEX CONCURRENTLY`.
   - В Prisma стандартный `prisma migrate` оборачивает DDL в единую транзакцию (`BEGIN ... COMMIT`), что блокирует работу `CONCURRENTLY`. Требуется ручная миграция с флагом `--create-only` и вынесение создания индекса за пределы транзакционного блока.

---

## 2. Жесткие инварианты и табу (Hard Invariants & Anti-Patterns)

### Инвариант 1: Expand/Contract Lifecycle (Параллельный запуск версий)
> **ТАБУ:** Запрещено выполнять ломающие изменения схемы за один шаг (In-Place Breaking Migrations). База данных обязана одновременно поддерживать как текущую работающую версию приложения ($N$), так и новую развертываемую версию ($N+1$).

#### Практический пример: Миграция `Service.rate` (Float) на `Service.costKopecks` (BigInt)

#### Фаза 1 — Expand (Расширение схемы):
1. Добавляем в `prisma/schema.prisma` новое поле:
```prisma
model Service {
  id          String   @id @default(cuid())
  rate        Float    // Старое поле — пока сохраняем!
  costKopecks BigInt?  // Новое поле — строго Nullable на этапе Expand
  // ...
}
```
2. Генерируем безопасную миграцию SQL:
```sql
-- migration.sql
SET lock_timeout = '2s';
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "costKopecks" BIGINT;
```

#### Фаза 2 — Dual-Write (Двойная запись) в коде:
Код приложения обновляется: все операции создания и обновления сервисов пишут в ОБА поля:
```typescript
// Сервисный слой: Dual-Write
export async function updateServiceRate(serviceId: string, rateRub: number) {
  const kopecks = ExactMath.rublesToKopecks(rateRub);

  return await db.service.update({
    where: { id: serviceId },
    data: {
      rate: rateRub,           // Пишем в старое поле для совместимости с версией N
      costKopecks: kopecks,    // Пишем в новое поле для версии N+1
    },
  });
}
```

#### Фаза 3 — Фоновый батч-бэкфилл (Batch Backfill):
Фоновый скрипт с постраничным курсором переносит исторические данные, не блокируя СУБД:
```typescript
// scripts/migrations/backfill-service-cost-kopecks.ts
import { db } from '@/lib/db';
import { ExactMath } from '@/lib/financial/exact-math';

async function backfillServiceKopecks() {
  const BATCH_SIZE = 200;
  let cursor: string | undefined = undefined;
  let totalProcessed = 0;

  console.log('[Backfill] Запуск фоновой миграции Service.costKopecks...');

  while (true) {
    const services = await db.service.findMany({
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      where: { costKopecks: null },
      orderBy: { id: 'asc' },
      select: { id: true, rate: true },
    });

    if (services.length === 0) break;

    for (const s of services) {
      const kopecks = ExactMath.rublesToKopecks(s.rate);
      await db.service.update({
        where: { id: s.id },
        data: { costKopecks: kopecks },
      });
      totalProcessed++;
    }

    cursor = services[services.length - 1].id;
    console.log(`[Backfill] Обработано ${totalProcessed} записей...`);

    // Пауза 50ms между пачками для предотвращения всплеска CPU и отставания репликации WAL
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  console.log('[Backfill] Миграция успешно завершена!');
}
```

#### Фаза 4 — Switch Read & Contract (Переключение чтения и сжатие):
1. Чтение переключается строго на `costKopecks`.
2. Поле `rate` помечается `@ignore` в `schema.prisma`.
3. После полного вытеснения старого кода из всех контейнеров колонка удаляется отдельной миграцией:
```sql
SET lock_timeout = '2s';
ALTER TABLE "Service" DROP COLUMN IF EXISTS "rate";
```

---

### Инвариант 2: Non-Blocking Index Creation (`CREATE INDEX CONCURRENTLY`)
> **ТАБУ:** Категорически запрещено создавать B-Tree, GIN или GiST индексы обычной командой `CREATE INDEX` на живых таблицах базы данных OmniSMM.

Обычный `CREATE INDEX` захватывает блокировку `SHARE` на всю таблицу, запрещая любые операции вставки (`INSERT`), обновления (`UPDATE`) и удаления (`DELETE`) на все время сканирования и построения индексного дерева. На таблице `Order` с 500 000 строк это означает полный отказ платформы на 30–120 секунд.

#### ❌ ПЛОХО (Стандартный блокирующий индекс Prisma):
```sql
-- АНТИПАТТЕРН: Блокирует все операции записи на таблице Order!
CREATE INDEX "Order_tenantId_status_idx" ON "Order"("tenantId", "status");
```

#### ✅ ХОРОШО (Неблокирующий `CONCURRENTLY` с защитой от зависания):
1. Создаем миграцию в Prisma без применения:
```bash
npx prisma migrate dev --create-only --name add_order_tenant_status_concurrent_idx
```
2. Редактируем сгенерированный SQL-файл:
```sql
-- Отключаем транзакционность Prisma для CONCURRENTLY
-- prisma:no-transaction

-- Устанавливаем защитный таймаут ожидания лока
SET lock_timeout = '2s';
SET statement_timeout = '0'; -- Индекс строится в фоне, statement_timeout не должен его прерывать

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Order_tenantId_status_idx" 
ON "Order"("tenantId", "status");
```

---

### Инвариант 3: Safe NOT NULL & Foreign Key Addition
> **ТАБУ:** Запрещено выполнять `ALTER TABLE "Table" ADD COLUMN "col" TEXT NOT NULL` без дефолта или навешивать `FOREIGN KEY` напрямую на миллионные таблицы.

Прямое добавление `NOT NULL` на существующую таблицу требует полного сканирования таблицы для валидации (`ACCESS EXCLUSIVE` блокировка). Правильный подход разделяет создание ограничения и его валидацию.

#### ✅ Пошаговое безопасное добавление ограничений в PostgreSQL:
```sql
-- Шаг 1: Добавляем ограничение как NOT VALID (захватывает лок на доли миллисекунды)
SET lock_timeout = '2s';
ALTER TABLE "Order" 
ADD CONSTRAINT "check_order_cost_positive" 
CHECK ("costKopecks" > 0) NOT VALID;

-- Шаг 2: Валидируем ограничение без блокировки записи (SHARE UPDATE EXCLUSIVE)
-- Параллельные транзакции могут свободно читать и писать в таблицу!
ALTER TABLE "Order" 
VALIDATE CONSTRAINT "check_order_cost_positive";
```

Аналогично для внешних ключей (`FOREIGN KEY`):
```sql
SET lock_timeout = '2s';
ALTER TABLE "Order" 
ADD CONSTRAINT "fk_order_provider" 
FOREIGN KEY ("providerId") REFERENCES "Provider"("id") 
ON DELETE RESTRICT NOT VALID;

ALTER TABLE "Order" 
VALIDATE CONSTRAINT "fk_order_provider";
```

---

### Инвариант 4: Mandatory Lock Timeout & Statement Timeout Protection
> **ТАБУ:** Запрещено запускать любые DDL-скрипты без явной установки `SET lock_timeout = '2s';`.

**Анатомия катастрофы (Lock Queue Starvation):**
1. В фоне выполняется долгий аналитический запрос: `SELECT count(*) FROM "Order" WHERE ...` (работает 15 секунд). Он держит лок `ACCESS SHARE`.
2. Миграция пытается выполнить `ALTER TABLE "Order" ADD COLUMN ...`. Ей требуется лок `ACCESS EXCLUSIVE`.
3. Миграция встает в очередь ожидания за `SELECT`.
4. **Все последующие запросы** к таблице `Order` (даже простые быстрые `SELECT * FROM "Order" WHERE id = '123'`) встают в очередь **ПОЗАДИ МИГРАЦИИ**!
5. За 3–5 секунд пул соединений заполняется ждущими запросами. Все веб-страницы OmniSMM зависают.

#### ✅ Защитный барьер в начале любого миграционного скрипта:
```sql
-- Гарантия Fail-Fast: если лок не получен за 2 секунды, миграция падает,
-- освобождая очередь и не задевая пользовательский трафик!
SET lock_timeout = '2s';
SET statement_timeout = '10s';

-- Повтор можно выполнить через 5 минут в менее загруженный период
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phoneVerifiedAt" TIMESTAMP(3);
```

---

### Инвариант 5: Graceful Column Deprecation via Prisma `@ignore`
> **ТАБУ:** Запрещено удалять колонку из схемы базы данных до того, как код приложения перестанет генерировать SQL-запросы с упоминанием этой колонки.

При запуске запроса вида `prisma.user.findMany()` Prisma Client генерирует явный список колонок: `SELECT id, email, oldColumn FROM "User"`. Если колонка удалена из PostgreSQL, но хотя бы один запущенный инстанс приложения еще использует старый скомпилированный Prisma Client, все запросы `findMany` упадут с фатальной ошибкой `PostgresError: column "oldColumn" does not exist`.

#### Эталонный процесс вывода колонки из эксплуатации:
1. В `schema.prisma` помечаем удаляемое поле директивой `@ignore`:
```prisma
model User {
  id         String  @id @default(cuid())
  email      String
  legacyHash String? @ignore // Поле скрыто от генератора типов Prisma Client
}
```
2. Выполняем `npx prisma generate` и компилируем приложение. Prisma Client больше не запрашивает `legacyHash` в SQL `SELECT`.
3. Развертываем новый код на всех боевых серверах (Blue-Green Stage -> Production Cutover).
4. Убеждаемся, что старых версий контейнеров в сети нет.
5. Применяем миграцию, физически удаляющую колонку в СУБД:
```sql
SET lock_timeout = '2s';
ALTER TABLE "User" DROP COLUMN IF EXISTS "legacyHash";
```

---

## 3. Премортем-анализ и моделирование отказов (Failure Scenarios / Pre-Mortem)

| Сценарий отказа | Вероятность x Влияние | Механизм защиты в коде OmniSMM | Восстановление и самоисцеление |
| :--- | :---: | :--- | :--- |
| **1. Коллапс очереди блокировок (Lock Queue Starvation)**<br>DDL-запрос пытается захватить `ACCESS EXCLUSIVE` на таблице `Order`, блокируя все входящие заказы и вебхуки. | **Высокая x Катастрофическое** | Обязательная директива `SET lock_timeout = '2s';` перед любым DDL. Если таблица занята, миграция аварийно завершается через 2 секунды, не создавая пробку в пуле соединений. | Скрипт миграции завершается с ошибкой `55P03 lock_not_available`. Боевой сервис продолжает работу без единой секунды простоя. Миграция повторяется позже. |
| **2. Рассинхронизация при Dual-Write (Data Drift)**<br>Фоновый скрипт бэкфилла перезаписывает свежие данные, записанные пользователем в процессе миграции. | **Средняя x Высокое** | 1. Фильтр в бэкфилле строго по незаполненным строкам: `WHERE new_col IS NULL`.<br>2. Приоритет прямого апдейта из приложения над фоновым бэкфиллом. | Использование условного обновления в SQL: `UPDATE ... SET new_col = ... WHERE id = ... AND new_col IS NULL`. |
| **3. Подвисший индекс в статусе INVALID**<br>Команда `CREATE INDEX CONCURRENTLY` прервалась из-за ошибки уникальности или разрыва соединения, оставив битый индекс. | **Средняя x Среднее** | Индекс помечается PostgreSQL как `INVALID`. Он не используется оптимизатором, но замедляет `INSERT`/`UPDATE` и занимает диск. Чеклист требует проверки `pg_index.indisvalid`. | Запуск `DROP INDEX CONCURRENTLY IF EXISTS "broken_idx";` с последующим повторным созданием. |
| **4. Сбой старого контейнера при Blue-Green переключении**<br>Пользователь отправил запрос на старый контейнер в момент переключения, когда новая колонка еще не существовала или старая была удалена. | **Высокая x Высокое** | 1. Строгое следование принципу обратной совместимости (Backward Compatibility). Все новые колонки на этапе Expand строго Nullable.<br>2. Никаких удалений колонок до полного вывода старого кода. | Откат не требуется: схема на этапе Expand полностью валидна как для версии $N$, так и для версии $N+1$. |
| **5. Переполнение журнала WAL и лаг репликации при бэкфилле**<br>Бэкфилл миллиона строк одним запросом `UPDATE ... SET ...` забивает дисковый буфер и вызывает отставание реплики на десятки минут. | **Средняя x Высокое** | Батчинг по 200–500 записей с постраничным курсором по первичному ключу (`ORDER BY id ASC LIMIT 200`) и регулируемой паузой `sleep(50ms)` между пачками. | Репликация успевает применять WAL-сегменты в реальном времени. Нагрузка на диск и CPU стабильна. |

---

## 4. Чеклист верификации (Verification Checklist)

Перед слиянием Pull Request и применением миграции на боевом сервере оператор или AI-ассистент **ОБЯЗАН** выполнить данный чеклист:

### 4.1. Пре-флайт проверка DDL-скрипта (Pre-Flight Safety Review)
- [ ] В миграционном SQL-файле явно прописан таймаут: `SET lock_timeout = '2s';`.
- [ ] Отсутствуют деструктивные команды `ALTER TABLE RENAME COLUMN` или `ALTER TABLE RENAME TABLE`.
- [ ] Любое новое поле, добавляемое в существующую таблицу с миллионами строк, является `Nullable` (или имеет константный `DEFAULT` без вызова функций).
- [ ] Все индексы на таблицах объемом свыше 10 000 строк создаются строго с директивой `CONCURRENTLY` вне транзакционного блока (`-- prisma:no-transaction`).
- [ ] Новые ограничения (`CHECK`, `FOREIGN KEY`) добавляются с опцией `NOT VALID` и отдельной строкой `VALIDATE CONSTRAINT`.

### 4.2. Верификация в Stage-контуре (Port 3005)
- [ ] Миграция успешно применена в изолированном контейнере `smmplan_stage`:
  ```bash
  npx prisma migrate deploy
  ```
- [ ] Проверено отсутствие недействительных индексов:
  ```sql
  -- Проверка на наличие сломанных индексов после создания:
  SELECT 
    schemaname,
    relname,
    indexrelname,
    indisvalid
  FROM pg_stat_activity, pg_index
  JOIN pg_class ON pg_class.oid = pg_index.indexrelid
  JOIN pg_stat_user_indexes USING (indexrelid)
  WHERE NOT indisvalid;
  -- Ожидаемый результат: 0 строк.
  ```

### 4.3. Аудит блокировок и активности во время применения (Live Lock Inspection)
- [ ] В процессе выполнения миграции контролируется отсутствие очередей блокировок:
  ```sql
  -- Мониторинг заблокированных запросов в реальном времени
  SELECT 
    blocked_locks.pid     AS blocked_pid,
    blocked_activity.usename  AS blocked_user,
    blocking_locks.pid    AS blocking_pid,
    blocking_activity.usename AS blocking_user,
    blocked_activity.query    AS blocked_statement,
    blocking_activity.query   AS current_statement_in_blocking_process
  FROM  pg_catalog.pg_locks         blocked_locks
  JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
  JOIN pg_catalog.pg_locks         blocking_locks 
      ON blocking_locks.locktype = blocked_locks.locktype
      AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
      AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
      AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
      AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
      AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
      AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
      AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
      AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
      AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
      AND blocking_locks.pid != blocked_locks.pid
  JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
  WHERE NOT blocked_locks.granted;
  ```
- [ ] Экстренный протокол отмены: если миграция заблокировала критический процесс, немедленно выполнить:
  ```sql
  SELECT pg_cancel_backend(<blocking_pid>);
  -- или принудительно разорвать:
  SELECT pg_terminate_backend(<blocking_pid>);
  ```

---

## Пошаговый алгоритм выполнения (Step-by-step Protocol)
1. **Шаг 1:** Анализ контекста задачи и определение границ влияния.
2. **Шаг 2:** Проверка соответствия архитектурным инвариантам.
3. **Шаг 3:** Реализация изменений с соблюдением контрактов.
4. **Шаг 4:** Верификация через автоматические тесты и линтеры.
5. **Шаг 5:** Документирование и сохранение точки стабильности.
