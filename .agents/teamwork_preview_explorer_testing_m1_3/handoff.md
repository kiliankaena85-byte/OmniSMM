# Handoff — Loss Prevention and Support Limits Verification

This report details the read-only investigation of SMMplan's Loss Prevention measures, Order Cancellation handling, Support Compensation Limits, and outlines a Playwright test specification to verify these controls.

---

## 1. Observation

Direct observations made in the codebase:

### A. Order Cancellation Guard
- **File:** `src/services/admin/order.service.ts` (lines 244–256)
- **Code:**
```typescript
      // Loss Prevention: Support cannot cancel active orders if upstream provider has disabled cancellations
      const isPendingState = ['AWAITING_PAYMENT', 'PENDING', 'PENDING_CHECK'].includes(order.status);
      if (!isPendingState && !order.service.isCancelEnabled) {
        const caller = await tx.user.findUniqueOrThrow({
          where: { id: admin.id },
          select: { role: true },
        });
        if (caller.role === 'SUPPORT') {
          throw new Error(
            `Отмена невозможна: услуга "${order.service.name}" не поддерживает отмену на стороне провайдера. Только Администратор или Владелец могут принудительно отменить этот заказ.`
          );
        }
      }
```
- **Operator Toast Hook:** `src/app/operator/orders/components/orders-table.tsx` (lines 63–71):
```typescript
    startTransition(async () => {
      const res = await cancelOrderAction(orderId);
      if (res && 'success' in res && res.success) {
        toast.success(`Заказ #${orderNum} успешно отменен`);
      } else {
        toast.error((res as any)?.error || 'Не удалось отменить заказ');
      }
    });
```
- **Action Wrapper:** `src/actions/operator/orders/cancel-order.action.ts` calls `requireOperatorPermission('orders', 'edit')` which delegates to `requireStaffPermission` in `src/lib/server/rbac.ts`. RBAC catches the thrown exception and returns `{ success: false, error: error.message }`.

### B. Daily Support Compensation Limit Guard
- **File:** `src/actions/support/ticket.ts` (lines 590–595)
- **Code:**
```typescript
      if (totalToRefundCents > 0 && !isApiEnabledClient) {
        const currentSpentToday = await getAdminSpentToday(admin.id, tx);
        const limitLeft = admin.supportLimitCents - currentSpentToday;
        if (totalToRefundCents > limitLeft) {
          throw new Error(`Превышен суточный лимит компенсаций оператора. Требуется: ${(totalToRefundCents / 100).toFixed(2)} ₽, Осталось: ${(limitLeft / 100).toFixed(2)} ₽`);
        }
      }
```
- **API Bypass:** Verified that clients with `isApiEnabledClient = true` are excluded from the limit constraint checks.
- **Spending Calculation:** `getAdminSpentToday(adminId, tx)` (lines 645–664) sums the absolute values of all ledger entry amounts created by that operator (`adminId`) starting from MSK midnight today (`getMSKMidnightUTC()`).
- **Escrow Guard:** Manual balance adjustments check trust limits in `src/services/admin/escrow.service.ts` (lines 96–115). If the daily budget is exceeded, it redirects the funds into `quarantineBalance` with a `QUARANTINE` status, requiring Owner approval.

---

## 2. Logic Chain

1. **Cancellation Block:** If a support operator (role `SUPPORT`) triggers `cancelOrderAction` on an active order (status is not one of `['AWAITING_PAYMENT', 'PENDING', 'PENDING_CHECK']` - meaning it is `IN_PROGRESS`, `ERROR`, etc.) and the service has `isCancelEnabled = false`, the `cancelOrder` service method (Observation A) explicitly catches this, checks the caller's role, and throws a validation exception.
2. **Warning Message:** The validation exception propagates through the server action. The `requireStaffPermission` RBAC wrapper catches the exception and returns the string error as `{ success: false, error: err.message }` (Observation A). The client component `OrdersTable` captures this error payload and displays a toast message containing the exact string:
   `Отмена невозможна: услуга "<service_name>" не поддерживает отмену на стороне провайдера. Только Администратор или Владелец могут принудительно отменить этот заказ.`
3. **Daily Limit Guard:** Support operators have a daily budget allocated in `User.supportLimitCents` (default 50,000 cents = 500 RUB). Any bulk refund/compensation operations through `bulkRefundOrdersAction` check the remaining budget by querying `LedgerEntry` sums since MSK midnight (Observation B). If `totalToRefundCents` is greater than the remaining limit, the backend throws an exception which is caught and returned by the RBAC wrapper.
4. **UX Limit Warning Discrepancy:** In `attached-orders-grid.tsx` (Observation B), when `bulkRefundOrdersAction` fails, the frontend catches the failure but displays a hardcoded generic toast: `toast.error('Произошла непредвиденная ошибка')`. This obscures the detailed budget restriction warning message.

---

## 3. Caveats

- **Frontend Toast Messaging:** The discrepancy where the frontend component `AttachedOrdersGrid` shows `'Произошла непредвиденная ошибка'` instead of the detailed backend error `Превышен суточный лимит компенсаций...` means E2E assertions for the compensation limit test should check either the network action payload or the hardcoded frontend toast.
- **Regex ID Matcher Range:** The order ID parser `extractOrderIds` in `src/utils/ticket-parser.ts` only extracts numeric sequences with lengths from 4 to 12 digits. If tests seed an order with a `numericId` less than 1000 (e.g., autoincremented to 1, 2, 3), the regex will fail to extract it, and it will not appear as an attached order in `AttachedOrdersGrid`. Seed scripts must explicitly set `numericId` to 4+ digits.

---

## 4. Conclusion

- Order cancellation for support is securely blocked for active orders when `isCancelEnabled = false` with a clear, descriptive warning message.
- Daily support compensation budgets are verified atomically through cumulative ledger checks based on UTC+3 MSK midnight resets.
- We have created a comprehensive Playwright spec draft `proposed_loss_prevention_support.spec.ts` in the folder that covers both scenarios using standard authentication fixtures and test data seeding.

---

## 5. Verification Method

To independently verify these findings:
1. Inspect the source file: `src/services/admin/order.service.ts` around line 244.
2. Inspect the source file: `src/actions/support/ticket.ts` around line 590.
3. Review the proposed Playwright spec: `.agents/teamwork_preview_explorer_testing_m1_3/proposed_loss_prevention_support.spec.ts`.
4. Run E2E test commands:
   ```bash
   npx playwright test e2e/orders.spec.ts
   ```
