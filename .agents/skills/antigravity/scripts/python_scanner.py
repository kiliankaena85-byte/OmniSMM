#!/usr/bin/env python3
"""
Antigravity: PostgreSQL Python Security Scanner
=================================================

Запуск:
    python3 python_scanner.py \\
        --host <host> --port 5432 --user <user> --database postgres \\
        --password-file /path/to/password \\
        --output json > scan_$(date +%F).json

Или через connection string:
    python3 python_scanner.py --dsn "postgresql://user:pass@host/db" \\
        --output markdown > scan_$(date +%F).md

Все запросы — read-only. Скрипт ничего не модифицирует.
"""

import argparse
import json
import os
import sys
import datetime
from dataclasses import dataclass, field, asdict
from typing import Optional, List

try:
    import psycopg
    PSYCOPG_VERSION = 3
except ImportError:
    try:
        import psycopg2 as psycopg
        from psycopg2.extras import RealDictCursor
        PSYCOPG_VERSION = 2
    except ImportError:
        print("ERROR: Neither psycopg (v3) nor psycopg2 (v2) is installed.",
              file=sys.stderr)
        print("Install: pip install psycopg[binary] OR pip install psycopg2-binary",
              file=sys.stderr)
        sys.exit(1)


# ============================================================
# Data classes
# ============================================================

@dataclass
class Finding:
    check_id: str
    title: str
    severity: str  # CRITICAL / HIGH / MEDIUM / LOW / INFO
    cwe: Optional[str] = None
    cve: Optional[str] = None
    description: str = ""
    evidence: str = ""
    recommendation: str = ""
    compliance: List[str] = field(default_factory=list)
    passed: bool = True  # True = check passed (no issue)


@dataclass
class AuditResult:
    target: str
    timestamp: str
    version: str
    findings: List[Finding] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "target": self.target,
            "timestamp": self.timestamp,
            "version": self.version,
            "findings": [asdict(f) for f in self.findings],
            "summary": {
                "total": len(self.findings),
                "passed": sum(1 for f in self.findings if f.passed),
                "failed": sum(1 for f in self.findings if not f.passed),
                "by_severity": {
                    "CRITICAL": sum(1 for f in self.findings if not f.passed and f.severity == "CRITICAL"),
                    "HIGH": sum(1 for f in self.findings if not f.passed and f.severity == "HIGH"),
                    "MEDIUM": sum(1 for f in self.findings if not f.passed and f.severity == "MEDIUM"),
                    "LOW": sum(1 for f in self.findings if not f.passed and f.severity == "LOW"),
                }
            }
        }


# ============================================================
# Database connection helper
# ============================================================

class DB:
    def __init__(self, conn_params: dict):
        self.conn_params = conn_params
        self.conn = None

    def connect(self):
        if PSYCOPG_VERSION == 3:
            self.conn = psycopg.connect(**self.conn_params)
        else:
            self.conn = psycopg.connect(**self.conn_params)
        self.conn.autocommit = True

    def close(self):
        if self.conn:
            self.conn.close()

    def execute(self, query: str, params: Optional[tuple] = None) -> List[dict]:
        """Execute a SELECT and return list of dict rows."""
        if PSYCOPG_VERSION == 3:
            with self.conn.cursor() as cur:
                cur.execute(query, params or ())
                cols = [d.name for d in cur.description]
                return [dict(zip(cols, row)) for row in cur.fetchall()]
        else:
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(query, params or ())
                return [dict(row) for row in cur.fetchall()]

    def execute_one(self, query: str, params: Optional[tuple] = None) -> Optional[dict]:
        rows = self.execute(query, params)
        return rows[0] if rows else None

    def get_setting(self, name: str) -> Optional[str]:
        row = self.execute_one("SELECT setting FROM pg_settings WHERE name = %s", (name,))
        return row["setting"] if row else None


# ============================================================
# Audit checks
# ============================================================

