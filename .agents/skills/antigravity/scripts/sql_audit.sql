-- ============================================================
-- Antigravity: PostgreSQL SQL Audit Script
-- Запуск:
--   psql -h <host> -U <user> -d postgres -f sql_audit.sql \
--     -v ON_ERROR_STOP=0 -A -F $'\t' > sql_audit_$(date +%F).log 2>&1
-- Все запросы — read-only. Ничего не модифицирует.
-- ============================================================

\echo '============================================================'
\echo 'ANTIGRAVITY POSTGRESQL SECURITY AUDIT'
\echo 'Date: ' `date -u +%Y-%m-%dT%H:%M:%SZ`
\echo 'Host: ' `hostname`
\echo '============================================================'

-- ============================================================
\echo ''
\echo '============================================================'
\echo 'SECTION 1: VERSION & PATCH LEVEL'
\echo '============================================================'

\echo '\n[1.1] PostgreSQL version (check against latest minor release):'
SELECT version();

\echo '\n[1.2] Server start time (uptime):'
SELECT pg_postmaster_start_time() AS started_at,
       now() - pg_postmaster_start_time() AS uptime;

\echo '\n[1.3] Compiled-in flags (SSL, OpenSSL version):'
SELECT name, setting FROM pg_settings
WHERE name IN ('ssl', 'server_version', 'server_version_num',
               'integer_datetimes', 'default_with_oids');

-- ============================================================
\echo ''
\echo '============================================================'
\echo 'SECTION 2: AUTHENTICATION & PASSWORDS'
\echo '============================================================'

\echo '\n[2.1] password_encryption setting (must be scram-sha-256):'
SHOW password_encryption;

\echo '\n[2.2] Login roles with their attributes (check for SUPERUSER, BYPASSRLS):'
SELECT rolname,
       rolsuper AS is_super,
       rolcreaterole AS can_create_role,
       rolcreatedb AS can_create_db,
       rolcanlogin AS can_login,
       rolreplication AS can_replicate,
       rolbypassrls AS bypass_rls,
       rolconnlimit AS conn_limit,
       rolvaliduntil AS password_valid_until,
       CASE
         WHEN rolpassword IS NULL THEN 'NO PASSWORD'
         WHEN rolpassword = '' THEN 'EMPTY'
         WHEN rolpassword LIKE 'SCRAM-SHA-256%' THEN 'SCRAM-SHA-256'
         WHEN rolpassword LIKE 'md5%' THEN 'MD5 (LEGACY)'
         WHEN rolpassword LIKE 'SCM%' THEN 'SCRAM'
         ELSE 'UNKNOWN: ' || substring(rolpassword from 1 for 10)
       END AS password_scheme
FROM pg_authid
ORDER BY rolsuper DESC, rolname;

\echo '\n[2.3] Roles with empty or NULL passwords (CRITICAL if LOGIN):'
SELECT rolname, rolpassword IS NULL AS null_pw, rolpassword = '' AS empty_pw
FROM pg_authid
WHERE rolcanlogin
  AND (rolpassword IS NULL OR rolpassword = '');

\echo '\n[2.4] Roles with no password expiry (valid_until = NULL):'
SELECT rolname
FROM pg_authid
WHERE rolcanlogin AND rolvaliduntil IS NULL
ORDER BY rolname;

\echo '\n[2.5] Roles with expired passwords that still can login:'
SELECT rolname, rolvaliduntil
FROM pg_authid
WHERE rolcanlogin
  AND rolvaliduntil IS NOT NULL
  AND rolvaliduntil < now()
ORDER BY rolvaliduntil;

\echo '\n[2.6] pg_hba_file_rules (effective authentication rules):'
SELECT line_number,
       line_number,
       type AS conn_type,
       database,
       user_name,
       address || ' ' || netmask AS cidr,
       auth_method,
       options
FROM pg_hba_file_rules
ORDER BY line_number;

\echo '\n[2.7] Trust auth in pg_hba (CRITICAL for non-local):'
SELECT line_number, type, database, user_name, address, auth_method
FROM pg_hba_file_rules
WHERE auth_method = 'trust'
ORDER BY line_number;

\echo '\n[2.8] md5/password auth in pg_hba (deprecated):'
SELECT line_number, type, database, user_name, address, auth_method
FROM pg_hba_file_rules
WHERE auth_method IN ('md5', 'password')
ORDER BY line_number;

