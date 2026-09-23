# Plan 021: External HTTP Timeout Hardening

## Status
- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: reliability

## Why this matters
Several services rely on external APIs (YooKassa, Cryptomus, Gemini) using the native `fetch` API. Without an explicit timeout, these requests can hang indefinitely if the external service stops responding or drops packets. This leads to connection exhaustion, blocked background workers, and eventually memory exhaustion in the Node.js process.

## Current state
- `src/services/financial/payment-gateway.service.ts` — Uses `fetch()` for YooKassa and Cryptomus.
- `src/services/financial/payment.service.ts` — Uses `fetch()` for YooKassa status checks.
- `src/services/admin/ai-support.service.ts` — Uses `fetch()` for Gemini API calls.

## Smmplan default commands
| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | exit 0, no errors |
| Lint | `npm run lint` | exit 0 |

## Scope
**In scope**:
- `src/services/financial/payment-gateway.service.ts`
- `src/services/financial/payment.service.ts`
- `src/services/admin/ai-support.service.ts`

**Out of scope**:
- `universal.provider.ts` (already implements AbortController)
- All other files.

## Steps

### Step 1: Update payment-gateway.service.ts
In `src/services/financial/payment-gateway.service.ts`, locate the 4 `fetch()` calls.
Add `signal: AbortSignal.timeout(15000)` to each options object.

Example:
```typescript
    const resp = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: { ... },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000)
    });
```

### Step 2: Update payment.service.ts
In `src/services/financial/payment.service.ts`, locate the `fetch()` call for YooKassa status.
Add `signal: AbortSignal.timeout(15000)`.

```typescript
                const response = await fetch(`https://api.yookassa.ru/v3/payments/${gatewayId}`, {
                    headers: { 'Authorization': authHeader },
                    signal: AbortSignal.timeout(15000)
                });
```

### Step 3: Update ai-support.service.ts
In `src/services/admin/ai-support.service.ts`, locate the `fetch()` call.
Add `signal: AbortSignal.timeout(30000)` (AI requests can take longer, give it 30s).

```typescript
     const res = await fetch(url, {
       method: 'POST',
       headers: { ... },
       body: JSON.stringify({ ... }),
       dispatcher,
       signal: AbortSignal.timeout(30000)
     } as any);
```

### Step 4: Verify
Run `npx tsc --noEmit` to ensure types are correct.

## Git workflow
Commit with: `fix: add abort timeouts to external http fetch calls (plan 021)`
