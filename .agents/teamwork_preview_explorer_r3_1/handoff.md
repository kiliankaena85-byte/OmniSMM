# Handoff Report: Milestone M3 (R3) Audit

## 1. Observation
We reviewed the source code and database configurations for Milestone M3 (R3). The following verbatim implementation points were observed:
* **Balance Verification Concurrency**:
  In `src/utils/balance-verifier.ts`, the verifier checks user balances against ledger sums by calling two independent, non-transactional database requests:
  * Line 25: `const users = await prisma.user.findMany({ ... })`
  * Line 42: `const aggregateResult = await prisma.ledgerEntry.aggregate({ ... })`
  If a discrepancy is found, it updates the user status:
  * Line 63: `await tx.user.update({ where: { id: user.id }, data: { isActive: false ... } })`
* **Exchange Rate Drift & Rounding**:
  In `src/services/financial/compensation.service.ts`, `trackCompensation` calculates actual provider costs using the current exchange rate:
  * Line 53-55:
    ```typescript
    const usdToRub = await SettingsProvider.getExchangeRateUSD();
    actualProviderCostCents = Math.round(parsedCharge * usdToRub * 100);
    ```
  * Line 95: `const realMarginDelta = order.providerCost - totalRefundedCents - actualProviderCost;`
  In `src/services/marketing.service.ts`, `calculatePrice` calculates expected provider cost using the checkout rate and `Math.ceil`:
  * Line 80-84:
    ```typescript
    const providerCostPer1000Cents = service.rate * serviceExchangeRate * 100;
    const providerCostCents = quantity > 0
      ? Math.max(1, Math.ceil((providerCostPer1000Cents / 1000) * quantity))
      : Math.ceil((providerCostPer1000Cents / 1000) * quantity);
    ```
  In `src/services/financial/accounting.service.ts`, `getMetrics` ignores `actualProviderCost` and calculates COGS proportionally:
  * Line 79-90:
    ```sql
    SELECT SUM(
      CASE
        WHEN "quantity" > 0
        THEN ROUND(CAST("quantity" - "remains" AS NUMERIC) / "quantity" * "providerCost")
        ELSE 0
      END
    ) as total
    ```
* **Ledger Immutability & Merge Logic**:
  In `prisma/migrations/20260521092000_update_ledger_trigger_for_quarantine/migration.sql`, the trigger blocks updates/deletions unless status is quarantined:
  * Line 5-8:
    ```sql
    IF (TG_OP = 'UPDATE' AND OLD.status = 'QUARANTINE') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Financial Ledger is immutable. UPDATE and DELETE actions are strictly forbidden.';
    ```
  In `src/actions/support/ticket.ts` (line 424) and `src/bot/index.ts` (line 122), user merging executes updates on approved ledger entries:
  * `await tx.ledgerEntry.updateMany({ where: { userId: tempUser.id }, data: { userId: webUser.id } });`
* **Phantom Entries**:
  In `prisma/schema.prisma`, `LedgerEntry` model lacks `orderId` or `paymentId` relations.

---

## 2. Logic Chain
1. **Concurrency Risk**: Because the verifier queries `findMany(User)` and `aggregate(LedgerEntry)` sequentially without database transaction isolation or locking, any concurrent update committing in between will create a temporary inconsistency. The verifier will incorrectly record a discrepancy and set `isActive = false`, locking the user out.
2. **Double Rounding & Drift**:
   * Expected costs use checkout exchange rates and `Math.ceil`. Actual costs use sync-time exchange rate and `Math.round`. 
   * Exchange rate fluctuation directly distorts `realMarginDelta` when subtracting actual costs from expected costs. 
   * Mismatched rounding methods generate spurious 1-cent discrepancies. 
   * COGS reporting completely bypasses actual costs, skewing tax and financial analytics.
3. **Merge Crash & Trigger Bypass**:
   * Any `UPDATE` query on approved ledger entries triggers the exception `'Financial Ledger is immutable...'`. The user merge transaction will therefore crash if the Telegram user has any ledger history.
   * Conversely, because the trigger returns `NEW` immediately if status is `QUARANTINE`, it allows any field on quarantined ledger entries to be modified, creating an audit vulnerability.
4. **Phantom Entries**:
   * The absence of direct database relations allows orders and payments to be deleted. Because the ledger entries cannot be deleted, they are left behind as orphan records, preventing proper audit tracing.

---

## 3. Caveats
No caveats. All findings are derived directly from the active code base and database migrations.

---

## 4. Conclusion
Milestone M3 (R3) features security and logic discrepancies in balance verifications, currency calculations, ledger trigger rules, and relationship definitions. Fixing these requires transactional reads in the balance verifier, exchange rate snapshotting at checkout, transfer entries for user merging instead of in-place updates, and adding explicit foreign keys.

---

## 5. Verification Method
1. **Inspect Balance Verifier**: Open `src/utils/balance-verifier.ts` and confirm lines 25-50 query the database outside of a transaction or lock.
2. **Inspect Compensation Logic**: Open `src/services/financial/compensation.service.ts` and verify that `SettingsProvider.getExchangeRateUSD()` is fetched dynamically at line 53, and math uses `Math.round` while checkout uses `Math.ceil`.
3. **Inspect Merge Logic vs Trigger**: Open `src/actions/support/ticket.ts` line 424 and `prisma/migrations/20260521092000_update_ledger_trigger_for_quarantine/migration.sql` line 8. Verify that the update on approved ledger entries will trigger the SQL exception.
4. **Inspect Schema Relations**: Open `prisma/schema.prisma` and verify model `LedgerEntry` does not define `orderId` or `paymentId` foreign keys.
