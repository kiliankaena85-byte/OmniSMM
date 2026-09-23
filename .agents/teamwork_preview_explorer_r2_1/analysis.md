# Milestone M2 (R2) Audit: BullMQ Workers and Order Lifecycle

This document presents a comprehensive security and business logic audit of the order lifecycle and worker infrastructure for Smmplan (as of July 2026).

---

## 1. Concurrency & Status Races (Race-to-Cancel)

### Findings

#### [CONC-001] Webhook Status Sync Bypasses Integrity Checks & Overwrites Terminal States
- **File**: `src/app/api/webhooks/provider/route.ts`
- **Lines**: 110–134
- **Observation**:
  The provider webhook processes updates for single orders by executing direct database updates and calling the refund service without verifying the previous status under a transaction or using optimistic locking:
  ```typescript
  if (['CANCELED'].includes(providerStatus)) {
    const updated = await db.order.update({ where: { id: order.id }, data: { status: 'CANCELED', remains: parsedRemains } });
    await RefundPolicyService.processRefund({ ...updated, charge: Number(updated.charge) }, '(Отмена на стороне провайдера)');
  ...
  } else if (['COMPLETED'].includes(providerStatus)) {
    await db.order.update({ where: { id: order.id }, data: { status: 'COMPLETED', remains: 0 } });
  ```
- **Logic Chain**:
  1. The webhook handler queries the database to find the order using `db.order.findFirst` filtering on `status: { in: ["IN_PROGRESS", "AWAITING_PAYMENT", "PENDING"] }` (line 62).
  2. While the webhook handler is running (e.g. during the provider API call to verify the status at line 87), a background worker such as the daily TTL sweep (`runInProgressTTLSweep`) or the massive status sync (`syncProcessor`) processes the same order and updates its status to `COMPLETED` or `PARTIAL` and saves it.
  3. The webhook completes its API call, receives `CANCELED` (or `PARTIAL`), and executes `db.order.update({ where: { id: order.id }, data: { status: 'CANCELED' } })`.
  4. Because the update's `where` clause does not include a status guard (like `status: 'IN_PROGRESS'`), it silently overwrites the order's status from `COMPLETED` or `PARTIAL` to `CANCELED`.
  5. The webhook then calls `RefundPolicyService.processRefund()`, which refunds 100% of the customer's payment, even though the order was completed by the sweep.
- **Contrast**:
  This directly bypasses the security gate in `orderService.processStatusUpdate` (which runs under a `Serializable` transaction and explicitly guards against updating terminal states at lines 262–272).

#### [CONC-002] Sync Processor Overwrites Concurrent Status Changes
- **File**: `src/workers/processors/sync.processor.ts`
- **Lines**: 161–185
- **Observation**:
  The `syncProcessor` retrieves orders in `IN_PROGRESS` state (line 40) and later performs status updates inside isolated transactions:
  ```typescript
  if (['CANCELED'].includes(providerStatus)) {
    await db.$transaction(async (tx) => {
      const updated = await tx.order.update({ where: { id: order.id }, data: { status: 'CANCELED', remains: parsedRemains } });
      await RefundPolicyService.processRefund({ ...updated, charge: Number(updated.charge) }, '(Отмена на стороне провайдера)', tx);
    });
  ```
- **Logic Chain**:
  1. The `syncProcessor` fetches a batch of orders that are `IN_PROGRESS`.
  2. Before it executes the update, another process (like an admin manual cancellation or the webhook handler) modifies the order state.
  3. The `syncProcessor` calls `tx.order.update({ where: { id: order.id }, data: { status: 'CANCELED' } })`.
  4. It does not verify if the order is still `IN_PROGRESS` or check the previous state within the transaction, causing it to overwrite any concurrent status updates.

---

## 2. Double-Refund Vulnerabilities

### Findings

