## 2026-06-05T06:02:12Z
You are `worker_cleanup_tests` (role: Codebase Cleanup Worker). Your working directory is d:\SMM_plan_2\.agents\worker_cleanup_tests.
You are tasked with resolving codebase cleanup issues and test failures based on the initial audit findings.

Please execute the following tasks:
1. ESLint Configuration Hardening:
   - Edit eslint.config.mjs to remove `scripts/**` from `ignores`.
   - Remove the `"no-undef": "warn"` rule from rules. (In TypeScript, undef checks are natively handled by tsc, and enabling this rule in flat config causes false-positive errors on standard symbols like console, vi, and FormData).
   - Change custom rules like `"@typescript-eslint/no-unused-vars": "warn"` and `"@typescript-eslint/no-explicit-any": "warn"` to `"error"`.
   - Run `npm run lint` and resolve any remaining linting errors or warnings in the codebase.
2. Knip Debt Cleanup:
   - Uninstall/remove the unused dependency `@heroui/theme` from package.json.
   - Clean up the unused exports identified by Knip (e.g. deleteContent in src/actions/admin/content.ts, deleteProvider in src/actions/admin/providers/crud.ts, etc.) by removing the `export` keyword if they are only used internally, or deleting them if they are completely unused.
3. Legacy CommonJS refactoring:
   - Rewrite `scripts/safe-replace.js` to a TypeScript ES Module at `scripts/safe-replace.ts`, using ESM imports/exports. Delete the old `.js` file afterwards.
4. Fix Vitest Test Failures:
   - Fix the failing tests in `src/utils/balance-verifier.test.ts`. Update its local `beforeEach` hook to perform a complete truncation of the tables it affects (`User`, `LedgerEntry`, `AdminAuditLog` etc.) using prisma `$executeRawUnsafe` or `$queryRaw` to guarantee test isolation from leftover data of other tests.
5. Verification:
   - Run `npm run lint` to confirm 0 errors/warnings.
   - Run `npm run test` to confirm all 81 tests pass.
   - Run `npm run build` to verify the build succeeds.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Save your results and command outputs in a report at `d:\SMM_plan_2\.agents\worker_cleanup_tests\handoff.md` following the Handoff Protocol. Message me with the path and a brief summary when you are done.

## 2026-06-05T06:12:40Z
в чем заключаются ошибки? И почему их не было раньше на локальной машине?
