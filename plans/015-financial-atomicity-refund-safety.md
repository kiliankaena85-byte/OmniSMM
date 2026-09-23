# Plan 015: Financial Atomicity & Refund Safety

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat HEAD -- src/services/financial/wallet-ops.ts src/services/financial/payment.service.ts src/services/admin/escrow.service.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED — touches critical financial write paths
- **Depends on**: none
- **Category**: bug + security
- **Planned at**: deep audit round 2, 2026-06-11

## Why this matters

1. **adminAdjust TOCTOU race (DEEP-015)**: The `adminAdjust` function in `wallet-ops.ts` performs a balance read via `findUnique` (line 179) and then writes via `update({ increment })` (line 197). Between the read and write, another concurrent transaction can change the balance, allowing negative balance overdraw. The `charge()` method correctly uses `updateMany WHERE balance >= amount`—`adminAdjust` must match.

2. **totalSpent negative underflow (DEEP-016)**: The `refund()` function decrements `totalSpent` unconditionally (line 254). Multiple cascading refunds (sync → TTL sweep → admin) can drive `totalSpent` below zero, corrupting P&L financial reports.

3. **confirmPayment missing Serializable (DEEP-019)**: The `confirmPayment` method in `payment.service.ts` uses `db.$transaction()` without specifying `isolationLevel: 'Serializable'` (line 66). YooKassa can deliver duplicate webhooks; at `ReadCommitted`, two concurrent confirmations can both pass the `status === 'PENDING'` check before either commits, causing double-credit.

4. **quarantineBalance underflow (DEEP-022)**: The `resolveQuarantine` REJECT path decrements `quarantineBalance` without a `>= entry.amount` guard. While the `updateMany({ status: QUARANTINE })` OCC check prevents double-resolve, PostgreSQL allows `quarantineBalance` to go negative.

## Current state

- `wallet-ops.ts:178-183` — `findUnique` + manual balance check for negative adjustments
- `wallet-ops.ts:254` — unconditional `totalSpent: { decrement: amountCents }`
- `payment.service.ts:66` — `db.$transaction(async (tx) => { ... })` with no isolation level
- `escrow.service.ts:265-268` — bare `decrement` on `quarantineBalance`

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`       | exit 0, no errors   |
| Tests     | `npx vitest run`         | all pass            |
| Lint      | `npm run lint`           | exit 0              |
| Build     | `npm run build`          | exit 0              |

## Scope

**In scope**:
- `src/services/financial/wallet-ops.ts`
- `src/services/financial/payment.service.ts`
- `src/services/admin/escrow.service.ts`

**Out of scope**:
- Refund idempotency key unification (different keys per path is by design)
- COGS aggregation (Plan 017)

## STOP conditions

- If `wallet-ops.ts` `charge()` method has changed its `updateMany` pattern
- If `payment.service.ts` already has `isolationLevel: 'Serializable'`
- If Prisma schema for `User.balance` or `User.totalSpent` has changed type

---

## Step 1: Fix `adminAdjust` TOCTOU race

**File**: `src/services/financial/wallet-ops.ts`

**Current** (lines 178-201):
```typescript
if (amountCents < 0) {
  const user = await tx.user.findUnique({ where: { id: userId }, select: { balance: true } });
  if (!user || user.balance < Math.abs(amountCents)) {
    throw new Error(`Insufficient balance for negative adjustment...`);
  }
}
// ...
const updatedUser = await tx.user.update({
  where: { id: userId },
  data: { balance: { increment: amountCents } },
  select: { balance: true }
});
```

**Target**: Replace `findUnique` + `update` with atomic `updateMany` pattern for negative adjustments:
```typescript
if (amountCents < 0) {
  const absAmount = Math.abs(amountCents);
  const updated = await tx.user.updateMany({
    where: { id: userId, balance: { gte: absAmount } },
    data: { balance: { decrement: absAmount } },
  });
  if (updated.count === 0) {
    throw new Error(`Insufficient balance for negative adjustment. Deduction of ${absAmount} rejected atomically.`);
  }
  // Fetch updated balance for return value
  const updatedUser = await tx.user.findUnique({ where: { id: userId }, select: { balance: true } });
  // Skip the normal update below (already done)
  // ...proceed to ledger entry creation
}
```

> ⚠️ The positive-amount path (`amountCents > 0`) remains unchanged—it's a simple increment that can't overdraw.

**Verify**: `npx tsc --noEmit`

---

## Step 2: Guard `totalSpent` against negative underflow in `refund()`

**File**: `src/services/financial/wallet-ops.ts`

**Current** (line 250-255):
```typescript
const updatedUser = await tx.user.update({
  where: { id: userId },
  data: {
    balance: { increment: amountCents },
    totalSpent: { decrement: amountCents }
  },
```

**Target**: Use `$queryRaw` or conditional logic to prevent negative `totalSpent`:
```typescript
// Read current totalSpent first to cap the decrement
const currentUser = await tx.user.findUnique({
  where: { id: userId },
  select: { totalSpent: true }
});
const safeDecrement = Math.min(amountCents, Number(currentUser?.totalSpent ?? 0));

const updatedUser = await tx.user.update({
  where: { id: userId },
  data: {
    balance: { increment: amountCents },
    totalSpent: safeDecrement > 0 ? { decrement: safeDecrement } : undefined
  },
  select: { balance: true }
});
```

**Verify**: `npx tsc --noEmit`

---

## Step 3: Add Serializable isolation to `confirmPayment`

**File**: `src/services/financial/payment.service.ts`

**Current** (line 66):
```typescript
await db.$transaction(async (tx) => {
```

**Target** (add isolation level):
```typescript
await db.$transaction(async (tx) => {
```
→
```typescript
await db.$transaction(async (tx) => {
  // ... body unchanged
}, { isolationLevel: 'Serializable' });
```

Find the closing `});` of the transaction (should be around line 210-220) and add `{ isolationLevel: 'Serializable' }`.

**Verify**: `npx tsc --noEmit`

---

## Step 4: Guard `quarantineBalance` decrement in escrow REJECT

**File**: `src/services/admin/escrow.service.ts`

**Current** (lines 265-268):
```typescript
await tx.user.update({
  where: { id: entry.userId },
  data: { quarantineBalance: { decrement: entry.amount } },
});
```

**Target**: Use `updateMany` with `gte` guard:
```typescript
const qUpdate = await tx.user.updateMany({
  where: { id: entry.userId, quarantineBalance: { gte: entry.amount } },
  data: { quarantineBalance: { decrement: entry.amount } },
});
if (qUpdate.count === 0) {
  // Quarantine balance already drained (edge case) — force to 0
  await tx.user.update({
    where: { id: entry.userId },
    data: { quarantineBalance: 0 },
  });
}
```

**Verify**: `npx tsc --noEmit`

---

## Step 5: Final verification

```bash
npx tsc --noEmit
npm run lint
npx vitest run
npm run build
```

All must pass. If any fail, stop and report.
