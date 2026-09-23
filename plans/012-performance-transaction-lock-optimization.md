# Plan 012: Performance & Transaction Lock Optimization

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat be97815..HEAD -- src/services/core/rate-limit.service.ts src/lib/settings.ts src/services/financial/payment.service.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `be97815`, 2026-06-11

## Why this matters

1. **Hot-Path Rate Limiter Lock**: When Redis is down or not configured, the rate limiter falls back to Postgres and deletes expired records on *every rate limit hit*. Under heavy traffic or DDoS, this causes extensive database lock contention.
2. **Background Settings Upsert Overhead**: When global settings are accessed in background processes (like BullMQ workers) where Next.js `unstable_cache` is not available, the helper catches an invariant exception and runs a database `upsert` query on *every settings read*.
3. **Sequential Row Locking during Checkout**: During basket checkout (which is a deposit-driven 1:N payment confirmation), the system charges each order individually inside the transaction. This results in $O(N)$ sequential database updates on the user's balance, locking the user row repeatedly and causing deadlocks or transaction timeouts under concurrent load.

## Current state

- Relevant files:
  - [rate-limit.service.ts](file:///d:/SMM_plan_2/src/services/core/rate-limit.service.ts) — contains rate limiting logic and its PG fallback deletes (lines 64–67 and 164–167)
  - [settings.ts](file:///d:/SMM_plan_2/src/lib/settings.ts) — global settings provider, cached vs uncached modes (lines 90–114)
  - [payment.service.ts](file:///d:/SMM_plan_2/src/services/financial/payment.service.ts) — basket payment confirmation loops (lines 176–181 and 318–323)
  - [cleanup.processor.ts](file:///d:/SMM_plan_2/src/workers/processors/cleanup.processor.ts) — background cleaner worker, runs `rateLimit.deleteMany` (line 41)

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `npm install`            | exit 0              |
| Typecheck | `npx tsc --noEmit`       | exit 0, no errors   |
| Tests     | `npx vitest run test/`   | all pass            |
| Lint      | `npm run lint`           | exit 0              |

## Scope

**In scope**:
- `src/services/core/rate-limit.service.ts`
- `src/lib/settings.ts`
- `src/services/financial/payment.service.ts`

**Out of scope**:
- Modifying `src/workers/processors/cleanup.processor.ts` (the worker already handles rate-limit cleanup).

---

## Steps

### Step 1: Remove Redundant expired cleanups from Rate Limiter
In `src/services/core/rate-limit.service.ts`, remove the redundant `deleteMany` fallback cleanups in both `check` and `checkCustomKey` methods, since they are already periodically processed in the background by `cleanup.processor.ts:41`.

```diff
-      // 2. Fallback to Postgres (if Redis is down or not configured)
-      db.rateLimit.deleteMany({
-        where: { expiresAt: { lte: now } }
-      // eslint-disable-next-line @typescript-eslint/no-explicit-any
-      }).catch((e: any) => console.error("RateLimit cleanup error:", e));
```

### Step 2: Implement Settings Memory Caching Fallback in SettingsProvider
In `src/lib/settings.ts`, implement a static memory cache variable that caches the settings for 1 minute when `unstable_cache` is not available. Replace the redundant upserts with a `findUnique` query and write-once upsert initialization.

1. Declare a memory cache block at the top of the file:
```typescript
let localSettingsCache: { data: SystemSettings; expiresAt: number } | null = null;
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache for workers
```
2. Modify `SettingsProvider.get()` method:
```typescript
  static async get(): Promise<SystemSettings> {
    try {
      if (SettingsProvider.isTestEnvironment()) {
        const fresh = await db.systemSettings.findUnique({ where: { id: "global" } });
        if (fresh) return fresh;
        return await db.systemSettings.upsert({
          where: { id: "global" },
          update: {},
          create: { id: "global", taxRate: 6, opexMonthly: 0, maintenanceMode: false, isTestMode: true, siteName: "SMMplan", exchangeRateUSD: 95 }
        });
      }
      try {
        return await this.getCached();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        if (err.message?.includes('incrementalCache') || err.message?.includes('Invariant')) {
          // Check local memory cache first
          const now = Date.now();
          if (localSettingsCache && localSettingsCache.expiresAt > now) {
            return localSettingsCache.data;
          }

          // Fallback to read-only DB query first
          let settings = await db.systemSettings.findUnique({ where: { id: "global" } });
          if (!settings) {
            settings = await db.systemSettings.upsert({
              where: { id: "global" },
              update: {},
              create: { id: "global", taxRate: 6, opexMonthly: 0, maintenanceMode: false, isTestMode: SettingsProvider.isTestEnvironment(), siteName: "SMMplan", exchangeRateUSD: 95 }
            });
          }

          localSettingsCache = { data: settings, expiresAt: now + CACHE_TTL_MS };
          return settings;
        }
        throw err;
      }
```

Verify Step 2:
- Run `npx tsc --noEmit` and check that compilation passes.

### Step 3: Batch Balance Deductions & Ledger Entries during Checkout
Optimize `confirmPayment` and `confirmPaymentById` inside `src/services/financial/payment.service.ts` to perform a single batch balance update on the user record and write all ledger entries in bulk.

1. Modify `confirmPayment` (around lines 176–181) for the basket orders block:
```typescript
            // Credit full paid amount first
            await WalletOps.credit(tx, userId, amount,
              `Оплата корзины заказов через шлюз`,
              { idempotencyKey: `gateway-credit-${processedPaymentId}` }
            );

            // Batch deduct total charge and log ledger entries
            const totalChargeCents = basketOrders.reduce((sum, order) => sum + Number(order.charge), 0);
            
            const updatedUserBatch = await tx.user.updateMany({
              where: {
                id: userId,
                balance: { gte: totalChargeCents }
              },
              data: {
                balance: { decrement: totalChargeCents },
                totalSpent: { increment: totalChargeCents }
              }
            });
            if (updatedUserBatch.count === 0) {
              throw new Error('INSUFFICIENT_FUNDS: Недостаточно средств для оплаты корзины');
            }

            const ledgerData = basketOrders.map(order => ({
              userId,
              amount: -Number(order.charge),
              reason: `Списание за заказ #${order.numericId ?? order.id}`,
              status: 'APPROVED' as const,
              idempotencyKey: `gateway-charge-${order.id}`
            }));
            await tx.ledgerEntry.createMany({ data: ledgerData });
```

2. Perform the exact same batch optimization for `confirmPaymentById` (around lines 318–323) inside `src/services/financial/payment.service.ts`:
```typescript
            // Credit full paid amount first
            await WalletOps.credit(tx, payment.userId, Number(payment.amount),
              `Оплата корзины заказов через шлюз`,
              { idempotencyKey: `gateway-credit-${paymentId}` }
            );

            // Batch deduct total charge and log ledger entries
            const totalChargeCents = basketOrders.reduce((sum, order) => sum + Number(order.charge), 0);
            
            const updatedUserBatch = await tx.user.updateMany({
              where: {
                id: payment.userId,
                balance: { gte: totalChargeCents }
              },
              data: {
                balance: { decrement: totalChargeCents },
                totalSpent: { increment: totalChargeCents }
              }
            });
            if (updatedUserBatch.count === 0) {
              throw new Error('INSUFFICIENT_FUNDS: Недостаточно средств для оплаты корзины');
            }

            const ledgerData = basketOrders.map(order => ({
              userId: payment.userId,
              amount: -Number(order.charge),
              reason: `Списание за заказ #${order.numericId ?? order.id}`,
              status: 'APPROVED' as const,
              idempotencyKey: `gateway-charge-${order.id}`
            }));
            await tx.ledgerEntry.createMany({ data: ledgerData });
```

## STOP conditions

- If `vitest` unit tests fail due to transaction mocking or balance assertions, stop and review.
- If compile errors are found, stop and report.
