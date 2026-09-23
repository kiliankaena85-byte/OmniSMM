# Scope: Mobile Layout Visual Audit and Bug Fixing

## Architecture
This sub-project focuses on the mobile responsiveness, contrast accessibility, and touch target optimization for Smmplan's client and dashboard views across three target viewports: 320px, 390px, and 430px.

Key Areas:
- **Contrast Accessibility**: Fix text contrast in dashboard table headers on light backgrounds.
- **Touch Target Sizing**: Ensure all mobile interactive elements (buttons, filters, switches) have a minimum hit target size of 44x44px.
- **Responsive Tables**: Replace horizontal scrolling desktop-density tables on mobile with high-fidelity, card-based mobile lists.
- **Tooling Portability**: Generalize screenshot and audit scripts to run portably in any workspace environment.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| 1 | Explore & Audit | Codebase exploration of mobile layout, z-index, notches, overflow, z-index, and contrast issues. | None | DONE |
| 2 | Style & UX Bug Fixing | Implement contrast adjustments, touch targets >= 44px, and card-based transaction layouts. | M1 | IN_PROGRESS |
| 3 | E2E & Screenshot Generation | Generate standard and grayscale screenshots for 20 screens across 3 breakpoints. | M2 | PLANNED |
| 4 | Verification & Quality Review | Peer review, Forensic Audit, TypeScript build/lint checks, and final synthesis. | M3 | PLANNED |

## Interface Contracts
- **Tailwind CSS 4.0.0 Compliance**: Use only semantic variables (e.g. `text-foreground/75 bg-muted/30`) in accordance with the `@theme` definitions in `src/app/globals.css`. Direct inline/hardcoded hex colors or standard tailwind color names (like `text-slate-500`) are prohibited in the components.
- **Touch Target Threshold**: All tappable components on mobile MUST be at least 44x44px or have equivalent padding to prevent layout squeezing.
- **Responsive Layout Breakpoints**: Use `hidden md:block` for desktop elements and `md:hidden` or block elements for mobile layouts. Target breakpoints for visual testing must be strictly `320px`, `390px`, and `430px`.
- **Cyrillic Typography**: Ensure line-height is at least `leading-relaxed` (or `1.5` - `1.6`) and add +15-20% horizontal padding for button text or labels to accommodate Russian text expansion.
