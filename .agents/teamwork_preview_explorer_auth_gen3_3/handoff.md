# Handoff Report: Authentication Fixes Iteration 3

## 1. Observation
- **Defect 1 & 2 (TypeScript Build & Backdoor):** `src/actions/auth/request-magic-link.ts` contains a `[SAFE BYPASS]` block (lines 29-47) using `ALLOW_DEV_BYPASS_IN_PROD` to create a session and redirect bypassing auth. The dynamic `await import("next/navigation")` and `redirect()` at the end of the file cause TypeScript to infer a return type that includes `undefined` or `void`, breaking `result.success` checks in `tests/magic-link.test.ts` (which expects a strict `Promise<{success: boolean, error: string | null}>`).
- **Defect 3 (Information Disclosure):** `request-magic-link.ts` applies an IP rate limit of `3 per 24h` for new users (lines 70-75) and a separate IP rate limit of `15 per 1h` for existing users (lines 95-101). 
- **Defect 4 (Un-invalidated AuthTokens):** `scripts/set-admin-password.ts` successfully clears active sessions (`prisma.session.deleteMany` at line 50) but completely ignores `AuthToken` entries, leaving previously emailed magic links fully functional.
- **Defect 5 (Non-atomic authToken/user creation & TOCTOU):** In `request-magic-link.ts`, the existence check `let user = await db.user.findUnique({ where: { email: cleanEmail } });` (line 63) runs outside the `db.$transaction` that later creates the user (line 89).

## 2. Logic Chain
- **Defect 1 & 2:** The presence of `ALLOW_DEV_BYPASS_IN_PROD` is a severe security violation that allows unauthorized admin access in production. By removing this backdoor block entirely (including `shouldRedirectToAdmin`), the `requestMagicLink` function will naturally return `{ success: true, error: null }` unconditionally on success. This implicitly resolves the TypeScript signature issue because all code paths will return the expected object shape.
- **Defect 3:** Because the system throws different rate limit errors (and at different thresholds) depending on whether the email exists in the database, an attacker can exhaust the 3/24h limit with random requests and then easily enumerate existing emails by observing which requests succeed or throw the "15/1h" error. A unified IP rate limit evaluated *before* looking up the user removes this differentiation.
- **Defect 4:** When an admin resets their password, all previous authentication channels must be revoked. Leaving magic links active defeats the purpose of the password reset.
- **Defect 5:** The TOCTOU (Time-of-Check to Time-of-Use) gap means concurrent requests for the same new email will both evaluate `!user` to true. Both will attempt to create the user, and the slower one will fail with a Prisma `P2002` (Unique constraint) error, causing a 500 server error instead of a graceful flow. Wrapping the `findUnique` check inside the existing `Serializable` transaction guarantees atomicity.

## 3. Caveats
- Consolidating the registration and login rate limits means we lose the ultra-strict 3/24h registration limit. The unified limit (e.g., 15/1h) must balance abuse prevention with usability.
- Moving `findUnique` inside a `Serializable` transaction may cause Postgres to occasionally throw a serialization failure (`P2034`) under extreme concurrent load for the exact same email. This is standard database behavior and is vastly preferable to a corrupted state or a `P2002` error.

## 4. Conclusion
The implementation plan to fix these defects is:

1. **Remove Backdoor & Fix TS:** In `src/actions/auth/request-magic-link.ts`, completely delete the `shouldRedirectToAdmin` variable, the `ALLOW_DEV_BYPASS_IN_PROD` block (lines 29-47), the `if (!shouldRedirectToAdmin)` wrappers, and the `redirect("/admin/dashboard")` code block at the end (lines 143-146).
2. **Fix Email Enumeration:** In `request-magic-link.ts`, delete the separate `auth:register:ip` and `auth:login:ip` blocks. Replace them with a single `RateLimitService.check('auth:magic_link:ip', 15, 3600)` check placed at the very beginning of the logic, *before* the `db.user.findUnique` call.
3. **Fix TOCTOU (P2002):** In `request-magic-link.ts`, move the `db.user.findUnique` query and the `referredById` logic inside the `db.$transaction` block. Return the existing user immediately if found, otherwise perform the count and create logic within the transaction.
4. **Fix AuthToken Invalidation:** In `scripts/set-admin-password.ts`, add `await prisma.authToken.deleteMany({ where: { userId: user.id } });` immediately after the `session.deleteMany` call.

## 5. Verification Method
- **TypeScript:** Run `npx tsc --noEmit` to verify the `tests/magic-link.test.ts` failure is resolved.
- **Unit Tests:** Run `npx vitest run tests/magic-link.test.ts` to ensure core logic holds.
- **Security Audit:** Run `grep -r "ALLOW_DEV_BYPASS_IN_PROD" src/` to confirm the backdoor is fully eradicated.
- **Integrity Test:** Attempt concurrent magic link requests for a new email to ensure no `P2002` errors are thrown.
