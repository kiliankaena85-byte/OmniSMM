# Plan 002: Financial Transaction Integrity

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 885d26f..HEAD -- src/workers/processors/sync.processor.ts src/services/financial/wallet-ops.ts src/services/financial/refund-policy.service.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `885d26f`, 2026-06-11

## Why this matters

Financial integrity is paramount. This plan fixes two issues where race conditions or lack of validation could lead to incorrect financial states:
1. `sync.processor.ts` processes refunds without wrapping the order status update and the wallet refund in a single Prisma transaction, risking double-refunds or inconsistent states if one fails.
2. `WalletOps.adminAdjust` allows negative amounts to push a user's balance below zero without guardrails.

## Current state

- `src/workers/processors/sync.processor.ts`: Order status updates and refunds are separate operations.
  - e.g., line 152:
    ```typescript
    const updated = await db.order.update({ where: { id: order.id }, data: { status: 'CANCELED', remains: parsedRemains } });
    await RefundPolicyService.processRefund({ ...updated, charge: Number(updated.charge) }, '(Отмена на стороне провайдера)');
    ```
- `src/services/financial/wallet-ops.ts`: `adminAdjust` lacks a floor check for negative adjustments.
- `src/services/financial/refund-policy.service.ts`: `processRefund` needs to support an optional Prisma transaction client parameter.

## Smmplan default commands

| Purpose   | Command                     | Expected on success |
|-----------|-----------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`          | exit 0, no errors   |
| Lint      | `npm run lint`              | exit 0              |
| Test      | `npx vitest run`            | all pass            |

## Scope

**In scope**:
- `src/workers/processors/sync.processor.ts`
- `src/services/financial/wallet-ops.ts`
- `src/services/financial/refund-policy.service.ts`

**Out of scope**:
- `src/workers/processors/cleanup.processor.ts`
- `src/actions/`

## Steps

### Step 1: Update `RefundPolicyService.processRefund`

Modify `src/services/financial/refund-policy.service.ts` so `processRefund` accepts an optional Prisma transaction client.

```typescript
import { Prisma } from '@prisma/client';
// Update signature
export async function processRefund(
  order: any, // Use existing type
  reason?: string,
  txClient: Prisma.TransactionClient = db
) {
  // Replace internal `db.` calls with `txClient.` calls inside this method.
  // Ensure WalletOps.refund is also called with txClient if it supports it, 
  // or that the refund logic inside here uses txClient.
}
```
*(Review existing implementation in that file to ensure all DB calls use `txClient`)*. Note: `WalletOps.refund` in this project usually accepts `txClient` as the last argument.

### Step 2: Transactional refunds in `sync.processor.ts`

In `src/workers/processors/sync.processor.ts`, wrap the `db.order.update` and `RefundPolicyService.processRefund` calls in `db.$transaction`. Do this for the 3 locations handling `CANCELED` and `PARTIAL` status.

Example replacement for `CANCELED`:
```typescript
            await db.$transaction(async (tx) => {
              const updated = await tx.order.update({ where: { id: order.id }, data: { status: 'CANCELED', remains: parsedRemains } });
              await RefundPolicyService.processRefund({ ...updated, charge: Number(updated.charge) }, '(Отмена на стороне провайдера)', tx);
            });
```
Do the same for the other `PARTIAL` and `ERROR` conditions where `RefundPolicyService.processRefund` is called. Also update the Drip-Feed partial logic around line 116.

### Step 3: Add floor check to `adminAdjust`

In `src/services/financial/wallet-ops.ts`, inside `adminAdjust` (around line 166), add a check for negative amounts.

```typescript
    // Inside adminAdjust, when preparing the user update:
    if (amountCents < 0) {
      // For negative adjustments, we must ensure balance doesn't go below 0
      // Find the update call and add a WHERE condition:
      // where: { id: userId, balance: { gte: Math.abs(amountCents) } }
      // Alternatively, throw an error early if current balance + amountCents < 0
    }
```
If `adminAdjust` fetches the user first, just throw:
```typescript
    if (amountCents < 0 && user.balance < Math.abs(amountCents)) {
      throw new Error(`Insufficient balance for negative adjustment. User has ${user.balance}, trying to deduct ${Math.abs(amountCents)}.`);
    }
```

### Step 4: Verify

```bash
npx tsc --noEmit
```

## STOP conditions
- If `RefundPolicyService` already creates its own `$transaction` that prevents passing one from outside.

## Git workflow
Commit with: `fix: financial transaction integrity (plan 002)`
