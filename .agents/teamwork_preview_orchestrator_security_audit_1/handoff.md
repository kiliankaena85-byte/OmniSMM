# Handoff & Security Audit Report

## Part 1: Orchestrator Handoff (State Dump)

### Milestone State
- **M1: Audit R1 (Promo codes, UTM, referral logic & fraud)**: **DONE**
- **M2: Audit R2 (BullMQ workers, order lifecycle, concurrency)**: **DONE**
- **M3: Audit R3 (Financial Ledger, concurrency, rounding, orphan checks)**: **DONE**
- **M4: Synthesis & Final Audit Report**: **DONE**

### Active Subagents
- None (All subagents completed and retired)

### Pending Decisions
- None

### Remaining Work
- **Execution of Corrections**: A future worker or developer needs to implement the recommended fixes described in the Security Audit Report below.

### Key Artifacts
- `d:\SMM_plan_2\.agents\teamwork_preview_orchestrator_security_audit_1\progress.md` — Liveness & status tracking
- `d:\SMM_plan_2\.agents\teamwork_preview_orchestrator_security_audit_1\BRIEFING.md` — Agent state and configuration
- `d:\SMM_plan_2\.agents\teamwork_preview_orchestrator_security_audit_1\PROJECT.md` — Scope index
- `d:\SMM_plan_2\.agents\teamwork_preview_explorer_r1_1\analysis.md` — R1 detailed explorer findings
- `d:\SMM_plan_2\.agents\teamwork_preview_explorer_r2_1\analysis.md` — R2 detailed explorer findings
- `d:\SMM_plan_2\.agents\teamwork_preview_explorer_r3_1\analysis.md` — R3 detailed explorer findings

---

## Part 2: Security & Business Logic Audit Report

**Date**: 2026-07-04  
**Project**: SMMplan  
**Auditor Swarm**: Teamwork Preview Swarm  

### Defect Count Summary
*   **🔴 P0 Critical**: 2
*   **🟠 P1 High**: 4
*   **🟡 P2 Medium**: 3
*   **🟢 P3 Low / Low Confidence**: 1

---

## Domain R1: Promo Codes, UTM Campaigns, and Referrals

### [R1-001] Immediate Credit of Pending Commissions & Negative Balance Cash Out Exploit
*   **Severity**: 🔴 P0 Critical
*   **Target Files & Lines**:
    *   `src/services/core/order.service.ts` (lines 107-111)
    *   `src/actions/user/referral.action.ts` (lines 28-34)
    *   `src/services/users/loyalty.service.ts` (lines 75-85)
*   **Description**:
    When a customer places and pays for an order, the referral commission is generated as `PENDING` (which is correct), but the system immediately credits the commission amount (`LoyaltyService.awardCommission`) to the referrer's `referralBalance`.
    The referrer can immediately call the `transferReferralBalanceAction` to move these funds to their main balance and spend them on orders or withdraw them before the original order is completed.
    If the order later fails, is canceled, or is refunded, the system tries to reverse the commission by decrementing `referralBalance`. If the referrer has already transferred and spent the commission, their `referralBalance` drops below zero (e.g. `-500` rubles). The user retains the transferred/spent main balance, resulting in a direct financial loss to the platform.
*   **Reproduction Scenario**:
    1. Attacker registers User A (referrer) and User B (referred).
    2. User B creates a large order of 100,000 rubles and pays.
    3. The system immediately adds the referral commission (e.g., 5,000 rubles) to User A's `referralBalance`.
    4. User A immediately transfers 5,000 rubles from `referralBalance` to their main balance and orders services or requests a payout.
    5. User B's order fails (e.g., provider reject or timeout) and gets canceled.
    6. The system cancels User B's order, refunds User B, and decrements User A's `referralBalance` by 5,000 rubles.
    7. User A's `referralBalance` is now `-5000` rubles. User A abandons the account, keeping the 5,000 rubles gain, leaving the platform with a 5,000 rubles deficit.
*   **Recommended Fix**:
    Commissions should only be credited to the user's spendable/transferable balance *after* they transition from `PENDING` to `PAID` (which occurs when the corresponding order is successfully `COMPLETED`). Do not increment `User.referralBalance` in `awardCommission`; instead, keep track of pending commissions in a separate field or relation, and only increment `referralBalance` when the commission is confirmed.

---

### [R1-002] Referral Leak on Webhook Partial updates and Manual Cancellations
*   **Severity**: 🟠 P1 High
*   **Target Files & Lines**:
    *   `src/services/core/order.service.ts` (lines 298-303)
    *   `src/services/admin/order.service.ts` (lines 262-272)
