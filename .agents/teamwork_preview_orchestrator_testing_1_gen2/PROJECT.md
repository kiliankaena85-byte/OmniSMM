# Project: Smmplan E2E Testing Stability System

## Architecture
- **Testing Frameworks**: 
  - **Vitest**: Used for unit, integration, and API mock/real tests. Configured via `vitest.config.ts` and `vitest.unit.config.ts`.
  - **Playwright**: Used for real-browser/headless end-to-end user and admin flows. Configured via `playwright.config.ts`.
- **Key Modules to Test**:
  - **Provider Integration**: `src/actions/admin/providers/` and `src/services/` (balance checks, catalog sync, shadow catalog).
  - **Payment Gateways**: YooKassa, Robokassa, CryptoBot client and server validation (`src/services/financial/` and `src/actions/`).
  - **User E2E Flows**: Auth (magic link, password), Catalog viewing, Price-per-unit display (`pricePerUnitRub`), Link validation (`targetType`), order creation.
  - **Admin E2E Flows**: Admin login, provider setup, service importing, markup settings, quarantine checks.
  - **Queue / SLA (BullMQ)**: `src/workers/` (OrderProcessor, SyncProcessor).

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Explore & Map Infrastructure | Scan existing tests, configs, Playwright specs, mock systems, and verify current state. Run articles import script. | None | DONE |
| 2 | R1: Real Provider & Catalog Integration | Implement and supplement integration tests for SMM providers & CBR rates synchronization (with real internet access). | M1 | DONE |
| 3 | R2: Payment Gateways API Verification | Implement tests verifying real API calls (YooKassa, Robokassa, CryptoBot), test keys rollback, and empty credentials fallback. | M1 | DONE |
| 4 | R3: Playwright E2E User Flow Tests | Develop or update E2E tests for password/magic auth, unit pricing display, link validator categories, and checkout/balance deduction. | M1 | DONE |
| 5 | R4: Playwright E2E Admin Panel Tests | Test admin login, provider creation, service import, markup/quarantine logic, and AdminAuditLog logging. | M1 | IN_PROGRESS |
| 6 | R5: Queue & SLA Worker Tests | Cover BullMQ workers (OrderProcessor, SyncProcessor) with queue/SLA checks and Prisma transaction rollback stress tests. | M1 | PLANNED |
| 7 | System Verification & Audit | Run all test suites, linting, build verification, and prepare final handoff. | M2, M3, M4, M5, M6 | PLANNED |

## Interface Contracts
### SMM Provider Client ↔ DB Catalog
- Function: `syncProviderCatalog(providerId)`
- Checks: Redis shadow catalog vs Postgres active services mapping.
### Payment Gateway Selector
- Logic: If settings are empty → `/api/dev/mock-payment`. If test keys configured → switch to test credentials and hit real gateway sandbox API.
