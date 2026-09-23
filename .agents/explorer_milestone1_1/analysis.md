# Analysis — Milestone 1 (Plan 023): Compensation Loss Function

## 1. Examination of `src/workers/processors/sync.processor.ts`

`sync.processor.ts` handles the massive status synchronization of active orders from providers. It runs concurrently for all active providers in batches of 500 orders.

### Current Flow & Terminal States
1. **Fetch Active Orders**: Orders with status `IN_PROGRESS` are queried from the database.
2. **Provider API Status Request**: External status is retrieved via the provider client's `getMultiOrderStatus` or `getOrderStatus`.
3. **Status Categorization & Updates**:
   - For standard (single) orders:
     - **CANCELED**: Order status is updated to `CANCELED`, and `RefundPolicyService.processRefund` is called inside a database transaction to refund 100% of the customer's charge (minus any prior partial refunds).
     - **PARTIAL**: Order status is updated to `PARTIAL`, and `RefundPolicyService.processRefund` is called inside a database transaction to refund the proportional amount of remains.
     - **COMPLETED**: Order status is updated to `COMPLETED`, remains set to `0`, and a completion email is sent.
     - **ERROR**: If the provider returns an error (e.g. incorrect order ID or age > 72 hours), the order is marked `ERROR` and a full refund is processed.
   - For Drip-Feed orders:
     - **COMPLETED**: All runs are verified completed.
     - **PARTIAL**: If any run was canceled, the main order is marked `PARTIAL` and a proportional refund is executed.

### Provider Charge Capture
The status response from the provider is represented by `ProviderOrderStatusDto`:
```typescript
export interface ProviderOrderStatusDto {
  order: string;
  status: string; // 'pending' | 'processing' | 'in progress' | 'completed' | 'partial' | 'canceled' | 'error'
  charge: string; // The actual amount charged by the provider (in provider's currency, e.g. USD)
  start_count: string;
  remains: string;
  error?: string;
}
```
In the current implementation of `sync.processor.ts`, the `charge` returned from the provider is **completely ignored**. The database `providerCost` column is never updated with this actual charge, meaning that financial calculations in the admin dashboard have to estimate COGS using:
`ROUND(CAST("quantity" - "remains" AS NUMERIC) / "quantity" * "providerCost")`

---

## 2. Analysis of Database Models in `prisma/schema.prisma`

### Related Models

1. **`Order`**:
   - `charge`: Paid by customer in RUB cents (`BigInt`).
   - `providerCost`: Expected cost from provider in RUB cents (`BigInt`) snapshot at checkout.
   - `remains`, `quantity`: Used to determine partial refund ratios.
   - `status`: Lifecycle indicator (`OrderStatus` enum).

2. **`LedgerEntry`**:
   - `amount`: Signed integer in cents representing balance changes (positive for credits/refunds, negative for charges/debits).
   - `idempotencyKey`: Unique indicator. Refunds write with key format `refund_${order.id}_${status}`.
   - `transactionType`: Defaults to `PAYMENT` or other types.

3. **`Provider`**:
   - `balanceCurrency`: Currency of the provider (default: `USD`).

4. **`Service`**:
   - `providerCurrency`: Currency of the service (default: `USD`). Used to interpret the provider's charge.

### Proposed Schema Hardening
To store the exact provider charges and avoid computing estimations in the accounting service, we propose adding the following fields to the `Order` model:
```prisma
model Order {
  // Existing fields ...
  actualProviderCost BigInt? // The actual cost charged by the provider in RUB cents
  realMarginDelta    BigInt? // The real margin delta in RUB cents (Real Margin - Expected Margin)
}
```

---

## 3. Structure & Design of `CompensationService`

We design `CompensationService` (`src/services/financial/compensation.service.ts`) to calculate:
1. **Actual Provider Cost (RUB Cents)**: Converts the provider's API charge string (in USD/RUB) into RUB cents using the exchange rate at the time of sync.
2. **Retained Customer Revenue (RUB Cents)**: Customer payment minus any automated refunds.
3. **Real Margin Delta (RUB Cents)**:
   - `Expected Margin = charge - providerCost`
   - `Real Margin = Retained Revenue - Actual Provider Cost`
   - `Real Margin Delta = Real Margin - Expected Margin`
   - *Simplified:* `Real Margin Delta = providerCost - totalRefundedCents - actualProviderCost`

