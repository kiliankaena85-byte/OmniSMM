#!/usr/bin/env python3
"""
Antigravity: IaC Linter for PostgreSQL Infrastructure-as-Code
=============================================================

Проверяет Terraform (.tf), Kubernetes (.yaml/.yml) и Docker Compose файлы
на небезопасные настройки PostgreSQL.

Запуск:
    python3 iac_linter.py --path ./infra/ --format markdown > iac_audit.md

Все проверки — read-only. Ничего не модифицирует.
"""

import argparse
import os
import sys
import json
import re
from dataclasses import dataclass, field, asdict
from typing import List, Optional, Dict, Any
import hashlib


# ============================================================
# Data classes
# ============================================================

@dataclass
class Finding:
    file: str
    line: int
    rule_id: str
    severity: str  # CRITICAL / HIGH / MEDIUM / LOW
    description: str
    evidence: str = ""
    recommendation: str = ""
    cwe: Optional[str] = None
    compliance: List[str] = field(default_factory=list)


# ============================================================
# Terraform rules
# ============================================================

def lint_terraform(content: str, filepath: str) -> List[Finding]:
    findings = []
    lines = content.split("\n")

    # Rule 1: AWS RDS publicly accessible
    for i, line in enumerate(lines, 1):
        if "publicly_accessible" in line and "true" in line:
            findings.append(Finding(
                file=filepath, line=i,
                rule_id="TF-AWS-RDS-001",
                severity="CRITICAL",
                description="RDS instance is publicly accessible",
                evidence=line.strip(),
                recommendation="Set publicly_accessible = false",
                cwe="CWE-668",
                compliance=["PCI DSS 1.3", "ISO 27001 A.13.1"],
            ))

    # Rule 2: RDS without encryption at rest
    if "aws_db_instance" in content or "aws_rds_cluster" in content:
        if "storage_encrypted" not in content or 'storage_encrypted = false' in content:
            findings.append(Finding(
                file=filepath, line=0,
                rule_id="TF-AWS-RDS-002",
                severity="HIGH",
                description="RDS instance without storage encryption at rest",
                evidence="storage_encrypted not set or false",
                recommendation="Set storage_encrypted = true and use kms_key_id",
                cwe="CWE-311",
                compliance=["PCI DSS 3.4", "GDPR Art. 32"],
            ))

    # Rule 3: RDS without deletion protection
    if "aws_db_instance" in content:
        if "deletion_protection" not in content or "deletion_protection = false" in content:
            findings.append(Finding(
                file=filepath, line=0,
                rule_id="TF-AWS-RDS-003",
                severity="MEDIUM",
                description="RDS instance without deletion protection",
                evidence="deletion_protection not set",
                recommendation="Set deletion_protection = true in production",
                cwe="CWE-732",
                compliance=["ISO 27001 A.12.3"],
            ))

    # Rule 4: Hardcoded password in Terraform
    password_patterns = [
        r'password\s*=\s*"([^""]+)"',
        r'master_password\s*=\s*"([^""]+)"',
        r'db_password\s*=\s*"([^""]+)"',
        r'postgres_password\s*=\s*"([^""]+)"',
    ]
    for i, line in enumerate(lines, 1):
        for pat in password_patterns:
            m = re.search(pat, line)
            if m and m.group(1) and not m.group(1).startswith("${"):
                findings.append(Finding(
                    file=filepath, line=i,
                    rule_id="TF-SECRET-001",
                    severity="CRITICAL",
                    description=f"Hardcoded password in Terraform: '{m.group(1)[:3]}...'",
                    evidence=line.strip(),
                    recommendation="Use variable with sensitive = true + reference from AWS Secrets Manager / Vault",
                    cwe="CWE-798",
                    compliance=["PCI DSS 8.3", "ISO 27001 A.9.4.3"],
                ))

    # Rule 5: AWS RDS without backup retention
    if "aws_db_instance" in content:
        if "backup_retention_period" not in content:
            findings.append(Finding(
                file=filepath, line=0,
                rule_id="TF-AWS-RDS-004",
                severity="MEDIUM",
                description="RDS without backup retention configured",
                evidence="backup_retention_period not set",
                recommendation="Set backup_retention_period = 7 (or more for compliance)",
                cwe="CWE-732",
                compliance=["PCI DSS 3.1", "ISO 27001 A.12.3"],
            ))

    # Rule 6: Skip final snapshot
    if "skip_final_snapshot" in content and "true" in content:
        findings.append(Finding(
            file=filepath, line=0,
            rule_id="TF-AWS-RDS-005",
            severity="MEDIUM",
            description="RDS will skip final snapshot on deletion",
            evidence="skip_final_snapshot = true",
            recommendation="Set skip_final_snapshot = false for production",
            cwe="CWE-732",
            compliance=["ISO 27001 A.12.3"],
        ))

    # Rule 7: AWS security group with 0.0.0.0/0 for 5432
    in_sg_block = False
    sg_block_start = 0
    for i, line in enumerate(lines, 1):
        if 'resource "aws_security_group"' in line or 'resource "aws_vpc_security_group_ingress_rule"' in line:
            in_sg_block = True
            sg_block_start = i
        if in_sg_block and "5432" in line:
            # Look around for 0.0.0.0/0
            context = "\n".join(lines[max(0, i-5):min(len(lines), i+5)])
            if "0.0.0.0/0" in context or "::/0" in context:
                findings.append(Finding(
                    file=filepath, line=i,
                    rule_id="TF-AWS-SG-001",
                    severity="CRITICAL",
                    description="Security group allows 0.0.0.0/0 to port 5432",
                    evidence=line.strip(),
                    recommendation="Restrict to specific CIDR blocks (internal networks only)",
                    cwe="CWE-668",
                    compliance=["PCI DSS 1.3"],
                ))

    # Rule 8: GCP Cloud SQL with ipv4 enabled (public IP)
    if "google_sql_database_instance" in content:
        if "ipv4_enabled" in content and "true" in content:
            findings.append(Finding(
                file=filepath, line=0,
                rule_id="TF-GCP-SQL-001",
                severity="HIGH",
                description="Cloud SQL instance has public IPv4 enabled",
                evidence="ipv4_enabled = true",
                recommendation="Use private IP via private_network, disable ipv4_enabled",
                cwe="CWE-668",
                compliance=["PCI DSS 1.3"],
            ))

    # Rule 9: Azure PostgreSQL with public access
    if "azurerm_postgresql_server" in content or "azurerm_postgresql_flexible_server" in content:
        if "public_network_access_enabled" in content and "true" in content:
            findings.append(Finding(
                file=filepath, line=0,
                rule_id="TF-AZURE-PG-001",
                severity="HIGH",
                description="Azure PostgreSQL with public network access enabled",
                evidence="public_network_access_enabled = true",
                recommendation="Set public_network_access_enabled = false; use private endpoints",
                cwe="CWE-668",
                compliance=["PCI DSS 1.3"],
            ))

    # Rule 10: Azure PostgreSQL SSL enforcement disabled
    if "azurerm_postgresql_server" in content:
        if "ssl_enforcement_enabled" in content and "false" in content:
            findings.append(Finding(
                file=filepath, line=0,
                rule_id="TF-AZURE-PG-002",
                severity="HIGH",
                description="Azure PostgreSQL with SSL enforcement disabled",
                evidence="ssl_enforcement_enabled = false",
                recommendation="Set ssl_enforcement_enabled = true",
                cwe="CWE-319",
                compliance=["PCI DSS 4.1"],
            ))

    # Rule 11: TLS version too low
    tls_patterns = ["tls_version = \"TLS1_0\"", "tls_version = \"TLS1_1\"",
                    "ssl_minimal_tls_version_enforced = \"TLS1_0\"",
                    "ssl_minimal_tls_version_enforced = \"TLS1_1\""]
    for pat in tls_patterns:
        if pat in content:
            idx = content.find(pat)
            line_num = content[:idx].count("\n") + 1
            findings.append(Finding(
                file=filepath, line=line_num,
                rule_id="TF-TLS-001",
                severity="HIGH",
                description=f"TLS version too low: {pat}",
                evidence=pat,
                recommendation="Use TLS1_2 or higher",
                cwe="CWE-326",
                compliance=["PCI DSS 4.1"],
            ))

    return findings


