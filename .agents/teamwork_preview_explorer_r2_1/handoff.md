# Handoff Report: Milestone M2 (R2) Audit

## 1. Observation

During a read-only code audit of the order lifecycle, worker processors, and provider integration services, several key security and business logic vulnerabilities were observed:

### A. Webhook Status Overwrite (Race-to-Cancel)
In `src/app/api/webhooks/provider/route.ts` (lines 111–134):
```typescript
    if (['CANCELED'].includes(providerStatus)) {
      const updated = await db.order.update({ where: { id: order.id }, data: { status: 'CANCELED', remains: parsedRemains } });
      await RefundPolicyService.processRefund({ ...updated, charge: Number(updated.charge) }, '(Отмена на стороне провайдера)');
```
And in `src/workers/processors/sync.processor.ts` (lines 161–185):
```typescript
          if (['CANCELED'].includes(providerStatus)) {
            // Full Canceled -> Full Refund
            await db.$transaction(async (tx) => {
              const updated = await tx.order.update({ where: { id: order.id }, data: { status: 'CANCELED', remains: parsedRemains } });
              await RefundPolicyService.processRefund({ ...updated, charge: Number(updated.charge) }, '(Отмена на стороне провайдера)', tx);
            });
```
Direct database status updates are performed without status guards in the `where` clause.

### B. Administrative Double Refund
In `src/services/admin/order.service.ts` (lines 240–272):
```typescript
      if (['COMPLETED', 'CANCELED'].includes(order.status)) {
        throw new Error(`Order ${order.numericId} is already in state ${order.status} and cannot be canceled.`);
      }
      ...
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
And in `src/actions/admin/orders.ts` (line 240):
```typescript
      if (!['COMPLETED', 'CANCELED', 'ERROR'].includes(order.status)) {
```
The cancellation handlers allow canceling `ERROR` or `PARTIAL` status orders and recalculating/issuing refunds.

### C. Provider Request Retry Loop
In `src/services/providers/universal.provider.ts` (lines 182–197):
```typescript
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
```
If a request times out (AbortError), the request is retried up to 3 times total for mutation operations like order creation.

### D. DB Update Retry Loop
In `src/workers/processors/order.processor.ts` (lines 121–135):
```typescript
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (dbError as any).isDatabaseError = true;
      throw dbError;
    }
```
Re-throws the DB error if it occurs after the provider call, causing BullMQ to retry the job.

### E. Orphan Sweep Retry
In `src/workers/processors/cleanup.processor.ts` (lines 208–284):
```typescript
      const jobId = `dispatch-${orphan.id}`;
      let jobState: string | null = null;
      let jobExists = false;
      ...
      // If job does not exist -> Re-enqueue
      try {
        await ordersQueue.add('order-dispatch', { orderId: orphan.id }, { jobId });
```
In `src/lib/queue-manager.ts` (line 52):
```typescript
      removeOnComplete: { count: 50, age: 3600 },
```
BullMQ cleans up completed jobs from Redis after 1 hour or 50 runs, causing `ordersQueue.getJob(jobId)` to return `null` and the sweeper to re-enqueue.

### F. Lack of Refill Concurrency Control
In `src/actions/support/ticket.ts` (lines 498–503):
```typescript
          const refill = await tx.refill.create({
            data: {
              orderId: order.id,
              status: 'PENDING'
            }
          });
```
Creates refill requests without verifying if active refill requests already exist in the database for the order.

### G. Timeout Quarantine Bypass
In `src/workers/processors/order.processor.ts` (lines 155–178):
```typescript
    if (isNetworkTimeout) {
      console.warn(`[OrderProcessor] AMBIGUOUS TIMEOUT for Order ${order.id}. Moving to PENDING_CHECK.`);
      await db.order.update({ ... });
      ...
      throw new UnrecoverableError(`Ambiguous Timeout: ${error.message}`);
    }
```
Network timeouts cause early aborts before reaching quarantine trigger evaluation.

---

## 2. Logic Chain

1. **Webhook Concurrency Race**: If a webhook finds an order that was `IN_PROGRESS` (Observation A) and a concurrent thread (e.g. daily sweep) marks it `COMPLETED`, the webhook's subsequent direct update ignores the new status and overwrites it to `CANCELED`. It then issues a 100% refund for a successfully completed order.
2. **Double Refund Exploit**: Because `cancelOrder` (Observation B) only guards against `COMPLETED` and `CANCELED` orders, it permits cancellation of `ERROR` or `PARTIAL` orders. Since `ERROR` orders were already refunded 100% (and `PARTIAL` refunded proportionally), invoking `cancelOrder` calculates the refund again and processes it under a new idempotency key (`refund_${id}_CANCELED`). The ledger refund succeeds, giving the user a 200% refund.
3. **Duplicate Submission Risks**:
   - **Provider Retries**: If the provider's server times out during order creation but processes the request, the AbortError retry logic (Observation C) automatically resends the same request, causing a duplicate submission.
   - **DB Update Crash**: If the database crashes after the provider returns success (Observation D), the order status remains `PENDING` and the job is retried by BullMQ, causing the provider call to run again.
   - **Orphan Sweep Re-enqueue**: If the job is deleted from Redis (Observation E) because it is older than 1 hour, the orphan sweeper re-enqueues it, causing a duplicate submission.
4. **Refill Concurrency**: Creating refill records (Observation F) without verifying if any `Refill` with status `PENDING` or `IN_PROGRESS` already exists for that `orderId` allows duplicate refills to be processed.
5. **Quarantine Bypass**: Network timeouts (Observation G) throw an error and abort before evaluating Trigger A. If a provider goes down, the system continues charging users and piling up orders in `PENDING_CHECK` rather than putting the service on cooldown.

---

## 3. Caveats

- We did not write tests or modify the source code to verify this at runtime, since we are in read-only investigation mode.
- We assume that the provider APIs are standard SMM panel APIs and do not guarantee server-side deduplication for identical requests unless explicitly configured.

---

## 4. Conclusion

The M2 BullMQ workers and order lifecycle codebase contains critical vulnerabilities:
1. **Critical Concurrency Races**: Webhooks and sync workers overwrite concurrent order status changes and issue incorrect refunds.
2. **Severe Double-Refund Vulnerability**: Admins can cancel `ERROR` or `PARTIAL` orders, triggering a duplicate 100% or partial refund to client wallets.
3. **High Risk of Duplicate Submissions**: Provider-level AbortError retries, database write failures after dispatch, and orphan sweeper job-pruning logic can all cause duplicate orders to be sent to upstream providers.
4. **Quarantine / Failover Gaps**: Network timeouts bypass quarantine triggers, preventing auto-cooldown during provider downtime.

---

## 5. Verification Method

To verify these findings:
1. **Inspect files**:
   - `src/app/api/webhooks/provider/route.ts` (Line 110–134) to confirm direct database updates without status guards.
   - `src/services/admin/order.service.ts` (Line 240) to confirm `cancelOrder` allows `ERROR`/`PARTIAL` statuses.
   - `src/services/providers/universal.provider.ts` (Line 182) to confirm AbortError retries.
   - `src/actions/support/ticket.ts` (Line 498) to confirm lack of active refill verification.
2. **Test Command**: Run `npx vitest run src/services/financial/refund-parallel.test.ts` to examine the testing coverage for refunds and concurrency.
