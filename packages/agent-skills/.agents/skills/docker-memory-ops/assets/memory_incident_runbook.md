# SRE On-Call Incident Runbook: Docker OOM & Memory Throttling

## 🚨 Срочный протокол действий дежурного инженера (Критический инцидент)

Используйте этот регламент при получении алертов:
- `Container OOMKilled` (Exit Code 137)
- `Container High Latency / Throttling` (`memory.high` saturation)
- `Host Memory Exhaustion` (vmmem > 90% / Linux Swap Thrashing)

---

### Шаг 1. Быстрый диагноз (0 – 2 минуты)

1. Определите упавший или деградирующий контейнер:
   ```bash
   docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.RunningFor}}'
   ```
2. Проверьте причину остановки:
   ```bash
   docker inspect <CONTAINER_NAME> --format 'Status: {{.State.Status}} | ExitCode: {{.State.ExitCode}} | OOMKilled: {{.State.OOMKilled}}'
   ```
   - **`ExitCode: 137` + `OOMKilled: true`** → Сработал жесткий лимит cgroup (`memory.max`).
   - **`ExitCode: 137` + `OOMKilled: false`** → Внешний SIGKILL (убийство хостом или таймаут остановки).
   - **`ExitCode: 134` / `1`** → Внутреннее падение рантайма (V8 Out of Memory / JS Heap).

3. Запустите скрипт форензики:
   ```bash
   bash .agents/skills/docker-memory-ops/scripts/docker-oom-forensics.sh <CONTAINER_NAME>
   ```

---

### Шаг 2. Немедленная стабилизация (2 – 5 минут)

1. **Если страдает хост (Windows/WSL2 или сервер Linux):**
   - На Linux сервере:
     ```bash
     sync && echo 3 > /proc/sys/vm/drop_caches
     ```
   - На Windows хосте (из PowerShell):
     ```powershell
     wsl -u root -e bash -c "sync && echo 3 > /proc/sys/vm/drop_caches"
     ```

2. **Если переполнен Redis:**
   ```bash
   docker exec smmplan_lite_redis redis-cli memory purge
   docker exec smmplan_lite_redis redis-cli config set activedefrag yes
   ```

3. **Восстановление контейнера:**
   - ⚠️ **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО** пересобирать рабочий прод на лету (Правило BGS-2026).
   - Для очередей/воркера:
     ```bash
     docker compose restart worker
     ```
   - Для приложения — проверить Stage `:3005`, затем безопасный рестарт.

---

### Шаг 3. Локализация источника утечки (5 – 15 минут)

1. **Для сервисов на Node.js (App / Worker / Bot):**
   - Проверьте флаг `--max-old-space-size` в переменных окружения (`NODE_OPTIONS`).
   - Если сервис еще жив, снимите дамп кучи:
     ```bash
     bash .agents/skills/docker-memory-ops/scripts/node-heap-snapshot.sh <CONTAINER_NAME>
     ```
   - Откройте сгенерированный `.heapsnapshot` файл в браузере Chrome:
     `F12 -> вкладка Memory -> кнопка Load`
   - Ищите объекты с максимальным **Retained Size** (обычно: `PrismaClient`, `Job` в BullMQ, не закрытые сокеты или стримы).

2. **Для PostgreSQL:**
   - Проверьте размер `/dev/shm`:
     ```bash
     docker exec smmplan_lite_db df -h /dev/shm
     ```
   - Проверьте активные тяжелые запросы:
     ```sql
     SELECT pid, now() - query_start AS duration, query 
     FROM pg_stat_activity 
     WHERE state = 'active' ORDER BY duration DESC;
     ```

---

### Шаг 4. Долгосрочное устранение (Post-Mortem & Fix)

1. Зафиксируйте формулу Golden Ratio в `docker-compose.yml`:
   - Hard Limit: `memory: 1G` (для App) / `memory: 512M` (для Worker).
   - Soft Limit: `reservations.memory: 768M`.
   - Рантайм: `NODE_OPTIONS="--max-old-space-size=768"`.
2. Убедитесь в наличии ротации логов (`max-size: 20m`).
3. Зафиксируйте инцидент в отчете Post-Mortem.
