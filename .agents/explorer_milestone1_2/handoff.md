# Handoff Report — Compensation Loss Function

This handoff report summarizes the read-only investigation on the **Compensation Loss Function (Milestone 1, Plan 023)**.

---

## 1. Observation
- **Sync Processor Updates**: `src/workers/processors/sync.processor.ts` finalizes order updates and initiates transactions for refunds using `RefundPolicyService.processRefund` in lines 116-119, 131-134, 146-149, 158-161, and 169-172:
  ```typescript
  await db.$transaction(async (tx) => {
    const updated = await tx.order.update({ where: { id: order.id }, data: { status: 'PARTIAL', remains: parsedRemains } });
    await RefundPolicyService.processRefund({ ...updated, charge: Number(updated.charge) }, undefined, tx);
  });
  ```
- **Refund Record Pattern**: In `src/services/financial/refund-policy.service.ts` line 44, the idempotency key for user refunds is structured using the order ID:
  ```typescript
  const idempotencyKey = `refund_${order.id}_${order.status}`;
  ```
- **Database Models**: In `prisma/schema.prisma`, the `Order` model contains `charge` and `providerCost` as `BigInt` (cents in RUB). The `LedgerEntry` model represents wallet adjustments, and the `AnalyticsEvent` model contains structured JSON metadata:
  ```prisma
  model AnalyticsEvent {
    id        String   @id @default(cuid())
    event     String
    metadata  Json?
    createdAt DateTime @default(now())
  }
  ```
- **Provider Status API Charge**: SMM provider status updates return the charge value, represented in `ProviderOrderStatusDto` in `src/services/providers/base-provider.ts` line 29:
  ```typescript
  export interface ProviderOrderStatusDto {
    order: string;
    status: string;
    charge: string; // The USD/RUB cost billed by provider
    start_count: string;
    remains: string;
    error?: string;
  }
  ```

---

## 2. Logic Chain
- To compute the real margin delta, we must compare the expected margin at checkout with the actual margin after finalization:
  - $\text{OriginalMargin} = \text{charge} - \text{providerCost}$
  - $\text{RealMargin} = \text{RetainedCustomerRevenue} - \text{ProviderActualCost}$
  - $\text{MarginDelta} = \text{RealMargin} - \text{OriginalMargin}$
- Customer refunds are stored in the database as successful `LedgerEntry` records where `idempotencyKey` starts with `refund_${order.id}_` (Observation 2). We can query these records to accurately compute the total refunds issued (Logic Step 1).
- The provider's actual cost can be calculated in two ways (Observation 4):
  1. From the provider status response `charge` (converted from USD to RUB using `SettingsProvider.getExchangeRateUSD()`).
  2. If missing or $0$, fall back to a proportional completed quantity calculation:
     $$\text{Actual Provider Cost} = \left\lceil \frac{\text{quantity} - \text{remains}}{\text{quantity}} \times \text{order.providerCost} \right\rceil$$ (Logic Step 2).
- The margin delta is the difference: `RealMargin - OriginalMargin` (Logic Step 3).
- This calculation should run immediately after the order status update and refund transactions have committed (Observation 1, Logic Step 4).
- To keep the status polling loop performant, the calculation should be invoked asynchronously (e.g. fire-and-forget or via a background worker) to prevent blocking database waits inside the main loop (Logic Step 5).

---

## 3. Caveats
- **Exchange Rate Fluctuations**: The USD/RUB rate might change slightly between checkout and sync time. We assume that using the current `SettingsProvider.getExchangeRateUSD()` is a valid approximation for calculation.
- **Provider API Reliability**: Some SMM panels do not return a valid `charge` parameter (reporting `"0.00"` or omitting it). The service design includes a proportional fallback math calculation to protect against schema drift or incomplete API responses.

---

## 4. Conclusion
- Designing a `CompensationService` in `src/services/financial/compensation.service.ts` that queries `LedgerEntry` for refunds and calculates actual cost using a hybrid (provider-reported + proportional completed quantity) formula is highly accurate and robust.
- The service should be invoked asynchronously (fire-and-forget) in `sync.processor.ts` when orders reach `COMPLETED`, `PARTIAL`, `CANCELED`, or `ERROR` states.

---

## 5. Verification Method
- **Verification Commands**: Once implemented, verify code consistency using:
  ```powershell
  npx tsc --noEmit
  ```
- **Unit Testing**: Implement a test suite in `test/unit/compensation.test.ts` (using Vitest) that mocks database entries and verifies:
  1. Correct refund sum calculation from `LedgerEntry`.
  2. Correct conversion of USD provider charges to RUB cents.
  3. Correct fallback to proportional cost if `charge` is empty or $0$.
  4. Proper creation of `AnalyticsEvent` with event name `'ORDER_MARGIN_DELTA'` and matching calculations.
- **Run the test suite**:
  ```powershell
  npx vitest run test/unit/compensation.test.ts
  ```

---

## 6. Remaining Work (For Implementing Agent)
1. Create the `CompensationService` file at `src/services/financial/compensation.service.ts` using the designed structure.
2. Integrate `CompensationService.trackOrderMarginDelta(order.id, s?.charge ? parseFloat(s.charge) : undefined)` in `src/workers/processors/sync.processor.ts` at the final status transition handlers (non-blocking fire-and-forget).
3. Create the test file `test/unit/compensation.test.ts` and run tests to verify implementation correctness.
