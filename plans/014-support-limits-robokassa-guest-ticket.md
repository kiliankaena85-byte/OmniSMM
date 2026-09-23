# Plan 014: Robokassa Webhook Password, Support Limit Fix & Guest Ticket Transaction

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat be97815..HEAD -- prisma/schema.prisma src/lib/settings.ts src/actions/admin/settings.ts src/app/admin/settings/integrations-settings.tsx src/app/api/webhooks/robokassa/route.ts src/actions/support/compensation.ts src/actions/support/ticket.ts src/actions/support/guest.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug + security
- **Planned at**: commit `be97815`, 2026-06-11

## Why this matters

1. **Broken Robokassa Password Config**: Robokassa requires two separate secret passwords: Password#1 for link creation (signature calculation) and Password#2 for webhook confirmation. Currently, both initiation and verification use the single `robokassaPassword` field, making production payments fail cryptographic checks.
2. **Permanent Depletion of Support Limit Cap**: The `logManualCompensation` action permanently decrements the operator's `supportLimitCents` cap on the `User` row instead of tracking daily reset limits. This causes lifetime limit depletion.
3. **TOCTOU Race Condition in Bulk Refund**: Bulk refunds execute individual transactions checking operator limits sequentially in a loop. Concurrent requests allow operators to bypass limit caps.
4. **Transaction Gap in Guest Ticket**: Creation of guest tickets and their initial message is done sequentially without a transaction, leading to orphaned ticket shells if message creation fails.

## Current state

