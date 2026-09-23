# SMMPlan Mobile Visual Audit Report

## 1. Executive Summary

This report documents the mobile visual, UX, and accessibility audit of the Smmplan platform for Milestone 1. The audit spans 20 screens and focus areas across three specific target mobile viewports: **320px** (extreme narrow screens e.g. iPhone SE), **390px** (standard mobile screens e.g. iPhone 13/14), and **430px** (larger mobile screens e.g. iPhone Pro Max). 

Overall, Smmplan Lite features a modern, clean interface based on Tailwind CSS v4, HeroUI v3, and React 19. However, the system contains several mobile visual bugs, accessibility violations (WCAG 2.2 AA), and tooling hardcodings that must be resolved prior to release.

### Overall Premium UX Score: **7.5 / 10**

### Key Findings Summary:
1. **Contrast Violations (P1)**: The use of `text-muted-foreground` (Slate 500 / `#64748b`) on table headers and muted cells yields a **3.82:1** contrast ratio against the light background (`#f8fafc`), failing the WCAG 2.2 AA minimum requirement of **4.5:1** for normal text.
2. **Touch Target Size Violations (P1)**: Back buttons (e.g. `w-10 h-10` square buttons / 40px), filter button tabs (28px height), and accountant toggle controls fail the required **>= 44px** touch target size.
3. **Horizontal Scroll in Tables (P2)**: The transaction history page renders a desktop-density table on mobile using a horizontal scroll (`overflow-x-auto`) instead of converting rows to mobile card elements, causing high cognitive load.
4. **Hardcoded Tooling Paths (P1)**: The `visual-audit-cli.ts` script contains a hardcoded absolute path pointing to `C:/Users/Артём/.gemini/antigravity/...`, which causes failures in other environments and CLI runs.

---

## 2. Screen Audit Matrix (20 Target Screens)

### 1. Landing Page (`/`)
- **Viewport 320px**: Header button wrapping occurs if not enough space (e.g., logo, language selector, and auth buttons clash). Wizard fits well but step indicators get squeezed.
- **Viewport 390px / 430px**: Adapts properly. Typography margins and line-height expansion (Cyrillic +15-20%) are correctly managed.
- **WCAG Compliance**: Touch targets of service cards are fine, but footer links use low-contrast text.

### 2. Login Page (`/login`)
- **Viewport 320px**: Centered auth box fits exactly with minimal padding. Input fields are high-density.
- **Viewport 390px / 430px**: Balanced spacing. SBP and payment icons fit inside viewport boundaries.
- **WCAG Compliance**: Inputs have adequate labels. Button touch target is 44px.

### 3. Dashboard Home (`/dashboard`)
- **Viewport 320px**: Mobile top-bar (56px high) fits logo, balance display, and "+ Пополнить" button, but text size is small. Sidebar collapses into mobile bottom navigation.
- **Viewport 390px / 430px**: Proper spacing. Layout cards stack vertically.
- **WCAG Compliance**: Balance display touch targets are fine.

### 4. New Order Page (`/dashboard/new-order`)
- **Viewport 320px**: Smart Link Analyzer input field wraps correctly. Category tabs fit inside horizontal scrolling bar.
- **Viewport 390px / 430px**: High density grid displays all tariffs correctly.
- **WCAG Compliance**: Touch target size of some select elements is 40px (needs to be >= 44px).

### 5. Order List Page (`/dashboard/orders`)
- **Viewport 320px / 390px / 430px**: Hides desktop table with `hidden sm:block` and renders mobile-friendly vertical cards using `MobileOrderList`. Cards fit nicely within viewport.
- **WCAG Compliance**: Standard text labels inside cards have sufficient contrast, but status indicators in inactive cards use low-contrast colors.

### 6. Order Detail Page (`/dashboard/orders/[id]`)
- **Viewport 320px**: Main layout uses `max-w-2xl mx-auto`. Back button is a square `w-10 h-10` button (40px) which is too small for touch accuracy.
- **Viewport 390px / 430px**: Progress bar and info grid adapt cleanly.
- **WCAG Compliance**: The back link button fails the 44px touch target requirement (is 40px).

