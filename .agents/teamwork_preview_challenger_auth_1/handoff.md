# Handoff Report: Authentication Fallback & Magic Link Audit

## Observation
1. In `src/actions/auth/request-magic-link.ts`, the new user registration flow evaluates `isNewUser = true`, creates the user in the database, and then proceeds to rate-limiting checks (`RateLimitService.checkCustomKey`). 
2. If `RateLimitService.checkCustomKey` returns `false`, the function returns an error early without reaching the `catch` block that handles the rollback (`db.user.delete`).
3. In `request-magic-link.ts`, if `sendMagicLink` fails, the `catch` block rolls back the user creation (`db.user.delete`). However, `sendWelcomeLetter(cleanEmail)` was already invoked asynchronously *before* this point.
4. In `request-magic-link.ts`, the `OWNER` role bootstrapping checks `ownerCount === 0` and subsequently creates the user.
5. In `scripts/set-admin-password.ts`, the script updates the `passwordHash` for the user via `prisma.user.update`. It does not clear existing active sessions associated with the user.

## Logic Chain
1. **Zombie User State Defect**: Because `RateLimitService.checkCustomKey` occurs *after* `user.create` but *before* the `try/catch` block for email sending, an attacker who intentionally triggers SMTP failures (e.g., via greylisting or unresolvable domains) will be deleted by the rollback logic. If they do this 3 times sequentially, their email hits the `magic-link:email` rate limit. On the 4th attempt, the user is created in the DB, but the rate limit check returns early. The rollback `catch` block is never executed, leaving a "zombie" user in the database without any initial magic link sent.
2. **Orphaned Welcome Email**: Since `sendWelcomeLetter` is fire-and-forget and occurs before `sendMagicLink`, a transient SMTP failure during `sendMagicLink` will trigger the rollback deletion of the user. However, the Welcome Letter might still be successfully dispatched, resulting in the user receiving a welcome email for an account that was immediately deleted.
3. **TOCTOU OWNER Race Condition**: The `ownerCount === 0` check followed by `user.create` is a Time-of-Check to Time-of-Use vulnerability. If multiple concurrent requests hit the endpoint on a fresh deployment, they will all read `ownerCount` as 0, resulting in multiple users being granted the `OWNER` role.
4. **Session Invalidation Vulnerability**: When `set-admin-password.ts` is used to reset a password (e.g., during an incident response where the OWNER's account is compromised), it updates the hash but fails to invalidate existing JWT sessions in the `Session` table. The attacker will remain logged in and retain administrative access until their current session naturally expires.

## Caveats
- The TOCTOU `OWNER` race condition only applies to a completely fresh database with zero existing owners.
- The `set-admin-password.ts` script is a CLI tool intended for server administrators. The lack of session invalidation is a systemic logical flaw rather than an externally exploitable endpoint, but it critically undermines incident response.
- The zombie user defect does not immediately grant privilege escalation, but it does bypass the intended synchronous provisioning flow.

## Conclusion
**FAIL**. The authentication and rollback changes contain state defects, race conditions, and a critical oversight in incident response security.
- The rollback logic in `request-magic-link.ts` is structurally flawed because the rate-limit short-circuit occurs *after* state mutation but *before* the rollback safety net. 
- The `set-admin-password.ts` script fails to invalidate active sessions, rendering it ineffective at evicting an attacker during an account takeover scenario.

## Verification Method
1. **Verify Zombie User Defect**: 
   - Mock `sendMagicLink` to throw an error. 
   - Call the `requestMagicLink` action 4 times sequentially with the same email. 
   - Observe that the first 3 times return an SMTP error, but the 4th returns a Rate Limit error. 
   - Check the database (`prisma.user.findUnique`) and observe the user exists despite no email being sent.
2. **Verify Session Invalidation**: 
   - Authenticate as a user to generate a session in the `Session` table.
   - Run `npx tsx scripts/set-admin-password.ts --email <user> --password <new>`.
   - Observe that the session still exists in the database and `verifySession` still considers the old session token valid.