def check_version(db: DB, result: AuditResult):
    """Check PostgreSQL version against known CVEs."""
    version_row = db.execute_one("SELECT version()")
    version = version_row["version"]
    result.version = version

    # Extract version number
    import re
    match = re.search(r"PostgreSQL (\d+)\.(\d+)(?:\.(\d+))?", version)
    if not match:
        result.findings.append(Finding(
            check_id="VER-001",
            title="Cannot parse PostgreSQL version",
            severity="INFO",
            description=f"Version string: {version}",
            passed=True,
        ))
        return

    major, minor, patch = int(match.group(1)), int(match.group(2)), int(match.group(3) or 0)
    full_ver = f"{major}.{minor}.{patch}"

    # Check EOL
    eol_versions = {
        (9, 5): "2021-02-11",
        (9, 6): "2021-11-11",
        (10, 0): "2022-11-10",
        (11, 0): "2023-11-09",
        (12, 0): "2024-11-14",
    }
    for (eol_major, eol_minor), eol_date in eol_versions.items():
        if major < eol_major or (major == eol_major and minor < eol_minor):
            result.findings.append(Finding(
                check_id="VER-002",
                title=f"PostgreSQL {full_ver} is End-of-Life (EOL)",
                severity="CRITICAL",
                cwe="CWE-1104",
                description=f"PostgreSQL {major}.{minor} reached EOL on {eol_date}. No security patches.",
                evidence=f"SELECT version() → {version}",
                recommendation=f"Upgrade to latest minor release of PostgreSQL 13+ (or current LTS).",
                compliance=["PCI DSS 6.3.1", "ISO 27001 A.12.6.1", "GDPR Art. 32"],
                passed=False,
            ))
            return

    # Check known vulnerable versions
    known_vulnerable = [
        # (major, minor, patch_max, cve, description)
        (11, 0, 3, "CVE-2019-10164", "SCRAM stack overflow (CVSS 9.8, post-auth RCE)"),
        (10, 0, 8, "CVE-2019-10164", "SCRAM stack overflow (CVSS 9.8, post-auth RCE)"),
        (10, 0, 4, "CVE-2018-10925", "Authorization check bypass (CVSS 7.5)"),
        (9, 6, 9, "CVE-2018-10925", "Authorization check bypass (CVSS 7.5)"),
        (9, 5, 13, "CVE-2018-10925", "Authorization check bypass (CVSS 7.5)"),
        (9, 4, 18, "CVE-2018-10925", "Authorization check bypass (CVSS 7.5)"),
        (9, 3, 23, "CVE-2018-10925", "Authorization check bypass (CVSS 7.5)"),
        (11, 0, 2, "CVE-2019-10129", "Partition routing memory disclosure (CVSS 7.5)"),
        (16, 0, 3, "CVE-2024-7348", "pg_dump TOCTOU race condition (CVSS 8.8)"),
        (15, 0, 7, "CVE-2024-7348", "pg_dump TOCTOU race condition (CVSS 8.8)"),
        (14, 0, 12, "CVE-2024-7348", "pg_dump TOCTOU race condition (CVSS 8.8)"),
        (13, 0, 15, "CVE-2024-7348", "pg_dump TOCTOU race condition (CVSS 8.8)"),
        (12, 0, 19, "CVE-2024-7348", "pg_dump TOCTOU race condition (CVSS 8.8)"),
        (16, 0, 2, "CVE-2024-4317", "pg_stats_ext info disclosure (CVSS 4.3)"),
        (15, 0, 6, "CVE-2024-4317", "pg_stats_ext info disclosure (CVSS 4.3)"),
    ]
    for v_major, v_minor, v_patch_max, cve, desc in known_vulnerable:
        if major == v_major and minor == v_minor and patch <= v_patch_max:
            result.findings.append(Finding(
                check_id=f"VER-{cve}",
                title=f"Vulnerable to {cve}: {desc}",
                severity="CRITICAL" if "9.8" in desc or "bypass" in desc or "RCE" in desc else "HIGH",
                cve=cve,
                cwe="CWE-1104",
                description=f"PostgreSQL {full_ver} is vulnerable to {cve}.",
                evidence=f"version() = {version}",
                recommendation=f"Upgrade to latest patch release of {major}.{minor}.",
                compliance=["PCI DSS 6.3.1", "ISO 27001 A.12.6.1"],
                passed=False,
            ))
            return

    result.findings.append(Finding(
        check_id="VER-001",
        title=f"PostgreSQL version {full_ver} — no known critical CVE",
        severity="INFO",
        description=version,
        passed=True,
    ))


def check_password_encryption(db: DB, result: AuditResult):
    """Check password_encryption setting."""
    setting = db.get_setting("password_encryption")
    if setting == "scram-sha-256":
        result.findings.append(Finding(
            check_id="AUTH-001",
            title="password_encryption is scram-sha-256",
            severity="INFO",
            description="Modern password hashing is enabled.",
            evidence=f"password_encryption = {setting}",
            passed=True,
        ))
    elif setting in ("md5", "password"):
        result.findings.append(Finding(
            check_id="AUTH-001",
            title=f"password_encryption is '{setting}' (deprecated)",
            severity="HIGH",
            cwe="CWE-916",
            description=f"Password hashing uses {setting}, which is weak or legacy.",
            evidence=f"password_encryption = {setting}",
            recommendation="Set password_encryption = 'scram-sha-256' and re-hash all passwords.",
            compliance=["PCI DSS 8.3", "ISO 27001 A.9.4.3"],
            passed=False,
        ))
    else:
        result.findings.append(Finding(
            check_id="AUTH-001",
            title=f"password_encryption is '{setting}' (unexpected)",
            severity="MEDIUM",
            description=f"Unexpected password_encryption setting: {setting}",
            recommendation="Investigate.",
            passed=False,
        ))


def check_md5_password_hashes(db: DB, result: AuditResult):
    """Find roles still using MD5 password hashes."""
    rows = db.execute("""
        SELECT rolname,
               CASE
                 WHEN rolpassword IS NULL THEN 'NO_PASSWORD'
                 WHEN rolpassword = '' THEN 'EMPTY'
                 WHEN rolpassword LIKE 'SCRAM-SHA-256%' OR rolpassword LIKE 'SCM%' THEN 'SCRAM'
                 WHEN rolpassword LIKE 'md5%' THEN 'MD5'
                 ELSE 'UNKNOWN'
               END AS scheme
        FROM pg_authid
        WHERE rolcanlogin
    """)

    md5_users = [r for r in rows if r["scheme"] == "MD5"]
    empty_users = [r for r in rows if r["scheme"] in ("EMPTY", "NO_PASSWORD")]

    if md5_users:
        result.findings.append(Finding(
            check_id="AUTH-002",
            title=f"{len(md5_users)} login roles use MD5 password hashes",
            severity="HIGH",
            cwe="CWE-916",
            description="MD5 password hashes are vulnerable to pass-the-hash and rainbow tables.",
            evidence="\n".join(f"  {r['rolname']}: {r['scheme']}" for r in md5_users),
            recommendation="ALTER ROLE <user> PASSWORD '<new>'; — will be hashed with SCRAM.",
            compliance=["PCI DSS 8.3"],
            passed=False,
        ))
    else:
        result.findings.append(Finding(
            check_id="AUTH-002",
            title="All login roles use SCRAM-SHA-256",
            severity="INFO",
            passed=True,
        ))

    if empty_users:
        result.findings.append(Finding(
            check_id="AUTH-003",
            title=f"{len(empty_users)} login roles have empty/no password",
            severity="CRITICAL",
            cwe="CWE-521",
            description="Login-enabled roles with empty or no passwords can be exploited via CVE-2018-10925.",
            evidence="\n".join(f"  {r['rolname']}: {r['scheme']}" for r in empty_users),
            recommendation="ALTER ROLE <user> NOLOGIN; OR ALTER ROLE <user> PASSWORD '<strong>';",
            cve="CVE-2018-10925",
            compliance=["PCI DSS 8.2", "ISO 27001 A.9.4.3"],
            passed=False,
        ))


