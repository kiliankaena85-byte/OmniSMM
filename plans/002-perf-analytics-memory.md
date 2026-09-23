# Plan 002: Replace unbounded memory fetch with Raw SQL in analytics

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat HEAD..HEAD -- src/actions/admin/analytics.action.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit HEAD, 2026-06-12

## Why this matters

The admin funnel analytics dashboard fetches the entire `metadata` payload of every `SERVICE_SELECTED` event into the Node.js memory space to count the top 5 services. As analytics events grow to millions, this unbounded fetch will lead to severe garbage collection lag and Node.js Out-of-Memory (OOM) crashes. Moving the aggregation to the PostgreSQL engine fixes this.

## Current state

- `src/actions/admin/analytics.action.ts` — The `getFunnelAnalyticsAction` function pulls all service selection events and counts them via a JavaScript `.forEach()` loop.

Excerpt from `src/actions/admin/analytics.action.ts:30-40`:
```typescript
    // Optional: Top 5 Services by Clicks (for funnel)
    const serviceEvents = await db.analyticsEvent.findMany({
      where: { 
        event: 'SERVICE_SELECTED', 
        createdAt: { gte: cutoff } 
      },
      select: { metadata: true }
    })

    const countMap: Record<string, number> = {}
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
- `src/actions/admin/analytics.action.ts`

**Out of scope**:
- `analytics.service.ts`

## Steps

### Step 1: Replace Prisma `findMany` with `db.$queryRaw`
Remove the `serviceEvents` fetch and the JavaScript `countMap` logic. Replace it with a raw SQL query that aggregates the data using Postgres JSONB functions.

Example raw SQL:
```typescript
const topServicesRaw = await db.$queryRaw<{name: string, clicks: number}[]>`
  SELECT "metadata"->>'serviceName' as name, COUNT(*)::int as clicks
  FROM "AnalyticsEvent"
  WHERE event = 'SERVICE_SELECTED' AND "createdAt" >= ${cutoff}
  GROUP BY "metadata"->>'serviceName'
  ORDER BY clicks DESC
  LIMIT 5
`;
```

### Step 2: Map raw output to the return object
Map the `topServicesRaw` output directly into the `topServices` variable expected by the return payload.

**Verification**:
```bash
npx tsc --noEmit
# Expected: exit 0
```

## STOP conditions

If any of these are true, **stop immediately and report** — do not improvise:
- The `$queryRaw` type signature fails compilation.
- The `metadata` column in Prisma schema is not mapped to a Postgres JSONB field.

## Test plan

- Open the admin dashboard locally and ensure the "Top Services" chart or list renders correctly without runtime SQL errors.

## Maintenance notes

- Be careful with `db.$queryRaw` template literals to prevent SQL injection (always use `${variable}` bindings, never string concatenation).

## Git workflow

Commit with: `perf: migrate analytics aggregation to raw SQL (plan 002)`
