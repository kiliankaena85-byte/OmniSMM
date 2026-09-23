# Plan 013: Idempotency, DX & Cleanup

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat be97815..HEAD -- src/actions/admin/marketing.ts src/actions/user/referral.action.ts package.json tsconfig.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt + dx
- **Planned at**: commit `be97815`, 2026-06-11

## Why this matters

1. **Idempotency Key Collisions in Referral Payouts/Transfers**: The keys used for referral payouts (`referral-payout-${userId}`) and transfers (`referral-transfer-${session.userId}-${transferAmount}`) are static or dependent only on user and amount. Once a user performs a transfer or payout once, they are blocked from performing another transfer of the same amount or any payout at all due to uniqueness constraints.
2. **Invalid Next.js Webpack CLI Flag**: The `build` script in `package.json` contains a deprecated `--webpack` flag that triggers console warnings.
3. **Excluded Test Folder from Typecheck**: The `test/` directory is excluded from `tsconfig.json`, making typechecking blind to compile errors in unit/integration tests.

## Current state

- Relevant files:
  - [marketing.service.ts](file:///d:/SMM_plan_2/src/services/admin/marketing.service.ts) — processes admin referral payouts and generates its static idempotency key (line 143)
  - [referral.action.ts](file:///d:/SMM_plan_2/src/actions/user/referral.action.ts) — client referral balance transfer action and its idempotency key (line 53)
  - [package.json](file:///d:/SMM_plan_2/package.json) — build script command with `--webpack` flag (line 7)
  - [tsconfig.json](file:///d:/SMM_plan_2/tsconfig.json) — TypeScript config excluding the `test/` folder (line 44)

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `npm install`            | exit 0              |
| Typecheck | `npx tsc --noEmit`       | exit 0, no errors   |
| Tests     | `npx vitest run`         | all pass            |
| Lint      | `npm run lint`           | exit 0              |
| Build     | `npm run build`          | exit 0, no warnings |

## Scope

**In scope**:
- `src/services/admin/marketing.service.ts`
- `src/actions/user/referral.action.ts`
- `package.json`
- `tsconfig.json`

**Out of scope**:
- Direct modifications to the referral system rules, database schemas, or Prisma models.

---

## Steps

### Step 1: Add uniqueness elements to referral idempotency keys
Update the generated idempotency keys to incorporate a unique element (like a timestamp/Date.now() or UUID) to allow multiple withdrawals.

1. In `src/services/admin/marketing.service.ts` (around line 143), update the key to include the timestamp:
```diff
       await tx.ledgerEntry.create({
         data: {
           userId,
           adminId: adminId,
           amount: amountToPayCents,
           reason: `Выплата реферального баланса (admin payout)`,
           status: 'APPROVED',
-          idempotencyKey: `referral-payout-${userId}`
+          idempotencyKey: `referral-payout-${userId}-${Date.now()}`
         },
       });
```

2. In `src/actions/user/referral.action.ts` (around line 53), update the transfer key:
```diff
     await tx.ledgerEntry.create({
       data: {
         userId: session.userId,
         amount: transferAmount,
         reason: `Перевод реферального баланса на основной`,
         status: 'APPROVED',
-        idempotencyKey: `referral-transfer-${session.userId}-${transferAmount}`
+        idempotencyKey: `referral-transfer-${session.userId}-${transferAmount}-${Date.now()}`
       }
     });
```

### Step 2: Remove `--webpack` flag from Next build
Edit `package.json` and modify script `"build"` to remove the deprecated `--webpack` flag.

```diff
   "scripts": {
     "dev": "next dev",
-    "build": "next build --webpack",
+    "build": "next build",
     "start": "next start",
```

### Step 3: Include `test/` folder in typechecking
Edit `tsconfig.json` and remove `"test/**/*"` from the `"exclude"` array.

```diff
   "exclude": [
     "node_modules",
     "scratch/**/*",
-    "prisma/seed.ts",
-    "test/**/*"
+    "prisma/seed.ts"
   ]
```

Verify Step 3:
- Run `npx tsc --noEmit` to ensure the tests folder successfully compile-checks and that no new TypeScript errors are flagged.

## STOP conditions

- If including the `test/` folder surfaces unresolvable TypeScript type mismatches in external test frameworks, report the specific errors.
