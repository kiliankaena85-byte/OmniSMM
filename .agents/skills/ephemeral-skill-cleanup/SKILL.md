---
name: ephemeral-skill-cleanup
version: 1.0.0
description: |
  Scans, identifies, and retires expired, stale, deprecated, duplicate, or draft skills from the workspace skills repository. Use after a sprint or hackathon, when skill count is high, or during weekly team cleanup cycles.
---

# Ephemeral Skill Cleanup ♻️

This skill manages the **lifecycle retirement** of skills.

Skills are created faster than they are removed. Over time a workspace accumulates one-off hackathon scripts, stale helpers, duplicate skills, experimental drafts, or deprecated skills. Each of these wastes metadata token budget on every session start. This skill scans, ranks, and safely archives or removes them.

---

## Retirement categories

The lifecycle retirement system uses 8 categories to rank skills for retirement:

| Category | Code | Description | Default action |
|---|---|---|---|
| Deprecated | `DEPRECATED` | `deprecated: true` in frontmatter | Archive immediately |
| Ephemeral | `EPHEMERAL` | Tagged `ephemeral: true` or name pattern match | Archive immediately |
| Stale | `STALE` | No activation inside standard threshold days | Archive after review |
| Duplicate | `DUPLICATE` | Flagged by skill-deduplication-audit | Archive after review |
| Superseded | `SUPERSEDED` | Registry has a newer version published | Archive after review |
| Draft | `DRAFT` | Version `0.x.x` and never published | Archive after review |
| Broken | `BROKEN` | Health check grade F or missing SKILL.md | Move to trash |
| Orphan | `ORPHAN` | No owner, not in registry, never activated | Archive after review |

---

## Safety contract

This skill enforces a robust safety model:
- **Dry-run by default**: All commands are read-only dry-runs unless the `--confirm` flag is provided.
- **Archive layout**: Skills are moved to `.agent/skills/_archive/<date>/<skill-name>/` with a structured `ARCHIVE_MANIFEST.json` audit trail.
- **Trash layout**: Broken skills are moved to `.agent/skills/_trash/<date>/<skill-name>/` with a 7-day recovery window.
- **No permanent deletion**: Files are permanently deleted only via the explicit `purge` command.

---

## When to activate

Activate this skill in any of the following trigger situations:

| Trigger Situation | Purpose |
|---|---|
| Sprint or project ends | Clean up project-specific skills |
| Hackathon or spike ends | Remove temporary proof-of-concept drafts |
| High installed skill count | Reduce metadata token load and improve session performance |
| Duplicate skills found | Identify and remove redundant skill folders |
| Weekly team cleanup cycles | Maintain regular codebase and workspace hygiene |

---

## Step-by-step execution protocol

### Step 1 — Initialize cleanup policy
Create the default policy configuration file `.agent/cleanup_policy.json` in the workspace:
```bash
python {{SKILL_PATH}}/scripts/skill_cleanup.py init --workspace "."
```

### Step 2 — Scan and produce retirement plan
Perform a read-only audit of all skills to view retirement candidates and potential token savings:
```bash
python {{SKILL_PATH}}/scripts/skill_cleanup.py scan --workspace "." --skills-dir ".agent/skills"
```

### Step 3 — Apply automatic actions
Archive skills that qualify for automatic archiving (e.g. `DEPRECATED` and `EPHEMERAL` by default) by specifying `--auto-only`:
```bash
python {{SKILL_PATH}}/scripts/skill_cleanup.py apply --workspace "." --skills-dir ".agent/skills" --auto-only --confirm
```

### Step 4 — Apply comprehensive cleanup
Review and process all retirement candidates including review-required ones:
```bash
python {{SKILL_PATH}}/scripts/skill_cleanup.py apply --workspace "." --skills-dir ".agent/skills" --confirm
```

### Step 5 — Manually archive or trash a specific skill
Manually archive or move a single skill to trash with a specific reason:
```bash
python {{SKILL_PATH}}/scripts/skill_cleanup.py archive --workspace "." --skill-dir ".agent/skills/old-helper" --reason "Superseded" --confirm
python {{SKILL_PATH}}/scripts/skill_cleanup.py trash --workspace "." --skill-dir ".agent/skills/broken-draft" --reason "Fails linter" --confirm
```

### Step 6 — Recover a skill from trash
Restore a previously trashed skill back to the active skills directory:
```bash
python {{SKILL_PATH}}/scripts/skill_cleanup.py recover --workspace "." --skills-dir ".agent/skills" --skill-name "broken-draft" --confirm
```

### Step 7 — Purge old trash
Permanently delete trashed items older than N days:
```bash
python {{SKILL_PATH}}/scripts/skill_cleanup.py purge --workspace "." --skills-dir ".agent/skills" --older-than 7 --confirm
```

### Step 8 — Review action logs
Display the chronological history of all lifecycle cleanup actions:
```bash
python {{SKILL_PATH}}/scripts/skill_cleanup.py log --workspace "."
```

---

## Scope boundaries

This skill manages the **lifecycle assessment and retirement of installed skills**.

This skill does NOT:
- Permanently delete files without the explicit `purge` command and `--confirm` flag.
- Archive or modify protected core platform skills listed in the `never_archive` policy.
- Re-write original instructions or scripts within active skills.
- Make commits or push branches to remote git repositories automatically.

---

## Error handling

| Failure Mode | Standard Recovery Procedure |
|---|---|
| Missing policy file | Fall back to hardcoded default policy configuration and log a warning. |
| Missing activation log | Parse file modification timestamps (`mtime`) as a proxy for staleness calculations. |
| Path not writable | Halt execution immediately, print the exact permission error, and exit with status 3. |
| Skill in never_archive | Skip the skill entirely, note it under the protected section of the report, and continue scanning. |
| Recovery destination conflict | Refuse to restore from trash if a folder with the same name already exists in the active skills directory. |

---

## References

- `{{SKILL_PATH}}/scripts/skill_cleanup.py` — The core zero-dependency lifecycle retirement executor.
- [Keep a Changelog](https://keepachangelog.com/)
- [Semantic Versioning](https://semver.org/)
