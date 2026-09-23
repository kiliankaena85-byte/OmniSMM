Execute Plans 023, 024, and 025 to harden financial tracking, eliminate technical debt in high-churn frontend components, and standardize administrative UI states for the Smmplan platform.

Working directory: d:\SMM_plan_2
Integrity mode: development

## Requirements

### R1. Implement Compensation Loss Function (Financial Logic)
- **Goal**: Accurately track financial disparities during order syncs when a service transitions to `PARTIAL` or `CANCELED`.
- **Deliverable**: Create `CompensationService` (`src/services/financial/compensation.service.ts`) capable of computing the real margin delta. It must compare the provider's actual charged cost against the retained customer revenue after refunds.
- **Integration**: Inject this service into `src/workers/processors/sync.processor.ts`. It must log or persist "Compensation Loss" records. 
- **Constraint**: Tracking must occur asynchronously (fire-and-forget or deferred batch) to ensure it does NOT block or slow down the high-throughput sync worker.

### R2. Decompose Top-3 Churn Risk Components (Technical Debt)
- **Goal**: Eliminate massive, difficult-to-maintain UI files by strictly enforcing the 150-lines-of-code maximum rule from `AGENTS.md`.
- **Targets**:
  - `VisualLinkGuideModal.tsx` (~50KB): Isolate platform-specific visual guides (e.g., Telegram, VK) into independent child components.
  - `MobileWizard.tsx` (~34KB): Separate wizard stages (Category, Service, Input, Checkout) into distinct step modules.
  - `DynamicPayloadWarnings.tsx` (~27KB): Replace monolithic conditional logic with a strategy pattern or distinct warning components.
- **Constraint**: Maintain an identical user experience. Do not alter existing business logic. No single resulting file may exceed 150 LOC.

### R3. Standardize Admin UI Badges and Sidebar (UI/UX)
- **Goal**: Consolidate status representations and improve admin navigation.
- **Deliverable**: Build a strict, generic `<StatusBadge />` component in `src/components/ui/status-badge.tsx`. 
- **Constraint**: It must map generic statuses (e.g., `COMPLETED`, `PENDING`, `CANCELED`) exclusively using Tailwind v4 semantic `@theme` tokens (e.g., `text-primary`, `bg-destructive/10`). Absolutely no hardcoded inline colors (like `text-green-500`).
- **Integration**: Refactor `src/components/admin/sidebar.tsx` to utilize updated design principles and integrate cleanly alongside the newly decoupled `TicketsSidebar`.

## Acceptance Criteria

### Programmatic Verification
- [ ] **Type Integrity**: `npx tsc --noEmit` must execute with 0 errors across the entire codebase.
- [ ] **Code Quality**: `npm run lint` must return 0 errors, validating the proper cleanup of unused imports in all decomposed files.
- [ ] **Functional Stability**: `npx vitest run` must pass 100%, proving that checkout logic, sync workers, and payment gateways were not broken by refactoring.

### Code Metrics & Structure
- [ ] **File Size Limit**: `VisualLinkGuideModal`, `MobileWizard`, `DynamicPayloadWarnings`, and all of their newly created child components must be strictly ≤ 150 lines of code.
- [ ] **Token Compliance**: The `<StatusBadge />` component contains 0 instances of arbitrary inline colors, relying entirely on semantic design system tokens.
- [ ] **Performance Integrity**: `syncProcessor` logic must be manually reviewed by the implementing agent to confirm that compensation calculation does not introduce blocking asynchronous waits (`await`) during the main provider sync loop.
