## 2026-06-11T11:47:42Z
You are a read-only exploration agent. Your task is to investigate the Smmplan codebase to gather the necessary context for implementing:
1. A console TS script `scripts/marketing-description-rewriter.ts` that:
   - Selects all active services with `externalId` from the database.
   - Fetches provider specifications (from Redis cache `provider:{id}:catalog` or via provider API).
   - Rewrites name/description using Gemini model `gemini-3-flash` or `gemini-3-flash-preview` based on requirements.
   - Updates `Service` name/description in DB and logs a `SERVICE_AUTO_FIX` entry in `AdminAuditLog`.
2. Unit tests in `test/unit/marketing-rewrite.test.ts`.

Specifically, find out:
1. The exact structure/fields of the `Service` and `AdminAuditLog` models in `prisma/schema.prisma`.
2. How Redis is initialized and how caching/fetching `provider:{id}:catalog` works. Where are the Redis files/utilities?
3. Where and how Gemini API is used or configured in the codebase (e.g. model configuration, API calls). Is there a service/wrapper?
4. How SMM provider APIs are called in the codebase (for the fallback request).
5. Where tests are located and how they mock Prisma, Redis, or Gemini. Are there test setups we should follow?

Write your findings to `d:\SMM_plan_2\.agents\teamwork_preview_orchestrator_marketing_rewrite_1\explorer_handoff.md`. Only perform read-only actions, do not modify any files.

## 2026-06-11T11:50:28Z
Hello Orchestrator, please report your current status, recent plan, and next steps for implementing the marketing description rewriter script and unit tests.
