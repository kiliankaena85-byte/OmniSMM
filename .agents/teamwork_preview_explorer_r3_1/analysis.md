# Security & Business Logic Audit Report: Milestone M3 (R3)

**Date**: 2026-07-04  
**Auditor**: teamwork_preview_explorer  
**Milestone**: M3 (R3) - Financial Ledger, Concurrency, Rounding, Orphan Checks

---

## Executive Summary
This report documents a comprehensive security and business logic audit of the financial ledger infrastructure, concurrency handling, rounding precision, and record constraints for Milestone M3 (R3). The audit identified four major issues:
1. **False Positive Lockouts (Concurrency/Dirty Reads)** in the balance verifier.
2. **Double Rounding & Exchange Rate Drift** causing inaccurate actual costs and distorted margin delta computations.
3. **Trigger-Induced Crashes on Merges & Quarantine Modifiability** violating absolute immutability and causing runtime failures during user merging.
4. **Phantom/Orphan Ledger Entries** due to missing relational foreign key constraints between `LedgerEntry`, `Order`, and `Payment`.

---

## Detailed Findings

### 1. Concurrency & Dirty Reads: False Positive Lockouts in Balance Verifier

* **Location**: `src/utils/balance-verifier.ts` (lines 25-50)
* **Description**:
  The `verifyAllBalances` method performs a balance reconciliation by:
  1. Retrieving all active users with their current balances via `prisma.user.findMany(...)` (lines 25-37).
  2. Sequential looping through each user and aggregating the sum of approved ledger entries via `prisma.ledgerEntry.aggregate(...)` (lines 42-50).
  
  Both queries are executed outside of a database transaction, without any row-level locking (e.g. `FOR UPDATE`) or transaction isolation.
* **Vulnerability Analysis**:
  Under concurrent loads, if a user performs an action that modifies their balance and writes a ledger entry (such as completing an order or confirming a deposit payment), the balance change and ledger write occur inside a database transaction. However, the verifier will read these values non-atomically:
  * **Timeline Scenario**:
    1. Verifier reads `user.balance` = $X$ (old balance).
    2. Concurrent transaction updates `user.balance` = $X + Y$ and inserts `LedgerEntry` = $+Y$, then commits.
    3. Verifier aggregates `ledgerEntry.amount` sum = $X + Y$ (new ledger sum).
    4. Verifier calculates `discrepancy = X - (X + Y) = -Y`.
    5. Since `discrepancy !== 0`, the verifier flags a critical balance discrepancy, locks the user's account (`isActive: false`), and alerts administrators.
* **Impact**:
  High-concurrency environments will trigger false-positive lockouts for legitimate, active users, interrupting their checkout or deposit flows and raising false alarms.

---

### 2. Double Rounding & Exchange Rate Drift: Distorted Financial Reporting

* **Locations**: 
  * `src/services/financial/compensation.service.ts` (lines 53-73)
  * `src/services/marketing.service.ts` (lines 80-84)
  * `src/services/financial/accounting.service.ts` (lines 79-105)
* **Description & Math Discrepancies**:
  We identified three distinct sources of calculation distortion:
  
  #### A. Exchange Rate Drift between Checkout and Sync Time
  * When an order is placed, `MarketingService.calculatePrice` calculates the expected `providerCost` in RUB cents using the *checkout-time* USD/RUB exchange rate and snapshots it in `Order.providerCost` (BigInt).
  * When the order completes/transitions to a terminal state, `CompensationService.trackCompensation` fetches the *current* exchange rate (`usdToRub`) via `SettingsProvider.getExchangeRateUSD()` (lines 53-55) to convert the provider's USD charge into RUB cents:
    ```typescript
    actualProviderCostCents = Math.round(parsedCharge * usdToRub * 100);
    ```
  * Since the exchange rate fluctuates between checkout and sync time (which may happen hours or days later), `actualProviderCost` is calculated using a drifted rate. This invalidates the margin equation:
    $$\text{realMarginDelta} = \text{order.providerCost} - \text{totalRefundedCents} - \text{actualProviderCost}$$
    resulting in false delta reports and distorted profitability metrics.

  #### B. Rounding Mode Mismatches (Ceil vs. Round)
  * At checkout, unit cost calculations round **upwards** to prevent selling at a loss:
    ```typescript
    providerCostCents = Math.ceil((providerCostPer1000Cents / 1000) * quantity)
    ```
  * At sync/compensation time, actual cost calculations round to the **nearest integer**:
    ```typescript
    actualProviderCostCents = Math.round(parsedCharge * usdToRub * 100)
    ```
  * This mathematical inconsistency guarantees a 1-cent mismatch for unit rate divisions (e.g., checkout `Math.ceil(76.5) = 77` vs. sync `Math.round(76.5) = 76`), propagating a false 1-cent margin delta distortion.

  #### C. Inaccurate COGS Calculation in Analytics Dashboard
  * `AccountingService.getMetrics` calculates COGS by executing a SQL query that proportionalizes the expected `providerCost` (estimated at checkout) based on quantity remains:
    ```sql
    ROUND(CAST("quantity" - "remains" AS NUMERIC) / "quantity" * "providerCost")
    ```
  * It completely ignores the actual cost charged by the provider (`actualProviderCost`), even when it is stored on the completed order. This distorts the gross margin, net profits, and USN tax reporting visible on the admin dashboard.

---

### 3. Ledger Immutability: Merge Crashes & Quarantine Vulnerability

