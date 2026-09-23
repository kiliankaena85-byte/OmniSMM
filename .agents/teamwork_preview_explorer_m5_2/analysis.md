# R4 Playwright E2E Admin Panel Tests — Analysis Report

## 1. Context & Scope
This report provides an in-depth analysis of the current testing infrastructure and admin panel code of the Smmplan platform. The purpose is to design a robust Playwright E2E testing strategy for **Milestone 5 (R4: Playwright E2E Admin Panel Tests)**. 

The scope of R4 covers:
- Admin login and role-based access control (RBAC).
- Provider connection, creation, editing, and database encryption.
- Curated service importing from the Redis shadow catalog.
- Markup adjustments (individual and bulk) with automatic pricing and Beautiful Rounding calculations.
- Quarantine zone verification: price spike isolation, margin floor breach, elastic cooldowns (API errors), and zombie services.
- Detailed audit logging (`AdminAuditLog`) and ledger tracking (`LedgerEntry`).

---

## 2. Current Implementation vs. Missing Gaps

An audit of the existing E2E files under the `/e2e` directory was conducted. The findings are summarized below.

### 2.1. Existing E2E Tests
1. **`e2e/admin-panel.spec.ts`**:
   - **Covered**:
     - Viewing the admin dashboard and user list (`/admin/dashboard` & `/admin/clients`).
     - Viewing and replying to customer tickets (`/admin/tickets`).
     - Rejecting (Отклонить) a quarantined service and verifying it keeps the old rate and is removed from the quarantine view.
     - Viewing financial transactions (`/admin/finance`).
     - Manually adjusting a user's balance and verifying the resulting `User.balance` changes, `LedgerEntry` fields, and `AdminAuditLog` (`USER_BALANCE_CHANGE`) in the database.
     - Changing the global exchange rate (`/admin/settings?tab=system`).
2. **`e2e/providers.spec.ts`**:
   - **Covered**:
     - Navigating to the providers page and validating the connection form fields.
     - Connection testing with a fake localhost API URL.
     - Verification of the import wizard loader page.
     - Importing a single service ("Mock Telegram Followers") from the shadow catalog under a category, setting a custom markup, and confirming the Postgres record fields (`rate`, `markup`, `categoryId`).
3. **`e2e/loss-prevention.spec.ts`**:
   - **Covered**:
     - Disabling a service if the retail price falls below the purchase cost during exchange rate synchronization, and logging `LOSS_PREVENTION_BLOCK` to `RoutingAuditLog`.
4. **`e2e/routing-protected.spec.ts` & `e2e/fixtures/auth.fixture.ts`**:
   - **Covered**:
     - Verifying access to user routes (`/dashboard/*`) and admin routes (`/admin/*`) under different roles (`USER` vs `OWNER`) by generating fake session tokens and cookies.

---

### 2.2. Missing Test Gaps
The following critical administrative and safety flows are currently **untested** in the E2E suite:

| Area | What is Missing | Why it is Critical |
|---|---|---|
| **Admin Login** | E2E tests for the visual login form on the `/login` page specifically for administrators, checking direct redirect, and verifying that standard users are rejected and redirected. | Enforces security boundaries and verifies the actual login UI, rather than just using cookie fixtures in `auth.setup.ts`. |
| **Provider Lifecycle** | Creating a provider successfully using the UI form, editing its details, and verifying database state (e.g. key encryption) and `AdminAuditLog`. | Validates the full provider configuration wizard. |
| **Service Import Edge Cases** | Importing a service with **Auto-Pricing** (markup set to `0` or left empty to use the pricing ladder) and **Target Link Validation** mapping (`targetType` inference based on category). | Verifies that imported services align with the pricing model and receive correct link validators. |
| **Markup & Recalculation** | In-UI service-level markup change, bulk markup change by category or network, and verification of beautiful pricing recalculation and `AdminAuditLog`. | Ensures that retail prices are dynamically updated when margins or markups are configured. |
| **Quarantine: Approve** | Approving a quarantined price spike, checking that the `pendingRate` is promoted to `rate`, the retail price is recalculated with Beautiful Rounding, and `QUARANTINE_APPROVE` is logged. | The current test only covers "Rejecting" quarantined services. |
| **Quarantine: Trigger Spike** | Simulating a price spike (>10% or >20% increase) at the provider API and triggering a sync, verifying the service automatically quarantines (`isQuarantined: true`, `isActive: false`). | Tests the automated price monitoring engine in a realistic E2E scenario. |
| **Quarantine: Cooldown** | Placing a service under Elastic Cooldown, checking the "Сбои API" quarantine tab, clicking "Снять блок", and asserting database status and audit logging. | Verifies the recovery mechanics for services blocked due to provider API errors. |
| **Quarantine: Zombie / Margin** | Triggering and handling zombie services (deleted from API) and margin floor breaches (retail price < cost). | Validates automated cleanups and bankruptcy protection triggers. |

---

## 3. Database Schema & Business Logic Audit

### 3.1. AdminAuditLog and Ledger Models
From `prisma/schema.prisma`:
- **`AdminAuditLog`**:
  - `adminId` & `adminEmail`: tracks who performed the action.
  - `action`: expected enums include `USER_BALANCE_CHANGE`, `PROVIDER_CREATE`, `PROVIDER_UPDATE`, `SERVICES_IMPORT`, `SERVICE_MARKUP_CHANGE`, `BULK_MARKUP_UPDATE`, `QUARANTINE_APPROVE`, `QUARANTINE_REJECT`, `QUARANTINE_APPROVE_ALL`, `SERVICE_LIFT_API_BLOCK`, `SERVICE_ARCHIVE_ZOMBIE`.
  - `target` & `targetType`: IDs and entity types (e.g., `USER`, `SERVICE`, `PROVIDER`).
  - `oldValue` & `newValue`: JSON strings documenting state changes.
