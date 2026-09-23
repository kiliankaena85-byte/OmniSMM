# Security and Business Logic Audit Report - Milestone M1 (R1)
**Date**: 2026-07-04  
**Auditor**: Teamwork Preview Explorer  
**Scope**: Promo codes, UTM campaigns, and referral system security & business logic.

---

## Executive Summary
A thorough security and business logic audit was conducted for Milestone M1 (R1) on the Smmplan codebase. 
- **Race-to-Apply**: Structural locks are secure (implemented via Serializable transactions and atomic updates), but a severe business logic defect exists where promo codes are permanently locked on unpaid/failed/cancelled orders.
- **Financial Calculations**: Basic division-by-zero protections are in place. However, a range overflow vulnerability was identified in the promo code budget creation, and a logical sign defect exists in the profitability analytics calculations when remains exceed order quantity.
- **Referral Fraud**: Multiple critical vulnerabilities were discovered in the referral commission lifecycle, including instant cash-out of pending commissions, negative balance exploits, missing reversals on manual/partial cancellations, and bypassable self-referral cycle checks.

---

## 1. Race-to-Apply & Promo Code Usages Lifecycle

### Findings
1. **Parallel Application Protection (Secure)**:
   - **Locations**: `src/services/marketing.service.ts` (`consumePromoCode` lines 162-188) and `src/actions/order/checkout.ts` (`runSerializableTransaction` line 364).
   - **Mechanisms**: Promo code consumption is wrapped inside a Serializable transaction (`runSerializableTransaction`) during checkout. When concurrent requests try to apply the same promo code, PostgreSQL detects read-write conflict cycles and aborts one of them, forcing a retry. On retry, the promo code's updated `uses` count is loaded, the limit check triggers, and it aborts. 
   - **Additional Safety**: Even without Serializable isolation, `tx.promoCode.update` returns the updated row with atomic increments. If `uses > maxUses` (checked on lines 185-187 in `marketing.service.ts`), it throws an error which rolls back the transaction.

2. **Promo Code Permanent Lock on Failed/Unpaid/Cancelled Orders (Logic Defect)**:
   - **Locations**: `src/actions/order/checkout.ts` (lines 480-483), `src/workers/processors/cleanup.processor.ts` (lines 110-127), `src/services/admin/order.service.ts` (`cancelOrder` lines 230-290), `src/services/core/order.service.ts` (`failOrderTerminal`/`failOrderTerminalFast`).
   - **Mechanisms**: 
     - During checkout, if a user selects a non-balance payment (e.g. `yookassa`), the order is created in `AWAITING_PAYMENT` state, and the promo code's `uses` is immediately incremented (lines 481-483 of `checkout.ts`).
     - If the user fails to pay or abandons the session, the order is eventually updated to `CANCELED` by the daily cleanup cron job (`runCleanup()` in `cleanup.processor.ts`). However, this cleanup block **does not decrement** the promo code's `uses` counter.
     - Similarly, if an admin manually cancels an order (`adminOrderService.cancelOrder`) or if the order fails in processing (`failOrderTerminal` or `failOrderTerminalFast`), the promo code's `uses` counter is never decremented/released.
     - **Impact**: Users who abandon checkout or experience order processing failures permanently lose their promo code usage slot, causing customer dissatisfaction and stuck states.

---

## 2. Financial Calculations & Analytical Precision

### Findings
1. **Division-by-Zero Checks (Secure)**:
   - **Locations**: `src/app/admin/marketing/promocode-columns.tsx` (lines 258, 278) and `src/services/admin/analytics.service.ts` (line 68).
   - **Mechanisms**:
     - The CAC calculation checks `if (count === 0 || budgetRub === 0)` before dividing.
     - The ROMI calculation checks `if (budgetRub === 0)` before dividing.
     - The service profitability calculation checks `if (order.quantity > 0)` before dividing.

