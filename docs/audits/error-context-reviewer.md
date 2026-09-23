# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: user-flow.spec.ts >> Milestone 4: Playwright E2E User Flow Tests >> Magic Link authentication >> should request magic link, create AuthToken in DB, and verify successfully via callback
- Location: e2e\user-flow.spec.ts:348:9

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('input#login-email-magic')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('input#login-email-magic')

```

```yaml
- link "Перейти к основному контенту":
  - /url: "#main-content"
- link "На главную":
  - /url: /
  - text: S Smmplan
- text: Продвижение в социальных сетях
- paragraph: Быстрая накрутка подписчиков, лайков и просмотров. Результат в течение нескольких минут.
- text: 10K+ Клиентов 99% Выполнено 24/7 Поддержка
- paragraph: © 2026 Smmplan · Безопасная оплата через ЮKassa
- heading "Вход в аккаунт" [level=1]
- paragraph: Войдите в личный кабинет по паролю или с помощью ссылки на почту.
- button "Войти по паролю"
- button "Войти по ссылке"
- button "Регистрация"
- text: Email адрес
- img
- textbox "Email адрес для входа":
  - /placeholder: name@example.com
- text: Пароль
- img
- textbox "Пароль для входа":
  - /placeholder: Введите пароль
- button "Показать пароль":
  - img
- button "Войти в кабинет" [disabled]:
  - text: Войти в кабинет
  - img
- paragraph: Новый пользователь?
- paragraph: Вы можете зарегистрироваться по паролю в соседней вкладке или войти по ссылке — аккаунт будет создан автоматически.
- paragraph:
  - text: Вводя email, вы соглашаетесь с
  - link "Публичной офертой":
    - /url: /legal/terms
  - text: и
  - link "Политикой конфиденциальности":
    - /url: /legal/privacy