- Relevant files:
  - [schema.prisma](file:///d:/SMM_plan_2/prisma/schema.prisma) — holds `SystemSettings` schema (line 448)
  - [settings.ts](file:///d:/SMM_plan_2/src/lib/settings.ts) — loads and decrypts keys (lines 6–12, 165–195)
  - [settings.ts](file:///d:/SMM_plan_2/src/actions/admin/settings.ts) — saves settings and runs Zod validation (lines 80–81, 139)
  - [integrations-settings.tsx](file:///d:/SMM_plan_2/src/app/admin/settings/integrations-settings.tsx) — renders admin form inputs (lines 161–182)
  - [route.ts](file:///d:/SMM_plan_2/src/app/api/webhooks/robokassa/route.ts) — validates ResultURL signature (line 50)
  - [compensation.ts](file:///d:/SMM_plan_2/src/actions/support/compensation.ts) — manual support compensation (lines 35–39, 58–66)
  - [ticket.ts](file:///d:/SMM_plan_2/src/actions/support/ticket.ts) — bulk refund orders and `getAdminSpentToday` (lines 535–585, 619–642)
  - [guest.ts](file:///d:/SMM_plan_2/src/actions/support/guest.ts) — guest ticket creation (lines 69–85)

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `npm install`            | exit 0              |
| DB Mig    | `npx prisma migrate dev --name add_robokassa_webhook_password --create-only` | exit 0 |
| Typecheck | `npx tsc --noEmit`       | exit 0, no errors   |
| Tests     | `npx vitest run`         | all pass            |
| Lint      | `npm run lint`           | exit 0              |

## Scope

**In scope**:
- `prisma/schema.prisma`
- `src/lib/settings.ts`
- `src/actions/admin/settings.ts`
- `src/validators/admin.validators.ts`
- `src/app/admin/settings/integrations-settings.tsx`
- `src/app/api/webhooks/robokassa/route.ts`
- `src/actions/support/compensation.ts`
- `src/actions/support/ticket.ts`
- `src/actions/support/guest.ts`

**Out of scope**:
- Directly altering other payment gateway logic (YooKassa, CryptoBot).

---

## Steps

### Step 1: Add `robokassaWebhookPassword` to SystemSettings Schema
Modify `prisma/schema.prisma` to add a new optional encrypted field `robokassaWebhookPassword` for Password#2 under the `SystemSettings` model.

```diff
   // Robokassa (encrypted)
   robokassaLogin    String?
   robokassaPassword String?
+  robokassaWebhookPassword String?
```

Run command:
`npx prisma migrate dev --name add_robokassa_webhook_password` to generate and apply the database schema migration.

### Step 2: Update Settings Provider and Actions
1. Edit `src/lib/settings.ts` to include `robokassaWebhookPassword` in the decrypted payment secrets return interface.
```diff
 export interface DecryptedPaymentSecrets {
   yookassaShopId: string | null;
   yookassaSecretKey: string | null;
   cryptoBotToken: string | null;
   robokassaLogin: string | null;
   robokassaPassword: string | null;
+  robokassaWebhookPassword: string | null;
 }
```
In `getPaymentSecrets()` decrypt `robokassaWebhookPassword`:
```diff
     return {
       yookassaShopId: shopId,
       yookassaSecretKey: secretKeyRaw ? VaultService.decrypt(secretKeyRaw) : null,
       cryptoBotToken: settings.cryptoBotToken ? VaultService.decrypt(settings.cryptoBotToken) : null,
       robokassaLogin: settings.robokassaLogin ?? null,
-      robokassaPassword: settings.robokassaPassword ? VaultService.decrypt(settings.robokassaPassword) : null
+      robokassaPassword: settings.robokassaPassword ? VaultService.decrypt(settings.robokassaPassword) : null,
+      robokassaWebhookPassword: settings.robokassaWebhookPassword ? VaultService.decrypt(settings.robokassaWebhookPassword) : null
     };
```

2. Edit `src/validators/admin.validators.ts` to add validation in `globalSettingsSchema`:
```diff
   robokassaLogin: z.string().trim().max(150).nullable().optional(),
   robokassaPassword: z.string().trim().max(300).nullable().optional(),
+  robokassaWebhookPassword: z.string().trim().max(300).nullable().optional(),
```

3. Edit `src/actions/admin/settings.ts` to encrypt and save `robokassaWebhookPassword`:
```diff
       robokassaLogin,
       robokassaPassword: rawRobokassaPassword,
+      robokassaWebhookPassword: rawRobokassaWebhookPassword,
...
     if (robokassaLogin) dataToUpdate.robokassaLogin = robokassaLogin;
     if (rawRobokassaPassword) dataToUpdate.robokassaPassword = VaultService.encrypt(rawRobokassaPassword);
+    if (rawRobokassaWebhookPassword) dataToUpdate.robokassaWebhookPassword = VaultService.encrypt(rawRobokassaWebhookPassword);
```

### Step 3: Update Robokassa Webhook Web Handler & Admin UI
1. Edit `src/app/api/webhooks/robokassa/route.ts` to use `secrets.robokassaWebhookPassword` (Password#2) instead of `secrets.robokassaPassword` for ResultURL check:
```diff
-    const password = secrets.robokassaPassword;
+    const password = secrets.robokassaWebhookPassword;
```

2. Edit `src/app/admin/settings/integrations-settings.tsx` to display input fields for both Password#1 (link creation) and Password#2 (ResultURL):
```diff
             {/* Robokassa */}
             <div className="space-y-4">
               <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border pb-1">Robokassa (Fiat)</div>
-              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
+              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="space-y-2">
                   <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Идентификатор магазина (Merchant Login)</Label>
                   <Input
                     name="robokassaLogin"
                     defaultValue={settings.robokassaLogin || ''}
                     placeholder="Идентификатор магазина"
                   />
                 </div>
                 <div className="space-y-2">
-                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Пароль 2 (для Webhook / ResultURL)</Label>
+                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Пароль 1 (для инициализации оплаты)</Label>
                   <Input
                     name="robokassaPassword"
                     type="password"
                     placeholder={settings.robokassaPassword ? '••••••••••••••••' : 'Не настроено'}
                   />
                 </div>
+                <div className="space-y-2">
+                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Пароль 2 (для Webhook / ResultURL)</Label>
+                  <Input
+                    name="robokassaWebhookPassword"
+                    type="password"
+                    placeholder={settings.robokassaWebhookPassword ? '••••••••••••••••' : 'Не настроено'}
+                  />
+                </div>
               </div>
             </div>
```

### Step 4: Fix Permanent depletion and TOCTOU Race Condition in support limits
1. Export `getAdminSpentToday` from `src/actions/support/ticket.ts` (lines 619).
```diff
-async function getAdminSpentToday(adminId: string, tx?: any): Promise<number> {
+export async function getAdminSpentToday(adminId: string, tx?: any): Promise<number> {
```

2. Edit `src/actions/support/compensation.ts`:
- Import `getAdminSpentToday` from `./ticket`.
- In `logManualCompensation` (lines 35–39), check remaining limit using `getAdminSpentToday`:
```typescript
  const currentSpentToday = await getAdminSpentToday(user.id);
  const limitLeft = user.supportLimitCents - currentSpentToday;
  if (!isOwner && limitLeft < costCents) {
    throw new Error('Недостаточно лимита доверия на сегодня');
  }
```
- In the transaction (lines 58–66), remove the permanent `supportLimitCents` decrement query entirely.

3. Edit `src/actions/support/ticket.ts` to prevent TOCTOU race conditions during bulk refunds:
- Calculate total refund amount for all requested `orderIds` first.
- Wrap the limit verification and the loops in a single Serializable transaction check:
```typescript
  return requireStaffPermission('support', 'edit', async (admin) => {
    ...
    await db.$transaction(async (tx) => {
      // Calculate total refund cents first
      let totalToRefundCents = 0;
      const calculatedRefunds = [];

      for (const orderId of orderIds) {
         const order = await tx.order.findUnique({ where: { id: orderId } });
         if (order && !['CANCELED', 'PARTIAL'].includes(order.status) && order.remains > 0) {
            const calculatedAmount = calculatePartialRefund({
              remains: order.remains,
              quantity: order.quantity,
              charge: order.charge
            });
            if (calculatedAmount > 0) {
              totalToRefundCents += calculatedAmount;
              calculatedRefunds.push({ order, calculatedAmount });
            }
         }
      }

      if (totalToRefundCents > 0 && !isB2bClient) {
        const currentSpentToday = await getAdminSpentToday(admin.id, tx);
        const limitLeft = admin.supportLimitCents - currentSpentToday;
        if (totalToRefundCents > limitLeft) {
          throw new Error(`Превышен суточный лимит компенсаций оператора. Требуется: ${(totalToRefundCents / 100).toFixed(2)} ₽, Осталось: ${(limitLeft / 100).toFixed(2)} ₽`);
        }
      }

      // Perform updates
      for (const item of calculatedRefunds) {
         await tx.order.update({
           where: { id: item.order.id },
           data: { status: 'PARTIAL' }
         });

         const idempotencyKey = `refund_ticket_${ticketId}_order_${item.order.id}`;
         await WalletOps.refund(tx, ticket.userId, item.calculatedAmount,
           `Компенсация (частичный возврат) по тикету #${ticketId} за недовыполненный заказ #${item.order.numericId}`,
           { idempotencyKey, adminId: admin.id }
         );
         
         processedCount++;
         totalRefundedCents += item.calculatedAmount;
      }
    }, { isolationLevel: 'Serializable' });
```

### Step 5: Wrap Guest Ticket Creation in Database Transaction
Modify `src/actions/support/guest.ts` (lines 69–85) to execute ticket creation and initial ticket message creation atomically inside a transaction block.

```typescript
    // 5. Create Ticket and Initial Message atomically
    await db.$transaction(async (tx) => {
      const ticket = await tx.ticket.create({
        data: {
          userId: user.id,
          subject: `Вопрос от гостя: ${name}`,
          source: "EMAIL",
          status: "OPEN"
        }
      });

      await tx.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          sender: "USER",
          text: message
        }
      });
    });
```

## STOP conditions

- If any database migration script fails or aborts due to locked tables, stop and report.
- If typecheck or test commands fail after modifications, revert and investigate.