*   **Description**:
    1. In `processStatusUpdate`, if an order status is updated to `PARTIAL` (meaning the provider only delivered a portion of the order and the buyer was partially refunded), the referral commission is neither confirmed nor reversed. It remains in `PENDING` status. When payouts are processed, it is marked as `PAID` at full value.
    2. When an administrator manually cancels an order through `adminOrderService.cancelOrder` and issues a refund, `LoyaltyService.reverseCommission` is never called.
    Referrers retain 100% of their commission on partially completed or manually cancelled orders, causing a financial leak.
*   **Reproduction Scenario**:
    1. Referred user places an order. Referrer gets a pending commission.
    2. The order is partially fulfilled (e.g. 10% completed). The status sync worker updates the order to `PARTIAL`.
    3. The commission remains `PENDING`.
    4. Admin processes payouts; the pending commission is set to `PAID` and the referrer gets the full commission.
*   **Recommended Fix**:
    1. In `processStatusUpdate`, if status is `PARTIAL`, recalculate the commission proportionally based on the actual delivered amount, update the commission record, and reverse/release the refunded portion.
    2. Call `LoyaltyService.reverseCommission` in `adminOrderService.cancelOrder`.

---

### [R1-003] Permanent Lock of Promo Code Usages on Abandoned/Unpaid Checkout Orders
*   **Severity**: 🟠 P1 High
*   **Target Files & Lines**:
    *   `src/workers/processors/cleanup.processor.ts` (lines 110-127)
    *   `src/services/admin/order.service.ts` (lines 262-272)
    *   `src/actions/order/checkout.ts` (lines 480-483)
*   **Description**:
    When an order is created during checkout, the promo code's `uses` count is immediately incremented. If the payment process fails or is abandoned, the order status remains `AWAITING_PAYMENT` and is eventually auto-canceled by the cleanup worker (`cleanup.processor.ts`) or manually canceled by an admin. However, neither path decrements the promo code's `uses` counter, permanently locking the usage slot.
*   **Reproduction Scenario**:
    1. A promo code has `maxUses = 5`.
    2. A user selects YooKassa payment, applies the promo code, but closes the payment tab without paying. Order status is `AWAITING_PAYMENT`, `uses` goes to 1.
    3. The user does this 5 times.
    4. The promo code is now exhausted and cannot be used by anyone, even though no orders were actually paid/delivered.
*   **Recommended Fix**:
    Add logic to decrement the promo code's `uses` count in `cleanup.processor.ts` and `adminOrderService.cancelOrder` if the order being canceled had a promo code applied and was never paid.

---

### [R1-004] Integer Overflow on Promo Code Budget Creation
*   **Severity**: 🟡 P2 Medium
*   **Target Files & Lines**:
    *   `src/actions/admin/marketing.ts` (line 21)
    *   `prisma/schema.prisma` (line 107)
*   **Description**:
    The `budget` parameter in the promo code admin form is coerced into a number without a `.max()` validator. The value is converted to cents (`budget * 100`) and stored in a database field `budgetCents` of type `Int` (32-bit signed integer).
    If an admin enters a value of 21.5 million rubles or higher, the value in cents exceeds the maximum value of a 32-bit signed integer ($2,147,483,647$), causing a database-level integer overflow crash (Prisma P2020) and a 500 error on the admin dashboard.
*   **Reproduction Scenario**:
    1. Go to the admin dashboard -> Promo Codes -> Create Promo Code.
    2. Enter a budget of `22,000,000`.
    3. Click Submit. The app crashes with a database-level integer overflow error.
*   **Recommended Fix**:
    Add a `.max(20000000)` constraint to the `budget` field in `promoCodeSchema` in `src/actions/admin/marketing.ts`.

---

### [R1-005] Profitability Analytics Sign Defect
*   **Severity**: 🟡 P2 Medium
*   **Target Files & Lines**:
    *   `src/services/admin/analytics.service.ts` (lines 68-71)
*   **Description**:
    Delivered quantity is calculated as `deliveredQty = order.quantity - order.remains`. If a provider API sync returns a `remains` count higher than the original order `quantity`, `deliveredQty` becomes negative. This results in negative revenue and negative COGS, corrupting the aggregated profitability charts.
*   **Reproduction Scenario**:
    1. Order is created for `quantity: 1000`.
    2. Provider API returns a sync status showing `remains: 1100`.
    3. `deliveredQty` is computed as `-100`.
    4. Analytics aggregator accumulates negative revenue and COGS, distorting charts.
*   **Recommended Fix**:
    Ensure `deliveredQty` is bounded: `const deliveredQty = Math.max(0, order.quantity - order.remains);`.

---

## Domain R2: BullMQ Workers and Order Lifecycle

