# Implementation Plan: Mobile Layout Visual Audit and Fixes (v2)

## Objectives
- Perform a thorough mobile viewport layout visual audit on 20 screens at three resolutions (320px, 390px, 430px).
- Identify and document visual defects using a 4-level severity scale: P0 (Critical), P1 (Major), P2 (Minor), P3 (Enhancement).
- Fix all P0 and P1 visual bugs: text overlaps, clipping, horizontal scrolls, under-sized touch targets (< 44px), and poor contrast (< 4.5:1).
- Ensure 100% compliance with Tailwind CSS 4.0.0 guidelines (using semantic HSL tokens, no inline/hardcoded colors).
- Ensure compliance with Cyrillic typography rules (line-height, text expansion (+15-20% for Russian)) and CIS visual culture.
- Capture and save standard/grayscale screenshots under `visual_audit_assets/` named as `{slug}_{breakpoint}.png` and `{slug}_{breakpoint}_grayscale.png`.
- Run build, typecheck, lint, and Playwright tests to ensure 100% correctness.

## Mandatory Skills to Consult
All agents working on this task must read and adhere to:
- `gsd-premium-audit` (premium design criteria)
- `ru-cyrillic-typography` (line-height, text expansion for Cyrillic)
- `ru-visual-culture` (CIS design aesthetics, dark mode)
- `gsd-ui-review` (6-pillar visual audit)
- `gsd-tailwind-v4-manifest` (Tailwind 4 conventions)

## Milestones

### Milestone 1: Exploration & Audit (Explorer)
- **Objective**: Inspect the codebase, locate the 20 screens, evaluate specific Hot Spots, and generate a comprehensive visual audit report.
- **Screens to audit**:
  1. `/` (Landing Page)
  2. `/login` (Authorization)
  3. `/dashboard` (User dashboard page & `sidebar-nav.tsx`)
  4. `/dashboard/settings` (Profile settings & `PasswordCard.tsx`)
  5. `/dashboard/orders` (Orders history table and list)
  6. `/dashboard/add-funds` (Top-up wallet)
  7. `/knowledge` (Knowledge base home)
  8. `/academy` (Academy learning center/pages)
  9. `PaymentGatewaySelectionModal`
  10. `MassConfirmEmailModal`
  11. `VisualLinkGuideModal`
  12. `FAQ.tsx` (on landing page)
  13. `Reviews.tsx` (on landing page)
  14. `WhyUs.tsx` (on landing page)
  15. `MegaFooter.tsx` (on landing page)
  16. `TrustBar.tsx` (on landing page)
  17. `/support` (Support hub)
  18. `/support/payment-error` (Apple-style error screen)
  19. `/dashboard/tickets/[id]` (Support ticket chat)
  20. `/success` (Order/Payment success screen)
- **Specific Hot Spots**:
  1. `MobileWizard.tsx` (High risk of overflow, z-index conflicts)
  2. `StickyCheckoutBar.tsx` (Verify safe-area-inset for iPhone notch/home indicator)
  3. `PlatformLinkGuideDrawer.tsx` (Verify correctness of the `hidden md:flex` fix)
  4. `DynamicPayloadWarnings.tsx` (Verify long warnings overflow)
  5. `VisualLinkGuideModal.tsx` (Verify viewport boundary compliance)
  6. `Header.tsx` (Three buttons: Cabinet, Logout, Burger must fit in 320px width)
- **Breakpoints**: 320px (iPhone SE), 390px (iPhone 14), 430px (iPhone 15 Pro Max)
- **Verification**: Handoff report and a draft of `visual_audit_report.md` at root.

### Milestone 2: Code Modification & Bug Fixing (Worker)
- **Objective**: Implement fixes for all identified P0 and P1 bugs following the required design system guidelines.
- **Tasks**:
  1. Resolve routing and layout bugs (including /support/payment-error and any 404/dynamic routing issues).
  2. Adjust touch targets of pagination, inputs, buttons, and preset selections to >= 44x44px.
  3. Correct contrast violations for normal text (>= 4.5:1) and graphics (>= 3.0:1) in Light Mode.
  4. Replace inline and hardcoded Tailwind colors (e.g. text-white, bg-black, raw color shades) with standard HSL semantic tokens.
  5. Apply Cyrillic line-height and typography padding adjustments (+15-20% expansion spacing).
- **Verification**: Clean compilation with `npx tsc --noEmit` and `npm run lint`.

### Milestone 3: E2E Verification & Screenshots (Worker/Challenger)
- **Objective**: Automate/update screenshot regression tests using Playwright and generate final audit assets.
- **Tasks**:
  1. Update/write Playwright visual tests capturing standard and grayscale screenshots for the 20 screens/states at 320px, 390px, and 430px width.
  2. Save screenshots in `visual_audit_assets/` as `{slug}_{breakpoint}.png` and `{slug}_{breakpoint}_grayscale.png`.
  3. Verify all Playwright test assertions pass successfully.
- **Verification**: Folder `visual_audit_assets/` contains all required files, and E2E runs pass.

### Milestone 4: Code Review, Audit, and Final Synthesis (Reviewer/Auditor/Orchestrator)
- **Objective**: Verify design quality, compliance, and codebase integrity.
- **Tasks**:
  1. Perform visual and code review using peer agents.
  2. Run Forensic Auditor to confirm clean implementation (no hardcodes/cheating).
  3. Synthesize findings into the final 16-section `visual_audit_report.md` at project root.
- **Verification**: Reviewer approvals, Clean Auditor verdict, and complete 16-section report.
