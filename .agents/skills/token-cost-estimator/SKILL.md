---
name: token-cost-estimator
version: 1.0.0
description: |
  Estimates token consumption and monetary cost of agent tasks before execution.
  Analyzes task descriptions, file sets, skill chains, and conversation history
  to produce pre-flight cost reports. Use before starting a long refactoring,
  activate when performing multi-file generation, or trigger when the user wants
  to understand token budget impact before committing.
---

# Token Cost Estimator 💰

This skill answers one question before any long task begins:

```text
How much will this cost — in tokens and money — and can we afford it?
```

It is the **pre-flight cost check** for agent workflows.

## Why this matters

In a single-turn chatbot, cost is incidental.  
In an agentic workflow, cost is operational.

An agent working on a large refactoring task may:

- load 20 source files into context;
- activate 6 skills;
- run 40+ reasoning steps;
- produce 3,000 lines of output;
- spawn 2 sub-agents;
- iterate over the same files multiple times.

Without a cost estimate, the user discovers the price only on the invoice.

This skill makes cost **visible, predictable, and manageable** before work begins.

## Cost model

### Components of token cost

Every agent session has four cost components:

```text
┌─────────────────────────────────────────────────────────────────┐
│ Total tokens = INPUT + CONTEXT + OUTPUT + OVERHEAD              │
├──────────────────┬──────────────────────────────────────────────┤
│ INPUT            │ user prompt + task description               │
│ CONTEXT          │ loaded files + conversation history          │
│                  │ + activated skills                           │
│ OUTPUT           │ generated code + text + commands             │
│ OVERHEAD         │ platform system prompt + skill metadata      │
└──────────────────┴──────────────────────────────────────────────┘
```

### Token estimation ratios

| Content type | Chars per token | Notes |
|---|---|---|
| English prose | 4.0 | Standard text |
| Russian prose | 3.0 | Cyrillic compresses worse |
| Python / JS code | 3.5 | Operators add token count |
| JSON / YAML | 3.0 | Keys and structure are token-heavy |
| Markdown with tables | 3.8 | `|`, `#`, `**` add overhead |
| HTML | 2.8 | Tags are token-expensive |
| Minified code | 2.5 | Dense token use |
| Mixed | 3.5 | Default for unknown |

### Model pricing table

Prices are indicative and should be updated from provider pricing pages.
All values in USD per 1M tokens:

| Model | Input $/1M | Output $/1M | Context limit |
|---|---|---|---|
| Gemini 3.5 Flash | 1.50 | 9.00 | 1,048,576 |
| Gemini 3 Flash | 0.50 | 3.00 | 1,048,576 |
| Gemini 2.0 Flash | 0.075 | 0.30 | 1,048,576 |
| Claude Sonnet 4 | 3.00 | 15.00 | 200,000 |
| Claude Opus 4 | 15.00 | 75.00 | 200,000 |
| GPT-4o | 2.50 | 10.00 | 128,000 |
| GPT-4o mini | 0.15 | 0.60 | 128,000 |
| o3 | 10.00 | 40.00 | 200,000 |
| o4-mini | 1.10 | 4.40 | 200,000 |

> ⚠️ Always verify current pricing at the provider's pricing page.
> These figures change frequently.

## Risk levels

| Budget usage | State | Label |
|---|---|---|
| 0–50% | 🟢 | NOMINAL |
| 51–70% | 🟡 | MONITOR |
| 71–85% | 🟠 | WARN |
| 86–95% | 🔴 | ALERT |
| 96–100% | ⛔ | OVERFLOW |

## When to activate

Activate this skill before initiating any of the following triggers:

- User says "estimate cost" or "how many tokens"
- Task involves more than 5 files
- Task is described as "refactor all", "rewrite", "migrate"
- User mentions budget or cost concern
- Task spawns sub-agents
- `context-budget-monitor` shows WARN+
- Before long CI/CD skill chain
- User asks "will this fit in context?"
- Session has 15+ files already loaded

## Step-by-step execution protocol

### Step 1 — Estimate one task

```bash
python {{SKILL_PATH}}/scripts/token_cost_estimator.py estimate \
  --workspace "." \
  --task "Refactor the auth module to use JWT tokens" \
  --files "src/auth" \
  --skills "secret-leak-guard,skill-versioning" \
  --model "gemini-3.5-flash" \
  --output-factor 1.5
```

### Step 2 — Estimate from file list

```bash
python {{SKILL_PATH}}/scripts/token_cost_estimator.py estimate \
  --workspace "." \
  --files "src/auth,src/api/client.ts,tests/auth" \
  --model "gemini-3.5-flash"
```

### Step 3 — Estimate from stdin task description

```bash
cat task_description.md | \
python {{SKILL_PATH}}/scripts/token_cost_estimator.py estimate \
  --workspace "." \
  --stdin \
  --model "gemini-3.5-flash"
```

### Step 4 — Compare across models

```bash
python {{SKILL_PATH}}/scripts/token_cost_estimator.py compare \
  --workspace "." \
  --task "Rewrite all integration tests to use pytest fixtures" \
  --files "tests/" \
  --models "gemini-3.5-flash,claude-sonnet-4,gpt-4o"
```

### Step 5 — Check session accumulation

```bash
python {{SKILL_PATH}}/scripts/token_cost_estimator.py session \
  --workspace "."
```

This reads `.agent/logs/token_cost.jsonl` and summarizes accumulated
cost across the current working day.

### Step 6 — Split recommendation

If the estimate exceeds the model context limit or budget:

```bash
python {{SKILL_PATH}}/scripts/token_cost_estimator.py split \
  --workspace "." \
  --task "Refactor everything in src/" \
  --files "src/" \
  --model "gemini-3.5-flash" \
  --max-tokens 200000
```

This outputs a recommended task decomposition that keeps each chunk
within the token limit.

## Scope boundaries

This skill does NOT:

- provide exact billing figures;
- access real-time provider pricing APIs;
- guarantee cost accuracy within less than ±20%;
- replace provider cost dashboards;
- enforce hard budget limits at runtime;
- prevent tasks from running if over budget.

It provides **informed pre-flight estimates** to support human decision-making.

## Error handling

| Error | Response |
|---|---|
| Files not found | Report missing paths, estimate remaining files |
| Unknown model | Use Gemini 3.5 Flash as default, warn user |
| No task description | Estimate files + skills only, no task tokens |
| Log file unwritable | Print to stdout only |
| Skills dir missing | Estimate zero skill metadata tokens, warn |
| Overflow detected | Show split recommendation automatically |

## References

- `{{SKILL_PATH}}/scripts/token_cost_estimator.py` — estimator, comparator, splitter, session tracker
- [Google AI pricing](https://ai.googledev.com/pricing)
- [Anthropic pricing](https://www.anthropic.com/pricing)
- [OpenAI pricing](https://openai.com/pricing)
