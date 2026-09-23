## 2026-06-07T19:48:46Z
You are the teamwork_preview_worker. Your working directory is d:\SMM_plan_2\.agents\worker_m3_m6_1.
Your task is to implement the test suites for R2 (Payment Gateways API Verification) and R5 (Queue & SLA Worker Tests):

1. Create a new test file: `test/unit/payment-gateway-selection.test.ts`
   - It should test `BasePaymentGateway` implementations (YooKassa, Robokassa, CryptoBot) created by `PaymentGatewayFactory.getGateway(...)`.
   - Test cases to implement:
     a. **Dummy/Empty Credentials Fallback**: When credentials (shop ID, keys, tokens) are empty, default, or placeholders like `'test_shop_id'`, `'test_login'`, the gateway must return the mock-payment URL (`/api/dev/mock-payment`) and NOT make any network request.
     b. **Non-Dummy Credentials Real API Call**: When non-dummy credentials are configured, the gateway must initiate a real API request. You can mock/stub `fetch` to verify it calls the correct URL (e.g. `https://api.yookassa.ru/v3/payments` for YooKassa or `https://pay.crypt.bot/api/createInvoice` for CryptoBot). Ensure to mock `process.env.NODE_ENV` as `'production'` or something other than `'test'` so the E2E test guard doesn't immediately force it to mock.
     c. **Sandbox/Test Keys Fallback**: When production credentials are dummy/empty, but test keys (e.g. `yookassaTestShopId` and `yookassaTestSecretKey`) are configured with non-dummy values, the settings manager/gateway must fall back to the test keys and initiate a real network request (API fetch) to sandboxes rather than using the mock redirect.
   - Run this test to verify: `npx dotenv -e .env.test -- vitest run test/unit/payment-gateway-selection.test.ts`

2. Supplement `test/unit/red-team.queue.test.ts` with tests for:
   - **Prisma Transaction Rollback / Database Write Failures**: Add a test case simulating a database write failure or `$transaction` failure (e.g. `db.order.update` or `db.$transaction` throwing an error) during the success path update. Verify that the order processor propagates the exception, allowing BullMQ to retry the job, rather than silently swallowing it or refunding the customer immediately.
   - Run the retry queue tests to verify: `npx dotenv -e .env.test -- vitest run test/unit/red-team.queue.test.ts`

3. Run the entire unit and integration test suite: `npm run test`
4. Run ESLint and type check: `npm run lint` and `npx tsc --noEmit`
5. Report your findings, results, and created/modified files back to the parent in a handoff report (`handoff.md`) under your working directory, and update your `progress.md`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
