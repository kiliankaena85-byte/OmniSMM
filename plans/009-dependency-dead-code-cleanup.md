# Plan 009: Dependency & Dead Code Cleanup

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
- **Category**: tech-debt, migration
- **Planned at**: commit `885d26f`, 2026-06-11

## Why this matters

The project suffers from bundle bloat and dead code left over from incomplete migrations. There are 3 icon libraries, 2 rich text editors, and dozens of abandoned bot/landing components. Removing these reduces bundle size, improves search clarity, and reduces maintenance burden.

## Current state

- `package.json`: Contains `@tiptap/*` (legacy editor) alongside `@blocknote/*` (current editor). Contains `react-icons` and `@tabler/icons-react` alongside `lucide-react`.
- `src/bot/`: Contains unused files like `admin.command.ts`, `cancel.command.ts` per Knip.
- `src/components/landing/`: Contains unused V1 components like `LandingContext.tsx`.

## Smmplan default commands

| Purpose   | Command                     | Expected on success |
|-----------|-----------------------------|---------------------|
| Lint      | `npm run lint`              | exit 0              |
| Build     | `npm run build`             | exit 0              |

## Scope

**In scope**:
- `package.json`
- `src/components/cms/TiptapEditor.tsx`
- Dead bot files in `src/bot/`
- Dead landing components in `src/components/landing/` and `src/hooks/`

## Steps

### Step 1: Remove TipTap

Delete `src/components/cms/TiptapEditor.tsx`.
Run `npm uninstall @tiptap/react @tiptap/starter-kit @tiptap/extension-image`.

### Step 2: Remove redundant icon libraries

Check usage of `react-icons` and `@tabler/icons-react`.
If minimal, replace them with `lucide-react` equivalents in the source files.
Then `npm uninstall react-icons @tabler/icons-react`.

### Step 3: Remove dead bot files

Delete the following unused files identified by Knip:
- `src/bot/commands/admin.command.ts`
- `src/bot/commands/cancel.command.ts`
- `src/bot/commands/orders.command.ts`
- `src/bot/commands/shop.command.ts`
- `src/bot/commands/support.command.ts`
- `src/bot/middleware/project.middleware.ts`

### Step 4: Remove dead landing files

Delete the following confirmed unused files:
- `src/components/landing/order-engine/LandingContext.tsx`
- `src/components/landing/order-engine/LegalFooter.tsx`
- `src/components/landing/order-engine/MassOrderModal.tsx`
- `src/components/landing/order-engine/DynamicPayloads.tsx`
- `src/components/landing/order-engine/MobileServiceDropdown.tsx`
- `src/components/landing/order-engine/OrderSummaryBar.tsx`
- `src/components/landing/order-engine/PlatformSelector.tsx`
- `src/components/landing/order-engine/SmartInput.tsx`

### Step 5: Verify

```bash
npx tsc --noEmit
npm run lint
npm run build
```

## STOP conditions

- If `tsc` fails indicating that a deleted file was still being imported somewhere.

## Git workflow

Commit with: `chore: remove redundant dependencies and dead code (plan 009)`
