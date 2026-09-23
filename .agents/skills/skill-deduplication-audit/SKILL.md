---
name: skill-deduplication-audit
version: 1.0.0
description: |
  Detects overlapping, duplicate, and conflicting skills across the installed skill ecosystem.
  Compares descriptions, instruction bodies, and trigger conditions to find redundancy.
  Use when installing a new skill to check for conflicts before it goes live.
  Trigger when the context-budget-monitor reports WARN+ to prune redundant files.
  Activate before syncing a shared team skill library to detect cross-person duplication.
---

# Skill Deduplication Audit 🧬

This skill audits the **relationships between installed skills** — not just
their individual quality. Two perfectly written skills can still cause
serious problems when they overlap: the agent receives contradictory
instructions, activates the wrong skill, or splits its attention between
competing guidance for the same task.

## Instructions / Инструкции для Агента

### Why duplication is uniquely dangerous in agent systems

In a traditional codebase, duplicate functions are wasteful but inert.
In an agent skill system, duplicate or conflicting skills cause:

- **Non-deterministic behavior** — the agent picks one skill arbitrarily,
  and the choice changes across sessions
- **Instruction contradiction** — two skills give opposite guidance
  (e.g. one says "always use tabs", another says "always use spaces")
- **Silent skill shadowing** — a newer skill partially overrides an older
  one without anyone noticing
- **Token waste** — multiple skills loaded into context covering the same
  domain, consuming budget with zero marginal benefit
- **Activation ambiguity** — the agent activates two skills for one task
  and interleaves their instructions unpredictably

### Overlap taxonomy

This skill classifies relationships between skill pairs into four types:

```text
TYPE 1 — EXACT DUPLICATE
  Same purpose, same instructions, different name.
  Action: Archive one immediately.

TYPE 2 — PARTIAL OVERLAP
  30–70% instruction similarity. Skills share a domain
  but each has unique content.
  Action: Extract shared content into a base skill,
          keep specialized parts as thin wrappers.

TYPE 3 — TRIGGER COLLISION
  Different instructions, but both activate on the same
  user request patterns. Agent must choose one.
  Action: Clarify trigger conditions, add mutual exclusion.

TYPE 4 — INSTRUCTION CONFLICT
  Both skills active for the same task, but give
  contradictory instructions.
  Action: Immediate resolution required — merge or remove.
```

### When to activate this skill

| Trigger | Reason |
|---|---|
| Installing a new skill | Check for conflicts before the skill goes live |
| `context-budget-monitor` reports WARN+ | Deduplication reduces metadata load |
| Agent gives inconsistent results for similar tasks | Trigger collision likely |
| Team syncs a shared skill library | Cross-person duplication common |
| Skill count exceeds 20 | Overlap probability rises steeply |
| Agent references two skills in one response | Possible simultaneous activation |
| User reports "the agent keeps switching approach mid-task" | Instruction conflict |

### Step-by-step execution protocol

#### Step 1 — Index all installed skills

```bash
python {{SKILL_PATH}}/scripts/find_duplicates.py \
  --skills-dir "<workspace>/.agent/skills" \
  --global-skills-dir "~/.agent/skills"
```

This indexes every skill's:
- `description` field (from YAML frontmatter)
- `## When to activate` section
- All imperative instruction sentences (`always`, `never`, `must`, `should`)
- Trigger keyword vocabulary

#### Step 2 — Run pairwise overlap analysis

The script computes overlap scores for every skill pair using three signals:

| Signal | Weight | Method |
|---|---|---|
| Description similarity | 40% | Jaccard similarity on trigrams |
| Trigger vocabulary overlap | 35% | Shared keyword ratio |
| Instruction polarity conflict | 25% | Opposing modal verbs on same subject |

Pairs scoring above threshold are classified by type (1–4) and ranked.

#### Step 3 — Review the conflict matrix

The script produces a conflict matrix and ranked pair list.
Review each flagged pair and confirm or dismiss the classification.

