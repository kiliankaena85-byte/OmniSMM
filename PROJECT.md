# Project: SMMplan / SMMflux Admin Reliability & Ergonomics

## Architecture
- **Framework & Runtime**: Next.js 16 (App Router), React 19, TypeScript 5.7+ (strict), Tailwind CSS 4 (`@theme`), HeroUI v3.
- **Database & Cache Layer**: PostgreSQL via Prisma 5 ORM, Redis singleton via `ioredis` for 60s TTL provider balance cache and rate limiting.
- **Financial Subsystem**: Invariant-driven Double-Entry Ledger (`LedgerEntry` sum vs `User.balance`), BigInt (kopecks), `WalletOps` primitives, `auditAdminAwaitable()` logging, and `idempotencyKey` tracking.
- **Data Fetching & Pagination**: Keyset pagination with deterministic compound index tie-breaking (`(createdAt DESC, id DESC)`), sub-30ms query latency on 50,000+ records.
- **UI & UX Layer**: Server Components by default, Server Actions with `requireStaffPermission()`, `useRangeSelection` for $O(K)$ Shift+Click multi-selection, global `ShortcutsModal` (`?` key) adhering to 100/100 Design Guild semantic tokens.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | R1.1 Redis Provider Balance Caching | 60s Redis TTL cache (`provider:${id}:balance`), 5s timeout race, error backoff | M1 | ORIGINAL_REQUEST §R1 |
| 2 | R1.2 Provider Health & Status Categorization | 3-tier status (> $50 Green, $10-$50 Yellow, < $10 Red Alert) with currency normalization | M1 | ORIGINAL_REQUEST §R1 |
| 3 | R1.3 Admin Providers & Dashboard UI | Upgraded `ProviderBalanceCell` and `ProviderLiquidityWidget` with auto-polling & tooltips | M1 | ORIGINAL_REQUEST §R1 |
| 4 | R2.1 Ledger Reconciliation Aggregator | Single SQL query comparing `User.balance` with `SUM(LedgerEntry.amount WHERE status = 'APPROVED')` | M2 | ORIGINAL_REQUEST §R2 |
| 5 | R2.2 Finance Reconciliation Dashboard | 4th tab in `/admin/finance` with KPI cards, anomaly badge counters, and search filter | M2 | ORIGINAL_REQUEST §R2 |
| 6 | R2.3 Interactive Transaction Audit & Drawer | Step-by-step running balance timeline reconstruction and audited remediation (`LOCK`, `AUTO_ADJUST`) | M2 | ORIGINAL_REQUEST §R2 |
| 7 | R3.1 Database B-Tree Index Optimization | Compound indexes on `Order`, `LedgerEntry`, and `User` for `[tenantId, createdAt(Desc), id(Desc)]` | M3 | ORIGINAL_REQUEST §R3 |
| 8 | R3.2 Keyset Pagination Engine | Bidirectional deterministic cursor pagination helper (`src/lib/pagination.ts`) with tie-breaker | M3 | ORIGINAL_REQUEST §R3 |
| 9 | R4.1 Shift + Click Range Selection | $O(K)$ Range selection hook and integration into `catalog-table-v2.tsx` and `order-client.tsx` | M4 | ORIGINAL_REQUEST §R4 |
| 10 | R4.2 Global Keyboard Shortcuts Modal | Global `?` shortcut modal in `/admin/layout.tsx` with navigation shortcuts and input guarding | M4 | ORIGINAL_REQUEST §R4 |
| 11 | R5.1 System Integration & Quality Gate | 0 type errors (`npx tsc --noEmit`), 100% Vitest pass, Design Guild 100/100, Forensic Audit | M5 | ORIGINAL_REQUEST §Acceptance |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Provider Health & Balance Monitor | R1.1, R1.2, R1.3: Service, Server Actions, `ProviderBalanceCell`, `ProviderLiquidityWidget`, Unit tests | none | DONE |
| M2 | Ledger Reconciliation Guard | R2.1, R2.2, R2.3: Service, Server Actions, `ReconciliationTab`, `LedgerAuditDrawer`, Unit tests | none | IN_PROGRESS |
| M3 | Keyset Pagination & B-Tree Optimization | R3.1, R3.2: Prisma schema indexes, `keysetPaginatedQuery` helper, table action updates | none | PLANNED |
| M4 | Keyboard-First & Range Selection Ergonomics | R4.1, R4.2: `useRangeSelection` hook, `catalog-table-v2.tsx`, `order-client.tsx`, `ShortcutsModal` | none | PLANNED |
| M5 | E2E Integration & Full Suite Verification | R5.1: Full TypeScript check, Vitest run, Design Guild 100/100 audit, Forensic integrity verification | M1, M2, M3, M4 | PLANNED |

