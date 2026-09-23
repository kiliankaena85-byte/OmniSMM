## 2026-06-07T19:48:12Z
You are a Teamwork Worker. Your task is to implement Milestone 3 (R2: Payment Gateways API Verification & Fallbacks):

1. Implement Integration Tests for Payment Gateways:
   - Create a new integration test file at `test/integration/payment-gateways.test.ts`.
   - Write tests for the payment gateways configured via `PaymentGatewayFactory` (from `src/services/financial/payment-gateway.service.ts`), which include `YooKassaGateway`, `CryptoBotGateway`, and `RobokassaGateway`.
   - Test Case 1: Empty/Default Credentials Fallback.
     - Verify that when no credentials or default placeholders (e.g. `'test_shop_id'`, `'test_login'`) are set, the gateways correctly return mock payment URLs pointing to `/api/dev/mock-payment` in their `paymentUrl`.
   - Test Case 2: Configured Keys Execution.
     - Verify that when non-default keys are configured, calling `createPayment` makes real API requests (i.e. does not redirect to `/api/dev/mock-payment`).
     - For YooKassaGateway: Mock `fetch` to return a successful payment response, call `createPayment`, and assert that `fetch` was invoked with `https://api.yookassa.ru/v3/payments`, verifying the basic auth header and JSON payload structure.
     - For CryptoBotGateway: Mock `fetch` to return a successful invoice response, call `createPayment`, and assert that `fetch` was invoked with `https://pay.crypt.bot/api/createInvoice`, verifying the `Crypto-Pay-API-Token` header.
     - For RobokassaGateway: Call `createPayment`, and assert that the returned `paymentUrl` starts with `https://auth.robokassa.ru/Merchant/Index.aspx` and contains the expected query params (e.g., MerchantLogin, OutSum, SignatureValue).
   - Test Case 3: Test Keys Fallback.
     - Verify that if production keys contain default placeholders but test keys are configured (e.g. `yookassaTestShopId` has a non-default value), the settings manager automatically switches to the test credentials and makes the real API request.
   - Setup & Cleanup:
     - Ensure you mock/stub `fetch` carefully within the test file, and clean it up (unstub/restore) in `afterEach()` or `afterAll()` so subsequent test suites are not affected.
     - Since Vitest tests run sequentially, prevent any DB deadlocks or side-effects.

2. Verification:
   - Run Vitest to verify your new tests pass: `npx dotenv -e .env.test -- vitest run test/integration/payment-gateways.test.ts`.
   - Verify that typescript typechecking (`npx tsc --noEmit`) passes cleanly with zero errors.
   - Verify that eslint (`npm run lint`) passes cleanly with zero errors.
   - Verify that the full build (`npm run build`) runs cleanly.

3. Handoff:
   - Document your changes, files modified/created, test execution results, and build/lint success in `d:\SMM_plan_2\.agents\teamwork_preview_worker_testing_m3\handoff.md`.
   - Send a message to the parent orchestrator when done.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your working directory for agent metadata is: `d:\SMM_plan_2\.agents\teamwork_preview_worker_testing_m3`
