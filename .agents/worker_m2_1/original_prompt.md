## 2026-06-07T19:37:45Z
You are the teamwork_preview_worker. Your working directory is d:\SMM_plan_2\.agents\worker_m2_1.
Your task is to fix the vacant assertions in the test suite and verify the initial test run:
1. In `test/unit/tc-fin-hedge.test.ts`, fill in the empty `expect().toBe()` stubs to assert the calculated values.
   - For TC-FIN-HEDGE-001, expected priceCents is 12000:
     `expect(priceCents).toBe(12000);`
   - For TC-FIN-HEDGE-002, expected priceCents is 12600:
     `expect(priceCents).toBe(12600);`
   - For TC-FIN-HEDGE-003, expected priceCents is 11621:
     `expect(priceCents).toBe(11621);`
2. Run the specific test using:
   `npx dotenv -e .env.test vitest run test/unit/tc-fin-hedge.test.ts`
3. Run the whole test suite using:
   `npm run test`
4. Run ESLint and Next build verification:
   `npm run lint`
   `npm run build`
5. Report the test and build results. Write your progress to progress.md and handoff details to handoff.md under your working directory, then send a message to the parent.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
