# Milestone 1 (Plan 023) Review & Adversarial Challenge Report

## 1. Observation

- **File under review (new)**: `src/services/financial/compensation.service.ts`
- **File under review (modified)**: `src/workers/processors/sync.processor.ts`
- **Related test files**:
  - `src/services/financial/compensation.service.test.ts`
  - `src/workers/processors/__tests__/sync.processor.test.ts`
- **Execution findings**:
  - Typecheck: Completed with exit code 0 (no TypeScript compile errors).
  - ESLint: Completed with exit code 0 (no lint errors).
  - Target tests: All unit/integration tests for the modified modules pass successfully (9/9 passed).
  - Full test suite: Completed with Vitest failures due to database setup/truncation concurrency race conditions in tests running in parallel (unrelated to the changes under review).
- **Core Logic in `compensation.service.ts`**:
  - `realMarginDelta = order.providerCost - totalRefundedCents - actualProviderCost` (simplified from `(order.charge - totalRefundedCents - actualProviderCost) - (order.charge - order.providerCost)`).
  - USD/RUB conversion: uses `SettingsProvider.getExchangeRateUSD()` when `order.service.providerCurrency === 'USD'`.
  - Ledger sum: queries ledger entries where `idempotencyKey` starts with `refund_${order.id}_`.
  - Fallback calculation: proportional cost based on `remains` and `quantity` for `PARTIAL` status, and full `providerCost` for `COMPLETED`.

## 2. Logic Chain

1. The mathematical definition of the compensation loss is implemented as `realMarginDelta`. We simplified the algebraic expression representing `Actual Margin - Expected Margin`, verifying that it is equivalent to the code's `order.providerCost - totalRefundedCents - actualProviderCost`.
2. The fallback logic handles missing provider charge values by checking `status`. For `PARTIAL` orders, it uses `completedQty = Math.max(0, quantity - remains)`. It checks `quantity > 0` before division to prevent division-by-zero crashes.
3. In `sync.processor.ts`, the asynchronous calling pattern uses `.catch(...)` on each invocation of `CompensationService.trackCompensation(...)`. This ensures that errors are isolated, preventing any failure in the compensation calculations from aborting the main status synchronization worker.

## 3. Caveats

- We assumed that the parallel test failures in the full test suite (specifically deadlocks and unique constraint errors on table truncation) are caused by Vitest concurrent runner database conflicts, which is supported by the trace log showing different test threads executing setup concurrently on the same database.
- We did not modify the implementation code to resolve the identified findings, as we are in a review-only role.

## 4. Conclusion & Verdict

**Verdict**: **REQUEST_CHANGES** (due to missing tracking on manual admin/ticket actions and incorrect ledger query matching for support tickets).

### Major Findings:

1. **Missing Support Ticket Refunds in Ledger Query**:
   - **What**: The ledger query in `CompensationService.trackCompensation` (lines 79–85) looks for `idempotencyKey` starting with `refund_${order.id}_`.
   - **Where**: `src/services/financial/compensation.service.ts:79`
   - **Why**: Support ticket refunds in `src/actions/support/ticket.ts` (line 580) write ledger entries with `idempotencyKey = refund_ticket_${ticketId}_order_${item.order.id}`. Because this key starts with `refund_ticket_`, it is missed by the query. This results in `totalRefundedCents` being evaluated as 0 for support-refunded orders, making the `realMarginDelta` calculation incorrect.
   - **Suggestion**: Update the query filter to match both formats, e.g. using an `OR` condition:
     ```typescript
     where: {
       OR: [
         { idempotencyKey: { startsWith: `refund_${order.id}_` } },
         { idempotencyKey: { endsWith: `_order_${order.id}` } }
       ]
     }
     ```

2. **No Tracking for Manual Admin & Ticket Transitions**:
   - **What**: `trackCompensation` is only called from the background `sync.processor.ts`.
   - **Where**: `src/actions/admin/orders.ts`, `src/services/admin/order.service.ts`, `src/actions/support/ticket.ts`
   - **Why**: When an admin manually cancels an order, overrides its status, or issues a refund through a support ticket, the order transitions to a terminal state (`CANCELED`, `PARTIAL`, `COMPLETED`, `ERROR`), but `trackCompensation` is never triggered. This results in empty `actualProviderCost` and `realMarginDelta` fields (remaining `null`) for manually processed orders.
   - **Suggestion**: Ensure `trackCompensation` is called after manual status updates in `src/actions/admin/orders.ts`, `src/services/admin/order.service.ts`, and `src/actions/support/ticket.ts`.

### Minor Findings:
- **Mock Oversight in Tests**: In `src/workers/processors/__tests__/sync.processor.test.ts`, the database mock lacks the `refill` table/delegate. This causes the refill status sync section to throw a `Cannot read properties of undefined (reading 'findMany')` error during tests (although it is caught and does not fail the test).

---

## 5. Quality Review

### Verified Claims
- **Claim**: The `trackCompensation` formula correctly tracks real margin delta.
  - **Method**: Verified algebraically.
  - **Result**: **PASS**.
- **Claim**: USD conversion is performed dynamically using Settings.
  - **Method**: Verified code and unit tests.
  - **Result**: **PASS**.
- **Claim**: Error isolation is enforced in sync processor.
  - **Method**: Inspected `.catch` wrappers on all invocations.
  - **Result**: **PASS**.

### Coverage Gaps
- **Admin actions coverage**: Admin status overrides and cancellations do not trigger compensation updates. (Risk level: **Medium** - recommendation: call `trackCompensation` in admin services).
- **Ticket refunds coverage**: Ticket refunds ledger entries are ignored by the compensation service query. (Risk level: **High** - recommendation: expand query filter).

---

## 6. Adversarial Challenge

**Overall risk assessment**: **MEDIUM**

### Challenges

#### Challenge 1: Ignored Support Refunds (Underestimated Deficit)
- **Assumption challenged**: The ledger entry idempotency key prefix `refund_${order.id}_` matches all order refunds.
- **Attack scenario**: An operator refunds a partially failed order via a support ticket. The ledger record is created with `refund_ticket_...`. Later, the order sync runs or compensation is tracked. The query fails to match the refund. The calculated `realMarginDelta` thinks the company kept 100% of the customer's funds, completely ignoring the refund transaction.
- **Blast radius**: Business intelligence and financial reports show inflated margins and hide losses.
- **Mitigation**: Update the ledger query condition to include ticket-based refund keys.

#### Challenge 2: Missing Admin Cancel Cost
- **Assumption challenged**: Status sync is the sole mechanism transitioning orders to terminal states.
- **Attack scenario**: An order is stuck, and the admin cancels it manually. Since this is an admin action, `trackCompensation` is not called. The fields `actualProviderCost` and `realMarginDelta` remain `null`.
- **Blast radius**: Manual cancellations are excluded from financial auditing metrics.
- **Mitigation**: Call `CompensationService.trackCompensation` from the admin cancel/override routes.

---

## 7. Verification Method

To independently verify the target correctness:
1. Run target unit tests:
   ```powershell
   npx vitest run src/services/financial/compensation.service.test.ts src/workers/processors/__tests__/sync.processor.test.ts
   ```
2. Inspect the test output files to ensure they execute successfully.
3. Validate compilation and formatting:
   ```powershell
   npm run typecheck
   npm run lint
   ```
