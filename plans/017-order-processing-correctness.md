# Plan 017: Order Processing Correctness

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise.
>
> **Drift check (run first)**: `git diff --stat HEAD -- src/workers/processors/dripfeed.processor.ts src/services/financial/accounting.service.ts src/actions/admin/orders.ts src/workers/processors/quality-detector.processor.ts src/workers/processors/catalog.processor.ts`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED — COGS refactor touches financial reports
- **Depends on**: none
- **Category**: bug + perf
- **Planned at**: deep audit round 2, 2026-06-11

## Why this matters

1. **SmartCampaign completion without OCC or refund (DEEP-018, MED)**: `checkAndCompleteCampaign` in `dripfeed.processor.ts` updates the parent order status via bare `prisma.order.update` without an optimistic concurrency check. If the sync processor simultaneously updates, last writer wins. Additionally, when `finalStatus === 'ERROR'`, no refund is issued.

2. **COGS loads all orders into memory (DEEP-020, MED)**: `accounting.service.ts` fetches ALL non-pending orders via `findMany` with no pagination. At scale (100k+ orders), this causes OOM crashes and connection pool exhaustion on the admin finance dashboard.

3. **forceComplete resets remains=0 with partial refund (DEEP-021, LOW)**: `forceCompleteOrderAction` calculates a partial refund based on `order.remains` but then sets `remains: 0`, making it appear fully delivered. This corrupts accounting service metrics.

4. **QualityDetector snapshot unbounded growth (WORKER-017, MED)**: Each scan spreads ALL previous snapshot members plus new ones into a growing array stored in JSON. For campaigns with 100 tasks × 1000 subscribers, the final snapshot is ~1.6MB.

5. **Nightly catalog sync skips postSyncRules (WORKER-021, LOW-MED)**: Admin-triggered sync calls `applyPostSyncRules()` after catalog sync, but the nightly cron does not. Blacklisted/misclassified services reappear overnight.

## Current state

- `dripfeed.processor.ts:30-37` — bare `prisma.order.update` without WHERE status guard
- `accounting.service.ts:77-92` — `findMany` loading all orders into memory for COGS
- `admin/orders.ts:178-186` — `remains: 0` after partial refund
- `quality-detector.processor.ts:76` — `[...previousMembers, ...newMembers]` spreading
- `catalog.processor.ts:41-47` — missing `applyPostSyncRules()` call

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`       | exit 0              |
| Tests     | `npx vitest run`         | all pass            |
| Lint      | `npm run lint`           | exit 0              |
| Build     | `npm run build`          | exit 0              |

## Scope

**In scope**:
- `src/workers/processors/dripfeed.processor.ts`
- `src/services/financial/accounting.service.ts`
- `src/actions/admin/orders.ts`
- `src/workers/processors/quality-detector.processor.ts`
- `src/workers/processors/catalog.processor.ts`

**Out of scope**:
- SmartFeedbackLoop wiring (Plan 016)
- Queue separation (Plan 018)

## STOP conditions

- If `accounting.service.ts` already uses SQL aggregation for COGS
- If `dripfeed.processor.ts` already uses `updateMany` with status guard

---

## Step 1: Add OCC guard + refund to dripfeed `checkAndCompleteCampaign`

**File**: `src/workers/processors/dripfeed.processor.ts`

Replace the bare `prisma.order.update` with a transactional `updateMany` pattern:

```typescript
// Before (bare update):
// await prisma.order.update({ where: { id: parentOrderId }, data: { status: finalStatus } });