def check_pg_hba_for_trust(db: DB, result: AuditResult):
    """Check pg_hba.conf for trust auth on non-local connections."""
    try:
        rows = db.execute("""
            SELECT rule_number, type, database, user_name, address, netmask, auth_method
            FROM pg_hba_file_rules
            WHERE auth_method = 'trust'
        """)
    except Exception:
        result.findings.append(Finding(
            check_id="AUTH-004",
            title="Cannot read pg_hba_file_rules (insufficient privileges)",
            severity="INFO",
            description="Connect as superuser to perform this check.",
            passed=True,
        ))
        return

    network_trust = [r for r in rows if r["type"] != "local"]
    if network_trust:
        result.findings.append(Finding(
            check_id="AUTH-004",
            title=f"trust auth in pg_hba for {len(network_trust)} network rules",
            severity="CRITICAL",
            cwe="CWE-287",
            description="trust auth means no password required — full bypass.",
            evidence="\n".join(
                f"  rule {r['rule_number']}: {r['type']} {r['address']} {r['auth_method']}"
                for r in network_trust
            ),
            recommendation="Replace 'trust' with 'scram-sha-256' in pg_hba.conf.",
            compliance=["PCI DSS 8.3", "ISO 27001 A.9.4.3"],
            passed=False,
        ))
    else:
        result.findings.append(Finding(
            check_id="AUTH-004",
            title="No network trust auth in pg_hba.conf",
            severity="INFO",
            passed=True,
        ))


def check_pg_hba_for_wildcard_ips(db: DB, result: AuditResult):
    """Check pg_hba.conf for 0.0.0.0/0 or ::/0."""
    try:
        rows = db.execute("""
            SELECT rule_number, type, address, auth_method, user_name, database
            FROM pg_hba_file_rules
            WHERE address = '0.0.0.0' OR address = '::'
        """)
    except Exception:
        return

    if rows:
        result.findings.append(Finding(
            check_id="AUTH-005",
            title=f"pg_hba allows connections from 0.0.0.0/0 or ::/0",
            severity="HIGH",
            cwe="CWE-668",
            description="Wildcard network rules allow connections from the entire internet.",
            evidence="\n".join(
                f"  rule {r['rule_number']}: {r['type']} {r['address']} {r['user_name']} {r['auth_method']}"
                for r in rows
            ),
            recommendation="Restrict to specific subnets (e.g., 10.0.0.0/8).",
            compliance=["PCI DSS 1.3", "ISO 27001 A.13.1"],
            passed=False,
        ))


def check_superusers(db: DB, result: AuditResult):
    """Count superuser roles."""
    rows = db.execute("SELECT rolname FROM pg_authid WHERE rolsuper ORDER BY rolname")
    if len(rows) > 2:
        result.findings.append(Finding(
            check_id="AUTHZ-001",
            title=f"{len(rows)} superuser roles (should be 1-2 max)",
            severity="MEDIUM",
            cwe="CWE-250",
            description="Excessive superuser accounts increase attack surface.",
            evidence="\n".join(f"  {r['rolname']}" for r in rows),
            recommendation="Remove SUPERUSER from roles that don't strictly need it.",
            compliance=["ISO 27001 A.9.2.3"],
            passed=False,
        ))
    else:
        result.findings.append(Finding(
            check_id="AUTHZ-001",
            title=f"{len(rows)} superuser role(s)",
            severity="INFO",
            evidence="\n".join(f"  {r['rolname']}" for r in rows),
            passed=True,
        ))


def check_app_user_is_not_super(db: DB, result: AuditResult):
    """Check if any non-postgres role connects as superuser."""
    rows = db.execute("""
        SELECT usename, client_addr, count(*) AS conn_count
        FROM pg_stat_activity
        WHERE usename IN (SELECT rolname FROM pg_authid WHERE rolsuper)
          AND client_addr IS NOT NULL
        GROUP BY usename, client_addr
    """)
    if rows:
        result.findings.append(Finding(
            check_id="AUTHZ-002",
            title="Superuser is connected from network (app may use superuser)",
            severity="CRITICAL",
            cwe="CWE-250",
            description="Application connecting as superuser = full compromise on SQLi.",
            evidence="\n".join(f"  {r['usename']} from {r['client_addr']} ({r['conn_count']} conns)"
                              for r in rows),
            recommendation="Create app_user with minimal privileges; use postgres only for admin.",
            compliance=["PCI DSS 7.1", "ISO 27001 A.9.4.4"],
            passed=False,
        ))
    else:
        result.findings.append(Finding(
            check_id="AUTHZ-002",
            title="No superuser connections from network",
            severity="INFO",
            passed=True,
        ))


