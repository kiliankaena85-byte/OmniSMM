---
name: skill-versioning
version: 1.0.0
description: |
  Manages semantic versioning, history snapshots, changelog generation, and rollback for SKILL.md files.
  Tracks every modification to a skill as a versioned snapshot stored in a local .versions directory.
  Use when editing a skill manifest, before committing skill changes, or when restoring a previous skill state.
  Trigger when the user asks to version, snapshot, or inspect the changelog of a skill.
---

# Skill Versioning 🔖

This skill treats `SKILL.md` files as **first-class versioned artifacts** —
not just editable text files. Every skill is a set of instructions that
directly controls agent behavior. Changing those instructions without
tracking is equivalent to deploying code without version control: you lose
the ability to understand what changed, why it changed, and how to undo it.

## Instructions / Инструкции для Агента

### The core problem this solves

Skills are described as "living documents that actively improve during
work." But without versioning:

- There is no record of what a skill looked like before the last edit
- There is no way to know *why* a skill was changed
- Rollback means manually rewriting from memory
- Two team members editing the same skill produce invisible conflicts
- A skill that was working last week may have silently changed

This skill adds a lightweight versioning layer directly inside each
skill directory — no external VCS required (though git integration
is supported when available).

### Versioning model

#### Semantic versioning for skills

Skills use a `MAJOR.MINOR.PATCH` version scheme stored in the YAML
frontmatter:

```yaml
version: 2.1.3
```

| Bump type | When to use | Example change |
|---|---|---|
| `PATCH` | Small fixes, typos, clarifications | Fix a typo in instructions |
| `MINOR` | New sections, new patterns, extended coverage | Add a new step to the protocol |
| `MAJOR` | Fundamental behavior change, breaking redesign | Rewrite the activation logic |

#### Version storage layout

```text
.agent/skills/my-skill/
├── SKILL.md                        ← current live version
├── scripts/
│   └── ...
└── .versions/
    ├── v1.0.0_2024-01-15.md        ← snapshot at v1.0.0
    ├── v1.1.0_2024-02-03.md        ← snapshot at v1.1.0
    ├── v2.0.0_2024-03-11.md        ← snapshot at v2.0.0
    └── CHANGELOG.md                ← auto-generated changelog
```

Snapshots are plain copies of `SKILL.md` at the moment of versioning.
They are human-readable without any tooling.

### When to activate this skill

| Trigger | Version bump type |
|---|---|
| About to edit a SKILL.md | Snapshot BEFORE editing (any bump) |
| Agent behavior changed unexpectedly | Investigate recent version diffs |
| User asks "what changed in this skill?" | Generate changelog |
| Skill produces wrong results after edit | Rollback to previous version |
| Team member pushes skill update | Record version + author note |
| Skill being merged by `skill-deduplication-audit` | Snapshot both before merge |
| `skill-health-checker` finds issues | Snapshot before auto-fix |
| Promoting a skill from local to global scope | Bump MINOR, record promotion |

### Step-by-step execution protocol

#### Step 1 — Check current version state

Before any edit, inspect the current state of the target skill:

```bash
python {{SKILL_PATH}}/scripts/version_manager.py status \
  --skill-dir "<path_to_skill>"
```

Output shows: current version, last modified date, number of snapshots,
and whether the working copy has uncommitted changes vs the last snapshot.

#### Step 2 — Snapshot before editing

Always snapshot the current state before making any changes:

```bash
python {{SKILL_PATH}}/scripts/version_manager.py snapshot \
  --skill-dir "<path_to_skill>" \
  --bump patch \
  --message "Snapshot before editing: <reason>"
```

This:
1. Reads the current `version` field from frontmatter
2. Bumps the version according to `--bump` (patch / minor / major)
3. Copies current `SKILL.md` to `.versions/vX.Y.Z_<date>.md`
4. Updates the `version` field in `SKILL.md` frontmatter
5. Appends an entry to `.versions/CHANGELOG.md`

#### Step 3 — Make the edit

Edit `SKILL.md` to apply required instruction updates. The snapshot from Step 2 is already saved —
any changes are safe to make.

#### Step 4 — Record the change

After editing, record what changed with a meaningful message:

```bash
python {{SKILL_PATH}}/scripts/version_manager.py record \
  --skill-dir "<path_to_skill>" \
  --message "Added quarantine mode for external API responses" \
  --author "agent / <username>"
```

This appends the change details to `CHANGELOG.md` and generates a
human-readable diff between the snapshot and the new current state.

#### Step 5 — Rollback (if needed)

If the edited skill produces unexpected agent behavior, roll back:

```bash
# List available versions
python {{SKILL_PATH}}/scripts/version_manager.py list \
  --skill-dir "<path_to_skill>"

# Roll back to a specific version
python {{SKILL_PATH}}/scripts/version_manager.py rollback \
  --skill-dir "<path_to_skill>" \
  --to v1.1.0
```

Rollback:
1. Snapshots the current (broken) state with suffix `-pre-rollback`
2. Restores the target version's content to `SKILL.md`
3. Updates the version field in frontmatter
4. Records the rollback event in `CHANGELOG.md`

---

## Changelog format

