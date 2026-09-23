# Implementation Plan: Playwright E2E User Flow Tests

This document outlines the step-by-step implementation plan for creating and executing the E2E user flow tests in Playwright to fulfill Milestone 4 (R3).

## 1. Plan Definition
- **Mission**: Implement and run Playwright end-to-end user flow tests in `e2e/user-flow.spec.ts` covering Magic Link request/callback, unit pricing display, link validation, and checkout.
- **Success Criteria**: All tests pass, zero TypeScript compilation errors, zero ESLint violations, and database is cleaned up properly.

---

## 2. Double-Pass Audit (5 Vectors of Reliability)

1. **Architectural Gap**:
   - For Magic Link testing, bypassing the authenticated global state is done using `test.use({ storageState: { cookies: [], origins: [] } })`.
   - The test must handle session generation and cookie setting. The database manipulation (creating `AuthToken`, querying DB) will be executed using a fresh `PrismaClient` instance directly from the test spec.

2. **Chaos and Emptiness**:
   - The test database must contain appropriate seeded categories, services, networks, and users.
   - We will dynamically create the required network ("Telegram", etc.), categories, and services, check if they exist first, and delete them in `afterAll` to prevent database accumulation or conflict.
   - We will handle cases where the user does not exist or has specific balances by using `upsert` or direct creation.

3. **Visual & UX Density**:
   - Pricing verification ensures no `/ 1000 шт` text is in the UI. We will locate text elements containing price per unit and verify their suffix (`₽ / шт`).
   - Form inputs and submit button status (disabled vs enabled) will be tracked to ensure the user does not encounter visual confusion.

4. **WCAG 2.2 AA**:
   - Playwright will target fields by their roles and standard labels (e.g. `getByRole`, `locator('input#login-email-magic')`).
   - Ensures touch targets (buttons) are interactable and accessible.

5. **Security & Trust**:
   - Magic link hashes are checked using SHA-256 (`crypto.createHash('sha256')`).
   - Checkout tests verify that balance is deducted correctly (positive case) or payments redirect (insufficient balance).

---

## 3. Pre-Mortem Analysis (Failure Simulation)

| Risk Scenario | Root Cause | Prevention/Resolution Mechanism |
|---|---|---|
| **Test cleanup leaves orphaned records** | Test suite fails/errors out before `afterAll` or cleanup blocks run, or database locks prevent deletions. | Wrap the cleanup in a robust `try-catch-finally` block within `afterAll` and `afterEach` to ensure cleanup runs even on partial test failures. Use unique test-prefix identifiers (`E2E-Magic-`, etc.) to selectively target and delete records. |
| **Flaky SmartOrderForm auto-selection** | Category tab clicks or URL parsing takes time, causing Playwright to check service before auto-selection updates. | Use `expect(...).toHaveAttribute('aria-selected', 'true', { timeout: 15000 })` and wait for the "Считаем..." text to be hidden before clicking submit. |
| **Magic Link redirect URL mismatch** | `BASE_URL` in `verify` route redirects to production host rather than local test URL. | Ensure the Playwright browser is navigated with absolute paths or baseURL matches the test server (`http://localhost:3000`). Verify route retrieves `BASE_URL` dynamically or matches next redirect environment. |

---

## 4. Test Scenarios Design

### Test Case 1: Magic Link Request & Verify Callback
1. Set guest state: `test.use({ storageState: { cookies: [], origins: [] } })`.
2. Navigate to `/login`. Click "Войти по ссылке".
3. Input email `e2e-magic-tester@test.com` in `input#login-email-magic`.
4. Click "Получить ссылку" (button `type="submit"`).
5. Verify success text "Проверьте почту" is shown in the UI.
6. Verify an `AuthToken` record is created in the database for `e2e-magic-tester@test.com`.
7. Generate a raw token (randomUUID). Hash it using SHA-256.
8. In the database, create/upsert user `e2e-magic-tester@test.com` and insert an `AuthToken` record with the hashed token, referencing this user.
9. Navigate directly to `/api/auth/verify?token=<rawToken>`.
10. Verify that the browser is authenticated and redirected to `/dashboard` (URL contains `/dashboard`).

### Test Case 2: Unit Pricing Display (₽ / шт)
1. Authenticate the user (we can do this by using a custom setup or writing session cookies).
2. Create a test service in the database:
   - Rate: `rate: 0.1` (which is $0.1 per 1000 units).
   - Markup: `markup: 2.5` (so price per 1000 is 0.1 * 2.5 * exchangeRate).
   - Let's make sure it computes to a known price per unit (e.g. `0.25 ₽ / шт` or similar). Let's use rate/markup/exchangeRate so `pricePerUnitRub` is calculated as `(rate * markup * exchangeRateUSD) / 1000`.
   - Wait, let's verify if `pricePer1000Cents` is written or computed. Prisma schema has `pricePer1000Cents Int @default(0)`. Wait, we will create a test service with `rate`, `markup`, and specific category.
3. Revalidate the catalog: request `/api/debug?revalidate=catalog`.
4. Navigate to `/dashboard/new-order` (or catalog / smart order form).
5. Verify that the price displayed in the catalog/form for the service is in format `0.25 ₽ / шт` (or similar unit price format depending on `pricePerUnit` calculation).
6. Verify that there is NO `/ 1000 шт` text displayed in the catalog or checkout details.

### Test Case 3: Link Category targetType Validation
1. Use the authenticated session.
2. In the DB, ensure we have a category named "E2E Telegram Subscribers" with `targetType: 'CHANNEL'` (via keywords in `src/utils/target-type.ts` or explicitly configured) and "E2E Telegram Likes" with `targetType: 'POST'`.
3. Create two corresponding services: "E2E Subscribers Service" and "E2E Likes Service".
4. Navigate to `/dashboard/new-order`.
5. Enter a channel link (e.g., `https://t.me/durov`) for the Likes service (which expects a post link). Verify that the form validation triggers an error.
6. Enter a post link (e.g., `https://t.me/durov/123`) for the Subscribers service (which expects a channel link). Verify that the form validation triggers an error.
7. Enter a valid link (e.g., channel link for Subscribers service) and verify that validation passes, and the submit button is enabled.

### Test Case 4: Checkout, Balance Deduction, & Order Creation
1. **Case A (Sufficient Balance)**:
   - Set user balance to `100000_00` (100,000 cents = 1,000 RUB).
   - Submit the order using the smart order form.
   - Verify that the order is created in the database.
   - Verify that the user's balance is deducted by the exact order cost.
   - Verify that the page redirects to the orders history `/dashboard/orders`.
2. **Case B (Insufficient Balance)**:
   - Set user balance to `0` in the DB.
   - Submit the order.
   - Verify that the checkout prompts the user to refill their balance or redirects to the payment page.

---

## 5. Execution & Verification Details
- File to modify/create: `e2e/user-flow.spec.ts`.
- Database cleanup: In `afterAll`, delete all records with `e2e-magic` or `e2e-pricing` tags to maintain database hygiene.
- Run tests: `npx playwright test e2e/user-flow.spec.ts`.
- Run typecheck: `npx tsc --noEmit`.
- Run lint: `npm run lint`.
