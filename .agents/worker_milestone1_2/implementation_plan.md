# Implementation Plan: Compensation Tracking Integration

## Problem
In SMM_plan_2, the compensation tracking mechanism (implemented in `CompensationService.trackCompensation`) is missing from some terminal state transition pathways (e.g. provider webhooks, core terminal failures, and manual admin status updates). This causes mismatching records between expected cost/margin and actual cost/margin in the database when orders transition to terminal states (`COMPLETED`, `PARTIAL`, `CANCELED`, `ERROR`).

## Affected Files
1. `src/app/api/webhooks/provider/route.ts` - Webhook callback from provider updates.
2. `src/services/core/order.service.ts` - System core order failure routines (`failOrderTerminal`, `failOrderTerminalFast`).
3. `src/actions/admin/orders.ts` - Admin manual status updates (`setOrderStatusAction`).

## Proposed Approach
1. In `src/app/api/webhooks/provider/route.ts`:
   - Import `CompensationService` from `@/services/financial/compensation.service`.
   - Call `CompensationService.trackCompensation(order.id, s.charge).catch(err => console.error('[Webhook] Failed to track compensation', err))` asynchronously inside `COMPLETED`, `PARTIAL`, and `CANCELED` paths.
2. In `src/services/core/order.service.ts`:
   - Import `CompensationService` from `@/services/financial/compensation.service`.
   - At the end of `failOrderTerminal` and `failOrderTerminalFast` (outside/after DB transaction), call `CompensationService.trackCompensation(orderId).catch(err => console.error('[OrderService] Failed to track compensation', err))` asynchronously.
3. In `src/actions/admin/orders.ts`:
   - Import `CompensationService` from `@/services/financial/compensation.service`.
   - At the end of `setOrderStatusAction`, call `CompensationService.trackCompensation(validatedOrderId).catch(err => console.error('[AdminOrders] Failed to track compensation', err))` asynchronously.

---

## 🔒 5-Vector Reliability Audit
1. **Architectural Boundary**: All calls are asynchronous and wrapped in `.catch(...)`. This ensures they do not block API response times or main transaction pipelines, protecting critical paths from failures in compensation tracking.
2. **Chaos & Emptiness (Cold Start / Invalid Data)**: `CompensationService.trackCompensation` handles cases where database records are not found or where the charge parameter is empty, invalid, or missing, falling back to proportional remaining quantity calculation.
3. **Visual & UX Density**: Not applicable as these are background and server-side service logic integrations.
4. **Accessibility (WCAG 2.2 AA)**: Not applicable.
5. **Security & Trust**: Integrity Warning comments will be added to the code. The operations are executed within verified backend contexts with RBAC guards intact.

---

## 🔒 Failure Simulation & Risk Matrix (Pre-mortem)
Below are 3 scenarios of potential failures in production and their mitigations:

| Scenario ID | Failure Scenario | Impact | Mitigation Mechanism |
|---|---|---|---|
| FS-01 | Database deadlock during parallel updates to the same `Order` record by multiple workers. | Minor (logging error) | Async execution with independent `.catch()` avoids failing the client request or main transaction. |
| FS-02 | `s.charge` from provider API contains non-numeric values or is missing. | Minor (fallback calculation) | `CompensationService.trackCompensation` parses numeric values and has robust fallback logic using remains/quantity ratio. |
| FS-03 | Order does not exist when tracking is called. | None (handled) | `CompensationService` queries with `findUnique` and logs a warning, then cleanly exits without throwing. |

---

## Verification Plan
1. Compile the code using `npx tsc --noEmit`.
2. Check style with `npm run lint`.
3. Run tests via `npx vitest run`.
