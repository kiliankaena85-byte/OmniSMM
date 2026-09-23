# Handoff Report: Orders, Refills, and Tickets Modules Logical Audit

This report presents a deep logical and security audit of the Orders, Refills, and Tickets modules in the Smmplan admin panel. It outlines direct observations from the codebase, steps of logical reasoning, caveats, final conclusions, and a verification method.

---

## 1. Observations

### Finding A: Lack of Page-Level RBAC View Enforcement (Bypass of View Restrictions on Admin Pages)
- **Files Inspected**:
  - `src/app/admin/orders/page.tsx`
  - `src/app/admin/tickets/page.tsx`
  - `src/app/admin/refills/page.tsx`
  - `src/app/admin/layout.tsx`
- **Observed Code**:
  - In `src/app/admin/layout.tsx`, the navigation list is filtered according to permission properties:
    ```typescript
    // Lines 96-101
    .filter(item => {
      if (user.role === 'OWNER') return true;
      if (!user.staffRole) return false;
      return user.staffRole.permissions.some((p: any) => p.section === item.section && p.canView);
    })
    ```
  - In `src/app/admin/orders/page.tsx` (lines 46-55), `src/app/admin/tickets/page.tsx` (lines 47-56), and `src/app/admin/refills/page.tsx` (no user/session check at all other than parent layout wrapping), there are **no checks** validating whether the user's staff role permissions actually allow viewing the section.
  - Regular role validation is handled by `AdminLayout` (lines 74-76) checking base role membership against `['OWNER', 'ADMIN', 'MANAGER', 'SUPPORT']`:
    ```typescript
    if (!user || !ADMIN_ROLES.includes(user.role)) {
      redirect('/dashboard/new-order');
    }
    ```
  - There is no invocation of `enforcePageRole` or any custom granular permission checking before pulling database lists on individual pages.

### Finding B: Silent Failure and Fake Success Toast Bug in Admin Orders UI
- **Files Inspected**:
  - `src/app/admin/orders/components/order-client.tsx`
  - `src/app/admin/orders/components/columns.tsx`
  - `src/actions/admin/orders.ts`
- **Observed Code**:
  - In `src/actions/admin/orders.ts`, functions `cancelOrderAction` and `restartOrderAction` are wrapped in `requireStaffPermission`:
    ```typescript
    // cancelOrderAction (lines 47-49)
    export async function cancelOrderAction(formData: FormData) {
      return requireStaffPermission('orders', 'edit', async (admin) => { ... })
    }
    ```
  - `requireStaffPermission` in `src/lib/server/rbac.ts` catches all errors internally and returns a status object instead of throwing:
    ```typescript
    // src/lib/server/rbac.ts (lines 69-74)
    } catch (error: any) {
      console.error("[RBAC] Execution Error:", error);
      const localized = handleServerError(error);
      return { success: false, error: localized.message };
    }
    ```
  - In `src/app/admin/orders/components/order-client.tsx` (lines 149-170) and `src/app/admin/orders/components/columns.tsx` (lines 98-111), the UI calls these actions within `try/catch` blocks without validating the return object's `success` status:
    ```typescript
    // order-client.tsx lines 159-171
    } else if (confirmAction === 'restart') {
      startTransition(async () => {
        addOptimisticUpdate({ id: order.id, status: 'PENDING' });
        try {
          await restartOrderAction(fd);
          toast.success(`♻️ Заказ #${order.numericId} перезапущен`);
          onClose();
        } catch (e) {
          toast.error((e as Error).message ?? 'Ошибка');
        }
      });
    }
    ```
  - Because `restartOrderAction` returns `{ success: false, error: ... }` on failure, no JavaScript error is thrown, the `catch` block is bypassed, and the UI displays a fake success toast message (`Заказ #... перезапущен`) even if the operation failed.

### Finding C: Timezone & Reason Discrepancies in Daily Spent calculations
- **Files Inspected**:
  - `src/app/admin/tickets/page.tsx`
  - `src/actions/support/ticket.ts`