def check_bypassrls_roles(db: DB, result: AuditResult):
    """Check who has BYPASSRLS."""
    rows = db.execute("SELECT rolname FROM pg_authid WHERE rolbypassrls")
    if len(rows) > 1:
        result.findings.append(Finding(
            check_id="AUTHZ-003",
            title=f"{len(rows)} roles with BYPASSRLS",
            severity="MEDIUM",
            cwe="CWE-732",
            description="BYPASSRLS defeats Row Level Security — should be DBA only.",
            evidence="\n".join(f"  {r['rolname']}" for r in rows),
            recommendation="REVOKE BYPASSRLS from non-DBA roles.",
            compliance=["GDPR Art. 32"],
            passed=False,
        ))
    else:
        result.findings.append(Finding(
            check_id="AUTHZ-003",
            title=f"{len(rows)} role(s) with BYPASSRLS",
            severity="INFO",
            passed=True,
        ))


def check_ssl_enabled(db: DB, result: AuditResult):
    """Check if SSL is enabled."""
    ssl = db.get_setting("ssl")
    if ssl == "on":
        result.findings.append(Finding(
            check_id="NET-001",
            title="SSL is enabled",
            severity="INFO",
            passed=True,
        ))
    else:
        result.findings.append(Finding(
            check_id="NET-001",
            title="SSL is OFF",
            severity="CRITICAL",
            cwe="CWE-319",
            description="Without TLS, all data (including passwords) goes in plaintext.",
            evidence=f"ssl = {ssl}",
            recommendation="Set ssl = on in postgresql.conf and configure certificates.",
            compliance=["PCI DSS 4.1", "GDPR Art. 32", "ISO 27001 A.13.1"],
            passed=False,
        ))


def check_ssl_min_protocol(db: DB, result: AuditResult):
    """Check ssl_min_protocol_version."""
    proto = db.get_setting("ssl_min_protocol_version")
    if proto in ("TLSv1.2", "TLSv1.3"):
        result.findings.append(Finding(
            check_id="NET-002",
            title=f"ssl_min_protocol_version = {proto}",
            severity="INFO",
            passed=True,
        ))
    elif proto in ("TLSv1", "TLSv1.1"):
        result.findings.append(Finding(
            check_id="NET-002",
            title=f"ssl_min_protocol_version = {proto} (deprecated)",
            severity="HIGH",
            cwe="CWE-326",
            description="TLS 1.0/1.1 deprecated since 2020 (RFC 8996).",
            evidence=f"ssl_min_protocol_version = {proto}",
            recommendation="Set ssl_min_protocol_version = 'TLSv1.2'.",
            compliance=["PCI DSS 4.1"],
            passed=False,
        ))
    else:
        result.findings.append(Finding(
            check_id="NET-002",
            title=f"ssl_min_protocol_version = {proto}",
            severity="LOW",
            description="Unknown TLS protocol setting.",
            passed=False,
        ))


def check_listen_addresses(db: DB, result: AuditResult):
    """Check listen_addresses."""
    la = db.get_setting("listen_addresses")
    if la == "*":
        result.findings.append(Finding(
            check_id="NET-003",
            title="listen_addresses = '*' (all interfaces)",
            severity="HIGH",
            cwe="CWE-668",
            description="PostgreSQL listens on all network interfaces. Requires firewall.",
            evidence=f"listen_addresses = {la}",
            recommendation="Set listen_addresses to specific internal IPs.",
            compliance=["PCI DSS 1.3"],
            passed=False,
        ))
    else:
        result.findings.append(Finding(
            check_id="NET-003",
            title=f"listen_addresses = {la}",
            severity="INFO",
            passed=True,
        ))


def check_log_connections(db: DB, result: AuditResult):
    """Check log_connections and log_disconnections."""
    log_conn = db.get_setting("log_connections")
    log_disc = db.get_setting("log_disconnections")
    if log_conn == "on" and log_disc == "on":
        result.findings.append(Finding(
            check_id="AUDIT-001",
            title="log_connections and log_disconnections enabled",
            severity="INFO",
            passed=True,
        ))
    else:
        result.findings.append(Finding(
            check_id="AUDIT-001",
            title="log_connections or log_disconnections is OFF",
            severity="MEDIUM",
            cwe="CWE-778",
            description="Without connection logging, cannot audit who connected when.",
            evidence=f"log_connections = {log_conn}, log_disconnections = {log_disc}",
            recommendation="Set both to 'on' in postgresql.conf.",
            compliance=["PCI DSS 10.2", "ISO 27001 A.12.4"],
            passed=False,
        ))


def check_log_statement_level(db: DB, result: AuditResult):
    """Check log_statement level."""
    level = db.get_setting("log_statement")
    if level == "all":
        sev = "INFO"
        passed = True
        desc = "All statements logged — good for high-security environments."
    elif level == "ddl":
        sev = "INFO"
        passed = True
        desc = "DDL statements logged — minimum recommended."
    elif level == "mod":
        sev = "INFO"
        passed = True
        desc = "DDL + DML logged."
    else:  # none
        sev = "HIGH"
        passed = False
        desc = "No statement logging — no audit trail for DDL or DML."
    result.findings.append(Finding(
        check_id="AUDIT-002",
        title=f"log_statement = '{level}'",
        severity=sev,
        cwe="CWE-778" if not passed else None,
        description=desc,
        evidence=f"log_statement = {level}",
        recommendation="Use 'ddl' minimum; 'all' for PCI DSS." if not passed else "",
        compliance=["PCI DSS 10.2"] if not passed else [],
        passed=passed,
    ))