- region "Notifications alt+T"
```

# Test source

```ts
  262 |         categoryId: 'e2e-instagram-stories-cat',
  263 |         providerId: provider.id,
  264 |         rate: 1.0,
  265 |         markup: 2.5,
  266 |         minQty: 10,
  267 |         maxQty: 10000,
  268 |         isQuarantined: false,
  269 |         isActive: true,
  270 |         externalId: 'e2e-story-101',
  271 |         targetType: 'STORY'
  272 |       },
  273 |       create: {
  274 |         id: 'e2e-story-service',
  275 |         name: 'E2E Story Service',
  276 |         categoryId: 'e2e-instagram-stories-cat',
  277 |         providerId: provider.id,
  278 |         rate: 1.0,
  279 |         markup: 2.5,
  280 |         minQty: 10,
  281 |         maxQty: 10000,
  282 |         isQuarantined: false,
  283 |         isActive: true,
  284 |         externalId: 'e2e-story-101',
  285 |         targetType: 'STORY'
  286 |       }
  287 |     });
  288 | 
  289 |     await prisma.service.upsert({
  290 |       where: { id: 'e2e-custom-service' },
  291 |       update: {
  292 |         name: 'E2E Custom Service',
  293 |         categoryId: 'e2e-telegram-custom-cat',
  294 |         providerId: provider.id,
  295 |         rate: 1.0,
  296 |         markup: 2.5,
  297 |         minQty: 10,
  298 |         maxQty: 10000,
  299 |         isQuarantined: false,
  300 |         isActive: true,
  301 |         externalId: 'e2e-custom-101',
  302 |         targetType: 'CUSTOM'
  303 |       },
  304 |       create: {
  305 |         id: 'e2e-custom-service',
  306 |         name: 'E2E Custom Service',
  307 |         categoryId: 'e2e-telegram-custom-cat',
  308 |         providerId: provider.id,
  309 |         rate: 1.0,
  310 |         markup: 2.5,
  311 |         minQty: 10,
  312 |         maxQty: 10000,
  313 |         isQuarantined: false,
  314 |         isActive: true,
  315 |         externalId: 'e2e-custom-101',
  316 |         targetType: 'CUSTOM'
  317 |       }
  318 |     });
  319 | 
  320 |     // 6. Update global Settings to keep exchangeRateUSD stable and isTestMode true
  321 |     await prisma.systemSettings.upsert({
  322 |       where: { id: 'global' },
  323 |       update: {
  324 |         isTestMode: true,
  325 |         exchangeRateUSD: 95.0
  326 |       },
  327 |       create: {
  328 |         id: 'global',
  329 |         isTestMode: true,
  330 |         exchangeRateUSD: 95.0
  331 |       }
  332 |     });
  333 |   });
  334 | 
  335 |   test.afterAll(async () => {
  336 |     // Teardown E2E test data
  337 |     await cleanupDb();
  338 |     await prisma.$disconnect();
  339 |   });
  340 | 
  341 |   // ==========================================
  342 |   // Test Case 1: Magic Link Request & Verify Callback
  343 |   // ==========================================
  344 |   test.describe('Magic Link authentication', () => {
  345 |     // Bypass default logged-in session state to run as a guest
  346 |     test.use({ storageState: { cookies: [], origins: [] } });
  347 | 
  348 |     test('should request magic link, create AuthToken in DB, and verify successfully via callback', async ({ page }) => {
  349 |       const email = 'e2e-magic-tester@test.com';
  350 | 
  351 |       // 1. Visit /login
  352 |       await page.goto('/login');
  353 |       await expect(page).toHaveURL(/login/);
  354 | 
  355 |       // 2. Switch to Magic Link tab
  356 |       const magicTab = page.locator('button', { hasText: 'Войти по ссылке' }).first();
  357 |       await expect(magicTab).toBeVisible();
  358 |       await magicTab.click();
  359 | 
  360 |       // 3. Fill email in the magic link email field
  361 |       const magicEmailInput = page.locator('input#login-email-magic');
> 362 |       await expect(magicEmailInput).toBeVisible();
      |                                     ^ Error: expect(locator).toBeVisible() failed
  363 |       await magicEmailInput.fill(email);
  364 | 
  365 |       // 4. Click the send button (submit)
  366 |       const sendBtn = page.locator('button[type="submit"]', { hasText: 'Получить ссылку' }).first();
  367 |       await expect(sendBtn).toBeVisible();
  368 |       await sendBtn.click();
  369 | 
  370 |       // 5. Assert success message is displayed
  371 |       const successMsg = page.locator('div, p', { hasText: /Проверьте почту|Ссылка отправлена/i }).first();
  372 |       await expect(successMsg).toBeVisible({ timeout: 10000 });
  373 | 
  374 |       // 6. Assert that an AuthToken is created in the database for the user
  375 |       // Retrieve the user from the database
  376 |       const dbUser = await prisma.user.findUnique({
  377 |         where: { email },
  378 |         include: { authTokens: true }
  379 |       });
  380 |       expect(dbUser).not.toBeNull();
  381 |       expect(dbUser!.authTokens.length).toBeGreaterThan(0);
  382 | 
  383 |       // 7. Verify Callback: Generate a known raw token, hash it using SHA-256
  384 |       const rawToken = crypto.randomBytes(32).toString('hex');
  385 |       const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  386 |       // Use 24h expiration to tolerate any timezone difference between server/DB/runner
  387 |       const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  388 | 
  389 |       // Create an AuthToken record in the DB for the test user
  390 |       const dbToken = await prisma.authToken.create({
  391 |         data: {
  392 |           userId: dbUser!.id,
  393 |           token: hashedToken,
  394 |           expiresAt,
  395 |           used: false
  396 |         }
  397 |       });
  398 | 
  399 |       // 8. Navigate browser directly to the callback endpoint /api/auth/verify?token=rawToken
  400 |       await page.goto(`/api/auth/verify?token=${rawToken}`);
  401 | 
  402 |       // 9. Assert redirection to dashboard
  403 |       await expect(page).toHaveURL(/dashboard/, { timeout: 15000 });
  404 | 
  405 |       // 10. Assert that the database token is consumed (used: true)
  406 |       const finalToken = await prisma.authToken.findUnique({
  407 |         where: { id: dbToken.id }
  408 |       });
  409 |       expect(finalToken).not.toBeNull();
  410 |       expect(finalToken!.used).toBe(true);
  411 |     });
  412 |   });
  413 | 
  414 |   // ==========================================
  415 |   // Helper for Authenticated Scenarios
  416 |   // ==========================================
  417 |   const setupAuthenticatedUser = async (email: string, balanceCents: number, page: any) => {
  418 |     // Create/upsert user with specified balance
  419 |     const user = await prisma.user.upsert({
  420 |       where: { email },
  421 |       update: { balance: balanceCents, isActive: true, isDeleted: false },
  422 |       create: { email, balance: balanceCents, role: 'USER' }
  423 |     });
  424 | 
  425 |     // Create a new AuthToken for callback authentication
  426 |     const rawToken = crypto.randomBytes(32).toString('hex');
  427 |     const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  428 |     // Use 24h expiration to tolerate timezone differences
  429 |     const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  430 | 
  431 |     await prisma.authToken.create({
  432 |       data: {
  433 |         userId: user.id,
  434 |         token: hashedToken,
  435 |         expiresAt,
  436 |         used: false
  437 |       }
  438 |     });
  439 | 
  440 |     // Authenticate by visiting the verification callback
  441 |     await page.goto(`/api/auth/verify?token=${rawToken}`);
  442 |     await expect(page).toHaveURL(/dashboard/, { timeout: 15000 });
  443 |     return user;
  444 |   };
  445 | 
  446 |   // Helper to handle responsive selectors for service selection
  447 |   const selectService = async (page: any, serviceId: string, serviceName: string) => {
  448 |     const selectElement = page.locator('select#service-select').first();
  449 |     if (await selectElement.isVisible()) {
  450 |       await selectElement.selectOption(serviceId);
  451 |     } else {
  452 |       const optionBtn = page.locator('button[role="option"]', { hasText: serviceName }).first();
  453 |       await expect(optionBtn).toBeVisible({ timeout: 15000 });
  454 |       await optionBtn.click();
  455 |     }
  456 |   };
  457 | 
  458 |   // Helper to wait for URL analysis debounce and loading indicator to settle
  459 |   const fillUrlAndWait = async (page: any, url: string) => {
  460 |     const urlInput = page.locator('input#order-url').first();
  461 |     await urlInput.fill(url);
  462 |     await urlInput.blur();
```