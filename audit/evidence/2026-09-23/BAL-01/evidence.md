# Evidence: [BAL-01][BAL-02][BAL-03] Financial ExactMath BigInt, Ledger Immutability & Audit Atomicity

## 1. Problem Description
- **Vulnerabilities/Defects**:
  1. **BAL-01**: In `src/actions/support/compensation.ts` and `src/workers/processors/payment-sync.ts`, monetary amounts were calculated using JavaScript floating-point arithmetic (`Math.round(parseFloat(val) * 100)`) and explicitly downcast from `BigInt` to `Number(costCents)` when invoking `WalletOps`. This caused floating-point rounding errors and precision degradation on large balances.
  2. **BAL-02**: PostgreSQL triggers (`trg_prevent_ledger_mutation`) protect the ledger from modification and deletion by throwing error code `P0001`. The application lacked an explicit `ImmutableLedgerError` representation and an actionable user error mapping, causing unhandled 500 errors if ledger tampering was attempted.
  3. **BAL-03**: In `src/services/admin/user.service.ts`, administrative balance modifications performed `auditAdmin()` asynchronously outside the transaction, risking split ledger states where balance was credited but audit logs failed silently.
- **Severity**: High (Financial Precision, Ledger Immutability & Audit Integrity)
- **CWE**: CWE-682 (Incorrect Calculation) / CWE-778 (Insufficient Logging)

## 2. Reproduction Proof
- Test file: `src/__tests__/unit/wallet-ops-acid-invariants.test.ts`
- Tests proved:
  1. Vanilla JavaScript `19.99 * 100 !== 1999` due to IEEE-754 floating-point drift. `ExactMath.rublesToKopecks` converts floats and decimal strings to exact `1999n` BigInt kopecks without drift.
  2. `ImmutableLedgerError` formats immutable ledger violations and is mapped by `actionable-error.ts` to `ERR_FINANCIAL_LEDGER_IMMUTABLE`.
  3. Database trigger P0001 ledger exceptions are cleanly parsed as `ERR_FINANCIAL_LEDGER_IMMUTABLE`.

## 3. Remediation Details
- **`src/actions/support/compensation.ts`**:
  - Replaced floating-point multiplication with `ExactMath.rublesToKopecks(costRub)`.
  - Eliminated `Number(costCents)` downcasting; passed `BigInt` directly to `WalletOps.credit` and `WalletOps.charge`.
- **`src/workers/processors/payment-sync.ts`**:
  - Replaced `parseFloat(data.amount.value) * 100` with `ExactMath.rublesToKopecks(data.amount.value)` returning BigInt kopecks directly to `paymentService.confirmPayment`.
- **`src/services/admin/user.service.ts`**:
  - Moved `auditAdminAwaitable` INSIDE `db.$transaction` using transactional client `tx`.
  - Calculated new balance using native BigInt: `oldBalance + BigInt(amountCents)`.
- **`src/services/financial/wallet-ops.ts`**:
  - Exported `ImmutableLedgerError` with code `IMMUTABLE_LEDGER_VIOLATION`.
- **`src/lib/errors/actionable-error.ts`**:
  - Added detection and user-facing mapping for `ERR_FINANCIAL_LEDGER_IMMUTABLE`.

## 4. Verification
- **Unit Test**: `npx vitest run src/__tests__/unit/wallet-ops-acid-invariants.test.ts` (6/6 passed).
- **TypeScript**: `npx tsc --noEmit` (0 errors).
- **Secret Scan**: `node scripts/check-bundle-secrets.mjs` (0 leaks).
