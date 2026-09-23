# Plan 019: Error Boundaries & Frontend Resilience

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step.
>
> **Drift check (run first)**: `git diff --stat HEAD -- src/app/admin/ src/app/dashboard/ src/app/services/ src/components/admin/sidebar.tsx`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW — adding files and replacing colors, no business logic changes
- **Depends on**: none
- **Category**: ux + tech-debt
- **Planned at**: deep audit round 2, 2026-06-11

## Why this matters

1. **Missing error.tsx boundaries (FRONT-01, P1)**: Only 1 `error.tsx` exists at root level. The entire admin panel, user dashboard, and public catalog have no error boundaries. Any uncaught error = white screen crash with no recovery option.

2. **Missing loading.tsx states (FRONT-02, P3)**: Zero `loading.tsx` files anywhere. Only 2 pages use `<Suspense>`. Users see blank screens while pages load.

3. **Admin sidebar bypasses design system (FRONT-03, P2)**: `sidebar.tsx` contains 15+ hardcoded hex colors (`#24303F`, `#2F3C4C`, `#707579`, `#FFFFFF`, `#3390EC`). These completely bypass the design system and will break in any theme change.

4. **God components (FRONT-04, P2)**: 11 files exceed the 150-line component limit. Top 3: `catalog-table-v2.tsx` (1154 lines, 7.7x), `unified-workspace.tsx` (1094 lines, 7.3x), `smart-client.tsx` (867 lines, 5.8x).

## Current state

- `src/app/error.tsx` — only error boundary in entire app
- No `loading.tsx` files exist anywhere
- `src/components/admin/sidebar.tsx` — 15+ hardcoded hex colors
- 11 files > 150 lines per component

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`       | exit 0              |
| Tests     | `npx vitest run`         | all pass            |
| Lint      | `npm run lint`           | exit 0              |
| Build     | `npm run build`          | exit 0              |

## Scope

**In scope**:
- `src/app/admin/error.tsx` (NEW)
- `src/app/admin/loading.tsx` (NEW)
- `src/app/dashboard/error.tsx` (NEW)
- `src/app/dashboard/loading.tsx` (NEW)
- `src/app/services/error.tsx` (NEW)
- `src/app/services/loading.tsx` (NEW)
- `src/app/admin/orders/error.tsx` (NEW)
- `src/app/admin/finance/error.tsx` (NEW)
- `src/components/admin/sidebar.tsx` (MODIFY)

**Out of scope**:
- God component decomposition (deferred to separate sprint — L effort)
- Full design system migration (150+ hardcoded colors across 40+ files)
- `text-emerald/amber/slate` → semantic tokens (requires dark mode token design)

## STOP conditions

- If any of the error.tsx files already exist
- If sidebar.tsx has already been migrated to semantic tokens

---

## Step 1: Create error.tsx for admin routes

**File**: `src/app/admin/error.tsx` (NEW)

```tsx
'use client';

import { useEffect } from 'react';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Admin Error Boundary]', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold text-foreground">
          Произошла ошибка
        </h2>
        <p className="text-muted-foreground text-sm max-w-md">
          При загрузке раздела администрирования произошла непредвиденная ошибка.
          Попробуйте обновить страницу.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground/60 font-mono">
            ID: {error.digest}
          </p>
        )}
      </div>
      <button
        onClick={reset}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium transition-all duration-200 hover:opacity-90"
      >
        Попробовать снова
      </button>
    </div>
  );
}
```

Create similar files for:
- `src/app/admin/orders/error.tsx`
- `src/app/admin/finance/error.tsx`

With adjusted text (e.g., "раздела заказов", "финансового раздела").

**Verify**: `npx tsc --noEmit`

---

## Step 2: Create error.tsx for user-facing routes

**File**: `src/app/dashboard/error.tsx` (NEW)

```tsx
'use client';

import { useEffect } from 'react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Dashboard Error Boundary]', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold text-foreground">
          Что-то пошло не так
        </h2>
        <p className="text-muted-foreground text-sm max-w-md">
          Не удалось загрузить личный кабинет. Попробуйте обновить страницу.
        </p>
      </div>
      <button
        onClick={reset}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium transition-all duration-200 hover:opacity-90"
      >
        Обновить
      </button>
    </div>
  );
}
```

**File**: `src/app/services/error.tsx` (NEW) — similar pattern, text: "каталога услуг"

**Verify**: `npx tsc --noEmit`

---

## Step 3: Create loading.tsx skeletons

**File**: `src/app/admin/loading.tsx` (NEW)

```tsx
export default function AdminLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Загрузка...</p>
      </div>
    </div>
  );
}
```

Create similar `loading.tsx` for:
- `src/app/dashboard/loading.tsx`
- `src/app/services/loading.tsx`

**Verify**: `npx tsc --noEmit`

---

## Step 4: Replace admin sidebar hardcoded hex colors

**File**: `src/components/admin/sidebar.tsx`

Map hex colors to semantic tokens from `globals.css`:

| Hardcoded | Semantic replacement |
|-----------|---------------------|
| `#24303F` | `bg-card` or `bg-sidebar` |
| `#2F3C4C` | `bg-muted` |
| `#707579` | `text-muted-foreground` |
| `#FFFFFF` | `text-foreground` |
| `#3390EC` | `text-primary` / `bg-primary` |
| `bg-[#...]` | `bg-card`, `bg-muted`, `bg-accent` |
| `text-[#...]` | `text-foreground`, `text-muted-foreground` |
| `border-[#...]` | `border-border` |

> ⚠️ Review the existing semantic tokens in `src/app/globals.css` `@theme` block before mapping. If a token for sidebar-specific colors doesn't exist, consider adding `--sidebar`, `--sidebar-foreground`, `--sidebar-accent` tokens to the theme.

**Verify**: `npx tsc --noEmit` + visual check in browser

---

## Step 5: Final verification

```bash
npx tsc --noEmit
npm run lint
npx vitest run
npm run build
```

All must pass.

---

## Deferred items (for future plans)

- **God component decomposition**: 11 files exceeding limits. Top 3 require L-effort dedicated sprint:
  - `catalog-table-v2.tsx` (1154 lines) → CatalogFilters, CatalogRow, InlineEditor, BulkActions
  - `unified-workspace.tsx` (1094 lines) → TicketDetail, AttachedOrdersGrid, SourceBadge
  - `smart-client.tsx` (867 lines) → CampaignList, CampaignDetail, TaskTimeline

- **Design system deep cleanup**: ~150 hardcoded Tailwind palette colors across 40+ files. Requires dark mode token design first.