#### [REF-001] Exploit Path via Admin Order Cancellation
- **File**: `src/services/admin/order.service.ts`
- **Lines**: 230–290
- **Observation**:
  The administrative cancel function `cancelOrder` checks if the status is already `COMPLETED` or `CANCELED`, but allows canceling `ERROR` and `PARTIAL` orders:
  ```typescript
  if (['COMPLETED', 'CANCELED'].includes(order.status)) {
    throw new Error(`Order ${order.numericId} is already in state ${order.status} and cannot be canceled.`);
  }
  ```
  It then calculates the partial refund using `calculatePartialRefund(order)` and applies the refund with a deterministic key:
  ```typescript
  const refundCents = isPendingState
    ? Number(order.charge)
    : calculatePartialRefund(order);
  ...
  if (refundCents > 0) {
    await WalletOps.refund(tx, order.userId, refundCents,
      `Отмена заказа ${order.numericId} администратором - Возврат средств`,
      { adminId: admin.id, idempotencyKey: `refund_${order.id}_CANCELED` }
    );
  }
  ```
- **Logic Chain (Exploit Scenarios)**:
  - **Scenario A (ERROR Orders)**:
    1. A user places an order for `1000 RUB`. Balance is charged `1000 RUB`.
    2. The provider rejects the order instantly, triggering `failOrderTerminalFast()`.
    3. The system marks the order as `ERROR` (or `CANCELED`), and refunds `1000 RUB` to the user's balance using the idempotency key `refund-failfast-${order.id}`. The user's balance is now back to its original amount.
    4. An administrator views the failed order in the panel and clicks "Cancel" (perhaps to clean up the queue).
    5. The `cancelOrder` service executes. Since the status is `ERROR`, it bypasses the status check (line 240).
    6. It calculates the refund. Since the order is not in a pending state, it calls `calculatePartialRefund(order)`. For an `ERROR` order, `remains` is equal to `quantity` (no items delivered), so the function returns `1000 RUB`.
    7. It updates the status to `CANCELED` and calls `WalletOps.refund` with the idempotency key `refund_${order.id}_CANCELED`.
    8. Since this key is different from the previous refund key (`refund-failfast-${order.id}`), **the transaction succeeds, crediting the user another 1000 RUB**.
    9. The user now has a net gain of `+100 RUB` (received `200%` refund).
  - **Scenario B (PARTIAL Orders)**:
    1. An order gets stuck or completes partially (e.g. 50% completed).
    2. The status sync marks it as `PARTIAL` and refunds `50%` of the cost with key `refund_${order.id}_PARTIAL`.
    3. The admin cancels the `PARTIAL` order.
    4. The system calculates the partial refund again (returning the same 50% value).
    5. It refunds the user using key `refund_${order.id}_CANCELED`.
    6. The user is refunded the same `50%` again, receiving a total refund of `100%` of the order cost despite having `50%` of the order delivered.

#### [REF-002] Bulk Cancellation Replicates Double-Refund Flaw
- **File**: `src/actions/admin/orders.ts`
- **Lines**: 240–267
- **Observation**:
  The `bulkCancelOrdersAction` checks that the order status is not in `['COMPLETED', 'CANCELED', 'ERROR']`, but it does **not** exclude `PARTIAL` orders:
  ```typescript
  if (!['COMPLETED', 'CANCELED', 'ERROR'].includes(order.status)) {
  ```
  It then updates the status of the order to `CANCELED` and refunds the client using the key `refund_${order.id}_CANCELED`. Since `PARTIAL` orders were already refunded, this triggers a double refund.

---

## 3. Duplicate Submission Risks

### Findings

#### [DUP-001] Provider API Request Retry Engine (Idempotency Violation)
- **File**: `src/services/providers/universal.provider.ts`
- **Lines**: 56–203
- **Observation**:
  The `request` engine automatically retries all requests up to 3 times on network failures (connection reset, socket timeout) or timeouts (`AbortError`):
  ```typescript
  for (let attempt = 0; attempt <= retries; attempt++) {
    ...
    try {
      ...
      const response = await fetch(finalUrl, { ... });
      ...
    } catch (error: any) {
      if (error.name === 'AbortError') {
         if (attempt < retries) {
            console.warn(`[API] Timeout from ${this.apiUrl}. Retrying...`);
            continue;
         }
         ...
      }
      ...
      if (attempt === retries) throw error;
    }
  }
  ```
