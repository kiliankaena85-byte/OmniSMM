# Implementation Plan: Mobile Visual Audit Fixes

## Problem
In Smmplan's mobile layout, several visual defects exist:
1. Muted table headers have insufficient contrast on light backgrounds.
2. Multiple key interactive elements (Back Button, Play/Pause button, Type Filters tabs, Date Selector, Search Input bar, Statement Printer button, Accountant Mode toggle) have touch targets smaller than the WCAG-recommended 44x44px.
3. Tables on mobile cause horizontal overflow and scrolling on viewports down to 320px width.
4. Hardcoded local path in audit CLI scripts limits portability.
5. Incomplete viewport capture configurations in the visual asset generator script.

## Solution Architecture & Affected Files
We will make the following targeted modifications:
1. **`src/app/dashboard/orders/page.tsx`**: Replace `text-muted-foreground` (line 186) with `text-foreground/75` for the table headers.
2. **`src/components/dashboard/transactions/TransactionsClient.tsx`**: 
   - Replace `text-muted-foreground` (lines 336 and 402) with `text-foreground/75` for the table headers.
   - Adjust Type Filter tab buttons to have `min-h-[44px]` (py-2.5 px-4 text-sm font-bold).
   - Adjust Date Selector, Search Input, and Statement Printer button to have `h-11` (>= 44px).
   - Adjust Accountant Mode toggle container and button to have `h-11` (>= 44px).
   - Add a responsive `MobileTransactionList` card-based list component. Hide desktop tables using `hidden md:block` and show `MobileTransactionList` on mobile with `md:hidden`.
3. **`src/app/dashboard/orders/[id]/page.tsx`**: Modify the Back Button size class from `w-10 h-10` to `w-11 h-11` (44px) or `w-12 h-12` (48px) and verify centering.
4. **`src/app/dashboard/smart-drip/smart-client.tsx`**: Update Play/Pause button from size `sm` and `h-8` to size `icon` (standard 44x44px target) with flex centering.
5. **`scripts/synthetic-ux-lab/visual-audit-cli.ts`**: Replace absolute path with a portable env-based alternative (`process.env.AUDIT_OUTPUT_DIR || path.join(process.cwd(), 'visual_audit_assets')`) and ensure the output directory exists.
6. **`scripts/synthetic-ux-lab/capture-all-pages.ts`**: Update the hardcoded path here as well for consistency and portability.
7. **`scripts/generate-all-audit-assets.ts`**: Update the `breakpoints` array to capture `320px`, `390px`, and `430px` specifically.

---

## 5 Vectors of Reliability Check

1. **Architectural Boundary**: All components are modified keeping Server/Client component boundaries intact. `TransactionsClient.tsx` and `smart-client.tsx` are Client Components (`'use client'`), whereas `src/app/dashboard/orders/page.tsx` and `src/app/dashboard/orders/[id]/page.tsx` are Server Components. We do not place `'use client'` where it is forbidden.
2. **Chaos & Empty States**: The `MobileTransactionList` will gracefully handle empty list state (inherited from `TransactionsClient` empty container check) and will not break on null/undefined properties since it uses safe fallback values and type assertions.
3. **Visual & UX Density**: Mobile card elements use comfortable compact spacing and font scaling (Russian Cyrillic typography text expansion buffer handled with `leading-relaxed` and padding).
4. **Accessibility (WCAG 2.2 AA)**: Contrast ratios for table headers are upgraded from ~3.5:1 (`text-muted-foreground` on light backgrounds) to >= 4.5:1 (`text-foreground/75`). All interactive buttons have touch target sizes >= 44x44px.
5. **Security & Trust**: Trust boundaries are maintained; no raw backend keys or sensitive logic is exposed.

---

## Pre-Mortem Analysis (Failure Simulation)

| Failure Scenario | Root Cause | Prevention Mechanism |
|---|---|---|
| 1. Mobile card rendering crashes on missing transaction properties | The transaction database has nullable fields or different type representations, causing runtime undefined property access on the client | Use safe optional chaining (`item.idempotencyKey?.truncate()`) and standard TypeScript interfaces matching Prisma schemas |
| 2. Mobile cards cause double layout shift (FOUC) | The tailwind classes on mobile render before javascript hydrates, causing resizing layout jumps | Ensure responsive tailwind utilities (`hidden md:block` and `md:hidden`) are purely style-based, so Nginx-served raw HTML respects layout boundaries instantly |
| 3. CLI Script fails when output directory does not exist | Changing the hardcoded path to `process.env.AUDIT_OUTPUT_DIR` or a relative path does not automatically create parent directories, causing Playwright or fs to throw `ENOENT` | Proactively verify and recursively create directory using `fs.mkdirSync(outDir, { recursive: true })` before writing assets or executing Playwright scripts |

---

## Verification Plan

### Automated Steps
1. Run `npx tsc --noEmit` to verify type safety.
2. Run `npm run lint` to ensure ESLint conformance (flat config).
3. Run `npm run build` to verify production compilation passes.
4. Run `npx tsx scripts/generate-all-audit-assets.ts` to capture and verify mobile viewport screenshots.
5. Run Playwright E2E visual tests: `npx playwright test e2e/visual-regression.spec.ts`.

### Manual Inspection
- Spot-check generated PNG assets under `visual_audit_assets/` for standard and grayscale screenshots at 320px, 390px, and 430px widths.
