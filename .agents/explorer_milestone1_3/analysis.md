# Analysis: Compensation Loss Function & Real Margin Delta

## Executive Summary
This analysis report designs the `CompensationService` to track and calculate the **Real Margin Delta** (financial discrepancy) of client orders. By comparing the provider's actual charged cost against the retained customer revenue after refunds, Smmplan can identify financial leakage and audit profitability with high precision.

---

## 1. Database Models Analysis (`schema.prisma`)
The following Prisma models form the core financial tracking surface of the application:

### A. `Order` Model
- **`charge` (BigInt)**: Represents the initial gross payment received from the customer (stored in RUB cents).
- **`providerCost` (BigInt)**: The estimated provider purchase price (COGS) in RUB cents, locked at checkout based on the exchange rate and provider rate at that time.
- **`quantity` & `remains` (Int)**: Used to compute proportional progress and returns.
- **`status` (OrderStatus)**: Transitions through `IN_PROGRESS` before terminating at `COMPLETED`, `PARTIAL`, `CANCELED`, or `ERROR`.
- **`providerId`**: The foreign key linking the order to the active provider.

### B. `Provider` Model
- **`balanceCurrency` (String)**: Standard currency of the provider's account (typically `USD`).
- **`apiUrl` & `apiKey`**: Credentials used to query status and charge updates.

### C. `LedgerEntry` Model
- **`amount` (BigInt)**: The change in client balance (positive for refunds/credits, negative for debits/charges).
- **`transactionType` (String)**: Defaults to `'PAYMENT'`. Can be `'REFUND'` or `'COMPENSATION'`.
- **`idempotencyKey`**: Formatted as `refund_${order.id}_${order.status}` to prevent double refunding.

---

## 2. Refund Logic Analysis
When an order fails or completes partially, `RefundPolicyService.processRefund` is triggered:
1. **`CANCELED` or `ERROR`**: Performs a 100% full refund of the original customer charge minus any previous partial refunds.
2. **`PARTIAL`**: Performs a proportional refund using `calculatePartialRefund(order)`:
   $$\text{RefundCents} = \lfloor \frac{\text{remains}}{\text{quantity}} \times \text{charge} \rfloor$$
3. All refunds write a positive `amount` entry into `LedgerEntry` using the unique idempotency key `refund_${order.id}_${order.status}`.

---

## 3. CompensationService Design

### A. Mathematical Formulation
To compute the **Real Margin Delta**, we define the following equations:

1. **Expected Margin (Estimated Profit)**:
   $$M_{\text{expected}} = \text{order.charge} - \text{order.providerCost}$$

2. **Retained Customer Revenue**:
   $$R_{\text{retained}} = \text{order.charge} - \sum \text{Refunds}$$
   Where $\sum \text{Refunds}$ is the sum of all successful `LedgerEntry` amounts corresponding to `refund_${order.id}_%`.

3. **Actual Provider Cost ($P_{\text{actual}}$) - Dual-Mode Resolution**:
   - **Mode A (Direct Provider API Reporting)**: If `providerOrderStatus.charge` is returned by the provider status response and can be parsed:
     $$P_{\text{actual}} = \text{Math.round}(\text{parseFloat}(s.\text{charge}) \times \text{exchangeRate} \times 100)$$
     Where $\text{exchangeRate}$ is the exchange rate at execution (or current rate from `SettingsProvider.getExchangeRateUSD()`).
   - **Mode B (Proportional Fallback)**: If `s.charge` is missing/zero or status is `CANCELED`/`ERROR`:
     - For `CANCELED` or `ERROR`: $P_{\text{actual}} = 0$ (assuming provider refunds 100%).
     - For `PARTIAL` or `COMPLETED`:
       $$P_{\text{actual}} = \text{Math.round}(\frac{\text{quantity} - \text{remains}}{\text{quantity}} \times \text{order.providerCost})$$

4. **Real Margin (Real Profit)**:
   $$M_{\text{real}} = R_{\text{retained}} - P_{\text{actual}}$$

5. **Margin Delta**:
   $$\Delta M = M_{\text{real}} - M_{\text{expected}}$$
   - $\Delta M < 0$: Financial loss compared to expectation (margin erosion).
   - $\Delta M > 0$: Financial gain (higher profit than expected, e.g., due to favourable exchange rate fluctuations).

### B. Proposed Schema Extensions
To persist these metrics without polluting the user-facing `LedgerEntry` table, we propose extending the `Order` model in `prisma/schema.prisma`:
```prisma
model Order {
  // ... existing fields ...
  
  realMargin         BigInt? // Real margin realized in cents
  actualProviderCost BigInt? // Actual cost charged by the provider in cents
  marginDelta        BigInt? // Real Margin - Expected Margin in cents
}
```

