# PostgreSQL 15+ & Redis 7 Container Memory Tuning

## 1. PostgreSQL 15+ в Docker: Расчет памяти и ловушки

PostgreSQL использует гибридную модель памяти: глобальная разделяемая память (`shared_buffers`) плюс динамическая локальная память на каждый процесс бэкенда (`work_mem`, `temp_buffers`).

### 1. Формула безопасного бюджета памяти:
$$\text{Max RAM} = \text{shared\_buffers} + (\text{work\_mem} \times \text{max\_connections} \times \text{operations}) + \text{maintenance\_work\_mem} + \text{OS Cache}$$

- `shared_buffers`: Рекомендуется **20–25%** от общего лимита памяти контейнера БД. Например, при контейнере 2GB выделять `512MB`.
- `work_mem`: Память для сортировок (`ORDER BY`), хэш-таблиц (`JOIN`), `DISTINCT`.
  - ⚠️ **КРИТИЧЕСКИЙ РИСК:** `work_mem` выделяется **на каждый узел в плане сложного запроса**! Один сложный SQL-запрос с 4 джойнами и сортировкой может потребовать $5 \times \text{work\_mem}$.
  - Если `max_connections = 100`, а `work_mem = 64MB`, то при пиковой нагрузке база попытается аллоцировать $100 \times 4 \times 64\text{MB} = 25.6\text{GB}$ RAM, что немедленно приведет к OOM-убийству контейнера!
  - **Безопасное значение для контейнера с 1–2GB RAM:** `work_mem = 4MB` – `8MB`.
- `maintenance_work_mem`: Память для операций `VACUUM`, `CREATE INDEX`. Безопасное значение: `64MB` – `128MB`.

### 2. Катастрофа `/dev/shm` (Shared Memory) в Docker:
По умолчанию Docker создает точку монтирования `/dev/shm` размером **всего 64MB**.
PostgreSQL 14+ активно использует POSIX shared memory для параллельного выполнения запросов (Parallel Sequential Scan, Parallel Hash Join). При превышении 64MB во время параллельного скана запрос падает с фатальной ошибкой `could not resize shared memory segment` или вызывает нестабильность рантайма.

**Решение в `docker-compose.yml`:**
```yaml
services:
  db:
    image: postgres:15-alpine
    shm_size: 256m # или 512m
    deploy:
      resources:
        limits:
          memory: 1536M
```

---

## 2. Redis 7 в Docker: Управление памятью и Copy-on-Write

Redis хранит весь набор данных в оперативной памяти.

### 1. Обязательные директивы `maxmemory` и `maxmemory-policy`
Если запустить Redis без директивы `maxmemory`, он будет забирать всю доступную память, пока ядро не убьет его через OOM Killer.

**Рекомендуемая конфигурация для платформы:**
```text
maxmemory 1024mb
maxmemory-policy volatile-lru
```

### Политики вытеснения (`maxmemory-policy`):
- `volatile-lru` (Рекомендуется для очередей и кэша с TTL): Удаляет наименее используемые ключи, у которых установлен TTL. Постоянные ключи и сессии не теряются.
- `allkeys-lru`: Удаляет любые наименее используемые ключи. Опасно, если в Redis хранятся постоянные сущности без TTL.
- `noeviction`: Возвращает ошибку `OOM command not allowed` при достижении лимита. Защищает данные от удаления, но блокирует новые операции записи.

### 2. Скрытая ловушка: Fork & Copy-on-Write (BGSAVE & AOF Rewrite)
При создании RDB-снимка (`save 60 1`) или перезаписи журнала AOF (`BGREWRITEAOF`) Redis вызывает системный вызов `fork()`, порождая дочерний процесс.

- Дочерний процесс разделяет страницы памяти с родительским процессом через механизм **Copy-on-Write (COW)**.
- Если в этот момент на платформу идет интенсивный поток заказов, апдейтов статусов или вебхуков, родительский процесс изменяет страницы памяти.
- Ядро Linux дублирует каждую измененную страницу в RAM.
- **В худшем случае:** Потребление памяти Redis **удваивается** на время фонового снимка!
- Если в Docker задан жесткий лимит `memory: 1G`, а Redis занимал 650MB, то во время BGSAVE суммарный объем COW превысит 1024MB, и **Redis будет убит ядром прямо посреди сохранения базы** (Exit Code 137).

**Защитные меры:**
1. Выставлять `maxmemory` не более **60%** от жесткого лимита Docker-контейнера Redis:
   - Лимит контейнера: `1536MB`.
   - `maxmemory` Redis: `1024MB`.
   - Буфер под Copy-on-Write: `512MB`.
2. На хосте Linux обязательно установить:
   ```bash
   sysctl vm.overcommit_memory=1
   ```
   (Предотвращает отказ `fork()` при нехватке формальной виртуальной памяти).
3. Включить активную дефрагментацию памяти:
   ```text
   activedefrag yes
   active-defrag-ignore-bytes 100mb
   active-defrag-threshold-lower 10
   active-defrag-threshold-upper 30
   ```
