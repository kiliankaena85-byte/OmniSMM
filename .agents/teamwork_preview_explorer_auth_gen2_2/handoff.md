# Authentication Security & Logic Fixes Report

## Observation
During our read-only audit, we identified the following defects:
1. **Information Disclosure:** In `src/actions/auth/request-magic-link.ts` (line 138), the catch block returns the raw error via `return { error: (error as Error).message, success: false };` directly to the client.
2. **Zombie User Defect:** In `src/actions/auth/request-magic-link.ts` (lines 94-103), `RateLimitService.checkCustomKey` for `magic-link:${cleanEmail}` executes after the user is instantiated in the database via `db.user.create()` (line 79).
3. **Orphaned Email:** In `src/actions/auth/request-magic-link.ts` (line 82), `sendWelcomeLetter(cleanEmail)` is dispatched immediately upon user creation, bypassing the `try/catch` block handling the magic link (line 119) that rolls back the DB record upon SMTP failure.
4. **TOCTOU Race Condition:** In `src/actions/auth/request-magic-link.ts` (line 77), `ownerCount` is retrieved and conditionally resolves the `OWNER` role for the subsequent un-locked `db.user.create()`.
5. **Session Invalidation:** In `scripts/set-admin-password.ts` (lines 45-48), the Prisma script correctly patches the `passwordHash` but lacks instructions to drop existing rows in the `Session` and `AuthToken` tables for the modified `user.id`.

## Logic Chain
1. Returning `error.message` on SMTP or DB crashes leaks internal architecture. Obfuscating this output with a generic string (`"Внутренняя ошибка сервера. Пожалуйста, попробуйте позже."`) prevents information disclosure.
2. The email rate limiter rejecting a request *after* a new user is created in PostgreSQL causes a stranded (zombie) user record. Reordering the validation steps to execute `checkCustomKey` before any DB mutations prevents this anomaly.
3. Because `sendWelcomeLetter` does not depend on the success of the magic link dispatcher, a failed SMTP connection deletes the newly created user but leaves the welcome email dispatched. Relocating the welcome letter call to the post-success path of `sendMagicLink` ensures state alignment.
4. The asynchronous gap between retrieving the owner count and creating the user means concurrent first-time requests could both evaluate to `0` and obtain `OWNER` status. A retroactive post-creation conflict check—verifying if an older `OWNER` already exists—safely mitigates this without locking the database.
5. Updating an administrator's credentials must structurally invalidate existing login contexts. Adding deletion commands for `Session` and `AuthToken` ensures a clean environment post-password reset.

## Caveats
- The retroactive TOCTOU resolution relies on standard PostgreSQL sequencing of the `createdAt` timestamp. This is highly reliable for our scale, avoiding `Serializable` database locks that commonly trigger application-level crashing during concurrency spikes.
- We assume that clearing both `Session` and `AuthToken` correctly flushes any NextAuth or custom JWT contexts used by the app.

## Conclusion
The codebase suffers from several sequencing and state-management defects during the magic link lifecycle, alongside session persistence upon password rotation. The fixes strictly entail code reordering and a couple of safety checks, without fundamentally modifying the data model.

### Implementation Plan
**In `src/actions/auth/request-magic-link.ts`:**
1. Replace `return { error: (error as Error).message, success: false };` with `return { error: "Внутренняя ошибка сервера. Пожалуйста, попробуйте позже.", success: false };`.
2. Move the `RateLimitService.checkCustomKey` for `magic-link:${cleanEmail}` up to line 55, evaluating it immediately after retrieving the user from the DB.
3. Move `sendWelcomeLetter(cleanEmail).catch(console.error);` into the `try` block that sends the magic link, conditional upon `isNewUser`.
4. Implement a post-creation verification block for the `OWNER` role assignment: if the user was assigned `OWNER`, query for the oldest `OWNER`; if their ID doesn't match the new user, fallback the new user's role to `USER`.

**In `scripts/set-admin-password.ts`:**
1. Insert `await prisma.session.deleteMany({ where: { userId: user.id } });` and `await prisma.authToken.deleteMany({ where: { userId: user.id } });` directly after the `user.update` call.

## Verification Method
1. Run local Vitest scripts targeting the `request-magic-link` action, deliberately triggering a mock SMTP crash to assert the response payload is obfuscated and no welcome email is dispatched.
2. Script a concurrent barrage of `request-magic-link` requests for completely new users and verify exactly one user possesses the `OWNER` role inside PostgreSQL.
3. Insert mock records into the `Session` table, invoke `set-admin-password.ts` via terminal (`npx tsx scripts/set-admin-password.ts`), and verify the `Session` count drops to zero for that administrator.
