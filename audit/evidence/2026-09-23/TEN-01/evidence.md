# Evidence: [TEN-01] SupportFinancialAction Tenant Scoping & Enforcer Registration

## 1. Problem Description
- **Vulnerability**: `SupportFinancialAction` contains a `tenantId` column in PostgreSQL, but was omitted from `TENANT_SCOPED_MODELS` in `src/lib/prisma-tenant-enforcer.ts`. Additionally, actions in `src/actions/admin/support-review.ts` (`getSupportActionsReviewListAction`, `exportSupportActionsCSVAction`, and `reviewSupportFinancialAction`) queried records across all tenants without scoping by active tenant.
- **Severity**: High (Cross-Tenant Data Exposure & Audit Pollution)
- **CWE**: CWE-284 (Improper Access Control), CWE-639 (Insecure Direct Object Reference)

## 2. Reproduction Proof
- Test file: `src/__tests__/unit/support-financial-action-tenant-scope.test.ts`
- Tests proved:
  1. `TENANT_SCOPED_MODELS` initially did not register `supportFinancialAction`, allowing unscoped queries through Prisma.
  2. `getSupportActionsReviewListAction` returned financial actions across all brands without checking `where.tenantId`.
  3. `reviewSupportFinancialAction` allowed a support staff member assigned to one brand to review and approve compensation records created on another brand.

## 3. Remediation Details
- **`src/lib/prisma-tenant-enforcer.ts`**:
  - Registered `'supportFinancialAction'` in `TENANT_SCOPED_MODELS`. All Prisma queries automatically inject `where.tenantId = activeTenantId` and block cross-tenant queries.
- **`src/actions/admin/support-review.ts`**:
  - Injected `where.tenantId = activeTenantId` in `getSupportActionsReviewListAction` and `exportSupportActionsCSVAction`.
  - Added strict tenant validation in `reviewSupportFinancialAction` rejecting reviews if `admin.role !== 'OWNER' && action.tenantId !== adminTenant`.
- **`src/actions/support/compensation.ts`** and **`src/actions/admin/users.ts`**:
  - Explicitly passed `tenantId` during `supportFinancialAction.create` calls.

## 4. Verification
- **Unit Test**: `npx vitest run src/__tests__/unit/support-financial-action-tenant-scope.test.ts` (6/6 passed).
- **TypeScript**: `npx tsc --noEmit` (0 errors).
- **Secret Scan**: `node scripts/check-bundle-secrets.mjs` (0 leaks).
