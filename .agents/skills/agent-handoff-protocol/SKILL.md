---
name: agent-handoff-protocol
version: 1.0.0
description: |
  Manages structured context transfer between agents in multi-agent
  workflows. Creates, validates, and consumes handoff packages that
  encode completed work, produced artifacts, open decisions, and
  continuation instructions. Use when orchestrating parallel agents,
  spawning a sub-agent for a subtask, resuming a task in a new session,
  passing work between specialized agents, or when an agent must hand
  off an incomplete task due to context budget exhaustion.
---

# Agent Handoff Protocol 🌐

This skill defines the **contract for transferring work between agents**.
In multi-agent Antigravity workflows, agents run in parallel, spawn
sub-agents dynamically, and operate across sessions. Without a handoff
protocol, each agent starts blind — it repeats already-completed work,
makes decisions that conflict with prior agents, and produces artifacts
that collide with others.

## The core problem

```text
Without this skill:               With this skill:

Agent A completes step 1          Agent A completes step 1
Agent B starts — doesn't know     Agent A writes handoff package
  what A did                       Agent B reads handoff package
Agent B repeats step 1            Agent B starts at step 2
Agent B makes different           Agent B knows A's decisions
  architectural decisions         Agent B checks artifact registry
Agent A and B both create         No duplication, no conflict
  auth.py — conflict              Clean continuation
```

In agentic environments, agents have access to the file system, terminal,
and browser. A second agent acting on stale information doesn't just waste
tokens — it can overwrite files, re-run destructive commands, or undo
completed work.

---

## Handoff package structure

A handoff package is a single JSON file written to a well-known location
in the workspace. It is the single source of truth for inter-agent state.

```text
.agent/handoffs/
├── handoff_<task-id>_<timestamp>.json   ← active handoff package
└── _archive/
    └── handoff_<task-id>_<timestamp>.json  ← completed handoffs
```

### Package schema

```json
{
  "schema_version": "1.0",
  "task_id":        "refactor-auth-module-2026-05-22",
  "created_at":     "2026-05-22T12:00:00Z",
  "created_by":     "agent-alpha",
  "status":         "READY_FOR_HANDOFF",
  "task": {
    "original_goal": "Refactor the auth module to use JWT tokens",
    "decomposition": [
      {"id": "T1", "description": "Audit existing auth code", "status": "DONE"},
      {"id": "T2", "description": "Implement token issuance", "status": "IN_PROGRESS"}
    ]
  },
  "completed_work": {
    "summary": "Audited files and designed JWT schema.",
    "decisions_made": [
      {
        "id": "D1",
        "decision": "Use RS256 (asymmetric) not HS256",
        "rationale": "Multiple services need to verify tokens independently",
        "alternatives_rejected": ["HS256 — requires shared secret"]
      }
    ]
  },
  "artifacts": [
    {
      "path":        "src/auth/jwt_schema.py",
      "status":      "COMPLETE",
      "description": "JWT payload schema",
      "checksum":    "sha256:a3f9...",
      "owner":       "agent-alpha",
      "lock":        false
    }
  ],
  "open_items": [
    {
      "id":       "O1",
      "type":     "DECISION_NEEDED",
      "priority": "HIGH",
      "question": "Should refresh tokens be stored in Redis?",
      "context":  "Redis is faster but adds infra dependency.",
      "blocking": ["T2"]
    }
  ],
  "continuation": {
    "next_task_id":    "T2",
    "entry_point":     "Resume token_issuer.py implementation at line 87",
    "must_not_touch":  ["src/auth/jwt_schema.py"],
    "must_resolve_first": ["O1"],
    "suggested_approach": "Complete token_issuer.py, then address O1",
    "context_files":  ["src/auth/jwt_schema.py"]
  },
  "environment": {
    "working_directory": "src/auth/",
    "active_branch":     "feature/jwt-migration",
    "last_commit":       "abc1234",
    "relevant_env_vars": ["JWT_PRIVATE_KEY_PATH"],
    "tools_used":        ["python", "git"]
  },
  "receiving_agent": {
    "recommended_skills": ["secret-leak-guard"],
    "warnings": ["Do not run tests until T2 is complete"]
  }
}
```

---

## Package status lifecycle

```text
DRAFT            ← agent is still building the package
    │
    ▼
READY_FOR_HANDOFF  ← package complete, validated, ready to consume
    │
    ├──► CLAIMED     ← receiving agent has acknowledged the package
    │        │
    │        ▼
    │    IN_PROGRESS  ← receiving agent is actively working
    │        │
    │        ▼
    │    COMPLETED    ← task finished, package archived
    │
    └──► EXPIRED      ← package not claimed within TTL (default: 24h)
```

