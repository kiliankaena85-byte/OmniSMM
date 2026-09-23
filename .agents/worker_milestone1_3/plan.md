# Implementation Plan - Compensation Loss Function Final Updates

## 1. Objectives
- Update the ledger query in `src/services/financial/compensation.service.ts` to capture refund keys ending with `-${order.id}`.
- Asynchronously call `CompensationService.trackCompensation` in `forceCompleteOrderAction` and `bulkCancelOrdersAction` inside `src/actions/admin/orders.ts`.
- Asynchronously call `CompensationService.trackCompensation` in `runInProgressTTLSweep` and `runPendingCheckTTLSweep` in `src/workers/processors/cleanup.processor.ts`.
- Add a unit test to `src/services/financial/compensation.service.challenge.test.ts` to assert that refund keys ending with `-${order.id}` are successfully queried and summed.
- Verify typescript compilation, eslint linting, and vitest unit tests pass.

## 2. Steps

### Step 2.1: Update `src/services/financial/compensation.service.ts`
- Edit lines 79-86:
  ```typescript
  const refunds = await db.ledgerEntry.findMany({
    where: {
      OR: [
        { idempotencyKey: { startsWith: `refund_${order.id}_` } },
        { idempotencyKey: { endsWith: `_order_${order.id}` } },
        { idempotencyKey: { endsWith: `-${order.id}` } }
      ]
    }
  });
  ```

### Step 2.2: Update `src/actions/admin/orders.ts`
- Verification of imports: `CompensationService` is already imported at line 23.
- In `forceCompleteOrderAction` (after `auditAdminAwaitable`):
  ```typescript
  CompensationService.trackCompensation(orderId).catch(err => console.error('[Orders] Failed to track compensation', err));
  ```
- In `bulkCancelOrdersAction` (inside the loop, inside the try-catch block, immediately after a successful transaction):
  ```typescript
  CompensationService.trackCompensation(order.id).catch(err => console.error('[Orders] Failed to track compensation', err));
  ```

### Step 2.3: Update `src/workers/processors/cleanup.processor.ts`
- Add static import at the top of the file:
  ```typescript
  import { CompensationService } from '@/services/financial/compensation.service';
  ```
- In `runInProgressTTLSweep` (inside the loop, immediately after the successful `db.$transaction` block):
  ```typescript
  CompensationService.trackCompensation(order.id).catch(err => log.error('Failed to track compensation on TTL sweep', { orderId: order.id, error: err.message }));
  ```
- In `runPendingCheckTTLSweep` (inside the loop, immediately after the successful `db.$transaction` block):
  ```typescript
  CompensationService.trackCompensation(order.id).catch(err => log.error('Failed to track compensation on pending check TTL sweep', { orderId: order.id, error: err.message }));
  ```

### Step 2.4: Update Unit Tests in `src/services/financial/compensation.service.challenge.test.ts`
- Add a new unit test matching the requirements, e.g.:
  ```typescript
  it('should query ledger entries matching refund keys ending with -${order.id}', async () => { ... });
  ```
- Also update `should query ledger entries matching ticket refunds (endsWith _order_${order.id})` or others if needed to reflect the new `OR` query criteria.

### Step 2.5: Run Verification Command Loop
- Run `npx tsc --noEmit`
- Run `npm run lint`
- Run `npx vitest run src/services/financial/compensation.service.challenge.test.ts`

## 3. Double-Pass Review & Pre-Mortem Risk Matrix

| Risk / Failure Scenario | Mitigation Mechanism |
|---|---|
| A webhook or manual action updates order status concurrently with `runInProgressTTLSweep` or `runPendingCheckTTLSweep`, leading to multiple updates or out-of-order execution. | Optimistic locking on order status checks inside transaction. Even if double-tracked, `trackCompensation` is idempotent as it recalculates the current state in a read-only way and updates. |
| DB query timeout or connection issue on `trackCompensation` crashes background workers. | The `catch` blocks log the error and don't rethrow or block processing of subsequent entries. |
| `BigInt` arithmetic overflows or matches incorrect ledger entries. | Correct ledger filters prevent capturing unrelated refund keys, and `BigInt` operations are safe. |

## 4. Verification Methods
- Terminal command `npx tsc --noEmit` to confirm TypeScript compiles without errors.
- Terminal command `npm run lint` to confirm ESLint completes without warnings/errors.
- Terminal command `npx vitest run` to run all tests.