# ============================================================
# Kubernetes rules
# ============================================================

def lint_kubernetes(content: str, filepath: str) -> List[Finding]:
    findings = []

    # Simple YAML parsing without PyYAML (line-based heuristics)
    lines = content.split("\n")

    # Rule 1: privileged container
    for i, line in enumerate(lines, 1):
        if "privileged:" in line and "true" in line:
            findings.append(Finding(
                file=filepath, line=i,
                rule_id="K8S-001",
                severity="CRITICAL",
                description="Privileged container",
                evidence=line.strip(),
                recommendation="Set privileged: false or remove",
                cwe="CWE-250",
                compliance=["ISO 27001 A.9.4.4"],
            ))

    # Rule 2: runAsUser: 0 (root)
    for i, line in enumerate(lines, 1):
        if re.search(r"runAsUser:\s*0\b", line):
            findings.append(Finding(
                file=filepath, line=i,
                rule_id="K8S-002",
                severity="HIGH",
                description="Container runs as root (runAsUser: 0)",
                evidence=line.strip(),
                recommendation="Use runAsUser: 999 (postgres) and runAsNonRoot: true",
                cwe="CWE-250",
                compliance=["ISO 27001 A.9.4.4"],
            ))

    # Rule 3: allowPrivilegeEscalation: true
    for i, line in enumerate(lines, 1):
        if "allowPrivilegeEscalation:" in line and "true" in line:
            findings.append(Finding(
                file=filepath, line=i,
                rule_id="K8S-003",
                severity="HIGH",
                description="allowPrivilegeEscalation: true",
                evidence=line.strip(),
                recommendation="Set allowPrivilegeEscalation: false",
                cwe="CWE-269",
            ))

    # Rule 4: no readOnlyRootFilesystem (need to detect absence)
    if "kind:" in content and "Pod" in content or "StatefulSet" in content or "Deployment" in content:
        has_read_only = "readOnlyRootFilesystem:" in content
        if not has_read_only and "containers:" in content:
            findings.append(Finding(
                file=filepath, line=0,
                rule_id="K8S-004",
                severity="MEDIUM",
                description="readOnlyRootFilesystem not set (default false)",
                evidence="not specified",
                recommendation="Set readOnlyRootFilesystem: true; mount /tmp and /var/run/postgresql as emptyDir",
                cwe="CWE-732",
            ))

    # Rule 5: missing securityContext
    if "containers:" in content and "securityContext:" not in content:
        findings.append(Finding(
            file=filepath, line=0,
            rule_id="K8S-005",
            severity="HIGH",
            description="No securityContext defined for containers",
            evidence="securityContext not found in manifest",
            recommendation="Add securityContext with runAsNonRoot, capabilities.drop, seccompProfile",
            cwe="CWE-732",
            compliance=["ISO 27001 A.9.4.4"],
        ))

    # Rule 6: hostPath volume (escape risk)
    for i, line in enumerate(lines, 1):
        if "hostPath:" in line:
            findings.append(Finding(
                file=filepath, line=i,
                rule_id="K8S-006",
                severity="HIGH",
                description="hostPath volume mounted (potential host escape)",
                evidence=line.strip(),
                recommendation="Use PVC instead of hostPath",
                cwe="CWE-250",
            ))

    # Rule 7: hostNetwork, hostPID, hostIPC
    for i, line in enumerate(lines, 1):
        for flag in ["hostNetwork:", "hostPID:", "hostIPC:"]:
            if flag in line and "true" in line:
                findings.append(Finding(
                    file=filepath, line=i,
                    rule_id="K8S-007",
                    severity="HIGH",
                    description=f"{flag.strip(':')} enabled (host namespace sharing)",
                    evidence=line.strip(),
                    recommendation=f"Set {flag.strip()} false",
                    cwe="CWE-250",
                ))

    # Rule 8: no resource limits
    if "containers:" in content and "resources:" not in content:
        findings.append(Finding(
            file=filepath, line=0,
            rule_id="K8S-008",
            severity="MEDIUM",
            description="No resource limits/requests defined",
            evidence="resources: not specified",
            recommendation="Add resources.requests and resources.limits (cpu, memory)",
            cwe="CWE-400",
        ))

    # Rule 9: latest image tag
    for i, line in enumerate(lines, 1):
        if "image:" in line and "postgres" in line:
            # extract image:tag
            m = re.search(r'image:\s*["\']?([^\s"\']+)["\']?', line)
            if m:
                image = m.group(1)
                if ":" not in image or image.endswith(":latest"):
                    findings.append(Finding(
                        file=filepath, line=i,
                        rule_id="K8S-009",
                        severity="MEDIUM",
                        description=f"Image without pinned tag: {image}",
                        evidence=line.strip(),
                        recommendation="Use specific tag (postgres:15.8) or digest (@sha256:...)",
                        cwe="CWE-1104",
                    ))

    # Rule 10: ConfigMap with password
    if "kind: ConfigMap" in content:
        for i, line in enumerate(lines, 1):
            if re.search(r'(password|secret|token|key):\s*["\']?[A-Za-z0-9]', line, re.IGNORECASE):
                if not re.search(r'\$\{|\{\{', line):  # skip templated values
                    findings.append(Finding(
                        file=filepath, line=i,
                        rule_id="K8S-010",
                        severity="CRITICAL",
                        description="Possible secret in ConfigMap (should be in Secret)",
                        evidence=line.strip(),
                        recommendation="Move secret value to Kubernetes Secret with encryption at rest",
                        cwe="CWE-798",
                        compliance=["PCI DSS 8.3", "ISO 27001 A.9.4.3"],
                    ))

    # Rule 11: env var with password directly
    in_env = False
    for i, line in enumerate(lines, 1):
        if re.match(r"\s*env:", line):
            in_env = True
        elif in_env and re.match(r"\s*-\s*name:\s*(POSTGRES_PASSWORD|DB_PASSWORD|DATABASE_PASSWORD|PGPASSWORD)", line):
            # Look ahead for value: "..."
            for j in range(i, min(i+5, len(lines))):
                if re.match(r"\s*value:\s*[\"']?[A-Za-z0-9]", lines[j-1]):
                    findings.append(Finding(
                        file=filepath, line=j,
                        rule_id="K8S-011",
                        severity="CRITICAL",
                        description="Password hardcoded in env var",
                        evidence=lines[j-1].strip(),
                        recommendation="Use valueFrom.secretKeyRef instead of value",
                        cwe="CWE-798",
                        compliance=["PCI DSS 8.3"],
                    ))
                    break

    # Rule 12: emptyDir without size limit on PostgreSQL data
    for i, line in enumerate(lines, 1):
        if "emptyDir:" in line:
            # Check next 5 lines for sizeLimit
            context = "\n".join(lines[i:min(i+5, len(lines))])
            if "sizeLimit" not in context:
                findings.append(Finding(
                    file=filepath, line=i,
                    rule_id="K8S-012",
                    severity="LOW",
                    description="emptyDir without sizeLimit (DoS risk)",
                    evidence=line.strip(),
                    recommendation="Add sizeLimit to emptyDir",
                    cwe="CWE-400",
                ))

    # Rule 13: no NetworkPolicy in namespace (warning only)
    # (Can't easily check from a single file, skip)

    return findings


