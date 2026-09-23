## Current Position

Milestone: v3.1 Post-MVP Enhancements
Phase: Production Hardening & Testing
Status: COMPLETED
Last activity: 2026-06-26 — Full E2E Playwright route crawling, B2B Mass Orders, and Price Drift quarantine verified.

### Done:
- [x] Sidebar grouping (Operations, Finance, Core, System).
- [x] Catalog: Denormalized RUB pricing with "Beautiful Rounding".
- [x] Catalog: RBAC support (hide provider rates for SUPPORT).
- [x] Orders: Sub-navigation Tabs (Orders/Refills).
- [x] Orders: RBAC support (hide cost for SUPPORT).
- [x] Clients: RBAC support (hide balance/LTV/adjustments for SUPPORT).
- [x] Server Actions: Unified `requireStaffPermission` security.
- [x] Marketing: Refined Promocodes & Referrals with interactive UI.
- [x] Finance: Dashboard overhaul (KPIs, Ledger DataTable, Escrow Quarantine).
- [x] Settings: Reorganized System/Integrations/Team/Audit tabs with improved UX.
- [x] Analytics: Service-level profitability charts & LTV tables.
- [x] Tickets: Complete refactoring to HeroUI (AI-assisted replies abandoned per architectural decision).
- [x] Provider Sync Hardening: Webhook routing integration (VexBoost).
- [x] **Financial Integrity:** Removed Redis-based locks (MutexManager) from WalletOps & PaymentGateway, shifting to native PostgreSQL Serializable isolation.
- [x] **Architectural Audit:** Confirmed no Next.js RSC boundary violations, trust boundary leaks, or N+1 query patterns in Admin routes.
- [x] Technical Debt: Resolved typescript & linting health through strict configs and auto-fixes.
- [x] Catalog Import UAT: Finalized robust import logic for provider services (Shadow Catalog).
- [x] Phase 2: Production Hardening (Docker, CI/CD, Linux Migration).

## Accumulated Context

### Pending Todos
- [ ] Link SMM orders in support chats ([2026-05-23-link-smm-orders-in-support-chats.md](file:///d:/SMM_plan_2/.planning/todos/pending/2026-05-23-link-smm-orders-in-support-chats.md))
