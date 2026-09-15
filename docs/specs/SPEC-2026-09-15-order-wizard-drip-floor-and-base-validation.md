# SPEC-2026-09-15: Drip-Feed Floor Inline Warning and Base Validation Layer

## 1. Context & Objectives
In compliance with `CDD-TDD 2026` and `AGENTS.md §4` (UI Pricing Policy & Drip-Feed Floor Invariant):
1. **Drip-Feed Floor Inline Warning (T2-2)**:
   - When Drip-Feed is active, the per-run quantity `Math.floor(quantity / runs)` must never be below `selectedService.minQty`.
   - In `CheckoutDripFeed.tsx`, an alert banner (`AlertTriangle`, amber/destructive) must be displayed directly inside `CheckoutDripFeed` when this invariant is violated.
   - The warning must clearly state the minimum total quantity required for the selected number of runs (`runs * minQty`).
2. **Shared Validation Layer (`src/hooks/useBaseOrderValidation.ts`) (T2-3)**:
   - Extract a pure, testable validation helper module and hook.
   - Features:
     - `validateDripFeedFloor(quantity, runs, minQty)`
     - `validateLinkFormat(link, platformSlug, targetType)`
     - `checkLinkCompatibility(detectedType, serviceTargetType)`
     - `saveDraftToStorage(key, data)` & `loadDraftFromStorage(key)`
   - Used by `useSmmplanOrderWizard` and verified with unit tests.

## 2. Component Contract & DTOs
```typescript
export interface DripFeedFloorCheck {
  isValid: boolean;
  minRequiredTotal: number;
  perRunQuantity: number;
  warningMessage: string | null;
}
```

## 3. Test Cases (TDD Red Phase)
- `validateDripFeedFloor`:
  - returns `isValid: true` when Drip-Feed is disabled or runs < 2.
  - returns `isValid: false` and message when `quantity = 100`, `runs = 5`, `minQty = 50` (100 / 5 = 20 < 50, required >= 250).
  - returns `isValid: true` when `quantity = 250`, `runs = 5`, `minQty = 50` (250 / 5 = 50 >= 50).
- `validateLinkFormat`:
  - returns error for invalid link format according to targetType.
  - returns null for valid link format.