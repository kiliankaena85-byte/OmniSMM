---
name: tech-relevance-auditor
version: 1.0.0
description: |
  Audits the workspace technical stack, including NPM library versions,
  active AI models in configurations, and static code quality rules. Identifies
  outdated dependencies, deprecated models, and forbidden Next.js 16 / React 19
  patterns. Use when verifying environment compliance, checking if models need
  updating, running pre-release preflight audits, or when requested by the user.
---

# Tech Relevance Auditor ♻️🔎

This skill automates compliance checks against the workspace technical architecture.

Over time, codebases accumulate technical debt, outdated dependencies, and deprecated pattern usages. In agentic workspaces, agents might also hardcode outdated AI models (e.g. Gemini 1.5 or 2.0) that have been superseded by faster and cheaper ones (e.g. Gemini 3.5).

This auditor scans NPM configuration, code files, and model definitions to report on compliance.

---

## Evaluation Categories

| Component | Target Version / Rules | Default Action |
|---|---|---|
| Framework | Next.js `^16.2.6` (App Router, Turbopack) | Highlight violation |
| React | React `^19.2.6` | Highlight violation |
| Tailwind CSS | Tailwind v4 CSS-first config (`@theme` in global CSS) | Highlight violation |
| HeroUI | HeroUI v3 with dot notation API | Highlight violation |
| ORM | Prisma 5 | Highlight violation |
| Language | TypeScript `>=5.7` | Highlight violation |
| Linting | ESLint 10 (Flat Config) | Highlight violation |
| AI Models | Gemini 3.5 Flash (`gemini-3.5-flash`) | Propose model upgrade |
| Forbidden Hooks | No `useFormState` (replace with React 19 `useActionState`) | Highlight and suggest fix |
| Forbidden Refs | No `forwardRef` (use React 19 direct `ref` prop) | Highlight and suggest fix |
| Forbidden server | No `"use server"` directives inside Page Components | Critical failure |
| Raw Colors | No inline colors (`text-white`, `bg-black`, `text-black`) | Warn (use semantic tokens) |

---

## Safety and Enforcement Policy

This auditor is strictly **read-only** by default.

```text
1. All scans are non-destructive and do not modify code without explicit command flags.
2. Generates an index score representing architectural health (0 - 100%).
3. Risk assessments are marked as NOMINAL, WARN, or CRITICAL.
4. Auto-fix matches simple text patterns only when the --confirm flag is provided.
5. All actions are logged inside .agent/logs/relevance_audit.jsonl.
```

---

## When to Activate This Skill

| Trigger | Why |
|---|---|
| Before committing code | Prevent introducing forbidden React 19 / inline color patterns |
| Before release / deployment | Run preflight verification to ensure production-grade builds |
| Every Monday morning | Perform regular technology hygiene reviews |
| When updating AI Studio | Identify where config files reference deprecated models |
| User says "check tech stack relevance" | Direct activation |

---

## Step-by-Step Execution Protocol

### Step 1 — Initialize Relevance Policy

```bash
python {{SKILL_PATH}}/scripts/relevance_auditor.py init \
  --workspace "."
```

Creates `.agent/relevance_policy.json` with target stack targets.

---

### Step 2 — Run Full Stack Audit

```bash
python {{SKILL_PATH}}/scripts/relevance_auditor.py audit \
  --workspace "."
```

Scans files and displays a styled CLI audit report.

---

### Step 3 — Output JSON for Automation

To integrate with CI pipelines or custom parsers, output pure unstyled JSON:

```bash
python {{SKILL_PATH}}/scripts/relevance_auditor.py audit \
  --workspace "." \
  --json
```

---

### Step 4 — Run Selective Checks

Audit dependencies only:

```bash
python {{SKILL_PATH}}/scripts/relevance_auditor.py audit \
  --workspace "." \
  --check deps
```

Audit models only:

```bash
python {{SKILL_PATH}}/scripts/relevance_auditor.py audit \
  --workspace "." \
  --check models
```

Audit code quality rules only:

```bash
python {{SKILL_PATH}}/scripts/relevance_auditor.py audit \
  --workspace "." \
  --check code
```

---

### Step 5 — Apply Auto-fixes

Correct simple issues (such as replacing `useFormState` with `useActionState` where possible):

```bash
python {{SKILL_PATH}}/scripts/relevance_auditor.py fix \
  --workspace "." \
  --confirm
```

Without the `--confirm` flag, this operates as a dry-run.

---

### Step 6 — Review Audit Log History

```bash
python {{SKILL_PATH}}/scripts/relevance_auditor.py log \
  --workspace "."
```

Outputs the chronological audit history.

---

## Audit Report Format

```text
🔎 Tech Stack Relevance Audit Report
════════════════════════════════════════════════════════
Workspace      : /repo
Score          : 85 / 100  (B Grade — WARN 🟡)
════════════════════════════════════════════════════════

📦 DEPENDENCY AUDIT:
  🟢 Next.js       : 16.2.6 (target: ^16.2.6)
  🟢 React         : 19.2.6 (target: ^19.2.6)
  🔴 TypeScript    : 5.0.0  (target: >=5.7.0) — OUTDATED

🤖 AI MODEL AUDIT:
  🔴 AGENTS.md     : References 'gemini-2.0-flash' (target: gemini-3.5-flash)
  🔴 cost_est.py   : References 'gemini-1.5-pro'

⚠️ FORBIDDEN PATTERNS SCAN:
  🔴 src/components/admin/UserTable.tsx:
     - Found 'forwardRef' at line 24.
     - Found inline color 'text-white' at line 76.
  🔴 src/app/admin/orders/page.tsx:
     - Found forbidden '"use server"' at line 1.

════════════════════════════════════════════════════════
Assessment     : WARN 🟡 (Minor architectural risk)
Recommendation : Update TypeScript to 5.7+ and remove inline colors in UserTable.tsx.
════════════════════════════════════════════════════════
```

---

## Scope Boundaries

This skill does NOT:
* Force dependency updates via npm install unless requested.
* Auto-fix complex logical refactoring issues.
* Interact with remote NPM repositories directly without sandbox approvals.
* Audit compiled production bundles (only audits source files).

---

## Error Handling

| Error | Response |
|---|---|
| Policy file missing | Create temporary default policy, warn user. |
| package.json missing | Skip NPM dependency audit, log warning, proceed with code scan. |
| Unreadable file | Skip file, log warning, do not crash auditor. |
| Malformed policy JSON | Fall back to built-in default values, notify user. |

---

## References

* `{{SKILL_PATH}}/scripts/relevance_auditor.py` — core scanner, parser, and reporter
* [AGENTS.md](file:///d:/SMM_plan_2/AGENTS.md) — primary source of truth for architectural contracts
