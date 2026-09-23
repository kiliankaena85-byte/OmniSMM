---
name: skill-activation-logger
version: 1.0.0
description: |
  Logs and audits the agent's autonomous skill activation process.
  Provides deep observability by tracking which skills are activated, when, and why.
  Use when the agent decides to invoke any skill.
  Activate before running any external script or command.
  Trigger when the user asks "why did you do X?" or requests an audit trail.
---

# Skill Activation Logger 📊

In the Antigravity agentic framework, skill activation is **implicit**. The 
platform loads skill metadata into your system prompt, and you (the agent) 
autonomously decide which skills apply to the user's request. 

While this creates a seamless user experience, it creates an **observability 
black box** for the developer. If you make a mistake, or apply a formatting rule 
the user didn't ask for, the user has no way of knowing *which* skill caused it.

This skill forces you to leave a paper trail of your cognitive process.

---

## When to activate

Activate this skill **as a pre-hook and post-hook** in the following situations:

| Trigger | Action Required |
|---|---|
| You decide to use ANY other skill | Log the activation **before** executing the skill's instructions |
| A skill causes an error or conflict | Log the failure outcome |
| The user asks "Why did you do X?" | Query the logs to explain your past decisions |
| The user asks for a session summary | Query the logs to show which skills were utilized |

---

## Step-by-step execution protocol

### Step 1 — Record the Activation (Pre-Hook)

Whenever you read a user prompt and decide, *"I need to use skill X for this"*, 
you MUST record that decision before taking any action.

Run the tracker script:
```bash
python {{SKILL_PATH}}/scripts/activation_tracker.py record \
  --skill "<name-of-the-skill>" \
  --reason "<1-2 sentence explanation of WHY this skill matches the context>" \
  --trigger "<the specific word/phrase from the user that triggered this>"
```

*Example:*
```bash
python {{SKILL_PATH}}/scripts/activation_tracker.py record \
  --skill "secret-leak-guard" \
  --reason "The user asked to commit a file containing an AWS API key" \
  --trigger "git commit"
```

### Step 2 — Proceed with the Original Skill

After logging, follow the instructions of the skill you originally intended 
to use. 

### Step 3 — Record Failures (If applicable)

If the skill you activated fails (e.g., a script crashes, or you hit a conflict),
log the failure so it can be debugged later:

```bash
python {{SKILL_PATH}}/scripts/activation_tracker.py error \
  --skill "<name-of-the-skill>" \
  --error-msg "<brief description of what went wrong>"
```

### Step 4 — Querying Logs for the User

If the user wants to understand your behavior, query the recent activation history:

```bash
# Show the last 10 activations
python {{SKILL_PATH}}/scripts/activation_tracker.py history --limit 10

# Show usage stats (which skills are used most)
python {{SKILL_PATH}}/scripts/activation_tracker.py stats
```

Present the queried data to the user in a clear, formatted table.

---

## The Importance of the "Reason" Field

When recording an activation, the `--reason` field is the most critical part. 
Do not just repeat the skill description. Explain the **link between the user's 
current state and the skill**.

* ❌ **Bad:** "Because it is the code formatting skill."
* ✅ **Good:** "The user requested a Python script, and this skill mandates Black formatting for all new Python files."

---

## Scope boundaries

This skill manages **telemetry of agent cognition**. It does NOT:
- Track raw token usage (that is the job of `context-budget-monitor`).
- Track terminal commands (only the high-level *skills* you decide to use).
- Intercept Antigravity platform-level API calls.

---

## Error handling

If the `activation_tracker.py` script fails (e.g., due to file permission issues 
in the `.agent/logs/` directory):
1. Do NOT halt the user's task.
2. Inform the user in a short warning: `[Warning: Failed to log skill activation]`.
3. Proceed with the actual task. Telemetry should never block production work.

---

## References

- `{{SKILL_PATH}}/scripts/activation_tracker.py` — The JSONL logging engine.
- Logs are stored centrally in `<workspace>/.agent/logs/skill_activations.jsonl`.
