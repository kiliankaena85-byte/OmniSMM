# Plan 018: Infrastructure & Queue Hardening

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step.
>
> **Drift check (run first)**: `git diff --stat HEAD -- src/workers/processors/payment-sync.ts src/lib/queue-manager.ts`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW — infrastructure-level changes with minimal business logic impact
- **Depends on**: none
- **Category**: reliability
- **Planned at**: deep audit round 2, 2026-06-11

## Why this matters

1. **Payment sync only covers YooKassa (DEEP-023, LOW)**: The `payment-sync.ts` processor filters for `gateway: 'yookassa'` only. Robokassa and CryptoBot payments that miss their webhooks remain PENDING forever — potential lost revenue.

2. **Dripfeed-tick head-of-line blocking (WORKER-022, LOW-MED)**: The `dripfeed-tick` cron (every 1 minute) shares `syncQueue` with `status-sync-tick` (every 5 minutes). The syncWorker has default concurrency of 1. When the massive status sync runs (up to 1000 orders × 15s timeouts), `dripfeed-tick` jobs queue behind it, delaying time-sensitive dripfeed tasks.

3. **closeQueues omits syncQueue (WORKER-023, LOW)**: The `closeQueues()` helper closes 9 queues but omits `syncQueue`, leaking its Redis connection.

## Current state

- `payment-sync.ts:21` — `gateway: 'yookassa'` filter
- `queue-manager.ts:252-261` — `dripfeed-tick` added to `syncQueue`
- `queue-manager.ts:280-291` — `closeQueues()` missing `syncQueue.close()`

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`       | exit 0              |
| Tests     | `npx vitest run`         | all pass            |
| Lint      | `npm run lint`           | exit 0              |
| Build     | `npm run build`          | exit 0              |

## Scope

**In scope**:
- `src/workers/processors/payment-sync.ts`
- `src/lib/queue-manager.ts`

**Out of scope**:
- Robokassa/CryptoBot API client implementation (if not already available)
- Full payment reconciliation system

---

## Step 1: Extend payment sync to auto-cancel stale non-YooKassa payments

**File**: `src/workers/processors/payment-sync.ts`

Modify the `where` clause to include all gateway types, or add a separate sweep for non-YooKassa payments:

```typescript
// Option A: Remove the gateway filter to sync all pending payments
// Before:
// where: { status: 'PENDING', gateway: 'yookassa', createdAt: { lt: threshold } }

// After:
// where: { status: 'PENDING', createdAt: { lt: threshold } }

// Option B (safer): Keep YooKassa sync, add auto-cancel for stale non-YooKassa payments
const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h

const stalePayments = await db.payment.findMany({
  where: {
    status: 'PENDING',
    gateway: { notIn: ['yookassa'] },
    createdAt: { lt: staleThreshold }
  },
  select: { id: true, orderId: true },
  take: 50
});

for (const payment of stalePayments) {
  try {
    await db.$transaction(async (tx) => {
      const updated = await tx.payment.updateMany({
        where: { id: payment.id, status: 'PENDING' },
        data: { status: 'EXPIRED' }
      });
      if (updated.count === 0) return;

      if (payment.orderId) {
        await tx.order.updateMany({
          where: { id: payment.orderId, status: 'AWAITING_PAYMENT' },
          data: { status: 'CANCELED', error: 'Оплата не поступила в течение 24ч (auto-expire)' }
        });
      }
    });
  } catch (err: any) {
    console.error(`[PaymentSync] Failed to expire stale payment ${payment.id}:`, err.message);
  }
}
```

**Verify**: `npx tsc --noEmit`

---

## Step 2: Separate dripfeed-tick into its own queue

**File**: `src/lib/queue-manager.ts`

Option A (Recommended): Set concurrency to 2 on syncWorker to allow parallel processing:
```typescript
// Find syncWorker creation and add concurrency
// Before:
// new Worker('syncQueue', handler)
// After:
// new Worker('syncQueue', handler, { concurrency: 2 })
```

Option B (Full separation): Create a dedicated dripfeedQueue. This requires more refactoring — only choose this if dripfeed timing is critical.

**Verify**: `npx tsc --noEmit`

---

## Step 3: Add syncQueue to closeQueues

**File**: `src/lib/queue-manager.ts`

Find `closeQueues()` function (around line 280-291). Add:
```typescript
await syncQueue.close();
```

Also ensure `syncQueue` is exported if not already.

**Verify**: `npx tsc --noEmit`

---

## Step 4: Final verification

```bash
npx tsc --noEmit
npm run lint
npx vitest run
npm run build
```

All must pass.
