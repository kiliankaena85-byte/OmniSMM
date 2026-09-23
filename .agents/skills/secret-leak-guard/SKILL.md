---
name: secret-leak-guard
version: 1.0.0
description: |
  Scans files, diffs, and agent-generated content for hardcoded secrets, keys, and tokens.
  Enforces a zero-tolerance pre-flight check policy before exposing any sensitive credentials.
---

# Secret Leak Guard 🔒

This skill protects the workspace from accidental exposure of sensitive
credentials. It acts as a mandatory pre-flight check before any operation
that could expose secrets to version control, external systems, or logs.

## Instructions / Инструкции для Агента

### When to activate this skill

Activate **automatically and silently** before any of the following actions:

- `git commit`, `git push`, `git add`
- Writing or creating any new file (`*.env`, `*.py`, `*.ts`, `*.json`,
  `*.yaml`, `*.toml`, `*.sh`, `*.md`, `*.tf`, `Dockerfile`, or any other workspace source or configuration file)
- Generating or editing configuration files
- Calling an external API or MCP server with user-provided parameters
- Printing, logging, or summarizing content that came from user input
- Displaying terminal output in the chat response

### Step-by-step execution protocol

#### Step 1 — Identify the scan target

Determine what content needs to be scanned:

| Trigger | Scan target |
|---|---|
| `git commit / push` | All staged files (`git diff --cached`) |
| File creation / edit | The full content of the new/modified file |
| External API call | All parameters, headers, and body fields |
| Terminal output in chat | The full stdout/stderr being surfaced |

#### Step 2 — Run the automated scanner

Execute the bundled script to detect secrets automatically:

```bash
python {{SKILL_PATH}}/scripts/scan_secrets.py --target "<path_or_content>"
```

The script exits with:
- `0` — clean, no secrets detected
- `1` — secrets found, output includes type + line number + masked value

If the scan target is inline content (not a file path), pipe it via stdin:

```bash
echo "<content>" | python {{SKILL_PATH}}/scripts/scan_secrets.py --stdin
```

#### Step 3 — Manual pattern review (always run, even if Step 2 passes)

After the script, visually verify the content for the following high-risk
patterns that regex scanners commonly miss:

**Hard patterns to detect automatically:**
- Base64-encoded secrets: strings longer than 40 chars that decode to
  JSON-like structures with `key`, `secret`, `password` fields
- Environment variable interpolation that resolves to a secret at runtime
  (e.g. `f"Bearer {os.getenv('TOKEN')}"` passed directly to a log)
- Secrets embedded in comments: `# temp key: sk-abc123...`
- Secrets inside f-strings or template literals used in log statements
- Terraform `output` blocks that expose sensitive values without
  `sensitive = true`

#### Step 4 — Decision tree

```text
Secrets found?
│
├── YES ──► HALT the original action immediately
│           ├── Report: type of secret, file, line, masked value
│           ├── Suggest remediation (see § Remediation Playbook)
│           └── Do NOT proceed until user explicitly confirms a fix
│
└── NO  ──► Mark scan as PASSED
            └── Log: "secret-leak-guard ✅ — scan passed on <target>"
            └── Proceed with the original action
```

> ⚠️ **Non-negotiable rule:** The agent must NEVER auto-fix a secret leak
> by replacing it inline without user confirmation. Secrets require
> intentional human action to revoke and rotate.

---

## Remediation Playbook

When a secret is detected, provide the user with a concrete next step
based on the type of violation:

| Secret type | Immediate action | Long-term fix |
|---|---|---|
| API key / token (cloud) | Revoke in provider console NOW | Move to `.env` + add to `.gitignore` |
| Database password | Rotate immediately | Use a secrets manager (GCP Secret Manager, Vault) |
| Private key / cert | Revoke + reissue | Store outside the repo, reference by path |
| JWT secret | Rotate + invalidate all sessions | Inject via environment variable at runtime |
| Hardcoded in `.env` committed to git | `git filter-repo` to purge history | Add `.env` to `.gitignore` retroactively |

---

## False positive handling

If the agent identifies a pattern that looks like a secret but is NOT
(e.g. a UUID used as a non-sensitive identifier, a placeholder like
`YOUR_API_KEY_HERE`, or a test fixture with obviously fake data):

1. Flag it as a **possible false positive** — do NOT silently ignore it
2. Ask the user: _"This looks like a secret. Is `<masked_value>` a real
   credential or a placeholder?"_
3. If the user confirms it is a placeholder, log it and proceed
4. If unsure — treat it as real and halt

---

## Scope boundaries

This skill covers **secrets at rest and in transit** within the agent
session. It does NOT:

- Replace a full-featured secrets management system (use GCP Secret Manager,
  HashiCorp Vault, or AWS Secrets Manager for production)
- Scan the entire repository history (use `git-secrets`, `trufflehog`,
  or `gitleaks` for historical scans — recommend these tools when a leak
  is found)
- Decrypt or evaluate runtime environment variables (it can only scan
  literal values present in the content being processed)

---

## Error handling

If `scan_secrets.py` fails to execute (missing Python, permission error,
corrupted script):

1. Log the error explicitly: `"secret-leak-guard ⚠️ — scanner failed: <error>"`
2. **Do NOT silently skip the scan and proceed** with the original action
3. Fall back to manual pattern review (Step 3) and notify the user that
   the automated scan was unavailable
4. Suggest the user run the scanner manually before proceeding

---

## References

- `{{SKILL_PATH}}/scripts/scan_secrets.py` — automated scanner
- [OWASP: Hardcoded Passwords](https://owasp.org/www-community/vulnerabilities/Use_of_hard-coded_password)
- [Google Cloud Secret Manager](https://cloud.google.com/secret-manager/docs)
- [trufflehog](https://github.com/trufflesecurity/trufflehog) — for full git history scanning
