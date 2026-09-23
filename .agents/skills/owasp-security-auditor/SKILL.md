---
name: owasp-security-auditor
description: >
  Performs a comprehensive OWASP-based security audit of a software project.
  Activates when the user asks to check project security, run a security review,
  find vulnerabilities, audit code for OWASP Top 10:2025 risks, validate ASVS
  compliance, or generate a security report. Covers broken access control,
  injection, cryptographic failures, supply chain risks, misconfigurations,
  and more.
version: "1.0.0"
tags: [security, owasp, audit, vulnerability, compliance, asvs]
---

# 🔐 OWASP Security Auditor Skill

This skill performs a structured security audit of the current project
following **OWASP Top 10:2025** and **OWASP ASVS 4.0.3** standards.
The agent must be thorough, systematic, and report every finding
with a severity level, CWE reference, and remediation recommendation.

---

## 📌 When to Use This Skill

- User requests a security review, audit, or vulnerability scan
- User asks "is my project secure?" or "check OWASP compliance"
- User mentions terms: injection, XSS, CSRF, authentication issues,
  broken access control, secrets in code, dependency vulnerabilities
- Before deployment or code review of a new feature involving auth,
  data input, API endpoints, or third-party libraries

---

## Scope boundaries

**In scope:**
- Static code analysis (SAST) using `grep_search` to find dangerous code patterns.
- Dependency auditing using the bundled `scripts/scan_deps.sh`.
- Review of `.env`, Dockerfiles, and configuration files for secrets or misconfigurations.
- Mapping findings to OWASP Top 10:2025 categories and CWEs.

**Out of scope:**
- Dynamic scanning (DAST) or penetration testing against live environments.
- Automatically applying fixes to the codebase (this skill is read-only for reporting).
- Using third-party tools like Checkov, tfsec, or Trivy if they are not already installed on the host.

---

## 🗂️ Audit Scope — OWASP Top 10:2025

Run checks against all 10 categories in strict order.
For each category, inspect relevant files, configs, and code patterns.

### A01:2025 — Broken Access Control 🔴 CRITICAL
**What to check:**
- [ ] Are all routes/endpoints protected by authorization middleware?
- [ ] Is there any IDOR (Insecure Direct Object Reference)?
      Search for patterns like `?id=`, `/users/{id}`, without ownership check.
- [ ] Are admin endpoints restricted by role?
- [ ] Is CORS policy too permissive (`Access-Control-Allow-Origin: *`)?
- [ ] Is JWT/session validation enforced server-side on every request?

**Remediation:** Enforce server-side authorization checks on every request.

### A02:2025 — Security Misconfiguration 🔴 HIGH
**What to check:**
- [ ] Are debug modes / verbose error messages enabled in production?
      Search for: `DEBUG=True`, `NODE_ENV=development`, `display_errors=On`.
- [ ] Are default credentials in use? Search for `admin/admin`, `root/root`.
- [ ] Is the HTTP security headers policy missing?

**Remediation:** Follow hardening guides. Disable debug in production.

### A03:2025 — Software and Data Integrity Failures + Supply Chain 🔴 HIGH
**What to check:**
- [ ] Run: `bash scripts/scan_deps.sh` to detect CVEs in dependencies.
- [ ] Is there a `package-lock.json` / `poetry.lock` / `go.sum` pinning exact versions?
- [ ] Are deserialization operations performed on untrusted data?
      Search for: `pickle.loads`, `JSON.parse` on external input.

**Remediation:** Maintain an SBOM. Pin all dependency versions.

### A04:2025 — Injection 🔴 CRITICAL
**What to check:**
- [ ] **SQL Injection:** Search for raw string concatenation in queries.
- [ ] **Command Injection:** Search for `exec()`, `system()`, `eval()`,
      `subprocess.call(shell=True)` with user-controlled input.
- [ ] **Template Injection (SSTI):** Search for user-controlled template rendering.

**Remediation:** Always use parameterized queries. Validate all inputs.

### A05:2025 — Cryptographic Failures 🟠 HIGH
**What to check:**
- [ ] Are secrets/API keys hardcoded in source code?
      Search for: `password =`, `api_key =`, `secret =` in config files.