# ============================================================
# Docker Compose rules
# ============================================================

def lint_compose(content: str, filepath: str) -> List[Finding]:
    findings = []
    lines = content.split("\n")

    # Detect postgres service
    has_postgres = "postgres:" in content or "image: postgres" in content
    if not has_postgres:
        return findings

    # Rule 1: privileged: true
    for i, line in enumerate(lines, 1):
        if "privileged:" in line and "true" in line:
            findings.append(Finding(
                file=filepath, line=i,
                rule_id="COMPOSE-001",
                severity="CRITICAL",
                description="privileged: true on postgres container",
                evidence=line.strip(),
                recommendation="Remove privileged: true; use cap_add for specific capabilities",
                cwe="CWE-250",
            ))

    # Rule 2: POSTGRES_PASSWORD in env directly
    for i, line in enumerate(lines, 1):
        if re.search(r"POSTGRES_PASSWORD[:=]\s*[\"']?[A-Za-z0-9]", line):
            if not re.search(r"\$\{|{{", line):
                findings.append(Finding(
                    file=filepath, line=i,
                    rule_id="COMPOSE-002",
                    severity="CRITICAL",
                    description="POSTGRES_PASSWORD hardcoded in compose",
                    evidence=line.strip(),
                    recommendation="Use secrets: or env_file: with chmod 600",
                    cwe="CWE-798",
                    compliance=["PCI DSS 8.3"],
                ))

    # Rule 3: ports published to 0.0.0.0
    for i, line in enumerate(lines, 1):
        # Match patterns like "5432:5432" or "0.0.0.0:5432:5432"
        if re.search(r"^\s*-\s*[\"']?(0\.0\.0\.0:|)5432:5432", line):
            findings.append(Finding(
                file=filepath, line=i,
                rule_id="COMPOSE-003",
                severity="HIGH",
                description="Port 5432 published to all interfaces",
                evidence=line.strip(),
                recommendation="Use '127.0.0.1:5432:5432' or remove ports (use internal network)",
                cwe="CWE-668",
                compliance=["PCI DSS 1.3"],
            ))

    # Rule 4: no security_opt
    if "security_opt:" not in content:
        findings.append(Finding(
            file=filepath, line=0,
            rule_id="COMPOSE-004",
            severity="MEDIUM",
            description="No security_opt defined (no no-new-privileges)",
            evidence="security_opt not in compose file",
            recommendation="Add security_opt: [no-new-privileges:true]",
            cwe="CWE-732",
        ))

    # Rule 5: no cap_drop
    if "cap_drop:" not in content:
        findings.append(Finding(
            file=filepath, line=0,
            rule_id="COMPOSE-005",
            severity="MEDIUM",
            description="No cap_drop (all Linux capabilities retained)",
            evidence="cap_drop not in compose file",
            recommendation="Add cap_drop: [ALL] and cap_add only specific caps",
            cwe="CWE-250",
        ))

    # Rule 6: no read_only
    if "read_only:" not in content:
        findings.append(Finding(
            file=filepath, line=0,
            rule_id="COMPOSE-006",
            severity="LOW",
            description="read_only not set (filesystem is writable)",
            evidence="read_only not in compose file",
            recommendation="Set read_only: true and mount /tmp as tmpfs",
            cwe="CWE-732",
        ))

    # Rule 7: no resource limits
    if "mem_limit:" not in content and "deploy:" not in content:
        findings.append(Finding(
            file=filepath, line=0,
            rule_id="COMPOSE-007",
            severity="LOW",
            description="No memory/CPU limits set",
            evidence="mem_limit / deploy.resources not found",
            recommendation="Add deploy.resources.limits (cpu, memory)",
            cwe="CWE-400",
        ))

    # Rule 8: no user
    if "user:" not in content:
        findings.append(Finding(
            file=filepath, line=0,
            rule_id="COMPOSE-008",
            severity="MEDIUM",
            description="No user specified (defaults to image user — postgres, but should be explicit)",
            evidence="user: not set",
            recommendation="Add user: '999:999' (postgres uid:gid)",
            cwe="CWE-250",
        ))

    # Rule 9: postgres:latest image
    for i, line in enumerate(lines, 1):
        if "image: postgres:latest" in line or "image: postgres\"" in line:
            findings.append(Finding(
                file=filepath, line=i,
                rule_id="COMPOSE-009",
                severity="MEDIUM",
                description="postgres:latest or untagged image",
                evidence=line.strip(),
                recommendation="Use specific tag: postgres:15.8-alpine",
                cwe="CWE-1104",
            ))

    return findings


