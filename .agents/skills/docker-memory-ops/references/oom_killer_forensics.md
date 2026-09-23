# Linux OOM Killer Forensics & Incident Investigation

## 1. Как работает Linux OOM Killer

Когда физическая память и swap исчерпаны (на уровне всей системы или конкретной cgroup), функция ядра Linux `out_of_memory()` активирует OOM Killer.

### Алгоритм выбора жертвы (`oom_badness`):
Ядро обходит все доступные процессы и вычисляет число очков (`points`):

$$\text{points} = \text{RSS} + \text{swap\_pages} + \text{oom\_score\_adj}$$

Где:
- `RSS` (Resident Set Size): Количество страниц физической памяти, удерживаемых процессом.
- `swap_pages`: Количество страниц процесса, сброшенных в swap.
- `oom_score_adj`: Ручная корректировка приоритета от $-1000$ (полный запрет на убийство, используется для `systemd` и `sshd`) до $+1000$ (первоочередная жертва).

### OOM в Docker-контейнерах:
1. Docker daemon по умолчанию запускается с `oom_score_adj = -500`, защищая себя от случайного уничтожения ядром.
2. Контейнеры запускаются с `oom_score_adj = 0` (по умолчанию).
3. При локальном превышении лимита cgroup (`memory.max`) ядро ищет процесс с максимальным `badness` **СТРОГО внутри данной cgroup**.
4. В большинстве монолитных контейнеров (где запущен 1 процесс Node.js или Postgres) жертвой становится именно главный процесс (PID 1 внутри контейнера), что приводит к немедленной остановке контейнера.

---

## 2. Расшифровка кодов завершения (Exit Codes)

При падении контейнера всегда проверяйте:
```bash
docker inspect <container> --format 'ExitCode: {{.State.ExitCode}}, OOMKilled: {{.State.OOMKilled}}'
```

### Матрица кодов:
- **`Exit Code 137` ($128 + 9$ = SIGKILL):**
  - Если `OOMKilled: true` → 100% подтвержденный OOM Killer по лимиту cgroup.
  - Если `OOMKilled: false` → Процесс получил внешний `SIGKILL`. Причины:
    1. Хостовый OOM Killer (память закончилась на хосте целиком, и ядро убило процесс до того, как сработал локальный лимит контейнера).
    2. Таймаут остановки Docker (`docker stop` ждет 10 секунд после SIGTERM и посылает SIGKILL).
    3. Ручная команда администратора (`kill -9`).
- **`Exit Code 143` ($128 + 15$ = SIGTERM):**
  - Корректный graceful shutdown. Контейнер НЕ падал от нехватки памяти, а был штатно остановлен системой.
- **`Exit Code 1` или `134` ($128 + 6$ = SIGABRT):**
  - Падение внутри рантайма. Например, V8 Heap exhaustion (`FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory`).
  - Процесс сам вызвал `abort()` из-за превышения `--max-old-space-size`, при этом жесткий лимит Docker (`memory.max`) еще не был достигнут.

---

## 3. Криминалистический анализ логов `dmesg`

Если произошел OOM, ядро хоста оставляет подробный отчет в кольцевом буфере `dmesg`.

### Команда выборки инцидента:
```bash
dmesg -T | grep -A 35 -B 5 -E "Out of memory: Killed process"
```

### Пример вывода и его расшифровка:
```text
[Fri Sep 11 04:12:30 2026] node invoked oom-killer: gfp_mask=0x1100cca(GFP_HIGHUSER_MOVABLE), order=0, oom_score_adj=0
[Fri Sep 11 04:12:30 2026] CPU: 3 PID: 18452 Comm: node Not tainted 6.8.0-45-generic
[Fri Sep 11 04:12:30 2026] Hardware name: ...
[Fri Sep 11 04:12:30 2026] Call Trace:
[Fri Sep 11 04:12:30 2026]  dump_header+0x...
[Fri Sep 11 04:12:30 2026]  oom_kill_process+0x...
[Fri Sep 11 04:12:30 2026] memory: usage 1048576kB, limit 1048576kB, failcnt 412
[Fri Sep 11 04:12:30 2026] memory+swap: usage 1048576kB, limit 1048576kB, failcnt 0
[Fri Sep 11 04:12:30 2026] Tasks state (memory values in pages):
[Fri Sep 11 04:12:30 2026] [  pid  ]   uid  tgid total_vm      rss pgtables_bytes swapents oom_score_adj name
[Fri Sep 11 04:12:30 2026] [  18452]  1000 18452   452100   248100     3244032        0             0 node
[Fri Sep 11 04:12:30 2026] Out of memory: Killed process 18452 (node) total-vm:1808400kB, anon-rss:992400kB, file-rss:0kB, shmem-rss:0kB, UID:1000 pgtables:3168kB oom_score_adj:0
```

### Ключевые поля дампа:
1. `usage 1048576kB, limit 1048576kB` — cgroup уперлась ровно в 1024MB (1GB).
2. `failcnt 412` — ядро 412 раз пыталось запросить страницы памяти перед убийством.
3. `anon-rss:992400kB` — 992MB из 1024MB занято анонимной памятью приложения (куча Node.js).
4. `file-rss:0kB` — дисковый кеш уже полностью сброшен в 0, сбрасывать больше нечего.
5. `Killed process 18452 (node)` — подтверждение жертвы и её PID.

---

## 4. Сбор артефактов сразу после OOM

Если контейнер упал, выполните скрипт `scripts/docker-oom-forensics.sh` для создания единого архива расследования:
- JSON-выгрузка `docker inspect <container>`.
- Логи контейнера за последние 200 строк до краша (`docker logs --tail 200`).
- Вырезка из `dmesg` за временной интервал краша.
- Содержимое `/sys/fs/cgroup/.../memory.events` (если cgroup еще не удален).
