---
name: conflict-resolution-arbitrator
version: 1.0.0
description: |
  Detects, analyzes, and safely resolves file modification conflicts.
  Parses standard conflict markers into structured blocks and applies targeted semantic merges.
  Use when a git merge, rebase, or pull fails with merge conflicts.
  Activate when conflict markers (<<<<<<< HEAD) are detected in any workspace file.
  Trigger when the user asks to resolve merge conflicts or when checksum mismatches occur.
---

# Conflict Resolution Arbitrator ⚖️

In multi-agent environments, parallel workflows inevitably lead to write 
collisions. When standard Git merge conflicts occur, language models typically 
struggle: they either blindly delete the `<<<<<<<` markers leaving broken code, 
hallucinate a full-file rewrite that loses unrelated changes, or get confused 
by the duplicated syntax.

This skill provides a **surgical, structured protocol** for resolving conflicts 
block-by-block, ensuring that the semantic intent of both authors is preserved.

## Mental Model: The Semantic Merge

A conflict is not just a text collision; it is a **collision of intents**.
- **Ours (Current Change):** What we were trying to achieve.
- **Theirs (Incoming Change):** What the other agent/human was trying to achieve.

Your job is NOT just to pick one. Your job is to understand *both* intents 
and write a resolution that satisfies both (Semantic Merge), or deliberately 
discard one with documented justification.

---

## When to activate

Activate this skill **as a pre-hook and post-hook** in the following situations:

| Trigger | Signal |
|---|---|
| Git operation failure | `git merge`, `git pull`, `git rebase` fails with "merge conflict" |
| Text markers detected | File contains `<<<<<<< HEAD`, `=======`, `>>>>>>>` |
| Agent Handoff conflict | `agent-handoff-protocol` reports a checksum mismatch on a file |
| Human intervention | User says "resolve the merge conflicts in this PR" |

---

## Step-by-step execution protocol

### Step 1 — Identify the conflicted files

If a git operation just failed, run:
```bash
git diff --name-only --diff-filter=U
```
This lists all unmerged (conflicted) files.

### Step 2 — Parse the conflicts in a file

Do NOT try to read and manually `sed`/`awk` the raw file with markers. 
Run the parser to extract clean, structured conflict blocks:

```bash
python {{SKILL_PATH}}/scripts/parse_conflicts.py --file "<path_to_conflicted_file>"
```

The script will output a numbered list of conflicts (e.g., `Conflict #1`, `Conflict #2`).
For each conflict, it shows:
- **[OURS]**: The current branch's changes.
- **[THEIRS]**: The incoming branch's changes.
- **[BASE]**: The original common ancestor (if `merge.conflictstyle diff3` is enabled).

### Step 3 — Analyze the intent (For each conflict)

Before changing anything, pause and reason about the specific block:
1. What was the goal of `[OURS]`? (e.g., "Added error handling")
2. What was the goal of `[THEIRS]`? (e.g., "Refactored the function signature")
3. Are they orthogonal, or mutually exclusive?

### Step 4 — Choose a resolution strategy

Select one of the following strategies for the block:

| Strategy | When to use |
|---|---|
| **ACCEPT_OURS** | The incoming change is wrong, outdated, or superseded by our work. |
| **ACCEPT_THEIRS** | Our change is obsolete; the incoming change is better. |
| **SEMANTIC_MERGE** | Both changes are valid and must be combined. (e.g., Apply our error handling to their new function signature). |

### Step 5 — Apply the resolution

Use the resolver script to apply the fix safely to the specific block.

**To accept one side entirely:**
```bash
python {{SKILL_PATH}}/scripts/resolve_conflict.py \
  --file "<path_to_file>" \
  --conflict-index <N> \
  --strategy "ours"   # or "theirs"
```

**To apply a Semantic Merge:**
1. Write the combined, corrected code to a temporary file (e.g., `resolution_1.txt`).
2. Apply it:
```bash
python {{SKILL_PATH}}/scripts/resolve_conflict.py \
  --file "<path_to_file>" \
  --conflict-index <N> \
  --strategy "manual" \
  --resolution-file "resolution_1.txt"
```

### Step 6 — Verify and continue

1. Re-run `parse_conflicts.py` to ensure 0 conflicts remain in the file.
2. Run syntax checks (e.g., `python -m py_compile <file>`, `npm run lint`).
3. Add the resolved file to git: `git add <file>`.
4. If a merge was in progress, conclude it: `git commit -m "Resolve merge conflicts"`.

---

## Semantic Merge Playbook

When combining code (`--strategy manual`), watch out for these traps:

- **The Duplicate Import Trap:** Ours adds `import X`, Theirs adds `import Y`. Do not concatenate the blocks resulting in two `import` blocks. Merge them: `import X, Y`.
- **The Signature Mismatch Trap:** Ours changes a function body. Theirs adds a new parameter to the function definition. You must apply the new parameter to the definition *and* keep the new body.
- **The JSON/YAML Comma Trap:** When merging arrays or objects in config files, ensure trailing commas are correct. JSON does not allow trailing commas.

---

## Scope boundaries

This skill manages **textual file conflicts**. It does NOT:
- Resolve logical conflicts that don't produce text markers (e.g., Agent A renames a function in file X, Agent B calls the old function in file Y). That requires the `testing` or `linting` skills.
- Force-push over a teammate's branch without user consent.
- Auto-commit the merge without verifying syntax.

---

## Error handling

| Error | Response |
|---|---|
| Parser says "Malformed conflict markers" | The markers were accidentally edited. Revert the file (`git checkout --ours <file>`) and restart the merge, or manually edit the file if git history is lost. |
| Resolver says "Conflict index out of bounds"| You are trying to resolve a conflict that was already resolved or shifted. Re-run `parse_conflicts.py` to get the updated indices. |
| Tests fail after semantic merge | Your manual resolution introduced a bug. Edit the file directly to fix the logic error, then `git add`. |

---

## References

- `{{SKILL_PATH}}/scripts/parse_conflicts.py` — conflict block extractor
- `{{SKILL_PATH}}/scripts/resolve_conflict.py` — surgical resolution applicator
- [Git Advanced Merging](https://git-scm.com/book/en/v2/Git-Tools-Advanced-Merging)
