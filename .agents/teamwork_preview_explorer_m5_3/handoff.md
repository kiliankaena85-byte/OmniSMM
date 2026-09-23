# Handoff Report — Playwright E2E Admin Panel Tests Strategy

This report establishes the transition plan and actionable test strategy for implementing E2E Playwright tests covering admin panel features, provider CRUD, markup calculations, quarantine logic, and audit logging.

---

## 1. Observation

Direct observations from read-only filesystem investigation:
*   **Authentication Fixtures**: In `e2e/fixtures/auth.fixture.ts` (lines 12–108), the test harness exposes `adminPage` (owner role) and `userPage` (regular user role) page contexts that automatically provision temporary DB records and cleanup on completion.
*   **Access Control**: In `src/app/admin/layout.tsx` (lines 74–76), access control is enforced at layout level:
    ```typescript
    if (!user || !ADMIN_ROLES.includes(user.role)) {
      redirect('/dashboard/new-order');
    }
    ```
*   **Provider Form Fields**: In `src/app/admin/providers/components/provider-form.tsx` (lines 342–413), inputs are mapped as:
    *   Name: `input[name="name"]` / `aria-label="Название провайдера"`
    *   Currency: `select[name="balanceCurrency"]`
    *   API URL: `input[name="apiUrl"]` / `aria-label="API URL провайдера"`
    *   API Key: `input[name="apiKey"]` / `aria-label="API ключ провайдера"`
    *   Create button: `button:has-text("Создать подключение")` or `button[aria-label="Создать провайдера"]`
    *   Save button: `button:has-text("Сохранить")` or `button[aria-label="Сохранить изменения провайдера"]`
*   **Quarantine / Price Spike Logic**: In `src/services/admin/catalog.service.ts` (lines 328–353), catalog sync detects price drifts and quarantines services:
    ```typescript
    if (actualMarkup < SAFETY_FLOOR_MARKUP) {
      // 1. Margin Floor breach -> Quarantine
      ...
    } else if (driftPercent > QUARANTINE_THRESHOLD) {
      // 2. Quarantine threshold > 20%
      ...
    }
    ```
*   **Quarantine UI Actions**: In `src/app/admin/catalog/quarantine/quarantine-client.tsx` (lines 48–107), buttons trigger server actions `approveQuarantinedService`, `rejectQuarantinedService`, `archiveZombieService`, and `liftApiBlock`.
*   **Database Assertions**: The test `Admin can manually adjust user balance` in `e2e/admin-panel.spec.ts` (lines 185–217) successfully imports and utilizes `PrismaClient` to verify ledger transactions and `AdminAuditLog` records directly:
    ```typescript
    const ledgerEntry = await prisma.ledgerEntry.findFirst({ ... });
    const auditLogs = await prisma.adminAuditLog.findMany({ ... });
    ```

---

## 2. Logic Chain

*   **RBAC / Login Verification**: Using `userPage` and `adminPage` fixtures, we can verify access redirection. A standard `userPage` navigating to `/admin/dashboard` should immediately trigger a redirect to `/dashboard/new-order`, whereas an `adminPage` context should successfully load `/admin/dashboard`.
*   **Provider CRUD Verification**:
    1.  Navigate to `/admin/providers/new` using `adminPage`.
    2.  Fill out the `ProviderForm` fields and submit.
    3.  Verify the new provider is created in PostgreSQL and is visible in the providers list.
    4.  Navigate to `/admin/providers/[id]` for the newly created provider, modify the name or currency, and save.
    5.  Assert that `PROVIDER_CREATE` and `PROVIDER_UPDATE` entries are correctly created in `AdminAuditLog` in PostgreSQL.
*   **Markup recaclulation & Audit**:
    1.  Seed a test service with `rate = 1.0` (USD), `markup = 1.5`, and global exchange rate = `100.0`.
    2.  Update the markup to `2.0` on `/admin/catalog` or `/admin/services/[id]/routing` page.
    3.  Verify the database record has updated `markup = 2.0` and recalculated `pricePer1000Cents = 20000` ($1.0 \times 2.0 \times 100 \times 100$).
    4.  Confirm a `SERVICE_MARKUP_CHANGE` entry is present in `AdminAuditLog`.
