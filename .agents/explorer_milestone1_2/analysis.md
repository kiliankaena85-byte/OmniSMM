# Analysis — Compensation Loss Function

## Executive Summary
This report analyzes the requirements and design for the **Compensation Loss Function (Milestone 1, Plan 023)**. The goal is to design a service (`CompensationService`) that calculates the real financial margin delta of SMM orders when they reach a terminal state, comparing the actual charged cost from the provider against the retained revenue from the customer (accounting for any partial or full refunds). This logic will be integrated into the status synchronization process (`sync.processor.ts`) asynchronously to ensure there are no performance impacts on the main worker event loop.

---

## 1. Analysis of `src/workers/processors/sync.processor.ts`
The sync processor is a background worker executed via BullMQ that polls SMM providers for order status updates. 
Key findings from the file:
- **Scope**: It queries up to 1,000 active orders per provider (status `IN_PROGRESS`) in batches of 500, enqueuing them via a multi-status API.
- **Terminal State Transitions**: Orders transition to terminal statuses (`COMPLETED`, `PARTIAL`, `CANCELED`, `ERROR`) inside the processor.
- **Refund Integration**: When an order transitions to `PARTIAL`, `CANCELED`, or `ERROR`, the processor initiates a transaction to update the status and immediately processes the refund using `RefundPolicyService.processRefund`.
- **Drip-Feed Support**: For drip-feed orders, individual sub-runs are averaged out, and when completed or partially completed, the parent order is finalized with the appropriate status and refunds.

### Integration Points for Compensation Logic
To calculate the final margin and its delta from original expectations, we must trigger the compensation logic immediately after an order reaches a terminal state and its refunds have been successfully processed and committed to the database.

---

## 2. Database Models and Relations (`prisma/schema.prisma`)
The following database models are essential for the compensation calculation:

| Model | Fields Analyzed | Role in Compensation |
|---|---|---|
| **`Order`** | `id`, `charge` (BigInt), `providerCost` (BigInt), `quantity` (Int), `remains` (Int), `status` (OrderStatus) | Contains the customer charge and initial provider cost (in RUB cents snapshot at checkout), along with fulfillment quantity details. |
| **`Service`** | `id`, `providerCurrency` (String) | Indicates the currency of the provider (typically `"USD"` or `"RUB"`) to handle exchange rate conversions if using the provider's reported actual charge. |
| **`Provider`** | `id`, `name` | Identifies the provider used for fulfillment. |
| **`LedgerEntry`** | `userId`, `amount` (BigInt), `status` (String), `idempotencyKey` (String), `transactionType` (String) | Records financial adjustments. Automated refunds are stored with `idempotencyKey` like `refund_${order.id}_${status}` and `transactionType` `"PAYMENT"` (default). |
| **`AnalyticsEvent`** | `id`, `event` (String), `metadata` (Json), `createdAt` | Purely telemetry table. Used to persist `"ORDER_MARGIN_DELTA"` events for administrative audits and dashboard visualization without modifying client balances. |

---

## 3. Design of `CompensationService`
The service will be created at `src/services/financial/compensation.service.ts`.

### Core Calculations & Formulas

1. **Retained Customer Revenue**:
   $$\text{Retained Revenue} = \text{Order.charge} - \sum \text{Refunds}$$
   Where $\sum \text{Refunds}$ is the sum of all successful `LedgerEntry` records for the user with `idempotencyKey` matching `refund_{orderId}_%`.

2. **Provider Actual Charged Cost**:
   - **Method A (Provider Reported Charge)**: If the provider returns a valid, positive charge (e.g. `providerChargeUSD` in USD), convert to RUB Cents using the USD/RUB rate from settings:
     $$\text{Actual Provider Cost} = \lceil \text{providerChargeUSD} \times \text{ExchangeRateUSD} \times 100 \rceil$$
   - **Method B (Proportional Math Fallback)**: If provider charge is unavailable or $0$, fall back to:
     $$\text{Actual Provider Cost} = \left\lceil \frac{\text{quantity} - \text{remains}}{\text{quantity}} \times \text{order.providerCost} \right\rceil$$

3. **Margin Delta**:
   - $\text{Original Margin} = \text{order.charge} - \text{order.providerCost}$
   - $\text{Real Margin} = \text{Retained Revenue} - \text{Actual Provider Cost}$
   - $\text{Margin Delta} = \text{Real Margin} - \text{Original Margin}$

