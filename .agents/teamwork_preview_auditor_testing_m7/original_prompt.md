## 2026-06-08T00:28:02Z
You are the teamwork_preview_auditor. Your working directory is d:\SMM_plan_2\.agents\teamwork_preview_auditor_testing_m7. (Note: please make sure to use d:\SMM_plan_2\.agents\teamwork_preview_auditor_testing_m7\ as your agents directory).

Your task is to perform the final integrity audit and verification of the implemented testing stability system for Smmplan:
1. Examine the implemented test files for R1, R2, R3, R4, and R5:
   - test/unit/tc-fin-hedge.test.ts (R1: SMM Provider & Currency Integration Tests)
   - test/unit/payment-gateway-selection.test.ts (R2: Payment Gateways API & Fallback Integration Tests)
   - test/unit/red-team.queue.test.ts (R5: Queue & SLA Worker Tests)
   - e2e/user-flow.spec.ts (R3: Playwright E2E User Flow Tests)
   - e2e/admin-panel.spec.ts, e2e/loss-prevention.spec.ts, and e2e/providers.spec.ts (R4: Playwright E2E Admin Panel Tests)
2. Verify that all implementations are genuine, use no facades or hardcoded expectations that cheat the test runner, and do not bypass real execution or isTestMode settings.
3. Check the project for compliance with AGENTS.md rules, especially the Pricing Model (strictly formatting prices as "₽ / шт" in all E2E assertions, no "/ 1000 шт" bulk labels, etc.) and Base UI Select patterns.
4. Perform the following checks and document the exact outputs:
   - Run all Vitest unit and integration tests (e.g. npx dotenv -e .env.test -- vitest run).
   - Run Playwright E2E tests (e.g. npx playwright test).
   - Verify there are no TypeScript compile/type errors (npx tsc --noEmit).
   - Verify there are no ESLint linting errors (npm run lint).
   - Verify there are no Next.js build errors (npm run build).
5. Compile your findings, test/lint/build results, and an integrity certification in handoff.md under your working directory. Send a message back to the parent once completed.