*   **Quarantine (Price Spike & Elastic Cooldown)**:
    1.  *Price Spike*: Seed a service with `rate = 1.0` and sync it with a mock provider returning a rate of `1.3` (30% increase).
    2.  Verify `isQuarantined` becomes `true` in DB, and order placement via the order placement action returns a quarantine error.
    3.  Navigate to `/admin/catalog/quarantine` (Price Spikes tab), locate the service, click "✅ Принять" (approve), and verify `isQuarantined` is set to `false` and the rate updates to `1.3` in Postgres.
    4.  *Elastic Cooldown*: Seed a service with `cooldownUntil` set to $2\text{ hours}$ in the future.
    5.  Navigate to `/dashboard/new-order` or landing page using `userPage`, locate the service card, and assert it is styled as disabled/cooldown and cannot be selected.

---

## 3. Caveats

*   **Mock Services Dependency**: The E2E tests for sync and importing rely on a local mock provider server running on `http://localhost:3001/api/dev/mock-provider`. Ensure this mock endpoint is running or mocked appropriately when executing the tests.
*   **Environment Configuration**: The tests assume `JWT_SECRET` is set in the test environment configuration to enable fixture token generation.

---

## 4. Conclusion

The existing E2E infrastructure is fully capable of hosting these additional test scenarios. Extending `e2e/admin-panel.spec.ts` and `e2e/providers.spec.ts` is the recommended path to achieve 100% target coverage for the admin features.

---

## 5. Verification Method

To execute and verify the implemented tests:
1.  Run E2E tests:
    ```bash
    npx playwright test e2e/admin-panel.spec.ts e2e/providers.spec.ts
    ```
2.  Inspect schema files to confirm database state checks remain valid.
3.  Ensure formatting and compilation pass:
    ```bash
    npx tsc --noEmit
    npx eslint
    ```

---

## 6. Remaining Work

The implementer agent must write the following test blocks:

### Test Block 1: RBAC & Admin Redirections (in `e2e/admin-panel.spec.ts`)
*   Create a test: `User without admin permissions is redirected from admin panel`. Uses the `userPage` fixture, navigates to `/admin/dashboard`, and asserts that the URL redirects to `/dashboard/new-order`.
*   Create a test: `Admin with OWNER role can load admin dashboard`. Uses the `adminPage` fixture, navigates to `/admin/dashboard`, and asserts page load success.

### Test Block 2: Provider CRUD & Audit Log (in `e2e/providers.spec.ts`)
*   Create a test: `Admin can create a new provider and log action`.
    1.  Uses `adminPage`.
    2.  Fills out `name`, `balanceCurrency` (select `RUB`), `apiUrl` (`http://localhost:3001/api/dev/mock-provider`), `apiKey` (`test_token`).
    3.  Clicks `Создать подключение`.
    4.  Asserts provider presence in list and in PostgreSQL.
    5.  Asserts `PROVIDER_CREATE` entry in `AdminAuditLog` with target = new provider's ID.
*   Create a test: `Admin can edit an existing provider and log action`.
    1.  Identifies provider, clicks `Настроить`.
    2.  Modifies `name` to `Updated Provider Name`.
    3.  Clicks `Сохранить`.
    4.  Asserts database update.
    5.  Asserts `PROVIDER_UPDATE` entry in `AdminAuditLog` with old and new values.

### Test Block 3: Markup Recalculation & Audit Log (in `e2e/admin-panel.spec.ts` or `e2e/catalog.spec.ts`)
*   Create a test: `Admin can change service markup and verify pricing`.
    1.  Seeds a test service.
    2.  Navigates to `/admin/catalog`.
    3.  Adjusts markup, saves.
    4.  Asserts price calculation in DB matches `rate * markup * exchangeRate`.
    5.  Asserts `SERVICE_MARKUP_CHANGE` entry in `AdminAuditLog`.

### Test Block 4: Quarantine Approvals & Elastic Cooldowns (in `e2e/admin-panel.spec.ts`)
*   Create a test: `Admin can approve price spike quarantine`.
    1.  Seeds a quarantined service (`isQuarantined: true`, `pendingRate: 1.5`, `rate: 1.0`).
    2.  Navigates to `/admin/catalog/quarantine`.
    3.  Clicks "✅ Принять" (Approve) button for this service.
    4.  Asserts `isQuarantined: false`, `rate: 1.5` in PostgreSQL.
*   Create a test: `Client cannot order a service in elastic cooldown`.
    1.  Seeds a service with `cooldownUntil` in the future.
    2.  Navigates to `/dashboard/new-order` as a user.
    3.  Asserts service card is disabled/quarantined and cannot be selected/ordered.
