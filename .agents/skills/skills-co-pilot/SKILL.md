---
name: skills-co-pilot
version: 1.0.0
description: |
  Interactively monitors code modifications and developer behavior via git
  status, file extensions, and context. Suggests the most suitable
  advanced AI skills to use next. Provides step-by-step tutorials.
  Use when the user asks for guidance on which skill to use, before
  running tests, when committing code, or when preparing release reports.
---

# Skills Co-Pilot ✈️🧭

This skill serves as an **intelligent navigation system** and **interactive mentor** for developers and AI agents working on this codebase.

It monitors project activity (modified files, staged commits, skill logs) and dynamically suggests the most relevant advanced AI skills to apply at any given moment.

---

## Skills under management

The Co-Pilot guides you in the execution of the following five advanced AI skills:

1. **`technical-debt-annotator`** — Scans and marks technical debt with `#DEBT` annotations and logs it.
2. **`flaky-test-detective`** — Static analysis of tests to find non-deterministic behavior.
3. **`tech-relevance-auditor`** — Audits files for AGENTS.md compliance and correct dependencies.
4. **`token-cost-estimator`** — Estimates token consumption and monetary cost of tasks.
5. **`ephemeral-skill-cleanup`** — Identifies and archives draft/unused skills.

---

## Observer logic and suggestion mapping

The Co-Pilot runs static git scans to detect the current task context:

| Context Detected | Changed File Types | Recommended Skill |
|---|---|---|
| Modifying/Adding source code | `.py`, `.ts`, `.tsx`, `.js`, `.jsx`, `.go` | `technical-debt-annotator`, `tech-relevance-auditor` |
| Writing/Modifying test files | `*.test.ts`, `*.spec.ts`, `test_*.py` | `flaky-test-detective` |
| Massive modifications | > 5 files or > 500 LOC changed | `token-cost-estimator` |
| Idle / Cleanup Phase | Skills directory size or time based | `ephemeral-skill-cleanup` |

---

## When to activate

| Trigger | Why |
|---|---|
| User asks "what skill to run" | Direct activation |
| Developer modifies source files | Suggest running annotator or auditor |
| Developer modifies test files | Suggest running detective |
| Massive codebase modifications | Suggest estimating cost of task |
| Idle project state / sprint end | Suggest ephemeral skill cleanup |

---

## Step-by-step execution protocol

### Step 1 — Auto-observe current workspace status

```bash
python {{SKILL_PATH}}/scripts/co_pilot.py suggest \
  --workspace "."
```

---

### Step 2 — Run the interactive step-by-step tutorial

If you or the agent wants to learn how to use a specific skill:

```bash
python {{SKILL_PATH}}/scripts/co_pilot.py learn <skill-name>
```

Available skills:
- `technical-debt-annotator`
- `flaky-test-detective`
- `tech-relevance-auditor`
- `token-cost-estimator`
- `ephemeral-skill-cleanup`

---

### Step 3 — Review skills execution logs

```bash
python {{SKILL_PATH}}/scripts/co_pilot.py logs \
  --workspace "."
```

---

### Step 4 — Check health index of workspace

```bash
python {{SKILL_PATH}}/scripts/co_pilot.py status \
  --workspace "."
```

---

## Scope boundaries

This skill does NOT:
- run the suggested skills automatically;
- change any of your source files directly;
- hook into network requests or remote analytics.

It analyzes, suggests, and teaches.

---

## Error handling

| Error | Response |
|---|---|
| Git not installed/available | Fallback to checking date modified of files in workspace |
| Skill name not found in learn | Suggest valid skill names |
| Missing skill directories | Warn that the suggested skills are not installed in workspace |

---

## References

- `{{SKILL_PATH}}/scripts/co_pilot.py` — The observer engine script
- `{{SKILL_PATH}}/SKILL.md` — Manifest of the navigation copilot