---

## When to activate this skill

| Trigger | Role | Action |
|---|---|---|
| About to spawn a sub-agent | Sender | Create handoff package before spawning |
| Receiving a task from another agent | Receiver | Read and validate handoff package |
| Context budget hits 85% on long task | Sender | Emergency handoff — save state, hand off continuation |
| Task requires specialized skill another agent has | Sender | Package current state, route to specialist |
| Parallel agents need to coordinate on shared files | Both | Register artifact ownership in shared package |
| New session started to continue previous work | Receiver | Read latest handoff package for this task |
| Agent completes its assigned subtask | Sender | Write completion notice + update package |

---

## Step-by-step execution protocol

### Role A — Sending agent (creating a handoff)

#### Step A1 — Assess handoff readiness

Before creating a package, verify:
```text
□ All completed subtasks have a clear completion status
□ All files modified are saved and not in a broken state
□ All decisions made are documented with rationale
□ All open questions are clearly articulated
□ The continuation entry point is unambiguous
```
If any item is unclear — resolve it before handing off.

#### Step A2 — Create the handoff package

```bash
python {{SKILL_PATH}}/scripts/handoff_manager.py create \
  --task-id    "<task-id>" \
  --goal       "<original user goal>" \
  --agent-id   "<this-agent-id>" \
  --output-dir "<workspace>/.agent/handoffs"
```

Fill DRAFT package using `update` subcommands:

```bash
# Record completed work
python {{SKILL_PATH}}/scripts/handoff_manager.py add-completed \
  --task-id "<task-id>" \
  --summary "<what was accomplished>" \
  --handoffs-dir "<workspace>/.agent/handoffs"

# Register an artifact
python {{SKILL_PATH}}/scripts/handoff_manager.py add-artifact \
  --task-id    "<task-id>" \
  --path       "<file-path>" \
  --status     "COMPLETE|IN_PROGRESS" \
  --description "<what this file contains>" \
  --lock       false \
  --handoffs-dir "<workspace>/.agent/handoffs"

# Add an open item
python {{SKILL_PATH}}/scripts/handoff_manager.py add-open-item \
  --task-id  "<task-id>" \
  --type     "DECISION_NEEDED|INVESTIGATION_NEEDED|BLOCKED" \
  --priority "HIGH|MEDIUM|LOW" \
  --question "<what needs to be resolved>" \
  --blocking "<comma-separated task IDs>" \
  --handoffs-dir "<workspace>/.agent/handoffs"

# Set continuation instructions
python {{SKILL_PATH}}/scripts/handoff_manager.py set-continuation \
  --task-id     "<task-id>" \
  --next-task   "<subtask-id>" \
  --entry-point "<specific instruction for receiving agent>" \
  --must-not-touch "<comma-separated paths>" \
  --handoffs-dir "<workspace>/.agent/handoffs"
```

#### Step A3 — Validate and seal the package

```bash
python {{SKILL_PATH}}/scripts/handoff_manager.py seal \
  --task-id      "<task-id>" \
  --handoffs-dir "<workspace>/.agent/handoffs"
```
`seal` validates the package, computes checksums, and transitions to `READY_FOR_HANDOFF`.

#### Step A4 — Notify the receiving agent
Provide: 1. Package path, 2. Task ID, 3. One-line summary.

---

### Role B — Receiving agent (consuming a handoff)

#### Step B1 — Read and validate the package

```bash
python {{SKILL_PATH}}/scripts/handoff_manager.py read \
  --task-id      "<task-id>" \
  --handoffs-dir "<workspace>/.agent/handoffs"
```
Validates schema, status, artifact existence, checksums, and locks.

#### Step B2 — Claim the package

```bash
python {{SKILL_PATH}}/scripts/handoff_manager.py claim \
  --task-id      "<task-id>" \
  --agent-id     "<this-agent-id>" \
  --handoffs-dir "<workspace>/.agent/handoffs"
```
Transitions status to `CLAIMED` and records receiving agent ID.

#### Step B3 — Build local context from the package
1. **Review decisions** — do NOT re-litigate closed decisions.
2. **Check artifact ownership** — do NOT edit `lock: true` files owned by others.
3. **Read `must_not_touch`** — acknowledge but do not edit.
4. **Resolve `must_resolve_first`** before starting work.
5. **Load `context_files`** to understand current state.

#### Step B4 — Check in periodically

```bash
python {{SKILL_PATH}}/scripts/handoff_manager.py checkpoint \
  --task-id      "<task-id>" \
  --subtask-id   "<current-subtask>" \
  --status       "IN_PROGRESS" \
  --note         "<what was just completed>" \
  --handoffs-dir "<workspace>/.agent/handoffs"
```

