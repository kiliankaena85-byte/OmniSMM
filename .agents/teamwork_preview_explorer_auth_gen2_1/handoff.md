# Handoff Report

## 1. Observation
- **Defect 1 (Information Disclosure)**: In `src/actions/auth/request-magic-link.ts` lines 136-139, the global `catch (error)` block returns the raw error message to the client: `return { error: (error as Error).message, success: false };`.
- **Defect 2 (Zombie User Defect)**: In `src/actions/auth/request-magic-link.ts`, a new user is created on line 79: `user = await db.user.create({ ... })`. Later, on lines 94-103, `RateLimitService.checkCustomKey` runs. If the rate limit is exceeded, it returns early with an error, leaving the newly created user in the database without completing the login flow or sending the magic link.
- **Defect 3 (Orphaned Email)**: In `src/actions/auth/request-magic-link.ts` line 82, `sendWelcomeLetter(cleanEmail)` is invoked. Subsequently, `sendMagicLink` is called inside a `try/catch` block (lines 119-129). If `sendMagicLink` fails, the code deletes the newly created user (line 126), but the welcome letter has already been sent.
- **Defect 4 (TOCTOU Race Condition)**: In `src/actions/auth/request-magic-link.ts` lines 77-79, the code checks `const ownerCount = await db.user.count({ where: { role: "OWNER" } });` and then assigns `"OWNER"` if count is 0. Concurrent requests could both read `0` and create multiple users with the `"OWNER"` role.
- **Defect 5 (Session Invalidation)**: In `scripts/set-admin-password.ts` lines 45-48, `prisma.user.update` changes the `passwordHash`. However, there is no code to invalidate existing active sessions for this user in the `Session` table.

## 2. Logic Chain
- **Defect 1**: Exposing raw `error.message` from a database or system failure can leak sensitive stack traces or internal details. The fix is to return a generic safe message (e.g., "Внутренняя ошибка сервера").
- **Defect 2**: Creating the user before checking the email-level rate limit causes a "Zombie User" to persist if the rate limit triggers. Moving the `RateLimitService.checkCustomKey` before the `db.user.create` (or even at the start of the function) prevents database mutations for rate-limited requests.
- **Defect 3**: Sending the welcome letter before verifying SMTP success for the magic link leads to users receiving a welcome email for an account that gets rolled back. The `sendWelcomeLetter` invocation must be moved inside the `try` block of `sendMagicLink`, executing only after `sendMagicLink` succeeds.
- **Defect 4**: A Time-Of-Check to Time-Of-Use (TOCTOU) vulnerability exists because `count` and `create` are separate operations without locking. Wrapping these in a Prisma `$transaction` with a `Serializable` isolation level ensures that only the first transaction sees a count of 0.
- **Defect 5**: Changing a password should invalidate compromised or existing sessions. Since session logic relies on the `Session` table (as verified in `src/lib/session.ts`), `set-admin-password.ts` must execute `prisma.session.deleteMany({ where: { userId: user.id } })` to revoke active JWTs and force re-authentication.

## 3. Caveats
- For Defect 4, the Prisma database provider (PostgreSQL) must support the `Serializable` isolation level. If Prisma client configuration does not enable interactive transactions or specific isolation levels, a raw SQL query with `FOR UPDATE` or a manual lock might be necessary.
- For Defect 5, it is assumed that all sessions are tracked in the `Session` database table. If any short-lived stateless JWTs are used (without DB lookup), they cannot be actively invalidated before expiry, though `src/lib/session.ts` shows `verifySession` does query the DB.

## 4. Conclusion
To resolve the 5 defects:
1. **Information Disclosure**: Replace `error.message` in the catch block of `request-magic-link.ts` with a generic fallback message.
2. **Zombie User Defect**: Hoist `RateLimitService.checkCustomKey` to execute before `user.create` in `request-magic-link.ts`.
3. **Orphaned Email**: Move `sendWelcomeLetter` inside the `sendMagicLink` try block, to be called only on success.
4. **TOCTOU Race Condition**: Wrap the `OWNER` auto-bootstrap logic in a Prisma `$transaction` with `Serializable` isolation.
5. **Session Invalidation**: Append `await prisma.session.deleteMany({ where: { userId: user.id } })` to `set-admin-password.ts` after updating the password.

## 5. Verification Method
- **Defect 1**: Force a DB error inside `request-magic-link.ts` (e.g., passing invalid data) and verify the HTTP response does not contain SQL or Prisma error strings.
- **Defect 2**: Trigger the email rate limit (4+ requests in 5 minutes for a new email). Verify the email is not present in the DB.
- **Defect 3**: Mock `sendMagicLink` to throw an error. Send a request for a new email and verify `sendWelcomeLetter` is not called and the DB does not contain the user.
- **Defect 4**: Use a script to fire 10 concurrent requests to `requestMagicLink` for different new emails on a fresh database. Verify only one user gets the `OWNER` role.
- **Defect 5**: Log in as an admin (creating a `Session` record). Run `set-admin-password.ts`. Verify that the `Session` table has 0 records for that admin ID and that reloading the admin dashboard requires re-authentication. Run `npm run lint` and tests to ensure no regressions.
