# Соответствие комплаенс-фреймворкам

> **Содержание**
> 1. [Обзор фреймворков](#обзор)
> 2. [PCI DSS 4.0](#pci-dss)
> 3. [GDPR / ФЗ-152](#gdpr)
> 4. [SOC 2 / ISO 27001](#soc2-iso27001)
> 5. [Матрица соответствия требований и проверок](#матрица)
> 6. [Шаблон отчёта по комплаенсу](#отчёт)

---

## Обзор

Три фреймворка, которые чаще всего требуют от PostgreSQL-инсталляции
соответствия:

| Фреймворк | Назначение | Ключевые требования к БД |
|-----------|------------|--------------------------|
| **PCI DSS 4.0** | Защита карточных данных | Шифрование, аудит доступу, сегрегация, network isolation |
| **GDPR / ФЗ-152** | Защита персональных данных (PII) | Минимизация, право на забвение, шифрование, аудит |
| **SOC 2 / ISO 27001** | Управление информбезопасностью | Контроль доступа, мониторинг, change management |

Принципиально: комплаенс — это не «сделать безопасно», а «доказать, что
сделано безопасно». Каждое требование должно иметь **доказательство**
(лог, конфиг, процедура).

---

## PCI DSS

PCI DSS (Payment Card Industry Data Security Standard) — стандарт для
организаций, обрабатывающих карточные данные. Применяется, если в PostgreSQL
хранятся:
- PAN (Primary Account Number) — номер карты.
- Имя владельца + срок действия + PAN (вместе).
- Любые данные, доступ к которым позволяет совершить платеж.

### Ключевые требования к PostgreSQL

#### Req 2: Не использовать дефолтные пароли

```sql
-- Найти роли с дефолтными паролями (postgres, admin, password):
SELECT rolname FROM pg_authid
WHERE rolcanlogin AND rolpassword IS NOT NULL
  AND rolname IN ('postgres', 'admin', 'password', 'root', 'sa');
-- Если есть — Critical. PCI DSS 2.2.4.

-- Найти роли с пустыми паролями:
SELECT rolname FROM pg_authid
WHERE rolcanlogin AND (rolpassword IS NULL OR rolpassword = '');
```

**Доказательство**: вывод скрипта + документ о ротации паролей.

#### Req 3: Защита сохранённых данных держателя карты

##### 3.4: PAN должен быть нечитаемым при хранении

Варианты:
1. **One-way hash** (с солью): `crypt(pan, gen_salt('bf', 12))`.
2. **Truncation**: хранить только последние 4 цифры.
3. **Tokenization**: заменить PAN на токен, реальный PAN в отдельном vault.
4. **Strong encryption**: `pgcrypto.encrypt()` с key из KMS.

**Анти-пример** (нарушение):
```sql
CREATE TABLE cards (pan TEXT PRIMARY KEY, user_id INT);
-- PAN хранится plaintext
```

**Патч**:
```sql
-- Вариант 1: truncation (рекомендуется)
CREATE TABLE cards (
  pan_last4 CHAR(4),
  pan_hash TEXT,  -- для matching при возврате платежа
  user_id INT,
  ...
);

-- Вариант 2: tokenization
CREATE TABLE cards (
  token UUID PRIMARY KEY,
  pan_encrypted BYTEA,  -- AES-256-GCM с key из KMS
  user_id INT,
  ...
);

-- Вариант 3: hash (для PCI-only, без расшифровки)
CREATE TABLE cards (
  pan_hash TEXT,  -- bcrypt
  user_id INT,
  ...
);
```

##### 3.5: Защита криптографических ключей

Ключи шифрования не должны быть в БД:
```sql
-- Анти-пример:
SELECT encrypt(pan::bytea, 'my_super_secret_key', 'aes');

-- Патч: ключ в AWS KMS / Vault
-- БД получает DEK (data encryption key) на короткое время
-- DEK шифрует PAN, KEK (master) — в KMS
```

**Доказательство**: документация key management + logs из KMS.

#### Req 6: Безопасная разработка

##### 6.3: Security patches в течение 1 месяца

```sql
SELECT version();
-- Сравнить с текущим minor release. Если старше 1 месяца — нарушение.
```

##### 6.5: Защита от OWASP Top 10 (включая SQLi)

Проверка:
- Все запросы параметризованы (см. `sql_injection.md`).
- SAST в CI (semgrep / bandit).
- DAST в staging (sqlmap).

**Доказательство**: CI/CD pipeline config + отчёт SAST.

#### Req 7: Ограничение доступа по необходимости

```sql
-- Кто имеет доступ к cards table:
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'cards';
-- Должны быть только: app_payment, app_fraud_check (read-only)
```

#### Req 8: Идентификация и аутентификация

##### 8.2: Уникальный ID для каждого пользователя

Никаких shared-аккаунтов:
```sql
-- Найти роли с несколькими подключениями с разных IP:
SELECT usename, count(DISTINCT client_addr)
FROM pg_stat_activity
GROUP BY usename
HAVING count(DISTINCT client_addr) > 1;
-- Если app_user подключается с 10 разных IP — возможно, shared.
```

##### 8.3: Аутентификация всех пользователей

- `trust` запрещён для network.
- SCRAM-SHA-256 minimum.
- 2FA для admin-доступа (через bastion + SSH key).

#### Req 10: Логирование и мониторинг

```conf
# postgresql.conf
log_connections = on
log_disconnections = on
log_statement = 'all'  # для PCI — обязательно all
log_line_prefix = '%m [%p] %u@%d %h '
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_rotation_age = 1d
log_rotation_size = 100MB
log_truncate_on_rotation = off  # never truncate!
```

```sql
-- pgAudit:
CREATE EXTENSION pgaudit;
-- pgaudit.log = 'read, write, ddl, role'  # PCI: всё
```

Логи должны отправляться в central SIEM (Splunk, ELK, Sumo Logic) с
retention ≥ 1 year (PCI req 10.7).

#### Req 11: Тестирование безопасности

- Ежеквартальный internal scan.
- Ежегодный external pentest.
- Quarterly ASV scan (если наружу смотрит).
- File Integrity Monitoring (FIM) на конфиги PostgreSQL.

---

## GDPR

GDPR (General Data Protection Regulation, EU 2016/679) и ФЗ-152 (РФ) —
защита персональных данных. Применяется, если в PostgreSQL хранятся PII:
имя, email, телефон, IP, биометрия, etc.

### Ключевые требования

#### Article 5(1)(c): Минимизация данных

Не хранить больше, чем нужно. Поля `ssn`, `passport_number` — должны быть
обоснованы.

**Аудит**:
```sql
-- Найти таблицы с колонками, похожими на PII:
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE column_name ~* '(ssn|passport|inn|snils|phone|email|address|birth|name)'
ORDER BY table_name;
-- Для каждой — обосновать, зачем хранится
```

#### Article 5(1)(f): Integrity and confidentiality

Шифрование at-rest и in-transit.

```sql
-- In-transit:
SHOW ssl;  -- должен быть on
SHOW ssl_min_protocol_version;  -- TLS 1.2+

-- At-rest:
-- Через LUKS / dm-crypt на уровне диска
-- Или через pgcrypto для конкретных колонок
```

#### Article 17: Право на забвение (Right to erasure)

Пользователь может потребовать удалить все свои данные. PostgreSQL должен
поддержать это.

**Проблема**: простое `DELETE FROM users WHERE id=42` не удаляет данные
из:
1. Индексов (там остаются dead tuples, видны через pageinspect).
2. WAL (лог транзакций).
3. Бэкапов.
4. Materialized views.
5. Логов приложения (если писали данные в лог).

**Решение**:
1. Anonymization вместо удаления (если нужно сохранить aggregates):
   ```sql
   UPDATE users
   SET name = 'DELETED', email = NULL, phone = NULL,
       address = NULL, deleted_at = now()
   WHERE id = 42;
   ```
2. Полное удаление + VACUUM FULL (перезаписывает dead tuples):
   ```sql
   DELETE FROM users WHERE id = 42;
   VACUUM FULL users;  -- блокирует таблицу, но затирает dead tuples
   ```
3. Бэкапы: rotation. Старые бэкапы уничтожаются через N дней (согласно
   policy retention).

**Доказательство**: процедура GDPR-erasure в runbook + журнал выполненных
запросов.

#### Article 25: Privacy by design

- PII в отдельных схемах / таблицах.
- RLS на всех таблицах с PII.
- Аудит доступа к PII (pgAudit).
- Шифрование колонок с особо чувствительными PII (biometry, health).

#### Article 32: Безопасность обработки

- Pseudonymization (заменить имя на hash, оставить mapping в vault).
- Шифрование.
- Confidentiality, integrity, availability, resilience.
- Регулярная проверка эффективности.

#### Article 33: Уведомление о нарушении в течение 72 часов

Должна быть процедура: при обнаружении утечки → уведомить supervisory
authority в течение 72 часов. Для этого нужен **детектор инцидентов**.

```sql
-- Пример: алерт на необычно большой SELECT:
SELECT query, calls, total_exec_time, rows
FROM pg_stat_statements
WHERE query LIKE '%SELECT%FROM%users%'
  AND rows > 10000
ORDER BY calls DESC;
-- Алертовать, если rows > 10000 для одного выполнения
```

---

## SOC 2 / ISO 27001

Оба фреймворка — процессно-ориентированные. Они не говорят «сделай X», а
требуют «иметь процесс для X».

### SOC 2 (Trust Services Criteria)

#### CC6.1: Логический и физический контроль доступа

- Уникальные ID для каждого пользователя.
- MFA для admin.
- Review access rights quarterly.
- Deprovisioning в течение 24 часов после увольнения.

**Доказательство для PostgreSQL**:
```sql
-- Quarterly access review:
SELECT rolname, rolcanlogin, rolvaliduntil,
       (aclexplode(datacl)).grantee AS grantee_on_db
FROM pg_authid
JOIN pg_database ON true
WHERE rolcanlogin
ORDER BY rolname;
```

#### CC7.1: Detection and monitoring

- Логи собираются в central system.
- Алерты на аномалии.
- Incident response procedure.

#### CC7.2: Anomaly detection

```sql
-- Новые роли за последние 24 часа:
SELECT rolname, rolcreaterole
FROM pg_authid
WHERE rolcreaterole > now() - interval '24 hours';

-- Новые расширения:
SELECT extname, extversion
FROM pg_extension
WHERE extname NOT IN ('plpgsql', 'pg_stat_statements', 'pgaudit');

-- Подключения с новых IP:
SELECT usename, client_addr, count(*)
FROM pg_stat_activity
WHERE client_addr NOT IN (
  SELECT DISTINCT client_addr FROM pg_stat_activity
  WHERE query_start < now() - interval '7 days'
)
GROUP BY usename, client_addr;
```

### ISO 27001

#### A.5: Information security policies

Документированная policy для PostgreSQL:
- Password policy.
- Backup policy.
- Patch management policy.
- Incident response policy.

#### A.6: Organization of information security

- Разделение dev/test/prod.
- Separate admin accounts.

#### A.8: Asset management

- Inventory всех PostgreSQL-инсталляций.
- Owner для каждой.
- Data classification (Public / Internal / Confidential / Restricted).

#### A.9: Access control

- Role-based access.
- Least privilege.
- Privileged access review.

#### A.12: Operations security

- A.12.6.1: Management of technical vulnerabilities → patch management.
- A.12.4: Logging and monitoring → pgAudit + SIEM.
- A.12.3: Information backup → тестирование restore.

#### A.14: System acquisition, development and maintenance

- Secure coding practices.
- SAST/DAST в CI.
- Code review.

---

## Матрица

| Требование | PCI DSS | GDPR | SOC 2 / ISO 27001 | Проверка в PostgreSQL |
|-----------|---------|------|-------------------|----------------------|
| Шифрование in-transit | 4.1 | Art. 32 | A.13.1 | `SHOW ssl;` `SHOW ssl_min_protocol_version;` |
| Шифрование at-rest | 3.4 | Art. 32 | A.8.2 | LUKS/dm-crypt + проверка |
| Не дефолтные пароли | 2.2.4 | — | A.9.2.4 | `SELECT rolname, rolpassword IS NULL FROM pg_authid WHERE rolcanlogin;` |
| Уникальные ID | 8.1 | Art. 25 | A.9.2.1 | Нет shared-аккаунтов |
| MFA для admin | 8.4 | — | A.9.4.2 | Bastion + SSH key + TOTP |
| Минимизация данных | 3.1 | Art. 5(1)(c) | A.8.2 | Audit schema: нет лишних PII |
| Аудит доступу | 10.2 | Art. 30 | A.12.4 | pgAudit + log_statement='ddl' minimum |
| Логи ≥ 1 year | 10.7 | — | A.12.4 | SIEM retention policy |
| Security patches | 6.3.1 | Art. 32 | A.12.6.1 | `SELECT version();` vs latest |
| Pen test annually | 11.3 | — | A.12.6.1 | Отчёт pentest |
| File integrity | 11.5 | — | A.12.2 | AIDE/Tripwire on postgresql.conf |
| Network segmentation | 1.3 | — | A.13.1 | firewall + NetworkPolicy |
| Право на забвение | — | Art. 17 | — | Procedure + tests |
| Data subject access | — | Art. 15 | — | Procedure for data export |
| Уведомление о breach (72h) | — | Art. 33 | — | Incident response plan |
| Vulnerability scan | 11.2 | — | A.12.6.1 | Quarterly Nessus + sqlmap |
| Change management | 6.4 | — | A.12.5 | DB migrations in CI with review |
| Backup + restore test | — | Art. 32 | A.12.3 | Quarterly restore drill |
| Separation of duties | 7.2 | — | A.6.1.2 | DBA vs app vs auditor roles |

---

## Отчёт

Шаблон комплаенс-отчёта — в `assets/report_template.md`, раздел
«Compliance Matrix». Для каждого требования:

```markdown
### PCI DSS 3.4 — PAN unreadable where stored

**Status**: ✅ Compliant / ⚠️ Partially / ❌ Non-compliant

**Evidence**:
- Schema: `cards` table содержит только `pan_last4` (4 digits) и `pan_hash`
  (bcrypt cost 12).
- Запрос: `\d cards` → показывает schema.
- Sample data: `SELECT pan_last4, pan_hash FROM cards LIMIT 3;` → показывает
  только хеши.

**Gap**: None / [описание, если есть]

**Remediation**: [если есть gap — план с deadline]
```

Для аудита комплаенса ВСЕГДА:
1. Начинай с матрицы выше.
2. Для каждого требования собери evidence (запрос + вывод).
3. Определи status.
4. Если Non-compliant — план remediation с конкретным deadline.
5. Включи в отчёт — комплаенс-офицер будет проверять.
