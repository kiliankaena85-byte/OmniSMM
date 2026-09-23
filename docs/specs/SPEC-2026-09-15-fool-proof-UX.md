# SPEC-2026-09-15: Fool-Proof UX & Wizard Consolidation

## 1. Required UX for "Fool Tests" and Graceful Fallbacks (Fail-Closed)
- **Auto-Correction**: Users frequently input incorrect URL formats (e.g. without `https://`, extra spaces, missing username prefix). The system must apply `mutateLink` on blur/submit to auto-format.
- **Fail-Closed Validation**: Invalid links must hard-block submission with precise localized error messages using `getLinkValidator` instead of generic error throws.
- **State Recovery**: Accidental page reloads or tab closures must not lose the user's progress. Form state must persist in `sessionStorage` (e.g., `smmplan_draft`).
- **Graceful Fallbacks**: If the URL type cannot be determined or is incompatible with the selected service (`TargetType`), the UI must show a clear, friendly warning (`isLinkServiceCompatible`) and prevent checkout rather than letting the API fail.

## 2. Current Discrepancy
- **Landing Page (`useOrderEngine.ts`)**: Implements `mutateLink`, `getLinkValidator`, and stores drafts in `sessionStorage`. Validations happen eagerly.
- **Dashboard (`useSmmplanOrderWizard.ts`)**: Missing `mutateLink` and `getLinkValidator`. Does not persist drafts to `sessionStorage` (relies purely on URL query params). This makes the dashboard wizard significantly more fragile to "fool" inputs than the public landing page.

## 3. Architectural Solution
- **Consolidation**: The dashboard wizard (`useSmmplanOrderWizard.ts`) must be refactored to utilize the robust `useOrderEngine.ts` hook or extract a shared core hook (`useBaseOrderEngine.ts`). 
- **Universal Application**:
  - `mutateLink` and `getLinkValidator` must be uniformly applied on `handleBlurLink` and form validation.
  - Draft state must be synced to `sessionStorage` in the dashboard identically to the landing page.

## 4. Backend Resilience Measures Verified
- **SSRF Guard**: Input URLs must be parsed without blindly triggering internal network requests (e.g., preventing `localhost` or `169.254.x.x` fetches). 
- **Idempotency**: Submissions must send an `idempotencyKey` to prevent duplicate charges on double-clicks.
- **Transaction Safety**: Ledger operations must follow Ledger-First principles and strict PrismaTx boundaries (`concurrency-acid-guard`).
