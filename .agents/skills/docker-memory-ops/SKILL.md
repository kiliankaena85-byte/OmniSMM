---
name: docker-memory-ops
description: >
  Комплексное управление памятью, расследование OOM-инцидентов, диагностика cgroups v2
  и кризисный менеджмент контейнеров Docker. Используй этот скилл ВСЕГДА, когда пользователь
  упоминает Docker, docker-compose, падение контейнера, код ошибки 137, OOMKilled, утечку памяти
  (memory leak), лимиты RAM (--memory, --memory-reservation, --memory-swap), cgroups v2,
  расхождения в docker stats, PSI (Pressure Stall Information), жор памяти в Node.js/Next.js/PostgreSQL/Redis,
  проблемы с vmmem / ext4.vhdx в WSL2 на Windows, либо требует провести аудит или экстренную стабилизацию
  памяти в контейнерной среде. Скилл реализует строгий 4-фазный SRE-протокол: Детекция -> Локализация ->
  Глубокая форензика -> Долгосрочный харденинг.
---

# Docker Memory Ops & Crisis Management — Руководство оператора

## 1. Назначение и зона ответственности скилла

`docker-memory-ops` — это специализированный инженерный инструмент для дежурных инженеров, DevOps, SRE и разработчиков платформы OmniSMM. Скилл предназначен для:
- Предотвращения и мгновенного устранения инцидентов **Out of Memory (OOM Killer, Exit Code 137)**.
- Точной диагностики состояния памяти через подсистему **Linux cgroups v2** (`memory.events`, `memory.current`, `memory.high`, `memory.max`), минуя вводящие в заблуждение агрегаты `docker stats`.
- Тонкого тюнинга рантаймов внутри контейнеров: **Node.js 20+ / Next.js 16 (V8 Heap)**, **PostgreSQL 15+ (`shared_buffers`, `work_mem`, `/dev/shm`)**, **Redis 7 (`maxmemory`, Copy-on-Write при BGSAVE/AOF)**.
- Устранения проблем виртуализации хоста на **Windows / WSL2** (разрастание дисков `ext4.vhdx`, зависание `vmmem`, сброс `drop_caches`).
- Соблюдения принципов **Blue-Green Deployment (Rule 0.5)**: запрет деструктивных in-place перезапусков боевого контейнера `:3000` без локализации.

---

## 2. Когда применять и когда НЕ применять

### ✅ Применять ВСЕГДА:
1. Контейнер неожиданно остановился со статусом `Exited (137)` или `OOMKilled: true`.
2. Контейнер сильно тормозит (латентность ответов выросла в десятки раз) — подозрение на троттлинг памяти (`memory.high`).
3. Команда `docker stats` показывает высокий процент утилизации памяти или резкий неконтролируемый рост.
4. Проектируются или редактируются секции `deploy.resources.limits` и `deploy.resources.reservations` в `docker-compose.yml`.
5. Хост-машина (Linux или Windows/WSL2) исчерпала свободную RAM (`vmmem` потребляет 90%+ ОЗУ, Linux перешел в swap thrashing).
6. Требуется снять дамп кучи (Heap Snapshot) Node.js из работающего контейнера без его перезапуска.

### ❌ НЕ применять:
- Для настройки Kubernetes/OpenShift кластеров без Docker/Containerd среды.
- Для расследования сетевых блокировок (если они не вызваны падением сетевого прокси из-за OOM).

---

## 3. Четырехфазный SRE-протокол кризисного менеджмента