### [R2-001] Concurrency Race-to-Cancel Overwrites Terminal States & Triggers Duplicate Refunds
*   **Severity**: 🔴 P0 Critical
*   **Target Files & Lines**:
    *   `src/app/api/webhooks/provider/route.ts` (lines 110-134)
    *   `src/workers/processors/sync.processor.ts` (lines 161-185)
*   **Description**:
    Both the webhook handler and the status sync processor retrieve orders in `IN_PROGRESS` and perform direct database updates and call the refund service without verifying the previous status under a transaction or using optimistic locking.
    If a concurrent process (like `runInProgressTTLSweep`) completes the order or marks it as completed, the webhook handler or status sync processor will overwrite the status back to `CANCELED` and issue a full refund, even though the service was already delivered.
*   **Reproduction Scenario**:
    1. An order is `IN_PROGRESS`.
    2. The status sync worker query fetches the order.
    3. Concurrently, the order is updated to `COMPLETED` by the TTL sweep.
    4. The status sync worker receives `CANCELED` from the provider API and calls `db.order.update({ where: { id: order.id }, data: { status: 'CANCELED' } })`.
    5. The order status is changed from `COMPLETED` back to `CANCELED`, and a 100% refund is processed.
*   **Recommended Fix**:
    Add status guards to all updates in webhooks and sync processors (e.g. `where: { id: order.id, status: 'IN_PROGRESS' }`) to ensure that terminal states are never overwritten.

---

### [R2-002] Administrative Double Refund on Cancel of ERROR or PARTIAL Orders
*   **Severity**: 🟠 P1 High
*   **Target Files & Lines**:
    *   `src/services/admin/order.service.ts` (lines 240-272)
    *   `src/actions/admin/orders.ts` (line 240)
*   **Description**:
    The administrative cancel handler `cancelOrder` checks that the order is not in `COMPLETED` or `CANCELED`, but allows canceling `ERROR` or `PARTIAL` status orders.
    Since `ERROR` orders are already refunded 100% at failure time (using `refund-failfast-${order.id}`), and `PARTIAL` orders are refunded proportionally (using `refund_${order.id}_PARTIAL`), canceling them via the admin action recalculates and processes the refund again under the new key `refund_${order.id}_CANCELED`.
    Because the keys are different, the ledger credits the user's wallet again, leading to a double refund (200% for `ERROR` and extra for `PARTIAL`).
*   **Reproduction Scenario**:
    1. A user places an order of 1000 RUB. The order fails, gets marked as `ERROR`, and refunds 1000 RUB to the user.
    2. The admin goes to the admin dashboard, finds the `ERROR` order, and clicks "Cancel".
    3. The system processes the cancellation, calculates `refundCents = 1000`, and runs `WalletOps.refund` with key `refund_${order.id}_CANCELED`.
    4. The user receives another 1000 RUB refund.
*   **Recommended Fix**:
    Prevent cancellation of `ERROR` or `PARTIAL` orders in `cancelOrder` and `bulkCancelOrdersAction` by checking if the order status is in `['COMPLETED', 'CANCELED', 'ERROR', 'PARTIAL']`.

---

### [R2-003] Duplicate Order Submission via Provider API retries, DB failures, or Queue Pruning
*   **Severity**: 🟠 P1 High
*   **Target Files & Lines**:
    *   `src/services/providers/universal.provider.ts` (lines 182-197)
    *   `src/workers/processors/order.processor.ts` (lines 121-135)
    *   `src/workers/processors/cleanup.processor.ts` (lines 208-284)
*   **Description**:
    Three different issues create a risk of submitting duplicate orders to providers:
    1. **Provider request retries**: If a timeout occurs, the client automatically retries the same order creation request up to 3 times. If the provider had actually received the first attempt, this causes duplicates.
    2. **Database update failures**: If the database throws an error *after* a successful provider response but before saving `externalId`, the job is retried by BullMQ, sending the order again.
    3. **Queue Pruning**: Since BullMQ deletes completed jobs after 1 hour, the orphan sweeper will re-enqueue `PENDING` orders whose dispatch jobs were pruned, causing a duplicate submission.
*   **Reproduction Scenario**:
    1. Order dispatch job starts. It calls the provider API.
    2. Provider creates the order but takes 15 seconds to reply. Smmplan AbortError triggers.
    3. Smmplan retries the request, leading to a duplicate order at the provider.
*   **Recommended Fix**:
    1. Disable automatic retries on order creation (mutating) API requests; or configure the provider API to accept a unique reference key (idempotency token) if supported.
    2. Save order dispatch job states carefully, and ensure the orphan sweeper checks if `externalId` is already set or queries the provider API for the transaction reference before re-enqueuing.

