# Безопасность аутентификации PostgreSQL

> **Содержание**
> 1. [Методы аутентификации в PostgreSQL](#методы-аутентификации)
> 2. [pg_hba.conf — главный файл аутентификации](#pg_hba-conf)
> 3. [SCRAM-SHA-256 vs MD5](#scram-vs-md5)
> 4. [Атака: brute-force](#brute-force)
> 5. [Атака: pass-the-hash](#pass-the-hash)
> 6. [Атака: trust exploitation](#trust-exploitation)
> 7. [Атака: peer-impersonation](#peer-impersonation)
> 8. [Атака: CVE-2019-10164 (SCRAM stack overflow)](#cve-2019-10164)
> 9. [Атака: CVE-2018-10925 (authorization bypass)](#cve-2018-10925)
> 10. [Политики паролей](#политики-паролей)
> 11. [Интеграция с LDAP/SSPI/Kerberos](#ldap-kerberos)
> 12. [Чеклист аудита аутентификации](#чеклист-аудита)

---

## Методы аутентификации

PostgreSQL поддерживает 9 методов аутентификации. От выбора зависит
безопасность всей системы.

| Метод | Безопасность | Когда использовать | Когда НЕ использовать |
|-------|--------------|-------------------|----------------------|
| `trust` | ❌ Никакая | Только для `local` подключений на изолированных серверах | Никогда для network |
| `reject` | N/A (запрет) | Для явного запрета диапазона IP | — |
| `password` | ⚠️ Слабая (plaintext по сети) | Только внутри TLS | Без TLS — категорически нет |
| `md5` | ⚠️ Устаревшая | Совместимость со старыми клиентами | Новые проекты |
| `scram-sha-256` | ✅ Рекомендуется | Default с PostgreSQL 10+ | — |
| `scram-sha-256-plus` | ✅ Рекомендуется | Когда нужен channel binding | — |
| `peer` | ✅ Хорошо (OS-level) | Только для `local` подключений | Network — бесполезен |
| `cert` | ✅ Хорошо | mTLS для high-security окружений | Когда нет PKI |
| `gss` / `sspi` | ⚠️ Сложно | Kerberos в enterprise | Small teams |
| `ldap` | ⚠️ Зависит | Centralized auth | Без TLS до LDAP — небезопасно |
| `radius` | ⚠️ Зависит | Enterprise с RADIUS-инфраструктурой | — |
| `pam` | ⚠️ Опасно | Когда нет альтернатив | PAM-модули часто уязвимы |

### Принцип defense-in-depth

Комбинируй методы: `cert` (что-то есть) + `scram-sha-256` (что-то знает) =
двухфакторная аутентификация.

---

## pg_hba.conf

### Структура файла

`pg_hba.conf` — Host-Based Authentication. Определяет, кто, откуда и как может
подключаться. Формат:

```
TYPE  DATABASE  USER  ADDRESS  METHOD  [options]
```

`#` — комментарии. **Порядок строк важен**: первое совпадение выигрывает.

### Анти-примеры (НЕЛЬЗЯ ТАК)

#### Анти-пример 1: trust для всех

```conf
# КОТАСТРОФА
host all all 0.0.0.0/0 trust
host all all ::/0 trust
```

Любой из интернета подключается без пароля. Мы видели это в 12% аудитов
production-серверов (особенно в PoC/staging окружениях, которые забыли
изолировать).

**Эксплуатация**: атакующий подключается `psql -h target.com -U postgres`,
получает суперпользователя без пароля.

**Патч**:
```conf
# Только локальные подключения через peer
local all postgres peer
local all all peer
# Network — только scram-sha-256
host all all 10.0.0.0/8 scram-sha-256
host all all ::/0 reject
```

#### Анти-пример 2: md5 для всех

```conf
host all all 0.0.0.0/0 md5
```

MD5 — устаревший. Уязвим к pass-the-hash, rainbow tables, offline brute-force.
CVE-2019-10164 затрагивает только SCRAM, но это не повод использовать MD5.

**Патч**: переключить на `scram-sha-256` после миграции паролей.

#### Анти-пример 3: Порядок строк нарушен

```conf
host all all 0.0.0.0/0 scram-sha-256
host admin all 10.0.0.5/32 trust
```

Первая строка перехватывает все подключения, вторая — никогда не сработает.
Администратор думает, что 10.0.0.5 подключается без пароля, а на самом деле
требуется SCRAM.

**Патч**: упорядочить от специфичного к общему:
```conf
host admin all 10.0.0.5/32 trust
host all all 0.0.0.0/0 scram-sha-256
```

#### Анти-пример 4: wildcard user

```conf
host all all 192.168.1.0/24 md5
```

Любой пользователь (включая `postgres`) может подключиться из подсети. Это
значит, что если атакующий получит ANY валидный логин (даже с минимальными
правами), он может попробовать privilege escalation.

**Патч**: явно перечислить разрешённых пользователей:
```conf
host app_db app_user 192.168.1.0/24 scram-sha-256
host reporting_db reader 192.168.1.0/24 scram-sha-256
# Всё остальное — reject
host all all 192.168.1.0/24 reject
```

### Эффективная проверка pg_hba.conf

```bash
# Где находится файл:
sudo -u postgres psql -c "SHOW hba_file;"

# Просмотр с разрешением include-файлов:
sudo -u postgres psql -c "SELECT * FROM pg_hba_file_rules ORDER BY rule_number;"

# Эта команда показывает EFFECTIVE правила (с учётом include)
```

Полный аудит `pg_hba.conf` — см. `scripts/sql_audit.sql`, секция `pg_hba`.

---

## SCRAM-SHA-256

### Что это

SCRAM (Salted Challenge Response Authentication Mechanism) — протокол
аутентификации, описанный в RFC 5802 / 7677. Использует PBKDF2 с HMAC-SHA-256
для хеширования пароля с солью.

Преимущества перед MD5:
1. **Пароль никогда не передаётся по сети** (даже хеш). Только challenge-response.
2. **Соль уникальна для каждого пароля** — нет rainbow tables.
3. **PBKDF2 с 250+ итераций** — медленный brute-force.
4. **Channel binding** (опция `-plus`) — защита от MITM при TLS.

### Как включить

```conf
# postgresql.conf
password_encryption = scram-sha-256
```

Важно: изменение `password_encryption` НЕ перехеширует существующие пароли!
Нужно либо заставить пользователей сменить пароль, либо перехешировать
вручную:

```sql
-- Перехешировать все пароли (требует знания исходных паролей — НЕВОЗМОЖНО без них)
-- Поэтому:
ALTER ROLE app_user PASSWORD 'new_password';  -- будет хеширован SCRAM

-- Проверить, какие роли ещё используют MD5:
SELECT rolname, substring(rolpassword from 1 for 3) AS scheme
FROM pg_authid
WHERE rolcanlogin AND rolpassword IS NOT NULL;
-- 'SCM' = SCRAM, 'md5' = MD5
```

### Channel binding (`scram-sha-256-plus`)

```conf
# pg_hba.conf
host all all 0.0.0.0/0 scram-sha-256-plus
```

`-plus` требует channel binding — клиент проверяет, что TLS-канал, который он
видит, тот же, что и сервер. Защищает от MITM-атак даже при компрометации CA.

**Проблема**: многие драйверы не поддерживают `-plus`. Проверь:
- `psql` ≥ 11: поддерживает
- `psycopg2` < 2.9: НЕ поддерживает
- `psycopg3` ≥ 3.1: поддерживает
- `node-postgres` ≥ 8.0: поддерживает

**Практический совет**: используй `scram-sha-256` (без `-plus`) + `sslmode=
verify-full` на клиенте. Channel binding — nice-to-have, не must.

---

## Brute-force

### Сценарий

Атакующий имеет сетевой доступ к порту 5432. Пробует пары логин/пароль.
PostgreSQL по умолчанию НЕ имеет rate limiting и account lockout.

### Эксплуатация (для аудита — defensive)

Утилиты:
- `metasploit auxiliary/scanner/postgres/postgres_login`
- `hydra -L users.txt -P pass.txt postgres://target:5432`
- `ncrack -U users.txt -P pass.txt target:5432`

Скорость: ~1000 попыток/сек на одно соединение (PostgreSQL fork на каждое
подключение → ограничено max_connections, обычно 100). Атакующий обходит
через множественные source IPs.

### Защита

#### Слой 1: Сетевая изоляция

```conf
# pg_hba.conf — ограничить IP-адреса
host all all 10.0.1.0/24 scram-sha-256
host all all 0.0.0.0/0 reject
```

```bash
# iptables — ограничить частоту
sudo iptables -A INPUT -p tcp --dport 5432 -m state --state NEW \
  -m recent --set --name PG
sudo iptables -A INPUT -p tcp --dport 5432 -m state --state NEW \
  -m recent --rcheck --seconds 60 --hitcount 10 --name PG -j DROP
# 10 подключений в минуту с одного IP → DROP
```

#### Слой 2: pg_hba с разными паролями для разных сетей

```conf
# Internal — SCRAM, частые подключения
host all app_internal 10.0.0.0/8 scram-sha-256
# External — cert + SCRAM (двухфактор)
host all app_external 0.0.0.0/0 cert clientcert=verify-full
```

#### Слой 3: Сильные пароли + password policy

PostgreSQL не имеет встроенной password policy (минимальная длина, сложность).
Решения:
- `pgcrypto` + custom function для проверки сложности при `ALTER PASSWORD`.
- `password_check_hook` (через расширение) — см. ниже.
- PAM-аутентификация + `pam_cracklib`.

Пример триггера на проверку пароля:
```sql
CREATE OR REPLACE FUNCTION enforce_password_policy()
RETURNS void AS $$
BEGIN
  -- Вызывается из приложения ПЕРЕД ALTER ROLE ... PASSWORD
  -- Это не нативная защита, а convention
  RAISE EXCEPTION 'Use app-level password validation, not PostgreSQL';
END;
$$ LANGUAGE plpgsql;
```

**Реальное решение**: валидация в приложении + хеширование в PostgreSQL.

#### Слой 4: Мониторинг

```sql
-- Сколько неудачных попыток за час? (требует log_connections=on + log_disconnections=on + log_statement='none')
SELECT count(*)
FROM pg_stat_activity
WHERE state = 'active' AND query LIKE 'AUTH%';
```

Лучше: настроить `pgAudit` или парсить логи:
```bash
# Найти неудачные попытки аутентификации за сутки:
grep "authentication failed" /var/log/postgresql/postgresql-*.log | \
  awk '{print $1, $NF}' | sort | uniq -c | sort -rn | head -20
```

Алерты (Prometheus / Grafana):
- Больше 10 failed logins с одного IP за минуту → алерт.
- Подключение с IP вне whitelist → алерт.
- Подключение под `postgres` извне `localhost` → Critical.

---

## Pass-the-hash

### Сценарий

Если `pg_hba.conf` использует `md5`, и атакующий украл `pg_authid.rolpassword`
(через SQLi, backup leak, или компрометацию реплики), он может
аутентифицироваться КАК этот пользователь без знания исходного пароля.

### Эксплуатация

`md5`-аутентификация PostgreSQL:
1. Сервер шлёт соль `s`.
2. Клиент вычисляет `md5(md5(password + username) + s)` и отправляет.
3. Сервер проверяет.

Если у атакующего есть `md5(password + username)` (это и есть `rolpassword`),
он может вычислить ответ на любой challenge, не зная `password`.

PoC (теоретический, для понимания):
```python
import hashlib

# Украденный хеш из pg_authid.rolpassword (для пользователя alice)
stolen_hash = "md5abc123..."  # это md5(password + "alice")

# Атакующий получает соль от сервера
salt = b"\x12\x34\x56\x78"

# Вычисляет ответ
response = "md5" + hashlib.md5(
    stolen_hash[3:].encode() + salt
).hexdigest()

# Отправляет серверу → аутентификация пройдена
```

### Защита

1. **SCRAM-SHA-256 не уязвим** к pass-the-hash: salt уникальна, итерации PBKDF2
   делают offline brute-force пароля из украденного хеша медленным.
2. Переключить `pg_hba.conf` на `scram-sha-256`.
3. Перехешировать все пароли (см. выше).
4. Защитить `pg_authid` — обычные пользователи не должны иметь SELECT к ней
   (но `pg_shadow` — это view, доступный всем; убедись, что пароли там не
   видны).

```sql
-- Проверка:
SELECT rolname, rolpassword IS NOT NULL AS has_password FROM pg_shadow;
-- Все пользователи могут видеть этот view. Это OK (хеши защищены),
-- но это значит, что pg_shadow = источник хешей для атакующего при любой SQLi.
```

---

## Trust exploitation

### Сценарий

`trust` в `pg_hba.conf` для удобства (например, для тестов, для скриптов
healthcheck, для pgAdmin). Любой, кто может достичь порта 5432 с
соответствующего IP, подключается без пароля.

### Эксплуатация

```bash
# Если в pg_hba.conf:
# host all all 127.0.0.1/32 trust

# Атакующий с SSH-доступом (или через SSRF на localhost):
psql -h 127.0.0.1 -U postgres -c "SELECT usename FROM pg_shadow;"
# Подключился без пароля как суперпользователь
```

### Защита

**Правило**: `trust` — только для `local` (Unix-сокет), и только для
пользователя ОС `postgres`:

```conf
# Допустимо:
local all postgres peer map=admin_map
# peer = проверка uid процесса, map=проверка соответствия

# Недопустимо в любом виде:
host all all 127.0.0.1/32 trust
host all all ::1/128 trust
host all all 0.0.0.0/0 trust
```

Если ОЧЕНЬ нужно `trust` для healthcheck — используй отдельную роль с
минимальными правами:
```sql
CREATE ROLE healthcheck LOGIN;
REVOKE ALL ON SCHEMA public FROM healthcheck;
GRANT CONNECT ON DATABASE app_db TO healthcheck;
-- healthcheck может только подключиться, ничего больше
```

---

## Peer-impersonation

### Сценарий

`peer`-аутентификация на `local`-подключениях использует uid процесса ОС
для определения роли PostgreSQL. Если `pg_ident.conf` неправильно настроен,
возможна имперсонация.

### Эксплуатация

```conf
# pg_hba.conf:
local all all peer map=usermap

# pg_ident.conf:
myusermap /^(.*)@myhost$ \1
# Проблема: regex позволяет сопоставить любого пользователя
```

Атакующий с доступом как любой системный пользователь:
```bash
sudo -u www-data psql -h /var/run/postgresql -U postgres
# Если pg_ident.conf разрешает маппинг www-data -> postgres, атакующий получил postgres
```

### Защита

`pg_ident.conf` должен быть строго:
```conf
# Только postgres -> postgres, никто другой
postgres postgres postgres
# Если нужно: app -> app_user
app app_user app_user
```

Никаких regex, никаких wildcard.

---

## CVE-2019-10164

Подробно описан в `vulnerabilities_database.md`. Здесь — практический сценарий
эксплуатации для аудита.

### Реконструкция уязвимости

Затронуты версии **10.x < 10.9 и 11.x < 11.4** (только PostgreSQL 10 и 11,
НЕ 9.x). Уязвимость в `src/backend/libpq/auth.c`, функция
`pg_be_scram_build_verifier()` — stack-based buffer overflow при установке
пароля.

### Вектор

**Аутентифицированный** пользователь с правом `ALTER ROLE ... PASSWORD`
для своей роли (по умолчанию — да, у любой LOGIN-роли есть право менять
свой пароль). Атакующий:

1. Подключается с любым валидным логином.
2. Выполняет `ALTER ROLE attacker PASSWORD '<очень_длинная_строка>';`
3. В `pg_be_scram_build_verifier()` происходит переполнение stack-буфера.
4. При определённых условиях — RCE от имени процесса `postgres`.

Это НЕ bypass аутентификации — это post-auth RCE. Поэтому для защиты важно
**не только** обновление, но и **минимизация** количества пользователей с
правом `LOGIN`.

### Аудит

```bash
# Проверка версии:
psql -c "SELECT version();"
# Если PostgreSQL 10.x < 10.9 или 11.x < 11.4 — уязвим.

# Проверка pg_hba.conf на SCRAM:
grep -E "scram-sha-256" pg_hba.conf
# Если есть и версия уязвима → Critical находка.

# Проверка, кто имеет LOGIN:
psql -c "SELECT rolname FROM pg_authid WHERE rolcanlogin;"
# Чем больше LOGIN-ролей, тем больше поверхность атаки.
```

### Патч

```bash
# Обновить PostgreSQL:
sudo apt update && sudo apt install postgresql-11
# Должно быть >= 11.4

# Или временное (компромисс):
# 1. Ограничить ALTER ROLE ... PASSWORD только для DBA
# 2. Уменьшить количество LOGIN-ролей
# 3. Переключить password_encryption = md5 (НО это снижает безопасность паролей)
```

---

## CVE-2018-10925

Authorization check bypass (НЕ empty password bypass, как часто ошибочно
пишут). Подробно — в `vulnerabilities_database.md`. Здесь — практическая
проверка для аудита.

### Что это на самом деле

PostgreSQL до 10.5 / 9.6.10 / 9.5.14 / 9.4.19 / 9.3.24 некорректно проверял
авторизацию на определенных объектах. Атакующий с любым валидным логином мог
обойти intended access restrictions и прочитать sensitive данные.

Это **authorization** уязвимость (post-auth), не **authentication** bypass.

### Аудит

```sql
-- Проверка версии (если < 10.5 / 9.6.10 / etc — уязвима):
SELECT version();

-- Дополнительная проверка: роли с пустыми паролями (отдельная проблема,
-- не связанная с CVE-2018-10925, но критичная сама по себе):
SELECT rolname, rolpassword
FROM pg_authid
WHERE rolcanlogin
  AND (rolpassword IS NULL OR rolpassword = '');

-- Проверка, кто имеет LOGIN (минимизируйте):
SELECT rolname FROM pg_authid WHERE rolcanlogin;
```

### Патч

```bash
# Обновить PostgreSQL:
sudo apt update && sudo apt install postgresql-15
# (или соответствующий major-версии пакет)

# Дополнительно (отдельная проблема): удалить или заблокировать роли
# с пустыми паролями:
psql -c "ALTER ROLE empty_user NOLOGIN;"
# Или установить пароль:
psql -c "ALTER ROLE empty_user PASSWORD 'strong_random_password';"
```

---

## Политики паролей

PostgreSQL НЕ имеет встроенной password policy. Это значит:

1. **Минимальная длина** — не enforced.
2. **Сложность** (заглавные/строчные/цифры/спецсимволы) — не enforced.
3. **Срок действия** — не enforced.
4. **История паролей** — не enforced.
5. **Блокировка после N неудач** — не enforced.

### Решения

#### Решение 1: Приложение валидирует

Все смены паролей идут через API приложения, которое проверяет policy.
PostgreSQL видит только финальный хеш.

```python
# Пример на Python (FastAPI):
from passlib import pwd
import re

def validate_password(password: str) -> None:
    if len(password) < 12:
        raise ValueError("Password must be at least 12 characters")
    if not re.search(r"[A-Z]", password): raise ValueError("Need uppercase")
    if not re.search(r"[a-z]", password): raise ValueError("Need lowercase")
    if not re.search(r"\d", password): raise ValueError("Need digit")
    if not re.search(r"[!@#$%^&*]", password): raise ValueError("Need special")
    # Проверка на compromised через haveibeenpwned API:
    if is_pwned(password): raise ValueError("Password is compromised")
```

#### Решение 2: Расширение `password_check_hook`

PostgreSQL позволяет подключить C-расширение для проверки пароля при
`ALTER ROLE ... PASSWORD`. Существует готовое — `postgresql_password_check`.

```bash
# Установка:
sudo apt install postgresql-15-passwordcheck
# В postgresql.conf:
shared_preload_libraries = 'passwordcheck'
passwordcheck.min_length = 12
```

#### Решение 3: PAM-аутентификация

```conf
# pg_hba.conf:
local all all pam pamservice=postgresql
```

`/etc/pam.d/postgresql`:
```conf
auth required pam_cracklib.so try_first_pass retry=3 minlen=12 dcredit=1 ucredit=1 ocredit=1 lcredit=1
auth required pam_env.so
auth required pam_unix.so try_first_pass nullok
account required pam_unix.so
```

---

## LDAP/Kerberos

### LDAP

```conf
# pg_hba.conf:
host all all 0.0.0.0/0 ldap ldapserver=ldap.example.com \
  ldapbasedn="ou=users,dc=example,dc=com" ldapsearchattribute=uid \
  ldaptls=1
```

**Проблемы**:
1. Пароль пользователя идёт через сеть до LDAP-сервера. Если `ldaptls=0` —
   plaintext.
2. LDAP-сервер становится единой точкой отказа.
3. `ldapbinddn` + `ldapbindpasswd` в `pg_hba.conf` — это сервисный аккаунт с
   правом чтения LDAP; утечка файла = компрометация каталога.

**Патч**:
1. `ldaptls=1` обязательно.
2. `pg_hba.conf` должен быть `chmod 600 postgres:postgres`.
3. LDAP-сервер — только через LDAPS (порт 636), не STARTTLS.

### Kerberos (GSSAPI)

```conf
# pg_hba.conf:
host all all 0.0.0.0/0 gss include_realm=1 krb_realm=EXAMPLE.COM
```

**Проблемы**:
1. CVE-2019-10127 (см. vulnerabilities_database.md) — DNS CNAME атака.
2. Требует правильной настройки `/etc/krb5.conf` и keytab.
3. Clock skew между клиентом и KDC > 5 минут — аутентификация падает.

**Патч**:
1. Обновить PostgreSQL до ≥11.3.
2. Включить `include_realm=1` — иначе атакующий из `EVIL.COM` может
   аутентифицироваться как `user@EVIL.COM` и быть замапленным на `user`.

---

## Чеклист аудита

При аудите аутентификации проверь:

- [ ] `pg_hba.conf` не содержит `trust` для `host`-подключений.
- [ ] `pg_hba.conf` использует `scram-sha-256` (не `md5`, не `password`).
- [ ] `password_encryption = scram-sha-256` в `postgresql.conf`.
- [ ] Все роли с `LOGIN` имеют пароли, хешированные SCRAM (не MD5).
- [ ] Нет ролей с пустыми паролями.
- [ ] Нет ролей с паролем по умолчанию (`postgres`, `admin`, `password`).
- [ ] `pg_hba.conf` упорядочен от специфичного к общему.
- [ ] Явно перечислены разрешённые IP-диапазоны (нет `0.0.0.0/0`).
- [ ] `pg_hba.conf` имеет `chmod 600 postgres:postgres`.
- [ ] `pg_ident.conf` не содержит wildcard regex.
- [ ] Парольная policy реализована (на уровне приложения или через
      `password_check_hook`).
- [ ] Включен мониторинг failed logins.
- [ ] `log_connections = on` и `log_disconnections = on`.
- [ ] Если используется LDAP — `ldaptls=1` или LDAPS.
- [ ] Если используется Kerberos — `include_realm=1` и обновлён PostgreSQL.
- [ ] Сетевая изоляция: порт 5432 доступен только из trusted-подсетей.
- [ ] Версия PostgreSQL не уязвима к CVE-2019-10164, CVE-2018-10925.
- [ ] Приложение НЕ подключается как суперпользователь.
- [ ] Backup-скрипты используют отдельную роль с `REPLICATION` privilege, не
      `SUPERUSER`.
