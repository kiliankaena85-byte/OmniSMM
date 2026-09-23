# Handoff Report: Gen2 Auth Fallback Fixes Review

## 1. Observation
I reviewed the Gen2 Auth Fallback fixes in `src/actions/auth/request-magic-link.ts` and `scripts/set-admin-password.ts`. The following was observed:
- **Information Disclosure**: In `request-magic-link.ts`, new user creation invokes `RateLimitService.check('auth:register:ip', 3, 86400)` (Max 3 per 24 hours). However, existing users bypass this and hit `RateLimitService.check('auth:login:ip', 15, 3600)` (Max 15 per hour).
- **Session Invalidation**: In `scripts/set-admin-password.ts`, the script calls `prisma.session.deleteMany({ where: { userId: user.id } })`, but fails to invalidate `AuthToken` records.
- **TOCTOU Race Condition**: In `request-magic-link.ts`, the check `let user = await db.user.findUnique(...)` is executed before the `Serializable` transaction begins. If the user doesn't exist, the transaction creates the user. The `[SAFE BYPASS]` block has a similar unprotected TOCTOU flaw (findUnique then create without a transaction).
- **Zombie User / Orphaned Email**: The SMTP error-handling block deletes the newly created user if `sendMagicLink` fails. However, if `db.authToken.create` fails (before SMTP), the outer `catch` block catches the error, entirely bypassing the SMTP error handler. The user is created but never receives an email and is never deleted, leaving a Zombie User/Orphaned Email state.

## 2. Logic Chain
- **Information Disclosure**: Due to the differential rate limits, an attacker can exhaust the 3/24hr `auth:register:ip` limit by submitting 3 random nonexistent emails. Any subsequent nonexistent email returns `"Превышен лимит регистраций с вашего IP. Попробуйте завтра."`. If an existing email is submitted, the code skips the register limit and evaluates the login limit (15/hr). If it passes, the action succeeds. This allows an attacker to enumerate which emails exist in the system (FAIL).
- **Session Invalidation**: The `AuthToken` records act as active authentication vectors for up to 15 minutes. When `set-admin-password.ts` is executed to lock down an account, the failure to delete these tokens means the attacker can still use the magic link they generated prior to the password reset to re-authenticate (FAIL).
- **TOCTOU Race Condition**: Because the `findUnique` check happens outside the `Serializable` transaction, concurrent requests for the same nonexistent email will both pass the check. The second transaction will fail with a database unique constraint violation (`P2002`) instead of being handled gracefully (FAIL).
- **Zombie User / Orphaned Email**: A database error during `authToken` creation causes the process to jump to the top-level catch block. Because the user record has already been committed in the prior transaction block, and the rollback only occurs if `sendMagicLink` throws an error, the user remains permanently orphaned (FAIL).

## 3. Caveats
- The `[SAFE BYPASS]` TOCTOU flaw is guarded by environmental checks, so it is less likely to be exploited in production, but the underlying concurrency issue remains.
- The Zombie User defect assumes the `db.authToken.create` step could fail (e.g., due to DB unavailability, schema mismatch, or transaction timeouts). If it does, the rollback logic is completely bypassed.

## 4. Conclusion
**FAIL (REQUEST_CHANGES)**. 

The Gen2 fixes fail to resolve the security vulnerabilities:
1. **Critical Information Disclosure**: Differential rate limits allow trivial enumeration of existing emails.
2. **Incomplete Session Invalidation**: Magic link tokens (`AuthToken`) are not invalidated when an admin password is reset via the CLI script.
3. **Improper TOCTOU Mitigation**: The `findUnique` check remains outside the `Serializable` transaction, leading to uncaught constraint errors.
4. **Zombie User / Error Bypass**: Exceptions thrown by `db.authToken.create` bypass the user deletion logic, stranding user records.

## 5. Verification Method
1. Run `npx tsx scripts/test-auth-gen2-flaws.ts`. The script will output `VULNERABILITY CONFIRMED` for both Information Disclosure and the Zombie User bypass.
2. Inspect `scripts/set-admin-password.ts` and confirm the absence of `prisma.authToken.deleteMany`.
3. Inspect `request-magic-link.ts` and confirm the `findUnique` call is outside the `db.$transaction`.
