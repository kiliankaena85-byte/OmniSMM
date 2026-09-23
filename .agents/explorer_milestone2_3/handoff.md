# Handoff Report: DynamicPayloadWarnings Decomposition

## 1. Observation

- **Monolith File Path**: `src/components/landing/order-engine/DynamicPayloadWarnings.tsx`
- **Current File Size**: 477 lines, ~27.1KB (observed using `view_file` tool call).
- **Current Code Structure**:
  - Combined state logic, warning derivations, social media platform regexes, and UI blocks (10+ conditionally rendered blocks plus a nested swapper suggestion) in one component file.
  - Verification run command output: `tsc --noEmit` completed successfully with exit code 0.
- **Reference Imports**:
  ```typescript
  import { OrderEngine } from "@/hooks/useOrderEngine";
  import { PlatformLinkGuideDrawer } from "./PlatformLinkGuideDrawer";
  import { getLinkValidator } from "@/validators/link-mutators";
  import { inferTargetTypeFromCategory } from "@/utils/target-type";
  ```

## 2. Logic Chain

1. **Observed Constraint**: `AGENTS.md` mandates a strict limit of 150 LOC per React component file.
2. **Observed Violation**: The current `DynamicPayloadWarnings.tsx` has 477 lines, which is 3.18x over the maximum limit.
3. **Derived Cause**: The file handles two distinct responsibilities: warning calculation/logic (evaluating URL patterns, Zod validation, platform compatibility) and rendering (12+ separate UI segments with complex conditional classes and animations).
4. **Proposed Resolution**:
   - Separate warning evaluations into a custom hook `useWarningRules` to decouple logic from the layout.
   - Decompose UI layout into smaller sub-components (`MinimalWarnings.tsx`, `StandardDbWarnings.tsx`, `SocialPlatformWarnings.tsx`, `TelegramMediaGroupInput.tsx`, `CustomPayloadInput.tsx`, `FullValidationWarning.tsx`, `WarningConfirmation.tsx`).
   - Coordinate rendering from the main `DynamicPayloadWarnings.tsx` shell, resulting in all proposed files falling under 120 LOC.

## 3. Caveats

- **No Implementation Mode**: Under read-only constraints, we did not execute the decomposition or modify any files under `src/`.
- **Imports**: Sub-components must correctly import internal utility hooks/methods. This requires introducing a new subdirectory `src/components/landing/order-engine/warnings/` to host sub-components without cluttering the parent folder.

## 4. Conclusion

The decomposition plan splits the 477 LOC monolith into 8 modular files (1 hook, 7 child components, 1 main entry wrapper), where no single file exceeds 120 lines. This strategy preserves all tailwind classes, framer-motion animations, engine state interfaces, and UX states, keeping the layout completely identical while meeting the strict developer contract constraints.

## 5. Verification Method

To verify the proposed implementation after files are written:
1. Run ESLint check:
   ```bash
   npm run lint
   ```
2. Run TypeScript compiler to check for type mismatches, missing props, or interface issues:
   ```bash
   npm run typecheck
   ```
3. Run the visual QA testing script to ensure no layout regressions occur:
   ```bash
   npm run visual-qa
   ```
