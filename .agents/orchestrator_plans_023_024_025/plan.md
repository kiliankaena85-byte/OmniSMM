# plan.md — Project Plan for Plans 023, 024, and 025

## Architecture
- `src/services/financial/compensation.service.ts`: Computing real margin delta by comparing actual provider cost against retained revenue after refunds.
- `src/workers/processors/sync.processor.ts`: Asynchronous invocation of `CompensationService`.
- Frontend Components under `src/components/landing/order-engine/`:
  - `VisualLinkGuideModal.tsx`
  - `MobileWizard.tsx`
  - `DynamicPayloadWarnings.tsx`
- Admin UI components:
  - `src/components/ui/status-badge.tsx`
  - `src/components/admin/sidebar.tsx`
  - `src/app/admin/tickets/components/tickets-sidebar.tsx`

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Plan 023 (Financial) | Implement CompensationService and integrate it into sync.processor.ts | None | DONE |
| 2 | Plan 024 (Zero-Debt Components) | Decompose VisualLinkGuideModal, MobileWizard, DynamicPayloadWarnings under 150 LOC limit | None | PLANNED |
| 3 | Plan 025 (Admin UI Standards) | Create generic StatusBadge and refactor admin sidebar with TicketsSidebar integration | None | PLANNED |

## Interface Contracts
### CompensationService ↔ sync.processor.ts
- `CompensationService.calculateAndTrackDelta(...)` or similar method to handle margin calculations and record tracking asynchronously (fire-and-forget or deferred batch).
### StatusBadge
- Reusable component using only Tailwind v4 theme tokens (`bg-success/20`, `text-success`, etc.), zero inline colors.
### Component Decompositions
- Must adhere to the strict 150 lines-of-code limit per file.
- Must preserve 100% of existing functionality, React state, TypeScript types, and styling.
