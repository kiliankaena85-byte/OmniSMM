# Plan 010: New Capabilities — Admin Export & API Cancel

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `885d26f`, 2026-06-11

## Why this matters

Admin export functionality is a basic B2B requirement completely missing from the panel. The V2 API lacks a cancellation endpoint for safe PENDING orders, forcing resellers to contact support manually.

## Current state

- No export functionality in `src/actions/`.
- `src/app/api/v2/route.ts:256` stub returns an error for all API cancel requests.

## Smmplan default commands

| Purpose   | Command                     | Expected on success |
|-----------|-----------------------------|---------------------|
| Lint      | `npm run lint`              | exit 0              |
| Build     | `npm run build`             | exit 0              |

## Scope

**In scope**:
- `src/actions/admin/export.ts` (create)
- `src/app/api/v2/route.ts`
- Admin table components (to add export buttons)

## Steps

### Step 1: Create Export Action

Create `src/actions/admin/export.ts`. Implement Server Actions:
- `exportOrdersCSV()`
- `exportClientsCSV()`
Use `requireAdmin()` from session utilities. Convert Prisma arrays to CSV strings (can use `papaparse` if installed, or simple map/join).

### Step 2: Add Export Buttons

Add UI buttons to trigger these actions in `src/app/admin/orders/page.tsx` (or its table component) and `src/app/admin/clients/page.tsx`. Use a standard `<a>` download or a form action.

### Step 3: Implement API Cancel

In `src/app/api/v2/route.ts`, modify `handleCancel`.
Allow cancellation IF order status is `PENDING` or `AWAITING_PAYMENT` (orders not yet sent to provider).
If it's in those states, call the internal `cancelOrder` logic and refund the user balance. If it's IN_PROGRESS, return the standard "Contact support" error.

### Step 4: Verify

```bash
npx tsc --noEmit
npm run build
```

## STOP conditions

- If you cannot safely verify that an order in `PENDING` hasn't already been picked up by a worker. (Use a transaction to check status and cancel atomically).

## Git workflow

Commit with: `feat: add admin CSV exports and safe API cancel (plan 010)`