To generate a merge suggestion for a specific pair:

```bash
python {{SKILL_PATH}}/scripts/merge_suggestion.py \
  --skill-a "<path_to_skill_a>" \
  --skill-b "<path_to_skill_b>"
```

#### Step 4 — Apply resolution actions

For each flagged pair, choose one resolution:

| Type | Recommended resolution | Command |
|---|---|---|
| TYPE 1 (Exact) | Archive the older skill | `mv <skill_dir> .agent/skills/_archive/` |
| TYPE 2 (Partial) | Generate merged skill draft | Run `merge_suggestion.py` |
| TYPE 3 (Trigger) | Edit `description` to narrow scope | Edit SKILL.md frontmatter |
| TYPE 4 (Conflict) | Resolve contradicting instructions | Manual edit + re-audit |

#### Step 5 — Re-run audit to confirm clean state

After applying resolutions, re-run Step 1 to confirm no remaining overlaps
above the warning threshold.

```bash
python {{SKILL_PATH}}/scripts/find_duplicates.py \
  --skills-dir "<workspace>/.agent/skills" \
  --min-score 0.25
```

---

## Report format

```text
🧬 Skill Deduplication Audit
════════════════════════════════════════════════════════
Skills scanned : 24  (18 local, 6 global)
Pairs analyzed : 276
Issues found   : 5
════════════════════════════════════════════════════════

🔴 TYPE 4 — INSTRUCTION CONFLICT  (score: 0.81)
  Pair    : 'code-formatter' ↔ 'style-enforcer'
  Conflict: 'code-formatter' says ALWAYS use tabs
            'style-enforcer' says ALWAYS use spaces
  Impact  : Agent will produce inconsistent formatting
            across sessions — non-deterministic behavior
  Action  : Merge into single 'code-style' skill with
            configurable indent preference

🟠 TYPE 3 — TRIGGER COLLISION  (score: 0.74)
  Pair    : 'git-commit-helper' ↔ 'conventional-commits'
  Trigger : Both activate on "commit", "write commit message",
            "stage changes"
  Impact  : Agent activates both; interleaves commit formats
  Action  : Narrow 'git-commit-helper' to exclude
            conventional commit keywords

🟡 TYPE 2 — PARTIAL OVERLAP  (score: 0.61)
  Pair    : 'secret-leak-guard' ↔ 'pre-commit-checklist'
  Overlap : Secret scanning instructions duplicated in both
  Impact  : 1,200 tokens of redundant content loaded
  Action  : Extract secret-scan step from 'pre-commit-checklist',
            reference 'secret-leak-guard' instead

🟡 TYPE 2 — PARTIAL OVERLAP  (score: 0.55)
  Pair    : 'api-client-generator' ↔ 'openapi-scaffolder'
  Overlap : Both describe HTTP client generation patterns
  Impact  : 800 tokens redundant; minor instruction divergence
  Action  : Review and align shared section, keep distinct
            parts

⚪ TYPE 1 — EXACT DUPLICATE  (score: 0.94)
  Pair    : 'deploy-helper' ↔ 'deploy-helper-v2'
  Match   : 94% content similarity
  Impact  : 2,400 tokens wasted every session on metadata
  Action  : Archive 'deploy-helper' immediately
            (last modified: 2024-01-03, 47 days older)

════════════════════════════════════════════════════════
Token savings if all resolved: ~4,400 tokens / session
════════════════════════════════════════════════════════
```

---

## Conflict resolution playbook

### Resolving TYPE 4 (Instruction Conflict) — step by step

1. Open both SKILL.md files side by side
2. List all imperative sentences from each:
   - Keywords: `always`, `never`, `must`, `should`, `do not`, `ensure`
3. For each opposing pair, decide:
   - Is one skill more authoritative? → Keep its instruction, remove the other
   - Is it context-dependent? → Add a conditional: `if X then Y, else Z`
   - Is neither definitively correct? → Ask the user to decide