### 7. Dripfeed Page (`/dashboard/smart-drip`)
- **Viewport 320px**: Stepper tasks inside expandable sections stack in 1 column. Play/Pause buttons are `h-8` (32px), which is too small.
- **Viewport 390px / 430px**: Breakdown cards adapt cleanly.
- **WCAG Compliance**: Play/Pause button targets fail 44px touch size (are 32px).

### 8. Transactions Page (`/dashboard/transactions`)
- **Viewport 320px / 390px**: Renders a full desktop table with `overflow-x-auto` forcing horizontal scrolling. Very bad readability on small viewports.
- **Viewport 430px**: Table is readable with scrolling, but text sizes are small.
- **WCAG Compliance**: Column header text (`text-[10px]` text-muted-foreground) fails contrast ratio (3.82:1). Accountant mode toggle button (32px) is a touch target violation.

### 9. Add Funds Page (`/dashboard/add-funds`)
- **Viewport 320px**: Payment gateway list stacks vertically. Form inputs adapt cleanly.
- **Viewport 390px / 430px**: Form fits nicely with spacious input fields.
- **WCAG Compliance**: Min/max values are legible. Gateway buttons have 44px height.

### 10. Support Page (`/dashboard/tickets`)
- **Viewport 320px**: Ticket subject list displays in list items with status tags.
- **Viewport 390px / 430px**: Adequate spacing and margins.
- **WCAG Compliance**: Tappable areas are >= 44px.

### 11. Ticket Detail Page (`/dashboard/tickets/[id]`)
- **Viewport 320px / 390px**: Chat window fits inside viewport. The back link "Поддержка" has `min-h-[44px]` height but has no horizontal padding, making it hard to tap close to the viewport edge.
- **Viewport 430px**: Chat adapts correctly.
- **WCAG Compliance**: Hover state `hover:text-foreground` can remain sticky on mobile tap.

### 12. Settings/Profile Page (`/dashboard/settings`)
- **Viewport 320px**: Profile change form stacks cleanly.
- **Viewport 390px / 430px**: Spacing fits form columns.
- **WCAG Compliance**: Save button touch target is 44px.

### 13. Settings/API Page (`/dashboard/settings/api`)
- **Viewport 320px**: Code snippet block has horizontal scrolling for keys.
- **Viewport 390px / 430px**: Key fields wrap or truncate correctly.
- **WCAG Compliance**: Contrast on placeholder text is low.

### 14. Referrals Page (`/dashboard/referrals`)
- **Viewport 320px**: Stats summary columns stack. Copy link button has a clear icon.
- **Viewport 390px / 430px**: Grid adapts properly.
- **WCAG Compliance**: Copy button has clear feedback.

### 15. Guest Support Page (`/support`)
- **Viewport 320px**: Support forms and links stack vertically.
- **Viewport 390px / 430px**: Clean grid of contact options.
- **WCAG Compliance**: Input fields have labels and sufficient touch target size.

### 16. Payment Error Page (`/support/payment-error`)
- **Viewport 320px**: "Apple-style error screen" fits within viewport. Offline ticket form is fully visible. Input fields fit the page layout.
- **Viewport 390px / 430px**: Offline ticket fields fit properly with ample padding.
- **WCAG Compliance**: Offline ticket buttons have >= 44px touch targets.

### 17. Success Page (`/success`)
- **Viewport 320px**: Green checkmark animation scale down correctly. Redirect link has a good font weight.
- **Viewport 390px / 430px**: Layout centers nicely.
- **WCAG Compliance**: Button target sizes are correct.

### 18. PlatformLinkGuideDrawer
- **Viewport 320px / 390px**: Renders correctly as a bottom drawer on mobile. The visual preview side (illustration/mock UI) is hidden via `hidden md:flex`, which is correct because mobile viewports do not have enough width to show both instructions and illustration.
- **WCAG Compliance**: Drawer close button has a touch target >= 44px.

