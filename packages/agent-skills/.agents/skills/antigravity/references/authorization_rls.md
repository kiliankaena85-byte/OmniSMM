# Авторизация: роли, GRANT, RLS

> **Содержание**
> 1. [Модель привилегий PostgreSQL](#модель-привилегий)
> 2. [Роли и атрибуты](#роли-и-атрибуты)
> 3. [GRANT и REVOKE](#grant-revoke)
> 4. [PUBLIC — группа по умолчанию](#public)
> 5. [SEARCH_PATH и функции](#search-path)
> 6. [Row Level Security (RLS)](#rls)
> 7. [RLS-байпасы](#rls-bypasses)
> 8. [DEFAULT PRIVILEGES](#default-privileges)
> 9. [Privilege escalation через функции](#function-escalation)
> 10. [Чеклист аудита авторизации](#чеклист-аудита)

---

## Модель привилегий

PostgreSQL использует ACL (Access Control List) на каждый объект. Привилегии
есть на:
- Базы данных (`CONNECT`, `CREATE`, `TEMPORARY`)
- Схемы (`USAGE`, `CREATE`)
- Таблицы (`SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`,
  `TRIGGER`)
- Колонки (`SELECT`, `INSERT`, `UPDATE`, `REFERENCES`)
- Функции (`EXECUTE`)
- Процедуры (`EXECUTE`)
- Sequence (`USAGE`, `SELECT`, `UPDATE`)
- Foreign server, FDW, languages, types, large objects, schemas, tablespaces

**Принцип**: привилегии — гранулярные. Не «доступ к таблице», а «доступ к
SELECT на этих колонках этой таблицы в этой схеме».

---

## Роли и атрибуты

В PostgreSQL нет «пользователей» и «групп» — только роли. Роль с атрибутом
`LOGIN` может подключаться. Роль без `LOGIN` — это группа, в которую можно
входить через `GRANT group_role TO user_role`.

### Атрибуты

| Атрибут | Что даёт | Риск |
|---------|---------|------|
| `SUPERUSER` | Полный контроль над БД, обход RLS | Critical — никогда не давать приложению |
| `CREATEDB` | Создание БД | Low — но позволяет создать БД с custom owner |
| `CREATEROLE` | Создание ролей | Medium — можно создать роль с SUPERUSER (нет, нельзя без SUPERUSER) |
| `CREATEUSER` | Устаревший alias CREATEROLE | — |
| `REPLICATION` | Создание physical replication | High — даёт доступ к WAL, утечка данных |
| `BYPASSRLS` | Обход RLS | Critical — только для DBA |
| `CONNECTION LIMIT` | Лимит подключений | — |
| `LOGIN` | Может подключаться | — |
| `PASSWORD NULL` | Без пароля | Critical для LOGIN-ролей |

### Реконструкция ролей

```sql
-- Все роли с атрибутами:
SELECT rolname,
       rolsuper, rolcreaterole, rolcreatedb, rolcanlogin,
       rolreplication, rolbypassrls, rolconnlimit,
       rolvaliduntil
FROM pg_authid
ORDER BY rolname;

-- Члены каких ролей является каждая роль:
SELECT r.rolname AS role, m.rolname AS member, gm.admin_option
FROM pg_auth_members gm
JOIN pg_authid r ON r.oid = gm.roleid
JOIN pg_authid m ON m.oid = gm.member
ORDER BY r.rolname, m.rolname;

-- Срок действия пароля (если установлен):
SELECT rolname, rolvaliduntil
FROM pg_authid
WHERE rolcanlogin AND rolvaliduntil IS NOT NULL
ORDER BY rolvaliduntil;
```

### Анти-примеры

#### Анти-пример 1: приложение с SUPERUSER

```sql
CREATE ROLE app_user LOGIN SUPERUSER PASSWORD 'app_password';
```

Если приложение скомпрометировано → атакующий имеет:
- `COPY ... TO PROGRAM` для RCE на сервере.
- `CREATE EXTENSION` для установки любого кода.
- Чтение любых данных (обход RLS).
- Удаление БД, ролей, файлов.

**Патч**:
```sql
ALTER ROLE app_user NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
```

#### Анти-пример 2: бессрочный пароль

```sql
CREATE ROLE backup_user LOGIN REPLICATION PASSWORD 'backup_pass';
-- rolvaliduntil = NULL → бесконечно
```

Если пароль утечёт — его можно использовать годами.

**Патч**:
```sql
ALTER ROLE backup_user VALID UNTIL '2025-12-31';
-- И продлевать ежегодно с ротацией пароля
```

#### Анти-пример 3: CREATEROLE без ограничений

```sql
CREATE ROLE dev_lead LOGIN CREATEROLE PASSWORD '...';
```

С `CREATEROLE` (но без `SUPERUSER`) нельзя создать суперпользователя, но
можно:
- Создать роль с `LOGIN` и `BYPASSRLS` (если у dev_lead есть этот атрибут —
  нет, BYPASSRLS тоже требует SUPERUSER для выдачи).
- Создать роль с правом подключения к любой БД.
- Изменить пароль любой роли (через `ALTER ROLE ... PASSWORD`).

**Патч**: 
```sql
-- Минимальные права для dev_lead:
CREATE ROLE dev_lead LOGIN PASSWORD '...';
-- Если ОЧЕНЬ нужно дать создавать роли — только через SECURITY DEFINER функцию:
CREATE FUNCTION create_dev_role(p_name text, p_password text)
RETURNS void
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF current_user != 'dev_lead' THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', p_name, p_password);
END;
$$ LANGUAGE plpgsql;
REVOKE ALL ON FUNCTION create_dev_role FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_dev_role TO dev_lead;
```

---

## GRANT и REVOKE

### Синтаксис

```sql
-- На таблицу:
GRANT SELECT, INSERT, UPDATE (col1, col2) ON table_name TO role_name;
-- На схему:
GRANT USAGE, CREATE ON SCHEMA app_schema TO role_name;
-- На БД:
GRANT CONNECT, TEMPORARY ON DATABASE app_db TO role_name;
-- На функцию:
GRANT EXECUTE ON FUNCTION schema.func(args) TO role_name;
-- На sequence:
GRANT USAGE, SELECT ON SEQUENCE seq_name TO role_name;
-- Все таблицы в схеме:
GRANT SELECT ON ALL TABLES IN SCHEMA app_schema TO role_name;
```

### WITH GRANT OPTION

```sql
GRANT SELECT ON users TO manager_role WITH GRANT OPTION;
```

`manager_role` может выдать `SELECT ON users` другому. Это распространяет
привилегии вглубь и плохо контролируется.

**Правило**: никогда не давать `WITH GRANT OPTION` приложению.

### ALTER DEFAULT PRIVILEGES

```sql
ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA app_schema
  GRANT SELECT ON TABLES TO reader_role;
```

Все новые таблицы, созданные `app_owner` в `app_schema`, автоматически получат
`SELECT` для `reader_role`. Это позволяет не забывать GRANT-ы на новые таблицы.

**Анти-пример**:
```sql
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO PUBLIC;
```
`PUBLIC` — это «любой пользователь». `ALL` — все права. Катастрофа для любой
новой таблицы.

**Патч**:
```sql
-- Отозвать:
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC;
-- Назначить явно:
ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA app
  GRANT SELECT ON TABLES TO reader_role;
```

---

## PUBLIC

`PUBLIC` — псевдо-роль, в которую автоматически входят все пользователи.

По умолчанию `PUBLIC` имеет:
- `CONNECT` на все БД (созданные без явного REVOKE).
- `TEMPORARY` на все БД (создание temp tables).
- `EXECUTE` на все функции (CWE-732 — Critical в функциях с уязвимостями).
- `USAGE` на схему `public`.

### Аудит PUBLIC

```sql
-- Что PUBLIC может делать с базами:
SELECT datname, (aclexplode(datacl)).grantee, (aclexplode(datacl)).privilege_type
FROM pg_database
WHERE (aclexplode(datacl)).grantee = 0;  -- 0 = PUBLIC

-- Что PUBLIC может с функциями:
SELECT n.nspname, p.proname, (aclexplode(p.proacl)).privilege_type
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE (aclexplode(p.proacl)).grantee = 0;

-- Что PUBLIC может с схемами:
SELECT nspname, (aclexplode(nspacl)).privilege_type
FROM pg_namespace
WHERE (aclexplode(nspacl)).grantee = 0;
```

### Патч

```sql
-- Отозвать EXECUTE на опасные функции:
REVOKE EXECUTE ON FUNCTION lo_import(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION lo_export(oid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION pg_read_file(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION pg_read_file(text, bigint, bigint) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION pg_read_file(text, bigint, bigint, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION pg_ls_dir(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION pg_stat_file(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION pg_sleep(double precision) FROM PUBLIC;

-- Отозвать CREATE на схему public (иначе любой может создавать объекты):
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- Отозвать TEMPORARY на production-БД:
REVOKE TEMPORARY ON DATABASE app_db FROM PUBLIC;
```

---

## SEARCH_PATH

`search_path` определяет, в каких схемах PostgreSQL ищет объекты (таблицы,
функции, типы), если имя указано без схемы.

### Уязвимость

```sql
-- Допустим, search_path = '$user, public'
-- Пользователь app_user выполняет:
SELECT * FROM users WHERE id = 5;
-- PostgreSQL ищет 'users' сначала в схеме 'app_user', потом в 'public'

-- Если атакующий может создавать объекты в схеме 'app_user' (или текущей схеме):
CREATE SCHEMA app_user;
CREATE TABLE app_user.users (id int, password text);
INSERT INTO app_user.users VALUES (1, 'stolen');

-- Теперь SELECT * FROM users вернёт данные из app_user.users, а не из
-- ожидаемой схемы. Это может привести к утечке данных или подмене.
```

### Вариант с функциями

```sql
-- Функция без явной схемы:
SELECT my_function();

-- Атакующий создаёт:
CREATE FUNCTION public.my_function() RETURNS text AS $$
BEGIN
  -- Код выполняется от имени вызывающего (если не SECURITY DEFINER)
  -- или от имени владельца (если SECURITY DEFINER)
  RETURN current_user;
END;
$$ LANGUAGE plpgsql;

-- Если функция вызывается через SECURITY DEFINER суперпользователем,
-- атакующий получает SUPERUSER исполнение своего кода.
```

### Защита

1. **Всегда указывай схему** в SQL-коде:
   ```sql
   SELECT * FROM app_schema.users WHERE id = 5;
   ```

2. **Устанавливай `search_path`** для каждой роли:
   ```sql
   ALTER ROLE app_user SET search_path = app_schema, pg_temp;
   -- НЕ включает public!
   ```

3. **В функциях** всегда используй `SET search_path`:
   ```sql
   CREATE FUNCTION app_schema.get_user(p_id int) RETURNS text
   SECURITY DEFINER
   SET search_path = app_schema, pg_temp  -- ЯВНО
   AS $$
   BEGIN
     -- Внутри функции search_path гарантированно app_schema, pg_temp
     SELECT name FROM users WHERE id = p_id;
   END;
   $$ LANGUAGE plpgsql;
   ```

4. **Отозвать CREATE на public** (см. выше), чтобы пользователь не мог создать
   таблицу с тем же именем в public.

5. **Проверять search_path в коде**: для SECURITY DEFINER функций
   обязательно `SET search_path` — это защита от подмены.

---

## RLS

Row Level Security позволяет ограничить, какие строки таблицы видит
пользователь, на основе политики.

### Включение

```sql
-- Создать таблицу:
CREATE TABLE orders (
  id serial PRIMARY KEY,
  user_id int NOT NULL,
  amount numeric(10,2),
  description text
);

-- Включить RLS:
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Создать политику (по умолчанию DENY ALL):
CREATE POLICY orders_select_own ON orders
  FOR SELECT
  USING (user_id = current_setting('app.current_user_id')::int);

-- Теперь SELECT * FROM orders вернёт только строки,
-- где user_id = значению, установленному приложением.
```

### FORCE RLS

```sql
ALTER TABLE orders FORCE ROW LEVEL SECURITY;
```

Без `FORCE`: владелец таблицы видит все строки (RLS не применяется).
С `FORCE`: RLS применяется даже к владельцу. Это полезно, если таблицей владеет
суперпользователь или сервис-аккаунт, который не должен видеть все данные.

### Переменные и контекст

```sql
-- Приложение устанавливает контекст пользователя:
SET app.current_user_id = 42;

-- RLS-политика использует это значение.
-- Но: SET LOCAL survives в транзакции, SET — нет.
-- Лучше:
SET LOCAL app.current_user_id = 42;
```

### Анти-примеры RLS

#### Анти-пример 1: забыли FORCE

```sql
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
-- Без FORCE владелец таблицы видит всё.
-- Если владельцем является app_user (а так и есть, ведь он создал таблицу),
-- то RLS НЕ работает для приложения!
```

**Патч**:
```sql
ALTER TABLE orders FORCE ROW LEVEL SECURITY;
-- Теперь RLS применяется и к владельцу.
```

#### Анти-пример 2: USING без WITH CHECK

```sql
CREATE POLICY orders_modify ON orders
  FOR ALL
  USING (user_id = current_setting('app.current_user_id')::int);
```

`USING` применяется для `SELECT`, `UPDATE`, `DELETE`. Но для `INSERT` и
`UPDATE ... SET` нужно `WITH CHECK`. Без него:
```sql
-- Пользователь может сделать:
INSERT INTO orders (user_id, amount) VALUES (999, 1000000);
-- Вставил строку от имени другого пользователя!
-- А потом SELECT не вернёт её (USING), но строка есть в БД.
```

**Патч**:
```sql
CREATE POLICY orders_modify ON orders
  FOR ALL
  USING (user_id = current_setting('app.current_user_id')::int)
  WITH CHECK (user_id = current_setting('app.current_user_id')::int);
```

#### Анти-пример 3: утечка через FOREIGN KEY

```sql
CREATE TABLE orders (id serial, user_id int, amount numeric);
CREATE TABLE order_items (
  id serial, order_id int REFERENCES orders(id),
  product text, qty int
);

-- RLS на orders, но НЕ на order_items:
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY orders_own ON orders FOR SELECT USING (user_id = current_user_id);

-- Атакующий:
SELECT * FROM order_items WHERE order_id NOT IN (
  SELECT id FROM orders
);
-- Возвращает order_items, принадлежащие другим пользователям,
-- потому что order_items не защищён RLS.
```

**Патч**: включить RLS на ВСЕ таблицы, связанные через FK.

#### Анти-пример 4: RLS bypass через функцию

```sql
-- Атакующий с правом CREATE FUNCTION (в схеме public):
CREATE FUNCTION leak_orders() RETURNS setof orders AS $$
  SELECT * FROM orders;  -- эта функция выполняется от имени владельца
$$ LANGUAGE sql SECURITY DEFINER;

-- Если владелец функции — это BYPASSRLS роль или владелец таблицы без FORCE,
-- вызов leak_orders() вернёт ВСЕ строки.
```

**Патч**:
1. `ALTER TABLE orders FORCE ROW LEVEL SECURITY` (RLS применяется даже к
   владельцу).
2. Запретить SECURITY DEFINER функциям обращаться к RLS-защищённым таблицам.
3. `REVOKE CREATE ON SCHEMA public FROM PUBLIC` — атакующий не может создать
   функцию в public.
4. Создать отдельную схему `app_functions`, дать `CREATE` только доверенным
   ролям.

#### Анти-пример 5: текущий пользователь подменяется

```sql
-- Приложение устанавливает:
SET app.current_user_id = 42;

-- Но если атакующий может выполнить SQL (через SQLi), он может:
SET app.current_user_id = 1;  -- подменить на любого
SELECT * FROM orders;  -- видит чужие заказы
```

**Патч**: использовать session_user / current_user, а не custom-переменную:
```sql
-- Если пользователи соответствуют ролям PostgreSQL:
CREATE POLICY orders_own ON orders
  FOR SELECT
  USING (user_id = (
    SELECT user_id FROM app_users WHERE rolename = session_user
  ));

-- Или: использовать SET через SECURITY DEFINER функцию:
CREATE FUNCTION app.set_user_context(p_user_id int) RETURNS void
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  -- Проверка, что вызывающий — это приложение
  IF current_user != 'app_user' THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  PERFORM set_config('app.current_user_id', p_user_id::text, true);
END;
$$ LANGUAGE plpgsql;
```

---

## DEFAULT PRIVILEGES

`ALTER DEFAULT PRIVILEGES` — это настройки по умолчанию для новых объектов.
Безопасные defaults критичны, иначе каждая новая таблица будет публично
доступна.

### Аудит

```sql
-- Текущие DEFAULT PRIVILEGES:
SELECT
  n.nspname AS schema,
  pg_catalog.pg_get_userbyid(d.defaclrole) AS owner,
  CASE d.defaclobjtype
    WHEN 'r' THEN 'table'
    WHEN 'S' THEN 'sequence'
    WHEN 'f' THEN 'function'
    WHEN 'T' THEN 'type'
    WHEN 'n' THEN 'schema'
  END AS object_type,
  pg_catalog.aclexplode(d.defaclacl) AS acl
FROM pg_catalog.pg_default_acl d
JOIN pg_catalog.pg_namespace n ON n.oid = d.defaclnamespace;
```

### Безопасная конфигурация

```sql
-- Все новые таблицы app_owner в app_schema:
-- Дают SELECT reader_role
ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA app_schema
  GRANT SELECT ON TABLES TO reader_role;
-- И INSERT, UPDATE, DELETE для app_user
ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA app_schema
  GRANT INSERT, UPDATE, DELETE ON TABLES TO app_user;
-- USAGE на sequences для app_user
ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA app_schema
  GRANT USAGE ON SEQUENCES TO app_user;
-- EXECUTE на функции для app_user
ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA app_schema
  GRANT EXECUTE ON FUNCTIONS TO app_user;

-- УБЕДИТЬСЯ, что нет:
-- ALTER DEFAULT PRIVILEGES ... GRANT ... TO PUBLIC;
```

---

## Function escalation

`SECURITY DEFINER` функции выполняются от имени владельца функции, а не
вызывающего. Это аналог SUID-бита в Linux.

### Уязвимость

```sql
CREATE FUNCTION get_admin_email() RETURNS text
SECURITY DEFINER
AS $$
DECLARE
  result text;
BEGIN
  SELECT email INTO result FROM users WHERE role = 'admin' LIMIT 1;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Проблема: search_path не задан!
-- Атакующий:
CREATE SCHEMA evil;
CREATE TABLE evil.users (email text, role text);
INSERT INTO evil.users VALUES ('attacker@evil.com', 'admin');

SET search_path = evil, public;
SELECT get_admin_email();
-- Вернёт 'attacker@evil.com', потому что функция искала users в evil-схеме
```

Хуже: если функция делает `EXECUTE` с пользовательским вводом — это RCE.

### Защита

1. **Всегда** `SET search_path` в SECURITY DEFINER:
   ```sql
   CREATE FUNCTION get_admin_email() RETURNS text
   SECURITY DEFINER
   SET search_path = app_schema, pg_temp
   AS $$ ... $$;
   ```

2. **Минимизировать SECURITY DEFINER**. Если можно SECURITY INVOKER — используй.

3. **Валидировать ввод**:
   ```sql
   CREATE FUNCTION get_user(p_id int) RETURNS text
   SECURITY DEFINER
   SET search_path = app_schema, pg_temp
   AS $$
   BEGIN
     IF p_id IS NULL OR p_id < 1 OR p_id > 1000000 THEN
       RAISE EXCEPTION 'Invalid id';
     END IF;
     -- ...
   END;
   $$ LANGUAGE plpgsql;
   ```

4. **REVOKE EXECUTE FROM PUBLIC**, явно GRANT нужным ролям:
   ```sql
   REVOKE EXECUTE ON FUNCTION get_admin_email() FROM PUBLIC;
   GRANT EXECUTE ON FUNCTION get_admin_email() TO app_user;
   ```

5. **Использовать `SECURITY INVOKER` view** (PostgreSQL 15+) вместо SECURITY
   DEFINER функций, где возможно.

---

## Чеклист аудита

- [ ] Никакая роль приложения не имеет `SUPERUSER`.
- [ ] Никакая роль приложения не имеет `BYPASSRLS`.
- [ ] Никакая роль приложения не имеет `CREATEROLE`.
- [ ] Никакая роль приложения не имеет `REPLICATION` (отдельная backup-роль).
- [ ] Все LOGIN-роли имеют пароль и `rolvaliduntil`.
- [ ] `REVOKE CREATE ON SCHEMA public FROM PUBLIC`.
- [ ] `REVOKE EXECUTE` на опасных функциях (`lo_import`, `pg_read_file`,
      `pg_ls_dir`, `pg_stat_file`, `pg_sleep`).
- [ ] `ALTER DEFAULT PRIVILEGES` настроены для всех схем с приложением.
- [ ] Каждая роль имеет явный `search_path` (без public, с pg_temp).
- [ ] Все SECURITY DEFINER функции имеют `SET search_path`.
- [ ] Все SECURITY DEFINER функции имеют `REVOKE EXECUTE FROM PUBLIC`.
- [ ] RLS включён и `FORCE` на всех таблицах с PII.
- [ ] RLS-политики имеют и `USING`, и `WITH CHECK`.
- [ ] RLS включён на ВСЕХ таблицах, связанных через FK (не только на главной).
- [ ] Приложение подключается через role, не имеющую `CREATE` на схемах.
- [ ] Приложение не имеет `CREATE FUNCTION` (только DBA).
- [ ] Нет `WITH GRANT OPTION` для приложения.
- [ ] Бэкап-роль имеет только `REPLICATION` privilege, без `LOGIN` на
      production-БД.
- [ ] Материализованные представления не обновляются обычным пользователем
      (или владелец MV — не суперпользователь).
