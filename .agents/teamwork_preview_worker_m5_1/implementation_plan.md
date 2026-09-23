# Implementation Plan — Milestone 5 (R4: E2E Playwright Tests)

This plan outlines the steps to implement advanced Playwright E2E tests covering the 4 required test blocks.

## 1. Test Block 1: RBAC & Admin Redirections
- **Target File**: `e2e/admin-panel.spec.ts`
- **Method**: Use `userPage` and `adminPage` from `e2e/fixtures/auth.fixture.ts`.
- **Test Steps**:
  1. Login as standard user (`USER` role) and attempt to load `/admin` and `/admin/dashboard`. Assert redirection to `/dashboard/new-order`.
  2. Login as admin (`OWNER` role) and attempt to load `/admin/dashboard`. Assert the page loads successfully without redirection.

## 2. Test Block 2: Provider CRUD & Audit Logging
- **Target File**: `e2e/providers.spec.ts`
- **Method**: Use admin session (`page` or `adminPage`) and PrismaClient.
- **Test Steps**:
  1. Navigate to `/admin/providers/new`.
  2. Fill Name: `E2E CRUD Provider`, API URL: `http://localhost:3001/api/dev/mock-provider`, API Key: `dev_mock_key`, Currency: `RUB`.
  3. Click "Создать подключение". Expect redirect to `/admin/providers` and success toast.
  4. Query DB: Confirm `Provider` was created and `AdminAuditLog` contains `PROVIDER_CREATE` with target provider ID.
  5. Edit the provider by navigating to `/admin/providers/[id]`.
  6. Change Name: `E2E CRUD Provider Edited`. Click "Сохранить".
  7. Expect success toast.
  8. Query DB: Confirm updated name and `AdminAuditLog` contains `PROVIDER_UPDATE` with target provider ID.
  9. Clean up provider in DB in a `finally` block or `afterAll`.

## 3. Test Block 3: Markup Pricing & Recalculation
- **Target File**: `e2e/admin-panel.spec.ts`
- **Method**: Seed service, modify markup in table, verify DB recalculation.
- **Test Steps**:
  1. Seed network, category, provider, and service (`rate: 10.0`, `markup: 3.0`).
  2. Clear Next.js cache by requesting `/api/debug?revalidate=catalog`.
  3. Go to `/admin/catalog?category=[categoryId]`.
  4. Find the row for the seeded service. Locate the last numeric input in that row (markup percentage).
  5. Fill with `250` (meaning `+250%` markup or `3.5x`). Press Enter or trigger blur.
  6. Expect success toast.
  7. Query DB:
     - Verify `markup` is ~3.5.
     - Verify `pricePer1000Cents` matches `Math.round(applyBeautifulRounding(rate * markup * usdToRub) * 100)`.
     - Verify `AdminAuditLog` contains `SERVICE_MARKUP_UPDATE` (or `SERVICE_MARKUP_CHANGE`).
  8. Clean up service, category, and provider.

## 4. Test Block 4: Quarantine & Elastic Cooldown
- **Target File**: `e2e/admin-panel.spec.ts`
- **Method**: Seed quarantined service, approve in UI, verify DB. Seed cooldown service, verify disabled state in new order UI.
- **Test Steps**:
  - **Price Spike Approval**:
    1. Seed a quarantined service (`isQuarantined: true`, `pendingRate: 15.0`, `rate: 10.0`).
    2. Go to `/admin/catalog/quarantine`.
    3. Verify service and pending rate are visible.
    4. Click "✅ Принять".
    5. Verify success toast.
    6. Query DB: Confirm `isQuarantined: false`, `rate: 15.0`, `pendingRate: null`, and `AdminAuditLog` has `QUARANTINE_APPROVE`.
  - **Elastic Cooldown Display**:
    1. Seed service in elastic cooldown (`cooldownUntil` set to `Date.now() + 10 * 60 * 1000`).
    2. Clear Next.js cache: request `/api/debug?revalidate=catalog`.
    3. Go to `/dashboard/new-order` as standard user (`userPage`).
    4. Fill link, click category tab, find card for the service.
    5. Verify the card button is disabled, opacity is lower, and it contains "⏳ Временно недоступен".
    6. Click card and verify it does not select or trigger order forms.

## 5. Failure Simulation (Pre-Mortem Analysis)

| Risk Scenario | Protection Mechanism | Verification |
| --- | --- | --- |
| Page caching hides new/updated services on `/dashboard/new-order` | Request `/api/debug?revalidate=catalog` before loading `/dashboard/new-order` | Verify cache revalidation clears cache successfully |
| Port collision with parallel dev server or duplicate test runs | Playwright uses port 3001, reuseExistingServer: true, or run tests with custom configuration | Verify test suite completes successfully without EADDRINUSE errors |
| Test database remains polluted with seeded providers/services | Try-finally block and `afterAll` cleanup queries in Prisma | Verify no leftover `E2E ` data remains in DB after execution |
