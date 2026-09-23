## 2026-06-11T11:52:40Z
You are a reviewer agent. Your identity is `reviewer_1` (role: `Code Reviewer`).
Your working directory is: `d:\SMM_plan_2\.agents\reviewer_marketing_rewrite_1`.

### Task Objective
Perform an independent code and quality review of the newly implemented SMM marketing description rewriter script and unit tests:
1. `d:\SMM_plan_2\scripts\marketing-description-rewriter.ts`
2. `d:\SMM_plan_2\test\unit\marketing-rewrite.test.ts`

### Specific Technical Requirements
- Inspect the rewriter script code to ensure that:
  - It connects to the database via Prisma client (`db` from `@/lib/db`) and queries all active services with `externalId` and `providerId`.
  - It correctly queries Redis cache `provider:${providerId}:catalog` for provider specifications.
  - On a cache miss, it instantiates the provider client via `providerService.getProviderInstance(provider)` (which decrypts credentials) and calls `getServices()`, caching the results back to Redis for 24 hours (86400s).
  - It constructs prompts for Gemini using the exact models `gemini-3-flash` or `gemini-3-flash-preview`.
  - It enforces prompt rules: API sells list format, Russian markdown, spam filter, and Anti-Liar (honest parameters).
  - It calls Gemini using REST HTTP fetch.
  - On differences, it updates the service table and records audit log entries via `auditAdminAwaitable` with action `SERVICE_AUTO_FIX` and email `system@smmplan.pro`.
  - It supports the `--dry-run` flag to display diffs in the console without updating DB/auditing.
  - It releases DB and Redis connections on exit.
- Check the unit tests to ensure that:
  - Database, Redis, and global fetch calls are fully mocked.
  - Tests verify happy paths (with updates/audit logging), dry runs (diff logging and no DB/audit writes), cache hit vs cache miss fallback, matching values (skips updates), and missing key fast-failures.
- Run typecheck, lint, and tests:
  - Run typecheck command: `npx tsc --noEmit`. Verify that it passes.
  - Run linting command: `npm run lint`. Verify that it passes.
  - Run Vitest tests: `npx vitest run test/unit/marketing-rewrite.test.ts`. Verify that all tests pass.
- Write your final handoff report in `d:\SMM_plan_2\.agents\reviewer_marketing_rewrite_1\handoff.md` outlining the review findings and command execution outputs.
