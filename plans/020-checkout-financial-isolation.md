# Plan 020: Checkout Financial Isolation

## Status
- **Priority**: P1
- **Effort**: S
- **Risk**: MED
- **Depends on**: none
- **Category**: bug, security

## Why this matters
The `src/actions/order/checkout.ts` file handles the creation of orders and balance deductions. Without `{ isolationLevel: 'Serializable' }` on its Prisma `$transaction` blocks, concurrent requests for the same user could simultaneously read a sufficient balance, pass the validation check, and deduct funds, resulting in a negative balance and a double-spend exploit.

## Current state
- `src/actions/order/checkout.ts`
  - Lines ~346: `const result = await db.$transaction(async (tx) => {`
  - Lines ~694: `const result = await db.$transaction(async (tx) => {`

## Smmplan default commands
| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | exit 0, no errors |
| Lint | `npm run lint` | exit 0 |
| Test | `npx vitest run src/actions/order/__tests__/checkout.test.ts` | all pass |
| Build | `npm run build` | exit 0 |

## Scope
**In scope**:
- `src/actions/order/checkout.ts`

**Out of scope**:
- All other files.

## Steps

### Step 1: Add isolation to primary checkout
In `src/actions/order/checkout.ts`, locate the first `$transaction` around line 346.
Add the options object to specify the isolation level.

Before:
```typescript
    const result = await db.$transaction(async (tx) => {
```
After:
```typescript
    const result = await db.$transaction(async (tx) => {
      // ... content
    }, { isolationLevel: 'Serializable' });
```

### Step 2: Add isolation to Mass Order checkout
In `src/actions/order/checkout.ts`, locate the second `$transaction` around line 694 (used by mass order processing).
Add the options object.

Before:
```typescript
    const result = await db.$transaction(async (tx) => {
```
After:
```typescript
    const result = await db.$transaction(async (tx) => {
      // ... content
    }, { isolationLevel: 'Serializable' });
```

### Step 3: Verify
Run `npx tsc --noEmit` and the vitest checkout suite.

## Git workflow
Commit with: `fix: add serializable isolation to checkout transactions (plan 020)`
