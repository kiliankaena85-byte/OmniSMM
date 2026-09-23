# Handoff Report - MobileWizard Decomposition

## 1. Observation
- File investigated: `src/components/landing/order-engine/MobileWizard.tsx`
  - Total Lines: 762 lines of code (LOC).
  - Contains 4 distinct step blocks, local state handlers, auto-scrolling refs (`step2Ref`, `step3Ref`, `step4Ref`), and a sticky action CTA bar.
- Found that Step 4 spans lines 521 to 705 (184 lines), which exceeds the strict 150 LOC limit by itself.
- Verified dependencies:
  - `OrderEngine` type is imported from `@/hooks/useOrderEngine`.
  - `BrandStyle` and `getBrandStyles` are imported from `@/utils/brand-styles`.
  - Layout relies on HeroUI v3 button styles (`intent="outline"`) and Tailwind v4 CSS classes.

## 2. Logic Chain
- **Requirement**: No file may exceed 150 LOC.
- **Decomposition Need**: Since the core file has 762 LOC and Step 4 alone has 184 LOC, simple extraction of Step 4 will fail the requirement.
- **State Separation**: Keeping state and lifecycle `useEffect` hooks in the main component (`index.tsx`) would balloon its size (~145 LOC). Extracting them to `useMobileWizardState.ts` keeps the parent extremely clean (~65 LOC) and the hook itself compact (~110 LOC).
- **Step 4 De-escalation**: Splitting Step 4 into isolated sub-components (`Step4QuantityInput`, `Step4PromoSection`, `Step4CheckoutButton`) brings the main step container down to ~110 LOC.
- **Result**: Every generated file falls safely between 35 and 115 LOC.

## 3. Caveats
- No implementation was executed as this is a read-only investigation.
- The state hook holds refs for scrolling. Passing these refs as props or using forward reference callbacks is required to preserve scroll-into-view behaviors.

## 4. Conclusion
We have completed a modular design for the mobile wizard. The component can be refactored into:
- 1 state hook (`useMobileWizardState.ts`)
- 1 entry component (`index.tsx`)
- 8 sub-components for steps and inputs.
This successfully respects the 150 LOC boundary and preserves identical UI/UX.

## 5. Verification Method
- **File Length Audit**: Count lines for each newly created file in the `mobile-wizard` directory; none should exceed 150.
- **Static Analysis**: Run `npx tsc --noEmit` from the project root to ensure type safety.
- **UAT & UX Check**: Emulate a mobile device in a browser, fill a URL, select a category/tariff, and confirm the step auto-advances and scrolls smoothly to the next active step.