### Implementation Design
```typescript
import { db } from '@/lib/db';
import { SettingsProvider } from '@/lib/settings';
import { calculatePartialRefund } from '@/utils/refund';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'CompensationService' });

export class CompensationService {
  /**
   * Computes the actual provider cost, retained customer revenue, and real margin delta
   * for a terminal order and updates the order record.
   */
  static async trackCompensation(orderId: string, providerChargeStr?: string | null): Promise<void> {
    try {
      const order = await db.order.findUnique({
        where: { id: orderId },
        include: { service: true }
      });

      if (!order) {
        log.warn(`Order ${orderId} not found for compensation tracking.`);
        return;
      }

      // 1. Enforce terminal statuses
      const TERMINAL_STATUSES = ['COMPLETED', 'PARTIAL', 'CANCELED', 'ERROR'];
      if (!TERMINAL_STATUSES.includes(order.status)) {
        return;
      }

      // 2. Parse provider charge & convert to RUB Cents
      let actualProviderCostCents = 0;
      
      if (providerChargeStr && !isNaN(parseFloat(providerChargeStr))) {
        const parsedCharge = parseFloat(providerChargeStr);
        const providerCurrency = order.service?.providerCurrency || 'USD';
        
        if (providerCurrency === 'RUB') {
          actualProviderCostCents = Math.round(parsedCharge * 100);
        } else {
          const usdExchangeRate = await SettingsProvider.getExchangeRateUSD();
          actualProviderCostCents = Math.round(parsedCharge * usdExchangeRate * 100);
        }
      } else {
        // Fallback: Proportional expected cost estimation
        if (order.status === 'COMPLETED') {
          actualProviderCostCents = Number(order.providerCost);
        } else if (order.status === 'PARTIAL' && order.quantity > 0) {
          const deliveredQty = order.quantity - order.remains;
          actualProviderCostCents = Math.round((deliveredQty / order.quantity) * Number(order.providerCost));
        } else {
          actualProviderCostCents = 0;
        }
      }

      // 3. Compute total refunded cents from committed ledger entries
      const refundLedgers = await db.ledgerEntry.findMany({
        where: {
          idempotencyKey: {
            in: [
              `refund_${orderId}_PARTIAL`,
              `refund_${orderId}_CANCELED`,
              `refund_${orderId}_ERROR`
            ]
          }
        }
      });
      const totalRefundedCents = refundLedgers.reduce((sum, entry) => sum + Number(entry.amount), 0);

      // 4. Calculate real margin delta
      const providerCostVal = Number(order.providerCost);
      const realMarginDeltaCents = providerCostVal - totalRefundedCents - actualProviderCostCents;

      // 5. Save results to Database
      await db.order.update({
        where: { id: orderId },
        data: {
          actualProviderCost: BigInt(actualProviderCostCents),
          realMarginDelta: BigInt(realMarginDeltaCents)
        }
      });

      log.info(`Margin compensation tracked for Order ${orderId}`, {
        status: order.status,
        charge: Number(order.charge),
        actualProviderCost: actualProviderCostCents,
        totalRefunded: totalRefundedCents,
        realMarginDelta: realMarginDeltaCents
      });
    } catch (error: any) {
      log.error(`Error in trackCompensation for Order ${orderId}: ${error.message}`);
    }
  }
}
```

---

## 4. Asynchronous Integration Plan into `sync.processor.ts`

To keep status synchronization highly performant and non-blocking, the compensation service must run asynchronously without delaying the main sync loop.

### Integration Code Insertion Points
In `src/workers/processors/sync.processor.ts`:

1. **For single standard orders**:
   Immediately after the database transactions that finalize the order status and issue refunds:
   - **CANCELED / PARTIAL / ERROR**:
     ```typescript
     // Inside syncProcessor:
     await db.$transaction(async (tx) => {
       const updated = await tx.order.update({ ... });
       await RefundPolicyService.processRefund(..., tx);
     });
     
     // Asynchronously trigger compensation tracking
     CompensationService.trackCompensation(order.id, s.charge).catch(err => {
       log.error('Failed to run CompensationService', { orderId: order.id, error: err });
     });
     ```
   - **COMPLETED**:
     ```typescript
     await db.order.update({ where: { id: order.id }, data: { status: 'COMPLETED', remains: 0 } });
     
     // Asynchronously trigger compensation tracking
     CompensationService.trackCompensation(order.id, s.charge).catch(err => {
       log.error('Failed to run CompensationService', { orderId: order.id, error: err });
     });
     ```

2. **For Drip-Feed orders**:
   - **COMPLETED**:
     ```typescript
     await db.order.update({ where: { id: order.id }, data: { status: 'COMPLETED', remains: 0 } });
     
     // Sum Drip charges and trigger
     const totalDripCharge = order.dripExternalIds.reduce((sum, extId) => {
       const s = statuses[extId];
       return sum + (s && typeof s !== 'string' && s.charge ? parseFloat(s.charge) : 0);
     }, 0);
     CompensationService.trackCompensation(order.id, totalDripCharge.toString()).catch(err => {
       log.error('Failed to run CompensationService for Drip-Feed', { orderId: order.id, error: err });
     });
     ```
   - **PARTIAL**:
     ```typescript
     await db.$transaction(async (tx) => {
       const updated = await tx.order.update({ ... });
       await RefundPolicyService.processRefund(..., tx);
     });
     
     // Sum Drip charges and trigger
     const totalDripCharge = order.dripExternalIds.reduce((sum, extId) => {
       const s = statuses[extId];
       return sum + (s && typeof s !== 'string' && s.charge ? parseFloat(s.charge) : 0);
     }, 0);
     CompensationService.trackCompensation(order.id, totalDripCharge.toString()).catch(err => {
       log.error('Failed to run CompensationService for Drip-Feed', { orderId: order.id, error: err });
     });
     ```

### Error Isolation and Worker Safety
By invoking `CompensationService.trackCompensation` without `await` and chaining `.catch()`, we guarantee:
1. **Non-blocking execution**: The sync processor moves immediately to the next order in the chunk without waiting for DB writes or exchange rate calls.
2. **Error isolation**: Any database connection drop or conversion logic bug within the compensation tracker will be caught in the `.catch` block and logged, keeping the main sync thread running.
