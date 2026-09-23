# Handoff Report: Compensation Loss Function Investigation

## 1. Observation
- In `src/workers/processors/sync.processor.ts`:
  - Line 116-119:
    ```typescript
    await db.$transaction(async (tx) => {
      const updated = await tx.order.update({ where: { id: order.id }, data: { status: 'PARTIAL', remains: totalRemainsText } });
      await RefundPolicyService.processRefund({ ...updated, charge: Number(updated.charge) }, undefined, tx);
    });
    ```
  - Lines 158-161:
    ```typescript
    await db.$transaction(async (tx) => {
      const updated = await tx.order.update({ where: { id: order.id }, data: { status: 'CANCELED', remains: parsedRemains } });
      await RefundPolicyService.processRefund({ ...updated, charge: Number(updated.charge) }, '(Отмена на стороне провайдера)', tx);
    });
    ```
  - Lines 169-172:
    ```typescript
    await db.$transaction(async (tx) => {
      const updated = await tx.order.update({ where: { id: order.id }, data: { status: 'PARTIAL', remains: parsedRemains } });
      await RefundPolicyService.processRefund({ ...updated, charge: Number(updated.charge) }, undefined, tx);
    });
    ```
- In `src/services/financial/refund-policy.service.ts`:
  - Lines 42-50:
    ```typescript
    if (refundCents > 0) {
      // Generates a unique deduplication key for this refund operation
      const idempotencyKey = `refund_${order.id}_${order.status}`;
      if (txClient === db) {
        return await WalletService.refund(order.userId, refundCents, reason, idempotencyKey);
      } else {
        return await WalletOps.refund(txClient, order.userId, refundCents, reason, { idempotencyKey });
      }
    }
    ```
- In `prisma/schema.prisma`:
  - Line 283: `charge            BigInt // price paid by user in Cents`
  - Line 284: `providerCost      BigInt // exact cost from provider in Cents`
  - Line 642: `transactionType String   @default("PAYMENT") // PAYMENT | REFUND | REROUTE | COMPENSATION`
- In `src/services/providers/base-provider.ts`:
  - Line 29: `charge: string;` in `ProviderOrderStatusDto` interface, which represents the provider's actual cost for the order.

---

## 2. Logic Chain
1. When an order completes or is partial/canceled, `sync.processor.ts` writes the final status (`COMPLETED`, `PARTIAL`, `CANCELED`, `ERROR`) and initiates a user refund through `RefundPolicyService.processRefund`.
2. Any refunds generated create `LedgerEntry` records starting with `refund_${order.id}_` in their idempotency key.
3. Therefore, querying these ledger entries allows us to compute the exact `retainedCustomerRevenue` = `order.charge - sum(refunds)`.
4. The provider status response contains `charge` (the actual provider fee in provider currency, e.g. USD). By parsing this and multiplying by the active USD/RUB exchange rate, we get `actualProviderCost`.
5. If the `charge` is missing/zero or the status is `CANCELED`/`ERROR`, we fall back to proportional calculations: $0$ for canceled/error, and a proportional fraction for partial/completed orders.
6. The difference between `retainedCustomerRevenue` and `actualProviderCost` represents the `realMargin`. Comparing this with the initial `expectedMargin` (`charge - providerCost`) yields the `marginDelta`.
7. Logging and persisting these metrics on the `Order` model will ensure clean accounting.

---

## 3. Caveats
- Direct provider API charge reporting depends on the provider API returning the `charge` field in the status check. While standard for modern SMM panels, the proportional fallback is mandatory to handle edge cases or legacy providers.
- The exchange rate used to convert provider charges from USD is resolved using `SettingsProvider.getExchangeRateUSD()`. This fetches the current rate. If exchange rates fluctuate heavily, storing the exchange rate at order creation/execution time would yield even more precise numbers.

---

## 4. Conclusion
- Designed `CompensationService` (`src/services/financial/compensation.service.ts`) with a dual-mode calculation logic (direct API parsing + proportional mathematical fallback).
- Proposed extending the `Order` database model with fields `realMargin`, `actualProviderCost`, and `marginDelta` to store the calculated outputs.
- Planned the integration into `sync.processor.ts` as a BullMQ asynchronous job (`compensation-queue`) at terminal status checkpoints, preventing performance bottlenecks in status synchronization.

---

## 5. Verification Method
- **Verification Commands**:
  - Run the test suite: `npm run test` or `npx vitest run test/unit/refund-policy.test.ts`.
- **Inspection Files**:
  - Inspect `src/services/financial/compensation.service.ts` (upon implementation) and check unit tests.
  - Check `prisma/schema.prisma` for the proposed schema extensions.
