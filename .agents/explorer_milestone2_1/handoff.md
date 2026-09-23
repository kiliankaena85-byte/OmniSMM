# Handoff Report — explorer_milestone2_1

## 1. Observation
- **Target File**: `src/components/landing/order-engine/VisualLinkGuideModal.tsx`
- **Current Size**: 50,318 bytes (~50 KB), containing 759 Lines of Code (LOC).
- **Structure**:
  - `VisualLinkGuideModal` contains state for `platform`, `contentType`, and `deviceTab`.
  - An effect (lines 25-41) syncs state based on `initialPlatform` / `initialContentType`.
  - A massive helper function `renderSteps` (lines 180-700) contains nested conditions and 33 inline SVGs representing user interfaces for Instagram, Telegram, and VK.
  - A warning footer component `renderFooterWarning` (lines 703-758) displays status warnings based on the selected platform and content type.

---

## 2. Logic Chain
- **Rule Requirement**: According to `AGENTS.md` rules, components must not exceed 150 LOC ("Компоненты максимум 150 строк. Декомпозируй на sub-components.").
- **File Length**: The current file (759 LOC) and any direct single-file platform breakdown (e.g. `VkGuide.tsx` including all 15 inline SVGs and steps) would exceed this limit.
- **Decomposition Design**:
  - Separating steps definition and SVGs into platform-specific folders (`instagram/`, `telegram/`, `vk/`).
  - Extracting the SVGs into separate files (e.g. `vk/svgs.tsx`, which contains ~140 LOC).
  - Creating a reusable `StepItem` component (~35 LOC) to host standard layout markup, avoiding code replication.
  - Relocating types and constants to dedicated files (`types.ts`, `constants.ts`).
  - This ensures every single newly created file remains well below the strict 150 LOC limit.

---

## 3. Caveats
- No actual changes were implemented on the codebase as this is a read-only investigation.
- We assumed the dynamic import referred to by the parent imports matches standard React dynamic import capabilities (`next/dynamic`) and that our proposed component retains the same props signature.

---

## 4. Conclusion
We conclude that `VisualLinkGuideModal.tsx` can be successfully decomposed into a new directory structure `src/components/landing/order-engine/visual-link-guide/` containing modular components. Each proposed file has an estimated line count of under 140 lines, well below the 150 LOC limit, preserving identical functionality, styling, and type safety.

---

## 5. Verification Method
- **Inspection**: View the proposed files mapping and line of code projections in `d:\SMM_plan_2\.agents\explorer_milestone2_1\analysis.md`.
- **Validation**: Verify that the next agent implementing these changes uses `npx tsc --noEmit` and `npm run build` to confirm there are no type issues or regressions.
