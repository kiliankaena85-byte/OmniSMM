# Handoff Report: Review of Milestone 1 (Plan 023) - Compensation Loss Function

This handoff contains the technical review, findings, and adversarial analysis of the Compensation Loss Function implementation.

---

## 1. Observation

During our independent investigation of the codebase, the following exact paths, code segments, and outputs were verified:

1. **New Compensation Service**:
   File: `src/services/financial/compensation.service.ts` (lines 79-93)
   ```typescript
      // Query ledger entries starting with refund_${order.id}_ to find all refunds related to the order and sum them
      const refunds = await db.ledgerEntry.findMany({
        where: {
          idempotencyKey: {
            startsWith: `refund_${order.id}_`
          }
        }
      });

      let totalRefundedCents = BigInt(0);
      for (const refund of refunds) {
        totalRefundedCents += refund.amount;
      }

      // Calculate realMarginDelta = order.providerCost - totalRefundedCents - actualProviderCost
      const realMarginDelta = order.providerCost - totalRefundedCents - actualProviderCost;
   ```

2. **Integration in Sync Processor**:
   File: `src/workers/processors/sync.processor.ts` (lines 181-185)
   ```typescript
          else if (['COMPLETED'].includes(providerStatus)) {
            await db.order.update({ where: { id: order.id }, data: { status: 'COMPLETED', remains: 0 } });
            sendOrderCompletedMail(order.user.email, order.numericId.toString(), order.service.name).catch(err => log.error('Failed to send completion email', { cause: err }));
            CompensationService.trackCompensation(order.id, s.charge).catch(err => log.error('Failed to track compensation on COMPLETED order', { cause: err }));
          }
   ```

3. **Webhook Callback Flow**:
   File: `src/app/api/webhooks/provider/route.ts` (lines 116-122)
   ```typescript
       } else if (['COMPLETED'].includes(providerStatus)) {
         await db.order.update({ where: { id: order.id }, data: { status: 'COMPLETED', remains: 0 } });
         sendOrderCompletedMail(order.user.email, order.numericId.toString(), order.service.name).catch(console.error);
         
       } else {
   ```
   *No compensation tracking is integrated here for webhooks.*

4. **Fail-Fast & DLQ Sweep Flow**:
   File: `src/services/core/order.service.ts` (lines 427-434)
   ```typescript
           // 1. Atomically change order status to CANCELED
           await tx.order.update({
             where: { id: order.id },
             data: {
               status: 'CANCELED',
               error: `Fail-Fast: ${reason}`,
               updatedAt: new Date()
             }
           });
   ```
   *No compensation tracking is integrated in `failOrderTerminalFast` or `failOrderTerminal`.*

5. **Manual Status Override Flow**:
   File: `src/actions/admin/orders.ts` (lines 128-135)
   ```typescript
         await tx.order.update({
           where: { id: validatedOrderId },
           data: {
             status: newStatus,
             remains: newRemains,
             ...(newStatus === 'COMPLETED' ? { remains: 0 } : {}),
           },
         });
   ```
   *No compensation tracking is integrated in manual setOrderStatusAction.*

6. **Test Commands and Execution**:
   - Command: `npx vitest run src/services/financial/compensation.service`
     Result: `14 passed (14)` (Duration: 38.67s)
   - Command: `npx vitest run src/workers/processors/__tests__/sync.processor`
     Result: `3 passed (3)` (Duration: 13.42s)

---

## 2. Logic Chain

1. **Compensation Tracking Bypass via Webhooks**:
   - **Observation 3** shows that the webhook processor (`src/app/api/webhooks/provider/route.ts`) updates standard order statuses directly to `COMPLETED`, `CANCELED`, or `PARTIAL` when provider signals are received.
   - It **does not** call `CompensationService.trackCompensation(...)`.
   - The massive status sync processor (`sync.processor.ts`) only queries orders where `status: 'IN_PROGRESS'`.
   - Therefore, any order finalized through a provider webhook will bypass compensation tracking entirely. Their `actualProviderCost` and `realMarginDelta` columns in the database will remain `null` forever.

2. **Compensation Tracking Bypass via Fail-Fast / DLQ Sweeps**:
   - **Observation 4** shows that orders which fail during enqueueing or timing out after 15 minutes in `PENDING` are finalized as `CANCELED` or `ERROR` via `failOrderTerminalFast` or `failOrderTerminal` in `src/services/core/order.service.ts`.
   - Neither of these terminal routines invokes `CompensationService.trackCompensation(...)`.
   - Consequently, these orders bypass tracking, and their financial columns are never updated.

3. **Compensation Tracking Bypass via Manual Admin Intervention**:
   - **Observation 5** shows that when an administrator manually updates an order status or forces cancel/completed from the dashboard, `setOrderStatusAction` updates the database status and processes refunds but does not trigger `trackCompensation`.
   - Thus, manual adjustments also bypass the margin correction.

---

## 3. Caveats

- **Exchange Rate Drift**: `SettingsProvider.getExchangeRateUSD()` is called during synchronization rather than order checkout. While this represents the actual cost in RUB at the time we are charged, currency exchange rate fluctuations between checkout and completion can cause discrepancy in `realMarginDelta`.
- **Unsupported Currencies**: The service assumes that any currency other than `'USD'` is `'RUB'`, treating non-USD charges as face value times 100. This is a design compromise for simple multi-currency mapping.

---

## 4. Conclusion

