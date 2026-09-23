# Evidence for H-02: Parameterize Raw SQL in Scripts & Utilities

## 1. Defect Analysis
- **Defect ID**: H-02
- **Priority**: Low / Hygiene
- **Component**: Scripts (`scripts/fix-import.ts`, `scripts/db-testing/db-chaos-runner.ts`, `scripts/generate-evidence-report.ts`, `scripts/real-db-pentest.ts`, `prisma/seed-data/vexboost-services.ts`)
- **Vulnerability**: `$executeRawUnsafe` calls with template literal interpolation (`${...}`) vulnerable to SQL injection if variables ever contain malicious characters.

## 2. Root Cause
Several developer and seeding scripts constructed dynamic queries by concatenating string variables into `$executeRawUnsafe(...)` instead of passing parameterized placeholders (`$1`, `$2`, ...) and arguments.

## 3. Resolution
All instances of variable interpolation in `$executeRawUnsafe` have been replaced with parameterized queries:
1. `scripts/fix-import.ts`: `SELECT setval(pg_get_serial_sequence('"Service"', 'numericId'), $1, false)` with parameter `nextVal`.
2. `scripts/db-testing/db-chaos-runner.ts`: Parameterized `WHERE id = $1` for `LedgerEntry` update/delete, and `UPDATE "User" SET balance = -999 WHERE id = $1`.
3. `scripts/generate-evidence-report.ts`: Parameterized `DELETE FROM "LedgerEntry" WHERE id = $1`.
4. `scripts/real-db-pentest.ts`: Parameterized `DELETE FROM "LedgerEntry" WHERE id = $1`.
5. `prisma/seed-data/vexboost-services.ts`: Replaced raw query string concatenation with `VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`.

## 4. Verification Evidence
- **Automated AST & Pattern Guard**: `src/__tests__/unit/raw-sql-parameterization.test.ts`
- **Vitest Output**:
```
 ✓ src/__tests__/unit/raw-sql-parameterization.test.ts (7 tests) 11ms
 Test Files  1 passed (1)
      Tests  7 passed (7)
```
- **Typecheck**: `npx tsc --noEmit` -> 0 errors.
