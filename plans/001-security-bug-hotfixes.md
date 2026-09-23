# Plan 001: Security and Bug Hotfixes

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 885d26f..HEAD -- src/workers/processors/payment-sync.ts src/app/api/webhooks/yookassa/route.ts src/lib/session.ts src/app/api/v2/route.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug, security
- **Planned at**: commit `885d26f`, 2026-06-11

## Why this matters

This plan addresses critical security vulnerabilities and a severe financial bug found during the codebase audit. Fixing these prevents potential unauthorized admin access, stops sensitive database credentials from leaking into application logs, secures webhook endpoints against forgery on non-production environments, prevents potential DoS via the V2 API, and resolves a bug that leaves YooKassa payments older than 24 minutes permanently stuck.

## Current state

- `src/workers/processors/payment-sync.ts` — Handles syncing pending payments. Contains a bug where the 24-hour window is calculated as 24 minutes.
  - `const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 1000);` (Line 15)
- `src/app/api/webhooks/yookassa/route.ts` — Webhook handler for YooKassa. Leaks `DATABASE_URL` in logs and has a hardcoded secret for non-production environments.
  - `console.info(\`[YooKassa Webhook Debug] ip: ${ip}... DATABASE_URL: ${process.env.DATABASE_URL}\`);` (Line 21)
  - `webhookSecret = 'test_webhook_secret_key_123456';` (Line 43)
- `src/lib/session.ts` — Auth session handling. DEV_AUTO_LOGIN lacks a localhost check, and `verifySession` uses `console.log` leaking session/user IDs.
  - `if (process.env.NODE_ENV !== 'production' && (process.env.DEV_AUTO_LOGIN === 'true' || process.env.DEV_AUTO_LOGIN === '1'))` (Line 76, 160)
  - `console.log('[verifySession] null because: ...` (Lines 103, 109, 115)
- `src/app/api/v2/route.ts` — V2 API endpoints. `handleRefillStatus` lacks an upper bound on the number of IDs it processes in a batch.
  - `const refillIds = refillsStr.split(',').map((id: string) => parseInt(id.trim(), 10)).filter((id: number) => !isNaN(id));` (Line 282)

## Smmplan default commands

| Purpose   | Command                     | Expected on success |
|-----------|-----------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`          | exit 0, no errors   |
| Lint      | `npm run lint`              | exit 0              |
| Test      | `npx vitest run`            | all pass            |
| Build     | `npm run build`             | exit 0              |

## Scope

**In scope** (the only files you should modify):
- `src/workers/processors/payment-sync.ts`
- `src/app/api/webhooks/yookassa/route.ts`
- `src/lib/session.ts`
- `src/app/api/v2/route.ts`

**Out of scope**:
- ALL other files.

## Steps

### Step 1: Fix 24h window calculation in payment-sync.ts

In `src/workers/processors/payment-sync.ts`, fix the calculation for `twentyFourHoursAgo` on line 15 to multiply by 60 twice (minutes * seconds).

Before:
```typescript
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 1000);
```
After:
```typescript
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
```

### Step 2: Fix DATABASE_URL leak in YooKassa webhook

In `src/app/api/webhooks/yookassa/route.ts`, modify the `console.info` call on line 21 to remove `DATABASE_URL`.

Before:
```typescript
      console.info(`[YooKassa Webhook Debug] ip: ${ip}, isLocalhost: ${isLocalhost}, isTestMode: ${isTestMode}, NODE_ENV: ${process.env.NODE_ENV}, APP_ENV: ${process.env.NEXT_PUBLIC_APP_ENV}, DATABASE_URL: ${process.env.DATABASE_URL}`);
```
After:
```typescript
      console.info(`[YooKassa Webhook Debug] ip: ${ip}, isLocalhost: ${isLocalhost}, isTestMode: ${isTestMode}, NODE_ENV: ${process.env.NODE_ENV}, APP_ENV: ${process.env.NEXT_PUBLIC_APP_ENV}`);
