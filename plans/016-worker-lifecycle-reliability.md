# Plan 016: Worker Lifecycle & Reliability

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat HEAD -- src/workers/index.ts src/workers/processors/sync.processor.ts src/workers/processors/cleanup.processor.ts src/workers/processors/payment-sync.ts src/workers/processors/refill.processor.ts src/workers/processors/smart-feedback-loop.processor.ts`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED — touches worker infrastructure; requires careful testing
- **Depends on**: none
- **Category**: bug + reliability
- **Planned at**: deep audit round 2, 2026-06-11

## Why this matters

1. **SmartFeedbackLoopProcessor dead code (WORKER-015, HIGH)**: The entire `SmartFeedbackLoopProcessor` class (159 lines) is defined but **never called** anywhere. The "Smart Drip 2.5" auto-compensation feature is completely non-functional.

2. **Missing etaWorker failure handler (WORKER-016, MED)**: Every worker except `etaWorker` has an `.on('failed', ...)` handler. ETA failures are silently swallowed.

3. **Payment-sync fetch without timeout (WORKER-018, MED)**: The `payment-sync.ts` processor calls `fetch()` to YooKassa API without an `AbortSignal.timeout`. If YooKassa hangs, the worker blocks indefinitely (up to Node TCP timeout ~120s per request).

4. **PENDING_CHECK orders stuck forever (WORKER-019, HIGH)**: Orders in `PENDING_CHECK` have **no automated TTL sweep**. The cleanup processor handles `AWAITING_PAYMENT`, `IN_PROGRESS`, and `PENDING` orphans, but `PENDING_CHECK` orders with locked funds are never resolved.

5. **Refill IN_PROGRESS without status sync (WORKER-020, MED)**: Refill orders dispatched to providers are set to `IN_PROGRESS` but their status is never polled. They remain `IN_PROGRESS` forever.

## Current state

- `workers/index.ts:71` — `etaWorker` declaration without `.on('failed')` (lines 145-152 have handlers for other workers)
- `sync.processor.ts` — no import/call of `SmartFeedbackLoopProcessor`
- `payment-sync.ts:64` — bare `fetch()` without timeout
- `cleanup.processor.ts` — handles `AWAITING_PAYMENT` (line 60-136) and `IN_PROGRESS` (line 154-443) but no `PENDING_CHECK`
- `refill.processor.ts:78-83` — dispatches refill, sets `IN_PROGRESS`, no follow-up sync

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`       | exit 0              |
| Tests     | `npx vitest run`         | all pass            |
| Lint      | `npm run lint`           | exit 0              |
| Build     | `npm run build`          | exit 0              |

## Scope

**In scope**:
- `src/workers/index.ts`
- `src/workers/processors/sync.processor.ts`
- `src/workers/processors/cleanup.processor.ts`
- `src/workers/processors/payment-sync.ts`
- `src/workers/processors/refill.processor.ts`

**Out of scope**:
- SmartFeedbackLoopProcessor business logic changes
- Queue separation (Plan 018)
- Catalog post-sync rules (Plan 017)

## STOP conditions

- If `SmartFeedbackLoopProcessor` has been wired up since the audit
- If `cleanup.processor.ts` already handles `PENDING_CHECK`
- If `sync.processor.ts` already has a refill sync section

---

## Step 1: Wire SmartFeedbackLoopProcessor into sync cron

**File**: `src/workers/processors/sync.processor.ts`

Add import at top:
```typescript
import { SmartFeedbackLoopProcessor } from './smart-feedback-loop.processor';
```

Add a call at the end of the `status-sync-tick` handler (after the existing status sync logic completes):
```typescript
// Smart Drip 2.5: Auto-compensation tick
try {
  await SmartFeedbackLoopProcessor.runSmartFeedbackLoopTick();
} catch (err: any) {
  console.error('[SyncProcessor] SmartFeedbackLoop tick failed:', err.message);
}
```

**Verify**: `npx tsc --noEmit`

---

## Step 2: Add failure handler for etaWorker

**File**: `src/workers/index.ts`

Find the block where other workers have `.on('failed', ...)` handlers (around lines 145-152). Add:

```typescript
etaWorker.on('failed', (job, err) => {
  log.error('[etaWorker] Job failed', {
    jobId: job?.id,
    jobName: job?.name,
    error: err?.message,
  });
});
```

**Verify**: `npx tsc --noEmit`

---

## Step 3: Add AbortSignal timeout to payment-sync fetch

**File**: `src/workers/processors/payment-sync.ts`

Find the `fetch()` call to YooKassa API (around line 64). Add `signal`:

