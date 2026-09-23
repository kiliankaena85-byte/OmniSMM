# Evidence for R6-11: Deprecated Test Runner Options & Utility Test Pattern Pollution

## 1. Defect Analysis
- **Defect ID**: R6-11
- **Priority**: Low / Hygiene & CI
- **Component**: `vitest.config.ts`, Test Runner Configuration
- **Claim**: Test configuration uses removed runner options (`forks: { singleFork: true }`), forcing `as any` type assertion, and utility test files / scripts match general test suites.

## 2. Root Cause
- In earlier versions of Vitest, `forks: { singleFork: true }` existed at the root of `test: {}`. In Vitest 3/4, root-level `forks` was deprecated and removed from `InlineConfig`, resulting in developers appending `} as any` to silence TypeScript errors.
- `include:` contained `'**/test_round_table.ts'` (a non-existent utility script) and did not explicitly exclude `scripts/**`, risking execution of one-off scripts during full suite test runs.

## 3. Resolution
In `vitest.config.ts`:
1. Removed deprecated `forks: { singleFork: true }` and `pool: 'forks'`. Configured standard `fileParallelism: false` and `maxWorkers: 1` directly supported by Vitest 4.
2. Removed `} as any` type cast, achieving 100% strict TypeScript conformance.
3. Excluded `scripts/**` from `exclude` array.
4. Cleaned `include` array to target only canonical test files: `'**/*.{test,spec}.?(c|m)[jt]s?(x)'`.

## 4. Verification Evidence
- `npx tsc --noEmit` -> 0 errors (clean compilation without `as any`).
- Vitest configuration loads cleanly in strict mode.
