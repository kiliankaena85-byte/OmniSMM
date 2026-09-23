# BRIEFING — 2026-06-07T10:27:13+03:00

## Mission
Generate VK Article 17: Накрутка опросов и голосований ВК: нюансы и безопасность.

## 🔒 My Identity
- Archetype: sub_orch
- Roles: orchestrator, user_liaison, human_reporter, successor
- Working directory: d:\SMM_plan_2\.agents\sub_orch_vk_article_17
- Original parent: main agent
- Original parent conversation ID: 9eaa9967-2faa-4354-9c0c-50a3f34ca281

## 🔒 My Workflow
- **Pattern**: Iteration Loop (Explorer -> Worker -> Reviewer -> Auditor)
- **Scope document**: d:\SMM_plan_2\.agents\sub_orch_vk_article_17\SCOPE.md
1. **Decompose**: Single Iteration Loop.
2. **Dispatch & Execute**:
   - **Direct (iteration loop)**: Explorer → Worker → Reviewer → test → gate
3. **On failure** (in this order):
   - Retry: nudge stuck agent or re-send task
   - Replace: spawn fresh agent with partial progress
   - Skip: proceed without (only if non-critical)
   - Redistribute: split stuck agent's remaining work
   - Redesign: re-partition decomposition
   - Escalate: report to parent (sub-orchestrators only, last resort)
4. **Succession**: At 16 spawns, write handoff.md, spawn successor.
- **Work items**:
  1. Article Generation [in-progress]
- **Current phase**: 2
- **Current focus**: Article Generation Iteration Loop

## 🔒 Key Constraints
- > 500 words. Language: Russian.
- File path: d:\SMM_plan_2\src\data\knowledge\vk_polls_votes_safety.md
- Markdown frontmatter: title, category (VK), seo_keywords.
- AI Marketer Audit constraints: No "AI water", integrate Smmplan mechanics naturally (e.g., TargetType link validation, Drip-Feed, PENDING_CHECK, PARTIAL, Refill/Гарантия).
- Explorer MUST draft an outline, Worker MUST write the text, Reviewers MUST audit it for length (>500 words) and AI Marketer constraints, Auditor MUST do Forensic Audit.
- Once the gate passes, send me a message with the exact file path created.
- Never reuse a subagent after it has delivered its handoff — always spawn fresh

## Current Parent
- Conversation ID: 9eaa9967-2faa-4354-9c0c-50a3f34ca281
- Updated: not yet

## Key Decisions Made
- Proceed directly to Iteration Loop (2B).

## Team Roster
| Agent | Type | Work Item | Status | Conv ID |
|-------|------|-----------|--------|---------|

## Succession Status
- Succession required: no
- Spawn count: 0 / 16
- Pending subagents: none
- Predecessor: none
- Successor: not yet spawned

## Active Timers
- Heartbeat cron: not started
- Safety timer: none

## Artifact Index
- d:\SMM_plan_2\.agents\sub_orch_vk_article_17\SCOPE.md — Scope document
