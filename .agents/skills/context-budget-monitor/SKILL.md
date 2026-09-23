---
name: context-budget-monitor
version: 1.0.0
description: |
  Audits the token budget of the current agent session by measuring skill size.
  Estimates context capacity, detects heavy modules, and prevents memory overflow.
  Use when the user installs a new skill, before starting a task estimated >50 steps, or when the agent appears to repeat itself or lose context.
  Trigger when the user asks "why did you forget X?" or when the session has 15+ installed skills.
  Activate before running a resource-heavy refactoring.
---

# Context Budget Monitor 📦

This skill gives the agent and the user **full visibility into the token
economy** of the current session. In Antigravity, skills are loaded as
metadata at session start — every installed skill silently consumes context
before the user types a single character. This skill makes that cost visible,
measurable, and actionable.

## Instructions / Инструкции для Агента

### Why context budget management is non-obvious

Most developers think about tokens only when they hit an error. By then:
- The agent has already lost early conversation history
- Long-running tasks fail halfway through
- Skill activation becomes unpredictable (the model "forgets" the skill menu)
- Costs accumulate invisibly across parallel agents

The correct time to think about context budget is **before starting a task**,
not after hitting a wall.

### Mental model: the context window as a whiteboard

```text
┌─────────────────────────────────────────────────────────┐
│                   CONTEXT WINDOW (e.g. 1M tokens)        │
├────────────────┬──────────────┬──────────────────────────┤
│  System prompt │ Skill menu   │  Available for work       │
│  (platform)    │ (all skills) │  (conversation + output)  │
│  ~2–5k tokens  │ ~Nk tokens   │  ← this is what matters  │
└────────────────┴──────────────┴──────────────────────────┘
                  ↑
           This is what this skill measures
```

The "skill menu" is loaded on every session. Each skill contributes:
1. **Metadata weight** — `name` + `description` always loaded (lightweight)
2. **Full content weight** — `SKILL.md` body + scripts loaded on activation

Even metadata accumulates: 40 skills × 200 tokens avg = 8k tokens gone
before the user says hello.

### When to activate this skill

| Trigger | Why |
|---|---|
| User installs a new skill | Measure the delta cost immediately |
| Session has 15+ installed skills | Proactive audit recommended |
| Before a task estimated >50 steps | Check remaining budget first |
| Agent appears to repeat itself or lose context | Budget may be exhausted |
| User reports slow responses or unexpected behavior | Token pressure symptom |
| User asks "why did you forget X?" | Context overflow likely cause |
| Scheduled: weekly team audit | Prevent gradual skill bloat |

### Step-by-step execution protocol

#### Step 1 — Discover all installed skills

```bash
python {{SKILL_PATH}}/scripts/audit_budget.py --skills-dir "<workspace>/.agent/skills"
```

This produces a ranked list of all skills by token cost (metadata + full
content), with totals and budget consumption percentages.

For global skills (installed outside the workspace):

```bash
python {{SKILL_PATH}}/scripts/audit_budget.py \
  --skills-dir "<workspace>/.agent/skills" \
  --global-skills-dir "~/.agent/skills"
```

#### Step 2 — Estimate current session token usage

```bash
python {{SKILL_PATH}}/scripts/estimate_tokens.py \
  --conversation-file "<path_to_exported_conversation>" \
  --skills-audit-output "<output_from_step1.json>"
```

If a conversation export is not available, estimate based on:
- Average message count in current session (ask the user if needed)
- Typical system prompt size for the platform (~3,000 tokens)
- Skill metadata total from Step 1

#### Step 3 — Classify budget state

Use the following thresholds:

| Usage | State | Label | Action |
|---|---|---|---|
| 0 – 50% | 🟢 Healthy | `NOMINAL` | No action needed |
| 51 – 70% | 🟡 Moderate | `MONITOR` | Note heavy skills, no action yet |
| 71 – 85% | 🟠 Elevated | `WARN` | Recommend disabling unused skills |
| 86 – 95% | 🔴 Critical | `ALERT` | Immediate skill pruning recommended |
| 96 – 100% | ⛔ Overflow | `OVERFLOW` | Start new session, archive skills |

#### Step 4 — Generate the budget report

Produce a structured report (see § Report Format) and present it to the user.

#### Step 5 — Recommend actions (if state is WARN or above)

