# Handoff Report: Client Registration and Ordering Flow Investigation

This report summarizes the findings of Explorer 1 regarding the Client Registration, Login, and Ordering Flow of SMMplan in the local development/production environment. It outlines the codebase layout, routing, database state (identifying active Vexboost services), and provides a draft Playwright E2E test specification to verify these flows safely.

---

## 1. Observation

### Registration and Login Routes
*   **Registration Location**: There is no separate `/register` or `/signup` route. Both registration and login reside under the `/login` route.
*   **Form Structure**: The frontend interface at `/login` (implemented in `src/app/(auth)/login/page.tsx` and `src/app/(auth)/login/login-form.tsx`) features three tab controls:
    *   **"Войти по паролю"** (Password login, active by default):
        *   Email input locator: `#login-email`
        *   Password input locator: `#login-password`
        *   Submit button locator: `button[type="submit"]` (containing text "Войти в кабинет")
    *   **"Войти по ссылке"** (Magic link login):
        *   Email input locator: `#login-email-magic`
        *   Submit button locator: `button[type="submit"]` (containing text "Получить ссылку")
    *   **"Регистрация"** (Password registration):
        *   Email input locator: `#register-email`
        *   Password input locator: `#register-password`
        *   Submit button locator: `button[type="submit"]` (containing text "Создать аккаунт")
*   **Verification Route**: User verification runs via `src/app/api/auth/verify/route.ts` through the URL `/api/auth/verify?token=...`. When password registration is completed:
    1. A token is created and sent to the email (`src/actions/auth/password-register.ts`).
    2. During development mode, the magic link url is printed to the console:
        ```typescript
        if (process.env.NODE_ENV !== 'production') {
          console.info(`\n[DEVELOPMENT] MAGIC LINK FOR ${email}: \n${link}\n`);
        }
        ```
    3. Clicking the verification link sets `isEmailVerified: true` and logs the user in.

### Cabinet Navigation & Order Placement
*   **Dashboard Page**: Located at `src/app/dashboard/page.tsx`. Navigates to `/dashboard`.
*   **New Order Page**: Located at `src/app/dashboard/new-order/page.tsx` and `client-page.tsx`.
*   **Form Component**: The `UniversalOrderForm` component inside `src/components/orders/UniversalOrderForm.tsx` handles links parsing and order placement.
*   **Form Fields**:
    *   Main dropzone text area: `textarea` with `placeholder="Вставьте ссылку или сразу несколько (до 50 шт)"`
    *   Button: `+ Добавить` (which adds the pasted URLs to `engine.tasks`).
    *   Platform selection (inside accordion list items): select dropdown with value mapping to platforms (Telegram, VK, Instagram, etc.).
    *   Category selection: select dropdown with `placeholder="Выберите категорию"`.
    *   Service selection: select dropdown with `placeholder="-- Выберите услугу --"`.
    *   Quantity selection: `input[type="number"]` with min quantity constraints mapped from the service parameters.
    *   Sticky checkout footer:
        *   Email input: `input[placeholder="Ваш email"]`.
        *   Gateway selection: select dropdown with options:
            *   `yookassa`: Банковская карта (РФ) / СБП
            *   `cryptobot`: Криптовалюта (CryptoBot)
            *   `balance`: Баланс (visible only if `userBalanceCents >= totalCents`).
*   **Order Checkout Server Action**: Placing the order calls `structuredMassOrderCheckoutAction` inside `src/actions/order/mass.ts`.
    *   Input schema constraints:
        ```typescript
        const structuredMassOrderSchema = z.object({
          orders: z.array(z.object({
            serviceId: z.string(),
            link: z.string(),
            quantity: z.number().positive(),
          })).min(1, 'Заказы не найдены'),
          email: z.string().email('Введите корректный email').nullable().optional(),
          gateway: z.enum(['yookassa', 'cryptobot', 'balance']).default('yookassa'),
          idempotencyKey: z.string().optional(),
          expectedTotalRub: z.number().optional(),
        });
        ```

