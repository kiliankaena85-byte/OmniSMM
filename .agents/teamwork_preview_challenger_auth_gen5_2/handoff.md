# Handoff Report

## Observation

I investigated the Gen5 auth fallback fix, specifically the "token invalidation DoS fix". The fix was implemented in `d:\SMM_plan_2\src\actions\auth\request-magic-link.ts` (line 66) by changing the token cleanup logic from deleting all tokens for a user to deleting only expired tokens:
`await tx.authToken.deleteMany({ where: { userId: user.id, expiresAt: { lt: new Date() } } });`

I also examined `d:\SMM_plan_2\src\app\api\auth\verify\route.ts` (lines 28-31) where a token is marked as used:
`const result = await db.authToken.updateMany({ where: { id: authToken.id, used: false }, data: { used: true } });`

During my review, I noticed that rate limiting in `request-magic-link.ts` relies purely on IP (`RateLimitService.check('auth:magic-link:ip', 15, 3600)`), not on the requested email address. I executed a test script (`scripts/test-magic-link-dos.ts`) that bypassed the IP check and generated 50 tokens for a single email. All 50 tokens were successfully stored as active rows in the database. 

I executed a second test script (`scripts/test-magic-link-reuse.ts`) where I generated two active tokens for a user, simulated a login with the first token, and observed that the second token remained `used: false` and perfectly valid for logging in.

## Logic Chain

1. The "Token Invalidation DoS fix" stopped the deletion of active tokens when a new token is requested, ostensibly so an attacker cannot invalidate a user's legitimate magic link by simply requesting a new one.
2. Because there is no per-email or per-user rate limit applied to the magic link generation process, an attacker who rotates IPs (or spoofs IP headers if edge configuration allows) can request thousands of magic links for the same victim.
3. Because old active tokens are no longer deleted, each request creates a new row in the `AuthToken` table, leading to Database Bloat/Resource Exhaustion (and SMTP Email Bombing) — effectively a different DoS vector.
4. Furthermore, because tokens are allowed to coexist, a user might accumulate multiple valid login links in their inbox.
5. When the user logs in using one of the links, the `verify` route updates *only the specific token used* (`id: authToken.id`).
6. As a result, all other active tokens for that user remain valid. If an attacker gains temporary access to the victim's email, or if the victim accidentally shares an older (but still valid) link, the attacker can log in as the victim even after the victim has successfully authenticated.

## Caveats

No caveats. The test scripts confirmed both vulnerabilities reliably against the local codebase.

## Conclusion

**FAIL**

Retaining multiple active tokens per user introduces two severe logical vulnerabilities:
1. **Unbounded Database Bloat / Email Bombing DoS**: The absence of a per-user or per-email rate limit allows an attacker bypassing IP limits to infinitely bloat the `AuthToken` table and spam the victim's email.
2. **Post-Authentication Token Retention**: Logging in with one active token does not invalidate other active tokens. If a user accidentally generates multiple links, the unused ones remain active and exploitable (Ghost Login) until they expire.

## Verification Method

1. To verify the Database Bloat / Email Bombing DoS, run:
   `npx tsx scripts/test-magic-link-dos.ts`
   This script creates 50 tokens for one user and verifies that all 50 remain active in the database.
2. To verify Post-Authentication Token Retention, run:
   `npx tsx scripts/test-magic-link-reuse.ts`
   This script generates two tokens, uses the first one to log in, and asserts that the second token is still valid (`used === false`).