\echo '\n[2.9] Wide-open networks in pg_hba (0.0.0.0/0, ::/0):'
SELECT line_number, type, address, netmask, auth_method
FROM pg_hba_file_rules
WHERE address = '0.0.0.0' OR address = '::'
ORDER BY line_number;

-- ============================================================
\echo ''
\echo '============================================================'
\echo 'SECTION 3: ROLES & PRIVILEGES'
\echo '============================================================'

\echo '\n[3.1] Role memberships (who belongs to which group):'
SELECT r.rolname AS group_role,
       m.rolname AS member_role,
       gm.admin_option AS admin,
       gm.admin_option
FROM pg_auth_members gm
JOIN pg_authid r ON r.oid = gm.roleid
JOIN pg_authid m ON m.oid = gm.member
ORDER BY r.rolname, m.rolname;

\echo '\n[3.2] Users with SUPERUSER (should be minimal, never app):'
SELECT rolname
FROM pg_authid
WHERE rolsuper
ORDER BY rolname;

\echo '\n[3.3] Users with BYPASSRLS (should be DBA only):'
SELECT rolname
FROM pg_authid
WHERE rolbypassrls
ORDER BY rolname;

\echo '\n[3.4] Users with REPLICATION privilege:'
SELECT rolname
FROM pg_authid
WHERE rolreplication
ORDER BY rolname;

\echo '\n[3.5] Users with CREATEROLE (can create new roles):'
SELECT rolname
FROM pg_authid
WHERE rolcreaterole
ORDER BY rolname;

\echo '\n[3.6] Privileges granted to PUBLIC on databases:'
SELECT datname,
       (aclexplode(datacl)).grantee AS grantee_oid,
       (aclexplode(datacl)).privilege_type,
       (aclexplode(datacl)).is_grantable
FROM pg_database
WHERE datacl IS NOT NULL
ORDER BY datname;

\echo '\n[3.7] Privileges granted to PUBLIC on schemas (look for public schema):'
SELECT nspname,
       (aclexplode(nspacl)).grantee AS grantee_oid,
       (aclexplode(nspacl)).privilege_type
FROM pg_namespace
WHERE nspacl IS NOT NULL
  AND nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY nspname;

\echo '\n[3.8] Tables in public schema with GRANT to PUBLIC:'
SELECT table_schema AS schemaname, table_name AS tablename, grantor, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'PUBLIC'
  AND table_schema = 'public'
ORDER BY tablename, privilege_type;

\echo '\n[3.9] All table grants (find over-permissive grants):'
SELECT table_schema, table_name, grantee, privilege_type, is_grantable
FROM information_schema.role_table_grants
WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
  AND grantee != 'PUBLIC'
ORDER BY table_schema, table_name, grantee, privilege_type;

\echo '\n[3.10] Functions with EXECUTE granted to PUBLIC (potential risk):'
SELECT n.nspname AS schema,
       p.proname AS function_name,
       pg_get_function_arguments(p.oid) AS args,
       pg_get_userbyid(p.proowner) AS owner,
       p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0)  -- 0 = PUBLIC
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY n.nspname, p.proname;

\echo '\n[3.11] SECURITY DEFINER functions (check for search_path vuln):'
SELECT n.nspname AS schema,
       p.proname AS function_name,
       pg_get_userbyid(p.proowner) AS owner,
       p.prosecdef AS security_definer,
       p.proconfig AS settings  -- ищем 'search_path=...'
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.prosecdef = true
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY n.nspname, p.proname;

\echo '\n[3.12] SECURITY DEFINER functions WITHOUT search_path (VULNERABLE):'
SELECT n.nspname AS schema,
       p.proname AS function_name,
       pg_get_userbyid(p.proowner) AS owner
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.prosecdef = true
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND NOT (
    p.proconfig @> ARRAY['search_path='] OR
    EXISTS (SELECT 1 FROM unnest(p.proconfig) AS c WHERE c LIKE 'search_path=%')
  )
ORDER BY n.nspname, p.proname;