2. **Integer Overflow in Promo Code Budget (Vulnerability)**:
   - **Locations**: `src/actions/admin/marketing.ts` (lines 21, 70) and `prisma/schema.prisma` (line 107).
   - **Mechanisms**:
     - The `budget` field in `promoCodeSchema` has no `.max()` constraint in Zod (line 21).
     - In `createPromoCode`, `budgetCents = Math.round(budget * 100)` is calculated (line 70) and passed to `adminMarketingService.createPromoCode()`.
     - In `prisma/schema.prisma` (line 107), `budgetCents` in the `PromoCode` model is defined as an `Int` (32-bit signed integer).
     - **Impact**: If an operator inputs a budget of 21.5 million rubles or higher, `budgetCents` will exceed $2,147,483,647$ cents, causing a database-level integer overflow error (Prisma error `P2020`) and crashing the admin action.

3. **Profitability Analytics Sign Defect (Logical Bug)**:
   - **Locations**: `src/services/admin/analytics.service.ts` (`getServiceProfitability` lines 68-71).
   - **Mechanisms**:
     - The system calculates delivered quantity as `deliveredQty = order.quantity - order.remains`.
     - In the event of provider API sync glitches or initial count mismatches, `order.remains` can exceed `order.quantity`.
     - When `order.remains > order.quantity`, `deliveredQty` becomes negative.
     - **Impact**: Revenue and COGS are calculated using `deliveredQty / order.quantity`, which results in negative revenue and negative COGS being accumulated into the service and category analytics reports, distorting financial statistics.

---

## 3. Referral System Integrity & Fraud Audits

### Findings
1. **Incomplete Self-Referral Cycle Protection (Security Flaw)**:
   - **Locations**: `src/services/users/loyalty.service.ts` (lines 41-56).
   - **Mechanisms**:
     - The cycle check only checks if `referrer.referredById === referredUserId` (2-cycle check). It fails to detect larger cycles (e.g. `A -> B -> C -> A`).
     - Furthermore, there is no check to correlate users by registration IP address, session fingerprint, device metadata, or phone hash. User A can easily log out, click their own referral link, register User B, and earn commissions on User B's orders.

2. **Instant Credit of Pending Commissions (Architectural Vulnerability)**:
   - **Locations**: `src/services/core/order.service.ts` (lines 107-111).
   - **Mechanisms**:
     - When an order is placed and paid, the commission is created as `PENDING` (which is correct), but `LoyaltyService.awardCommission` immediately updates the referrer's `referralBalance` by incrementing it by the commission amount.
     - The referrer is then able to call `transferReferralBalanceAction` (in `src/actions/user/referral.action.ts`) to move the funds to their main balance and spend them **before the order is completed**.

3. **Negative balance / Cash Out Exploit (Financial Risk)**:
   - **Locations**: `src/services/users/loyalty.service.ts` (`reverseCommission` lines 121-146).
   - **Mechanisms**:
     - If the order later fails or is cancelled, `reverseCommission` decrements `referralBalance`.
     - If the referrer has already transferred and spent the commission, their `referralBalance` drops below zero (e.g., `-50000` cents). 
     - **Impact**: Referrers can withdraw the referral commission, spend it on other orders, and abandon the account if it goes negative, causing a direct financial loss for the platform.

4. **Missing Reversal on Admin Manual Cancellation (Financial Leak)**:
   - **Locations**: `src/services/admin/order.service.ts` (`cancelOrder` lines 230-290).
   - **Mechanisms**:
     - When an operator manually cancels an order through `adminOrderService.cancelOrder`, the order status is set to `CANCELED` and a refund is issued to the buyer. However, `LoyaltyService.reverseCommission` is never called.
     - **Impact**: Referrers keep their commission forever on orders manually cancelled by admin staff.

5. **Missing Reversal on Partial Orders (Financial Leak)**:
   - **Locations**: `src/services/core/order.service.ts` (`processStatusUpdate` lines 297-303).
   - **Mechanisms**:
     - In `processStatusUpdate`, if an order status is updated to `PARTIAL`, the referral commission is neither confirmed nor reversed (it only handles `COMPLETED`, `ERROR`, or `CANCELED`).
     - Since the commission remains in `PENDING` status, it is never reversed, and during the admin payout processing (`processPayout` in `marketing.service.ts` line 168), all `PENDING` commissions are set to `PAID`.
     - **Impact**: Referrers keep 100% of the commission even if the order was only partially fulfilled and the buyer received a 99% refund.
