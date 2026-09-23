# Handoff Report - Security and Business Logic Audit for Milestone M1 (R1)

## 1. Observation

Direct observations made in the codebase:

1. **Promo Code Consumption**:
   - In `src/services/marketing.service.ts` at line 180:
     ```typescript
     const updatedPromo = await tx.promoCode.update({
       where: { id: promo.id },
       data: { uses: { increment: 1 } }
     });
     ```
   - In `src/actions/order/checkout.ts` at line 482:
     ```typescript
     await marketingService.consumePromoCode(tx, promoCodeStr);
     ```
     This occurs inside a transaction with `isolationLevel: 'Serializable'` (line 364 of `checkout.ts`).

2. **Promo Code Rollbacks**:
   - In `src/actions/order/checkout.ts` at line 660, in the `catch` block for gateway error handling:
     ```typescript
     db.promoCode.updateMany({
        where: { code: promoCodeStr, uses: { gt: 0 } },
        data: { uses: { decrement: 1 } }
     })
     ```
   - In `src/workers/processors/cleanup.processor.ts` at line 112:
     ```typescript
     const updated = await tx.order.updateMany({
       where: { id: zombie.id, status: 'AWAITING_PAYMENT' },
       data: { 
         status: 'CANCELED', 
         error: 'Ожидание оплаты истекло (авто-отмена системы)' 
       }
     });
     ```
     No call to `promoCode.update` or `uses` decrement is present in `cleanup.processor.ts`.
   - In `src/services/admin/order.service.ts` at lines 262-272:
     ```typescript
     await tx.order.update({
       where: { id: orderId },
       data: { status: 'CANCELED' },
     });
     ```
     No promo code `uses` decrement is present in this cancellation path.

3. **Promo Code Budget**:
   - In `src/actions/admin/marketing.ts` at line 21:
     ```typescript
     budget: z.coerce.number().optional().default(0),
     ```
     There is no `.max()` validator.
   - In `prisma/schema.prisma` at line 107:
     ```prisma
     budgetCents  Int              @default(0)
     ```
     The data type is `Int` (32-bit signed integer).

4. **Service Profitability remains Calculation**:
   - In `src/services/admin/analytics.service.ts` at lines 68-71:
     ```typescript
     if (order.quantity > 0) {
       const deliveredQty = order.quantity - order.remains;
       revenue = Math.round((deliveredQty / order.quantity) * Number(order.charge));
       cogs = Math.round((deliveredQty / order.quantity) * Number(order.providerCost));
     ```

5. **Referral Commissions & Reversals**:
   - In `src/services/core/order.service.ts` at lines 107-110:
     ```typescript
     const margin = input.charge - input.providerCost;
     if (margin > 0) {
       const { LoyaltyService } = await import('../users/loyalty.service');
       await LoyaltyService.awardCommission(tx, userId, margin, createdOrder.id);
     }
     ```
   - In `src/services/users/loyalty.service.ts` at line 76:
     ```typescript
     data: { referralBalance: { increment: commissionCents } }
     ```
     Which runs inside the order creation transaction.
   - In `src/actions/user/referral.action.ts` at lines 28-34:
     ```typescript
     await tx.user.update({
       where: { id: session.userId },
       data: {
         referralBalance: { decrement: transferAmount },
         balance: { increment: transferAmount }
       }
     });
     ```
     No check is performed on whether the commission is still in `PENDING` status.
   - In `src/services/core/order.service.ts` at lines 298-303:
     ```typescript
     const { LoyaltyService } = await import('../users/loyalty.service');
     if (internalStatus === 'COMPLETED') {
        await LoyaltyService.confirmCommission(tx, order.id);
     } else if (internalStatus === 'ERROR' || internalStatus === 'CANCELED') {
        await LoyaltyService.reverseCommission(tx, order.id);
     }
     ```
     This does not handle `internalStatus === 'PARTIAL'`.
   - In `src/services/users/loyalty.service.ts` at line 53:
     ```typescript
     if (referrer.referredById === referredUserId) {
     ```
     Only checks a 2-cycle relationship.

---

## 2. Logic Chain

1. **Race-to-Apply Assessment**:
   - Since all checkout order creation database logic runs inside a transaction with Serializable isolation level (`runSerializableTransaction`), concurrent requests trying to read and update the same `PromoCode` record will conflict. 
   - PostgreSQL forces one of the transactions to abort and fail with a serialization error.
   - The aborted transaction is retried up to 3 times, reloading the fresh `uses` counter and triggering the limit check before attempting the update.
   - Thus, concurrent bypass of `maxUses` (Race-to-Apply) is **prevented**.