\echo '\n[3.13] Default privileges (check for risky patterns):'
SELECT
  pg_get_userbyid(d.defaclrole) AS owner,
  n.nspname AS schema,
  CASE d.defaclobjtype
    WHEN 'r' THEN 'table'
    WHEN 'S' THEN 'sequence'
    WHEN 'f' THEN 'function'
    WHEN 'T' THEN 'type'
    WHEN 'n' THEN 'schema'
  END AS object_type,
  aclexplode(d.defaclacl) AS acl_entry
FROM pg_default_acl d
LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
ORDER BY n.nspname, d.defaclobjtype;

-- ============================================================
\echo ''
\echo '============================================================'
\echo 'SECTION 4: ROW LEVEL SECURITY'
\echo '============================================================'

\echo '\n[4.1] Tables with RLS enabled:'
SELECT n.nspname AS schema,
       c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS force_rls,
       pg_get_userbyid(c.relowner) AS owner
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND c.relrowsecurity = true
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY n.nspname, c.relname;

\echo '\n[4.2] RLS enabled but NOT forced (RLS bypassed by owner):'
SELECT n.nspname AS schema, c.relname AS table_name,
       pg_get_userbyid(c.relowner) AS owner
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND c.relrowsecurity = true
  AND c.relforcerowsecurity = false
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY n.nspname, c.relname;

\echo '\n[4.3] RLS policies on each table (check USING vs WITH CHECK):'
SELECT schemaname, tablename, policyname, permissive, roles,
       cmd AS command, qual AS using_clause, with_check AS with_check_clause
FROM pg_policies
ORDER BY schemaname, tablename, policyname;

\echo '\n[4.4] Tables WITHOUT RLS (potential gap — review PII tables):'
SELECT n.nspname AS schema, c.relname AS table_name,
       pg_size_pretty(pg_total_relation_size(c.oid)) AS size
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND c.relrowsecurity = false
  AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
ORDER BY pg_total_relation_size(c.oid) DESC
LIMIT 50;

-- ============================================================
\echo ''
\echo '============================================================'
\echo 'SECTION 5: EXTENSIONS'
\echo '============================================================'

\echo '\n[5.1] Installed extensions (look for plpythonu, plperlu, plv8, dblink):'
SELECT e.extname AS name,
       e.extversion AS version,
       n.nspname AS schema,
       pg_get_userbyid(e.extowner) AS owner,
       CASE
         WHEN e.extname IN ('plpythonu', 'plperlu', 'plv8') THEN 'CRITICAL: RCE risk'
         WHEN e.extname = 'dblink' THEN 'HIGH: SQLi/SSRF risk'
         WHEN e.extname = 'file_fdw' THEN 'HIGH: file read'
         WHEN e.extname = 'adminpack' THEN 'HIGH: admin functions'
         WHEN e.extname = 'plpgsql' THEN 'INFO: standard'
         WHEN e.extname = 'pgcrypto' THEN 'INFO: check usage'
         WHEN e.extname = 'pgaudit' THEN 'GOOD: audit logging'
         WHEN e.extname = 'pg_stat_statements' THEN 'GOOD: monitoring'
         ELSE 'CHECK: review'
       END AS risk_assessment
FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace
ORDER BY e.extname;

\echo '\n[5.2] Trusted extensions (can be installed by non-superusers):'
SELECT name, default_version
FROM pg_available_extensions
-- WHERE trusted = true
ORDER BY name;

\echo '\n[5.3] Roles that can CREATE EXTENSION (CREATEROLE or SUPERUSER):'
SELECT rolname, rolsuper, rolcreaterole
FROM pg_authid
WHERE rolsuper OR rolcreaterole
ORDER BY rolname;

\echo '\n[5.4] EXECUTE on dblink functions (should be revoked from PUBLIC):'
SELECT p.proname, pg_get_userbyid((aclexplode(p.proacl)).grantee) AS grantee
FROM pg_proc p
WHERE p.proname LIKE 'dblink%'
  AND EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0);  -- 0 = PUBLIC

\echo '\n[5.5] EXECUTE on file-reading functions (should be revoked from PUBLIC):'
SELECT p.proname
FROM pg_proc p
WHERE p.proname IN (
  'pg_read_file', 'pg_read_binary_file', 'pg_ls_dir', 'pg_stat_file',
  'lo_import', 'lo_export', 'lo_read', 'lo_write', 'lo_get', 'lo_put',
  'lo_create', 'lo_unlink', 'lo_truncate', 'lo_truncate64',
  'lo_lseek', 'lo_lseek64', 'lo_tell', 'lo_tell64'
)
AND EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0);

