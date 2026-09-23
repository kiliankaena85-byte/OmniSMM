# Observation

1. **SMTP Timing Attack**: In `src/actions/auth/request-magic-link.ts` (lines 78-81), if an account is blocked, the handler returns immediately. For valid accounts, `await sendMagicLink(cleanEmail, rawToken);` is called at line 91. This creates a timing discrepancy, allowing an attacker to enumerate blocked vs. active email addresses.
2. **Token Invalidation DoS**: In `src/actions/auth/request-magic-link.ts` (line 66), `await tx.authToken.deleteMany({ where: { userId: user.id } });` deletes all of a user's tokens upon every request. An attacker can spam magic link requests to a victim's email, thereby invalidating any pending tokens before the victim can click them. Furthermore, the rate limiting is currently only IP-based (`RateLimitService.check('auth:magic-link:ip')`), not email-based.
3. **Unsafe `as any` Cast**: In `scripts/sanitize-db-prod.ts` (line 50) and `scripts/check-db.ts` (line 42), tables are iterated and queries executed via `(table.model as any).deleteMany({})` and `(table.model as any).count()`. If a model is removed from `schema.prisma`, `table.model` becomes `undefined` and causes a runtime `TypeError` when its methods are invoked.

# Logic Chain

1. **To fix the SMTP Timing Attack**: Decouple the SMTP logic from the HTTP response. Wrap `sendMagicLink` and the potential rollback (user deletion on SMTP failure) in an asynchronous background context (e.g. `Promise.resolve().then(async () => { ... })`). Always return `{ success: true, error: null }` instantly to ensure uniform response times.
2. **To fix Token Invalidation DoS**: 
   - Modify the token deletion to only remove expired tokens: `await tx.authToken.deleteMany({ where: { userId: user.id, expiresAt: { lt: new Date() } } });`. This ensures legitimate tokens remain valid for their full 15-minute window.
   - Introduce an email-based rate limit before the transaction using `RateLimitService.checkCustomKey('auth:magic-link:email:' + cleanEmail, 5, 3600);`. If the rate limit is exceeded, quietly return `{ success: true, error: null }` to mitigate spam without leaking information.
3. **To fix Unsafe `as any` Cast**: Insert a simple runtime presence check before calling model methods:
   ```typescript
   if (!table.model) {
     console.warn(`[SKIP] Table ${table.name} model not found in Prisma Client.`);
     continue;
   }
   ```

# Caveats

- By offloading SMTP to the background, users will receive a `{ success: true }` UI response even if SMTP fails. This is a deliberate UX tradeoff for security.
- The unit test `should delete newly created user if SMTP fails` in `src/actions/auth/__tests__/request-magic-link.test.ts` will fail after these changes because the HTTP request will return `success: true`. The test must be updated to expect success and to use a short delay (e.g., `await new Promise(r => setTimeout(r, 50))`) to allow the background deletion task to finish before verifying the database state.

# Conclusion

The defects are fully scoped. The implementation plan requires minor, localized modifications:
1. Update `request-magic-link.ts` to implement email-based rate limiting, non-destructive token cleanup, and fire-and-forget SMTP dispatch.
2. Update `scripts/sanitize-db-prod.ts` and `scripts/check-db.ts` to include safe existence checks (`if (!table.model)`) before using type casting.
3. Update Vitest tests to accommodate the asynchronous background tasks.

# Verification Method

- Update code as planned and run `npx vitest src/actions/auth/__tests__/request-magic-link.test.ts` to confirm the test accurately models background processing.
- Verify script stability by temporarily adding a mock entry `{ name: 'Missing', model: (prisma as any).missing }` to `tablesToCheck` in `scripts/check-db.ts` and running `npx tsx scripts/check-db.ts` to ensure it safely skips without crashing.