Любое расследование и реагирование на инцидент памяти ОБЯЗАНО следовать строгому 4-фазному протоколу.

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│ Фаза 1: Детекция│ ──> │Фаза 2: Локализац.│ ──> │Фаза 3: Форензика│ ──> │Фаза 4: Харденинг │
│ (137 vs 143,    │     │(Headroom, drop   │     │(V8 heap, dmesg, │     │(Golden Ratio RAM,│
│  cgroups events)│     │ caches, defrag)  │     │ copy-on-write)  │     │ compose limits)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘     └──────────────────┘
```

---

### Фаза 1 — Детекция и первичная классификация (Detection & Triage)

**Цель:** За 60 секунд однозначно определить причину падения или деградации контейнера.

1. **Проверка статуса завершения:**
   ```bash
   docker inspect <container_name_or_id> --format 'Status: {{.State.Status}} | ExitCode: {{.State.ExitCode}} | OOMKilled: {{.State.OOMKilled}} | FinishedAt: {{.State.FinishedAt}}'
   ```
   *Интерпретация кодов:*
   - `ExitCode: 137` и `OOMKilled: true` → **Ядро Linux убило процесс по превышению лимита cgroup (`memory.max`).**
   - `ExitCode: 137` и `OOMKilled: false` → **Процесс убит внешним сигналом `SIGKILL` (например, ручной `kill -9` или падение хостового OOM killer до того, как сработал cgroup).**
   - `ExitCode: 143` → **Плановое завершение по `SIGTERM` (штатная остановка или перезапуск Docker daemon).**
   - `ExitCode: 1` или `134` (SIGABRT) → **Падение самого приложения (например, необработанный V8 `JavaScript heap out of memory` до достижения жесткого лимита контейнера).**

2. **Проверка счетчиков событий cgroups v2 (`memory.events`):**
   ```bash
   # Поиск пути cgroup для контейнера
   CGROUP_PATH=$(docker inspect <container> --format '{{.Id}}')
   cat /sys/fs/cgroup/system.slice/docker-${CGROUP_PATH}.scope/memory.events 2>/dev/null || \
   cat /sys/fs/cgroup/docker/${CGROUP_PATH}/memory.events
   ```
   *Метрики:*
   - `oom_kill > 0`: Процессы внутри контейнера были физически уничтожены ядром.
   - `high > 0`: Контейнер превышал `memory.high` — ядро троттлило процессы и агрессивно принуждало к сбросу кешей.
   - `max > 0`: Были попытки аллокации за пределами `memory.max`.

3. **Экспресс-сканирование логов ядра хоста:**
   ```bash
   dmesg -T | grep -E -i "oom[-_]killer|killed process|out of memory" | tail -n 25
   ```

---

### Фаза 2 — Локализация и стабилизация (Containment & Relief)

**Цель:** Снять острое давление памяти на хосте и вернуть сервис в работоспособное состояние без потери данных.

1. **Экстренное высвобождение памяти хоста (Emergency Headroom):**
   Выполнить скрипт `scripts/emergency-mem-relief.sh` или вручную:
   ```bash
   # Безопасный сброс дискового page cache и slab (dentries/inodes) на Linux-хосте:
   sync && echo 3 > /proc/sys/vm/drop_caches
   ```

2. **Проверка и стабилизация Redis-буфера:**
   ```bash
   # Проверка используемой памяти и фрагментации в контейнере Redis:
   docker exec smmplan_lite_redis redis-cli info memory | grep -E "used_memory_human|used_memory_peak_human|mem_fragmentation_ratio"
   
   # Если фрагментация > 1.5, запуск активной дефрагментации на лету:
   docker exec smmplan_lite_redis redis-cli config set activedefrag yes
   ```

3. **Безопасный рестарт с соблюдением Blue-Green Isolation:**
   - ⚠️ **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО** перезапускать рабочий боевой контейнер `smmplan_app` «на лету» без проверки Stage-контура (`:3005`).
   - Для вспомогательных сервисов (worker, bot) допускается целевой рестарт:
     ```bash
     docker compose restart worker
     ```

---

### Фаза 3 — Глубокая форензика и поиск утечек (Deep Forensics)

Подробные инструкции для каждого компонента вынесены в `references/`:

1. **Node.js / Next.js 16 / TypeScript (App & Worker):**
   - *См. руководство:* [`references/node_nextjs_memory_optimization.md`](references/node_nextjs_memory_optimization.md).
   - *Действие:* Снятие Heap Snapshot на работающем процессе через `scripts/node-heap-snapshot.sh`.
   - *Частые причины:* Не закрытые инстансы PrismaClient, накопление задач в очередях BullMQ, утечки замыканий в Server Actions, SSR-кэширование больших объектов.

2. **PostgreSQL 15+:**
   - *См. руководство:* [`references/database_cache_memory_tuning.md`](references/database_cache_memory_tuning.md).
   - *Частые причины:* Превышение `work_mem * active_connections` при тяжелых сортировках, дефолтный объем `/dev/shm` (64MB) вызывающий SIGSEGV в параллельных запросах.

3. **Redis 7:**
   - *См. руководство:* [`references/database_cache_memory_tuning.md`](references/database_cache_memory_tuning.md).
   - *Частые причины:* Отсутствие `maxmemory-policy`, резкий всплеск RAM при форке (`BGSAVE`) из-за Copy-on-Write при интенсивной записи.

4. **Windows / WSL2 специфичные проблемы:**
   - *См. руководство:* [`references/wsl2_windows_docker_tuning.md`](references/wsl2_windows_docker_tuning.md).
   - *Действие:* Ограничение памяти в `.wslconfig`, сжатие виртуального диска через `scripts/compact-docker-vdisk.ps1`.

---

### Фаза 4 — Долгосрочный харденинг (Permanent Hardening & Sizing)

**Золотое правило конфигурирования памяти контейнера (The Golden Ratio):**

```
┌────────────────────────────────────────────────────────┐
│  Host RAM (100%)                                       │
│  ├── OS & Docker Daemon Reserve: 15-20%                │
│  └── Sum of all Containers `memory.max` ≤ 80% Host RAM │
└────────────────────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────────────────────┐
│  Container Allocation (На примере 1GB Hard Limit)      │
│  ├── memory.max (Hard Limit): 1024MB                   │
│  ├── memory.high / reservation (Soft): 800MB (80%)     │
│  ├── Node.js --max-old-space-size: 768MB (75%)         │
│  └── Kernel Page Cache / Buffers Headroom: 256MB (25%) │
└────────────────────────────────────────────────────────┘
```

1. **Формула V8 для Node.js в контейнерах:**
   $$\text{max-old-space-size} = \lfloor \text{Container Limit (MB)} \times 0.75 \rfloor$$
   *Пример:* Для лимита `1G` (1024MB) передавать `NODE_OPTIONS="--max-old-space-size=768"`.
   Это гарантирует, что сборщик мусора V8 начнет агрессивную фазу Mark-Sweep-Compact ДО того, как ядро Linux убьет контейнер по OOM!

2. **Защита от разрастания логов Docker:**
   В каждом сервисе `docker-compose.yml` ОБЯЗАТЕЛЕН log-driver с ротацией:
   ```yaml
   logging:
     driver: "json-file"
     options:
       max-size: "20m"
       max-file: "3"
   ```

---

## 4. Инструментарий скилла (Scripts & Tools)

Все скрипты расположены в подкаталоге `scripts/`:

| Скрипт | Платформа | Назначение |
| :--- | :--- | :--- |
| `scripts/docker-mem-audit.ps1` | Windows / PowerShell | Аудит использования памяти всех контейнеров, процент от лимитов, обнаружение рисков OOM. |
| `scripts/docker-mem-audit.sh` | Linux / Bash | Консольный аудит cgroups v2 (`memory.current`, `memory.high`, `memory.max`, `memory.events`). |
| `scripts/docker-oom-forensics.sh` | Linux / Bash | Автоматический криминалистический сбор данных по упавшему контейнеру (dmesg, inspect, events). |
| `scripts/node-heap-snapshot.sh` | Linux / Bash | Безопасная инициация и выгрузка V8 Heap Snapshot из рабочего контейнера. |
| `scripts/emergency-mem-relief.sh` | Linux / Bash | Экстренная очистка буферов ОС, активная дефрагментация Redis, ротация логов. |

---

## 5. Документация и справочники (References)

- [`cgroups_v2_memory_internals.md`](references/cgroups_v2_memory_internals.md) — Исчерпывающий разбор cgroups v2, метрик `memory.stat`, ловушки `docker stats` и PSI.
- [`oom_killer_forensics.md`](references/oom_killer_forensics.md) — Алгоритмы Linux OOM Killer, расчет `oom_badness`, расшифровка дампов `dmesg`.
- [`node_nextjs_memory_optimization.md`](references/node_nextjs_memory_optimization.md) — Тюнинг Node.js V8, Next.js 16 standalone, устранение утечек памяти в Prisma и очередях.
- [`database_cache_memory_tuning.md`](references/database_cache_memory_tuning.md) — Математика памяти PostgreSQL (shared_buffers, work_mem, /dev/shm) и Redis 7 (Copy-on-Write).
- [`wsl2_windows_docker_tuning.md`](references/wsl2_windows_docker_tuning.md) — Специфика Windows/WSL2, обуздание `vmmem`, сжатие `ext4.vhdx`.
- [`assets/memory_incident_runbook.md`](assets/memory_incident_runbook.md) — Пошаговый регламент дежурного инженера в условиях OOM-инцидента.
- [`assets/docker-compose.resilient-template.yml`](assets/docker-compose.resilient-template.yml) — Готовый шаблон конфигурации для боевого развертывания.