- **Observed Code**:
  - `src/app/admin/tickets/page.tsx` (lines 57-76) computes `supportSpentTodayCents` using local server time midnight and filters by ledger entry reason containing `'Компенсация'`:
    ```typescript
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const ledgerCompensations = await db.ledgerEntry.findMany({
      where: {
        adminId: session.userId,
        createdAt: { gte: todayStart },
        reason: { contains: 'Компенсация' }
      },
      select: { amount: true }
    });
    ```
  - `getAdminSpentToday` in `src/actions/support/ticket.ts` (lines 629-648) computes spent cents using `getMSKMidnightUTC()` and does **not** filter by reason:
    ```typescript
    export async function getAdminSpentToday(adminId: string, tx?: any): Promise<number> {
      const todayStart = getMSKMidnightUTC();
      const client = tx || db;
      const ledgerCompensations = await client.ledgerEntry.findMany({
        where: {
          adminId,
          createdAt: { gte: todayStart },
        },
        select: { amount: true }
      });
      return ledgerCompensations.reduce((acc: number, entry: any) => {
        const amt = Number(entry.amount);
        return acc + Math.abs(amt);
      }, 0);
    }
    ```

### Finding D: Broken "Cancel Order" Button for IN_PROGRESS and ERROR Orders in Admin Drawer
- **Files Inspected**:
  - `src/app/admin/orders/components/order-client.tsx`
  - `src/services/admin/order.service.ts`
- **Observed Code**:
  - The UI cancel button is enabled for orders in `IN_PROGRESS` or `ERROR` states:
    ```typescript
    // order-client.tsx line 372
    disabled={isPending || ['COMPLETED', 'CANCELED', 'PARTIAL'].includes(order.status)}
    ```
  - However, when clicked, it calls `cancelOrderAction` which runs `adminOrderService.cancelOrder`. This service explicitly blocks cancellation if the status is `IN_PROGRESS` or `ERROR`:
    ```typescript
    // order.service.ts line 231
    if (['COMPLETED', 'CANCELED', 'IN_PROGRESS', 'PARTIAL', 'ERROR'].includes(order.status)) {
      throw new Error(`Order ${order.numericId} is already in state ${order.status}. Reseller platforms cannot cancel orders that have been sent to the upstream provider.`);
    }
    ```
  - Clicking this button for an `IN_PROGRESS` or `ERROR` order always fails.

### Finding E: Omission of Refunds on Status Change to COMPLETED via Dropdown
- **Files Inspected**:
  - `src/actions/admin/orders.ts`
- **Observed Code**:
  - In `setOrderStatusAction` (lines 109-148), status overrides to `CANCELED`, `ERROR`, or `PARTIAL` trigger refunds if there are undelivered remains.
  - However, overriding the status to `COMPLETED` sets remains to `0` without running any refund calculation:
    ```typescript
    await tx.order.update({
      where: { id: validatedOrderId },
      data: {
        status: newStatus,
        remains: newRemains,
        ...(newStatus === 'COMPLETED' ? { remains: 0 } : {}),
      },
    });
    ```
  - This contrasts with `forceCompleteOrderAction` (lines 174-219) which calculates undelivered remains and issues a partial refund before completing. Setting status to `COMPLETED` via the status dropdown silently discards remains without refunding the user.

### Finding F: Read-Only Refills Module with No Admin Controls
- **Files Inspected**:
  - `src/app/admin/refills/page.tsx`
  - `src/app/admin/refills/client-table.tsx`
- **Observed Code**:
  - Refill records are created by tickets (`src/actions/support/ticket.ts` line 482) and processed/updated by BullMQ background processors (`src/workers/processors/refill.processor.ts`).
  - There is no drawer, status dropdown, retry button, or other edit action inside `src/app/admin/refills/page.tsx` or `src/app/admin/refills/client-table.tsx`. If a refill job gets stuck or fails, the administrator has no manual override UI.

---

## 2. Logic Chain