The auto-generated `CHANGELOG.md` follows
[Keep a Changelog](https://keepachangelog.com/) conventions:

```markdown
# Changelog — secret-leak-guard

All notable changes to this skill are documented here.
Format: semantic versioning. Dates: YYYY-MM-DD.

---

## [2.1.0] — 2024-03-15
### Added
- Step 3: manual pattern review for f-string secrets
- Remediation playbook entry for JWT secrets

### Changed
- Decision tree: added SUSPICIOUS intermediate state

**Author:** agent (session: refactor-auth-module)
**Diff size:** +47 lines, -12 lines

---

## [2.0.0] — 2024-02-28  ⚠️ BREAKING CHANGE
### Changed
- Rewrote activation trigger logic (now fires on API calls too)
- Changed exit code from boolean to 0/1/2 scale

### Removed
- Auto-fix mode (was causing unintended secret deletion)

**Author:** @dev-alice
**Rollback available:** v1.3.2_2024-02-27.md

---

## [1.3.2] — 2024-02-27
### Fixed
- False positive on UUID patterns in test fixtures

**Author:** agent (session: fix-false-positives)
**Diff size:** +3 lines, -1 line
```

---

## Diff format

When viewing changes between versions, diffs are presented in a
skill-readable format — not raw unified diff, but a structured summary:

```text
📝 Diff: secret-leak-guard v1.3.2 → v2.0.0
════════════════════════════════════════════
Sections changed  : 3 of 8
Lines added       : +94
Lines removed     : -31
Net change        : +63 lines

── Section: "When to activate this skill" ──
  ADDED trigger: External API call with user-provided parameters
  ADDED trigger: Printing/logging content from user input

── Section: "Step-by-step execution protocol" ──
  MODIFIED: Step 2 (scanner invocation) — exit code semantics changed
  ⚠️  BREAKING: exit code 1 now means "secrets found",
               previously it meant "scanner error"

── Section: "Decision tree" ──
  ADDED: SUSPICIOUS intermediate state between CLEAN and FOUND
  REMOVED: auto-fix branch (lines 87–103)

── New section added ──
  + "Remediation Playbook" (47 lines)
════════════════════════════════════════════
```

---

## Git integration

If the skill directory is inside a git repository, `version_manager.py`
optionally creates a git commit for each snapshot:

```bash
python {{SKILL_PATH}}/scripts/version_manager.py snapshot \
  --skill-dir "<path_to_skill>" \
  --bump minor \
  --message "Add base64 detection" \
  --git-commit          # also runs: git add + git commit
```

Git commit message format:
```text
skill(<skill-name>): bump to vX.Y.Z

<message from --message flag>

Versioned by: skill-versioning
```

When git is available, `.versions/` snapshots are redundant backups —
the git history is the authoritative record. When git is not available,
`.versions/` is the only history.

---

## Team workflow

### Scenario: two developers editing the same skill

```text
Alice                           Bob
  │                               │
  ├─ status → v1.2.0, clean       ├─ status → v1.2.0, clean
  ├─ snapshot → v1.3.0-alice      ├─ snapshot → v1.3.0-bob
  ├─ edits SKILL.md               ├─ edits SKILL.md
  ├─ record → CHANGELOG updated   ├─ record → CHANGELOG updated
  │                               │
  └─ pushes to shared repo        └─ pulls Alice's changes
                                  │
                                  ├─ diff v1.3.0-alice vs v1.3.0-bob
                                  ├─ conflict detected in section X
                                  └─ merge + bump to v1.4.0
```

To compare two diverged versions:

```bash
python {{SKILL_PATH}}/scripts/version_manager.py diff \
  --skill-dir "<path>" \
  --from v1.3.0 \
  --to v1.4.0
```

### Publishing a skill to a team library

Before publishing a locally developed skill to a shared team repository:

1. Ensure version is ≥ `1.0.0` (pre-1.0 skills are drafts)
2. Run `snapshot` with `--bump minor` and message `"Publishing to team library"`
3. Verify `CHANGELOG.md` exists and is complete
4. Run `skill-health-checker` on the skill
5. Submit the entire skill directory including `.versions/`

---

## Version lifecycle states

```text
DRAFT       (0.x.x)  — experimental, not safe for team use
STABLE      (1.x.x)  — production ready, changelog required for changes
DEPRECATED  (any)    — frontmatter flag: deprecated: true
ARCHIVED    (any)    — moved to .agent/skills/_archive/
```

To mark a skill as deprecated without deleting it:

```yaml
---
name: old-deploy-helper
version: 2.3.1
deprecated: true
deprecated_reason: "Superseded by 'deploy-v2'. Migrate by 2025-Q2."
deprecated_since: "2024-03-01"
---
```

---

## Scope boundaries

This skill manages versioning for **individual skill files** only.
It does NOT:

- Version control scripts inside `scripts/` subdirectories
  (use git for that)
- Manage versions of MCP server configurations
- Handle cross-skill dependency versioning
  (e.g. "skill A v2.0 requires skill B v1.5+")
- Sync versions across team members automatically
  (use git + a shared remote for that)

---

## Integration with other skills

| Skill | Integration point |
|---|---|
| `skill-health-checker` | Always snapshot before health-checker auto-fixes |
| `skill-deduplication-audit` | Snapshot both skills before merge operation |
| `context-budget-monitor` | `.versions/` directory adds disk weight, not token weight |
| `ephemeral-skill-cleanup` | Archive deprecated skills with final snapshot |

---

## Error handling

| Error | Response |
|---|---|
| No `version` field in frontmatter | Initialize to `0.1.0`, log warning |
| `.versions/` directory not writable | Abort snapshot, do NOT proceed with edit |
| Rollback target version file missing | List available versions, ask user to choose |
| Frontmatter YAML parse error | Abort, report parse error, do not corrupt file |
| Snapshot already exists for this version | Append `-b` suffix, warn user of duplicate |

---

## References

- `{{SKILL_PATH}}/scripts/version_manager.py` — core versioning engine
- `{{SKILL_PATH}}/scripts/changelog_generator.py` — changelog writer
- [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
- [Semantic Versioning 2.0.0](https://semver.org/)