def check_pgaudit_installed(db: DB, result: AuditResult):
    """Check if pgAudit extension is installed."""
    rows = db.execute("SELECT 1 FROM pg_extension WHERE extname = 'pgaudit'")
    if rows:
        result.findings.append(Finding(
            check_id="AUDIT-003",
            title="pgAudit extension installed",
            severity="INFO",
            passed=True,
        ))
    else:
        result.findings.append(Finding(
            check_id="AUDIT-003",
            title="pgAudit NOT installed",
            severity="MEDIUM",
            description="pgAudit provides detailed query audit logging required for PCI DSS.",
            recommendation="CREATE EXTENSION pgaudit; and configure pgaudit.log.",
            compliance=["PCI DSS 10.2"],
            passed=False,
        ))


def check_dangerous_extensions(db: DB, result: AuditResult):
    """Check for dangerous extensions (plpythonu, dblink, file_fdw, etc.)."""
    rows = db.execute("""
        SELECT extname, extversion
        FROM pg_extension
        WHERE extname IN ('plpythonu', 'plperlu', 'plv8', 'dblink', 'file_fdw', 'adminpack')
    """)
    if rows:
        for r in rows:
            severity = "CRITICAL" if r["extname"] in ("plpythonu", "plperlu", "plv8") else "HIGH"
            desc_map = {
                "plpythonu": "Python in DB → RCE if exploited",
                "plperlu": "Perl in DB → RCE if exploited",
                "plv8": "JavaScript in DB → RCE if V8 vulnerable",
                "dblink": "Cross-DB queries → SSRF/SQLi",
                "file_fdw": "Read OS files",
                "adminpack": "Admin functions via pgAdmin",
            }
            result.findings.append(Finding(
                check_id=f"EXT-{r['extname']}",
                title=f"Dangerous extension installed: {r['extname']}",
                severity=severity,
                cwe="CWE-913",
                description=desc_map.get(r["extname"], "Review security implications."),
                evidence=f"extname={r['extname']}, extversion={r['extversion']}",
                recommendation=f"DROP EXTENSION {r['extname']}; if not strictly needed. "
                              f"Otherwise REVOKE EXECUTE FROM PUBLIC.",
                compliance=["ISO 27001 A.12.6.1"],
                passed=False,
            ))
    else:
        result.findings.append(Finding(
            check_id="EXT-001",
            title="No dangerous extensions installed",
            severity="INFO",
            passed=True,
        ))


def check_public_create_on_public_schema(db: DB, result: AuditResult):
    """Check that PUBLIC cannot CREATE on public schema."""
    # aclexplode в WHERE — антипаттерн (set-returning function).
    # Используем LATERAL JOIN для надёжной работы на всех версиях PG.
    rows = db.execute("""
        SELECT n.nspname,
               acl.grantee,
               acl.privilege_type
        FROM pg_namespace n
        CROSS JOIN LATERAL aclexplode(n.nspacl) AS acl
        WHERE n.nspname = 'public'
          AND acl.grantee = 0
          AND acl.privilege_type = 'CREATE'
    """)
    if rows:
        result.findings.append(Finding(
            check_id="AUTHZ-004",
            title="PUBLIC has CREATE on schema 'public'",
            severity="HIGH",
            cwe="CWE-732",
            description="Any user can create objects in public schema → search_path attacks.",
            recommendation="REVOKE CREATE ON SCHEMA public FROM PUBLIC;",
            compliance=["ISO 27001 A.9.4.4"],
            passed=False,
        ))
    else:
        result.findings.append(Finding(
            check_id="AUTHZ-004",
            title="PUBLIC does not have CREATE on schema 'public'",
            severity="INFO",
            passed=True,
        ))


def check_pg_read_file_revoked(db: DB, result: AuditResult):
    """Check that pg_read_file, lo_import are revoked from PUBLIC."""
    # В новых версиях PostgreSQL эти функции могут уже быть отозваны по умолчанию
    rows = db.execute("""
        SELECT p.proname
        FROM pg_proc p
        JOIN pg_language l ON l.oid = p.prolang
        WHERE p.proname IN (
          'pg_read_file', 'pg_read_binary_file', 'pg_ls_dir', 'pg_stat_file',
          'lo_import', 'lo_export', 'lo_read', 'lo_write', 'lo_get', 'lo_put'
        )
        AND EXISTS (
          SELECT 1 FROM aclexplode(p.proacl) acl
          WHERE acl.grantee = 0  -- PUBLIC
        )
    """)
    if rows:
        result.findings.append(Finding(
            check_id="FS-001",
            title=f"{len(rows)} file/LO functions executable by PUBLIC",
            severity="HIGH",
            cwe="CWE-732",
            description="PUBLIC can execute file-reading / large-object functions.",
            evidence="\n".join(f"  {r['proname']}" for r in rows),
            recommendation="REVOKE EXECUTE ON FUNCTION <name> FROM PUBLIC; for each.",
            compliance=["PCI DSS 7.1"],
            passed=False,
        ))
    else:
        result.findings.append(Finding(
            check_id="FS-001",
            title="File/LO functions revoked from PUBLIC",
            severity="INFO",
            passed=True,
        ))