# ============================================================
# Main
# ============================================================

def find_files(path: str) -> List[str]:
    """Find all .tf, .yaml, .yml, .compose files."""
    files = []
    extensions = (".tf", ".yaml", ".yml")
    compose_names = ("docker-compose.yaml", "docker-compose.yml",
                     "docker-compose.override.yaml", "docker-compose.override.yml")
    for root, dirs, fnames in os.walk(path):
        # Skip .git, node_modules, etc.
        dirs[:] = [d for d in dirs if d not in (".git", "node_modules", ".terraform", "__pycache__")]
        for fname in fnames:
            if fname.endswith(extensions) or fname in compose_names:
                files.append(os.path.join(root, fname))
    return files


def lint_file(filepath: str) -> List[Finding]:
    """Lint a single file based on extension."""
    try:
        with open(filepath, "r") as f:
            content = f.read()
    except Exception as e:
        return [Finding(
            file=filepath, line=0,
            rule_id="LINT-ERROR",
            severity="LOW",
            description=f"Cannot read file: {e}",
        )]

    if filepath.endswith(".tf"):
        return lint_terraform(content, filepath)
    elif filepath.endswith((".yaml", ".yml")):
        # Determine if it's compose or k8s
        if "docker-compose" in os.path.basename(filepath):
            return lint_compose(content, filepath)
        # Check for k8s markers
        if re.search(r"^kind:\s*\w+", content, re.MULTILINE) and re.search(r"^apiVersion:\s*", content, re.MULTILINE):
            return lint_kubernetes(content, filepath)
        # If has 'services:' it's compose
        if re.match(r"^\s*version:\s*[\"']?\d", content, re.MULTILINE) or re.match(r"^\s*services:", content, re.MULTILINE):
            return lint_compose(content, filepath)
        # Default: try both
        return lint_kubernetes(content, filepath) + lint_compose(content, filepath)
    return []


