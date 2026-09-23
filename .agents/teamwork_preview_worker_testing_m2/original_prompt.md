## 2026-06-07T19:34:42Z

You are a Teamwork Worker. Your task is to implement Milestone 2 (R1: SMM Provider & Currency Integration Tests):
1. Database & Articles Import Setup:
   - Ensure the database is migrated and Prisma Client is generated (run migrations/generate as needed).
   - Execute the knowledge base import script: `npx tsx scripts/import-articles-to-db.ts`.
   - Verify that the articles from `src/data/knowledge` are successfully imported to the `Article` table in PostgreSQL.
2. Fix Empty Stubs:
   - Locate `test/unit/tc-fin-hedge.test.ts` and fix any empty `expect().toBe()` stubs to ensure all tests execute properly and assert valid logic.
3. Implement CBR Rates Integration Tests:
   - Create a new integration test file at `test/integration/cbr-rate-sync.test.ts`.
   - Write tests for `CBRRateService` (from `src/services/system/cbr-rate.service.ts`) to verify that it connects over the real internet (make sure to call `vi.unstubAllGlobals()` so fetch is not mocked), retrieves CBR USD/RUB exchange rates daily, correctly parses the xml/json data, and updates `exchangeRateUSD` in SystemSettings in the database.
4. Supplement SMM Provider Integration Tests:
   - Update `test/unit/provider-universal.test.ts` (or create a new test) to verify connection to live SMM provider APIs over the real internet (unstub fetch).
   - Ensure you verify both balance fetching and service catalog parsing.
5. Verification:
   - Run Vitest to verify all new/updated tests pass: `npx vitest run test/integration/cbr-rate-sync.test.ts test/unit/provider-universal.test.ts test/unit/tc-fin-hedge.test.ts`.
   - Run full build and lint checks (`npm run lint` and `npm run build`) to ensure the codebase remains clean.
6. Handoff:
   - Document your changes, files modified/created, test execution results, and build success in `d:\SMM_plan_2\.agents\teamwork_preview_worker_testing_m2\handoff.md`.
   - Send a message to the parent orchestrator when done.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your working directory for agent metadata is: `d:\SMM_plan_2\.agents\teamwork_preview_worker_testing_m2`