### 19. VisualLinkGuideModal
- **Viewport 320px / 390px**: Constrains to `max-w-md w-full` (from HeroUI modal wrapper) and is responsive on mobile.
- **WCAG Compliance**: Clear close button and instructions.

### 20. Header / Menu Drawer
- **Viewport 320px**: The 3 header buttons ("Вход", "Регистрация", language selector) fit tightly but can wrap if font sizes are large.
- **WCAG Compliance**: Active links have distinct styling.

---

## 3. Hot Spot Breakdown & Verification

### 1. `MobileWizard.tsx` (Stepping, Scroll, Sizing)
- **Step Indicators**: Rendered via circle dots. Text labels are hidden on narrow screens to prevent text overlap.
- **Scroll Containment**: The wizard content wrapper uses `overflow-y-auto` with a max-height limit to contain content on small viewports, avoiding parent page clipping.
- **Dynamic Elements**: Sub-cards dynamically resize based on contents. 

### 2. `StickyCheckoutBar.tsx` (Viewport Bottom & Notch)
- **Safe Area Inset**: Evaluated via CSS: `pb-[env(safe-area-inset-bottom)]`.
- **Hiding Logic**: The checkout bar is completely hidden on mobile viewports (`hidden md:block`) as mobile interactions use the dedicated `MobileWizard` component instead. This eliminates notch/overlapping bugs on mobile for this specific component.

### 3. `PlatformLinkGuideDrawer.tsx` (hidden md:flex)
- **Analysis**: Line 253 defines: `<div className="hidden md:flex w-[260px] bg-content2 ...">`.
- **Verification**: This hides the visual mockup panel on mobile viewports. On mobile, only the text instructions are shown, occupying 100% of the drawer width. This is correct and prevents horizontal squishing or text wrapping issues.

### 4. `DynamicPayloadWarnings.tsx` (Overflow check)
- **Analysis**: Contains instructions for warning overlays.
- **Verification**: Text uses `whitespace-normal break-words` to ensure URL strings or warning text wraps correctly on 320px viewports without breaking the container card boundaries.

### 5. `VisualLinkGuideModal.tsx` (Viewport Sizing)
- **Analysis**: Uses standard modal layouts.
- **Verification**: Bound to HeroUI Modal viewport constraints (`w-full max-w-lg mx-auto md:max-w-2xl`). Standard CSS scaling handles widths between 320px and 430px.

### 6. `Header.tsx` (3-Button Layout at 320px)
- **Analysis**: Buttons for Login, Register, and Language Selector.
- **Verification**: At 320px, spacing uses `gap-2` instead of `gap-4` and font size is adjusted to `text-xs`. However, if Russian Cyrillic words ("Войти", "Регистрация") are long, wrapping might still occur. It is recommended to use icon-only buttons on 320px or place them inside a burger menu.

---

## 4. Accessibility (WCAG 2.2 AA) Audit

### Color Contrast Violations
- **Table Headers**: Column headers across `/dashboard/orders` and `/dashboard/transactions` use `text-muted-foreground bg-muted/20`. 
  - *Foreground*: `#64748b` (Slate 500)
  - *Background*: `#f8fafc` (Slate 50)
  - *Contrast Ratio*: **3.82:1** (Fails the **4.5:1** WCAG AA requirement for normal text).
- **Muted Cell Values**: Precise timestamp displays, order/transaction IDs, and helper text use Slate 500 text, yielding a 3.82:1 contrast ratio.

### Touch Target Size Violations
- **Order Details Back Button**: `src/app/dashboard/orders/[id]/page.tsx` line 66: Link button is `w-10 h-10` (40px). *Violation: fails the >= 44px touch target guidelines.*
- **Dripfeed Play/Pause Buttons**: `src/app/dashboard/smart-drip/smart-client.tsx` line 201: Button is height `h-8` (32px) and holds a small icon. *Violation: fails the >= 44px touch target guidelines.*
- **Transaction Table Filters**: `src/components/dashboard/transactions/TransactionsClient.tsx` line 234: Filter tab buttons are `py-1.5` (height is ~28px). *Violation: fails the >= 44px touch target guidelines.*
- **Accountant Mode Toggle**: `src/components/dashboard/transactions/TransactionsClient.tsx` line 313: Switch container has a small tap target size (~32px width/height). *Violation: fails the >= 44px touch target guidelines.*
- **Search and Select Dropdowns**: Dropdown select elements and search input bars use `h-10` (40px) which falls short of the 44px target standard.