-- ============================================================
\echo ''
\echo '============================================================'
\echo 'SECTION 6: CONFIGURATION'
\echo '============================================================'

\echo '\n[6.1] Security-relevant settings:'
SELECT name, setting, source, boot_val, reset_val
FROM pg_settings
WHERE name IN (
  'ssl', 'ssl_min_protocol_version', 'ssl_max_protocol_version',
  'ssl_ciphers', 'ssl_prefer_server_ciphers', 'ssl_ecdh_curve',
  'password_encryption', 'listen_addresses', 'port',
  'log_connections', 'log_disconnections', 'log_statement',
  'log_line_prefix', 'log_min_messages', 'log_min_error_statement',
  'log_min_duration_statement', 'log_lock_waits',
  'shared_preload_libraries', 'archive_mode', 'archive_command',
  'wal_level', 'max_wal_senders', 'max_replication_slots',
  'standard_conforming_strings', 'escape_string_warning',
  'backslash_quote', 'bytea_output', 'lo_compat_privileges',
  'jit', 'default_transaction_read_only',
  'unix_socket_directories', 'unix_socket_permissions',
  'data_directory', 'config_file', 'hba_file', 'ident_file',
  'krb_server_keyfile', 'krb_caseins_users'
)
ORDER BY name;

\echo '\n[6.2] listen_addresses — should NOT be ''*'' in production:'
SHOW listen_addresses;

\echo '\n[6.3] shared_preload_libraries (check for dangerous extensions):'
SHOW shared_preload_libraries;

\echo '\n[6.4] SSL configuration:'
SHOW ssl;
SHOW ssl_min_protocol_version;
SHOW ssl_ciphers;
SHOW ssl_prefer_server_ciphers;

\echo '\n[6.5] Logging configuration:'
SHOW log_statement;
SHOW log_connections;
SHOW log_disconnections;
SHOW log_line_prefix;
SHOW log_directory;

\echo '\n[6.6] Settings changed from default (potential misconfigurations):'
SELECT name, setting, source, boot_val
FROM pg_settings
WHERE source NOT IN ('default', 'override')
  AND name NOT IN ('data_directory', 'config_file', 'hba_file', 'ident_file',
                   'external_pid_file', 'lc_messages', 'lc_monetary',
                   'lc_numeric', 'lc_time', 'timezone', 'log_timezone',
                   'DateStyle', 'shared_buffers', 'max_connections',
                   'work_mem', 'maintenance_work_mem', 'effective_cache_size')
ORDER BY name;

-- ============================================================
\echo ''
\echo '============================================================'
\echo 'SECTION 7: ACTIVE SESSIONS & REPLICATION'
\echo '============================================================'

\echo '\n[7.1] Active sessions (who is connected right now):'
SELECT datname, usename, application_name, client_addr, client_port,
       backend_start, xact_start, query_start, state_change, state, query
FROM pg_stat_activity
WHERE pid != pg_backend_pid()
ORDER BY backend_start;

\echo '\n[7.2] Sessions connected as superuser (CRITICAL if external):'
SELECT datname, usename, client_addr, application_name, backend_start, query
FROM pg_stat_activity
WHERE usename IN (
  SELECT rolname FROM pg_authid WHERE rolsuper
)
AND client_addr IS NOT NULL
ORDER BY backend_start;

\echo '\n[7.3] Long-running queries (>5 minutes):'
SELECT pid, now() - query_start AS duration, usename, state, query
FROM pg_stat_activity
WHERE query_start IS NOT NULL
  AND now() - query_start > interval '5 minutes'
  AND state != 'idle'
ORDER BY duration DESC;

\echo '\n[7.4] Idle in transaction sessions (potential leak / DoS):'
SELECT pid, usename, application_name, client_addr,
       backend_start, xact_start, state, query
FROM pg_stat_activity
WHERE state = 'idle in transaction'
  AND xact_start < now() - interval '10 minutes'
ORDER BY xact_start;

\echo '\n[7.5] Replication connections (physical replicas):'
SELECT pid, usename, application_name, client_addr, client_port,
       backend_start, state, sync_state, sent_lsn, write_lsn, flush_lsn,
       replay_lsn
