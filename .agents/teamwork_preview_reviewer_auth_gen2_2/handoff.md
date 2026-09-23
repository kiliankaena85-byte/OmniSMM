# Handoff Report: Gen2 Auth Fallback Fixes Review

## 1. Observation
I reviewed `src/actions/auth/request-magic-link.ts` and `scripts/set-admin-password.ts`. The following was observed:
- **Information Disclosure**: In `request-magic-link.ts`, new user creation invokes `RateLimitService.check('auth:register:ip', 3, 86400)` (3 per 24 hours). Existing users bypass this and hit `RateLimitService.check('auth:login:ip', 15, 3600)` (15 per 1 hour).
- **Session Invalidation**: In `scripts/set-admin-password.ts`, `prisma.session.deleteMany` is called, but there is no call to invalidate existing `AuthToken` records.
- **TOCTOU Race Condition**: In `request-magic-link.ts`, `let user = await db.user.findUnique(...)` is executed outside the `Serializable` transaction. If the user doesn't exist, the transaction runs. Furthermore, the `SAFE BYPASS` code for dev bypass performs a `.findUnique()` followed by a `.create()` with no transaction or concurrency protection.
- **Zombie User / Orphaned Email**: If SMTP fails, the catch block calls `await db.user.delete({ where: { id: user.id } })`. 

## 2. Logic Chain
- **Information Disclosure**: Because the rate limits for login and registration use different keys (`auth:login:ip` vs `auth:register:ip`) and limits, an attacker can intentionally exhaust the `auth:register:ip` limit (by submitting 3 fake emails). Once exhausted, any request for an unregistered email returns an error (`"Превышен лимит регистраций..."`). However, if the attacker inputs an *existing* email, the system skips the register limit and evaluates the `login` limit, returning a success message. This is a severe Information Disclosure flaw, allowing perfect enumeration of registered users.
- **Session Invalidation**: If an attacker requested a magic link, the token remains valid for 15 minutes. When the `set-admin-password.ts` script is run to lock them out, it deletes active sessions but leaves the unexpired `AuthToken`s intact. The attacker can simply click the magic link in their email *after* the admin changed the password, bypassing the lockout entirely.
- **TOCTOU Race Condition**: Because the `if (!user)` check is outside the transaction, concurrent requests for the same unregistered email will both pass the check. The second one will fail with a `P2002` Unique Constraint violation on `email`, returning a generic 500 error to the user rather than gracefully treating it as a login request. The `SAFE BYPASS` block has the exact same unprotected TOCTOU flaw.
- **Zombie User / Orphaned Email**: The SMTP error-handling correctly deletes the user to prevent orphaned states. However, this relies on the Node process not crashing between user creation and the catch block. 

## 3. Caveats
- The `SAFE BYPASS` TOCTOU flaw is explicitly marked as "Только для локальной разработки!", so it may be deemed acceptable risk for dev environments. However, the other issues apply directly to production paths.
- The Zombie User defect assumes that the process doesn't crash before the `catch` block executes. A more robust implementation would use a saga or ensure the token and user creation are tightly coupled to the email dispatch.

## 4. Conclusion
**FAIL (REQUEST_CHANGES)**. 
The Gen2 fixes fail to resolve the core security vulnerabilities:
1. **Critical Information Disclosure**: Differential rate limiting allows trivial enumeration of registered emails.
2. **Incomplete Session Invalidation**: Magic Link tokens (`AuthToken`) are not invalidated when an admin's password is forcibly reset via the CLI fallback script.
3. **Improper TOCTOU Mitigation**: The `findUnique` check remains outside the `Serializable` transaction, leading to uncaught `P2002` unique constraint errors on concurrent requests instead of graceful handling.

## 5. Verification Method
- **Information Disclosure**: Send 4 requests to `/api/magic-link` with different nonexistent emails from the same IP. The 4th will fail with "Превышен лимит регистраций". Then send a 5th request with a known existing email (e.g., an admin email). It will succeed, proving the existence of the email.
- **Session Invalidation**: Inspect `scripts/set-admin-password.ts`. Note the absence of `await prisma.authToken.deleteMany({ where: { userId: user.id } });`.
- **TOCTOU**: Inspect `src/actions/auth/request-magic-link.ts` lines 63-93. Observe that `db.user.findUnique` is executed before the transaction begins.