def check_pg_execute_server_program(db: DB, result: AuditResult):
    """Check who has pg_execute_server_program (COPY PROGRAM privilege)."""
    rows = db.execute("""
        SELECT r.rolname
        FROM pg_authid r
        JOIN pg_auth_members m ON m.member = r.oid
        JOIN pg_authid g ON g.oid = m.roleid
        WHERE g.rolname = 'pg_execute_server_program'
    """)
    if rows:
        result.findings.append(Finding(
            check_id="FS-002",
            title=f"{len(rows)} roles can use COPY PROGRAM (RCE)",
            severity="HIGH",
            cwe="CWE-78",
            description="pg_execute_server_program allows COPY ... TO/FROM PROGRAM = OS command execution.",
            evidence="\n".join(f"  {r['rolname']}" for r in rows),
            recommendation="REVOKE pg_execute_server_program FROM <role>; unless strictly needed.",
            compliance=["PCI DSS 7.1"],
            passed=False,
        ))
    else:
        result.findings.append(Finding(
            check_id="FS-002",
            title="No non-default roles with pg_execute_server_program",
            severity="INFO",
            passed=True,
        ))


def check_rls_enabled_on_tables(db: DB, result: AuditResult):
    """Check tables that should have RLS but don't."""
    # Поиск таблиц с PII-подобными именами без RLS
    rows = db.execute("""
        SELECT n.nspname AS schema, c.relname AS table_name,
               c.relrowsecurity AS rls, c.relforcerowsecurity AS force_rls
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'r'
          AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
          AND c.relname ~* '(user|customer|order|payment|card|account|patient|personal|employee|profile|address|phone|email|ssn|passport|inn|snils)'
          AND c.relrowsecurity = false
        ORDER BY n.nspname, c.relname
    """)
    if rows:
        result.findings.append(Finding(
            check_id="RLS-001",
            title=f"{len(rows)} PII-like tables WITHOUT RLS",
            severity="HIGH",
            cwe="CWE-732",
            description="Tables that likely contain PII do not have Row Level Security.",
            evidence="\n".join(f"  {r['schema']}.{r['table_name']}" for r in rows),
            recommendation="ALTER TABLE <name> ENABLE ROW LEVEL SECURITY; + CREATE POLICY ...",
            compliance=["GDPR Art. 32", "ISO 27001 A.9.4.4"],
            passed=False,
        ))


def check_rls_force(db: DB, result: AuditResult):
    """Check tables with RLS but not FORCED."""
    rows = db.execute("""
        SELECT n.nspname AS schema, c.relname AS table_name
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'r'
          AND c.relrowsecurity = true
          AND c.relforcerowsecurity = false
          AND n.nspname NOT IN ('pg_catalog', 'information_schema')
    """)
    if rows:
        result.findings.append(Finding(
            check_id="RLS-002",
            title=f"{len(rows)} tables with RLS but NOT FORCE",
            severity="MEDIUM",
            cwe="CWE-732",
            description="RLS without FORCE can be bypassed by table owner.",
            evidence="\n".join(f"  {r['schema']}.{r['table_name']}" for r in rows),
            recommendation="ALTER TABLE <name> FORCE ROW LEVEL SECURITY;",
            compliance=["GDPR Art. 32"],
            passed=False,
        ))


def check_security_definer_without_search_path(db: DB, result: AuditResult):
    """Check SECURITY DEFINER functions without explicit search_path."""
    rows = db.execute("""
        SELECT n.nspname, p.proname,
               pg_get_userbyid(p.proowner) AS owner
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE p.prosecdef = true
          AND n.nspname NOT IN ('pg_catalog', 'information_schema')
          AND NOT EXISTS (
            SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%'
          )
    """)
    if rows:
        result.findings.append(Finding(
            check_id="FN-001",
            title=f"{len(rows)} SECURITY DEFINER functions without search_path",
            severity="HIGH",
            cwe="CWE-732",
            description="SECURITY DEFINER functions without explicit search_path are vulnerable to hijacking.",
            evidence="\n".join(f"  {r['nspname']}.{r['proname']} (owner: {r['owner']})" for r in rows),
            recommendation="ALTER FUNCTION <name> SET search_path = <schema>, pg_temp;",
            compliance=["ISO 27001 A.14.2"],
            passed=False,
        ))


def check_password_validuntil(db: DB, result: AuditResult):
    """Check login roles with no password expiry."""
    rows = db.execute("""
        SELECT rolname
        FROM pg_authid
        WHERE rolcanlogin
          AND rolpassword IS NOT NULL
          AND rolvaliduntil IS NULL
        ORDER BY rolname
    """)
    if rows:
        result.findings.append(Finding(
            check_id="AUTH-006",
            title=f"{len(rows)} login roles with no password expiry (rolvaliduntil = NULL)",
            severity="LOW",
            cwe="CWE-732",
            description="Passwords never expire → if leaked, valid forever.",
            evidence="\n".join(f"  {r['rolname']}" for r in rows),
            recommendation="ALTER ROLE <user> VALID UNTIL '<date>'; rotate periodically.",
            compliance=["ISO 27001 A.9.2.4"],
            passed=False,
        ))