---

### [R2-004] Lack of Concurrency Control in Support Ticket Refill Requests
*   **Severity**: 🟡 P2 Medium
*   **Target Files & Lines**:
    *   `src/actions/support/ticket.ts` (lines 498-503)
*   **Description**:
    Creating refill requests in support tickets does not check if an active (`PENDING` or `IN_PROGRESS`) refill already exists for the same order, allowing duplicate refills to be requested from the provider.
*   **Recommended Fix**:
    Check if a refill with status `PENDING` or `IN_PROGRESS` exists for the order before creating a new one.

---

## Domain R3: Financial Ledger, Balances, and Verifier

### [R3-001] False Positive Lockouts in Balance Verifier (Dirty Reads)
*   **Severity**: 🟠 P1 High
*   **Target Files & Lines**:
    *   `src/utils/balance-verifier.ts` (lines 25-50)
*   **Description**:
    The verifier queries `findMany(User)` and `aggregate(LedgerEntry)` sequentially outside of a database transaction or lock. Under concurrent loads, if a user performs a balance-modifying operation in between these two reads, the verifier will read mismatched states, flag a false-positive balance discrepancy, and lock out the user.
*   **Reproduction Scenario**:
    1. Verifier reads `user.balance` = $X$.
    2. User completes an order, updating `user.balance` = $X - Y$ and creating a `LedgerEntry` = $-Y$.
    3. Verifier aggregates `LedgerEntry` sum = $X - Y$.
    4. Verifier flags a discrepancy of $Y$ and sets `isActive = false` on the user.
*   **Recommended Fix**:
    Wrap the user balance read and the ledger aggregation inside a transaction with a strict isolation level (e.g. `Serializable` or `Repeatable Read`), or lock user rows during verification.

---

### [R3-002] Ledger Merge Crash due to Trigger Protection
*   **Severity**: 🟠 P1 High
*   **Target Files & Lines**:
    *   `src/actions/support/ticket.ts` (line 424)
    *   `src/bot/index.ts` (line 122)
    *   `prisma/migrations/20260521092000_update_ledger_trigger_for_quarantine/migration.sql`
*   **Description**:
    The database trigger `no_update_delete_ledger` blocks all updates on approved ledger entries. However, when merging a Telegram stub account into a web user account, the application attempts to update the `userId` on existing ledger entries:
    `tx.ledgerEntry.updateMany({ where: { userId: tempUser.id }, data: { userId: webUser.id } })`
    This causes the database trigger to raise an exception, aborting the transaction and making the user merge crash.
*   **Reproduction Scenario**:
    1. A Telegram user has ledger history.
    2. The user binds their Telegram account to a web account.
    3. The application tries to merge the ledger entries, triggering the exception and crashing the merge flow.
*   **Recommended Fix**:
    Instead of editing historical ledger entries (which compromises the audit log), record transfer/compensation entries in the ledger to balance the accounts.

---

### [R3-003] Ledger Quarantine Modifiability Vulnerability
*   **Severity**: 🟡 P2 Medium
*   **Target Files & Lines**:
    *   `prisma/migrations/20260521092000_update_ledger_trigger_for_quarantine/migration.sql` (lines 5-8)
*   **Description**:
    The trigger allows any update on a ledger entry if its old status is `QUARANTINE`. This allows malicious actors or code bugs to modify critical financial fields (`amount`, `userId`, `transactionType`) on a quarantined entry before approval.
*   **Recommended Fix**:
    Modify the trigger to only allow updating the `status` field when the old status is `QUARANTINE`.

---

### [R3-004] Orphaned/Phantom Ledger Entries (Missing Foreign Key Relations)
*   **Severity**: 🟢 P3 Low / Low Confidence
*   **Target Files & Lines**:
    *   `prisma/schema.prisma` (model `LedgerEntry`)
*   **Description**:
    The `LedgerEntry` model lacks explicit database-level foreign key relations linking it to `Order` or `Payment` models. If an order or payment is deleted, the ledger entries remain behind as orphans, pointing to non-existent IDs. While this preserves the ledger logs, the lack of structural integrity makes audit tracing complex.
*   **Recommended Fix**:
    Add explicit optional foreign keys (`orderId`, `paymentId`) to the `LedgerEntry` model with `onDelete: Restrict`.

---

## Part 3: Conclusion & Next Steps

All milestones (M1 to M4) of the security and business logic audit are completed. The audit has successfully identified critical issues including concurrency races, double refund vulnerabilities, financial cash-out exploits, and ledger mutability triggers.

To ensure the security and robustness of the production application, it is highly recommended to prioritize implementing the fixes for the **P0** and **P1** vulnerabilities identified in this report.