```

### Step 3: Fix hardcoded webhook secret

In `src/app/api/webhooks/yookassa/route.ts`, restrict the hardcoded test webhook secret to unit test environments ONLY (`NODE_ENV === 'test'`).

Modify the condition starting around line 37.
Before:
```typescript
      const isTestEnv = process.env.NODE_ENV === 'test' || 
                        process.env.NEXT_PUBLIC_APP_ENV === 'test' || 
                        process.env.DATABASE_URL?.includes('smmplan_test') === true ||
                        process.env.NODE_ENV === 'development';

      if (isTestEnv) {
        webhookSecret = 'test_webhook_secret_key_123456';
      } else {
```
After:
```typescript
      // Only allow hardcoded secret during actual unit tests, not development/preview
      if (process.env.NODE_ENV === 'test') {
        webhookSecret = 'test_webhook_secret_key_123456';
      } else {
```

### Step 4: Fix session/user ID leaks in session.ts

In `src/lib/session.ts`, change `console.log` to `console.warn` in `verifySession` around lines 103, 109, and 115.

Before:
```typescript
    if (!session) {
      console.log('[verifySession] null because: session not found in DB', payload.sessionId);
      return null;
    }

    const user = session.user;
    if (!user || user.isDeleted === true || user.isActive === false) {
      console.log('[verifySession] null because: user missing or deleted/inactive', user?.id, 'isDeleted:', user?.isDeleted, 'isActive:', user?.isActive);
      return null;
    }

    // W3-1 SECURITY FIX: Enforce database-level session expiration
    if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
      console.log('[verifySession] null because: session expired in DB', session.expiresAt);
      return null;
    }
```
After:
```typescript
    if (!session) {
      console.warn('[verifySession] null because: session not found in DB');
      return null;
    }

    const user = session.user;
    if (!user || user.isDeleted === true || user.isActive === false) {
      console.warn('[verifySession] null because: user missing or deleted/inactive');
      return null;
    }

    // W3-1 SECURITY FIX: Enforce database-level session expiration
    if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
      console.warn('[verifySession] null because: session expired in DB');
      return null;
    }
```

### Step 5: Enforce localhost for DEV_AUTO_LOGIN

In `src/lib/session.ts`, add a localhost check to both DEV_AUTO_LOGIN bypasses (around line 76 and 160).
You already import `getClientIp` at line 19.
In `verifySession()`, get the IP and ensure it is localhost. Note: `verifySession` cannot easily use `getClientIp()` if it requires `headers()` in a way that breaks route handlers. Let's do a simple check using `headers().get('x-forwarded-for')` or similar, OR simpler: just require an explicit bypass token.
*Correction:* Since `DEV_AUTO_LOGIN` is extremely dangerous on staging, we will wrap the blocks.

Add this at the beginning of `verifySession()`:
```typescript
  const reqHeaders = await headers();
  const rawIp = reqHeaders.get('x-forwarded-for') || reqHeaders.get('x-real-ip') || '';
  // Very basic localhost sanity check if headers are present
  const isLocalhostRequest = !rawIp || rawIp.includes('127.0.0.1') || rawIp.includes('::1');
```

Then update both DEV_AUTO_LOGIN conditions:
```typescript
    // SD-11 SECURITY FIX: DEV_AUTO_LOGIN restricted to localhost only.
    if (isLocalhostRequest && process.env.NODE_ENV !== 'production' && (process.env.DEV_AUTO_LOGIN === 'true' || process.env.DEV_AUTO_LOGIN === '1')) {
```

### Step 6: Add bound to batch refill_status in V2 API

In `src/app/api/v2/route.ts` around line 282, add a `.slice(0, 100)` to cap the array.

Before:
```typescript
          const refillIds = refillsStr.split(',')
            .map((id: string) => parseInt(id.trim(), 10))
            .filter((id: number) => !isNaN(id));
```
After:
```typescript
          const refillIds = refillsStr.split(',')
            .map((id: string) => parseInt(id.trim(), 10))
            .filter((id: number) => !isNaN(id))
            .slice(0, 100);
```

### Step 7: Verify

Run:
```bash
npx tsc --noEmit
npm run lint
```
Both should pass.

## STOP conditions

- If any in-scope file's current content doesn't match the "Current state" excerpts (beyond whitespace/formatting).
- If adding `await headers()` in `session.ts` causes typecheck or build errors related to synchronous components (though it is already async).

## Git workflow

Commit with: `fix: security and bug hotfixes from audit (plan 001)`