FROM pg_stat_replication
ORDER BY client_addr;

\echo '\n[7.6] Replication slots (check for abandoned ones):'
SELECT slot_name, plugin, slot_type, datoid, database, temporary,
       active, active_pid, xmin, catalog_xmin, restart_lsn, confirmed_flush_lsn
FROM pg_replication_slots
ORDER BY slot_name;

\echo '\n[7.7] Inactive replication slots (can cause WAL bloat):'
SELECT slot_name, slot_type, active, restart_lsn,
       pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn) AS bytes_retained
FROM pg_replication_slots
WHERE NOT active
ORDER BY bytes_retained DESC;

\echo '\n[7.8] Prepared transactions (potential for abuse):'
SELECT * FROM pg_prepared_xacts
ORDER BY prepared;

-- ============================================================
\echo ''
\echo '============================================================'
\echo 'SECTION 8: LARGE OBJECTS & FILE FUNCTIONS'
\echo '============================================================'

\echo '\n[8.1] Large objects (check for unexpected imports):'
SELECT oid AS loid,
       pg_get_userbyid(lomowner) AS owner,
       lomacl
FROM pg_largeobject_metadata
ORDER BY oid;

\echo '\n[8.2] Server file system access privileges (should NOT include PUBLIC):'
SELECT r.rolname
FROM pg_authid r
JOIN pg_auth_members m ON m.member = r.oid
JOIN pg_authid g ON g.oid = m.roleid
WHERE g.rolname IN ('pg_read_server_files', 'pg_write_server_files',
                    'pg_execute_server_program', 'pg_read_all_stats',
                    'pg_signal_backend', 'pg_stat_scan_tables')
ORDER BY g.rolname, r.rolname;

\echo '\n[8.3] Roles granted to PUBLIC (direct grants of dangerous roles):'
SELECT g.rolname AS granted_role
FROM pg_auth_members m
JOIN pg_authid g ON g.oid = m.roleid
WHERE m.member = 0  -- PUBLIC
  AND g.rolname LIKE 'pg_%';

-- ============================================================
\echo ''
\echo '============================================================'
\echo 'SECTION 9: AUDITING & LOGGING STATUS'
\echo '============================================================'

\echo '\n[9.1] pgAudit installed and configured?'
SELECT extname, extversion FROM pg_extension WHERE extname = 'pgaudit';

\echo '\n[9.2] pg_stat_statements available (for query monitoring)?'
SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_stat_statements';

\echo '\n[9.3] Top 20 queries by total time (anomaly detection):'
-- SELECT substring(query, 1, 100) AS query,
--        calls, total_exec_time, mean_exec_time, rows
-- FROM pg_stat_statements
-- ORDER BY total_exec_time DESC
-- LIMIT 20;

\echo '\n[9.4] Queries returning suspiciously many rows (potential data exfil):'
-- SELECT substring(query, 1, 100) AS query,
--        calls, rows, mean_exec_time
-- FROM pg_stat_statements
-- WHERE rows > 10000
-- ORDER BY rows DESC
-- LIMIT 20;

-- ============================================================
\echo ''
\echo '============================================================'
\echo 'SECTION 10: DATABASES & SCHEMAS OVERVIEW'
\echo '============================================================'

\echo '\n[10.1] All databases with sizes:'
SELECT datname, pg_get_userbyid(datdba) AS owner,
       pg_encoding_to_char(encoding) AS encoding,
       datcollate, datctype,
       pg_size_pretty(pg_database_size(datname)) AS size,
       datacl
FROM pg_database
ORDER BY pg_database_size(datname) DESC;

\echo '\n[10.2] Schemas in current database:'
SELECT n.nspname AS schema,
       pg_get_userbyid(n.nspowner) AS owner,
       nspacl
FROM pg_namespace n
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
ORDER BY n.nspname;

\echo '\n[10.3] Top 20 largest tables (focus audit here):'
SELECT n.nspname AS schema,
       c.relname AS table_name,
       pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
       pg_size_pretty(pg_relation_size(c.oid)) AS table_size,
       c.reltuples::bigint AS approx_rows
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
ORDER BY pg_total_relation_size(c.oid) DESC
LIMIT 20;

