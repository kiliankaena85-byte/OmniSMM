## 2026-06-08T00:20:41Z
You are the teamwork_preview_worker. Your working directory is d:\SMM_plan_2\.agents\worker_playwright_m4_m5_gen2.
Your task is to implement the Cherry-Pick Import Wizard E2E test in `e2e/providers.spec.ts` and verify the entire test suite and build system:

1. Edit `e2e/providers.spec.ts` to add the Cherry-Pick Import Wizard E2E test.
   - Use `test('Admin can import service via Cherry-Pick Wizard', async ({ page }) => { ... })`.
   - Inside the test, perform the following steps:
     a. Import `redis` from `../src/lib/redis`.
     b. Deactivate all existing providers to ensure the mock provider is auto-selected:
        `await prisma.provider.updateMany({ data: { isActive: false } });`
     c. Ensure network `telegram` exists.
     d. Ensure category `e2e-telegram-subs-cat` exists with name 'E2E Telegram Subscribers' under network `telegram`.
     e. Create a provider 'Mock Provider for Import' with apiUrl 'http://localhost:3001/api/dev/mock-provider' and apiKey using `process.env.MOCK_PROVIDER_KEY` (fallback to 'dev_mock_key') and isActive: true.
     f. Delete any service in Postgres with externalId '100' or name 'Mock Telegram Followers' to avoid duplicate key errors.
     g. Delete the redis key `provider:${provider.id}:catalog` using `await redis.del(cacheKey);`.
     h. Navigate to `/admin/providers/import`.
     i. Verify the "Каталог провайдера пуст" view is shown, and click the "Загрузить каталог" button.
     j. Wait for the services table to be visible.
     k. Find the row containing text "Mock Telegram Followers" and check its checkbox.
     l. Find the markup input (label: "Наценка (%)") and fill it with '75'.
     m. Click the button `📥 Импортировать выбранные (1)`.
     n. In the confirmation modal, click the button `✅ Подтвердить импорт`.
     o. Wait for success toast / notification.
     p. Assert that the service is successfully created in PostgreSQL with `markup` set to `1.75`, `externalId` to `100`, name to 'Mock Telegram Followers', and associated with the category.
     q. Clean up by deleting the created service and provider, and disconnecting prisma and deleting redis key.

2. Run the newly created test to verify it passes:
   `npx dotenv -e .env.test -- npx playwright test e2e/providers.spec.ts`

3. Verify the rest of the Playwright E2E tests:
   `npm run test:e2e`

4. Verify all Vitest integration/unit tests:
   `npm run test`

5. Verify code quality and build compilation:
   `npm run lint`
   `npx tsc --noEmit`
   `npm run build`

6. Write your progress to progress.md and compile a detailed handoff report (handoff.md) under your working directory, then send a message back to the parent.
