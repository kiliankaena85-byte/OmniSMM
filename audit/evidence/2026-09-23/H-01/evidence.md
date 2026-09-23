# Evidence: [H-01] Reverse Tabnabbing Protection (rel="noopener noreferrer")

## 1. Problem Description
- **Vulnerability/Defect**: Multiple links (`<a>` and `<Link>`) across admin and client interfaces had `target="_blank"` without `rel="noopener noreferrer"`. This exposed users to Reverse Tabnabbing (OWASP A01 / CWE-1022), where the newly opened window or tab can access the original page via `window.opener` and redirect it to a malicious phishing page or execute attacks.
- **Severity**: Low/Medium (Reverse Tabnabbing & Information Exposure)
- **CWE**: CWE-1022 (Improper Restriction of Rendered UI Layers or Frames)

## 2. Reproduction Proof
- Test file: `src/__tests__/unit/noopener-noreferrer-audit.test.ts`
- Tests proved:
  - 22 instances of `target="_blank"` across 16 files previously lacked `rel="noopener noreferrer"`.
  - Static AST/regex verification now confirms 0 remaining unsecured `target="_blank"` tags across all `.tsx` and `.ts` files.

## 3. Remediation Details
- **`scripts/audit-target-blank.mjs`**:
  - Scanned and updated all 16 affected files to ensure every `target="_blank"` link explicitly includes `rel="noopener noreferrer"`.
- **`src/__tests__/unit/noopener-noreferrer-audit.test.ts`**:
  - Implemented continuous CI audit test scanning the entire `src/` directory to prevent regression.

## 4. Verification
- **Unit Test**: `npx vitest run src/__tests__/unit/noopener-noreferrer-audit.test.ts` (1/1 passed).
- **TypeScript**: `npx tsc --noEmit` (0 errors).
- **Secret Scan**: `node scripts/check-bundle-secrets.mjs` (0 leaks).