#### Step B5 — Complete or re-hand-off

```bash
python {{SKILL_PATH}}/scripts/handoff_manager.py complete \
  --task-id      "<task-id>" \
  --summary      "<what was accomplished>" \
  --handoffs-dir "<workspace>/.agent/handoffs"
```

---

## Artifact locking protocol

When multiple agents work in parallel on the same codebase, locks prevent conflicts:

```text
Agent A wants to write src/auth/token_issuer.py
  │
  ├── Check package: is token_issuer.py listed as lock: true?
  │     YES → Wait or choose a different file
  │     NO  → Register lock before writing:
  │
  └── handoff_manager.py lock-artifact \
        --task-id <id> --path src/auth/token_issuer.py
        ↓
      Write the file
        ↓
      handoff_manager.py unlock-artifact \
        --task-id <id> --path src/auth/token_issuer.py
```
Locks are advisory, not OS-level. Cooperation is required.

---

## Emergency handoff (context budget exhaustion)

When `context-budget-monitor` triggers a CRITICAL alert mid-task, perform an emergency handoff:

```bash
# 1. Serialize current agent state immediately
python {{SKILL_PATH}}/scripts/state_serializer.py snapshot \
  --task-id    "<task-id>" \
  --output-dir "<workspace>/.agent/handoffs"

# 2. Create emergency package from snapshot
python {{SKILL_PATH}}/scripts/handoff_manager.py emergency \
  --task-id    "<task-id>" \
  --reason     "context-budget-exhaustion" \
  --handoffs-dir "<workspace>/.agent/handoffs"
```

Write `PROGRESS.md` to the workspace root:

```markdown
# Task Progress — <task-id>
⚠️ Interrupted due to context budget exhaustion.

## Status at interruption
- Last completed step: <step>
- In-progress file: <file>, line <N>
- Handoff package: .agent/handoffs/handoff_<task-id>_<ts>.json

## To resume
Start a new session and run:
  skill: agent-handoff-protocol
  action: read handoff package for task <task-id>
```

---

## Multi-agent conflict resolution

When two agents have made conflicting changes (mismatched checksum):

```text
Conflict detected on: src/auth/middleware.py
Agent A's version: checksum sha256:aaa...
Agent B's version: checksum sha256:bbb...
Package expected:  checksum sha256:aaa...  ← A was registered owner

Resolution protocol:
1. Halt both agents immediately
2. Present conflict to user with diff
3. User selects winning version OR manual merge
4. Update package with resolved checksum and Resume
```

```bash
python {{SKILL_PATH}}/scripts/handoff_manager.py resolve-conflict \
  --task-id     "<task-id>" \
  --artifact    "<path>" \
  --winner      "agent-a|agent-b|manual" \
  --handoffs-dir "<workspace>/.agent/handoffs"
```

---

## Integration with other skills

| Skill | Integration point |
|---|---|
| `context-budget-monitor` | Triggers emergency handoff at 85% usage |
| `secret-leak-guard` | Scan handoff package before writing |
| `prompt-injection-detector` | Scan received handoff package before consuming |
| `skill-versioning` | Handoff packages reference skill versions in use |
| `workspace-snapshot` | Take workspace snapshot before receiving handoff |

---

## Scope boundaries

This skill manages **inter-agent context transfer**. It does NOT:
- Enforce file system locks at OS level (advisory locks only).
- Replace proper task queues or schedulers in production.
- Handle network communication between different machines (shared filesystem assumed).
- Manage agent authentication/authorization or guarantee delivery.

---

## Error handling

| Error | Response |
|---|---|
| Package not found | List available packages, suggest closest match |
| Package status is not READY | Show current status, explain valid transitions |
| Artifact checksum mismatch | Trigger conflict resolution protocol |
| Locked artifact in must_not_touch | Halt, report conflict, wait for lock release |
| Double claim | First claim wins; second receives ALREADY_CLAIMED error |
| Schema version mismatch | Refuse to consume, report version incompatibility |
| Empty emergency handoff | Create minimal package with goal + environment only |

---

## References

- `{{SKILL_PATH}}/scripts/handoff_manager.py` — package lifecycle manager
- `{{SKILL_PATH}}/scripts/state_serializer.py` — agent state serializer
- [Multi-agent systems — Antigravity docs](https://antigravity.google/docs/multi-agent)
- [Distributed systems: optimistic vs pessimistic locking](https://en.wikipedia.org/wiki/Optimistic_concurrency_control)
