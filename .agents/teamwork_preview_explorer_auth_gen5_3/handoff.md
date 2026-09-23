## Observation
1. **Timing Attack on SMTP**: In `src/actions/auth/request-magic-link.ts` (lines 90-105), `await sendMagicLink(...)` is called synchronously. If the user account is blocked or inactive, the action returns instantly at line 80 (`return { success: true, error: null };`), exposing the user's account state via response time difference.
2. **Token Invalidation DoS**: In `src/actions/auth/request-magic-link.ts` (line 66), the code runs `await tx.authToken.deleteMany({ where: { userId: user.id } });` before creating a new token. An attacker can repeatedly request magic links for a victim's email, invalidating all their pending legitimate tokens before they can be used.
3. **Unsafe `as any` Cast**: In `scripts/sanitize-db-prod.ts` (line 50) and `scripts/check-db.ts` (line 42), the code loops over `tablesToEmpty` / `tablesToCheck` and blindly invokes `(table.model as any).deleteMany({})` and `(table.model as any).count()`. If a Prisma model is deleted from `schema.prisma`, `table.model` becomes `undefined`, causing a runtime `TypeError` that breaks DB script execution.

## Logic Chain
1. To mitigate the **SMTP Timing Attack**, the `sendMagicLink` and `sendWelcomeLetter` calls should be decoupled from the HTTP response. By wrapping the email dispatch logic in a detached asynchronous block (e.g., `Promise.resolve().then(async () => { ... })`) and returning `success: true` immediately, the response time becomes uniformly fast regardless of the email state. This prevents state enumeration.
2. To mitigate the **Token Invalidation DoS**, the system should *not* delete existing authentication tokens when a new one is requested. By removing the `deleteMany` call in `request-magic-link.ts`, an attacker can only generate additional valid tokens but cannot invalidate the one the victim is currently trying to use. The tokens will naturally expire after 15 minutes. As an extra cleanup step, old tokens can be safely deleted upon *successful* validation in `src/app/api/auth/verify/route.ts`.
3. To mitigate the **Unsafe `as any` Cast**, a runtime validation check must be added inside the loops in both scripts. Adding `if (!table.model) { continue; }` safely bypasses deleted models, preventing the Node.js process from crashing and ensuring the rest of the script (e.g. re-enabling DB triggers) completes successfully.

## Caveats
- Moving SMTP to a detached promise means if the email fails to send, the frontend will still show a "success" message. However, the user can simply request another link. The backend already logs the SMTP error and cleans up newly created users appropriately.
- Vercel serverless environments might prematurely freeze detached promises. However, Smmplan uses a Dockerized Node.js hybrid deploy architecture (as per `PROJECT.md` and user rules), so background promises will execute normally.

## Conclusion
The implementer must apply these three specific fixes:
1. In `src/actions/auth/request-magic-link.ts`: remove `await` from the email dispatch block (lines 90-105) and wrap it in a detached promise (`Promise.resolve().then(async () => { ... })`).
2. In `src/actions/auth/request-magic-link.ts`: remove `await tx.authToken.deleteMany(...)` (line 66) to allow concurrent pending tokens. Optionally, add `await db.authToken.deleteMany({ where: { userId: authToken.userId } });` in `src/app/api/auth/verify/route.ts` after session creation to clean up tokens post-login.
3. In `scripts/sanitize-db-prod.ts` (line 50) and `scripts/check-db.ts` (line 42): insert an `if (!table.model) { console.warn('...'); continue; }` check before invoking Prisma operations on dynamic models in the loops.

## Verification Method
1. **Timing Attack**: Run `request-magic-link` with a valid email and a blocked email. Measure the TTFB (Time to First Byte); both should return in < 100ms.
2. **Token Invalidation**: Request a magic link for an email, then request a second one immediately. Verify in the database that both `AuthToken` records exist and that the first link still successfully logs the user in.
3. **Unsafe Cast**: Temporarily add `{ name: 'FakeModel', model: (prisma as any).fakeModel }` to `tablesToEmpty` in `scripts/sanitize-db-prod.ts`, run `npx tsx scripts/sanitize-db-prod.ts`, and verify it skips the table gracefully instead of throwing a `TypeError`.
