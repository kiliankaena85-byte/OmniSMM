# Hardening postgresql.conf

> **Содержание**
> 1. [Принципы hardening](#принципы)
> 2. [Аутентификация и пароли](#auth)
> 3. [SSL/TLS](#ssl)
> 4. [Логирование](#logging)
> 5. [Memory и ресурсы](#resources)
> 6. [Replication](#replication)
> 7. [Препейд-загрузка расширений](#preload)
> 8. [Прочие опасные настройки](#dangerous)
> 9. [Шаблон безопасного postgresql.conf](#template)
> 10. [Чеклист](#чеклист)

---

## Принципы

1. **Default = insecure**. PostgreSQL по умолчанию настроен для разработки и
   удобства, не для безопасности. Все security-настройки нужно явно включить.
2. **Минимизируй attack surface**. Отключай неиспользуемые функции.
3. **Логи — твой друг**. Чем больше логов, тем быстрее обнаружение инцидента.
4. **Defense in depth**. Не полагайся на одну настройку.

---

## Auth

```conf
# Аутентификация паролем — SCRAM-SHA-256
password_encryption = scram-sha-256

# Крутим unix socket только в /var/run/postgresql
unix_socket_directories = '/var/run/postgresql'

# Запретить подключение через TCP с disable ssl
ssl = on

# Лимит подключений на роль (защита от DoS)
# (устанавливается через ALTER ROLE)
# ALTER ROLE app_user CONNECTION LIMIT 50;
```

### Анти-примеры

```conf
# ПЛОХО:
password_encryption = md5  # Устаревший
password_encryption = off  # Plain text! Катастрофа
listen_addresses = '*'  # Все интерфейсы без firewall
ssl = off  # Без TLS
unix_socket_directories = '/tmp'  # Любой может подключиться через /tmp
```

---

## SSL

```conf
ssl = on
ssl_ca_file = '/etc/postgresql/ssl/ca.pem'
ssl_cert_file = '/etc/postgresql/ssl/server.crt'
ssl_key_file = '/etc/postgresql/ssl/server.key'
ssl_crl_file = '/etc/postgresql/ssl/crl.pem'
ssl_min_protocol_version = 'TLSv1.2'
ssl_max_protocol_version = 'TLSv1.3'  # опционально
ssl_ciphers = 'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256'
ssl_prefer_server_ciphers = on
ssl_ecdh_curve = 'prime256v1:secp384r1:secp521r1'
ssl_passphrase_command = ''  # Если ключ без пароля — пусто
ssl_passphrase_command_supports_reload = off
```

### Права файлов

```bash
chmod 600 /etc/postgresql/ssl/server.key
chmod 644 /etc/postgresql/ssl/server.crt /etc/postgresql/ssl/ca.pem
chown postgres:postgres /etc/postgresql/ssl/*
```

---

## Logging

Минимум для аудита:

```conf
log_destination = 'stderr'
logging_collector = on
log_directory = 'log'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_rotation_age = 1d
log_rotation_size = 100MB
log_truncate_on_rotation = off  # Никогда не обрезать!
log_line_prefix = '%m [%p] %u@%d %h %a '  # timestamp, pid, user, db, host, app

# Что логировать:
log_connections = on
log_disconnections = on
log_statement = 'ddl'  # 'none' / 'ddl' / 'mod' / 'all'
                     # Для PCI DSS — 'all'
log_duration = off
log_min_duration_statement = 1000  # Логировать запросы > 1 сек
log_lock_waits = on
log_temp_files = 0  # Логировать все temp files
log_autovacuum_min_duration = 0  # Логировать все autovacuum

# Что НЕ логировать (privacy):
# Не логировать значения параметров в ошибках для sensitive operations
# (это сложно — pgaudit.log_parameter = off скрывает все параметры)
```

### Анти-примеры

```conf
# ПЛОХО:
log_statement = 'none'  # Нет аудита
log_connections = off  # Не видно, кто подключался
log_disconnections = off
log_line_prefix = ''  # Не видно, кто и откуда
log_truncate_on_rotation = on  # Уничтожаем историю!
```

### Дополнительный аудит через pgAudit

```conf
shared_preload_libraries = 'pgaudit'
pgaudit.log = 'write, ddl, role'  # INSERT/UPDATE/DELETE + DDL + GRANT/REVOKE
pgaudit.log_relation = on  # Разделять по таблицам
pgaudit.log_parameter = on  # Логировать параметры запросов
pgaudit.log_catalog = off  # Не логировать обращения к pg_catalog
pgaudit.log_client = off  # Не слать аудит клиенту
```

---

## Resources

```conf
# Лимиты памяти
shared_buffers = 4GB  # 25% от RAM сервера
effective_cache_size = 12GB  # 75% от RAM
work_mem = 64MB  # На операцию (sort, hash)
maintenance_work_mem = 1GB  # Для VACUUM, CREATE INDEX
max_connections = 100  # Реальный лимит; больше → чем выше риск DoS
# Использовать pgbouncer для pooling
```

### Защита от OOM

```conf
# Linux:
# vm.overcommit_memory = 2
# vm.overcommit_ratio = 90
# В /etc/sysctl.conf

# PostgreSQL:
max_connections = 100  # Каждое подключение = ~10MB
```

---

## Replication

```conf
# Physical replication:
wal_level = replica  # Или 'logical' для logical replication
max_wal_senders = 10
wal_keep_size = 1024  # MB, чтобы replica не отстала
hot_standby = on  # Для replica

# Replication slots (для предотвращения удаления WAL):
max_replication_slots = 10

# Archive:
archive_mode = on
archive_command = 'rsync -a %p backup-server:/wal-archive/%f'
# Проверять, что archive_command успешен
```

### Анти-примеры

```conf
# ПЛОХО:
wal_level = minimal  # Не поддерживает replication → нет бэкапов WAL
archive_mode = off  # Нет archive → потеря данных между backup-ами
max_wal_senders = 0  # Нет репликации, нет HA
```

---

## Preload

`shared_preload_libraries` — расширения, загружаемые при старте. Каждое
расширение — код в адресном пространстве postgres.

```conf
# Безопасные:
shared_preload_libraries = 'pgaudit, pg_stat_statements, pgcrypto'
# (pgcrypto обычно не нужно в preload, только в CREATE EXTENSION)

# Опасные (НЕ включать без необходимости):
# plpythonu — RCE
# dblink — SQLi as feature
# auto_explain — логирует все query plans (info disclosure)
```

### Анти-пример

```conf
# ПЛОХО:
shared_preload_libraries = 'plpythonu, dblink, auto_explain, pgaudit'
# plpythonu в preload = всегда загружен
```

---

## Опасные настройки

### `escape_string_warning` и `standard_conforming_strings`

```conf
# С 9.1+ по умолчанию:
standard_conforming_strings = on  # Backslash в '...' — literal
escape_string_warning = on  # Warn на backslash в '...'

# Если ВЫКЛЮЧИТЬ (off) — обратная совместимость со старым кодом, но:
# - SQLi через backslash-escaping снова возможен
# - 'O''Brien' и 'O\'Brien' — оба работают, и логика фильтрации усложняется
```

**Правило**: никогда не выключать.

### `bytea_output`

```conf
bytea_output = 'hex'  # Дефолт с 9+
# 'escape' — старый формат, уязвимый к некоторым парсер-багам
```

### `lo_compat_privileges`

```conf
lo_compat_privileges = off  # Дефолт с 9.0+
# Если on — large objects доступны всем (как в старых версиях)
# Никогда не включать в новых инсталляциях
```

### `array_nulls`, `backslash_quote`

```conf
backslash_quote = safe_encoding  # Только в безопасных кодировках
# Если on — backslash в строках = escape, открывает SQLi-вектор
```

### `default_transaction_read_only`

```conf
default_transaction_read_only = off  # Дефолт
# Если on — все транзакции read-only по умолчанию
# Полезно для replica, но не для primary
```

### `event_source`

```conf
event_source = 'PostgreSQL'  # Имя для Windows Event Log
# На Linux не используется
```

### `file_fdw_function_name`

Не настройка, но связано — при использовании file_fdw убедиться, что
функция-обработчик недоступна PUBLIC.

### `krb_server_keyfile`, `krb_caseins_users`

```conf
krb_server_keyfile = 'FILE:/etc/postgresql/krb5.keytab'
krb_caseins_users = off  # Если on — case-insensitive matching (обход через имена)
```

### `plpgsql.extra_errors`, `plpgsql.extra_warnings`

```conf
plpgsql.extra_errors = 'shadowed_variables'  # Полезно для dev
plpgsql.extra_warnings = 'shadowed_variables'
```

---

## Template

Минимальный безопасный `postgresql.conf` для PostgreSQL 15:

```conf
# ============================================================
# PostgreSQL 15 — secure baseline
# ============================================================

# ----- Connection / Auth -----
listen_addresses = '10.0.1.5'  # Конкретный IP, НЕ '*'
port = 5432
max_connections = 100
unix_socket_directories = '/var/run/postgresql'
unix_socket_permissions = 0777  # Дефолт; ограничить через pg_hba
unix_socket_group = ''

password_encryption = scram-sha-256
krb_server_keyfile = ''
db_user_namespace = off

# ----- SSL / TLS -----
ssl = on
ssl_ca_file = '/etc/postgresql/ssl/ca.pem'
ssl_cert_file = '/etc/postgresql/ssl/server.crt'
ssl_key_file = '/etc/postgresql/ssl/server.key'
ssl_crl_file = ''
ssl_min_protocol_version = 'TLSv1.2'
ssl_max_protocol_version = 'TLSv1.3'
ssl_ciphers = 'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256'
ssl_prefer_server_ciphers = on
ssl_ecdh_curve = 'prime256v1:secp384r1:secp521r1'

# ----- Memory -----
shared_buffers = 4GB
effective_cache_size = 12GB
work_mem = 64MB
maintenance_work_mem = 1GB
huge_pages = try

# ----- WAL / Replication -----
wal_level = replica
wal_log_hints = on
max_wal_senders = 10
max_replication_slots = 10
wal_keep_size = 1024
hot_standby = on
archive_mode = on
archive_command = 'rsync -a %p backup.internal:/wal-archive/%f'

# ----- Query planner (tune под своё железо) -----
random_page_cost = 1.1  # Для SSD
effective_io_concurrency = 200  # Для SSD
default_statistics_target = 100

# ----- Logging -----
log_destination = 'stderr'
logging_collector = on
log_directory = 'log'
log_filename = 'postgresql-%Y-%m-%d.log'
log_file_mode = 0600
log_rotation_age = 1d
log_rotation_size = 100MB
log_truncate_on_rotation = off
log_line_prefix = '%m [%p] %q%u@%d %h %a '

log_connections = on
log_disconnections = on
log_statement = 'ddl'
log_min_messages = warning
log_min_error_statement = error
log_min_duration_statement = 1000
log_lock_waits = on
log_temp_files = 0
log_autovacuum_min_duration = 0
log_checkpoints = on
log_restartpoints = on

# ----- Autovacuum -----
autovacuum = on
autovacuum_max_workers = 3
autovacuum_naptime = 1min
autovacuum_vacuum_threshold = 50
autovacuum_analyze_threshold = 50

# ----- Behaviour -----
standard_conforming_strings = on
escape_string_warning = on
backslash_quote = safe_encoding
bytea_output = 'hex'
lo_compat_privileges = off
default_transaction_read_only = off

# ----- Extensions (preload) -----
shared_preload_libraries = 'pgaudit, pg_stat_statements'

# pgAudit:
pgaudit.log = 'write, ddl, role'
pgaudit.log_relation = on
pgaudit.log_parameter = on
pgaudit.log_catalog = off

# pg_stat_statements:
pg_stat_statements.max = 10000
pg_stat_statements.track = all
track_activities = on
track_counts = on
track_io_timing = on

# ----- Misc -----
jit = off  # JIT может быть вектором Spectre-атак; off для security
          # (если нет hard real-time требований, on для производительности)
```

---

## Чеклист

- [ ] `password_encryption = scram-sha-256`
- [ ] `ssl = on`, `ssl_min_protocol_version = 'TLSv1.2'`
- [ ] `ssl_ciphers` — явный список сильных шифров
- [ ] `ssl_prefer_server_ciphers = on`
- [ ] `listen_addresses` — конкретный IP (не `*`)
- [ ] `log_connections = on`, `log_disconnections = on`
- [ ] `log_statement = 'ddl'` минимум (PCI DSS — `'all'`)
- [ ] `log_line_prefix` включает timestamp, pid, user, db, host, app
- [ ] `log_truncate_on_rotation = off` (сохранять историю)
- [ ] `archive_mode = on`, `archive_command` тестируется
- [ ] `wal_level = replica` минимум
- [ ] `shared_preload_libraries = 'pgaudit, pg_stat_statements'`
- [ ] `pgaudit.log = 'write, ddl, role'`
- [ ] `pgaudit.log_parameter = on` (для расследований)
- [ ] `standard_conforming_strings = on`
- [ ] `escape_string_warning = on`
- [ ] `backslash_quote = safe_encoding`
- [ ] `lo_compat_privileges = off`
- [ ] `bytea_output = 'hex'`
- [ ] `max_connections` реалистичный (не 1000)
- [ ] `shared_preload_libraries` не содержит plpythonu/plperlu/dblink
- [ ] Конфиг файл `chmod 644 postgres:postgres`
- [ ] Параметры memory подстроены под железо (shared_buffers = 25% RAM)
- [ ] `jit = off` для security-sensitive окружений (опционально)
- [ ] Все изменения в `postgresql.conf` тестируются на staging
- [ ] `SHOW ALL;` проверен после применения
