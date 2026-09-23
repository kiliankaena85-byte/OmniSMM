# Handoff Report: R4 Playwright E2E Admin Panel Tests Strategy

This handoff report outlines the findings and recommends the test implementation strategy for **Milestone 5: R4 Playwright E2E Admin Panel Tests** on the Smmplan platform.

---

## 1. Observation

Direct code observations from the Smmplan codebase reveal the following:

### 1.1. Database Schema (`prisma/schema.prisma`)
- **`AdminAuditLog`** (line 610) tracks admin activities:
```prisma
model AdminAuditLog {
  id         String   @id @default(cuid())
  adminId    String // Who performed the action
  adminEmail String // Denormalized for fast log reading
  action     String // USER_BALANCE_CHANGE, SERVICE_DISABLE, SETTINGS_UPDATE, etc.
  target     String // ID of affected entity
  targetType String // USER, SERVICE, ORDER, SETTINGS, PROVIDER
  oldValue   String? // JSON string of previous state
  newValue   String? // JSON string of new state
  ipAddress  String? // Admin IP for security investigations
  createdAt  DateTime @default(now())
  ...
}
```
- **`LedgerEntry`** (line 627) monitors balance adjustment details:
```prisma
model LedgerEntry {
  id              String   @id @default(cuid())
  userId          String // Client whose balance was affected
  user            User     @relation("UserLedger", fields: [userId], references: [id], onDelete: Restrict)
  adminId         String? // Support agent who initiated, null if SYSTEM/auto
  amount          BigInt // Amount in Cents (positive = credit, negative = debit)
  reason          String // Mandatory justification text
  status          String   @default("APPROVED") // APPROVED, QUARANTINE, REJECTED
  transactionType String   @default("PAYMENT") // PAYMENT | REFUND | REROUTE | COMPENSATION
  ...
}
```
- **`Service`** (line 200) features quarantine flags:
```prisma
model Service {
  ...
  isQuarantined    Boolean   @default(false)
  pendingRate      Float? // Proposed new rate awaiting admin approval
  quarantineReason String? // Human-readable reason: "Price spike: +45%"
  quarantinedAt    DateTime? // When it was flagged
  cooldownUntil  DateTime? // If set, service is temporarily unavailable until this time
  cooldownReason String? // Reason for cooldown (e.g., "API_ERROR", "DELAYED_CANCEL")
  targetType        String  @default("POST") // POST, PROFILE, CHANNEL, COMMENT, POLL, etc.
  ...
}
```

### 1.2. Existing Playwright Tests
- **`e2e/admin-panel.spec.ts`**:
  - `Admin can view dashboard and user list` (lines 9-19)
  - `Admin can view and reply to tickets` (lines 21-68)
  - `Admin can manage quarantined services` (lines 70-125): Seeds a quarantined service, navigates to `/admin/catalog/quarantine`, and rejects it using the "Отклонить" button.
  - `Admin can view financial transactions` (lines 127-132)
  - `Admin can manually adjust user balance` (lines 134-218): Fills in values, triggers balance adjustment, and asserts database changes for `User.balance`, `LedgerEntry`, and `AdminAuditLog` (`USER_BALANCE_CHANGE`).
  - `Admin can update global exchange rate` (lines 220-235)
- **`e2e/providers.spec.ts`**:
  - `Admin can navigate to Providers list and see elements` (lines 11-20)
  - `Admin can open provider creation form and validate fields` (lines 22-39)
  - `Admin can test provider connection (fake URL)` (lines 41-68)
  - `Import Wizard loads successfully` (lines 70-94)
  - `Admin can import service via Cherry-Pick Wizard` (lines 96-209): Seeds mock provider pointing to `/api/dev/mock-provider`, clears redis catalog cache, loads shadow catalog, checks checkbox, inputs 75% markup, and triggers import.
- **`e2e/loss-prevention.spec.ts`**:
  - `should disable service on negative margin and log routingAuditLog` (lines 11-78)
- **`e2e/routing-protected.spec.ts`**:
  - Tests user/admin route access (200 OK) using sessions dynamically generated in `e2e/fixtures/auth.fixture.ts` (lines 1-111).

### 1.3. Mock APIs
- **`src/app/api/dev/mock-provider/route.ts`**:
  - Exposes SMM API actions: `balance`, `services` (returns service ID `"100"`, name `"Mock Telegram Followers"`, rate `"10.00"`), `add`, and `status`.

---

## 2. Logic Chain

1. **Access Boundaries**: Although route protection is covered via raw cookies in `routing-protected.spec.ts`, the visual credentials entry and page redirection are unchecked. An E2E test verifying form login for administrators ensures standard login redirects (to `/admin/dashboard` vs `/dashboard`) function as expected.
2. **Secrets Protection**: Providers require credentials (API Key) that must be encrypted using `VaultService.encrypt` when saved. The UI validation of this encryption is missing. An E2E test that submits the provider form and inspects the DB record ensures credentials are encrypted in postgres, and details are logged under the `PROVIDER_CREATE` audit action.
3. **Price & Markup Logic**: The Smmplan pricing model relies on Auto-Pricing (pricing ladder) and Beautiful Rounding. Currently, only manual markup import is checked. Adding a test that imports with a `0` markup (Auto-Pricing) and validates both the pricing ladder calculations and link target types (e.g. `CHANNEL` for subscribers) ensures the catalog importer works without pricing mismatches.
4. **Safety Net Controls**:
   - Price Spike Isolation, Margin Floor Breaches, and Elastic Cooldowns (API Errors) protect the business from losses, but are only partially tested via unit tests.
   - For E2E validation, the test can dynamically modify the database (e.g., lower a service's db rate before a sync) to trigger a price spike relative to the mock provider API.
   - Running the sync action must push the service into the quarantine state (`isQuarantined = true`).
   - The test must then use the UI to **Approve** the quarantine price spike (promoting `pendingRate` to `rate`, recalculating price, and writing a `QUARANTINE_APPROVE` audit log) and **Lift** API blocks from the "Сбои API" tab, ensuring the complete lifecycle is verified.
5. **Traceability**: Correct audit trails are critical. All actions must be verified by directly checking the `AdminAuditLog` table in PostgreSQL.

---

## 3. Caveats

- **Mock API Limitations**: The mock provider endpoint (`/api/dev/mock-provider`) is static. We cannot dynamically alter its return payload mid-test since Playwright runs E2E against a running server, and client-side `page.route` interception cannot capture server-to-server node calls. To simulate rate changes, the E2E test must alter the database record *before* initiating the sync.
- **Test Mode Check**: E2E tests executing against `/api/dev/mock-*` endpoints require `process.env.NEXT_PUBLIC_APP_ENV === 'test'` or `isTestMode === true` in settings to bypass production safety blocks.

---

## 4. Conclusion

A comprehensive suite of E2E admin tests should be implemented by creating a new spec file: `e2e/admin-advanced.spec.ts` (or appending to `e2e/admin-panel.spec.ts`). This suite will cover the gaps identified in admin login, provider lifecycle management, automated and manual markup adjustments, complete quarantine actions, and compliance logging.

---

## 5. Verification Method

To execute and verify these E2E tests:
1. Run the test database synchronization:
   ```powershell
   npm run test:db
   ```
2. Execute the Playwright E2E suite:
   ```powershell
   npx playwright test
   ```
3. To target the admin tests specifically:
   ```powershell
   npx playwright test e2e/admin-panel.spec.ts e2e/providers.spec.ts
   ```
4. Verify tests pass without errors and clean up seeded DB entries in the `afterAll` hook.
