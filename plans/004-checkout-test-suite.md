# Plan 004: Checkout Test Suite

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `885d26f`, 2026-06-11

## Why this matters

`checkout.ts` handles payment creation, wallet deduction, idempotency, promo code consumption, and order dispatch. It's an 800+ line file on the most critical financial path with ZERO tests. This creates massive risk for any future refactoring.

## Current state

- `src/actions/order/checkout.ts` exists and is highly complex.
- `src/actions/order/__tests__/checkout.test.ts` does not exist.

## Smmplan default commands

| Purpose   | Command                     | Expected on success |
|-----------|-----------------------------|---------------------|
| Test      | `npx vitest run src/actions/order/__tests__/checkout.test.ts` | pass |

## Scope

**In scope**:
- `src/actions/order/__tests__/checkout.test.ts` (create)

**Out of scope**:
- `src/actions/order/checkout.ts` (do NOT modify source, only test it)

## Steps

### Step 1: Create test file scaffold

Create `src/actions/order/__tests__/checkout.test.ts`. Use Vitest. Mock Prisma and necessary services (like `paymentService`).

Follow the pattern established in `src/actions/admin/catalog/__tests__/services-crud.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { checkoutAction } from '../checkout';

vi.mock('@/lib/db', () => ({
  db: {
    $transaction: vi.fn((cb) => cb(db)),
    user: { findUnique: vi.fn(), update: vi.fn() },
    service: { findUnique: vi.fn() },
    order: { create: vi.fn() },
    payment: { create: vi.fn() },
    // ... mock other used models
  }
}));

// Mock other external dependencies like queues, paymentService
```

### Step 2: Write core test cases

Implement tests covering these scenarios:
1. **Successful balance payment**: Mock user with sufficient balance, valid service. Verify `$transaction` is called, user balance is decremented, order is created.
2. **Insufficient funds rejection**: Mock user with 0 balance. Expect checkoutAction to return `{ success: false, error: ... }`.
3. **Successful gateway payment redirect**: Mock user choosing 'yookassa' as payment method. Verify `paymentService.createPayment` is called and returns redirect URL.
4. **Idempotency key deduplication**: Call action with an idempotency key that already exists in DB. Verify it returns the existing order instead of creating a new one.

### Step 3: Run tests

```bash
npx vitest run src/actions/order/__tests__/checkout.test.ts
```
Iterate until they pass.

## STOP conditions

- If mocking the complex `$transaction` logic inside `checkout.ts` proves impossible without refactoring the source file (report this blocker).

## Git workflow

Commit with: `test: add comprehensive test suite for checkoutAction (plan 004)`
