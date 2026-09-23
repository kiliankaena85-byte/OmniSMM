# Evidence: [TEN-02][TEN-03] Cross-Tenant Protection in Balance Adjustments

## 1. Problem Description
- **TEN-02**: The `ManualBalanceAdjustment` model does not have a direct `tenantId` column (it links via `User.id`). When staff members created balance adjustment requests in `src/actions/admin/balance-adjustments.ts` (`createBalanceAdjustmentRequestAction`) or direct balance adjustments in `src/actions/admin/users.ts` (`updateBalanceAction`), there was no check verifying that the operator and the target customer belong to the same tenant.
- **TEN-03**: Defaulting to `'smmplan'` via `@default("smmplan")` in Prisma schema caused unscoped `create()` calls to silently attach to `smmplan` even when triggered in an `smmflux` context.
- **Severity**: High (Cross-Tenant Account Tampering & Financial Ledger Contamination)
- **CWE**: CWE-284 (Improper Access Control), CWE-285 (Improper Authorization)

## 2. Reproduction Proof
- Test file: `src/__tests__/unit/support-financial-action-tenant-scope.test.ts`
- Tests proved:
  1. `createBalanceAdjustmentRequestAction` previously permitted staff members on `smmplan` to create balance requests for `flux` clients.
  2. `updateBalanceAction` previously allowed non-OWNER staff on `smmplan` to alter balances of `flux` clients without encountering authorization guards.

## 3. Remediation Details
- **`src/actions/admin/balance-adjustments.ts`**:
  - Selected `tenantId: true` on `targetUser` in `createBalanceAdjustmentRequestAction`.
  - Added fail-closed cross-tenant guard:
    `if (staffUser.role !== 'OWNER' && operatorTenantId !== targetUserTenantId) { return { success: false, error: ... }; }`
- **`src/actions/admin/users.ts`**:
  - Selected `tenantId: true` on `targetUser` in `updateBalanceAction`.
  - Added fail-closed cross-tenant guard:
    `if (admin.role !== 'OWNER' && adminTenant !== targetTenant) { return { success: false, error: ... }; }`
  - Explicitly passed `tenantId: targetUser.tenantId || admin.tenantId || 'smmplan'` to `db.supportFinancialAction.create`.
- **`src/actions/support/compensation.ts`**:
  - Explicitly passed `tenantId: ticket.tenantId || user.tenantId || 'smmplan'` in compensation creations.

## 4. Verification
- **Unit Test**: `npx vitest run src/__tests__/unit/support-financial-action-tenant-scope.test.ts` (6/6 passed).
- **TypeScript**: `npx tsc --noEmit` (0 errors).
- **Secret Scan**: `node scripts/check-bundle-secrets.mjs` (0 leaks).
