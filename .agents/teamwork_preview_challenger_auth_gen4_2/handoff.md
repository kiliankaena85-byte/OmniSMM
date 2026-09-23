## Challenge Summary

**Overall risk assessment**: HIGH

## Challenges

### [High] Targeted Denial of Service via Token Invalidation (`request-magic-link.ts`)

- **Assumption challenged**: The assumption that deleting all previous tokens on every new request is safe without email-specific rate limits or cooldowns.
- **Attack scenario**: An unauthenticated attacker submits a victim's email (e.g., the admin's email) to the magic link request endpoint. The system immediately executes `await tx.authToken.deleteMany({ where: { userId: user.id } });`, invalidating any pending login tokens the victim might have. By scripting this to run repeatedly (even staying within the 15 requests/hour IP limit, or by rotating IPs), the attacker guarantees that the victim's magic link is always invalidated before they have time to open their email and click it. 
- **Blast radius**: Complete lockout of targeted users from logging into the platform via magic link (Targeted DoS). 
- **Mitigation**: 
  1. Implement an email-specific rate limit (e.g., max 3 requests per 15 minutes per email).
  2. Implement a cooldown period (e.g., "A magic link was already sent. Please wait 60 seconds before requesting another").
  3. Alternatively, allow multiple concurrent tokens (up to a small limit) to exist rather than immediately wiping the previous one.

### [Low] Self-Inflicted DoS on SMTP Failure (`request-magic-link.ts`)

- **Assumption challenged**: That the transaction should commit before confirming SMTP delivery.
- **Attack scenario**: If the SMTP provider is temporarily down or slow, the transaction that deletes old tokens and creates the new one is already committed. When `sendMagicLink` throws an error, the user receives an error message, but their previously valid token is already deleted.
- **Blast radius**: Existing users lose access to their pending tokens during transient email failures.
- **Mitigation**: Only invalidate previous tokens *after* the new token email has been successfully queued/sent, or use a background worker with reliable retries for email sending.

## Handoff Report

### 1. Observation
- In `scripts/set-admin-password.ts`, all instances of `process.exit(1)` have been successfully removed and replaced with `process.exitCode = 1; return;`. The `finally` block containing `await prisma.$disconnect();` executes properly.
- In `src/actions/auth/request-magic-link.ts` (lines 66-73), the code blindly deletes all existing tokens for a user (`await tx.authToken.deleteMany({ where: { userId: user.id } });`) before generating a new one. 
- In `src/actions/auth/request-magic-link.ts` (line 27), the rate limit `RateLimitService.check('auth:magic-link:ip', 15, 3600);` only restricts by IP address, not by email address.

### 2. Logic Chain
- The removal of `process.exit(1)` ensures that the script properly unwinds the call stack and executes the `finally` block, safely closing the Prisma connection.
- The magic link endpoint is unauthenticated and accepts any email.
- Because there is no email-based cooldown or rate limit, an attacker can submit another user's email repeatedly.
- Every submission triggers `tx.authToken.deleteMany`, instantly invalidating the victim's pending magic link.
- This creates a trivial vector for a targeted Denial of Service attack against specific accounts (like administrators).

### 3. Caveats
- I did not test the SMTP error handling dynamically as I cannot easily induce a failure in the external email provider from this environment.
- IP rate limits provide *some* protection, but 15 requests per hour from a single IP is more than enough to continuously disrupt a single user trying to log in, and botnets bypass IP limits entirely.

### 4. Conclusion
- **scripts/set-admin-password.ts**: **PASS**. The script correctly handles graceful termination and prevents orphaned database connections.
- **request-magic-link.ts**: **FAIL**. The token invalidation logic is highly vulnerable to targeted Denial of Service due to the lack of email-based cooldowns and aggressive token deletion.

### 5. Verification Method
- **To verify the set-admin-password fix**: Run `npx tsx scripts/set-admin-password.ts --email invalid --password pass` and observe that the script exits with code 1 but does not hang (proving the connection is closed).
- **To verify the DoS vulnerability**:
  1. Have User A request a magic link.
  2. Before User A clicks the link in their email, have User B (or an attacker) request a magic link for User A's email.
  3. Have User A click the first link they received. It will fail with "Token invalid or expired" because User B's request triggered the `deleteMany` clause.
