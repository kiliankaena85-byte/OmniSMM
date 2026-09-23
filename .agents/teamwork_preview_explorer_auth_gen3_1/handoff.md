# Handoff Report: Auth Iteration 2 Defects

## Summary
The investigation into the 5 defects from Auth Iteration 2 confirms type signature issues, a severe production backdoor, an email enumeration vulnerability, incomplete session invalidation, and a TOCTOU concurrency bug. Below is the detailed analysis and fix strategy.

## 1. Observation
- **TypeScript Signature:** In `src/actions/auth/request-magic-link.ts`, the `ALLOW_DEV_BYPASS_IN_PROD` block relies on Next.js' `redirect()` (which returns `never`). Because this is conditionally executed outside the `try/catch` block, TypeScript infers that `requestMagicLink` can return `undefined`. This causes `tests/magic-link.test.ts` (line 53: `expect(result.success).toBe(false)`) to fail with `error TS18048: 'result' is possibly 'undefined'`.
- **Integrity Violation:** `src/actions/auth/request-magic-link.ts` (lines 30-47) contains a backdoor block checking `process.env.ALLOW_DEV_BYPASS_IN_PROD === "true"` to bypass authentication and redirect to the admin panel.
- **Email Enumeration:** `src/actions/auth/request-magic-link.ts` applies `auth:register:ip` (3 per 24h) for non-existing users and `auth:login:ip` (15 per 1h) for existing users. An attacker can exhaust the strict register limit with dummy emails; subsequent requests will fail for non-existing emails but succeed for existing emails, allowing perfect enumeration.
- **Un-invalidated AuthTokens:** `scripts/set-admin-password.ts` (line 50) correctly executes `await prisma.session.deleteMany(...)` but misses `prisma.authToken.deleteMany(...)`, allowing old magic links to remain active after a password reset.
- **TOCTOU Bug:** `src/actions/auth/request-magic-link.ts` (lines 63-93) calls `db.user.findUnique` outside the `db.$transaction`. Two concurrent requests for a new email both see `user == null`, enter the block, and the second transaction crashes with a `P2002 Unique constraint failed` error during `user.create`.

## 2. Logic Chain
1. **TS Build & Backdoor:** Removing the `ALLOW_DEV_BYPASS_IN_PROD` backdoor block and its associated `shouldRedirectToAdmin` variable not only closes the security vulnerability but also naturally fixes the TypeScript error. The function will strictly return `{ success: boolean, error: string | null }` at all execution paths.
2. **Email Enumeration Fix:** The differential IP rate limit checks must be replaced with a single, unified `auth:magic-link:ip` limit (e.g., 15 per hour) evaluated *before* checking the database for the user's existence. This provides uniform behavior preventing side-channel leakage.
3. **Session Invalidation:** To secure the password override script, we must explicitly delete all outstanding `AuthToken`s for the user in `scripts/set-admin-password.ts` alongside `Session` deletions.
4. **Concurrency Fix:** The TOCTOU bug is fixed by moving the initial `db.user.findUnique` check inside the existing `db.$transaction(..., { isolationLevel: 'Serializable' })`. If the user does not exist, they are created atomically within the same transaction.

## 3. Caveats
- Using a unified rate limit for magic links means we cannot enforce an ultra-strict IP limit exclusively for new registrations via this endpoint. If stricter anti-fraud for registrations is required, it must be implemented via captchas or separate endpoints, not differential limits.
- The `user.delete` fallback if SMTP fails for a new user will remain outside the transaction. This is correct behavior, as SMTP sending cannot safely occur inside a database transaction.

## 4. Conclusion
The implementation plan for the subsequent agent is strictly defined:
- **`src/actions/auth/request-magic-link.ts`:**
  - Remove lines 26-47 (the `ALLOW_DEV_BYPASS_IN_PROD` block and `shouldRedirectToAdmin`).
  - Unify the IP rate limit check *before* the transaction.
  - Move `db.user.findUnique` inside the `db.$transaction`.
  - Ensure the function returns the standard `{ success, error }` object directly.
- **`scripts/set-admin-password.ts`:**
  - Add `await prisma.authToken.deleteMany({ where: { userId: user.id } });` after the session deletion.

## 5. Verification Method
1. Run `npx tsc --noEmit` and `npm run test tests/magic-link.test.ts` to verify the type signature fix.
2. Search for `ALLOW_DEV_BYPASS_IN_PROD` across the project using `grep` to ensure the backdoor is fully removed.
3. Send requests exceeding the IP rate limit and verify that the endpoint returns the exact same error for both existing and non-existing emails.
4. Generate a magic link for a user, run `npx tsx scripts/set-admin-password.ts`, and query the database to ensure the `AuthToken`s for that user were deleted.
5. Send 10 concurrent POST requests to the magic link endpoint with a new email to verify no `P2002` constraint errors are thrown.
