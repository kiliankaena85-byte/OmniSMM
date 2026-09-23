---
name: skill-health-checker
version: 1.2.0
description: |
  Lints and validates SKILL.md files for structural integrity, frontmatter correctness,
  instruction quality, and activation reliability. Detects missing sections, vague
  descriptions, contradictory imperatives, broken script references, incomplete
  response-cycle coverage, and semantic status conflicts. Use before publishing a skill,
  after editing, when a skill fails to activate, or as a CI pipeline check.
---

# Skill Health Checker 🏥

This skill is the **linter for skills** — it applies a structured ruleset
to every `SKILL.md` and produces a scored health report with actionable fixes.
Just as code has linters that catch problems before runtime, skills need a
pre-flight check before they influence agent behavior.

## Why skills need a dedicated linter

A skill with a poorly written `description` will never activate.
A skill with contradictory imperatives (`always` / `never` on the same subject)
produces non-deterministic behavior. A skill that references a script that doesn't
exist silently fails mid-task. A skill whose response-cycle is incomplete leaves the
agent without instructions when an unexpected status arrives.

None of these problems produce visible errors — they cause the agent to behave
strangely, and the cause is invisible without inspection.

**This skill makes invisible problems visible — before they reach production.**

---

## When to activate

| Trigger | Why |
|---|---|
| Before publishing skill to team library | Ensure quality baseline |
| After editing any SKILL.md | Catch regressions immediately |
| `skill-versioning snapshot` pre-hook | Validate before archiving |
| New skill created from scratch | Enforce structure from day one |
| Skill fails to activate as expected | AR-* rules likely violated |
| Agent behaves inconsistently in skill's domain | IQ-001 conflict likely |
| `context-budget-monitor` flags a heavy skill | ST-006 may explain why |
| Team skill review / PR process | Automated quality gate |

---

## Health score model

Each skill receives a health score from **0 to 100**:

```text
100 — Perfect: all rules pass, zero warnings
 80 — Good: minor warnings only, safe to use
 60 — Fair: issues present, use with caution
 40 — Poor: significant problems, fix before team use
  0 — Critical: skill will not function reliably
```

| Score | Grade | Label | Recommended action |
|---|---|---|---|
| 90–100 | 🟢 A | HEALTHY | No action needed |
| 75–89  | 🟡 B | GOOD | Address warnings when convenient |
| 55–74  | 🟠 C | FAIR | Fix before sharing with team |
| 30–54  | 🔴 D | POOR | Fix before use in any session |
| 0–29   | ⛔ F | CRITICAL | Do not use — fundamental issues |

---

## Rule categories

### Category 1 — Frontmatter (weight: 25%)

| Rule ID | Rule | Severity |
|---|---|---|
| FM-001 | `name` field present and non-empty | CRITICAL |
| FM-002 | `description` field present and non-empty | CRITICAL |
| FM-003 | `version` field present and valid semver | WARNING |
| FM-004 | `description` is written in third person | WARNING |
| FM-005 | `description` contains activation keywords | WARNING |
| FM-006 | `description` length: 50–500 chars | WARNING |
| FM-007 | No unknown frontmatter fields (typo guard) | INFO |
| FM-008 | `name` matches the directory name exactly | ERROR |
| FM-009 | `deprecated` field present if skill is stale (no commits > 90 days) | INFO |

### Category 2 — Structure (weight: 25%)

| Rule ID | Rule | Severity |
|---|---|---|
| ST-001 | `## When to activate` section present | ERROR |
| ST-002 | `## When to activate` contains a table or list | WARNING |
| ST-003 | At least one `## Step-by-step` or `## Protocol` section present | WARNING |
| ST-004 | Sections use proper markdown headings (not bold pseudo-headings) | INFO |
| ST-005 | No empty sections (heading with no content below it) | ERROR |
| ST-006 | Total SKILL.md length < 20,000 chars | WARNING |
| ST-007 | `## References` or `## See also` section present | INFO |
| ST-008 | `## Scope boundaries` or `## Out of scope` section present | WARNING |
| ST-009 | No duplicate section headings | ERROR |
| ST-010 | `## Error handling` section present | WARNING |
| ST-011 | All workflow steps have a defined termination condition | ERROR |

**ST-010 rationale:** Skills without explicit error handling leave the agent
without instructions on failure — a leading cause of silent mid-task breakdowns.

