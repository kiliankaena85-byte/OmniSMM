# Project: SMMplan Comprehensive Audit and Verification

## Architecture
- Framework: Next.js 16.0.10, React 19.0.0, Tailwind CSS 4.0.0, HeroUI v3, Prisma 5 (PostgreSQL), BullMQ, Redis, TypeScript 5.7+
- Domain: API SMM panel with multi-tenant client dashboards (SMMplan & SMMflux)

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | R1: E2E Audit & Static Analysis | Execute `npm run test:tenant`, `npx tsc --noEmit`, and `npm run build` verification | none | IN_PROGRESS |
| 2 | R2: Payment Gateways & Provider APIs | Verify YooKassa, Robokassa, CryptoBot and SMM provider APIs in test mode (webhooks, signatures, order statuses) | M1 | PLANNED |
| 3 | R3: Security & Trust Boundaries | Audit `requireAdmin`, `verifySession`, price/qty tampering, IDOR, and `x-tenant-id` enforcement | M1 | PLANNED |
| 4 | R4: Performance & UX Audit | React 19 hydration errors, cyclic re-renders, Tailwind v4 / HeroUI v3 tokens & contrast verification | M1 | PLANNED |

## Interface Contracts
### E2E & Static Analysis
- Command verification output logs for `npm run test:tenant` (33/33 scenarios)
- TypeScript zero-error output for `npx tsc --noEmit`
- Production bundle build success for `npm run build`

### Payment Gateways & Provider APIs
- Webhook signature validation & test mode responses (YooKassa, Robokassa, CryptoBot)
- Provider API status polling & webhook handling (UniversalProvider, QuarantineService, BullMQ workers)

### Security & Trust Boundaries
- Authorization guards on all Server Actions & API routes (`requireAdmin`, `verifySession`)
- Server-side price calculation integrity (`pricePerUnitRub`, cents rounding)
- Multi-tenancy isolation (`x-tenant-id` header & session scoping)

### Performance & UX
- React 19 hydration compliance (no SSR/client mismatch warnings)
- Visual token compliance (Tailwind v4 `@theme`, HeroUI v3 semantic tokens)

## Code Layout
- `src/actions/` — Server Actions with security guards
- `src/app/` — Next.js 16 App Router pages and API routes (`src/app/api/`)
- `src/services/` — Provider services, financial accounting, payment services
- `src/workers/` — BullMQ background workers
- `src/utils/` — Balance verifier, target-type, link-analyzer
- `tests/` / `scripts/` — Test scripts including `test:tenant`

