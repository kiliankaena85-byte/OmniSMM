# 1. Observation
- **Timing Attack on SMTP**: In `src/actions/auth/request-magic-link.ts` (lines 78-105), if an account is blocked (`txResult.type === 'blocked'`), the function returns `{ success: true }` instantly. For valid accounts, it waits for `await sendMagicLink(...)` before returning. This difference in response time exposes whether an email is registered and not blocked.
- **Token Invalidation DoS**: In `src/actions/auth/request-magic-link.ts` (line 66), the code calls `await tx.authToken.deleteMany({ where: { userId: user.id } });` before creating a new token. A malicious user could trigger multiple magic link requests for a victim, invalidating their legitimate tokens before they can be used.
- **Unsafe `as any` Cast**: In `scripts/sanitize-db-prod.ts` (line 50) and `scripts/check-db.ts` (line 42), the code assumes `table.model` exists by casting it: `(table.model as any).deleteMany({})`. If a model is deleted from the `schema.prisma` in future updates, `table.model` will be `undefined`, causing a runtime `TypeError`.

# 2. Logic Chain
- **Timing Attack Fix**: By removing the `await` keyword from `sendMagicLink`, the email sending becomes a floating promise. The endpoint will return immediately, achieving a uniform response time for both valid and blocked accounts. Error handling (such as deleting a newly created user if SMTP fails) can be safely moved into the `.catch()` block of the floating promise.
- **Token Invalidation DoS Fix**: By removing the `tx.authToken.deleteMany` statement in `request-magic-link.ts`, previous tokens will remain valid until their `expiresAt` natural expiration (15 minutes). Thus, an attacker cannot invalidate a victim's pending token by spamming the endpoint. To prevent email spamming, a stricter email-specific rate limit (e.g., `auth:magic-link:email:${cleanEmail}`) should be implemented alongside the IP rate limit.
- **Unsafe Cast Fix**: Adding a runtime check (`if (!table.model) { ... continue; }`) in the migration scripts' loops guarantees that deleted or missing Prisma models are safely bypassed without crashing the process, making the scripts resilient to schema changes.

# 3. Caveats
- Next.js server actions generally allow floating promises, but if the Vercel/Node environment forcefully terminates the process upon response completion, the email might not be sent. If this becomes an issue in production, Next.js 15+ `after()` or an external background queue (BullMQ, which is already set up in `src/workers/`) should be used. For now, floating promises with `.catch()` are an acceptable and commonly used mitigation.
- Keeping multiple valid tokens could technically increase the database size temporarily, but since they expire in 15 minutes and the IP/Email rate limits cap the generation volume, the risk is minimal.

# 4. Conclusion
The defects can be resolved safely through the following implementation plan:
1. **`src/actions/auth/request-magic-link.ts`**:
   - Add an email rate limit check before creating the user/token.
   - Remove `await tx.authToken.deleteMany(...)`.
   - Remove `await` from `sendMagicLink(...)` and move the `db.user.delete(...)` cleanup logic inside its `.catch()` block.
2. **`scripts/check-db.ts` & `scripts/sanitize-db-prod.ts`**:
   - Inject `if (!table.model) { console.warn('Skipping...', table.name); continue; }` at the beginning of the `tablesToCheck` and `tablesToEmpty` loops.

# 5. Verification Method
- **Timing Attack**: Use `curl` or Postman to measure the TTFB (Time to First Byte) when requesting a magic link for a blocked email vs. a valid email. Both should be virtually identical (under 100ms).
- **Token DoS**: Generate two magic links for the same email in a row. Click the link from the **first** email. It must successfully log the user in.
- **Unsafe Cast**: In `scripts/check-db.ts`, manually set `model: undefined` for one of the entries in `tablesToCheck`. Run `npx tsx scripts/check-db.ts` and verify that the script logs the warning and completes successfully without crashing.
