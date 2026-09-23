-- ==============================================================================
-- POSTGRESQL SECURITY HARDENING SCRIPT (2026 PROD-SEC / OWASP A01 / PCI DSS 10.2)
-- ==============================================================================

-- 1. Enable Audit Logging (DDL statements and session connections)
ALTER SYSTEM SET log_statement = 'ddl';
ALTER SYSTEM SET log_connections = 'on';
ALTER SYSTEM SET log_disconnections = 'on';
ALTER SYSTEM SET log_line_prefix = '%m [%p] %q%u@%d ';

-- 2. Create Application Least-Privilege Role if not exists
-- Note: In production pass password securely via environment
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'smmplan_app') THEN
    CREATE ROLE smmplan_app WITH LOGIN PASSWORD 'CHANGE_IN_PRODUCTION' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END
$$;

-- 3. Grant Permissions on Application Database
GRANT CONNECT ON DATABASE smmplan_lite TO smmplan_app;
GRANT USAGE, CREATE ON SCHEMA public TO smmplan_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO smmplan_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO smmplan_app;
GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA public TO smmplan_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO smmplan_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO smmplan_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO smmplan_app;

-- 4. Enable Performance & Query Telemetry (pg_stat_statements)
-- Note: shared_preload_libraries requires server restart to load the module into memory
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';

-- 5. Reload Configuration
SELECT pg_reload_conf();