1. **Page-Level RBAC Bypass**:
   - *Observation*: `AdminLayout` permits access to `/admin/*` for all staff roles (`SUPPORT`, `MANAGER`, `ADMIN`, `OWNER`). Pages like `orders/page.tsx` and `tickets/page.tsx` pull records directly from their respective services after calling `verifySession()`.
   - *Reasoning*: Because these page components do not verify granular permission flags (e.g. checking if `canView` for `orders` or `tickets` is true under the user's `staffRole.permissions`), a staff member can manually navigate directly to `/admin/orders` or `/admin/tickets` in the browser, bypassing the sidebar filtration.
   - *Conclusion*: View restriction rules configured in the staff role permission settings can be bypassed.

2. **Silent Failure and Fake Success Toast**:
   - *Observation*: Individual cancel and restart actions in `order-client.tsx` are wrapped in `try/catch` blocks that call server actions which return `{ success: false, error }` instead of throwing. The UI code does not inspect the return value to verify success.
   - *Reasoning*: The `try` block executes successfully since a response object is returned. The `catch` block is never executed. As a result, the code proceeds directly to displaying the `toast.success` notification.
   - *Conclusion*: Operations that fail (e.g., due to validation, RBAC rejection, or insufficient balance) are shown to the admin as successful, causing discrepancies in order state tracking.

3. **Spent Limit Calculations Mismatch**:
   - *Observation*: The admin panel page uses local server time midnight and filters entries containing `'Компенсация'`. The validation server action uses Moscow Time (MSK) midnight and does not filter by reason.
   - *Reasoning*: Timezone shifts (e.g., if the server is set to UTC) will shift the midnight boundaries. The lack of reason filtering in the validator means any administrative debit/credit ledger entries (not just compensation refunds) reduce the operator's spent limit.
   - *Conclusion*: Operators may see a valid limit in the UI, but their transactions will be rejected by the server action.

4. **Broken Cancel Button**:
   - *Observation*: The drawer Cancel button is enabled for status values other than `['COMPLETED', 'CANCELED', 'PARTIAL']` (meaning it is active for `IN_PROGRESS` and `ERROR` orders). But the service `cancelOrder` explicitly throws when receiving orders with these statuses.
   - *Reasoning*: Clicking the active button immediately routes to `adminOrderService.cancelOrder`, which triggers an unhandled error rejection.
   - *Conclusion*: The UI button is active but will always fail when clicked for `IN_PROGRESS` or `ERROR` orders.

---

## 3. Caveats

- We assumed that the server environment could be running in a timezone other than MSK (e.g., UTC). If the server is explicitly configured to run in MSK, the timezone mismatch issue is minimized but the logical difference in reason filtering remains.
- No direct database writes were conducted since this is a read-only investigation.

---

## 4. Conclusion

The Smmplan admin panel's Orders, Refills, and Tickets modules contain critical logical discrepancies and security authorization gaps. 
Specifically, there is a lack of page-level permission checks (allowing staff to bypass sidebar view restrictions), silent failure toasts (rendering mock success states to operators), daily limit mismatches, and broken buttons in the orders management drawer. 

---

## 5. Verification Method

To independently verify these findings, perform the following steps:

1. **Verify Page-Level RBAC Bypass**:
   - Assign a custom staff role to a test user that has `canView: false` for the `orders` section.
   - Log in as that user and attempt to navigate directly to `/admin/orders` via the browser URL bar.
   - Observe that the page loads and displays orders instead of redirecting or showing an access denied message.

2. **Verify Silent Failure and Fake Success Toast**:
   - Navigate to `/admin/orders`, select an order with `ERROR` status, and click the "Restart" button.
   - Ensure the user does not have enough balance to trigger a restart (so that it returns `WalletInsufficientFundsError` inside the server action).
   - Click "Confirm" and observe that the toast displays a green success message, despite the order status in the database remaining unchanged.

3. **Verify Broken Cancel Button**:
   - Select an order in the list with `IN_PROGRESS` status.
   - Open the drawer and check that the "Cancel order" button is active.
   - Click it and verify that it returns an error: "Reseller platforms cannot cancel orders that have been sent to the upstream provider."

4. **Run Project Linting and Typechecks**:
   - Run the command: `npm run typecheck` or `npx tsc --noEmit`
   - Run tests using: `npm run test`