The implementation of `CompensationService` is mathematically correct and well-tested under standard mocked sync loops. However, the overall integration is **incomplete**. Significant execution paths (webhooks, fail-fast, DLQ sweeps, manual overrides) update order status without calling the tracking service, leading to data holes (where `actualProviderCost` and `realMarginDelta` remain `null`). 

**Verdict**: **REQUEST_CHANGES** due to major coverage and integration gaps.

---

## 5. Verification Method

To independently verify the test executions and review findings:
1. Run all compensation unit and adversarial tests:
   ```bash
   npx vitest run src/services/financial/compensation.service
   ```
2. Run sync processor integration tests:
   ```bash
   npx vitest run src/workers/processors/__tests__/sync.processor
   ```
3. Inspect database schema for columns `actualProviderCost` and `realMarginDelta` on the `Order` model in `prisma/schema.prisma`.
4. Inspect missing calls in webhook callback `src/app/api/webhooks/provider/route.ts`, order service terminal failure methods in `src/services/core/order.service.ts`, and manual admin action in `src/actions/admin/orders.ts`.

---

# Quality Review Report

## Review Summary

**Verdict**: **REQUEST_CHANGES**

## Findings

### [Major] Finding 1: Webhook Integration Bypass
- **What**: Webhook callbacks that transition orders to terminal states bypass the compensation calculation.
- **Where**: `src/app/api/webhooks/provider/route.ts` (lines 105-122)
- **Why**: Orders processed by webhook callbacks are marked as `CANCELED`, `PARTIAL`, or `COMPLETED` directly. Because they are no longer `IN_PROGRESS`, they are skipped by the massive status sync cron, leaving their `actualProviderCost` and `realMarginDelta` set to `null` permanently.
- **Suggestion**: Add asynchronous, fire-and-forget calls to `CompensationService.trackCompensation` in `route.ts` similar to `sync.processor.ts`.

### [Major] Finding 2: Fail-Fast & DLQ Sweep Bypass
- **What**: Order failures from timeout sweeps (15m in PENDING) or fail-fast terminations bypass tracking.
- **Where**: `src/services/core/order.service.ts` in `failOrderTerminal()` and `failOrderTerminalFast()`.
- **Why**: These routines transition orders directly to terminal states (`CANCELED` or `ERROR`) without triggering `CompensationService.trackCompensation(...)`.
- **Suggestion**: Call `CompensationService.trackCompensation(orderId)` asynchronously at the end of these routines.

### [Major] Finding 3: Manual Status Change Bypass
- **What**: Manual status updates by admins in the support panel bypass compensation tracking.
- **Where**: `src/actions/admin/orders.ts` in `setOrderStatusAction()`.
- **Why**: Order statuses are updated directly inside a database transaction but the compensation metrics are never recalculated.
- **Suggestion**: Call `CompensationService.trackCompensation(orderId)` asynchronously outside the transaction after a successful manual status transition.

## Verified Claims

- **Correctness of Real Margin Delta Formula** → verified via mathematical trace and unit tests → **PASS**
- **Type-safety of Compensation Service BigInt conversions** → verified via `npx tsc --noEmit` → **PASS**
- **Asynchronous Calling Safety in Sync Processor** → verified via test executions and code inspection → **PASS**

## Coverage Gaps

- **Webhook Route** — risk level: **High** — recommendation: **Investigate and Fix** (essential for production where provider webhooks are used).
- **Core Order Service failures** — risk level: **Medium** — recommendation: **Investigate and Fix**.
- **Admin Manual Status Actions** — risk level: **Medium** — recommendation: **Investigate and Fix**.

---

# Adversarial Review Report

## Challenge Summary

**Overall risk assessment**: **HIGH**

## Challenges

### [High] Challenge 1: Permanent Data Inconsistency
- **Assumption challenged**: Status sync is the exclusive pathway for final order state transitions.
- **Attack scenario**: High volume of orders are finalized via webhook pushes (standard behavior). The massive status sync processor does not query them because they are no longer in `IN_PROGRESS` state.
- **Blast radius**: The financial reports and dashboard widgets will show `null` or missing values for `actualProviderCost` and `realMarginDelta` on a large percentage of orders.
- **Mitigation**: Standardize terminal state transition hook triggers or invoke `trackCompensation` on all transition handlers.

### [Medium] Challenge 2: Scientific Notation in Charges
- **Assumption challenged**: Provider API charges are standard decimal strings.
- **Attack scenario**: Provider returns charge in scientific notation (e.g. `'1.5e-4'`).
- **Blast radius**: If the service failed to parse, it would fall back to estimated costs. However, our stress tests in `compensation.service.challenge.test.ts` (Case B) confirmed parseFloat correctly parses scientific notation (`'1.5e-1'` parsed to `0.15`), mitigating this risk.
- **Mitigation**: Already handled by Javascript's native `parseFloat`.

## Stress Test Results

- **Negative Charge String Input** → Parsed as negative value (`BigInt(-500)`) and subtracted correctly → **PASS**
- **Invalid Charge Input** → Falls back to proportional estimation gracefully without throwing → **PASS**
- **Remains > Quantity** → Completed quantity guarded via `Math.max(0, quantity - remains)` resolving to 0 → **PASS**
- **Quantity = 0** → Division by zero guarded and falls back to 0 actual cost → **PASS**

## Unchallenged Areas

- **CBR Settings Provider Integration**: We did not challenge the actual CBR synchronization mechanism for exchange rates as it was mocked in the scope of this review.