```typescript
const response = await fetch(`https://api.yookassa.ru/v3/payments/${payment.gatewayId}`, {
  headers: { 'Authorization': authHeader },
  signal: AbortSignal.timeout(15000), // 15s timeout
});
```

**Verify**: `npx tsc --noEmit`

---

## Step 4: Add PENDING_CHECK TTL sweep to cleanup processor

**File**: `src/workers/processors/cleanup.processor.ts`

Add a new section after the `runInProgressTTLSweep()` call (after line 160). This sweeps `PENDING_CHECK` orders older than 24 hours:

```typescript
// ── 6. Orders: Stuck PENDING_CHECK TTL Sweep ────────────────────────────
try {
  await runPendingCheckTTLSweep();
} catch (pcErr: any) {
  log.error('runCleanup: runPendingCheckTTLSweep failed', { error: pcErr.message });
}
```

Add the function at the bottom of the file:

```typescript
/**
 * PENDING_CHECK TTL Sweep: Finds orders stuck in PENDING_CHECK for >24 hours.
 * These orders have charged the user's balance but never reached a provider.
 * Refunds the full amount and marks as ERROR.
 */
export async function runPendingCheckTTLSweep(): Promise<void> {
  const PENDING_CHECK_TTL_HOURS = 24;
  const threshold = new Date(Date.now() - PENDING_CHECK_TTL_HOURS * 60 * 60 * 1000);

  const stuckOrders = await db.order.findMany({
    where: {
      status: 'PENDING_CHECK',
      createdAt: { lt: threshold }
    },
    select: {
      id: true,
      numericId: true,
      userId: true,
      charge: true,
    },
    take: 100
  });

  if (stuckOrders.length === 0) return;

  const { WalletOps } = await import('@/services/financial/wallet-ops');
  const { LoyaltyService } = await import('@/services/users/loyalty.service');
  const { sendAdminAlert } = await import('@/lib/notifications');

  let processedCount = 0;

  for (const order of stuckOrders) {
    try {
      await db.$transaction(async (tx) => {
        const updated = await tx.order.updateMany({
          where: { id: order.id, status: 'PENDING_CHECK' },
          data: {
            status: 'ERROR',
            error: `Автоотмена: заказ завис в PENDING_CHECK более ${PENDING_CHECK_TTL_HOURS}ч`,
            updatedAt: new Date()
          }
        });

        if (updated.count === 0) return;

        await LoyaltyService.reverseCommission(tx, order.id);

        if (order.charge > 0) {
          const refundKey = `refund-pending-check-ttl-${order.id}`;
          const existing = await tx.ledgerEntry.findFirst({ where: { idempotencyKey: refundKey } });
          if (!existing) {
            await WalletOps.refund(
              tx,
              order.userId,
              Number(order.charge),
              `Авто-возврат: заказ #${order.numericId} завис в PENDING_CHECK`,
              { idempotencyKey: refundKey }
            );
          }
        }

        processedCount++;
      }, { isolationLevel: 'Serializable' });
    } catch (err: any) {
      log.error(`runPendingCheckTTLSweep: failed for order ${order.id}`, { error: err.message });
    }
  }

  if (processedCount > 0) {
    log.info(`PENDING_CHECK TTL sweep completed`, { processedCount });
    await sendAdminAlert(
      `⏱️ *pending-check-ttl*\nОчищено зависших PENDING_CHECK заказов: ${processedCount}`,
      'WARNING'
    );
  }
}
```

**Verify**: `npx tsc --noEmit`

---

## Step 5: Add refill status sync to sync processor

**File**: `src/workers/processors/sync.processor.ts`

Add a refill sync section at the end of the sync processor tick, after status sync and SmartFeedbackLoop:

```typescript
// Refill Status Sync: Poll provider for refill completion
try {
  const pendingRefills = await prisma.refill.findMany({
    where: { status: 'IN_PROGRESS' },
    include: {
      order: {
        include: { service: { include: { provider: true } } }
      }
    },
    take: 50
  });

  for (const refill of pendingRefills) {
    try {
      const provider = refill.order?.service?.provider;
      if (!provider || !refill.externalId) continue;

      // Import provider client dynamically
      const { SmmProviderClient } = await import('@/services/providers/smm-provider-client');
      const client = new SmmProviderClient(provider);
      const status = await client.getRefillStatus(refill.externalId);

      if (status && status !== 'IN_PROGRESS') {
        await prisma.refill.update({
          where: { id: refill.id },
          data: { status: status === 'Completed' ? 'COMPLETED' : 'ERROR' }
        });
      }
    } catch (refillErr: any) {
      console.error(`[SyncProcessor] Refill sync failed for ${refill.id}:`, refillErr.message);
    }
  }
} catch (refillGlobalErr: any) {
  console.error('[SyncProcessor] Refill sync section failed:', refillGlobalErr.message);
}
```

> ⚠️ If `SmmProviderClient` does not have a `getRefillStatus` method, check the provider API spec and add one. Some providers use `refill_status` endpoint. If unavailable, add a TODO and skip this step.

**Verify**: `npx tsc --noEmit`

---

## Step 6: Final verification

```bash
npx tsc --noEmit
npm run lint
npx vitest run
npm run build
```

All must pass.