* **Locations**: 
  * `src/actions/support/ticket.ts` (line 424)
  * `src/bot/index.ts` (line 122)
  * `src/services/admin/escrow.service.ts` (lines 250-253)
  * `prisma/migrations/20260521092000_update_ledger_trigger_for_quarantine/migration.sql`
* **Vulnerability Analysis**:
  #### A. Database-Level Trigger Mismatch (Merge Crashes)
  The database trigger `no_update_delete_ledger` (before update or delete) is intended to protect the ledger's immutability:
  ```sql
  CREATE OR REPLACE FUNCTION block_ledger_mutation()
  RETURNS TRIGGER AS $$
  BEGIN
    IF (TG_OP = 'UPDATE' AND OLD.status = 'QUARANTINE') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Financial Ledger is immutable. UPDATE and DELETE actions are strictly forbidden.';
  END;
  $$ LANGUAGE plpgsql;
  ```
  However, the application attempts to update the `userId` of existing ledger entries when merging a Telegram stub into a web user account:
  * In `ticket.ts` (manual admin bind):
    ```typescript
    await tx.ledgerEntry.updateMany({ where: { userId: tempUser.id }, data: { userId: webUser.id } });
    ```
  * In `index.ts` (automatic bot bind):
    ```typescript
    await tx.ledgerEntry.updateMany({ where: { userId: tempUser.id }, data: { userId: webUserId } });
    ```
  Because the updated ledger entries have `status = 'APPROVED'` (not `QUARANTINE`), the database trigger will unconditionally block this update and raise an exception. The transaction is aborted and the merge fails completely.

  #### B. Quarantine Bypass Vulnerability
  If a ledger entry is in `QUARANTINE` status, the trigger allows **any** field modification because it checks only the old status and immediately returns `NEW`:
  ```sql
  IF (TG_OP = 'UPDATE' AND OLD.status = 'QUARANTINE') THEN
    RETURN NEW;
  END IF;
  ```
  This permits a malicious actor or buggy routine to modify critical fields (such as `amount`, `userId`, or `transactionType`) on a quarantined entry before it gets approved, bypassing the immutability controls of the ledger.

---

### 4. Phantom Entries: Orphaned Ledger Entries

* **Locations**: 
  * `prisma/schema.prisma` (models `LedgerEntry`, `Payment`, `Order`)
* **Vulnerability Analysis**:
  * There are no database-level foreign key relations linking `LedgerEntry` to `Order` or `Payment` models.
  * The mapping between ledger records and corresponding payment or order events is implicit, maintained textually inside string fields like `idempotencyKey` (e.g. `gateway-charge-${order.id}`) and `reason`.
  * Because there are no schema relations, deleting an `Order` or `Payment` will succeed (since there is no `Restrict` constraint on the DB level).
  * However, since `LedgerEntry` has a trigger that strictly prevents `DELETE` operations, its associated audit logs cannot be deleted and are left behind.
* **Impact**:
  Deleting an order or payment results in **phantom/orphan ledger entries** pointing to non-existent entity IDs. While this keeps the ledger audit logs from being erased, the lack of explicit schema structure makes tracing and auditing highly complex, leaving dangling, untracked records in the database.

---

## Recommendations and Proposed Fixes

### Fix 1: Concurrency Safe Balance Verifier
Wrap `verifyAllBalances` in a single transaction using `Repeatable Read` or `Serializable` isolation level, or obtain a lock on the user rows being reconciled to prevent concurrent writes from interleaving between the user balance read and the ledger aggregation.

### Fix 2: Math and Rate Precision Locking
* **Snap-shot Exchange Rate**: Add a `usdToRub` exchange rate snapshot field on the `Order` model. Store the rate active at checkout. Use this saved rate in `trackCompensation` to compute `actualProviderCost` in RUB cents.
* **Unify Rounding Mode**: Align rounding modes between checkout cost calculations and compensation sync calculations (e.g., use `Math.ceil` for both, or standardise on integer math limits).
* **Use Actual Costs in Dashboard**: Update `AccountingService.getMetrics` to use `COALESCE(o.actualProviderCost, ROUND(...))` so that completed/partial orders report actual expenses instead of estimated checkout costs.

### Fix 3: Secure User Merging and Ledger Immutability
* **Correct Merging Pattern**: Instead of updating the `userId` field of historical ledger entries (which breaks the audit trail), record transfer entries in the ledger (e.g. debit the old user, credit the new user) to balance user balances while preserving historical logs.
* **Restrict Quarantine Updates**: Modify the database trigger to only allow updates to the `status` field when the old status is `QUARANTINE`, blocking changes to `amount`, `userId`, or other immutable columns:
  ```sql
  IF (TG_OP = 'UPDATE' AND OLD.status = 'QUARANTINE') THEN
    IF (NEW.userId != OLD.userId OR NEW.amount != OLD.amount OR NEW.idempotencyKey != OLD.idempotencyKey) THEN
      RAISE EXCEPTION 'Cannot modify financial data on quarantined ledger entries.';
    END IF;
    RETURN NEW;
  END IF;
  ```

### Fix 4: Schema-Level References
Introduce explicit, optional foreign key fields (such as `orderId` and `paymentId`) in the `LedgerEntry` model in `schema.prisma` with `onDelete: SetNull` or `onDelete: Restrict` rules, maintaining structural integrity and eliminating text-parsing dependencies.