- **Logic Chain**:
  1. The processor invokes `provider.createOrder()`, which calls `this.request` without passing the second argument (defaulting to `retries = 2`).
  2. If the upstream provider is experiencing performance problems, the HTTP request might time out after 15 seconds.
  3. The client receives an `AbortError`. Because `attempt < 2`, it automatically executes `continue`, sending the exact same payload to the provider a second and third time.
  4. If the provider's server had already received and initiated the order on the first request, the subsequent retries will result in duplicate submissions at the provider (and double charging of the API balance), unless the provider implements strict server-side deduplication based on `ref` or `custom_id` (which is not standard for many SMM panels).

#### [DUP-002] Database Update Failure Retries Create Duplicate Orders
- **File**: `src/workers/processors/order.processor.ts`
- **Lines**: 110–136
- **Observation**:
  The `orderProcessor` makes an API call to the provider to create the order, and only updates the database *after* receiving a successful response:
  ```typescript
  const response = await provider.createOrder(payload);
  ...
  // Update order with External ID from provider
  try {
    await db.order.update({
      where: { id: order.id },
      data: {
        externalId: extId,
        status: 'IN_PROGRESS',
        waitingUntil
      }
    });
  } catch (dbError) {
    (dbError as any).isDatabaseError = true;
    throw dbError;
  }
  ```
- **Logic Chain**:
  1. The API call `provider.createOrder(payload)` executes successfully and returns an order ID (`extId`).
  2. The worker tries to execute `db.order.update` to save the `externalId`. However, a database connection pool timeout or transient database error occurs, causing the update to throw an error.
  3. The worker catches the error, sets `isDatabaseError = true`, and rethrows it.
  4. Since this is not wrapped in `UnrecoverableError`, BullMQ schedules the job for retry.
  5. On retry, the worker re-queries the order from the DB. Because the database update failed in step 2, the order status is still `PENDING` and `externalId` is still `null`.
  6. The worker bypasses the idempotency checks and calls `provider.createOrder` again, resulting in a duplicate order submission.

#### [DUP-003] Orphan Sweep Re-enqueues Deleted Jobs
- **File**: `src/workers/processors/cleanup.processor.ts`
- **Lines**: 188–295
- **Observation**:
  `runOrphanSweep` recovers `PENDING` orders older than 15 minutes by checking if a job exists in BullMQ. If the job does not exist, it re-enqueues it:
  ```typescript
  const job = await ordersQueue.getJob(jobId);
  if (job) { ... }
  // If job does not exist -> Re-enqueue
  try {
    await ordersQueue.add('order-dispatch', { orderId: orphan.id }, { jobId });
  ```
- **Logic Chain**:
  1. BullMQ's default queue options (defined in `src/lib/queue-manager.ts` line 52) automatically delete completed jobs from Redis once they exceed `count: 50` or `age: 3600` (1 hour).
  2. If a database update failed after a successful provider submission (as in `[DUP-002]`), the order status remains `PENDING` in the DB.
  3. After 1 hour, BullMQ removes the completed/failed job from Redis.
  4. When `runOrphanSweep` executes, `ordersQueue.getJob(jobId)` returns `null`.
  5. The sweeper assumes the job was never dispatched and re-enqueues it, causing the worker to run again and submit a duplicate order.

---

## 4. Refill Lifecycle Gaps

### Findings

