# BRIEFING — 2026-06-05T09:43:00Z

## Mission
Sanitize the local PostgreSQL development database and configure domains ready for production migration.

## 🔒 My Identity
- Archetype: worker_db_sanitize
- Roles: Database Sanitizer & Validator (implementer, qa, specialist)
- Working directory: d:\SMM_plan_2\.agents\worker_db_sanitize
- Original parent: 9fce6f89-5b62-4979-9960-b10a20148a06
- Milestone: Database Sanitization & Migration Preparation

## 🔒 Key Constraints
- Connect to the local PostgreSQL database using PrismaClient.
- Safely delete/truncate all transactional and user-related garbage tables.
- Delete all `User` records EXCEPT those with role `OWNER` or `ADMIN`.
- Update all settings in `SystemSettings` (row with id='global') and `SystemSetting` key-value table: replace `http://localhost:3000` or `http://127.0.0.1:3000` with `https://smmplan.pro`.
- Update the `Provider` table: replace `localhost:3000` or `127.0.0.1:3000` in `apiUrl` with `https://smmplan.pro`.
- Execute verification: transactional tables 0 rows, users role OWNER/ADMIN only, SystemSettings/SystemSetting and Provider urls updated.
- Run `npm run lint`, `npm run test`, `npm run build`.
- Write handoff report at `handoff.md` and send message to main agent.
- DO NOT CHEAT. All implementations must be genuine.

## Current Parent
- Conversation ID: 9fce6f89-5b62-4979-9960-b10a20148a06
- Updated: yes (2026-06-05T06:36:00Z)

## Task Summary
- **What to build**: DB sanitization script at `scripts/sanitize-db-prod.ts` and verification script at `scripts/check-db.ts`. Run them. Run lint, test, and build.
- **Success criteria**: All transactional tables empty, only OWNER/ADMIN users left, domains updated to `https://smmplan.pro`, tests passing, lint passing, build passing.
- **Interface contracts**: PROJECT.md or AGENTS.md.
- **Code layout**: Root directory scripts folder.

## Key Decisions Made
- Use Prisma Client to query, delete, and update tables to respect PostgreSQL database types and constraints.
- Executed raw SQL to disable the `no_update_delete_ledger` trigger on the `LedgerEntry` table before truncating, and re-enabled it immediately after the transactional tables deletions to comply with Postgres constraints while achieving clean truncation.
- Left port `3001` (mock provider API) intact since the task strictly instructed domain replacements on `localhost:3000` and `127.0.0.1:3000`.

## Change Tracker
- **Files modified**:
  - `scripts/sanitize-db-prod.ts` (created) — Performs clean database truncation of 26 transactional tables, disables/re-enables ledger trigger, deletes non-staff users, and updates development domain references.
  - `scripts/check-db.ts` (updated) — Independent validation script checking table counts, user roles, system setting domains, and provider API URLs.
- **Build status**: PASS
- **Pending issues**: None

## Quality Status
- **Build/test result**: PASS (vitest: 653/657 tests passed, 4 skipped; next build: success)
- **Lint status**: PASS (0 errors, 0 warnings from eslint)
- **Tests added/modified**: None needed (existing integration and unit tests fully verified)

## Loaded Skills
- C:\Users\Артём\.gemini\config\skills\gsd-prisma-manifest.md — gsd-prisma-manifest — Prisma 5 conventions and transaction handling
- d:\SMM_plan_2\.agent\skills\delivery-engineer-v3\SKILL.md — delivery-engineer-v3 — Code implementation and validation guidelines

## Artifact Index
- d:\SMM_plan_2\.agents\worker_db_sanitize\handoff.md — Handoff report with results and verification outputs