2. **Promo Code Permanent Lock Assessment**:
   - When an order is created during checkout, the promo code's `uses` count is incremented.
   - If the payment process fails or is abandoned, the order status remains `AWAITING_PAYMENT`.
   - The cron job `cleanup.processor.ts` will later cancel this order by setting `status = 'CANCELED'`.
   - Because `cleanup.processor.ts` (and manual admin cancel) changes the order status without updating the related `PromoCode` `uses` counter, the slot remains occupied.
   - Thus, unpaid or failed orders permanently lock promo codes, creating a usability logic bug.

3. **Integer Budget Overflow Assessment**:
   - Zod allows any size of integer/float for the budget parameter (`z.coerce.number()`).
   - The code calculates `budgetCents = Math.round(budget * 100)`.
   - PostgreSQL restricts `budgetCents` to the range of `Int` (up to $2,147,483,647$).
   - If an admin creates a promo code with a budget of 21,500,000 rubles or more, `budgetCents` will exceed the maximum value.
   - PostgreSQL throws an integer overflow error during insertion, causing a 500 error / page crash.

4. **Negative Profitability Assessment**:
   - If a provider API reports a `remains` count higher than the original order `quantity`, `deliveredQty = order.quantity - order.remains` becomes negative.
   - In `getServiceProfitability`, the calculation multiplies order charge and provider cost by a negative ratio.
   - This returns negative revenue and negative COGS, corrupting the aggregated profitability charts.

5. **Referral Cash Out Exploit Assessment**:
   - Commissions are awarded (credited to `referralBalance`) immediately upon order creation.
   - Users can transfer `referralBalance` to their main balance at any time, even if the commission status is `PENDING`.
   - If the order subsequently fails or gets cancelled, the system tries to reverse the commission by decrementing `referralBalance`.
   - If the user has already transferred and spent the commission, their `referralBalance` drops below zero (e.g. `-500` rubles). The user retains the transferred main balance, resulting in a direct financial loss to the platform.

6. **Affiliate Leak Assessment**:
   - When an order becomes `PARTIAL` (e.g., via sync/webhook update), `processStatusUpdate` does not trigger commission reversal or adjustments.
   - The commission remains `PENDING` and is eventually marked `PAID` in `processPayout` without adjusting for the refunded amount.
   - Similarly, manual cancel by an admin does not trigger commission reversal, letting the affiliate keep 100% of the commission on refunded orders.

---

## 3. Caveats

- **External Integrations**: We did not verify how payment gateways (YooKassa, CryptoBot) handle refunds and whether they call order cancel hooks. If they do not call manual cancels through `adminOrderService.cancelOrder` but instead call `processStatusUpdate` with a `CANCELED` status, then the commission is reversed correctly (via `processStatusUpdate` line 302). However, admin manual cancellations still fail to reverse it.
- **Cycle Checks**: We assumed that no IP or device fingerprint mapping was implemented in the registration process. We verified this by checking the parameters inside `password-register.ts` and `request-magic-link.ts` which do not contain any correlation checks.

---

## 4. Conclusion

The Milestone M1 (R1) promo codes, UTM campaign, and referral system features are functionally operative but contain several severe logical and security vulnerabilities:
1. **Promo code lock**: Failed/unpaid orders permanently exhaust promo code uses.
2. **Budget overflow**: Budget parameters can cause DB-level integer overflow crashes.
3. **Negative analytics**: Glitched remains counts from provider APIs lead to negative revenue reports.
4. **Referral exploits**: Immediate credit and payout of pending commissions allows referrers to withdraw commissions on failed/refunded orders, leaving them with negative referral balances while keeping the cash. Manual cancellations and partial completions leak affiliate funds.

---

## 5. Verification Method

To verify these findings independently, inspect the following files and lines:
1. **Promo Code permanent lock**: Check `src/workers/processors/cleanup.processor.ts` at line 120 (no decrement logic).
2. **Integer Budget Overflow**: Check `src/actions/admin/marketing.ts` line 21 (Zod validation for `budget`) and `prisma/schema.prisma` line 107 (`budgetCents Int`).
3. **Negative Analytics**: Check `src/services/admin/analytics.service.ts` line 69 (`deliveredQty = order.quantity - order.remains`).
4. **Referral Cash Out Exploit**: Check `src/services/core/order.service.ts` line 110 (immediate credit) and `src/actions/user/referral.action.ts` line 22 (transfer allows any referral balance > 0).
5. **Referral Leak**: Check `src/services/core/order.service.ts` lines 297-303 (no check for `PARTIAL` status) and `src/services/admin/order.service.ts` line 262 (no reversal in manual cancel).