### C. TypeScript Implementation Sketch (`src/services/financial/compensation.service.ts`)
```typescript
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { SettingsProvider } from '@/lib/settings';
import { ProviderOrderStatusDto } from '../providers/base-provider';

export interface CompensationResult {
  orderId: string;
  expectedMarginCents: number;
  actualProviderCostCents: number;
  retainedCustomerRevenueCents: number;
  realMarginCents: number;
  marginDeltaCents: number;
  isLoss: boolean;
}

export class CompensationService {
  /**
   * Computes the real margin delta and persists it to the database.
   */
  static async evaluateOrderFinancials(
    orderId: string,
    providerOrderStatus?: ProviderOrderStatusDto,
    txClient: Prisma.TransactionClient = db
  ): Promise<CompensationResult | null> {
    // 1. Fetch order details with service and provider context
    const order = await txClient.order.findUnique({
      where: { id: orderId },
      include: { service: true }
    });

    if (!order) return null;

    // 2. Query all successful refunds associated with this order from LedgerEntry
    const refundLedgerEntries = await txClient.ledgerEntry.findMany({
      where: {
        userId: order.userId,
        idempotencyKey: { startsWith: `refund_${order.id}_` }
      }
    });

    const totalRefundedCents = refundLedgerEntries.reduce(
      (sum, entry) => sum + Number(entry.amount),
      0
    );

    const retainedRevenueCents = Number(order.charge) - totalRefundedCents;

    // 3. Resolve exchange rate & provider actual cost
    const usdToRubRate = await SettingsProvider.getExchangeRateUSD();
    const serviceExchangeRate = order.service.providerCurrency === 'RUB' ? 1.0 : usdToRubRate;

    let actualProviderCostCents = 0;
    
    if (order.status === 'CANCELED' || order.status === 'ERROR') {
      actualProviderCostCents = 0;
    } else if (
      providerOrderStatus?.charge &&
      !isNaN(parseFloat(providerOrderStatus.charge)) &&
      parseFloat(providerOrderStatus.charge) > 0
    ) {
      // Direct API charge conversion
      actualProviderCostCents = Math.round(
        parseFloat(providerOrderStatus.charge) * serviceExchangeRate * 100
      );
    } else if (order.quantity > 0) {
      // Fallback: Proportional mathematical COGS
      const deliveredQty = order.quantity - order.remains;
      actualProviderCostCents = Math.round(
        (deliveredQty / order.quantity) * Number(order.providerCost)
      );
    }

    // 4. Calculate Margins
    const expectedMarginCents = Number(order.charge) - Number(order.providerCost);
    const realMarginCents = retainedRevenueCents - actualProviderCostCents;
    const marginDeltaCents = realMarginCents - expectedMarginCents;

    // 5. Persist values to the Order
    await txClient.order.update({
      where: { id: orderId },
      data: {
        realMargin: BigInt(realMarginCents),
        actualProviderCost: BigInt(actualProviderCostCents),
        marginDelta: BigInt(marginDeltaCents)
      }
    });

    return {
      orderId,
      expectedMarginCents,
      actualProviderCostCents,
      retainedCustomerRevenueCents: retainedRevenueCents,
      realMarginCents,
      marginDeltaCents,
      isLoss: marginDeltaCents < 0
    };
  }
}
```

---

## 4. Integration Strategy into `sync.processor.ts`

### A. Terminal State Interception Points
`CompensationService.evaluateOrderFinancials` should only run when an order reaches a **terminal status**: `COMPLETED`, `PARTIAL`, `CANCELED`, or `ERROR`.
In `sync.processor.ts`, these transitions occur at:
- **DripFeed orders**:
  - `COMPLETED` (line 112)
  - `PARTIAL` (line 117)
- **Standard orders**:
  - `ERROR` (line 132 & 147)
  - `CANCELED` (line 159)
  - `PARTIAL` (line 170)
  - `COMPLETED` (line 175)

### B. Asynchronous Execution Models
Since the sync processor runs in bulk (up to 1,000 orders per provider execution), blocking the loop with sequential DB writes and remote exchange rate calls is an anti-pattern. We recommend two integration options:

#### Option A: Dedicated BullMQ Queue (`compensation-queue`) [Recommended]
Instead of executing the math inline, the sync processor enqueues a lightweight job:
```typescript
import { compensationQueue } from '../queues';

// Inside sync.processor.ts, immediately following terminal status update/transaction commit:
await compensationQueue.add('evaluate-margin', {
  orderId: order.id,
  providerOrderStatus: s
}, {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 }
});
```
- **Pros**: Complete separation of concerns, zero slowdown of the critical order sync, robust retry policies, independent worker scaling.
- **Cons**: Requires setting up a new queue.

#### Option B: Non-blocking Fire-and-Forget Promise
Run the evaluation asynchronously in the background:
```typescript
// Inside sync.processor.ts after transaction commits:
CompensationService.evaluateOrderFinancials(order.id, s)
  .catch(err => log.error('Failed to execute compensation evaluation', { orderId: order.id, err }));
```
- **Pros**: No queue setup required, simple implementation.
- **Cons**: Less resilient to transient DB connection issues; can spike database connection usage under massive loads.