- **`LedgerEntry`**:
  - Used specifically for balance adjustments: captures `userId`, `adminId`, `amount` (cents), `reason`, `status`, and `transactionType` (e.g. `PAYMENT`, `COMPENSATION`).

### 3.2. Service Quarantine Fields
- `isQuarantined`: Boolean flag indicating if the service is currently locked from purchases.
- `pendingRate`: Stores the new provider rate during a spike, waiting for admin approval.
- `quarantineReason`: Logs the trigger reason (e.g., `Price Spike: +45%` or `Margin Floor Breach`).
- `cooldownUntil` & `cooldownReason`: Used by the Elastic Quarantine (Self-Healing) system to isolate provider API errors. If `cooldownUntil > now()`, the service is hidden or disabled.

### 3.3. Sync Logic (from `sync-action.ts` & `catalog.service.ts`)
- **Margin Floor Breach**: If a rate change causes the profit margin multiplier to fall below `SAFETY_FLOOR_MARKUP` (1.0), the service is quarantined.
- **Price Spike (>10% or >20%)**: If a price increase exceeds the threshold, the service is quarantined.
- **Price Absorption (<=10%)**: Minor price increases are absorbed by decreasing the service's `markup` to maintain the user's retail price.
- **Loss Prevention**: If the unit retail price is lower than the purchase cost, the service is immediately disabled (`isActive = false`) and logged under `LOSS_PREVENTION_BLOCK`.

---

## 4. Recommended E2E Test Scenarios

### Scenario 1: Admin Authentication & RBAC Guard
- Navigate to `/login`, fill admin email/password, and submit.
- Assert redirect to `/admin/dashboard`.
- Logout and log in as standard user. Attempt to access `/admin/dashboard` directly.
- Assert redirect to `/dashboard` (RBAC access block).

### Scenario 2: Provider Creation & Key Vault Validation
- Navigate to `/admin/providers/new`.
- Create a new provider using valid data (point URL to `/api/dev/mock-provider`).
- Verify the provider is created and appears in the list.
- Assert in the database that:
  1. The provider record exists.
  2. The `apiKey` field in the database is encrypted (not equal to plain text key).
  3. An `AdminAuditLog` with action `PROVIDER_CREATE` is recorded with correct metadata.
- Go to edit page, change the name, and save.
- Assert database update and `PROVIDER_UPDATE` audit log.

### Scenario 3: Cherry-Pick Import with Auto-Pricing & Target Link Type
- Clear Redis cache (`provider:<id>:catalog`) and verify the shadow catalog UI is empty.
- Click "Загрузить каталог" to load mock services.
- Select "Mock Telegram Followers" (from the `/api/dev/mock-provider` catalog).
- Set markup to `0` (enabling Auto-Pricing ladder).
- Click import and confirm.
- Verify that:
  1. The service is created in the database.
  2. The `markup` is calculated and saved (using the pricing ladder logic).
  3. `pricePer1000Cents` matches the beautiful rounding value.
  4. The `targetType` is inferred correctly as `CHANNEL` (since category is "Telegram Followers").
  5. An `AdminAuditLog` with action `SERVICES_IMPORT` is registered.

### Scenario 4: Markup Individual & Bulk Modification
- Navigate to `/admin/catalog`.
- Click on an imported service and change its markup.
- Verify that the retail price is recalculated based on the exchange rate and beautiful rounding.
- Assert the database fields and `SERVICE_MARKUP_CHANGE` audit log.
- Navigate to bulk markup update, set new markup for Telegram platform.
- Assert that all matched services in the database have their prices updated, and a `BULK_MARKUP_UPDATE` audit log is recorded.

### Scenario 5: Price Spike & Margin Breach Quarantine Triggers
- Seed an active service in the DB: rate = `1.0`, markup = `3.0`, provider rate = `1.0`.
- **Price Spike test**:
  - Dynamically lower the DB rate to `0.5` without changing provider rate.
  - Trigger provider sync (which fetches `1.0`, representing a 100% price spike).
  - Verify that the sync script puts the service in quarantine (`isQuarantined: true`, `isActive: false`, `pendingRate: 1.0`).
  - Open `/admin/catalog/quarantine` and assert the service is shown with reason "Ценовой скачок".
- **Margin Floor Breach test**:
  - Seed a service with rate = `9.0` and markup = `1.05`.
  - Trigger sync (provider rate = `10.0`). The markup falls below `SAFETY_FLOOR_MARKUP` (1.0).
  - Verify that the service is quarantined with reason "Margin Floor Breach".

### Scenario 6: Quarantine Approvals & Cooldown Controls
- Navigate to `/admin/catalog/quarantine`.
- Under the "Ценовые скачки" tab, click "Принять" on a quarantined service.
- Assert that:
  1. `isQuarantined` becomes `false`.
  2. The service `rate` is updated to the `pendingRate`.
  3. `pricePer1000Cents` is updated.
  4. An `AdminAuditLog` with action `QUARANTINE_APPROVE` is logged.
- Simulate an API error cooldown by setting `cooldownUntil` in the database to a future time.
- Open `/admin/catalog/quarantine`, switch to "Сбои API" tab, and click "Снять блок".
- Assert database fields are nullified and `SERVICE_LIFT_API_BLOCK` is logged.