def main():
    parser = argparse.ArgumentParser(
        description="Antigravity IaC linter for PostgreSQL"
    )
    parser.add_argument("--path", required=True, help="Path to scan (file or directory)")
    parser.add_argument("--format", default="markdown", choices=["markdown", "json", "text"])
    parser.add_argument("--output", help="Output file (default stdout)")
    args = parser.parse_args()

    if os.path.isfile(args.path):
        files = [args.path]
    else:
        files = find_files(args.path)

    all_findings = []
    for f in files:
        all_findings.extend(lint_file(f))

    # Sort by severity
    severity_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
    all_findings.sort(key=lambda x: (severity_order.get(x.severity, 99), x.file, x.line))

    if args.format == "json":
        output = json.dumps(
            {"findings": [asdict(f) for f in all_findings]},
            indent=2, ensure_ascii=False
        )
    elif args.format == "text":
        lines = ["Antigravity IaC Linter", "=" * 60]
        for f in all_findings:
            lines.append(f"[{f.severity}] {f.rule_id} {f.file}:{f.line}")
            lines.append(f"  {f.description}")
            if f.evidence:
                lines.append(f"  Evidence: {f.evidence}")
            if f.recommendation:
                lines.append(f"  Fix: {f.recommendation}")
            lines.append("")
        output = "\n".join(lines)
    else:  # markdown
        output = format_markdown(all_findings, files)

    if args.output:
        with open(args.output, "w") as f:
            f.write(output)
        print(f"Report saved to {args.output}", file=sys.stderr)
    else:
        print(output)

    # Exit code based on findings
    critical = sum(1 for f in all_findings if f.severity == "CRITICAL")
    high = sum(1 for f in all_findings if f.severity == "HIGH")
    if critical:
        sys.exit(2)
    elif high:
        sys.exit(1)
    sys.exit(0)


