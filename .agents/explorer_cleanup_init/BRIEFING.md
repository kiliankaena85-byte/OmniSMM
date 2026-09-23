# BRIEFING — 2026-06-05T08:02:00+03:00

## Mission
Audit the SMMplan codebase for linting issues, dead code (Knip), legacy CommonJS modules, failing tests / network leaks, and database sanitization opportunities.

## 🔒 My Identity
- Archetype: explorer
- Roles: Codebase Cleanup Explorer
- Working directory: d:\SMM_plan_2\.agents\explorer_cleanup_init
- Original parent: 9fce6f89-5b62-4979-9960-b10a20148a06
- Milestone: Codebase Cleanup Audit

## 🔒 Key Constraints
- Read-only investigation — do NOT implement.
- Network mode: CODE_ONLY (No external calls).

## Current Parent
- Conversation ID: e48b1715-1348-4bda-aca3-eb16d77786cc
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `eslint.config.mjs` (ESLint config)
  - `package.json` (dependencies & run scripts)
  - `scripts/safe-replace.js` (legacy CommonJS script)
  - `scripts/qa-simulator-p2.ts` (TS script using dynamic require)
  - `test/setup.ts` (Vitest global setup & database reset logic)
  - `src/utils/balance-verifier.ts` & `src/utils/balance-verifier.test.ts` (BalanceVerifier logic and failed tests)
  - Prisma database state via `inspect-db.ts`
- **Key findings**:
  - **ESLint & Linting**: ESLint flat config ignores node_modules, build, .next, etc. running `npm run lint` yields 3109 issues (24 errors, 3085 warnings). Most warnings are due to missing globals in flat config (`console`, `vi`, `__dirname`, `FormData`, etc.).
  - **Knip Unused Code**: Unused dependency `@heroui/theme`; unlisted dependencies (`dotenv`, `node-fetch`, `decimal.js`); unresolved import of sync-catalog worker in `qa-simulator-p2.ts`; and 46 unused exports.
  - **CommonJS Usage**: `scripts/safe-replace.js` is legacy CommonJS. `scripts/qa-simulator-p2.ts` uses dynamic require calls to avoid build-time dependency cycles.
  - **Test Failure / Leak**: `src/utils/balance-verifier.test.ts` fails 5/5 tests due to database state leakage. `test/setup.ts` bypasses DB reset for unit tests, while `balance-verifier.test.ts` only purges `@example.com` users, leaving other tests' users in the database during verification.
  - **Database State**: Prisma local DB has active records (User, Order, Payment, Ticket, TicketMessage, LedgerEntry). SystemSettings is set to `isTestMode: true` with a test YooKassa ID and default credentials.
- **Unexplored areas**: None.

## Key Decisions Made
- Audited the full list of ESLint warnings, Knip debt, CommonJS usages, and Vitest setup.
- Pinpointed the root cause of the `balance-verifier` test failures to test database state leakage.

## Artifact Index
- d:\SMM_plan_2\.agents\explorer_cleanup_init\handoff.md — Codebase Cleanup Investigation Report
