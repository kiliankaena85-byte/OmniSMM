# Handoff Report — Plan 023 (Implement Compensation Loss Function)

## 1. Observation
The following locations and behaviors were observed directly in the codebase:
- **`src/workers/processors/sync.processor.ts`**:
  - Checks provider order statuses in batches and updates standard or Drip-Feed orders to terminal statuses: `COMPLETED`, `PARTIAL`, `CANCELED`, or `ERROR`.
  - For non-completed terminal states, triggers refunds via the transaction client:
    ```typescript
    // Line 116-119:
    const updated = await tx.order.update({ where: { id: order.id }, data: { status: 'PARTIAL', remains: totalRemainsText } });
    await RefundPolicyService.processRefund({ ...updated, charge: Number(updated.charge) }, undefined, tx);
    ```
    ```typescript
    // Line 158-161:
    const updated = await tx.order.update({ where: { id: order.id }, data: { status: 'CANCELED', remains: parsedRemains } });
    await RefundPolicyService.processRefund({ ...updated, charge: Number(updated.charge) }, '(Отмена на стороне провайдера)', tx);
    ```
    And similarly for `ERROR` status (lines 131-134, 146-149).
- **`prisma/schema.prisma`**:
  - The `Order` model (lines 268-327) snapshots the expected cost at checkout as `providerCost BigInt`. It currently lacks any fields to track the actual cost charged by the provider (`actualProviderCost`) or the resulting margin discrepancy (`realMarginDelta`).
  - The `LedgerEntry` model (lines 633-652) stores transactions including refunds. Refund ledger entries are written with idempotency keys matching `refund_${order.id}_${status}`.
- **`src/services/financial/accounting.service.ts`**:
  - The metrics endpoint (`getMetrics`) aggregates provider costs (COGS) proportionally using the initial snapshot `providerCost`:
    ```typescript
    // Lines 93-103:
    SELECT SUM(
      CASE
        WHEN "quantity" > 0
        THEN ROUND(CAST("quantity" - "remains" AS NUMERIC) / "quantity" * "providerCost")
        ELSE 0
      END
    ) as total
    FROM "Order"
    WHERE status NOT IN ('AWAITING_PAYMENT', 'PENDING', 'ERROR')
    ```
    This is an approximation and does not reflect actual charges or margin deltas.

## 2. Logic Chain
1. **Untracked Discrepancies**: Since provider status sync loops ignore the `charge` string returned by the provider status API (e.g. `"0.051"` USD), the platform does not record how much was actually debited by providers for fulfilled or partially-fulfilled orders.
2. **Margin Vulnerability**: Fluctuations in provider charges, cancellation/partial-run adjustments, or exchange rate changes are not reconciled, leading to incorrect profit calculation in `accounting.service.ts` and the main financial dashboard.
3. **Automated Refund Calculation**: We can query the exact refunds processed for an order by summing the ledger entries matching `refund_${order.id}_PARTIAL`, `refund_${order.id}_CANCELED`, and `refund_${order.id}_ERROR`.
4. **Margin Delta Derivation**:
   - `Expected Margin = order.charge - order.providerCost`
   - `Real Margin = (order.charge - totalRefundedCents) - actualProviderCost`
   - `Real Margin Delta = Real Margin - Expected Margin = order.providerCost - totalRefundedCents - actualProviderCost`
5. **Decoupled Architecture**: To keep the status sync processor highly performant, the calculation and DB updates must run asynchronously. Invoking it inside the loop without `await` and catching errors (e.g. `CompensationService.trackCompensation(...).catch(...)`) isolates the main loop from failures in the compensation system.

## 3. Caveats
- **Exchange Rates**: Conversion of provider charges (in provider currency, e.g. USD) to RUB Cents assumes the exchange rate at the time of sync. While this matches billing events, historical rates could technically diverge slightly if sync is delayed.
- **Manual Adjustments**: The design focuses on automated refunds. Manual support-driven adjustments linked to the order are not factored into the automated delta, but this is consistent with the scope of tracking the provider status response.

## 4. Conclusion
We must implement `CompensationService` in `src/services/financial/compensation.service.ts` and integrate it into `sync.processor.ts` asynchronously. To store these metrics cleanly and remove proportional estimations from dashboard analytics, the `Order` model should be extended with `actualProviderCost BigInt?` and `realMarginDelta BigInt?`.

## 5. Verification Method
1. **Compilation/Type Checks**: Ensure the schema compiles and TypeScript checks pass:
   ```bash
   npx prisma generate
   npx tsc --noEmit
   ```
2. **Unit Tests**: Create unit tests in `test/unit/compensation.test.ts` to mock provider status responses (with different `charge` values) and verify that:
   - `actualProviderCost` and `realMarginDelta` are calculated correctly for COMPLETED, PARTIAL, CANCELED, and ERROR orders.
   - Falling back to estimations works when provider charges are missing or invalid.
3. **Sync Integration Test**: Verify that calling the sync processor successfully triggers the asynchronous tracking without blocking or throwing unhandled rejections.
