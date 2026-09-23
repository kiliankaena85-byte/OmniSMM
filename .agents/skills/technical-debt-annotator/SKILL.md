---
name: technical-debt-annotator
version: 1.0.0
description: |
  Detects, annotates, and tracks technical debt in code. Finds hardcoded
  secrets/ports, missing errors catch, HACK comments, undocumented magic
  numbers, deprecated APIs, skipped tests, timeouts, and coupling. Creates
  structured debt entries with severity, category, effort estimate, and
  optional issue links. Use when generating new code, after refactoring,
  before sprint planning, or when auditing legacy code and release health.
---

# Technical Debt Annotator 🏗️

This skill makes technical debt **explicit, traceable, and prioritizable**.

When an agent generates code, it often creates shortcuts:

```python
# TO-DO: fix this later
password = "hardcoded123"
time.sleep(5)  # wait for the service to start
except Exception:
    pass  # handle this properly
```

These are technical debt items.  
Without annotation they are invisible.  
Without tracking they are forgotten.  
Without prioritization they are never fixed.

This skill finds them, annotates them, and produces a debt inventory
that teams can act on.

---

## Debt taxonomy

### Type A — Code quality debt

| Category | Code | Examples |
|---|---|---|
| Hardcoded value | `HARDCODED` | passwords, URLs, magic numbers, IPs |
| Missing error handling | `NO_ERROR_HANDLING` | bare `except: pass`, unchecked return values |
| Dead code | `DEAD_CODE` | unreachable branches, commented-out code blocks |
| Code duplication | `DUPLICATION` | copy-pasted blocks with slight variations |
| Missing docstring | `NO_DOCS` | public functions/classes with no documentation |
| Magic number | `MAGIC_NUMBER` | unexplained numeric constants |

### Type B — Test debt

| Category | Code | Examples |
|---|---|---|
| Missing tests | `NO_TEST` | public function with no corresponding test |
| Skipped test | `SKIPPED_TEST` | `@pytest.mark.skip`, `xit(`, `xtest(` |
| Commented test | `COMMENTED_TEST` | test code commented out |
| Missing assertion | `NO_ASSERTION` | test with no assert statement |

### Type C — Architecture debt

| Category | Code | Examples |
|---|---|---|
| Temporary workaround | `WORKAROUND` | `# hack`, `# temporary`, `# workaround` |
| Deprecated API | `DEPRECATED_API` | calls to `@deprecated` functions |
| Circular dependency hint | `CIRCULAR` | `# avoid circular import` workaround imports |
| Tight coupling | `COUPLING` | direct instantiation instead of injection |
| Missing abstraction | `ABSTRACTION` | repeated pattern without extract |

### Type D — Operational debt

| Category | Code | Examples |
|---|---|---|
| Missing logging | `NO_LOGGING` | error paths without log calls |
| Debug artifact | `DEBUG` | `print()`, `console.log()`, `debugger`, breakpoints |
| Missing timeout | `NO_TIMEOUT` | HTTP calls, DB queries without timeout |
| Missing retry | `NO_RETRY` | network calls with no retry logic |

---

## Severity levels

| Severity | Meaning | Fix urgency |
|---|---|---|
| `CRITICAL` | Security risk or data loss potential | This sprint |
| `HIGH` | Breaks reliability or maintainability | Next sprint |
| `MEDIUM` | Slows development or causes inconsistency | Next quarter |
| `LOW` | Style or preference issue | Backlog |

---

## Effort estimates

| Effort | Meaning |
|---|---|
| `XS` | < 30 minutes |
| `S` | < 2 hours |
| `M` | < 1 day |
| `L` | 1–3 days |
| `XL` | > 3 days |

---

## Annotation format

This skill writes structured annotations as code comments.

### Python

```python
#DEBT[HIGH|HARDCODED|S]: hardcoded JWT secret — move to env var
#REF: PROJ-123 or https://github.com/org/repo/issues/456
JWT_SECRET = "mysecretkey"
```

### TypeScript / JavaScript

```typescript
// DEBT[HIGH|HARDCODED|S]: hardcoded API base URL — use env var
// REF: PROJ-456
const API_BASE = "https://api.example.com";
```

### Go

```go
// DEBT[MEDIUM|NO_TIMEOUT|M]: HTTP client has no timeout
// REF: PROJ-789
client := &http.Client{}
```

### Annotation schema

```text
#DEBT[<severity>|<category>|<effort>]: <description>
#REF: <issue-id or URL> (optional)
```

---

## Debt registry

All findings are also written to a central registry:

```text
.agent/debt/debt_registry.jsonl
```

Each entry:

```json
{
  "id": "debt-20260522-001",
  "timestamp": "2026-05-22T15:30:00Z",
  "file": "src/auth/token_issuer.py",
  "line": 47,
  "category": "HARDCODED",
  "severity": "HIGH",
  "effort": "S",
  "description": "hardcoded JWT secret — move to env var",
  "ref": "PROJ-123",
  "agent_generated": true,
  "status": "open"
}
```

---

## When to activate this skill

| Trigger | Why |
|---|---|
| Agent generates new code | Annotate shortcuts taken during generation |
| User says "mark tech debt" | Direct activation |
| User says "TO-DO" or "fix later" | Convert informal note to tracked debt |
| Before sprint planning | Produce prioritized debt report |
| Before code review | Surface hidden debt for reviewers |
| After refactoring session | Check if shortcuts remain |
| Legacy code audit | Full scan of existing debt |
| Before a major release | Confirm no CRITICAL debt ships |
| `flaky-test-detective` finds issues | Annotate unfixed tests as TEST debt |

