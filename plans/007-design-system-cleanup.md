# Plan 007: Design System Violations Cleanup

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `885d26f`, 2026-06-11

## Why this matters

Using inline colors like `text-white` or `bg-slate-50` breaks dark mode and violates the Smmplan Design System defined in `globals.css` (Tailwind v4 `@theme`).

## Current state

- Found `text-white` in: `ChatWindow.tsx`, `TelegramCard.tsx`, `brand-styles.ts`, `smart-client.tsx`, `unified-workspace.tsx`.
- Found raw `slate` colors in `TiptapEditor.tsx`.

## Smmplan default commands

| Purpose   | Command                     | Expected on success |
|-----------|-----------------------------|---------------------|
| Lint      | `npm run lint`              | exit 0              |
| Build     | `npm run build`             | exit 0              |

## Scope

**In scope**:
- `src/components/support/ChatWindow.tsx`
- `src/components/dashboard/settings/TelegramCard.tsx`
- `src/utils/brand-styles.ts`
- `src/app/admin/smart/smart-client.tsx`
- `src/app/admin/tickets/components/unified-workspace.tsx`
- `src/components/cms/TiptapEditor.tsx`

**Out of scope**:
- `src/app/globals.css`

## Steps

### Step 1: Replace `text-white`

Search for `text-white` in the in-scope files.
- If it's text inside a button or badge with a solid background (e.g., `bg-primary`), replace with `text-primary-foreground`.
- If it's text on a generic background, replace with `text-foreground`.
- In `src/utils/brand-styles.ts`, update `activeText: "text-white"` to `activeText: "text-primary-foreground"`.

### Step 2: Replace hardcoded backgrounds

In `TelegramCard.tsx`, replace `bg-[#24A1DE]` with `bg-primary` (or a specific UI token if preferred).

### Step 3: Replace raw slate colors in Editor

In `TiptapEditor.tsx`:
- `text-slate-700` -> `text-muted-foreground` or `text-foreground`
- `bg-slate-50` -> `bg-muted`
- `border-slate-200` -> `border-border`

### Step 4: Verify

```bash
npm run build
```

## STOP conditions

- If you encounter a situation where the semantic token completely breaks visibility (you will need to check the UI manually if unsure, but for the plan executor, just run build).

## Git workflow

Commit with: `style: enforce semantic design tokens, remove text-white (plan 007)`