Based on the audit, suggest one or more of:
1. **Disable** skills not used in the last N sessions
2. **Trim** oversized SKILL.md files (split into sub-skills)
3. **Archive** project-specific skills to a separate directory
4. **Merge** overlapping skills (trigger `skill-deduplication-audit`)
5. **Start a new session** if current one is in OVERFLOW state

---

## Report format

```text
📦 Context Budget Report
════════════════════════════════════════════════════
Session state   : 🟡 MONITOR (62% used)
Model limit     : 1,000,000 tokens
Estimated used  : 620,000 tokens
Remaining       : 380,000 tokens
════════════════════════════════════════════════════

📊 Skill Budget Breakdown (metadata always loaded):

  Rank  Skill name                   Meta    Full    Scope
  ───────────────────────────────────────────────────────
  1     my-giant-skill               420t    18,200t  local
  2     legacy-deploy-helper         380t    12,400t  global
  3     secret-leak-guard            210t     3,100t  local
  4     context-budget-monitor       190t     2,900t  local
  ...
  ─────────────────────────────────────────────────────
  TOTAL (metadata, always loaded)  : 8,400 tokens
  TOTAL (if all skills activated)  : 94,200 tokens

⚠️  Heavy skills (>5,000 tokens full content):
  → my-giant-skill (18,200t): consider splitting into sub-skills
  → legacy-deploy-helper (12,400t): last used 14 days ago — archive?

💡 Recommendations:
  1. Archive 'legacy-deploy-helper' → saves 380t permanently from metadata
  2. Split 'my-giant-skill' into focused sub-skills
  3. Current task headroom: ~380k tokens (~190 avg-length agent turns)
════════════════════════════════════════════════════
```

---

## Token estimation methodology

### Why not use exact counts?

Exact tokenization requires running the full tokenizer (e.g. `tiktoken` for
GPT, SentencePiece for Gemini). This skill uses **character-based heuristics**
that are accurate within ±15% for planning purposes:

| Content type | Approx tokens | Rationale |
|---|---|---|
| English prose | chars ÷ 4 | ~4 chars/token average |
| Code (Python/JS) | chars ÷ 3.5 | More tokens per char due to symbols |
| JSON/YAML | chars ÷ 3 | Structural tokens are expensive |
| Markdown with headers | chars ÷ 3.8 | `#`, `**`, `|` add token overhead |

For precise measurement, use the `--exact` flag which calls the
`estimate_tokens.py` tokenizer shim (requires `tiktoken` or `transformers`).

---

## Proactive budget checkpoints

For long tasks (refactoring, multi-file generation, test suites), insert
budget checkpoints automatically:

```text
Before task start   → full audit (this skill)
After every 20 steps → lightweight token estimate
At 85% usage        → pause and report to user
At 95% usage        → mandatory pause, offer to split task
```

To enable automatic checkpointing for a task, prepend to the task plan:

```markdown
## Task Preamble
- Budget checkpoint: every 20 steps
- Abort threshold: 90% context usage
- On abort: save progress summary to `PROGRESS.md`, start new session
```

---

## Integration with other skills

| Skill | Integration |
|---|---|
| `skill-deduplication-audit` | Trigger when audit reveals overlapping skills |
| `skill-health-checker` | Trigger when a skill has abnormally large SKILL.md |
| `skill-versioning` | Suggest archiving old versions to reduce metadata load |
| `ephemeral-skill-cleanup` | Trigger when unused skills are detected |

---

## Scope boundaries

This skill measures and reports — it does NOT:

- Automatically delete or disable skills (always requires user confirmation)
- Access real-time token counters from the model API
  (uses estimation, not exact counts)
- Manage conversation history pruning
  (that is a platform-level concern)
- Replace proper cost management tooling for production deployments

---

## Error handling

| Error | Response |
|---|---|
| Skills directory not found | Report 0 skills found, ask user for correct path |
| Cannot read a SKILL.md file | Skip file, log warning, include in report as `[unreadable]` |
| `estimate_tokens.py` fails | Fall back to character-based estimation, note in report |
| Model limit unknown | Default to 1,000,000 tokens, flag as assumed value |

---

## References

- `{{SKILL_PATH}}/scripts/audit_budget.py` — skill token auditor
- `{{SKILL_PATH}}/scripts/estimate_tokens.py` — token estimation engine
- [Google Gemini context window docs](https://ai.google.dev/gemini-api/docs/long-context)
- [Anthropic: context window management](https://docs.anthropic.com/en/docs/build-with-claude/context-windows)
