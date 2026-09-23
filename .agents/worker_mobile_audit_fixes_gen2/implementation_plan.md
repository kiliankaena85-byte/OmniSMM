# Implementation Plan — Mobile Visual Audit Fixes Verification

## Problem Statement
The predecessor implemented mobile visual/style updates across several pages (orders, transactions, smart-drip) to support updated mobile breakpoints (320px, 390px, 430px) and ensure touch targets >= 44x44px. The verification phase was interrupted by a quota error. We need to run comprehensive verification checks (typecheck, lint, build, screenshot generation, E2E visual tests) and resolve any issues discovered.

## Affected Files
- `src/app/dashboard/orders/[id]/page.tsx`
- `src/app/dashboard/orders/page.tsx`
- `src/app/dashboard/smart-drip/smart-client.tsx`
- `src/components/dashboard/transactions/TransactionsClient.tsx`
- `scripts/generate-all-audit-assets.ts`
- `scripts/synthetic-ux-lab/capture-all-pages.ts`
- `scripts/synthetic-ux-lab/visual-audit-cli.ts`

## 5 Vectors of Reliability

1. **Architectural Boundary**: Verify proper client/server components separation. Page files should remain server components (no `"use server"` declarations on components, only actions), client actions should use client-side hooks responsibly.
2. **Chaos and Vacancy**: Ensure components handle empty data or missing properties correctly without crashes (e.g. `MobileTransactionList` checking length and empty properties).
3. **Visual & UX Density**: Responsive design must scale gracefully from 320px up to large viewports, showing mobile cards on small screens (`md:hidden`) and hiding dense tables (`hidden md:block`).
4. **Accessibility (WCAG 2.2 AA)**: Interactive controls and buttons must have >= 44x44px touch targets. Check text color contrasts in table headers (upgraded from muted-foreground to foreground/75).
5. **Security & Trust**: No hardcoded/inline colors (like `text-white` or `bg-black`) unless semantic colors are used. Ensure styling conforms to the theme definition in `globals.css`.

## Pre-mortem Analysis (Failure Simulation)

| Risk Scenario | Likelihood (P) | Impact (I) | Prevention/Mitigation Mechanism |
|---|---|---|---|
| Port 3000 conflicts when starting local production server for screenshots | High | Medium | Check port status before launching, kill any leftover Next.js processes on port 3000 before running test suites. |
| Production build failure due to strict TypeScript checks or lint rules | Low | High | Run typecheck and lint tools locally first, fix any errors immediately before generating screenshots or building. |
| Playwright E2E visual tests failing due to minor pixel variations on different viewports | Medium | Medium | Review screenshot differences, adjust page components dynamically if layout shifts occur, or update visual test snapshots if layout updates are verified correct. |

## Verification Plan

### Step 1: TypeScript Check
- Run `npx tsc --noEmit` and ensure it completes with 0 errors.

### Step 2: Lint Check
- Run `npm run lint` and verify there are no ESLint errors.

### Step 3: Production Build
- Run `npm run build` to verify successful standalone Next.js build configuration.

### Step 4: Standalone Production Server Setup
- Kill any process holding port 3000.
- Start the standalone server: `node .next/standalone/server.js` with `PORT=3000`.
- Verify the server is running by hitting `http://localhost:3000`.

### Step 5: Screen Capture Asset Generation
- Run `npx tsx scripts/generate-all-audit-assets.ts` to capture the page views.
- Ensure screenshots are placed under `visual_audit_assets/` at viewports 320px, 390px, 430px.

### Step 6: Visual E2E Tests
- Run `npx playwright test e2e/visual-regression.spec.ts`.
- Address any failures and ensure they pass.
