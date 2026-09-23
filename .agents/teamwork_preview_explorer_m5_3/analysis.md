# Smmplan E2E Admin Panel & Catalog Quarantine Analysis

This document details the read-only investigation and mapping of Smmplan's admin panel structure, testing infrastructure, database models, and quarantine/cooldown logic to lay out a comprehensive E2E test strategy.

---

## 1. Testing Infrastructure Overview

Smmplan's E2E tests are built using **Playwright**. The core infrastructure components are:

*   **Configuration (`playwright.config.ts`)**:
    *   Test directory: `./e2e`
    *   Dependencies: Uses a global `e2e/auth.setup.ts` setup project which runs prior to the main tests to authenticate the admin user.
    *   Storage state: The default authenticated session is saved to `e2e/playwright/.auth/user.json`.
*   **Authentication Setup (`e2e/auth.setup.ts`)**:
    *   Authenticates a user named `e2e-tester@test.com` by generating a JWT session cookie (`session_token`) and adding it directly to the browser context, bypassing standard UI login steps for speed.
    *   The `e2e-tester@test.com` user is created in PostgreSQL (or updated) with the role `OWNER` (granting full administrative privileges).
*   **Test Fixtures (`e2e/fixtures/auth.fixture.ts`)**:
    *   Provides two custom Playwright page fixtures: `userPage` and `adminPage`.
    *   `userPage` dynamically generates a temporary user with the `USER` role and a pre-loaded balance of 10,000 cents (100 RUB), adds their session cookie, passes the page, and cleans up the user from the database in a `finally` block.
    *   `adminPage` dynamically generates a temporary owner user with the `OWNER` role, adds their session cookie, and cleans them up in a `finally` block.
*   **Global Cleanup (`e2e/utils/db-cleaner.ts`)**:
    *   A helper script that runs after or before testing blocks to ensure orphan users, services, providers, or tickets do not contaminate subsequent test runs.

---

## 2. Database Models for Audit & Ledgers

In `prisma/schema.prisma`, audit logs and user finance ledgers are mapped as follows:

