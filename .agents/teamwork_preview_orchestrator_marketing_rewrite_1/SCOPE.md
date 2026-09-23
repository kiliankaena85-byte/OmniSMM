# Scope: Marketing Description Rewriter

## Architecture
- **Console Script**: `scripts/marketing-description-rewriter.ts` - Runs via `npx tsx`. Connects to PostgreSQL via Prisma Client (`db` from `@/lib/db`) and Redis via ioredis (`redis` from `@/lib/redis`).
- **Gemini API Integration**: Uses standard REST `fetch` with `x-goog-api-key` header to query the `gemini-3-flash` or `gemini-3-flash-preview` models, returning a JSON structure containing marketing-optimized `name` and `description`.
- **Admin Audit Logs**: Critical database changes are logged using `auditAdminAwaitable` from `@/lib/admin-audit` with `action: "SERVICE_AUTO_FIX"`.
- **Testing**: Vitest unit tests in `test/unit/marketing-rewrite.test.ts`.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| 1 | M1: Script Structure & Selection | Define script skeleton, support `--dry-run` flag, query database for active services, and set up Redis/provider retrieval. | None | DONE (Implemented in scripts/marketing-description-rewriter.ts) |
| 2 | M2: Gemini Integration | Implement the Gemini API caller function using `gemini-3-flash` or `gemini-3-flash-preview` with structured prompting (JSON output format). | M1 | DONE (Implemented via REST fetch) |
| 3 | M3: Update & Audit Log | Apply DB updates for modified services and record `AdminAuditLog` entries with a detailed diff. | M2 | DONE (Implemented with auditAdminAwaitable) |
| 4 | M4: Unit Tests | Implement unit tests covering various scenarios (e.g. happy path, Gemini failure, Redis cache vs API fallback). | M3 | DONE (Implemented in test/unit/marketing-rewrite.test.ts) |
| 5 | M5: Verification | Run TypeScript type checks, ESLint linting, and execute the Vitest test suite. | M4 | DONE (Verified by reviewer_1 and auditor_1; type check, lint, tests, and build pass) |

## Interface Contracts
### scripts/marketing-description-rewriter.ts ↔ database
- Selects `db.service.findMany({ where: { isActive: true, externalId: { not: null } } })`.
- Updates `db.service.update` with new `name` and `description`.
- Logs using `auditAdminAwaitable` with `action: "SERVICE_AUTO_FIX"`, `adminEmail: "system@smmplan.pro"`, `oldValue`, and `newValue`.

### scripts/marketing-description-rewriter.ts ↔ Redis
- Key: `provider:${providerId}:catalog`. Retrieves cached provider catalog and finds service specs by `externalId`.
