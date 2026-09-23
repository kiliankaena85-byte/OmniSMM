# Synthesis: Milestone 5 (R4: Playwright E2E Admin Panel Tests)

## 1. Consensus
Both Explorer 2 and Explorer 3 agree on the following:
- **Authentication**: We should use the existing E2E fixtures (`e2e/fixtures/auth.fixture.ts`) for authentication. `adminPage` provides an authenticated session for an owner role, while `userPage` provides a regular user session.
- **Database Checking**: We should directly query PostgreSQL using Prisma (`prisma.adminAuditLog`, `prisma.provider`, `prisma.service`, `prisma.ledgerEntry`) inside the tests to verify state, just as `Admin can manually adjust user balance` does in `e2e/admin-panel.spec.ts`.
- **Target Files**: We should extend the existing files `e2e/admin-panel.spec.ts` and `e2e/providers.spec.ts` (or create `e2e/admin-advanced.spec.ts` if extending gets too cluttered). Given clean separation, appending the test cases directly to the existing specs is the most maintainable option.

## 2. Gaps and Required Tests

The following 4 test blocks will be implemented:

### Test Block 1: RBAC & Admin Redirections (in `e2e/admin-panel.spec.ts`)
- **User Page redirection**: Standard users (role `USER`) navigating to `/admin/dashboard` are redirected to `/dashboard/new-order`.
- **Admin Page access**: Administrators (role `OWNER`) navigating to `/admin/dashboard` successfully load the page.

### Test Block 2: Provider CRUD & Audit Log (in `e2e/providers.spec.ts`)
- **Create Provider**: Navigate to `/admin/providers/new`, fill in name, currency (RUB),apiUrl (`http://localhost:3001/api/dev/mock-provider`), apiKey (`test_token`), submit, and verify database creation and `AdminAuditLog` (`PROVIDER_CREATE`).
- **Edit Provider**: Navigate to `/admin/providers/[id]`, change fields, submit, and verify database update and `AdminAuditLog` (`PROVIDER_UPDATE`).

### Test Block 3: Markup Recalculation & Audit Log (in `e2e/admin-panel.spec.ts`)
- **Recalculation check**: Verify that changing a service's markup correctly triggers price recalculation (`rate * markup * exchangeRate`) and logs a `SERVICE_MARKUP_CHANGE` audit log.

### Test Block 4: Quarantine Approvals & Elastic Cooldowns (in `e2e/admin-panel.spec.ts`)
- **Price Spike Approval**: Seed a service in price spike quarantine (`isQuarantined: true`), navigate to `/admin/catalog/quarantine`, click "✅ Принять" (Approve), and verify `isQuarantined` is false and rate is updated to `pendingRate` in Postgres.
- **Elastic Cooldown Display**: Seed a service in elastic cooldown (`cooldownUntil` in the future), navigate to `/dashboard/new-order` (as user), and verify the card shows a cooldown state and cannot be selected/ordered.

## 3. Implementation Plan for Worker
Spawn a worker (`teamwork_preview_worker`) to implement these test blocks.
The worker will write the test cases, run lint and type checking, execute Playwright to verify they pass, and report back.