### A. `AdminAuditLog` (Line 610)
*   **Fields**:
    *   `id` (`String` @id @default(cuid()))
    *   `adminId` (`String`): Foreign key referencing the `User` who performed the action.
    *   `adminEmail` (`String`): Cached email for fast lookups.
    *   `action` (`String`): The action type (e.g., `PROVIDER_CREATE`, `PROVIDER_UPDATE`, `SERVICE_MARKUP_CHANGE`, `SERVICES_IMPORT`, `USER_BALANCE_CHANGE`, `PROVIDER_CATALOG_SYNC`).
    *   `target` (`String`): Affected entity ID (e.g., a user's ID, provider's ID, or service's ID).
    *   `targetType` (`String`): The entity category (e.g., `USER`, `PROVIDER`, `SERVICE`).
    *   `oldValue` (`Json?`): State of the entity fields prior to modification.
    *   `newValue` (`Json?`): State of the entity fields post-modification.
    *   `createdAt` (`DateTime` @default(now()))
*   **Audit Logger Helper**: Defined as `auditAdmin` in `src/lib/admin-audit.ts` (often runs asynchronously/fire-and-forget).

### B. `LedgerEntry` (Line 627)
*   **Fields**:
    *   `id` (`String` @id @default(cuid()))
    *   `userId` (`String`): The user whose balance was modified.
    *   `adminId` (`String?`): The admin who authorized the manual adjustment.
    *   `amount` (`Decimal`): The transaction amount (stored in cents, positive for credits, negative for debits).
    *   `reason` (`String`): Explanatory reason (e.g., `E2E Deep Check Refund`).
    *   `status` (`LedgerStatus` @default(APPROVED)): The status of the ledger record.
    *   `createdAt` (`DateTime` @default(now()))

---

## 3. Quarantine & Cooldown Engine Logic

Smmplan protects its profit margin and order fulfillment against API failures, order cancel spikes, and sudden provider price spikes via the **Quarantine & Cooldown Engine**. This logic is spread across `src/services/providers/quarantine.service.ts` and `src/services/admin/catalog.service.ts`:

### A. Elastic Cooldowns (Automatic & Time-Limited)
These are automatically triggered and do not require manual admin clearance. They apply `cooldownUntil` (a timestamp in the future) and a `cooldownReason` to affected services:
*   **Trigger A: API Failure Cooldown**:
    *   *Threshold*: A service encounters $\ge 5$ API order errors in a 1-hour window (tracked in Redis).
    *   *Effect*: Cooldown duration is set to **2 hours** (`cooldownUntil` = now + 2h).
    *   *Reason*: `HIGH_API_FAILURES`.
*   **Trigger B: Delayed Cancellation Cooldown**:
    *   *Threshold*: Triggers on a strike-based system based on order cancel rates in the last 12 hours ($\ge 5$ canceled orders across $\ge 3$ unique users, and a cancel rate $> 30\%$).
    *   *Strikes*:
        *   Strike 1: **30-minute cooldown** (`DELAYED_CANCEL_STRIKE_1`).
        *   Strike 2: **2-hour cooldown** (`DELAYED_CANCEL_STRIKE_2`).
        *   Strike 3: **12-hour cooldown** (`DELAYED_CANCEL_STRIKE_3`).
*   **Trigger C: Stuck Orders (Ghosting)**:
    *   *Threshold*: Checks for orders stuck in progress for a prolonged period.
    *   *Effect*: Triggers a yellow alert to admins but does not auto-quarantine.

*Note: The elastic cooldowns are restored automatically once `cooldownUntil` is in the past via a cron task calling `QuarantineService.restoreExpiredQuarantines()`.*

### B. Price Spike Isolation & Margin Floor Breaches (Persistent Quarantine)
These require manual admin intervention via `/admin/catalog/quarantine` (Price Spikes tab). The service gets flagged with `isQuarantined = true` and `pendingRate` (the newly detected rate):
*   **Trigger D: Price Spike**:
    *   *Threshold*: During catalog sync (`syncProviderCatalog`), if the provider rate increases by $> 20\%$ (configured via `Settings.quarantineThreshold` or default `0.20`), the rate difference is caught.
    *   *Effect*: `isQuarantined = true`, `pendingRate = newRate`, `quarantineReason` is updated with price spike text, and the service keeps its old retail price, preventing loss.
*   **Trigger E: Margin Floor Breach**:
    *   *Threshold*: If the rate increases to a point where the retail price margin falls below the safety floor (`SAFETY_FLOOR_MARKUP` = 1.05x multiplier or 5% markup).
    *   *Effect*: `isQuarantined = true`, `pendingRate = newRate`, and `quarantineReason` is set to `Margin Floor Breach: ...`.

### Order Placement Guard
*   When a service has `isQuarantined: true`, the Server Action for order placement (`src/actions/order/mass.ts`) rejects the order with an error.
*   When a service has `cooldownUntil > new Date()`, the frontend order grid (`ServiceGrid.tsx` / `TariffCard.tsx`) disables the card and prevents selection.

---

## 4. Admin Panel UI & Action Maps

The pages under `/admin` are organized as follows:

1.  **Dashboard (`/admin/dashboard`)**:
    *   Renders system KPIs, queue sizes, and summary charts.
2.  **Clients (`/admin/clients`)**:
    *   Displays a table of registered users.
    *   Clicking a user triggers a slide-out panel (Sheet) with a form titled "Корректировка баланса" (`input[name="amount"]`, `input[name="reason"]`, and `button:has-text("Применить")`). Clicking this button fires a browser `dialog` confirmation pop-up.
3.  **Tickets (`/admin/tickets`)**:
    *   Two-pane layout. Left pane lists tickets (e.g. text search or subject name like "E2E Admin Ticket Test"). Right pane renders the active ticket's chat room (`textarea` and "Отправить" button).
4.  **Finance (`/admin/finance`)**:
    *   Billing statistics and cash flows.
5.  **Providers (`/admin/providers`)**:
    *   Lists API connections. Clicking **"+ Подключить Панель"** loads `/admin/providers/new`.
    *   Clicking **"Настроить"** loads `/admin/providers/[id]`, which hosts the `ProviderForm` allowing testing, updating, or syncing the provider catalog.
    *   Clicking **"⏬ Импорт Услуг"** loads the Cherry-Pick Import Wizard (`/admin/providers/import`).
6.  **Import Wizard (`/admin/providers/import`)**:
    *   If the shadow catalog (Redis key `provider:{id}:catalog`) is empty, shows "Каталог провайдера пуст" and a "Загрузить каталог" button.
    *   Once synced, renders the table of external services. Contains checkboxes for selection, a "Наценка (%)" input (default 50), and an "Импортировать выбранные" button. This launches a `ConfirmationModal` with a "✅ Подтвердить импорт" button.
7.  **Quarantine Center (`/admin/catalog/quarantine`)**:
    *   Renders three sub-tabs:
        *   **Ценовые скачки** (Price Spikes): Renders table of quarantined services. Actions: "✅ Принять" (accepts new rate, logs `SERVICE_QUARANTINE_APPROVE`), "✕ Отклонить" (keeps old rate, removes from quarantine, logs `SERVICE_QUARANTINE_REJECT`), and a "✅ Принять все" button.
        *   **Зомби-услуги** (Zombies): Lists services deleted by the provider. Actions: "📦 Скрыть навсегда" (soft-deletes the service).
        *   **Сбои API** (API Failures): Lists services in API cooldown. Actions: "🔓 Снять блок" (clears the cooldown manually).
8.  **Settings (`/admin/settings?tab=system`)**:
    *   Global options like the USD/RUB exchange rate (`input[name="exchangeRateUSD"]`) and save button ("Сохранить основные настройки").

---

## 5. E2E Test Coverage Gap Analysis

Below is the gap analysis comparing currently implemented tests to the requested E2E features:

| Target E2E Feature | Currently Covered In | Coverage Gap / Missing Test Scenario |
|:---|:---|:---|
| **Admin Login & RBAC Redirect** | Partially in `routing-protected.spec.ts` | Test check that a non-admin (role `USER`) trying to load `/admin/dashboard` is redirected to `/dashboard/new-order`, and an admin (role `OWNER`) loads it successfully. |
| **Provider Creation** | Validation only in `providers.spec.ts` | An E2E flow that successfully fills out and saves the `ProviderForm` for a new provider, verifies its existence in PostgreSQL, and ensures `PROVIDER_CREATE` is logged in `AdminAuditLog`. |
| **Provider Editing** | None | Click "Настроить" on an existing provider, modify fields (e.g. change currency or URL), save, verify the change in PostgreSQL, and check for `PROVIDER_UPDATE` in `AdminAuditLog`. |
| **Service Importing** | Fully in `providers.spec.ts` | *Covered.* (Simulates importing a service from a mocked provider catalog using the cherry-pick wizard and verifies PostgreSQL fields and categories). |
| **Markup & Exchange Rate Pricing** | Exchange rate form save in `admin-panel.spec.ts` | Asserting the price calculation when changing markup: modify a service's markup, verify that `pricePer1000Cents` is recalculated in PostgreSQL (formula: `rate * markup * exchangeRate`) and check for `SERVICE_MARKUP_CHANGE` in `AdminAuditLog`. |
| **Quarantine & Price Spike** | Rejecting a price spike in `admin-panel.spec.ts` | 1) An E2E test verifying that a price spike quarantine is triggered during catalog sync when a mock provider raises rates $>20\%$, and checking that order placement for that service is blocked. <br> 2) Approving a price spike quarantine from `/admin/catalog/quarantine`, checking that the service is unquarantined, and verifying the new rate is applied in PostgreSQL. |
| **Elastic Cooldown** | None | Simulating a service in elastic cooldown (`cooldownUntil` in the future), and verifying that it is disabled on the client order page (`/dashboard/new-order` or landing page). |
| **Log Verification (`AdminAuditLog`)** | Partially in `admin-panel.spec.ts` | Verify that audit log assertions are made during the new provider creation and markup modification E2E flows. |
