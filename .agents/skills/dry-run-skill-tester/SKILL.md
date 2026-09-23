---
name: dry-run-skill-tester
version: 1.0.0
description: |
  Provides an isolated sandbox environment to safely test and simulate other skills.
  Intercepts intended file modifications, terminal commands, and API calls, logging them.
  Use when the user asks to "test", "simulate", or "dry run" a skill.
  Activate before deploying a newly written or modified SKILL.md to production.
  Trigger when validating instructions to prevent destructive side effects.
---

# Dry-Run Skill Tester 🧪

In agentic environments, skills are essentially executable prompts that have 
access to the file system, shell, and internet. Testing a new skill (like an 
auto-refactorer or a git-commit-helper) directly in a working repository is 
dangerous. 

This skill puts the agent into **Dry-Run Mode**. When activated, you will 
simulate the execution of a target skill in a temporary sandbox directory, 
documenting every action you *would* have taken in the real workspace.

---

## When to activate

Activate this skill **as a pre-hook and post-hook** in the following situations:

| Trigger | Reason |
|---|---|
| User: "Test the `secret-leak-guard` skill" | Need to verify logic without real commits |
| User: "Dry run `agent-handoff-protocol`" | Ensure JSON packages format correctly safely |
| After creating a new skill | Mandatory validation before actual usage |
| Troubleshooting a broken skill | Isolate variables to see where the agent gets confused |

---

## Step-by-step execution protocol

### Step 1 — Initialize the Sandbox

Create an isolated temporary environment to prevent accidental modification 
of the user's real project files.

```bash
python {{SKILL_PATH}}/scripts/sandbox_manager.py init \
  --target-skill "<name-of-skill-to-test>"
```
*The script will output a sandbox path (e.g., `/tmp/agent-sandbox-12345`).*

### Step 2 — Generate Mock Data

To test a skill, you need context. Based on the target skill's `description` 
and triggers, create mock files *inside the sandbox directory*.

*Example: If testing `secret-leak-guard`, create a fake `.env` file in the sandbox 
with a dummy API key.*

### Step 3 — Enter STRICT Dry-Run Mode (Agent Constraints)

From this point forward, until the test concludes, you must adhere to the 
following constraints:

1. **NO REAL COMMANDS:** You must not run `git`, `curl`, `rm`, `npm`, or `python` 
   scripts outside of the sandbox directory.
2. **NO REAL FILE EDITS:** Do not modify any files in the user's workspace.
3. **LOG INTENTS:** Instead of running a mutating command, you must log what 
   you *intended* to do using the sandbox manager.

### Step 4 — Simulate the Target Skill

Read the `SKILL.md` of the target skill. Follow its Step-by-step execution 
protocol exactly as written, but apply your actions to the sandbox.

If the target skill tells you to modify a file or run a terminal command, 
**intercept** that action and log it:

```bash
python {{SKILL_PATH}}/scripts/sandbox_manager.py log-intent \
  --sandbox-dir "<sandbox_path>" \
  --action-type "TERMINAL_COMMAND" \
  --payload "git commit -m 'Test commit'" \
  --reason "Target skill step 3 instructed to commit changes"
```

```bash
python {{SKILL_PATH}}/scripts/sandbox_manager.py log-intent \
  --sandbox-dir "<sandbox_path>" \
  --action-type "FILE_MODIFICATION" \
  --payload "Replaced line 42 in auth.py with updated JWT logic" \
  --reason "Target skill step 2 dictated token refresh logic"
```

### Step 5 — Generate the Dry-Run Report

Once the target skill's protocol is fully simulated, finalize the test:

```bash
python {{SKILL_PATH}}/scripts/sandbox_manager.py report \
  --sandbox-dir "<sandbox_path>"
```

Present this report to the user in a clean, readable format. 
Critique the target skill's performance:
- Did the instructions lead to ambiguity?
- Were there any contradictory steps?
- Did the simulated outcome match the target skill's stated goal?

### Step 6 — Teardown

Clean up the sandbox to avoid leaving trash on the user's machine:

```bash
python {{SKILL_PATH}}/scripts/sandbox_manager.py teardown \
  --sandbox-dir "<sandbox_path>"
```

---

## Handling Tool/Script Calls in Dry-Run

If the target skill explicitly commands you to run one of its bundled Python 
scripts (e.g., `python .agent/skills/target-skill/scripts/scan.py`):
1. **Is it read-only?** (e.g., a scanner, a linter, a parser). If yes, you MAY 
   run it against the mock files inside your sandbox directory.
2. **Is it mutating?** (e.g., modifies files, sends API requests, interacts with Git). 
   If yes, DO NOT RUN IT. Log it via `log-intent` instead.

---

## Scope boundaries

This skill manages **isolated simulation of instructions**. It does NOT:
- Sandbox actual arbitrary code execution at the OS level (e.g., via Docker).
- Intercept Antigravity's internal platform API calls automatically. You (the agent) 
  must consciously intercept your own actions using the `log-intent` script.
- Replace unit tests for the Python scripts bundled inside skills.

---

## Error handling

If the `sandbox_manager.py` script fails (e.g., due to directory creation permissions or missing temporary disk space):
1. Print a clear alert message: `[Warning: Safe dry-run initialization failed]`.
2. Do NOT proceed with mutating actions. Re-attempt with a custom path or prompt the user for permission.
3. If logs fail to write, print the intended action directly to the terminal stdout for user inspection.

---

## References
- `{{SKILL_PATH}}/scripts/sandbox_manager.py` — Lifecycle manager for the test environment.