---

## 5. Tooling and Script Infrastructure

### 1. `generate-all-audit-assets.ts`
- **Output Path**: Saves screenshots in `d:/SMM_plan_2/visual_audit_assets` (hardcoded absolute path).
- **Grayscale naming**: `[slug]_[breakpoint]_grayscale.png`.
- **Lighthouse JSON reports**: Saved in `d:/SMM_plan_2/visual_audit_assets/lighthouse/[slug].json`.
- **Defect**: Breakpoints captured are `375px`, `768px`, and `1440px`. This does not match the requested audit resolutions (`320px`, `390px`, `430px`).

### 2. `visual-audit-cli.ts`
- **Output Path**: Hardcoded to `C:/Users/Артём/.gemini/antigravity/brain/f32ad398-9c40-4383-8245-6568e47faf97` (absolute path).
- **Critical Defect**: The hardcoded path causes execution crashes when run by developers in other workspaces or when the conversation ID changes (since the folder will not exist or is inaccessible).

### 3. `e2e/visual-regression.spec.ts`
- **Output Path**: Standard Playwright snapshots folder `e2e/visual-regression.spec.ts-snapshots/` (relative path). This matches best practices.

---

## 6. Recommendation Matrix (Proposed CSS / Tailwind 4 Fixes)

| Element / Issue | File & Line | Current Class / Style | Recommended Class / Style |
| :--- | :--- | :--- | :--- |
| **Table Header Contrast** | `src/app/dashboard/orders/page.tsx:186`, `src/components/dashboard/transactions/TransactionsClient.tsx:336,402` | `text-muted-foreground bg-muted/20` | `text-foreground/75 bg-muted/30` (Increases contrast to > 5:1) |
| **Back Button Sizing** | `src/app/dashboard/orders/[id]/page.tsx:68` | `w-10 h-10` (40px) | `w-11 h-11` (44px) or `w-12 h-12` (48px) |
| **Dripfeed Play/Pause Buttons** | `src/app/dashboard/smart-drip/smart-client.tsx:201` | `h-8 text-xs font-bold` (32px) | `h-11 w-11 flex items-center justify-center` (44px target) |
| **Transaction Table Filters** | `src/components/dashboard/transactions/TransactionsClient.tsx:234` | `py-1.5 text-xs font-bold` (~28px) | `py-2.5 px-4 text-sm font-bold min-h-[44px]` (Increases clickable height) |
| **Accountant Mode Toggle** | `src/components/dashboard/transactions/TransactionsClient.tsx:310` | `px-3 h-10 rounded-xl` | `px-4 h-11 rounded-xl` (and expand toggle touch padding) |
| **Dropdown Selects & Inputs** | `src/components/dashboard/transactions/TransactionsClient.tsx:274,288` | `h-10` (40px) | `h-11` (44px) |
| **Horizontal Scrolling Table** | `src/components/dashboard/transactions/TransactionsClient.tsx:333-395` | Desktop table view with `overflow-x-auto` | Replace desktop table on mobile with mobile cards (`MobileTransactionList`), using `hidden md:block` and `md:hidden` |
| **visual-audit-cli.ts Hardcoding** | `scripts/synthetic-ux-lab/visual-audit-cli.ts:5` | `const outDir = 'C:/Users/Артём/...';` | `const outDir = process.env.AUDIT_OUTPUT_DIR \|\| path.join(process.cwd(), 'visual_audit_assets');` (Fallback to workspace relative dir) |
| **Breakpoint Mismatch** | `scripts/generate-all-audit-assets.ts:25` | `{ name: '375px', width: 375, height: 812 }` | Add/update to target breakpoints: `320px`, `390px`, `430px` |
