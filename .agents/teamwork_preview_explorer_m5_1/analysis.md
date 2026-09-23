# Audit of Smmplan E2E Testing & Admin Infrastructure

This document outlines the detailed audit of Smmplan's current E2E testing infrastructure, focusing on the admin panel, providers configuration, catalog synchronization, quarantine mechanisms, and security/financial logs.

---

## 1. Currently Implemented E2E Tests

The repository contains three primary test files relevant to the admin panel and provider integrations:

### A. `e2e/admin-panel.spec.ts`
- **Authentication**: Reuses the pre-seeded admin storage state from `playwright/.auth/user.json` generated in `auth.setup.ts`. It does not test the UI login page.
- **Scenarios Tested**:
  1. **View Dashboard and Clients list**: Verifies the admin dashboard navigates to `/admin/clients` and renders the client table successfully.
  2. **View and Reply to Tickets**: Seeds a user and an open ticket in the DB, navigates to `/admin/tickets`, opens the chat panel, submits a reply, and asserts that the reply is displayed in the UI.
  3. **Manage Quarantined Services (Rejection Flow)**: Seeds a category, provider, and quarantined service (`isQuarantined: true`, `pendingRate: 20.0`) in the DB. Navigates to `/admin/catalog/quarantine`, verifies the service is listed, clicks the `Отклонить` (Reject) button, verifies the success toast, and asserts the service disappears from the quarantine list.
  4. **View Financial Transactions**: Navigates to `/admin/finance` and verifies the table is visible.
  5. **Manually Adjust User Balance**: Creates a test user in DB with a balance of `0`. Navigates to `/admin/clients?userId={id}`. In the slide-out sheet, fills the adjustment form (`amount: 15000` for 150 RUB, `reason: "E2E Deep Check Refund"`). Intercepts the browser confirm dialog (`dialog.accept()`) and clicks `Применить` (Apply). Asserts:
     - The user's balance in the PostgreSQL DB is updated to `15000` cents.
     - A `LedgerEntry` record is created in the DB with the corresponding amount, reason, and admin ID association.
     - An `AdminAuditLog` record is created in the DB with action `USER_BALANCE_CHANGE`, tracking `oldValue` (`balance: 0`) and `newValue` (`balance: 15000`, `delta: 15000`, `reason: "E2E Deep Check Refund"`).
  6. **Update Global Exchange Rate**: Navigates to `/admin/settings?tab=system`, fills `exchangeRateUSD` with `98.76`, clicks `Сохранить основные настройки`, and verifies the success toast.

### B. `e2e/providers.spec.ts`
- **Authentication**: Reuses the pre-seeded admin storage state.
- **Scenarios Tested**:
  1. **Navigate to Providers**: Checks that `/admin/providers` lists key buttons (`+ Подключить Панель`, `Импорт Услуг`).
  2. **Form Field Validations**: Navigates to `/admin/providers/new`, clicks "Создать провайдера" with empty fields, and checks for validation errors (e.g., `API Ключ обязателен`).
  3. **Connection Test Failure**: Seeds a provider with a fake URL (`http://localhost:9999/api/v2`), navigates to its edit page, clicks "Протестировать API соединение", and asserts that a network/connection error message is displayed.
  4. **Import Wizard Selection**: Navigates to `/admin/providers/import` and verifies that the seeded provider appears in the selection dropdown.
  5. **Cherry-Pick Import (Success Flow)**: 
    - Seeds a network, category, and provider targeting `/api/dev/mock-provider` in the DB. Clears any cached catalog in Redis (`provider:{id}:catalog`).
    - Navigates to `/admin/providers/import`. Under the empty state "Каталог провайдера пуст", clicks "Загрузить каталог".
    - Verifies the mock services table appears. Selects "Mock Telegram Followers" (external ID `100`), inputs markup of `75%`, clicks "Импортировать выбранные", and confirms import.
    - Asserts that a new service is created in PostgreSQL with `externalId: '100'`, `markup: 1.75`, and linked to the correct category.

### C. `e2e/loss-prevention.spec.ts`
- **Scenarios Tested**:
  1. **Disable Service on Negative Margin**: Seeds a service with `markup: 0.9` (breaching the safety floor, where retail price < cost price). Triggers a mock exchange rate repricing sync by making an API request to `/api/debug?syncPrices=150.0`. Asserts:
     - The service's `isActive` flag in DB is updated to `false`.
     - A `routingAuditLog` is created with action `LOSS_PREVENTION_BLOCK`.

---

## 2. Identified Testing Gaps

Despite having foundational tests, several critical flows requested in the R4 E2E testing scope are missing:

| Domain | Feature / Gap | Explanation |
|---|---|---|
| **Authentication** | **Admin Login Page & Redirects** | There are no tests verifying that typing admin credentials on `/login` correctly logs in staff and redirects them to `/admin/dashboard` instead of `/dashboard`. Authentication failures (invalid credentials, blocked staff roles) are also untested at the UI level. |
| **Provider Administration** | **Successful Provider Creation** | The tests only cover form validations. Submitting a valid form to successfully create a provider and verifying its existence in the list is missing. |
| **Provider Administration** | **Editing Provider Configuration** | Verifying that updating provider fields (API key, API URL, active/inactive state) via the UI works and persists is missing. |
| **Catalog Import** | **Markup Validation Rules** | The E2E tests do not cover boundary cases for markup fields (e.g., negative markup values, values below the safety floor, or blank values). |
| **Quarantine & Sync** | **Price Spike Isolation** | E2E tests do not verify that a catalog synchronization automatically quarantines a service if the rate increases by > 10% (during `adminSyncProviderCatalog`) or > 20% (during background/manual sync). Currently, they only seed `isQuarantined: true` manually. |
| **Quarantine & Sync** | **Price Spike Approval** | Verifying that clicking "Принять" in the quarantine UI successfully applies the `pendingRate` as the active `rate` and recalculates retail prices in PostgreSQL is missing. |
| **Quarantine & Sync** | **Zombie Services Identification** | No tests verify that running a sync when a service is removed from the provider's API automatically marks the service as deactivated and assigns the `cooldownReason = 'ZOMBIE_AUTO_DISABLED'`. |
| **Quarantine & Sync** | **Zombie Archiving** | No tests verify that clicking "Скрыть навсегда" on a zombie service archives it in the DB (renames it with `[ARCHIVED]` prefix and logs the audit). |
| **Quarantine & Sync** | **API Errors (Elastic Cooldown)** | No tests verify that services with active API error backoffs (Trigger A/B cooldowns) appear under "Сбои API" or that clicking "Снять блок" restores them by resetting `cooldownUntil` and `cooldownReason` to null. |
| **Audit Logs** | **Admin Audit Logging Verification** | Except for the balance adjustment test, there is no verification that actions like creating a provider, editing a provider, approving/rejecting price spike quarantine, or archiving zombie services write appropriate `AdminAuditLog` records in PostgreSQL. |

---

## 3. Technical Mapping of the Admin Framework

### Database Models (`prisma/schema.prisma`)
1. **`AdminAuditLog`**: Tracks actions performed by admins (IP address, admin email, action type, target ID, target type, `oldValue` and `newValue` as JSON strings).
2. **`LedgerEntry`**: Logs financial balance modifications for users, associated with the admin ID and mandatory reason text.
3. **`Service`**:
   - `rate`: The current rate per 1000 from the provider.
   - `markup`: Retail markup multiplier (e.g., `1.75` for 75%).
   - `isQuarantined`: Boolean flag indicating price spike quarantine.
   - `pendingRate`: Proposed rate awaiting approval.
   - `quarantineReason`: Reason for quarantine.
   - `cooldownUntil`: Expiration timestamp for API error cooldowns or zombie deactivation.
   - `cooldownReason`: "ZOMBIE_AUTO_DISABLED", "HIGH_API_FAILURES", or cancel strikes.
4. **`Provider`**:
   - `syncLock`: Stops sync if set to `true`.
   - `errorCount5m` & `lastErrorAt`: Tracks SLA issues.

### Sync Logic & Quarantine Actions (`sync-action.ts` & `catalog.service.ts`)
- **Manual sync** is triggered via `syncProviderCatalogAction` (delegates to `adminCatalogService.syncProviderCatalog`).
- **Quarantine approval/rejection/lifting** are handled in `sync-action.ts`:
  - `approveQuarantinedService(serviceId)`
  - `rejectQuarantinedService(serviceId)`
  - `archiveZombieService(serviceId)`
  - `liftApiBlock(serviceId)`
- **All** actions execute inside DB transactions and invoke `auditAdmin` to populate the `AdminAuditLog` table.

### Mock Provider Endpoint (`src/app/api/dev/mock-provider/route.ts`)
- The mock provider accepts form parameters like `action=services` and `action=balance`.
- Currently returns a hardcoded service (`Mock Telegram Followers`, rate: `10.00`).
- **Limitation**: E2E tests cannot mock Next.js server-to-external-API requests using Playwright's `page.route()`. Therefore, we must implement a mechanism in the mock provider to allow dynamic overrides so that E2E tests can simulate price spikes and zombie deactivations.