\echo '\n[10.4] Materialized views (check CVE-2020-25695):'
SELECT n.nspname AS schema,
       c.relname AS matview_name,
       pg_get_userbyid(c.relowner) AS owner
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'm'
ORDER BY n.nspname, c.relname;

-- ============================================================
\echo ''
\echo '============================================================'
\echo 'SECTION 11: TRIGGERS & EVENT TRIGGERS (potential backdoors)'
\echo '============================================================'

\echo '\n[11.1] Event triggers (DDL hooks — possible backdoor):'
SELECT evtname, evtevent, evtowner::regrole, evtfoid::regprocedure, evtenabled
FROM pg_event_trigger
ORDER BY evtname;

\echo '\n[11.2] Suspicious triggers (review non-standard names):'
SELECT event_object_schema, event_object_table, trigger_name,
       action_timing, event_manipulation, action_statement
FROM information_schema.triggers
WHERE trigger_schema NOT IN ('pg_catalog', 'information_schema')
  AND trigger_name NOT LIKE 'pg_%'
ORDER BY event_object_schema, event_object_table, trigger_name;

-- ============================================================
\echo ''
\echo '============================================================'
\echo 'SECTION 12: RECENT DDL OPERATIONS (from stats and OIDs)'
\echo '============================================================'
-- ВАЖНО: PostgreSQL НЕ хранит timestamp создания объектов.
-- Мы можем использовать pg_stat_user_tables.last_vacuum/last_analyze
-- (время последнего VACUUM/ANALYZE) как прокси-индикатор активности,
-- а OID (монотонно возрастающий) — как индикатор порядка создания.

\echo '\n[12.1] Recently created/modified tables (by OID, descending — newest first):'
SELECT n.nspname AS schema, c.relname AS table_name,
       pg_get_userbyid(c.relowner) AS owner,
       c.oid AS table_oid,
       s.n_live_tup AS approx_rows,
       s.last_vacuum,
       s.last_analyze,
       s.last_autoanalyze
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
WHERE c.relkind = 'r'
  AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
ORDER BY c.oid DESC  -- OID монотонно растёт; новые объекты имеют больший OID
LIMIT 30;

\echo '\n[12.2] Recently created functions (by OID, newest first — review for malicious code):'
SELECT n.nspname AS schema, p.proname AS function_name,
       pg_get_function_arguments(p.oid) AS args,
       pg_get_userbyid(p.proowner) AS owner,
       p.prosecdef AS security_definer,
       p.oid AS func_oid
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY p.oid DESC  -- новые функции — большие OID
LIMIT 30;

\echo '\n[12.3] Tables with recent autovacuum activity (last 7 days — proxy for recent activity):'
SELECT schemaname, relname,
       last_vacuum, last_autovacuum,
       last_analyze, last_autoanalyze,
       n_live_tup, n_dead_tup
FROM pg_stat_user_tables
WHERE last_autovacuum > now() - interval '7 days'
   OR last_autoanalyze > now() - interval '7 days'
ORDER BY COALESCE(last_autovacuum, last_autoanalyze) DESC NULLS LAST
LIMIT 30;

-- ============================================================
\echo ''
\echo '============================================================'
\echo 'SECTION 13: BACKUP & ARCHIVE STATUS'
\echo '============================================================'

\echo '\n[13.1] Archive status:'
SELECT * FROM pg_stat_archiver;

\echo '\n[13.2] WAL segments count (high count may indicate archive issues):'
SELECT count(*) AS wal_files,
       pg_size_pretty(sum(size)) AS total_wal_size
FROM pg_ls_waldir()
WHERE name ~ '^[0-9A-F]{24}$';

\echo '\n[13.3] Latest WAL file:'
SELECT name, modification
FROM pg_ls_waldir()
ORDER BY modification DESC
LIMIT 5;

-- ============================================================
\echo ''
\echo '============================================================'
\echo 'AUDIT COMPLETE'
\echo '============================================================'
\echo 'Review each section above. For findings, refer to:'
\echo '  references/vulnerabilities_database.md'
\echo '  references/authentication_security.md'
\echo '  references/authorization_rls.md'
\echo '  references/network_tls.md'
\echo '  references/extensions_security.md'
\echo '  references/filesystem_os.md'
\echo '  references/sql_injection.md'
\echo '  references/compliance_mapping.md'
\echo '============================================================'
