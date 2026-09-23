# Plan 001: Decouple DB writes in ServiceAuditEngine to fix N+1 during sync

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat HEAD..HEAD -- src/actions/admin/providers/sync-action.ts src/services/admin/audit-engine.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit HEAD, 2026-06-12

## Why this matters

The provider catalog synchronization loop currently processes thousands of services. Within the loop, `ServiceAuditEngine.auditAndFixService()` executes individual, synchronous database queries (`db.service.update` and `db.adminAuditLog.create`) for every modified service. This defeats the batching logic (`updatesBatch`) intended to run at the end of the loop, leading to severe N+1 query problems, high database contention, and synchronization taking minutes instead of seconds.

## Current state

- `src/services/admin/audit-engine.ts` — The `auditAndFixService` function executes database updates internally instead of returning payload data.
- `src/actions/admin/providers/sync-action.ts` — The sync loop calls `await ServiceAuditEngine.auditAndFixService(myService, external, serviceExchangeRate);` at line 111.

Excerpt from `src/actions/admin/providers/sync-action.ts:110-112`:
```typescript
          const serviceExchangeRate = providerCurrency === 'RUB' ? 1.0 : usdToRub;
          await ServiceAuditEngine.auditAndFixService(myService, external, serviceExchangeRate);

          const newCostCents = newRate * serviceExchangeRate * 100;
```

## Smmplan default commands

For the Smmplan project, these are the standard verification commands:

| Purpose   | Command                     | Expected on success |
|-----------|-----------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`          | exit 0, no errors   |
| Lint      | `npm run lint`              | exit 0              |
| Build     | `npm run build`             | exit 0              |

## Scope

**In scope**:
- `src/services/admin/audit-engine.ts`
- `src/actions/admin/providers/sync-action.ts`

**Out of scope**:
- Post-sync rules execution (`applyPostSyncRules`)
- Quarantine flow logic (`approveQuarantinedService`, etc.)

## Steps

### Step 1: Refactor `auditAndFixService` to return unexecuted Prisma payloads
Modify `ServiceAuditEngine.auditAndFixService` to analyze the service and return an array of unexecuted Prisma query promises (or data payloads) rather than `await`ing the database calls itself. Return `[]` if no fixes are needed.

### Step 2: Push returned payloads into `updatesBatch`
In `sync-action.ts`, collect the payloads returned by `auditAndFixService` and push them into the `updatesBatch` array so they execute in the existing chunked `db.$transaction` block at the end of the loop.

**Verification**:
```bash
npx tsc --noEmit
# Expected: exit 0
```

## STOP conditions

If any of these are true, **stop immediately and report** — do not improvise:
- `updatesBatch` is not an array of Prisma promises/payloads.
- TypeScript errors cannot be resolved without touching files outside the scope.

## Test plan

- Test the sync action locally to ensure it successfully updates services and creates audit logs without throwing Prisma batching errors.

## Maintenance notes

- Any future additions to `ServiceAuditEngine` must also return payloads rather than executing DB calls directly when used within loops.

## Git workflow

Commit with: `perf: fix N+1 in catalog sync loop (plan 001)`