def format_markdown(findings: List[Finding], files: List[str]) -> str:
    lines = [
        "# Antigravity IaC Security Audit Report",
        "",
        f"**Files scanned**: {len(files)}",
        f"**Findings**: {len(findings)}",
        "",
        "## Summary",
        "",
        f"- CRITICAL: {sum(1 for f in findings if f.severity == 'CRITICAL')}",
        f"- HIGH: {sum(1 for f in findings if f.severity == 'HIGH')}",
        f"- MEDIUM: {sum(1 for f in findings if f.severity == 'MEDIUM')}",
        f"- LOW: {sum(1 for f in findings if f.severity == 'LOW')}",
        "",
        "## Files Scanned",
        "",
    ]
    for f in files:
        lines.append(f"- `{f}`")
    lines.append("")
    lines.append("## Findings")
    lines.append("")
    if not findings:
        lines.append("✅ No findings.")
    current_severity = None
    for f in findings:
        if f.severity != current_severity:
            lines.append(f"\n### {f.severity}\n")
            current_severity = f.severity
        lines.append(f"#### {f.rule_id} — `{f.file}:{f.line}`")
        lines.append("")
        lines.append(f"**Description**: {f.description}")
        if f.evidence:
            lines.append("")
            lines.append("**Evidence**:")
            lines.append("```")
            lines.append(f.evidence)
            lines.append("```")
        if f.recommendation:
            lines.append("")
            lines.append(f"**Recommendation**: {f.recommendation}")
        if f.cwe:
            lines.append(f"**CWE**: {f.cwe}")
        if f.compliance:
            lines.append(f"**Compliance**: {', '.join(f.compliance)}")
        lines.append("")
    return "\n".join(lines)


if __name__ == "__main__":
    main()