---

## Step-by-step execution protocol

### Step 1 — Initialize debt registry

```bash
python {{SKILL_PATH}}/scripts/debt_annotator.py init \
  --workspace "."
```

---

### Step 2 — Scan and detect debt

```bash
python {{SKILL_PATH}}/scripts/debt_annotator.py scan \
  --workspace "." \
  --path "src/"
```

Produces a report without modifying any file.

---

### Step 3 — Annotate in place

```bash
python {{SKILL_PATH}}/scripts/debt_annotator.py annotate \
  --workspace "." \
  --path "src/" \
  --confirm
```

Without `--confirm` this is a dry-run.

This inserts `# DEBT[...]` comments above each detected debt item
and writes entries to the registry.

---

### Step 4 — Register a manual debt item

For debt the agent knows about but cannot detect statically:

```bash
python {{SKILL_PATH}}/scripts/debt_annotator.py add \
  --workspace "." \
  --file "src/api/client.ts" \
  --line 88 \
  --category WORKAROUND \
  --severity HIGH \
  --effort M \
  --description "JWT refresh logic duplicated from auth service — should be shared library" \
  --ref "PROJ-234"
```

---

### Step 5 — Produce debt report

```bash
python {{SKILL_PATH}}/scripts/debt_annotator.py report \
  --workspace "." \
  --min-severity MEDIUM
```

---

### Step 6 — Mark debt as resolved

```bash
python {{SKILL_PATH}}/scripts/debt_annotator.py resolve \
  --workspace "." \
  --id "debt-20260522-001"
```

---

### Step 7 — Check if any CRITICAL debt is open

```bash
python {{SKILL_PATH}}/scripts/debt_annotator.py check \
  --workspace "." \
  --fail-on CRITICAL
```

Use this in CI to block release if critical debt is open.

---

## Report format

```text
🏗️ Technical Debt Report
════════════════════════════════════════════════════
Workspace      : /repo
Scanned        : src/
Open debt items: 14
════════════════════════════════════════════════════

CRITICAL (1):
  ⛔ HARDCODED  src/auth/config.py:12
     JWT_SECRET = "mysecretkey"
     Severity: CRITICAL  Effort: S
     Fix: Move to environment variable JWT_SECRET

HIGH (3):
  🔴 NO_ERROR_HANDLING  src/api/client.py:89
     except Exception: pass
     Severity: HIGH  Effort: S
     Fix: Log exception and re-raise or handle specifically

  🔴 NO_TIMEOUT  src/services/payments.py:44
     requests.post(url, json=payload)
     Severity: HIGH  Effort: XS
     Fix: Add timeout= parameter to all requests calls

  🔴 SKIPPED_TEST  tests/test_auth.py:103
     @pytest.mark.skip("not implemented yet")
     Severity: HIGH  Effort: M
     Fix: Implement or remove test

MEDIUM (6):
  ...

LOW (4):
  ...

════════════════════════════════════════════════════
By category:
  HARDCODED=2  NO_ERROR_HANDLING=3  WORKAROUND=2
  SKIPPED_TEST=1  MAGIC_NUMBER=2  DEBUG=2  NO_TIMEOUT=2
Total effort: XS×3  S×5  M×4  L×2
════════════════════════════════════════════════════
```

---

## Agent-generated debt tracking

When an agent creates a temporary solution and knows it:

The agent should call this skill explicitly:

```bash
python {{SKILL_PATH}}/scripts/debt_annotator.py add \
  --workspace "." \
  --file "<file>" \
  --line <line> \
  --category WORKAROUND \
  --severity MEDIUM \
  --effort M \
  --description "<what is temporary and why>" \
  --agent-generated true
```

This ensures the user always knows what the agent cut corners on.

---

## Integration with other skills

| Skill | Integration |
|---|---|
| `flaky-test-detective` | Annotate unfixed flaky tests as TEST debt |
| `skill-activation-logger` | Log debt annotation events |
| `skill-governance-policy` | Block release if CRITICAL debt is open |
| `workspace-snapshot` | Snapshot before bulk annotation |
| `conflict-resolution-arbitrator` | Debt items in conflicting files need re-annotation |
| `secret-leak-guard` | CRITICAL HARDCODED items may contain secrets |

---

## Scope boundaries

- Detects, annotates, tracks, and reports.
- Does NOT fix debt automatically.
- Does NOT integrate with external issue trackers directly.
- Does NOT guarantee detection of all technical debt.
- Does NOT enforce debt resolution.
- Does NOT rewrite code to remove debt.

---

## Error handling

| Error | Response |
|---|---|
| Registry missing | Create on first use |
| File not writable during annotate | Skip file, report path |
| Unknown category | Refuse to register, list valid categories |
| Duplicate annotation on same line | Skip, report duplicate |
| Unknown debt ID in resolve | List open IDs |
| Scan finds no test files | Warn about missing test coverage |

---

## References

- `{{SKILL_PATH}}/scripts/debt_annotator.py` — scanner, annotator, registry, reporter
- [NDepend Technical Debt rating](https://www.ndepend.com/docs/technical-debt)
- [SQALE method](https://www.sqale.org/)