def check_default_transaction_read_only(db: DB, result: AuditResult):
    """Check if database is read-only by default (good for replicas)."""
    setting = db.get_setting("default_transaction_read_only")
    result.findings.append(Finding(
        check_id="CFG-001",
        title=f"default_transaction_read_only = {setting}",
        severity="INFO",
        passed=True,
    ))


def check_archive_mode(db: DB, result: AuditResult):
    """Check archive_mode for backup integrity."""
    setting = db.get_setting("archive_mode")
    if setting in ("on", "always"):
        result.findings.append(Finding(
            check_id="BACKUP-001",
            title=f"archive_mode = {setting}",
            severity="INFO",
            passed=True,
        ))
    else:
        result.findings.append(Finding(
            check_id="BACKUP-001",
            title="archive_mode = off (no WAL archiving)",
            severity="MEDIUM",
            cwe="CWE-732",
            description="Without WAL archiving, point-in-time recovery is impossible.",
            recommendation="Set archive_mode = on and configure archive_command.",
            compliance=["PCI DSS 3.1", "ISO 27001 A.12.3"],
            passed=False,
        ))


def check_replication_slots(db: DB, result: AuditResult):
    """Check for abandoned replication slots."""
    rows = db.execute("""
        SELECT slot_name, slot_type, restart_lsn,
               pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn) AS bytes_retained
        FROM pg_replication_slots
        WHERE NOT active
        ORDER BY bytes_retained DESC
    """)
    if rows:
        result.findings.append(Finding(
            check_id="REPL-001",
            title=f"{len(rows)} inactive replication slots (potential WAL bloat / DoS)",
            severity="MEDIUM",
            cwe="CWE-400",
            description="Inactive replication slots cause WAL to be retained → disk full.",
            evidence="\n".join(
                f"  {r['slot_name']}: {r['bytes_retained']} bytes retained"
                for r in rows
            ),
            recommendation="pg_drop_replication_slot('<name>'); if slot is no longer needed.",
            passed=False,
        ))


def check_failed_login_attempts(db: DB, result: AuditResult):
    """Check stat for failed auth attempts (best-effort, requires pg_stat_bgwriter logs)."""
    # PostgreSQL не сохраняет failed auth count нативно, но можно глянуть логи
    # Эта проверка заглушка — нужно парсить логи.
    result.findings.append(Finding(
        check_id="MON-001",
        title="Failed login attempts not tracked natively",
        severity="INFO",
        description="Parse PostgreSQL logs for 'password authentication failed' to detect brute-force.",
        recommendation="Configure log_connections=on + monitor logs in SIEM.",
        compliance=["PCI DSS 10.2"],
        passed=True,
    ))


def check_shared_preload_libraries(db: DB, result: AuditResult):
    """Check shared_preload_libraries for dangerous extensions."""
    setting = db.get_setting("shared_preload_libraries")
    dangerous = ["plpythonu", "plperlu", "plv8"]
    found = [d for d in dangerous if d in (setting or "")]
    if found:
        result.findings.append(Finding(
            check_id="CFG-002",
            title=f"shared_preload_libraries contains: {', '.join(found)}",
            severity="CRITICAL",
            cwe="CWE-913",
            description="Dangerous language extensions preloaded — always available for RCE.",
            evidence=f"shared_preload_libraries = {setting}",
            recommendation="Remove dangerous extensions from shared_preload_libraries.",
            passed=False,
        ))
    else:
        result.findings.append(Finding(
            check_id="CFG-002",
            title=f"shared_preload_libraries = {setting}",
            severity="INFO",
            passed=True,
        ))


def check_standard_conforming_strings(db: DB, result: AuditResult):
    """Check standard_conforming_strings is on."""
    setting = db.get_setting("standard_conforming_strings")
    if setting == "on":
        result.findings.append(Finding(
            check_id="CFG-003",
            title="standard_conforming_strings = on",
            severity="INFO",
            passed=True,
        ))
    else:
        result.findings.append(Finding(
            check_id="CFG-003",
            title="standard_conforming_strings = off (SQLi risk)",
            severity="HIGH",
            cwe="CWE-89",
            description="Non-standard string escaping allows SQLi through backslash injection.",
            recommendation="Set standard_conforming_strings = on in postgresql.conf.",
            passed=False,
        ))


# ============================================================
# Main
# ============================================================

