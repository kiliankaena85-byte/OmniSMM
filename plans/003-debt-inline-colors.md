# Plan 003: Replace inline colors with semantic design tokens in dashboard

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat HEAD..HEAD -- src/app/admin/dashboard/page.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit HEAD, 2026-06-12

## Why this matters

The admin dashboard components currently use hardcoded inline colors (e.g., `text-amber-600`, `bg-amber-500/10`, `text-rose-400`). This is a direct violation of the `AGENTS.md` mandate to use semantic design tokens (`text-warning`, `bg-danger/10`). Hardcoded colors break the Dark Mode implementation and prevent centralized theming via the Tailwind 4 `@theme` directive in `globals.css`.

## Current state

- `src/app/admin/dashboard/page.tsx` — Various metric cards use inline Tailwind color palettes.

Excerpt from `src/app/admin/dashboard/page.tsx:106-108`:
```tsx
          <div className="flex justify-between items-start mb-3">
            <span className="text-muted-foreground text-[10px] font-black uppercase tracking-wider">Комиссии кассы</span>
            <span className="text-amber-600 dark:text-amber-400 text-xs font-bold bg-amber-500/10 px-2 py-0.5 rounded-full shadow-sm">3% YooKassa</span>
          </div>
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
- `src/app/admin/dashboard/page.tsx`

**Out of scope**:
- Changing the layout or logic of the dashboard itself.

## Steps

### Step 1: Replace amber/orange classes with `warning` tokens
Find all instances of `amber-500`, `amber-600`, `orange-400` and replace them with the `warning` semantic palette (e.g., `text-warning`, `bg-warning/10`). Remove manual dark mode overrides (`dark:text-amber-400`) since semantic tokens handle dark mode automatically.

### Step 2: Replace red/rose classes with `destructive` tokens
Find all instances of `red-500`, `rose-400`, `rose-100` and replace them with the `destructive` or `danger` semantic palette.

### Step 3: Replace indigo/emerald classes with `primary`/`success` tokens
Replace specific brand colors like `emerald-400` with `success` and `indigo-400` with `primary`.

**Verification**:
```bash
npm run build
# Expected: exit 0
```

## STOP conditions

If any of these are true, **stop immediately and report** — do not improvise:
- You cannot find semantic tokens in the Tailwind config to map the colors to.

## Test plan

- Visually inspect the dashboard in both light and dark modes to verify the colors contrast well and align with the design system.

## Maintenance notes

- Always use semantic tokens for new UI elements. Avoid raw color names.

## Git workflow

Commit with: `refactor: use semantic tokens in dashboard (plan 003)`
