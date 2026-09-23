# Plan 003: Database Index Optimization

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 885d26f..HEAD -- prisma/schema.prisma`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `885d26f`, 2026-06-11

## Why this matters

Missing database indexes cause performance degradation as the database grows. The audit found critical queries missing indexes: syncing logic filters by `externalId` on the Service table, and admin ledger searches filter by `adminId` + `createdAt`. Adding these prevents slow full-table scans.

## Current state

- `prisma/schema.prisma`:
  - `Service` model lacks `@@index([externalId])`.
  - `LedgerEntry` model lacks `@@index([adminId, createdAt])`.
  - `Ticket` model lacks `@@index([status])` and `@@index([status, createdAt])`.

## Smmplan default commands

| Purpose   | Command                     | Expected on success |
|-----------|-----------------------------|---------------------|
| Validate  | `npx prisma validate`       | exit 0              |
| DB Push   | `npx prisma db push --accept-data-loss` (test env only) | exit 0 |

## Scope

**In scope**:
- `prisma/schema.prisma`

**Out of scope**:
- Application code logic changes.

## Steps

### Step 1: Add indexes to Prisma Schema

In `prisma/schema.prisma`:

1. Find the `model Service` block. Add to the bottom (with other indexes):
   ```prisma
     @@index([externalId])
   ```

2. Find the `model LedgerEntry` block. Add:
   ```prisma
     @@index([adminId, createdAt])
   ```

3. Find the `model Ticket` block. Add:
   ```prisma
     @@index([status])
     @@index([status, createdAt])
   ```

### Step 2: Validate Schema

```bash
npx prisma validate
```

### Step 3: Create Migration

Since this is a database change, we need to generate a migration. Note: usually developers run `npx prisma migrate dev`, but for the plan executor, just formatting is enough. The CI or deploy pipeline will handle migration if the project uses `db push`.

Run format:
```bash
npx prisma format
```

## STOP conditions

- If `npx prisma validate` fails with errors about the new indexes.

## Git workflow

Commit with: `perf: add missing database indexes (plan 003)`