def main():
    parser = argparse.ArgumentParser(
        description="Antigravity PostgreSQL security scanner"
    )
    parser.add_argument("--host", default="localhost")
    parser.add_argument("--port", type=int, default=5432)
    parser.add_argument("--user", required=True)
    parser.add_argument("--database", default="postgres")
    parser.add_argument("--password", help="Password (insecure; use --password-file)")
    parser.add_argument("--password-file", help="File with password (chmod 600)")
    parser.add_argument("--dsn", help="Full connection string (overrides individual params)")
    parser.add_argument("--sslmode", default="verify-full",
                       choices=["disable", "allow", "prefer", "require", "verify-ca", "verify-full"],
                       help="SSL mode (default: verify-full per security best practices; "
                            "use 'prefer' only for trusted local networks)")
    parser.add_argument("--output", default="json", choices=["json", "markdown", "text"])
    parser.add_argument("--output-file", help="Write to file instead of stdout")
    args = parser.parse_args()

    # Get password
    password = args.password
    if args.password_file:
        with open(args.password_file, "r") as f:
            password = f.read().strip()
        os.remove(args.password_file) if False else None  # don't remove, user may need
    elif not password and not args.dsn:
        # Try ~/.pgpass
        pgpass = os.path.expanduser("~/.pgpass")
        if os.path.exists(pgpass):
            with open(pgpass, "r") as f:
                for line in f:
                    parts = line.strip().split(":")
                    if len(parts) >= 5 and parts[0] in (args.host, "*") and parts[3] == args.user:
                        password = parts[4]
                        break

    # Connect
    conn_params = {
        "host": args.host,
        "port": args.port,
        "user": args.user,
        "password": password,
        "dbname": args.database,
        "sslmode": args.sslmode,
        "connect_timeout": 10,
    }
    if args.dsn:
        conn_params = {"dsn": args.dsn, "sslmode": args.sslmode}

    db = DB(conn_params)
    try:
        db.connect()
    except Exception as e:
        print(f"ERROR: Cannot connect to PostgreSQL: {e}", file=sys.stderr)
        sys.exit(2)

    # Initialize result
    result = AuditResult(
        target=f"{args.host}:{args.port}/{args.database}",
        timestamp=datetime.datetime.utcnow().isoformat() + "Z",
        version="",
    )

    # Run all checks
    checks = [
        check_version,
        check_password_encryption,
        check_md5_password_hashes,
        check_pg_hba_for_trust,
        check_pg_hba_for_wildcard_ips,
        check_superusers,
        check_app_user_is_not_super,
        check_bypassrls_roles,
        check_ssl_enabled,
        check_ssl_min_protocol,
        check_listen_addresses,
        check_log_connections,
        check_log_statement_level,
        check_pgaudit_installed,
        check_dangerous_extensions,
        check_public_create_on_public_schema,
        check_pg_read_file_revoked,
        check_pg_execute_server_program,
        check_rls_enabled_on_tables,
        check_rls_force,
        check_security_definer_without_search_path,
        check_password_validuntil,
        check_default_transaction_read_only,
        check_archive_mode,
        check_replication_slots,
        check_failed_login_attempts,
        check_shared_preload_libraries,
        check_standard_conforming_strings,
    ]
    for check in checks:
        try:
            check(db, result)
        except Exception as e:
            result.findings.append(Finding(
                check_id=check.__name__.upper(),
                title=f"Check failed: {check.__name__}: {e}",
                severity="LOW",
                description=str(e),
                passed=False,
            ))

    db.close()

    # Output
    output_data = result.to_dict()
    if args.output == "json":
        output_text = json.dumps(output_data, indent=2, ensure_ascii=False, default=str)
    elif args.output == "markdown":
        output_text = format_markdown(result)
    else:  # text
        output_text = format_text(result)

    if args.output_file:
        with open(args.output_file, "w") as f:
            f.write(output_text)
        print(f"Report saved to {args.output_file}", file=sys.stderr)
    else:
        print(output_text)

    # Exit code based on findings
    failed_critical = sum(1 for f in result.findings if not f.passed and f.severity == "CRITICAL")
    failed_high = sum(1 for f in result.findings if not f.passed and f.severity == "HIGH")
    if failed_critical:
        sys.exit(2)
    elif failed_high:
        sys.exit(1)
    sys.exit(0)


def format_markdown(result: AuditResult) -> str:
    lines = [
        "# Antigravity PostgreSQL Security Audit Report",
        "",
        f"**Target**: `{result.target}`",
        f"**Timestamp**: {result.timestamp}",
        f"**Version**: {result.version}",
        "",
        "## Summary",
        "",
        f"- Total checks: {len(result.findings)}",
        f"- Passed: {sum(1 for f in result.findings if f.passed)}",
        f"- Failed: {sum(1 for f in result.findings if not f.passed)}",
        f"- Critical: {sum(1 for f in result.findings if not f.passed and f.severity == 'CRITICAL')}",
        f"- High: {sum(1 for f in result.findings if not f.passed and f.severity == 'HIGH')}",
        f"- Medium: {sum(1 for f in result.findings if not f.passed and f.severity == 'MEDIUM')}",
        f"- Low: {sum(1 for f in result.findings if not f.passed and f.severity == 'LOW')}",
        "",
        "## Findings",
        "",
    ]
    for f in result.findings:
        if f.passed:
            continue  # skip passed in markdown summary
        lines.extend([
            f"### [{f.severity}] {f.check_id}: {f.title}",
            "",
        ])
        if f.cve:
            lines.append(f"**CVE**: {f.cve}")
        if f.cwe:
            lines.append(f"**CWE**: {f.cwe}")
        lines.append(f"**Description**: {f.description}")
        if f.evidence:
            lines.append("")
            lines.append("**Evidence**:")
            lines.append(f"```")
            lines.append(f.evidence)
            lines.append("```")
        if f.recommendation:
            lines.append("")
            lines.append(f"**Recommendation**: {f.recommendation}")
        if f.compliance:
            lines.append("")
            lines.append(f"**Compliance**: {', '.join(f.compliance)}")
        lines.append("")
    return "\n".join(lines)


def format_text(result: AuditResult) -> str:
    lines = [
        "Antigravity PostgreSQL Security Audit",
        f"Target: {result.target}",
        f"Timestamp: {result.timestamp}",
        f"Version: {result.version}",
        "=" * 60,
    ]
    for f in result.findings:
        status = "PASS" if f.passed else "FAIL"
        lines.append(f"[{status}] {f.severity:8s} {f.check_id:12s} {f.title}")
    return "\n".join(lines)


if __name__ == "__main__":
    main()