// After (OCC + refund):
await prisma.$transaction(async (tx) => {
  const updated = await tx.order.updateMany({
    where: { id: parentOrderId, status: 'IN_PROGRESS' },
    data: { status: finalStatus, updatedAt: new Date() }
  });

  if (updated.count === 0) return; // Status already changed by sync processor

  // Handle refund for ERROR campaigns
  if (finalStatus === 'ERROR') {
    const order = await tx.order.findUnique({
      where: { id: parentOrderId },
      select: { userId: true, charge: true, numericId: true }
    });
    
    if (order && order.charge > 0) {
      const { WalletOps } = await import('@/services/financial/wallet-ops');
      const refundKey = `refund-dripfeed-error-${parentOrderId}`;
      const existing = await tx.ledgerEntry.findFirst({ where: { idempotencyKey: refundKey } });
      if (!existing) {
        await WalletOps.refund(tx, order.userId, Number(order.charge),
          `Авто-возврат: SmartCampaign #${order.numericId} завершилась с ошибкой`,
          { idempotencyKey: refundKey }
        );
      }
    }
  }

  // Handle commission
  const { LoyaltyService } = await import('@/services/users/loyalty.service');
  if (finalStatus === 'COMPLETED') {
    await LoyaltyService.confirmCommission(tx, parentOrderId);
  } else {
    await LoyaltyService.reverseCommission(tx, parentOrderId);
  }
}, { isolationLevel: 'Serializable' });
```

**Verify**: `npx tsc --noEmit`

---

## Step 2: Replace COGS in-memory calculation with SQL aggregation

**File**: `src/services/financial/accounting.service.ts`

Replace the `findMany` + JS iteration for COGS with raw SQL:

```typescript
// Before:
// const orders = await db.order.findMany({ where: ... });
// let cogs = 0;
// for (const order of orders) { cogs += ...; }

// After:
const cogsResult = await db.$queryRaw<[{ total: bigint }]>`
  SELECT COALESCE(SUM(
    CASE
      WHEN quantity > 0 AND remains >= 0
      THEN ROUND(CAST((quantity - remains) AS DECIMAL) / quantity * "providerCost")
      ELSE "providerCost"
    END
  ), 0) as total
  FROM "Order"
  WHERE status NOT IN ('AWAITING_PAYMENT', 'PENDING', 'ERROR', 'PENDING_CHECK')
  ${dateFilter ? Prisma.sql`AND "createdAt" >= ${dateFilter.start} AND "createdAt" < ${dateFilter.end}` : Prisma.empty}
`;
const cogs = Number(cogsResult[0]?.total ?? 0);
```

> ⚠️ Adapt the SQL to match the exact COGS formula currently used in the JS loop. Verify by comparing output for a small date range before replacing.

**Verify**: `npx tsc --noEmit`

---

## Step 3: Don't reset `remains` on force-complete with partial refund

**File**: `src/actions/admin/orders.ts`

Find the `forceCompleteOrderAction` function. Change:
```typescript
// Before:
data: { status: 'COMPLETED', remains: 0 }
```
```typescript
// After — keep original remains for accounting accuracy:
data: { status: 'COMPLETED' }
```

Only remove the `remains: 0` line. The `remains` field should reflect actual undelivered quantity for accurate P&L reporting.

**Verify**: `npx tsc --noEmit`

---

## Step 4: Cap QualityDetector snapshot to rolling window

**File**: `src/workers/processors/quality-detector.processor.ts`

Find the line where members are accumulated (around line 76):
```typescript
// Before:
const totalMembers = [...previousMembers, ...newMembers];
```

Replace with a capped rolling window:
```typescript
const MAX_SNAPSHOT_MEMBERS = 5000;
const combined = [...previousMembers, ...newMembers];
// Keep only the latest entries to prevent unbounded growth
const totalMembers = combined.length > MAX_SNAPSHOT_MEMBERS
  ? combined.slice(combined.length - MAX_SNAPSHOT_MEMBERS)
  : combined;
```

**Verify**: `npx tsc --noEmit`

---

## Step 5: Add `applyPostSyncRules()` to nightly catalog sync

**File**: `src/workers/processors/catalog.processor.ts`

Find the `SYNC_PROVIDER_CATALOG` and `SYNC_ALL_CATALOGS` cases. After the sync operation completes, add:

```typescript
// Apply blacklists, reclassification, and maxQty caps
try {
  const { applyPostSyncRules } = await import('@/actions/admin/providers/sync-action');
  await applyPostSyncRules();
} catch (postSyncErr: any) {
  console.error('[CatalogProcessor] applyPostSyncRules failed:', postSyncErr.message);
}
```

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