**ST-011 rationale:** A step-by-step that has no defined end-state
(e.g. a Payload cycle with no APPROVED/REJECTED handler) will loop
or stall indefinitely.

### Category 3 — Instruction quality (weight: 35%)

| Rule ID | Rule | Severity |
|---|---|---|
| IQ-001 | No contradictory imperative pairs (`always X` + `never X`) | CRITICAL |
| IQ-002 | No vague instructions (e.g., "handle approp-riately", "as ne-eded") | WARNING |
| IQ-003 | All `{{PLACEHOLDER}}` variables documented or resolved | ERROR |
| IQ-004 | No unresolved T-O-D-O / F-I-X-M-E markers in instructions | WARNING |
| IQ-005 | Code blocks have language specifier (` ```bash `, ` ```python `) | INFO |
| IQ-006 | All referenced scripts exist in `scripts/` subdirectory | ERROR |
| IQ-007 | No instructions referencing unavailable or non-standard tools | WARNING |
| IQ-008 | Decision trees / flowcharts are syntactically consistent | WARNING |
| IQ-009 | Error handling covers all failure modes defined in step-by-step | WARNING |
| IQ-010 | No hardcoded absolute paths (`/Users/`, `C:\Users\`) | ERROR |
| IQ-011 | All named statuses used in instructions are defined in the skill | ERROR |
| IQ-012 | Response-cycle completeness: every outgoing status has an incoming handler | ERROR |
| IQ-013 | No semantic conflicts between status definitions | ERROR |
| IQ-014 | Pre-Mortem (if present) describes production failure scenarios, not process risks | WARNING |
| IQ-015 | Verification evidence required where self-assessment is prohibited | WARNING |

**IQ-011 rationale:** If a skill emits status `BLOCKED` but never defines
what `BLOCKED` means or how the receiver should handle it — the status is
a dead end.

**IQ-012 rationale:** Caught in Maker/Auditor audit — Maker emitted `BLOCKED`,
Auditor had no handler. Agent stalled. Every status A sends must have a
corresponding handler in A's own skill for when that status comes back.

**IQ-013 rationale:** `BLOCKED → REJECTED` is a semantic conflict —
a tупик (dead-end state) is not a defect finding. Status meanings
must be mutually exclusive and non-overlapping.

**IQ-014 rationale:** Caught in Maker/Auditor audit — Pre-Mortem described
risk of a linter rule firing, not a production system failure. Pre-Mortem
must describe real user-facing failures.

**IQ-015 rationale:** `VERIFICATION_LOGS: No errors found` (self-assessment)
is unverifiable. Skills that require evidence must specify the exact
format of acceptable evidence.

### Category 4 — Activation reliability (weight: 15%)

| Rule ID | Rule | Severity |
|---|---|---|
| AR-001 | `description` contains at least 3 activation trigger phrases | WARNING |
| AR-002 | Trigger phrases use action verbs (not just nouns) | WARNING |
| AR-003 | `description` does not overlap >50% with another installed skill | WARNING |
| AR-004 | Activation conditions are mutually exclusive with `## Scope` | WARNING |
| AR-005 | `description` does not exceed 500 chars | ERROR |

---

## Step-by-step execution protocol

> ⚠️ **Note on automated execution:** Steps 1–3 below describe the
> CLI tool workflow. If you are running this skill **without** the
> `health_check.py` script (e.g. in a chat session without terminal
> access), skip to **Manual audit mode** at the end of this section.

### Step 1 — Identify scan target

```bash
# Single skill
python scripts/health_check.py \
  --skill-dir "<path_to_skill>"

# All skills in a directory
python scripts/health_check.py \
  --skills-dir "<workspace>/.agent/skills"

# With installed skills context (enables AR-003 cross-skill check)
python scripts/health_check.py \
  --skill-dir "<path_to_skill>" \
  --context-skills-dir "<workspace>/.agent/skills"
```

> Note: The `scripts/` path above is relative to the skill directory.
> Replace with the actual path if running from a different working directory.

### Step 2 — Review the health report

The script produces a scored report grouped by category.
Review CRITICAL and ERROR findings first — these have the highest
impact on skill functionality and score.

### Step 3 — Apply auto-fixes (optional)

For safe, deterministic fixes:

```bash
python scripts/health_check.py \
  --skill-dir "<path_to_skill>" \
  --auto-fix \
  --confirm
```

Auto-fixable rules:
- FM-003: adds `version: 0.1.0` if missing
- FM-007: removes unknown frontmatter fields
- ST-004: converts bold pseudo-headings to proper `##` headings
- IQ-005: adds `text` language specifier to bare code blocks
- IQ-010: replaces absolute paths with relative equivalents

> ⚠️ Always run `skill-versioning snapshot` BEFORE `--auto-fix`.
> Auto-fix rewrites SKILL.md. Without a snapshot, changes are irreversible.

### Step 4 — Fix remaining issues manually

For rules requiring judgment (IQ-001, IQ-002, IQ-011–IQ-015, AR-001–AR-004),
the report provides:
- The specific line/section where the issue was found
- A plain-English explanation of why it matters
- A concrete suggested fix

### Step 5 — Re-run to confirm clean state

```bash
python scripts/health_check.py \
  --skill-dir "<path_to_skill>" \
  --min-grade B
```

Exits with code `0` only if the skill meets the minimum grade.
Use `--min-grade A` for CI pipelines.

---

### Manual audit mode (no terminal access)

If running without the CLI tool, apply the ruleset manually:

1. Read the SKILL.md in full.
2. Work through each rule category in order (FM → ST → IQ → AR).
3. For each rule, mark: ✅ PASS / ❌ FAIL / ⚠️ WARN.
4. Calculate score: start at 100, subtract per severity:
   - CRITICAL: −25 pts each
   - ERROR: −10 pts each
   - WARNING: −5 pts each
   - INFO: −1 pt each
5. Produce the health report in the standard format below.

---

## Report format

```text
🏥 Skill Health Report
════════════════════════════════════════════════════════
Skill         : <skill-name>
Version       : v<x.y.z>
Health score  : <N> / 100  <grade-emoji> <letter> — <label>
Rules checked : <N>
Issues found  : <N>  (<N> CRITICAL, <N> ERROR, <N> WARNING, <N> INFO)
════════════════════════════════════════════════════════

❌ CRITICAL  [IQ-001]  Contradictory imperative pair detected
  Section : <section name>
  Detail  : "<quote A>" conflicts with "<quote B>"
            Agent receives opposing instructions for the same state.
  Fix     : Resolve conflict: choose one behavior and remove the other.

❌ ERROR  [IQ-012]  Response-cycle incomplete
  Section : <section name>
  Detail  : Skill emits status BLOCKED but has no handler for
            when BLOCKED is returned to it. Agent will stall.
  Fix     : Add handler in Step 4 / Error handling for BLOCKED response.

❌ ERROR  [IQ-013]  Semantic status conflict
  Section : Error handling
  Detail  : Status BLOCKED (dead-end / cannot proceed) is mapped to
            response REJECTED (defect found). These are different
            semantic categories — agent will misinterpret the response.
  Fix     : Introduce UNBLOCKED_ADVICE status for tупик resolution.

⚠️  WARNING  [IQ-002]  Vague instruction detected
  Line    : <N>
  Fix     : Replace vague instruction with explicit, actionable criteria (e.g. replace handle approp-riately with specific action).

⚠️  WARNING  [IQ-014]  Pre-Mortem describes process risk, not production failure
  Section : Pre-Mortem
  Detail  : "Risk: linter will emit ST-001" is a process risk.
            Pre-Mortem must describe user-facing production failures.
  Fix     : Replace with: "Risk: price calculation runs on client —
            user can manipulate margin. Mitigation: server-side validation."

⚠️  WARNING  [IQ-015]  Self-assessment in verification field
  Section : Handover Payload
  Detail  : VERIFICATION_LOGS contains "No errors found" (self-assessment).
            Skill requires real tsc/build output.
  Fix     : Specify: "Paste last 30 lines of `npx tsc --noEmit` output."

ℹ️  INFO  [IQ-005]  Code block missing language specifier
  Line    : <N>
  Detail  : Bare ``` block — add ```bash or ```text for clarity.
  Fix     : Auto-fixable with --auto-fix flag.

════════════════════════════════════════════════════════
Category breakdown:
  Frontmatter         : <N>/100 <emoji>
  Structure           : <N>/100 <emoji>
  Instruction quality : <N>/100 <emoji>  ← main issue area
  Activation          : <N>/100 <emoji>
════════════════════════════════════════════════════════
Suggested next step: fix <rule-id> (<severity>), then re-run.
Estimated score after fixes: ~<N>/100 <emoji> <grade>
════════════════════════════════════════════════════════
```

---

## CI pipeline integration

```yaml
name: Skill Health Check

on:
  pull_request:
    paths:
      - '.agent/skills/**'

jobs:
  skill-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run skill health checker
        run: |
          python .agent/skills/skill-health-checker/scripts/health_check.py \
            --skills-dir .agent/skills \
            --min-grade B \
            --output-format github-annotations
```

With `--output-format github-annotations`, the tool emits
`::error` and `::warning` annotations that appear inline in the PR diff.

---

## Pre-publish checklist

```text
□ Health score ≥ 80 (grade B or above)
□ No CRITICAL or ERROR findings
□ version field is ≥ 1.0.0 (not a draft)
□ CHANGELOG.md exists in .versions/
□ All referenced scripts exist and are executable
□ description passes third-person check (FM-004)
□ At least 3 activation trigger phrases (AR-001)
□ No absolute paths (IQ-010)
□ No TODO/FIXME markers (IQ-004)
□ Scope boundaries section present (ST-008)
□ Error handling section present (ST-010)
□ All emitted statuses have return handlers (IQ-012)
□ No semantic conflicts between statuses (IQ-013)
□ Pre-Mortem (if used) describes production failures (IQ-014)
```

---

## Auto-fix safety contract

The `--auto-fix` flag follows these non-negotiable rules:

1. **Never modifies instruction content** — only structural/formatting fixes
2. **Never resolves IQ-001 conflicts** — contradiction resolution requires human judgment
3. **Never resolves IQ-011 to IQ-015** — semantic and cycle issues require human judgment
4. **Never deletes sections** — only adds missing boilerplate
5. **Always produces a diff preview** before writing — user must confirm with `--confirm`
6. **Aborts if no snapshot exists** — checks for `.versions/` directory before any write

---

## Error handling

| Error | Response |
|---|---|
| SKILL.md not found | Exit code 2, clear error message with expected path |
| Frontmatter YAML unparseable | All FM rules fail as CRITICAL, report parse error location |
| `scripts/` directory missing but scripts referenced | IQ-006 fires for each reference |
| `--auto-fix` without `--confirm` | Print diff preview, exit without writing |
| `--auto-fix` without `.versions/` snapshot | Abort with warning, suggest `skill-versioning snapshot` |
| Skill directory has no SKILL.md | Skip with `[no SKILL.md]` marker in bulk scan |
| AR-003 requested without `--context-skills-dir` | Emit INFO: AR-003 skipped — no context skills provided |
| Manual audit mode, no terminal | Apply ruleset manually per Manual audit mode section |

---

## Scope boundaries

This skill validates **SKILL.md structure and content quality**.

**In scope:**
- Frontmatter correctness and activation metadata
- Section presence and completeness
- Instruction clarity, consistency, and cycle integrity
- Status semantic conflicts and response-cycle gaps
- Script reference validity
- Pre-Mortem format correctness
- Verification evidence requirements

**Out of scope:**
- Executing `scripts/` to verify runtime correctness
- Guaranteeing activation (depends on model behavior, not the YAML description quality alone)
- Validating MCP server configurations referenced by the skill
- Checking semantic correctness of domain-specific instructions
  (e.g. whether a prescribed coding style is actually good style)
- Verifying that API documentation inside a skill is factually accurate
  (e.g. whether HeroUI v3 actually uses named exports — that requires external verification)

---

## Integration with other skills

| Skill | Integration point |
|---|---|
| `skill-versioning` | Always snapshot before `--auto-fix`; run health check before every snapshot |
| `skill-deduplication-audit` | Run health check on merged skill draft immediately after merge |
| `context-budget-monitor` | ST-006 (size check) feeds into budget estimates |
| `secret-leak-guard` | Run on skill scripts — scripts are code and can contain secrets |

---

## References

- `scripts/health_check.py` — main linter engine (relative to skill directory)
- `scripts/rules/` — modular rule implementations
- [Keep a Changelog](https://keepachangelog.com/)
- [Semantic Versioning](https://semver.org/)