### Proposed Service Structure
```typescript
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { SettingsProvider } from '@/lib/settings';

const log = logger.child({ component: 'CompensationService' });

export class CompensationService {
  /**
   * Calculates the real margin and margin delta for a finalized order
   * and records it as an AnalyticsEvent.
   * 
   * @param orderId The unique identifier of the order.
   * @param providerChargeUSD Optional actual charge returned by the provider in USD.
   */
  static async trackOrderMarginDelta(orderId: string, providerChargeUSD?: number): Promise<void> {
    try {
      // 1. Fetch the order with its service details
      const order = await db.order.findUnique({
        where: { id: orderId },
        include: { service: true }
      });

      if (!order) {
        log.warn(`Order not found for tracking margin delta: ${orderId}`);
        return;
      }

      // We only compute margin delta for finalized statuses
      const finalStatuses = ['COMPLETED', 'PARTIAL', 'CANCELED', 'ERROR'];
      if (!finalStatuses.includes(order.status)) {
        log.debug(`Order ${orderId} is in status ${order.status}, skipping margin delta calculation.`);
        return;
      }

      // 2. Query all successful refunds associated with this order from LedgerEntry
      const refundEntries = await db.ledgerEntry.findMany({
        where: {
          userId: order.userId,
          idempotencyKey: {
            startsWith: `refund_${order.id}_`
          },
          status: 'APPROVED'
        }
      });

      // Sum refund amounts (BigInt represents cents, convert to Number safely)
      const totalRefundsCents = refundEntries.reduce((sum, entry) => sum + Number(entry.amount), 0);

      // 3. Compute provider actual charged cost
      let providerActualChargedCostCents = 0;

      if (providerChargeUSD !== undefined && providerChargeUSD > 0) {
        // Provider reported their actual charge in USD. We convert it to RUB cents.
        const usdToRub = await SettingsProvider.getExchangeRateUSD();
        const serviceExchangeRate = order.service.providerCurrency === 'RUB' ? 1.0 : usdToRub;
        
        providerActualChargedCostCents = Math.ceil(providerChargeUSD * serviceExchangeRate * 100);
      } else {
        // Fallback proportional calculation:
        // actualCost = (completedQuantity / totalQuantity) * originalProviderCost
        const quantity = order.quantity;
        const remains = order.remains;
        const originalProviderCost = Number(order.providerCost);

        if (quantity > 0 && remains >= 0) {
          const completedQty = Math.max(0, quantity - remains);
          providerActualChargedCostCents = Math.ceil((completedQty / quantity) * originalProviderCost);
        }
      }

      // Capped safety check: provider actual cost should not be negative
      if (providerActualChargedCostCents < 0) {
        providerActualChargedCostCents = 0;
      }

      const chargeCents = Number(order.charge);
      const originalProviderCostCents = Number(order.providerCost);

      // 4. Calculate margins
      // Retained Customer Revenue = initial charge - refunded cents
      const retainedCustomerRevenueCents = Math.max(0, chargeCents - totalRefundsCents);

      // Real Margin = Retained Customer Revenue - Provider Actual Charged Cost
      const realMarginCents = retainedCustomerRevenueCents - providerActualChargedCostCents;

      // Original Expected Margin = initial charge - original provider cost
      const originalMarginCents = chargeCents - originalProviderCostCents;

      // Margin Delta = Real Margin - Original Margin
      const marginDeltaCents = realMarginCents - originalMarginCents;

      // 5. Log structured details
      log.info(`Margin delta calculated for Order #${order.numericId}`, {
        orderId,
        status: order.status,
        quantity: order.quantity,
        remains: order.remains,
        chargeCents,
        originalProviderCostCents,
        totalRefundsCents,
        retainedCustomerRevenueCents,
        providerActualChargedCostCents,
        originalMarginCents,
        realMarginCents,
        marginDeltaCents
      });

      // 6. Persist to AnalyticsEvent
      await db.analyticsEvent.create({
        data: {
          event: 'ORDER_MARGIN_DELTA',
          metadata: {
            orderId,
            numericId: order.numericId,
            status: order.status,
            quantity: order.quantity,
            remains: order.remains,
            chargeCents,
            originalProviderCostCents,
            totalRefundsCents,
            retainedCustomerRevenueCents,
            providerActualChargedCostCents,
            originalMarginCents,
            realMarginCents,
            marginDeltaCents
          }
        }
      });

    } catch (error) {
      log.error(`Error in trackOrderMarginDelta for order ${orderId}`, { error });
    }
  }
}
```

---

## 4. Asynchronous Non-Blocking Integration in `sync.processor.ts`
To maintain the performance of the status polling loop (which runs every minute and processes up to 1,000 orders), the margin tracking operations **MUST NOT** block the sync execution threads.

### Integration Strategy
1. **Fire-and-Forget Pattern**: We will call the tracking method without the `await` keyword.
2. **Error Isolation**: The call is wrapped in a catch handler to ensure that database failures in the analytics/bookkeeping layer never affect the core status updates or crash the main sync loop.

### Code Modification Proposals (Draft Diffs)

#### 1. Drip-Feed Order Finalization (Completed/Canceled sub-runs)
```typescript
// For completed DripFeed
if (allCompleted && order.currentRun >= (order.runs || 1)) {
    await db.order.update({ where: { id: order.id }, data: { status: 'COMPLETED', remains: 0 } });
    sendOrderCompletedMail(order.user.email, order.numericId.toString(), order.service.name).catch(err => log.error('Failed to send completion email', { cause: err }));
    
    // Asynchronously log margin details
    CompensationService.trackOrderMarginDelta(order.id)
      .catch(err => log.error('[SyncProcessor] Margin delta track failed for dripfeed completed', { orderId: order.id, error: err }));
}
// For partially canceled DripFeed
else if (anyCanceled) {
    await db.$transaction(async (tx) => {
      const updated = await tx.order.update({ where: { id: order.id }, data: { status: 'PARTIAL', remains: totalRemainsText } });
      await RefundPolicyService.processRefund({ ...updated, charge: Number(updated.charge) }, undefined, tx);
    });

    // Asynchronously log margin details after transaction commits
    CompensationService.trackOrderMarginDelta(order.id)
      .catch(err => log.error('[SyncProcessor] Margin delta track failed for dripfeed partial', { orderId: order.id, error: err }));
}
```

#### 2. Standard Order Status Updates
```typescript
if (['CANCELED'].includes(providerStatus)) {
  await db.$transaction(async (tx) => {
    const updated = await tx.order.update({ where: { id: order.id }, data: { status: 'CANCELED', remains: parsedRemains } });
    await RefundPolicyService.processRefund({ ...updated, charge: Number(updated.charge) }, '(Отмена на стороне провайдера)', tx);
  });
  
  CompensationService.trackOrderMarginDelta(order.id, s.charge ? parseFloat(s.charge) : undefined)
    .catch(err => log.error('[SyncProcessor] Margin delta track failed for canceled order', { orderId: order.id, error: err }));
  
  // Wave 4.1 Trigger B quarantine...
} 
else if (['PARTIAL'].includes(providerStatus)) {
  await db.$transaction(async (tx) => {
    const updated = await tx.order.update({ where: { id: order.id }, data: { status: 'PARTIAL', remains: parsedRemains } });
    await RefundPolicyService.processRefund({ ...updated, charge: Number(updated.charge) }, undefined, tx);
  });
  
  CompensationService.trackOrderMarginDelta(order.id, s.charge ? parseFloat(s.charge) : undefined)
    .catch(err => log.error('[SyncProcessor] Margin delta track failed for partial order', { orderId: order.id, error: err }));
} 
else if (['COMPLETED'].includes(providerStatus)) {
  await db.order.update({ where: { id: order.id }, data: { status: 'COMPLETED', remains: 0 } });
  sendOrderCompletedMail(order.user.email, order.numericId.toString(), order.service.name).catch(err => log.error('Failed to send completion email', { cause: err }));
  
  CompensationService.trackOrderMarginDelta(order.id, s.charge ? parseFloat(s.charge) : undefined)
    .catch(err => log.error('[SyncProcessor] Margin delta track failed for completed order', { orderId: order.id, error: err }));
}
```

#### 3. Orphaned Orders / Provider Sync Errors (>72 hours or String Errors)
```typescript
// For older orphan orders
if (orderAgeHours > 72) {
    await db.$transaction(async (tx) => {
      const updated = await tx.order.update({ where: { id: order.id }, data: { status: 'ERROR', error: 'Орфан-заказ: провайдер удалил заказ' } });
      await RefundPolicyService.processRefund({ ...updated, charge: Number(updated.charge) }, '(Орфан-заказ: провайдер удалил заказ)', tx);
    });
    
    CompensationService.trackOrderMarginDelta(order.id)
      .catch(err => log.error('[SyncProcessor] Margin delta track failed for orphan order', { orderId: order.id, error: err }));
}

// For explicit string errors
if (typeof s === 'string') {
    ...
    await db.$transaction(async (tx) => {
      const updated = await tx.order.update({ where: { id: order.id }, data: { status: 'ERROR', error: s } });
      await RefundPolicyService.processRefund({ ...updated, charge: Number(updated.charge) }, '(Ошибка синхронизации или истек таймер)', tx);
    });
    
    CompensationService.trackOrderMarginDelta(order.id)
      .catch(err => log.error('[SyncProcessor] Margin delta track failed for string error', { orderId: order.id, error: err }));
}
```
