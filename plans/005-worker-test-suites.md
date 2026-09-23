# Plan 005: Worker Test Suites

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `885d26f`, 2026-06-11

## Why this matters

The three background workers (`sync.processor.ts`, `cleanup.processor.ts`, `payment-sync.ts`) handle all async financial state mutations (refunds, zombie cancellations, payment reconciliations) but have zero test coverage. If they fail or behave unexpectedly, the system enters an inconsistent state silently.

## Current state

- Workers exist in `src/workers/processors/`
- No corresponding tests in `src/workers/processors/__tests__/` (only a timeout test exists there).

## Smmplan default commands

| Purpose   | Command                     | Expected on success |
|-----------|-----------------------------|---------------------|
| Test      | `npx vitest run src/workers/processors/` | all pass |

## Scope

**In scope**:
- `src/workers/processors/__tests__/sync.processor.test.ts` (create)
- `src/workers/processors/__tests__/cleanup.processor.test.ts` (create)
- `src/workers/processors/__tests__/payment-sync.test.ts` (create)

**Out of scope**:
- The worker source code files themselves.

## Steps

### Step 1: Create sync processor tests

Create `src/workers/processors/__tests__/sync.processor.test.ts`. 
Mock DB and `providerService.getWorkerProviderInstance()`.
Write cases for:
- Normal status transition (PENDING -> COMPLETED).
- Provider timeout (ensure SLA metrics log error).
- Refund path (status -> PARTIAL/CANCELED).

### Step 2: Create cleanup processor tests

Create `src/workers/processors/__tests__/cleanup.processor.test.ts`.
Mock DB and `orderService`.
Write cases for:
- Zombie cancellation (orders stuck in AWAITING_PAYMENT).
- Orphan sweep (orders stuck in PENDING_CHECK).
- IN_PROGRESS TTL partial refund.

### Step 3: Create payment-sync tests

Create `src/workers/processors/__tests__/payment-sync.test.ts`.
Mock DB, `paymentService`, and `fetch` (for YooKassa API calls).
Write cases for:
- Succeeded remote payment (confirms locally).
- Canceled remote payment.
- Test mode early exit.

### Step 4: Verify

```bash
npx vitest run src/workers/processors/__tests__/sync.processor.test.ts
npx vitest run src/workers/processors/__tests__/cleanup.processor.test.ts
npx vitest run src/workers/processors/__tests__/payment-sync.test.ts
```

## STOP conditions

- If BullMQ Job payload typing conflicts severely with the mocked inputs.

## Git workflow

Commit with: `test: add worker test suites for sync and cleanup (plan 005)`
