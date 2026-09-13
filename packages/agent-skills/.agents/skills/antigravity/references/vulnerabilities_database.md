# База уязвимостей PostgreSQL

> **Содержание (TOC)**
> 1. [Топ уязвимостей по частоте (для быстрого аудита)](#топ-уязвимостей-по-частоте)
> 2. [Критические CVE (CVSS 9.0+)](#критические-cve)
> 3. [Высокие CVE (CVSS 7.0–8.9)](#высокие-cve)
> 4. [Средние CVE (CVSS 4.0–6.9)](#средние-cve)
> 5. [Уязвимости расширений](#уязвимости-расширений)
> 6. [Конфигурационные «уязвимости» (CWE)](#конфигурационные-уязвимости)
> 7. [Как сопоставлять версию с CVE](#как-сопоставлять-версию-с-cve)

---

## Топ уязвимостей по частоте

Эти 10 проблем встречаются в ~80% аудитов PostgreSQL. Если времени мало —
проверь их первыми.

| # | Проблема | CWE | Как проверить | Патч |
|---|----------|-----|---------------|------|
| 1 | `trust` в `pg_hba.conf` для удалённых подключений | CWE-287 | `grep trust pg_hba.conf` | Заменить на `scram-sha-256` |
| 2 | Порт 5432 открыт в интернет (0.0.0.0/0) | CWE-668 | `ss -tlnp \| grep 5432` | `listen_addresses = 'localhost'` + firewall |
| 3 | `password_encryption = md5` (или off) | CWE-916 | `SHOW password_encryption;` | `password_encryption = scram-sha-256` |
| 4 | `ssl = off` или самоподписанный сертификат без проверки | CWE-295 | `SHOW ssl;` + `SHOW ssl_ca_file;` | Включить TLS, настроить CA |
| 5 | Суперпользователь `postgres` используется приложением | CWE-250 | `SELECT usename FROM pg_stat_activity;` | Создать role app_user без SUPERUSER |
| 6 | `GRANT ALL ON *.* TO 'app_user'` | CWE-732 | `\dp+` + `information_schema.role_table_grants` | Минимальные GRANT на конкретные таблицы |
| 7 | Нет RLS на таблицах с PII | CWE-732 | `SELECT relrowsecurity FROM pg_class WHERE relname='users';` | `ALTER TABLE users ENABLE ROW LEVEL SECURITY;` |
| 8 | Установлены опасные расширения (`plpythonu`, `dblink`) без необходимости | CWE-913 | `SELECT * FROM pg_extension;` | `DROP EXTENSION plpythonu;` если не нужно |
| 9 | `log_statement = 'none'` (нет аудита DDL/DML) | CWE-778 | `SHOW log_statement;` | `log_statement = 'ddl'` + pgAudit |
| 10 | Устаревшая версия PostgreSQL (не применены security patches) | CWE-1104 | `SELECT version();` | Обновить до последнего minor release |

---

## Критические CVE

### CVE-2019-10164 — Stack-based Buffer Overflow via Password Setting

- **CVSS**: 9.8 (Critical, CVSS v3.x)
- **Версии**: PostgreSQL 10.x < 10.9, 11.x < 11.4 (затронуты ТОЛЬКО 10 и 11, не 9.x)
- **Описание**: Stack-based buffer overflow в `src/backend/libpq/auth.c` при
  обработке SCRAM-аутентификации. **Аутентифицированный** пользователь может
  создать переполнение стека, изменив свой пароль на специально сформированное
  длинное значение через `ALTER ROLE ... PASSWORD`.
- **Условие эксплуатации**: атакующий имеет любой валидный логин и право
  `ALTER ROLE ... PASSWORD` для своей роли (по умолчанию — да). На сервере
  включён SCRAM-SHA-256 (`password_encryption = scram-sha-256`).
- **Вектор**: Network, требуется аутентификация. Возможно RCE через
  переполнение стека.
- **Доказательство (PoC концепция)**: атакующий выполняет
  `ALTER ROLE attacker PASSWORD '<очень_длинная_строка_>_4кб';` —
  в `pg_be_scram_build_verifier` происходит переполнение stack-буфера.
- **Патч**: обновить PostgreSQL до ≥11.4 / ≥10.9.
- **Временная мера**: ограничить возможность `ALTER ROLE ... PASSWORD` только
  для DBA, временно переключить `password_encryption = md5` (но это снижает
  безопасность паролей).
- **Анти-пример**: «просто отключить SCRAM и оставить `trust` для локальных
  подключений» — это хуже исходной уязвимости.

### CVE-2019-10129 — Memory Disclosure in Partition Routing

- **CVSS**: 7.5 (High)
- **Версии**: PostgreSQL 11.x < 11.3 (только 11.x, не другие ветки)
- **Описание**: Memory disclosure в partition routing. Пользователь может
  прочитать произвольные байты памяти сервера, выполнив специально
  сформированный `INSERT` в partitioned table. Уязвимость в коде маршрутизации
  partition-строк.
- **Эксплуатация**: атакующий с любым валидным логином и правом `INSERT` на
  partitioned table выполняет запрос с некорректными типами колонок в
  partition — в результате может раскрыться память backend-процесса
  (потенциально содержащая чужие данные).
- **Патч**: обновить до ≥11.3.
- **Анти-пример**: «запретить INSERT на partitioned tables» — слишком строго,
  теряется функциональность. Только патч.

### CVE-2018-10925 — Authorization Check Bypass

- **CVSS**: 7.5 (High, CVSS v3.x) — НЕ 9.8 (Critical), как часто ошибочно пишут
- **Версии**: PostgreSQL до 10.5, 9.6.10, 9.5.14, 9.4.19, 9.3.24
- **Описание**: PostgreSQL некорректно проверял авторизацию на определённых
  типах объектов. Атакующий мог обойти intended access restrictions и
  прочитать sensitive данные из системных каталогов (включая `pg_authid`
  в некоторых конфигурациях). Это **НЕ** bypass аутентификации и **НЕ**
  empty password bypass — это authorization bypass после успешного логина.
- **Условие эксплуатации**: атакующий имеет любой валидный логин. Через
  специально сформированные запросы к системным catalog views может получить
  данные, к которым не должен иметь доступ.
- **Патч**: обновить до ≥10.5 / ≥9.6.10 / ≥9.5.14 / ≥9.4.19 / ≥9.3.24.
- **Защита**: применять principle of least privilege — даже после патча,
  минимизировать количество LOGIN-ролей.
- **Анти-пример**: «установить больше GRANT, чтобы перекрыть» — не работает,
  уязвимость в ядре PostgreSQL, не в GRANT-логике.

### CVE-2018-10926 — Row Security Bypass via Subtransaction

- **CVSS**: 8.8 (High)
- **Версии**: PostgreSQL 9.3 – 10.4
- **Описание**: RLS (Row Level Security) может быть обойдён через вложенные
  подтранзакции. Атакующий с правом SELECT на таблицу может прочитать строки,
  которые RLS-политика должна скрывать.
- **Эксплуатация**: через `BEGIN; SAVEPOINT s1; SELECT ...; ROLLBACK TO s1;`
  с specially crafted function.
- **Патч**: обновить до ≥10.5 / ≥9.6.10.
- **Анти-пример**: «включить RLS и забыть» — RLS не защита от determined
  attacker с привилегиями; всегда комбинируй с minimal GRANT.

### CVE-2016-2193 — RCE via `writeFile` in `pgadmin`

- **CVSS**: 8.8 (High)
- **Версии**: pgAdmin III 1.22 и ниже (не PostgreSQL core, но часто встречается
  в проектах).
- **Описание**: SQL-инъекция в pgAdmin позволяет RCE на клиентской машине
  администратора.
- **Патч**: обновить pgAdmin до ≥1.22.1 или заменить на pgAdmin 4.
- **Защита**: pgAdmin не должен быть установлен на production-сервере БД.

### CVE-2024-10977 — libpq Error Message MITM Injection

- **CVSS**: 5.9 (Medium, CVSS v3.x)
- **Версии**: libpq (клиентская библиотека) версий до 17.2, 16.6, 15.10, 14.15, 13.18, 12.22
- **Описание**: Client use of server error message in PostgreSQL allows a
  server not trusted under current SSL or GSS settings to furnish arbitrary
  non-NUL bytes to the libpq application. Если приложение использует libpq и
  обрабатывает сообщения об ошибках от сервера, MITM-атакующий может внедрить
  произвольные non-NUL байты в эти сообщения (например, ANSI escape sequences,
  HTML/JavaScript если ошибка выводится в веб-страницу).
- **Условие эксплуатации**: клиент использует `sslmode=prefer` или
  `sslmode=require` (без verify), что позволяет MITM. Атакующий перехватывает
  соединение и подменяет error message от сервера.
- **Вектор**: Network (MITM), не требует аутентификации.
- **Патч**: обновить libpq/psql/драйверы до ≥17.2 / ≥16.6 / ≥15.10 / ≥14.15 /
  ≥13.18 / ≥12.22.
- **Дополнительно**: на клиенте использовать `sslmode=verify-full` — это
  предотвращает MITM и делает эксплуатацию невозможной.
- **Анти-пример**: «фильтровать escape-последовательности в ошибке на стороне
  приложения» — не закрывает корневую причину. Только обновление libpq +
  `sslmode=verify-full`.

### CVE-2024-7348 — pg_dump TOCTOU Race Condition (RCE)

- **CVSS**: 8.8 (High, CVSS v3.x)
- **Версии**: PostgreSQL до 16.4, 15.8, 14.13, 13.16, 12.20
- **Описание**: Time-of-Check Time-of-Use (TOCTOU) race condition в `pg_dump`.
  Пользователь с правом `CREATE` может подменить relation (например, заменить
  таблицу на view или foreign table) в момент между проверкой и использованием
  в `pg_dump`. Это позволяет выполнить произвольные SQL-функции от имени
  пользователя, запускающего `pg_dump` (часто суперпользователя).
- **Условие эксплуатации**: атакующий имеет `CREATE` privilege на схему +
  возможность синхронизировать подмену relation во времени с запуском `pg_dump`.
- **Вектор**: Local/Network (требуется валидный логин с CREATE privilege).
- **Патч**: обновить `pg_dump` до ≥16.4 / ≥15.8 / ≥14.13 / ≥13.16 / ≥12.20.
- **Защита**: бэкапы всегда должны делаться с актуальной версией `pg_dump`,
  даже если сам сервер более старой версии. Ограничить `CREATE` privilege.
- **Анти-пример**: «запретить `CREATE` всем пользователям» — слишком строго;
  лучше обновить `pg_dump` и использовать `pg_dump` версии ≥ сервера.

### CVE-2024-4317 — Information Disclosure in pg_stats_ext

- **CVSS**: 4.3 (Medium, CVSS v3.x)
- **Версии**: PostgreSQL до 16.3, 15.7, 14.12, 13.15, 12.19 (включая все
  предыдущие минорные релизы 16.x / 15.x / 14.x / 13.x / 12.x)
- **Описание**: Missing authorization в системных views `pg_stats_ext` и
  `pg_stats_ext_exprs`. Непривилегированный пользователь может прочитать
  most common values и другую статистику из `CREATE STATISTICS` команд
  других пользователей. Это может раскрыть значения колонок (включая PII),
  для которых у атакующего нет прямого `SELECT` доступа.
- **Условие эксплуатации**: атакующий имеет любой логин в БД. На схеме есть
  `CREATE STATISTICS` на таблицах с чувствительными данными.
- **Вектор**: Network, требует аутентификации.
- **Патч**: обновить до ≥16.3 / ≥15.7 / ≥14.12 / ≥13.15 / ≥12.19. После
  обновления — запустить `ALTER VIEW pg_stats_ext OWNER TO pg_database_owner;`
  для применения исправления к существующим views (см. release notes).
- **Анти-пример**: «удалить всю extended statistics» — это снизит
  производительность query planner. Лучше патч + пересоздать views.

### CVE-2023-39417 — Heap Buffer Overflow in `pg_dump` / `pg_dumpall`

- **CVSS**: 7.8 (High)
- **Версии**: pg_dump до 16.0, 15.4, 14.9, 13.12, 12.16
- **Описание**: при обработке специального типа данных в архиве возможен
  heap overflow.
- **Эксплуатация**: атакующий создаёт таблицу с специально сформированными
  данными, которые при `pg_dump` (например, в задаче бэкапа) эксплуатируют
  уязвимость.
- **Патч**: обновить `pg_dump` до соответствующей минимальной версии.
- **Защита**: бэкапы всегда должны делаться с актуальной версией `pg_dump`.

### CVE-2022-1552 — Confused Deputy in `CREATE EXTENSION` with Trusted Extensions

- **CVSS**: 8.8 (High)
- **Версии**: PostgreSQL 14.0–14.2, 13.0–13.6
- **Описание**: «Trusted extensions» (расширения, которые может устанавливать
  не-суперпользователь с правом CREATE) могут злоупотреблять своими
  привилегиями из-за некорректной проверки контекста вызова.
- **Патч**: обновить до ≥14.3 / ≥13.7.
- **Защита**: проверить, кто может создавать расширения:
  ```sql
  SELECT rolname FROM pg_authid WHERE rolcreaterext OR rolsuper;
  ```

### CVE-2021-32027 — Integer Overflow in `INSERT ... ON CONFLICT`

- **CVSS**: 7.5 (High)
- **Версии**: PostgreSQL 13.0–13.2, 12.0–12.6, 11.0–11.11
- **Описание**: integer overflow в `INSERT ... ON CONFLICT ... DO UPDATE` с
  очень большим количеством строк может привести к崩溃 или потенциально к RCE.
- **Патч**: обновить до ≥13.3 / ≥12.7 / ≥11.12.

### CVE-2021-32028 — Server Side Request Forgery via `WHERE` Clause Statistics

- **CVSS**: 5.5 (Medium)
- **Версии**: PostgreSQL 13.0–13.2, 12.0–12.6, 11.0–11.11
- **Описание**: при определённых условиях планировщик мог делать нежелательные
  запросы к операционной системе через `WHERE`-статистику.

### CVE-2020-25694 — Connection String Injection via `postgresql://` URI

- **CVSS**: 8.8 (High)
- **Версии**: libpq (клиентская библиотека) всех версий до 13.0, 12.4, 11.9,
  10.14, 9.6.19, 9.5.23
- **Описание**: libpq некорректно обрабатывал URI вида
  `postgresql://user:pass@host/db?param=value`, позволяя инъекцию параметров
  соединения (например, `sslmode=disable` или `channel_binding=disable`).
- **Эксплуатация**: атакующий контролирует часть connection string (например,
  имя хоста из пользовательского ввода) — может отключить шифрование.
- **Патч**: обновить libpq / psql / драйверы.
- **Защита**: никогда не строить connection string конкатенацией. Использовать
  keyword=value с экранированием:
  ```python
  # Плохо:
  conn_str = f"postgresql://app:{password}@{user_input_host}/db"
  # Хорошо:
  import psycopg
  conn = psycopg.connect(host=user_input_host, user="app",
                         password=password, dbname="db", sslmode="verify-full")
  ```

### CVE-2020-25695 — Privilege Escalation via `REFRESH MATERIALIZED VIEW`

- **CVSS**: 8.8 (High)
- **Версии**: PostgreSQL 9.5 – 13.0
- **Описание**: материализованное представление, созданное суперпользователем
  и обновляемое обычным пользователем, может выполнить код от имени
  суперпользователя.
- **Патч**: обновить до ≥13.1 / ≥12.5 / ≥11.10 / ≥10.15 / ≥9.6.20 / ≥9.5.24.
- **Защита**: проверить материализованные представления и их владельцев:
  ```sql
  SELECT matviewname, matviewowner FROM pg_matviews;
  ```
  Убедиться, что владелец — НЕ суперпользователь, если обновляет обычный юзер.

### CVE-2020-25696 — Arbitrary Code Execution in `pg_dump` / `pg_dumpall`

- **CVSS**: 9.8 (Critical)
- **Версии**: pg_dump до 12.5, 11.10, 10.15, 9.6.20, 9.5.24
- **Описание**: malicious БД (или пользователь с правом CREATE) может
  эксплуатировать уязвимость в `pg_dump` для RCE на сервере, где запускается
  бэкап.
- **Вектор**: атакующий создаёт специально сформированные объекты в БД;
  администратор запускает `pg_dump` — RCE под учёткой администратора.
- **Патч**: обновить `pg_dump` до ≥12.5 / ≥11.10 / ≥10.15.
- **Защита**: бэкапы всегда должны делаться с актуальной версией `pg_dump`.

---

## Высокие CVE

### CVE-2019-10127 — Authentication Bypass via DNS CNAME

- **CVSS**: 8.1 (High)
- **Версии**: PostgreSQL 9.5 – 11.2 (все, где поддерживается GSSAPI)
- **Описание**: при использовании GSSAPI аутентификации и Kerberos, атакующий
  через DNS CNAME запись может перенаправить аутентификацию.
- **Патч**: обновить до ≥11.3 / ≥10.8 / ≥9.6.13.
- **Защита**: проверить, не используется ли GSSAPI в `pg_hba.conf` без нужды.

### CVE-2017-14798 — Memory Disclosure via `pg_combinebackup`

- **CVSS**: 7.5 (High)
- **Версии**: PostgreSQL 10
- **Описание**: раскрытие памяти процесса через специально сформированный
  backup-файл.
- **Патч**: обновить до ≥10.1.

### CVE-2017-8806 — Directory Traversal in `pg_basebackup`

- **CVSS**: 7.5 (High)
- **Версии**: PostgreSQL 9.3 – 10.0
- **Описание**: `pg_basebackup` позволяет path traversal через специально
  сформированные имена таблиц.
- **Патч**: обновить до ≥10.1 / ≥9.6.6 / ≥9.5.10 / ≥9.4.15 / ≥9.3.20.

### CVE-2016-5423 — Stack Buffer Overflow in `postgres` Signal Handler

- **CVSS**: 7.5 (High)
- **Версии**: PostgreSQL 9.0 – 9.5 (старые версии)
- **Описание**: stack-based buffer overflow в обработчике сигналов.
- **Патч**: обновить до ≥9.5.4 / ≥9.4.9 / ≥9.3.14 / ≥9.2.18 / ≥9.1.23.
- **Защита**: PostgreSQL < 9.5 — уже end-of-life, должен быть обновлён.

### CVE-2016-3068 — RCE via `pg_dump` with PL/pgSQL

- **CVSS**: 7.5 (High)
- **Версии**: PostgreSQL 9.0 – 9.5
- **Описание**: malicious пользователь с правом CREATE FUNCTION может внедрить
  код, который выполнится при `pg_dump`.
- **Патч**: обновить до ≥9.5.4.

### CVE-2015-5288 — Hash Collision DoS in `crypt-des`

- **CVSS**: 7.5 (High)
- **Версии**: PostgreSQL 9.0 – 9.4
- **Описание**: при использовании DES-crypt паролей возможен DoS через hash
  collisions.
- **Патч**: обновить + отключить DES-crypt (`password_encryption` не должен
  быть `off` или `crypt-des`).

---

## Средние CVE

### CVE-2023-39418 — `lo_export` Writes to Arbitrary Files

- **CVSS**: 6.5 (Medium)
- **Версии**: PostgreSQL до 16.0, 15.4, 14.9, 13.12, 12.16
- **Описание**: `lo_export()` может записать файл в произвольное место на
  файловой системе сервера, если пользователь контролирует имя файла.
- **Патч**: обновить до ≥16.0 / ≥15.4 / ≥14.9 / ≥13.12 / ≥12.16.
- **Защита**: запретить `lo_export` через REVOKE:
  ```sql
  REVOKE EXECUTE ON FUNCTION lo_export(oid, text) FROM PUBLIC;
  ```

### CVE-2022-2625 — Extension with Untrusted Languages Privilege Escalation

- **CVSS**: 6.5 (Medium)
- **Версии**: PostgreSQL 14.0–14.5, 13.0–13.8, 12.0–12.12, 11.0–11.17
- **Описание**: при использовании trusted extensions возможна эскалация
  привилегий, если расширение не корректно изолирует untrusted-языки.
- **Патч**: обновить до ≥14.6 / ≥13.9 / ≥12.13 / ≥11.18.

### CVE-2021-23214 — Man-in-the-Middle via `CONN_TYPE_ADMIN`

- **CVSS**: 5.9 (Medium)
- **Версии**: PostgreSQL 9.6 – 14.0
- **Описание**: MITM-атака возможна при определённых условиях в TLS-рукопожатии
  для административных соединений.
- **Патч**: обновить до ≥14.1 / ≥13.5 / ≥12.9 / ≥11.14 / ≥9.6.19.

### CVE-2020-1720 — ALTER TABLE Data Corruption with RLS

- **CVSS**: 4.4 (Medium)
- **Версии**: PostgreSQL 12.0–12.2
- **Описание**: `ALTER TABLE` на таблице с RLS может привести к повреждению
  данных.
- **Патч**: обновить до ≥12.3.

---

## Уязвимости расширений

Эти CVE относятся не к ядру PostgreSQL, а к популярным расширениям. Полный
список опасных расширений — в `extensions_security.md`.

### CVE-2020-17453 — RCE в `postgis` через `ogr_fdw`

- **CVSS**: 9.8 (Critical)
- **Описание**: SQL-инъекция в `postgis` при использовании `ogr_fdw` позволяет
  RCE.
- **Патч**: обновить PostGIS до ≥3.0.3 / ≥2.5.5 / ≥2.4.9.

### CVE-2019-10178 — RCE в `plv8` через `plv8.js`

- **CVSS**: 9.8 (Critical)
- **Описание**: использование устаревшей версии V8 в plv8 позволяет RCE.
- **Патч**: обновить plv8 до ≥2.3.15 / ≥3.0.0.

### CVE-2018-1000621 — RCE в `plpython` / `plperl` через untrusted язык

- **CVSS**: 9.8 (Critical)
- **Описание**: `plpythonu` и `plperlu` (untrusted) позволяют выполнить
  произвольный Python/Perl код от имени пользователя `postgres`.
- **Защита**: НЕ использовать untrusted languages в production. Если нужно —
  запускать PostgreSQL в jail/seccomp.

---

## Конфигурационные уязвимости

Эти проблемы не CVE, но CWE. Они возникают из-за некорректной конфигурации и
гораздо чаще приводят к инцидентам, чем CVE.

### CWE-732 — Incorrect Permission Assignment for Critical Resource

**Пример**: `data/` каталог PostgreSQL с правами 777.
```bash
# Проверка:
ls -la /var/lib/postgresql/15/main/
# Должно быть 700 для postgres:postgres
```
**Патч**:
```bash
sudo chown -R postgres:postgres /var/lib/postgresql/15/main
sudo chmod 700 /var/lib/postgresql/15/main
```

### CWE-287 — Improper Authentication

**Пример**: `trust` в `pg_hba.conf` для не-локальных подключений.
```
# Плохо:
host all all 0.0.0.0/0 trust
# Хорошо:
host all all 0.0.0.0/0 scram-sha-256
host all all ::/0 scram-sha-256
# Только локально можно trust:
local all postgres peer
```

### CWE-916 — Use of Password Hash With Insufficient Computational Effort

**Пример**: `password_encryption = md5`. MD5 — быстрый, перебор по rainbow
tables тривиален. SCRAM-SHA-256 использует PBKDF2 с 250+ итерациями.
```sql
-- Проверка:
SHOW password_encryption;
-- Должно быть: scram-sha-256
```

### CWE-295 — Improper Certificate Validation

**Пример**: клиент подключается с `sslmode=require` вместо `verify-full`.
`require` шифрует, но НЕ проверяет сертификат сервера → MITM возможен.
```bash
# Плохо:
psql "postgresql://user@host/db?sslmode=require"
# Хорошо:
psql "postgresql://user@host/db?sslmode=verify-full&sslrootcert=/etc/ssl/certs/pg-ca.pem"
```

### CWE-778 — Insufficient Logging

**Пример**: `log_statement = 'none'`, `log_connections = off`. Без логов
невозможно расследовать инцидент.
```sql
-- Проверка:
SHOW log_statement;
SHOW log_connections;
SHOW log_disconnections;
-- Должно быть:
-- log_statement = 'ddl' (минимум) или 'all' (для PCI DSS)
-- log_connections = on
-- log_disconnections = on
```

### CWE-1104 — Use of Unmaintained Third Party Components

**Пример**: PostgreSQL 9.6 в production в 2024+ году (EOL с 11.11.2021).
Без security patches. Любой новый CVE не будет закрыт.

### CWE-250 — Execution with Unnecessary Privileges

**Пример**: приложение подключается как `postgres` (суперпользователь).
Если приложение скомпрометировано, атакующий получает полный контроль над БД,
включая `COPY ... TO PROGRAM` для RCE.

### CWE-668 — Exposure of Resource to Wrong Sphere

**Пример**: `listen_addresses = '*'` + порт 5432 открыт в интернет на 0.0.0.0/0.
Это экспонирует БД всему интернету — любой сканер найдёт её за минуты.

---

## Как сопоставлять версию с CVE

### Шаг 1: Получить точную версию

```sql
SELECT version();
-- Пример вывода: PostgreSQL 15.4 on x86_64-pc-linux-gnu, compiled by gcc (Debian 10.2.1-6) 10.2.1 20210110, 64-bit
```

Версия `15.4` означает: major=15, minor=4. Minor release 4 был выпущен
2023-08-10. Текущий minor для 15 — 15.8 (на момент июля 2024). Значит, пропущены
4 minor-релиза, каждый из которых включает security fixes.

### Шаг 2: Проверить статус EOL

- PostgreSQL 9.5 — EOL с 11.02.2021
- PostgreSQL 9.6 — EOL с 11.11.2021
- PostgreSQL 10 — EOL с 10.11.2022
- PostgreSQL 11 — EOL с 09.11.2023
- PostgreSQL 12 — EOL с 14.11.2024
- PostgreSQL 13+ — поддерживаются (5 лет после major release)

Если версия EOL — это автоматически Critical-находка.

### Шаг 3: Сопоставить с security advisories

Источники:
1. https://www.postgresql.org/support/security/
2. https://www.cvedetails.com/vulnerability-list/vendor_id-1/product_id-575/Postgresql-Postgresql.html
3. NVD: https://nvd.nist.gov/vuln/search/results?query=postgresql

### Шаг 4: Сформировать находку

Шаблон:
```markdown
### FIND-XXX: Уязвимая версия PostgreSQL (CVE-YYYY-NNNNN)

**Severity**: Critical
**CWE**: CWE-1104
**CVE**: CVE-2024-7348 (CVSS 8.8)

**Описание**: Текущая версия PostgreSQL 15.3 уязвима к CVE-2024-7348
(pg_dump TOCTOU race condition — RCE под суперпользователем при бэкапе).
Уязвимость исправлена в 15.8.

**Доказательство**:
```
$ psql -c "SELECT version();"
PostgreSQL 15.3 on x86_64-pc-linux-gnu, ...
```

**Уязвимый компонент**: psql-клиент, используемый в скриптах резервного
копирования (`backup.sh`, строка 14: `pg_dump ... | psql ...`).

**Патч**:
```bash
# Debian/Ubuntu:
sudo apt update && sudo apt install postgresql-15=15.8-1.pgdg120+1
# RHEL/CentOS:
sudo dnf upgrade postgresql15-server
# Docker:
docker pull postgres:15.8
```

**Верификация**:
```bash
psql -c "SELECT version();" | grep "15.8"
```

**Комплаенс**: нарушено требование PCI DSS 6.3.1 (security patches в течение
1 месяца), ISO 27001 A.12.6.1 (management of technical vulnerabilities).

**Анти-пример**: НЕ пытайся «обойти» уязвимость, запретив `\copy` через RULES —
это не закрывает корневую причину (устаревший бинарник). Только обновление
пакета решает проблему.
```

---

## Связанные reference-файлы

- `authentication_security.md` — глубокий разбор аутентификации
- `authorization_rls.md` — RLS и привилегии
- `extensions_security.md` — уязвимости расширений с PoC
- `incident_response.md` — что делать, если CVE уже эксплуатирована