4. Write a unified instruction that resolves the contradiction
5. Update both skills OR merge into one
6. Re-run the audit

### Resolving TYPE 3 (Trigger Collision) — step by step

1. List trigger keywords from both `description` fields
2. Identify the overlapping keywords
3. For each overlap, ask: which skill should own this keyword?
4. Remove the keyword from the losing skill's description
5. Add a note to each: `Note: for X tasks, use '<other-skill-name>' instead`
6. Re-run the audit

### Resolving TYPE 2 (Partial Overlap) — generating a merge

Run the merge suggestion tool and review its output:

```bash
python {{SKILL_PATH}}/scripts/merge_suggestion.py \
  --skill-a ".agent/skills/skill-a" \
  --skill-b ".agent/skills/skill-b" \
  --output  ".agent/skills/skill-merged"
```

The tool produces:
- A draft `SKILL.md` combining unique content from both
- A diff showing what was kept, merged, and dropped
- A migration note for each source skill pointing to the new merged skill

---

## Similarity scoring — methodology

### Trigram Jaccard similarity (description field)

Split text into overlapping 3-character windows.
Jaccard = |intersection| / |union| of trigram sets.
Threshold for flagging: **> 0.30**

### Trigger keyword overlap

Extract a vocabulary of activation keywords from the `description` and
`## When to activate` sections (nouns, verbs, tech terms — strip stopwords).
Overlap ratio = shared keywords / union of keywords.
Threshold for flagging: **> 0.40**

### Instruction polarity conflict detection

Extract all sentences containing modal verbs:
`always / never / must / must not / should / should not / do / do not`

For each subject-verb-object triplet, check if a matching subject in the
other skill has an opposing modal verb.

Examples of detected conflicts:
```text
Skill A: "Always commit with --no-verify"
Skill B: "Never use --no-verify on commits"

Skill A: "Use single quotes for all strings"
Skill B: "Always use double quotes for strings"
```

---

## False positive handling

The similarity scorer may flag pairs that are related but intentionally
distinct (e.g. `python-testing` and `javascript-testing` — similar
structure, different domain). To dismiss a false positive permanently:

Add a `related_skills` field to the SKILL.md frontmatter of both skills:

```yaml
---
name: python-testing
related_skills:
  - name: javascript-testing
    relationship: sibling         # intentionally parallel, not duplicate
    dedup_exempt: true
---
```

The audit scanner will skip exempt pairs in future runs.

---

## Integration with other skills

| Skill | When to trigger |
|---|---|
| `context-budget-monitor` | Run before audit to know baseline token cost |
| `skill-health-checker` | Run after merge to validate new merged skill |
| `skill-versioning` | Archive old skills via versioning before deletion |
| `ephemeral-skill-cleanup` | Use for TYPE 1 exact duplicates — archive immediately |

---

## Scope boundaries

This skill analyzes **static skill content** — it does NOT:

- Monitor real-time agent behavior to detect runtime activation conflicts
  (that requires platform-level observability tooling)
- Automatically merge or delete skills without explicit user confirmation
- Detect semantic contradictions that require domain knowledge to evaluate
  (e.g. conflicting architecture opinions — those need human review)
- Audit MCP server tool definitions for overlap with skills

---

## Error handling

| Error | Response |
|---|---|
| Skill has no `description` field | Flag as `[no-description]`, include in report with warning |
| SKILL.md is empty or unreadable | Skip, log as `[unreadable]`, surface in report |
| Only one skill installed | Report "nothing to compare", exit cleanly |
| Merge output path already exists | Prompt user before overwriting |
| Circular overlap (A↔B, B↔C, A↔C) | Report as a cluster, suggest single merged skill for all three |

---

## References

- `{{SKILL_PATH}}/scripts/find_duplicates.py` — pairwise overlap analyzer
- `{{SKILL_PATH}}/scripts/merge_suggestion.py` — merge draft generator
- [Jaccard similarity — Wikipedia](https://en.wikipedia.org/wiki/Jaccard_index)
