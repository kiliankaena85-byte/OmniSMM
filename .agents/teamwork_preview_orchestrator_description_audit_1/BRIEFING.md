# BRIEFING — 2026-06-11T14:45:07+03:00

## Mission
Implement the description audit service, the admin panel tab, and the vitest unit tests.

## 🔒 My Identity
- Archetype: teamwork_preview_orchestrator
- Roles: orchestrator, user_liaison, human_reporter, successor
- Working directory: d:\SMM_plan_2\.agents\teamwork_preview_orchestrator_description_audit_1
- Original parent: main agent
- Original parent conversation ID: 4bbd0ec4-e644-438f-8ff3-95c7fc2e823b

## 🔒 My Workflow
- **Pattern**: Project
- **Scope document**: d:\SMM_plan_2\.agents\teamwork_preview_orchestrator_description_audit_1\PROJECT.md
1. **Decompose**: Decompose the task into three logical parts: (1) Description Audit Service backend, (2) Admin Panel UI tab using HeroUI v3, (3) Vitest unit tests.
2. **Dispatch & Execute**:
   - **Direct (iteration loop)**: Explorer → Worker → Reviewer → test → gate
   - **Delegate (sub-orchestrator)**: None (simple enough for direct iteration loop)
3. **On failure** (in this order):
   - Retry: nudge stuck agent or re-send task
   - Replace: spawn fresh agent with partial progress
   - Skip: proceed without (only if non-critical)
   - Redistribute: split stuck agent's remaining work
   - Redesign: re-partition decomposition
   - Escalate: report to parent (sub-orchestrators only, last resort)
4. **Succession**: at 16 spawns, write handoff.md, spawn successor
- **Work items**:
  1. Explore current codebase, Prisma schema, existing service actions and UI [pending]
  2. Implement backend DescriptionAuditEngine and actions [pending]
  3. Implement frontend admin panel tab [pending]
  4. Write and execute Vitest unit tests [pending]
- **Current phase**: 1
- **Current focus**: Exploration and planning

## 🔒 Key Constraints
- NEVER write, modify, or create source code files directly.
- NEVER run build/test commands yourself — require workers to do so.
- You MAY use file-editing tools ONLY for metadata/state files (.md) in your .agents/ folder.
- Always use AI model 'gemini-3-flash-preview' or 'gemini-3-flash'.
- Zero-Defect Execution Protocol (TRIPLE-AGENT STRATEGY): Analyst -> Researcher -> Surgeon.

## Current Parent
- Conversation ID: 4bbd0ec4-e644-438f-8ff3-95c7fc2e823b
- Updated: not yet

## Key Decisions Made
- [TBD]

## Team Roster
| Agent | Type | Work Item | Status | Conv ID |
|-------|------|-----------|--------|---------|
| 5a825a88-affe-4af0-8bc2-758776d185e8 | teamwork_preview_explorer | Explore codebase for description audit | in-progress | 5a825a88-affe-4af0-8bc2-758776d185e8 |

## Succession Status
- Succession required: no
- Spawn count: 1 / 16
- Pending subagents: [5a825a88-affe-4af0-8bc2-758776d185e8]
- Predecessor: none
- Successor: not yet spawned

## Active Timers
- Heartbeat cron: 1ca6927c-e062-4cf7-91a4-f4bfc2e9e085/task-11
- Safety timer: 1ca6927c-e062-4cf7-91a4-f4bfc2e9e085/task-25
- On succession: kill all timers before spawning successor
- On context truncation: run `manage_task(Action="list")` — re-create if missing

## Artifact Index
- d:\SMM_plan_2\.agents\teamwork_preview_orchestrator_description_audit_1\PROJECT.md — Global index: architecture, milestones, interfaces, code layout
