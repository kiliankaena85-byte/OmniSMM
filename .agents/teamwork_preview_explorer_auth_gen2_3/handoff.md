# Auth Fixes: Iteration 2 Handoff Report

## 1. Observation
- **Defect 1 (Information Disclosure)**: `src/actions/auth/request-magic-link.ts:138` returns the raw error message to the client: `return { error: (error as Error).message, success: false };`.
- **Defect 2 (Zombie User Defect)**: `src/actions/auth/request-magic-link.ts:94-103` checks the `magic-link:${cleanEmail}` rate limit. This happens after `db.user.create` (line 79). If the limit is exceeded, it returns an error immediately, leaving the newly created user in the database without completing the flow.
- **Defect 3 (Orphaned Email)**: `src/actions/auth/request-magic-link.ts:82` invokes `sendWelcomeLetter(cleanEmail).catch(console.error);` immediately after user creation. If `sendMagicLink` fails at line 120, the user is rolled back (deleted at line 126), but the welcome email has already been dispatched.
- **Defect 4 (TOCTOU Race Condition)**: `src/actions/auth/request-magic-link.ts:77-79` checks `db.user.count({ where: { role: "OWNER" } })` and immediately creates a user with `role: "OWNER"` if the count is 0. This is not atomic, meaning two concurrent requests could both evaluate `ownerCount === 0` and create two `OWNER` users.
- **Defect 5 (Session Invalidation)**: `scripts/set-admin-password.ts:45-48` updates the user's password but does not invalidate existing sessions. In contrast, `src/actions/auth/password-settings.ts` correctly deletes sessions via `db.session.deleteMany` when a password is changed.

## 2. Logic Chain
1. To prevent sensitive backend information (like DB connection strings) from leaking to the frontend, the outer `catch` block in `request-magic-link.ts` must return a generic, user-safe string.
2. Rate limits must guard the entire registration/login process. Moving `RateLimitService.checkCustomKey` above the database checks and writes ensures we never create "zombie" database entries for requests that will immediately fail a rate limit check.
3. Emails are irreversible actions. Deferring `sendWelcomeLetter` until after `sendMagicLink` succeeds and the transaction/process is guaranteed to commit prevents sending onboarding materials to users who don't actually exist in the database.
4. The Time-Of-Check to Time-Of-Use (TOCTOU) vulnerability can be resolved by wrapping the `ownerCount` check and the `user.create` operation in a serializable database transaction, leveraging PostgreSQL's isolation levels to ensure atomicity.
5. Updating a user's password via CLI (`set-admin-password.ts`) should invalidate all previously issued tokens/sessions. Adding a `prisma.session.deleteMany` call after the password update closes the vulnerability of stolen or previously active sessions remaining valid.

## 3. Caveats
- Moving the rate limit check higher in `request-magic-link.ts` will consume the rate limit quota even for requests that might fail later for other validation reasons, which is a standard and acceptable trade-off for security.
- The `Serializable` isolation level in Prisma requires the underlying database to support it (PostgreSQL does). If concurrent collisions occur, Prisma will throw an error, which the outer `catch` block will handle, properly denying the second `OWNER` creation without crashing the app.
- Assuming `prisma.session.deleteMany` correctly targets NextAuth's database session store. If JWTs without database storage are used (e.g., standard NextAuth JWT strategy), invalidation would require a different approach (like bumping a `securityStamp` or `tokensValidAfter` field on the user model), but the presence of `session.deleteMany` in `password-settings.ts` implies database sessions are used in this Next.js project.

## 4. Conclusion
The five defects can be successfully fixed by applying the following implementation plan:
- **File: `src/actions/auth/request-magic-link.ts`**
  - **Change 1**: Replace `(error as Error).message` in the `catch` block with a generic string: `"Произошла непредвиденная ошибка. Пожалуйста, попробуйте позже."`.
  - **Change 2**: Move `RateLimitService.checkCustomKey` for `magic-link:${cleanEmail}` (lines 94-103) up to line 50, before the `isNewUser` logic and database calls.
  - **Change 3**: Track `let shouldSendWelcome = isNewUser;` but execute `sendWelcomeLetter(cleanEmail)` *after* the `sendMagicLink` try/catch block completes successfully.
  - **Change 4**: Wrap `ownerCount` and `user.create` in `db.$transaction` with `{ isolationLevel: 'Serializable' }`.
- **File: `scripts/set-admin-password.ts`**
  - **Change 5**: After `await prisma.user.update(...)`, add `await prisma.session.deleteMany({ where: { userId: user.id } });`.

## 5. Verification Method
- **Information Disclosure**: Throw a forced error inside `requestMagicLink` and verify the API response contains the generic message instead of the raw error.
- **Zombie User**: Exhaust the rate limit, then submit a new email. Verify the database does not contain the new user.
- **Orphaned Email**: Simulate an SMTP failure inside `sendMagicLink` for a new email. Verify the user is deleted and no welcome email logs are produced.
- **TOCTOU**: Execute two concurrent requests for the first user registration. Verify only one `OWNER` is created and the other either fails or becomes a `USER`.
- **Session Invalidation**: Log into an account, run `npx tsx scripts/set-admin-password.ts` for that account, and verify the active session in the database is deleted and the user is logged out upon next request.