## Interface Contracts

### M1: Provider Balance Monitor
- `ProviderBalanceService.getProviderBalance(providerId: string, forceRefresh?: boolean): Promise<CachedProviderBalance>`
- `ProviderBalanceService.getAllProviderBalances(forceRefresh?: boolean): Promise<CachedProviderBalance[]>`
- `ProviderBalanceService.getGlobalLiquiditySummary(forceRefresh?: boolean): Promise<GlobalLiquiditySummary>`
- `CachedProviderBalance`: `{ providerId, providerName, balance, rawBalance, currency, balanceUsd, balanceRub, status: 'healthy' | 'warning' | 'critical' | 'error', latencyMs, cachedAt, expiresAt, error? }`

### M2: Ledger Reconciliation Guard
- `LedgerReconciliationService.getSummary(tenantId?: string): Promise<ReconciliationSummaryDTO>`
- `LedgerReconciliationService.getAccounts(params): Promise<{ items: ReconciledAccountDTO[], totalCount: number, page: number, pageSize: number }>`
- `LedgerReconciliationService.getUserAuditTimeline(userId: string): Promise<UserAuditTimelineDTO>`
- `LedgerReconciliationService.remediateUser(userId: string, action: 'LOCK' | 'AUTO_ADJUST', admin, reason?): Promise<{ success: boolean, message: string }>`

### M3: Keyset Pagination
- `keysetPaginatedQuery<T>(model: any, options: KeysetPaginationOptions): Promise<KeysetPaginatedResult<T>>`
- Indices:
  - `Order`: `@@index([tenantId, createdAt(sort: Desc), id(sort: Desc)])`, `@@index([createdAt(sort: Desc), id(sort: Desc)])`
  - `LedgerEntry`: `@@index([tenantId, createdAt(sort: Desc), id(sort: Desc)])`, `@@index([createdAt(sort: Desc), id(sort: Desc)])`, `@@index([userId, createdAt(sort: Desc), id(sort: Desc)])`
  - `User`: `@@index([createdAt(sort: Desc), id(sort: Desc)])`, `@@index([tenantId, createdAt(sort: Desc), id(sort: Desc)])`

### M4: Range Selection & Shortcuts
- `useRangeSelection<T extends { id: string }>(items: T[])`: `{ selectedIds, selectedCount, isSelected, isAllSelected, toggleRow(id, e), selectAll, clearSelection, toggleSelectAll }`
- Global Shortcut Modal: Triggered by `?` (`Shift + /`), dismissed with `Escape`, ignores focused input/textarea.

## Code Layout
- `src/services/admin/provider-balance.service.ts`: Provider balance caching & health evaluation.
- `src/actions/admin/providers/balance.ts`: Provider balance server actions.
- `src/app/admin/providers/components/provider-balance-cell.tsx`: Upgraded provider balance cell.
- `src/app/admin/dashboard/ProviderLiquidityWidget.tsx`: Upgraded provider liquidity widget.
- `src/services/financial/ledger-reconciliation.service.ts`: SQL ledger reconciliation aggregator.
- `src/actions/admin/finance/reconciliation.ts`: Finance reconciliation server actions.
- `src/app/admin/finance/components/reconciliation-tab.tsx`: Reconciliation tab component.
- `src/app/admin/finance/components/ledger-audit-drawer.tsx`: Transaction audit drawer.
- `src/app/admin/finance/finance-client.tsx`: Updated finance client tabs.
- `src/lib/pagination.ts`: Keyset pagination helper.
- `prisma/schema.prisma`: Composite B-Tree indexes.
- `src/hooks/use-range-selection.ts`: Shift+Click range selection hook.
- `src/components/admin/catalog-table-v2.tsx`: Catalog table range selection.
- `src/app/admin/orders/components/order-client.tsx`: Orders table range selection.
- `src/components/admin/shortcuts-modal.tsx`: Global shortcuts modal.
- `src/app/admin/layout.tsx`: Admin layout with shortcuts modal.