### Balance Decrement Logic
*   If `gateway === 'balance'` is selected, order payment goes through `BalanceGateway.createPayment()` inside `src/services/financial/payment-gateway.service.ts`.
*   Balance deduction is processed atomically using `WalletOps.charge()` inside a serializable database transaction:
    ```typescript
    const updatedUserBatch = await tx.user.updateMany({
      where: { 
        id: userId,
        balance: { gte: amountCents }
      },
      data: {
        balance: { decrement: amountCents },
        totalSpent: { increment: amountCents }
      }
    });
    ```
*   This pattern ensures that a user's balance is checked and decremented in a single atomic step, mitigating race conditions or double-spending exploits.

### Active Vexboost Database Services
From executing the database service check command (Task-99 output):
*   **Service Name**: "Telegram Просмотры поста [Медленные]"
*   **Internal Service ID**: `cmr5dn1mu00q4ljachnhb3dnw`
*   **External Service ID (Vexboost)**: `"2498"`
*   **Category Name**: `"👁 Просмотры / Охват"`
*   **Target Link Type**: `"POST"`
*   **Quantity Constraints**: min `10`, max `500000`
*   **Provider rate**: `0.08734939759036145 USD / 1k`

### Local Server Reachability Check
*   The Next.js test/dev configuration server runs on **port 3001** (as defined in `playwright.config.ts` and logs `scratch/dev_server_run_utf8.log`).
*   Verification of the local server at `http://localhost:3000` via terminal commands timed out because the permission prompts timed out (due to user AFK).

---

## 2. Logic Chain

1.  **Registration and login entry point check**: By inspecting `/src/app/(auth)/login/page.tsx` and `login-form.tsx`, we find registration logic is fully embedded in the `/login` route using a client-side React tab panel state (`activeTab === 'register'`).
2.  **Email Activation mechanism**: In `src/actions/auth/password-register.ts`, we see that registration creates a user row with `isEmailVerified: false` and adds an `AuthToken` to the database, dispatching a magic link to user. We can bypass this check in automated tests by modifying the user record directly in the database (`isEmailVerified: true`) to simplify authentication flow.
3.  **Active Service extraction**: Running the prisma query on the active database instances (via task-99 output logs) proved that active services are configured. We identified `cmr5dn1mu00q4ljachnhb3dnw` as a valid active service belonging to the Vexboost provider, matching the category "👁 Просмотры / Охват".
4.  **Order placement handling**: Tracing `UniversalOrderForm.tsx` shows it aggregates orders and invokes the `structuredMassOrderCheckoutAction` server action.
5.  **Deduction security**: By viewing `payment-gateway.service.ts` and `wallet-ops.ts`, we verified that when paying via balance, the debit operations are fully atomic and wrapped in serializable Prisma transactions.

---

## 3. Caveats

*   **Server port**: The standard Next.js local port is `3000`, but tests/playwright default to `3001` with `.env.test`.
*   **AFK Restrictions**: Terminal tasks requiring manual permission confirmation could not be run repeatedly because the prompt times out. Future test runs must assume the server port is reachable once Playwright starts the web server programmatically.

---

## 4. Conclusion

The client signup and ordering workflow is properly structured. To test it via Playwright, one should:
1. Navigate to `/login`, register a user.
2. Update the user `isEmailVerified` status in the DB.
3. Log in with the registered user.
4. Navigate to `/dashboard/new-order`, paste a Telegram link, configure category and service `cmr5dn1mu00q4ljachnhb3dnw`, enter details, and submit with payment.

The proposed test script `proposed_client_order_flow.spec.ts` has been saved directly to this working directory.

---

## 5. Verification Method

To verify this spec locally:
1. Move the drafted spec file to `e2e/client-order-flow.spec.ts`:
   ```bash
   mv .agents/teamwork_preview_explorer_testing_m1_1/proposed_client_order_flow.spec.ts e2e/client-order-flow.spec.ts
   ```
2. Run the Playwright test command:
   ```bash
   npx playwright test e2e/client-order-flow.spec.ts
   ```
3. Check the database to confirm the test user and order were created correctly.
