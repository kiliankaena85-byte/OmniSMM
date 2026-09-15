## 2026-06-11T14:49:31Z

You are a worker agent. Your identity is `worker_1` (role: `Marketing Rewriter Developer`).
Your working directory is: `d:\SMM_plan_2\.agents\worker_marketing_rewrite_1`.

### Task Objective
Implement the console description rewriter script and unit tests according to the plan and scope:
- Read the implementation plan at: `d:\SMM_plan_2\.agents\teamwork_preview_orchestrator_marketing_rewrite_1\plan.md`
- Read the scope at: `d:\SMM_plan_2\.agents\teamwork_preview_orchestrator_marketing_rewrite_1\SCOPE.md`
- Read the codebase investigation report at: `d:\SMM_plan_2\.agents\teamwork_preview_orchestrator_marketing_rewrite_1\explorer_handoff.md`

### Target Files to Create
1. `d:\SMM_plan_2\scripts\marketing-description-rewriter.ts`
2. `d:\SMM_plan_2\test\unit\marketing-rewrite.test.ts`

### Specific Technical Requirements
- For the script execution, import necessary modules: `db` from `@/lib/db`, `redis` from `@/lib/redis`, `providerService` from `@/services/providers/provider.service`, `auditAdminAwaitable` from `@/lib/admin-audit`, etc.
- Support a `--dry-run` CLI flag (e.g. `process.argv.includes('--dry-run')`). If set, simulate the changes, printing a diff of name/description changes to the console, but do NOT update the DB or insert audit logs.
- Retrieve all active services with `externalId` from DB: `db.service.findMany({ where: { isActive: true, externalId: { not: null } } })`.
- For each service, get its original provider specifications.
  - Read from Redis key `provider:${providerId}:catalog` first. Since the catalog in Redis is a JSON array of provider services, look up the service by `externalId`.
  - If cache is empty/missing, fetch via provider client API using `providerService.getProviderInstance(provider)`. Call `getServices()`, look up the service by `externalId`, and cache the retrieved catalog in Redis using `redis.setex` with a 24-hour TTL (86400s) to speed up future checks.
  - If provider API call fails or service is not found in provider catalog, log a warning and skip to next service.
  - If provider description is empty or missing, provide a reasonable fallback description or indicate that the description is empty.
- Pass the local name/description and provider name/description to Gemini model `gemini-3-flash` or `gemini-3-flash-preview` (use these names exactly).
- Gemini system instruction/prompt must enforce:
  1. **Honesty (No Lying)**: Align strictly with the technical specifications of the provider (no promising 'no drop' if the provider has no refill; state start delays like 'start up to 12-24h' if slow).
  2. **API Selling Structure**: Clean Russian Markdown lists (Скорость, Гарантия, Лимиты, Особенности).
  3. **No Spam/Spam Filtering**: Remove links, URLs, contacts, @usernames, and blacklisted SMM terms like 'накрутка', 'накрутить'.
- Call Gemini via standard REST fetch to `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` with the system instruction and user content separate, specifying JSON output format (`responseMimeType: "application/json"`).
- Check if Gemini response contains changes compared to current `name` or `description`. If yes (and not in `--dry-run` mode):
  - Update `db.service` record `name` and `description`.
  - Log audit entry via `auditAdminAwaitable` with `action: "SERVICE_AUTO_FIX"`, `adminEmail: "system@smmplan.pro"`, and detailed diff in `oldValue`/`newValue`.
- Unit tests:
  - Mock Prisma Client DB updates.
  - Mock Redis cache lookups and setex.
  - Mock Gemini API calls.
  - Test happy path rewriter flow, dry-run simulation, and audit logging.
- Verification:
  - Run typecheck (`npx tsc --noEmit`) and linting (`npm run lint`).
  - Run the test suite (`npx vitest run test/unit/marketing-rewrite.test.ts`).

DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Please report your progress and write your completion handoff report to `d:\SMM_plan_2\.agents\worker_marketing_rewrite_1\handoff.md`.