#### [REF-003] Lack of Concurrency Control in Refill Requests
- **File**: `src/actions/support/ticket.ts`
- **Lines**: 470–511
- **Observation**:
  The `bulkRefillOrdersAction` processes manual refill requests from support tickets. It checks if the order is not canceled/error and that the service supports refills, but it does **not** check if there is an active refill request in the database:
  ```typescript
  const refill = await tx.refill.create({
    data: {
      orderId: order.id,
      status: 'PENDING'
    }
  });
  ```
- **Logic Chain**:
  1. The admin or support agent triggers `bulkRefillOrdersAction` for an order.
  2. The order has a 1-to-many relationship with the `Refill` table (no unique constraint exists on `orderId` in `schema.prisma`).
  3. The action does not query the `Refill` table to check if there is already a refill with status `PENDING` or `IN_PROGRESS` for this order.
  4. As a result, the action will create multiple `Refill` records, which are all sent to the provider. This leads to duplicate refill requests at the provider, which could cause API errors, account flagging, or double billing (if the provider charges for refills).

#### [REF-004] Refill Processor Retries Explicit Provider Rejections
- **File**: `src/workers/processors/refill.processor.ts`
- **Lines**: 64–93
- **Observation**:
  When a provider rejects a refill request (e.g., if the warranty period has expired), the processor throws a standard error instead of an `UnrecoverableError`:
  ```typescript
  if (response.error) {
    throw new Error(response.error);
  }
  ```
- **Logic Chain**:
  1. The provider returns an explicit API error like `"Refill not allowed"`.
  2. The processor throws a standard `Error`.
  3. The worker catch block catches the error and rethrows it, causing BullMQ to retry the refill request 3 times with a 15-minute delay.
  4. This spams the provider's API with invalid requests that will never succeed.

---

## 5. Failover & Quarantine Logic Gaps

### Findings

#### [FAIL-001] Network Timeouts Bypass Trigger A (High API Failure Rate)
- **File**: `src/workers/processors/order.processor.ts`
- **Lines**: 144–179
- **Observation**:
  In `orderProcessor`, if the error is identified as a network timeout, the processor updates the status to `PENDING_CHECK` and throws an `UnrecoverableError` immediately, bypassing the quarantine evaluation:
  ```typescript
  if (isNetworkTimeout) {
    console.warn(`[OrderProcessor] AMBIGUOUS TIMEOUT for Order ${order.id}. Moving to PENDING_CHECK.`);
    await db.order.update({ ... });
    ...
    throw new UnrecoverableError(`Ambiguous Timeout: ${error.message}`);
  }
  ```
- **Logic Chain**:
  1. If a provider's servers go completely offline or experience DNS issues, every single order submission will fail with a connection timeout or DNS error (`EAI_AGAIN`).
  2. Since these are network timeouts, the worker will classify them as `isNetworkTimeout === true` and abort the job early.
  3. The quarantine evaluation logic (`QuarantineService.evaluateTriggerA`) is never reached.
  4. The system will continue to accept user orders and charge their balances, piling up orders in `PENDING_CHECK` and spamming the admin with alerts, instead of quarantining the service.

#### [FAIL-002] 5xx & 429 Errors Trigger Immediate Fail-Fast Refund
- **File**: `src/workers/processors/order.processor.ts`
- **Lines**: 180–198
- **Observation**:
  Explicit provider failures (including HTTP 500, 502, 504 errors and 429 Rate Limit errors that failed after provider-level retries) trigger the fail-fast architecture, immediately canceling the order and refunding the client:
  ```typescript
  console.error(`[OrderProcessor] FAIL-FAST for Order ${order.id}:`, error.message);
  ...
  await orderService.failOrderTerminalFast(order.id, error.message);
  ```
- **Logic Chain**:
  1. A 502/504 Bad Gateway or a 500 Server Error could be returned by the provider's API gateway *after* the provider's backend successfully received and created the order.
  2. Because the processor treats these HTTP errors as explicit rejections, it cancels the order locally and issues a full refund to the user.
  3. The provider delivers the service, but Smmplan has refunded the user, resulting in a financial loss.
