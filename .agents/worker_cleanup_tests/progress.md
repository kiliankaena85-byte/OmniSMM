# Progress - worker_cleanup_tests

Last visited: 2026-06-05T09:28:00+03:00

## Active Step
- Task complete: All cleanup tasks, ESLint hardening, test fixes, and production build verification completed successfully.

## Task Checklist
- [x] 1. ESLint Configuration Hardening:
  - [x] Edit `eslint.config.mjs` (remove `scripts/**` from ignores, remove `"no-undef": "warn"`, set `@typescript-eslint/no-unused-vars` and `@typescript-eslint/no-explicit-any` to `"error"`).
  - [x] Run `npm run lint` and resolve any remaining linting errors/warnings in the codebase.
- [x] 2. Knip Debt Cleanup:
  - [x] Uninstall `@heroui/theme` from `package.json`.
  - [x] Clean up unused exports identified by Knip (e.g., in `src/actions/admin/content.ts`, `src/actions/admin/providers/crud.ts`, etc.).
- [x] 3. Legacy CommonJS refactoring:
  - [x] Rewrite `scripts/safe-replace.js` to `scripts/safe-replace.ts` (ESM).
  - [x] Delete `scripts/safe-replace.js`.
- [x] 4. Fix Vitest Test Failures:
  - [x] Fix failing tests in `src/utils/balance-verifier.test.ts`.
  - [x] Add raw truncation of tables (`User`, `LedgerEntry`, `AdminAuditLog` etc.) in `beforeEach` hook.
- [x] 5. Verification:
  - [x] Run `npm run lint` (0 issues).
  - [x] Run `npm run test` (81 tests pass).
  - [x] Run `npm run build` (successful build).