- [ ] Are weak hashing algorithms used for passwords (`md5`, `sha1`)?

**Remediation:** Use strong algorithms (bcrypt). Store secrets in .env or vaults.

### A06:2025 — Vulnerable and Outdated Components 🟠 HIGH
**What to check:**
- [ ] Run dependency vulnerability scan (see `scripts/scan_deps.sh`).
- [ ] Check if framework/runtime versions are EOL (End of Life).

### A07:2025 — Identification and Authentication Failures 🟠 HIGH
**What to check:**
- [ ] Is brute-force protection implemented (rate limiting)?
- [ ] Are passwords stored using strong adaptive hashing?
- [ ] Are session IDs invalidated on logout and expiration?

### A08:2025 — Software Integrity Failures 🟡 MEDIUM
**What to check:**
- [ ] Are CI/CD pipeline configurations protected from unauthorized changes?
- [ ] Are build artifacts signed?

### A09:2025 — Security Logging and Monitoring Failures 🟡 MEDIUM
**What to check:**
- [ ] Are authentication events (success/failure) logged?
- [ ] Are log entries free of sensitive data (passwords, tokens)?

### A10:2025 — Mishandling of Exceptional Conditions 🟡 MEDIUM
**What to check:**
- [ ] Do error responses expose stack traces or internal details to users?
- [ ] Are unhandled promise rejections monitored?

---

## 📊 Severity Levels

| Level | CVSS Score | Response Time |
|---|---|---|
| 🔴 CRITICAL | 9.0–10.0 | Fix immediately, block release |
| 🔴 HIGH | 7.0–8.9 | Fix before next release |
| 🟠 MEDIUM | 4.0–6.9 | Fix within current sprint |
| 🟡 LOW | 0.1–3.9 | Fix in backlog |

---

## Step-by-step

Follow these steps **in order** for every security audit:

### Step 1 — Reconnaissance & Initial Static Scan
1. Read all configuration files in the project root (`package.json`, `.env.example`, etc.).
2. Identify the tech stack and frameworks.
3. Use `grep_search` to find hardcoded secrets (`password=`, `API_KEY=`) and dangerous functions (`eval(`, `exec(`).
4. **Transition:** Proceed to Step 2.

### Step 2 — Dependency Audit
1. Run `bash scripts/scan_deps.sh` using the `run_command` tool.
2. If the script throws a permission error, grant executable permissions using `chmod +x scripts/scan_deps.sh` and re-run.
3. **Transition:** Proceed to Step 3.

### Step 3 — Generate Security Report
1. Produce a structured Markdown report named `owasp_audit_report.md` in the artifacts directory.
2. The report MUST include the raw terminal output of `scan_deps.sh` as verifiable evidence. Do not just summarize it.
3. Include a table of all findings with: Category, Severity, CWE, File/Location, Description, Remediation.
4. **Transition:** Proceed to Step 4.

### Step 4 — Handover Payload
1. Report the final status back to the user using the following format:
   ```text
   STATUS: SUCCESS
   FINDINGS: <Number of vulnerabilities found>
   REPORT_PATH: <Path to the generated artifact>
   ```
2. **STOP and wait for user.** Do not take further actions until the user responds.

---

## Error handling

If you encounter any of the following errors, emit the appropriate status payload and STOP.

| Scenario | Payload Status | Action |
|---|---|---|
| `scan_deps.sh` fails with missing dependency (e.g., `npm` or `pip` not installed) | `STATUS: PARTIAL_SUCCESS` | Document the failure in the report, use `grep_search` for manual dependency checks, and proceed to Step 3. |
| Cannot read files due to permission errors | `STATUS: BLOCKED` | Ask the user to grant necessary permissions or run the agent as administrator. |
| No source code found in the directory | `STATUS: REJECTED` | Explain to the user that the directory is empty and ask them to navigate to the correct project root. |

**Important:** Every emitted status (`SUCCESS`, `PARTIAL_SUCCESS`, `BLOCKED`, `REJECTED`) terminates the workflow. Wait for the user's explicit instruction to resume or restart.
