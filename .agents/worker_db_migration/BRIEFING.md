# BRIEFING — 2026-06-05T06:45:00Z

## Mission
Dump local database, transfer to production `smmplan.pro`, replace remote schema, and restart remote services safely.

## 🔒 My Identity
- Archetype: Database Migration Worker
- Roles: worker_db_migration
- Working directory: d:\SMM_plan_2\.agents\worker_db_migration
- Original parent: 9fce6f89-5b62-4979-9960-b10a20148a06
- Milestone: DB Migration & Production Release

## 🔒 Key Constraints
- CODE_ONLY network mode (no external HTTP calls, but SSH/SCP to target host smmplan.pro is permitted as instructed).
- Zero-Defect execution: no hardcoded outputs, verify every step.
- Handoff report in `d:\SMM_plan_2\.agents\worker_db_migration\handoff.md`.

## Current Parent
- Conversation ID: 9fce6f89-5b62-4979-9960-b10a20148a06
- Updated: 2026-06-05T06:45:00Z

## Task Summary
- **What to build/run**: SQL dump local database, transfer to smmplan.pro, replace schema, restart app/worker/bot containers, verify logs, clean up temp files.
- **Success criteria**: All remote containers (app, worker, bot) running, logs show no startup crashes/errors, local/remote temp files deleted.

## Key Decisions Made
- Use `docker exec` to dump inside container first and `docker cp` to avoid powershell redirection charset corruption.

## Artifact Index
- `d:\SMM_plan_2\.agents\worker_db_migration\handoff.md` — Handoff report
- `d:\SMM_plan_2\.agents\worker_db_migration\progress.md` — Progress tracker

## Change Tracker
- **Files modified**: None yet
- **Build status**: N/A
- **Pending issues**: Waiting for command approvals on docker exec/SSH commands.
