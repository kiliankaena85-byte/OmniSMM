# Plan 011: Security, Bound-Merge & Loss-Prevention Correctness

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat be97815..HEAD -- src/bot/index.ts src/actions/support/ticket.ts src/services/providers/quarantine.service.ts src/services/admin/escrow.service.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security + bug
- **Planned at**: commit `be97815`, 2026-06-11

## Why this matters

1. **Telegram Binding Data Integrity**: The automatic Telegram bot binding flow deletes a temporary user stub without updating or merging relational tables like `order`, `payment`, `ledgerEntry`, `invoice`, and `auditLog` first. This causes database foreign key constraint crashes or dangling orphaned records. Manual admin bind merges these correctly; the bot auto-bind must do the same.
2. **Support Spent Limit Timezone/Bypass**: Daily support spent limits are calculated using the server's local timezone (`new Date()`) instead of Moscow midnight (UTC+3). Additionally, the limit can be bypassed by specifying any reason that does not contain the word 'Компенсация' in the balance adjustment.
3. **Loss Prevention Calculation**: `isLossBreach` assumes the provider rate is in USD and multiplies it by `usdToRub` unconditionally. When the provider is operating in RUB, this leads to incorrect loss prevention deactivation triggers.

## Current state

- Relevant files:
  - [index.ts](file:///d:/SMM_plan_2/src/bot/index.ts) — Telegram bot instance, commands, and start auto-bind sequence (lines 110–140)
  - [ticket.ts](file:///d:/SMM_plan_2/src/actions/support/ticket.ts) — support actions, including `getAdminSpentToday` (lines 619–642)
  - [quarantine.service.ts](file:///d:/SMM_plan_2/src/services/providers/quarantine.service.ts) — quarantine and pricing checks, including `isLossBreach` (lines 201–207)
  - [escrow.service.ts](file:///d:/SMM_plan_2/src/services/admin/escrow.service.ts) — defines `getMSKMidnightUTC()` (lines 18–25)

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `npm install`            | exit 0              |
| Typecheck | `npx tsc --noEmit`       | exit 0, no errors   |
| Tests     | `npx vitest run test/unit/elastic-pricing-prevention.test.ts` | all pass |
| Lint      | `npm run lint`           | exit 0              |

## Scope

**In scope**:
- `src/bot/index.ts`
- `src/actions/support/ticket.ts`
- `src/services/providers/quarantine.service.ts`
- `src/services/admin/escrow.service.ts`

**Out of scope**:
- Direct execution of database migrations or modifying `schema.prisma`.
- Modifying other commands in the Telegram bot wizard scenes.

---

## Steps

### Step 1: Export `getMSKMidnightUTC`
Modify `src/services/admin/escrow.service.ts` to export the timezone utility function so it can be imported by the support ticket module.

```diff
-function getMSKMidnightUTC(): Date {
+export function getMSKMidnightUTC(): Date {
   const now = new Date();
```

### Step 2: Fix timezone and filter bypass in `getAdminSpentToday`
Edit `src/actions/support/ticket.ts`:
1. Import `getMSKMidnightUTC` from `@/services/admin/escrow.service`.
2. Update `getAdminSpentToday` to use `getMSKMidnightUTC()` instead of local `new Date()` reset.
3. Remove the filter `reason: { contains: 'Компенсация' }` so all manual ledger adjustments created by the support operator count toward their daily limit.

```diff
+import { getMSKMidnightUTC } from '@/services/admin/escrow.service';
...
 async function getAdminSpentToday(adminId: string, tx?: any): Promise<number> {
-  const todayStart = new Date();
-  todayStart.setHours(0, 0, 0, 0);
+  const todayStart = getMSKMidnightUTC();
 
   const client = tx || db;
   const ledgerCompensations = await client.ledgerEntry.findMany({
     where: {
       adminId,
       createdAt: { gte: todayStart },
-      reason: {
-        contains: 'Компенсация'
-      }
     },
     select: {
       amount: true
     }
   });
```

Verify Step 2:
- Run `npx tsc --noEmit` and `npm run lint` to ensure no compile or format errors.

### Step 3: Wrap auto-bind merge in transaction with all relation updates
In `src/bot/index.ts`, update the `$transaction` merge logic inside the start command handler to update all relational data before deleting the user stub, matching the manual admin merge logic.

```diff
           if (tempUser && tempUser.id !== webUserId) {
             // Merge: move tickets to main account
             await tx.ticket.updateMany({
               where: { userId: tempUser.id },
               data: { userId: webUserId }
             });
+            
+            // Merge other relational tables
+            await tx.order.updateMany({ where: { userId: tempUser.id }, data: { userId: webUserId } });
+            await tx.payment.updateMany({ where: { userId: tempUser.id }, data: { userId: webUserId } });
+            await tx.ledgerEntry.updateMany({ where: { userId: tempUser.id }, data: { userId: webUserId } });
+            await tx.invoice.updateMany({ where: { userId: tempUser.id }, data: { userId: webUserId } });
+            await tx.auditLog.updateMany({ where: { userId: tempUser.id }, data: { userId: webUserId } });
             
             // Delete temp user if it's a pure bot stub
             if (tempUser.email.startsWith('tg_')) {
```

### Step 4: Fix `isLossBreach` provider currency parameter naming
Modify `src/services/providers/quarantine.service.ts` to rename the `usdToRub` argument to `exchangeRate` to indicate it is a general exchange rate (1.0 for RUB, usdToRub for USD).

```diff
-    static isLossBreach(newRate: number, markup: number, usdToRub: number): boolean {
-        const pricePer1kRub = newRate * markup * usdToRub;
+    static isLossBreach(newRate: number, markup: number, exchangeRate: number): boolean {
+        const pricePer1kRub = newRate * markup * exchangeRate;
         const pricePer1kRubRounded = applyBeautifulRounding(pricePer1kRub);
         const pricePerUnitRub = pricePer1kRubRounded / 1000;
-        const purchaseCostPerUnitRub = (newRate * usdToRub) / 1000;
+        const purchaseCostPerUnitRub = (newRate * exchangeRate) / 1000;
         return pricePerUnitRub < purchaseCostPerUnitRub;
     }
```

Verify Step 4:
- Run `npx vitest run test/unit/elastic-pricing-prevention.test.ts` to make sure existing tests still pass.

## STOP conditions

- If any of the in-scope files have drifted significantly in structure, stop and report.
- If typecheck or test commands fail after modifications, revert and investigate.
