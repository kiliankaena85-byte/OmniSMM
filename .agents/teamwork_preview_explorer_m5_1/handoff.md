# E2E Testing Strategy for Smmplan Admin Panel (R4)

This handoff report details the strategy and implementation plan for Playwright E2E tests targeting the admin panel, provider management, service synchronization, price quarantine isolation (Price Spike, Margin Floor Breaches, API Cooldowns, Zombies), and audit log validation.

---

## 1. Observation

A direct audit of the current codebase reveals the following structure and gaps:

### A. Current Test Status

1. **Authentication Bypass**:
   In `e2e/admin-panel.spec.ts` (lines 5-7), E2E tests bypass the `/login` page UI entirely by loading pre-saved cookies:
   ```typescript
   // Use the admin storage state (which we set up in auth.setup.ts)
   // Assuming auth.setup.ts saves state as admin if needed, or we just rely on standard auth.
   ```
   No browser tests exist to verify password visibility toggles, login field validations, bad credential handling, or role-based redirects.

2. **Provider Testing Gaps**:
   In `e2e/providers.spec.ts`, tests are limited to navigation, form validation errors, connection failure under fake URL (lines 41-68), and basic Cherry-Pick Wizard selection. No E2E test covers:
   - Successful creation of a provider.
   - Successful modification of a provider's configuration.

3. **Quarantine & Sync Seeded State**:
   In `e2e/admin-panel.spec.ts` (lines 70-125), quarantine tests verify only the **rejection** flow by directly seeding a quarantined service inside PostgreSQL:
   ```typescript
   const service = await prisma.service.create({
     data: {
       name: 'E2E Quarantined Service',
       categoryId: category.id,
       providerId: provider.id,
       rate: 10.0,
       isQuarantined: true,
       pendingRate: 20.0,
       quarantineReason: 'E2E Price increase by 100%',
       ...
     }
   });
   ```
   The transition logic (from provider API price drift -> sync worker -> database quarantine status -> UI representation) is completely untested.

4. **API Cooldown / Cooldown Removal Gaps**:
   API Cooldown states (Trigger A: `HIGH_API_FAILURES` or Trigger B cancel strikes) are never tested in E2E tests, nor is the UI action "Снять блок" verified.

5. **Log Verifications**:
   No E2E assertions confirm `AdminAuditLog` records for provider CRUD, catalog synchronization, quarantine accept/rejections, zombie archiving, or API block removals.

---

### B. Admin & Sync Framework Implementation

1. **Server-Side Operations**:
   Manual synchronizations and catalog edits are triggered via Next.js Server Actions:
   - `adminSyncProviderCatalog()` in `src/actions/admin/providers/sync-action.ts` (line 20)
   - `approveQuarantinedService(serviceId)` (line 281)
   - `rejectQuarantinedService(serviceId)` (line 331)
   - `archiveZombieService(serviceId)` (line 398)
   - `liftApiBlock(serviceId)` (line 432)

2. **Database Schema Constraints**:
   - `AdminAuditLog` (schema.prisma lines 610-625) stores administrative audit events (`action`, `target`, `targetType`, `oldValue`, `newValue`, `adminEmail`).
   - `Service` (schema.prisma lines 175-239) tracks quarantine states via `isQuarantined`, `pendingRate`, `quarantineReason`, `quarantinedAt`, and cooldowns via `cooldownUntil` and `cooldownReason`.

3. **Mock Provider Sandbox**:
   - `/api/dev/mock-provider` in `src/app/api/dev/mock-provider/route.ts` is the local SMM API V2 sandbox.
   - Its responses for `services` are hardcoded:
     ```typescript
     if (action === 'services') {
       return NextResponse.json([
         {
           service: '100',
           name: 'Mock Telegram Followers',
           rate: '10.00',
           ...
         }
       ]);
     }
     ```
     This prevents E2E test scripts from dynamically altering the provider rate to simulate price spikes or missing services.

---

## 2. Logic Chain

1. **UI Login Forms**:
   The `LoginForm` component (`login-form.tsx`) implements email validation, password fields, password eye toggles (`toggleShowPassword`), and redirect logic based on API returns (`res.redirectTo`). Since E2E tests skip this page, any regressions on the login screen (e.g. broken fields, unhandled exceptions, or incorrect routing) are unmonitored. We must write a dedicated E2E test targeting `/login` for both normal users and staff roles.

2. **Mocking Server-Side Integrations**:
   Playwright's `page.route()` runs inside the browser and cannot intercept Next.js Server Action requests to external API URLs because they are executed server-side in Node.js.
   However, both the Next.js runtime (the mock provider router) and the Playwright tests share access to the same Redis instance (`@/lib/redis`) and Postgres database.
   Therefore, we can introduce a **Redis-driven dynamic override** inside the mock provider route. Playwright E2E tests can write custom services or rates to a Redis key (e.g., `mock-provider:services`), and the mock provider will read and return those values on demand.

3. **Quarantine Automation and UI Actions**:
   By updating the mock provider to be dynamic, we can test:
   - **Price Spike Isolation**: Set a mock provider rate in Redis with a >20% increase, trigger catalog sync, verify in DB and UI that the service becomes inactive and quarantined, and then approve/reject the quarantine in the UI.
   - **Margin Floor Breach**: Set a mock rate in Redis that drops the actual markup below the `SAFETY_FLOOR_MARKUP` threshold (1.0), verify it is deactivated and quarantined, and that the database receives the correct reason.
   - **Zombie Services**: Remove a service from the mock provider catalog in Redis, trigger a sync, and verify that it is deactivated with `cooldownReason = 'ZOMBIE_AUTO_DISABLED'`.
   - **Elastic API Cooldown**: Set a Redis key that flags the mock provider to return HTTP 500, execute syncs/orders multiple times, and verify the service enters a 2-hour quarantine with `HIGH_API_FAILURES`.
   - **UI Actions**: Target specific tabs on the Quarantine page ("Ценовые скачки", "Зомби-услуги", "Сбои API") and click the corresponding buttons ("Принять", "Отклонить", "Принять все", "Скрыть навсегда", "Снять блок"), asserting success toasts and database updates.

4. **Audit Logs**:
   Since the server actions utilize the `auditAdmin` helper, they write records directly to the `AdminAuditLog` table. Playwright tests can query Postgres via Prisma Client directly after triggering UI actions to assert that audit records are written with the correct action types (e.g., `QUARANTINE_APPROVE`, `QUARANTINE_REJECT`, `SERVICE_ARCHIVE_ZOMBIE`, `SERVICE_LIFT_API_BLOCK`, `PROVIDER_CREATE`, `PROVIDER_UPDATE`).

---

## 3. Caveats

- **Network Isolation**: The E2E tests must point to `http://localhost:3001/api/dev/mock-provider` and require `process.env.MOCK_PROVIDER_KEY` to authenticate.
- **Database Cleandown**: Due to strict model relations (e.g., `Order` -> `Service`), tests must carefully clean up their seeded and modified services, providers, and audit logs to avoid primary/unique key constraint errors.
- **Concurrency**: Parallel E2E test workers might conflict on the Redis keys if they edit them simultaneously. Using unique service IDs or execution mutexes is recommended.

---

## 4. Conclusion & Recommended Strategy

### A. Mock Provider Dynamic Override (Proposed Changes)

Edit `src/app/api/dev/mock-provider/route.ts` to allow dynamic Redis overrides:

```typescript
// Proposed addition inside POST function of src/app/api/dev/mock-provider/route.ts:

// 1. Dynamic Services Override
if (action === 'services') {
  const { redis } = await import('@/lib/redis');
  
  // E2E tests can write custom catalogs to this key
  const overrideCatalog = await redis.get('mock-provider:services');
  if (overrideCatalog) {
    try {
      return NextResponse.json(JSON.parse(overrideCatalog));
    } catch (e) {
      console.error("Failed to parse mock-provider:services override:", e);
    }
  }
  
  // Trigger simulation of connection/server errors
  const apiErrorFlag = await redis.get('mock-provider:status_error');
  if (apiErrorFlag === 'true') {
    return NextResponse.json({ error: 'Internal server error from provider' }, { status: 500 });
  }

  // Default fallback
  return NextResponse.json([
    {
      service: '100',
      name: 'Mock Telegram Followers',
      type: 'Default',
      category: 'Telegram',
      rate: '10.00',
      min: '10',
      max: '10000',
      dripfeed: true,
      refill: false,
      cancel: true
    }
  ]);
}
```

---

### B. Admin Login UI Test Suite

Create/append tests in `e2e/auth-and-dashboard.spec.ts` or `e2e/admin-panel.spec.ts`:

```typescript
test.describe('Admin Authentication & Routing', () => {
  // Clear storage states for clean authentication
  test.use({ storageState: { cookies: [], origins: [] } });

  test('Valid Admin login redirects to /admin/dashboard', async ({ page }) => {
    await page.goto('/login');
    
    // Fill credentials
    await page.locator('#login-email').fill('e2e-tester@test.com');
    await page.locator('#login-password').fill('password123'); // seed in db beforehand
    
    // Click submit and check toast
    await page.getByRole('button', { name: /Войти в кабинет/i }).click();
    await expect(page.getByText('Успешный вход в аккаунт!')).toBeVisible();

    // Expect redirect to admin panel
    await expect(page).toHaveURL(/\/admin\/dashboard/);
  });

  test('User login redirects to /dashboard instead of /admin/dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#login-email').fill('user-tester@test.com');
    await page.locator('#login-password').fill('password123');
    await page.getByRole('button', { name: /Войти в кабинет/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('Password visibility eye toggle works', async ({ page }) => {
    await page.goto('/login');
    const passwordInput = page.locator('#login-password');
    await expect(passwordInput).toHaveAttribute('type', 'password');
    
    // Toggle eye icon
    await page.locator('#login-password + button').click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
  });
});
```

---

### C. Provider CRUD Test Suite

Extend `e2e/providers.spec.ts` with creation and update actions:

```typescript
test('Admin can successfully create a new provider', async ({ page }) => {
  await page.goto('/admin/providers/new');
  
  await page.locator('input[name="name"]').fill('E2E New Provider');
  await page.locator('input[name="apiUrl"]').fill('http://localhost:3001/api/dev/mock-provider');
  await page.locator('input[name="apiKey"]').fill('dev_mock_key');
  
  // Submit Form
  await page.getByRole('button', { name: 'Создать провайдера' }).click();
  await expect(page.getByText('Провайдер успешно создан')).toBeVisible();

  // Verify DB record & Audit Log
  const prisma = new PrismaClient();
  const provider = await prisma.provider.findUnique({ where: { name: 'E2E New Provider' } });
  expect(provider).not.toBeNull();
  expect(provider!.apiUrl).toBe('http://localhost:3001/api/dev/mock-provider');

  const auditLog = await prisma.adminAuditLog.findFirst({
    where: { action: 'PROVIDER_CREATE', target: provider!.id }
  });
  expect(auditLog).not.toBeNull();
  await prisma.$disconnect();
});

test('Admin can update provider configuration details', async ({ page }) => {
  // Seek the provider created above
  const prisma = new PrismaClient();
  const provider = await prisma.provider.findFirst({ where: { name: 'E2E New Provider' } });
  await prisma.$disconnect();

  await page.goto(`/admin/providers/${provider!.id}/edit`);
  await page.locator('input[name="apiUrl"]').fill('http://localhost:3001/api/dev/mock-provider-updated');
  await page.getByRole('button', { name: 'Сохранить изменения' }).click();
  await expect(page.getByText('Изменения сохранены')).toBeVisible();

  // Verify update in DB
  const prisma2 = new PrismaClient();
  const updatedProvider = await prisma2.provider.findUnique({ where: { id: provider!.id } });
  expect(updatedProvider!.apiUrl).toBe('http://localhost:3001/api/dev/mock-provider-updated');
  await prisma2.$disconnect();
});
```

---

### D. Quarantine, Synchronization, & Cooldown Test Suite

Add an E2E sync simulation test leveraging Redis overrides to verify all quarantine conditions:

```typescript
test.describe('Synchronization, Quarantines and Cooldowns', () => {
  let providerId: string;
  let serviceId: string;
  const prisma = new PrismaClient();

  test.beforeEach(async () => {
    // 1. Seed Network & Category
    const network = await prisma.network.upsert({
      where: { slug: 'telegram' },
      update: {},
      create: { name: 'Telegram', slug: 'telegram', icon: 'tg' }
    });

    const category = await prisma.category.upsert({
      where: { slug: 'e2e-sync-cat' },
      update: {},
      create: { name: 'E2E Sync Category', slug: 'e2e-sync-cat', networkId: network.id }
    });

    // 2. Seed Provider
    const provider = await prisma.provider.upsert({
      where: { name: 'E2E Dynamic Provider' },
      update: { apiUrl: 'http://localhost:3001/api/dev/mock-provider', isActive: true },
      create: { name: 'E2E Dynamic Provider', apiUrl: 'http://localhost:3001/api/dev/mock-provider', apiKey: 'dev_mock_key', isActive: true }
    });
    providerId = provider.id;

    // 3. Seed Service with initial rate 10.0
    const service = await prisma.service.upsert({
      where: { numericId: 9999 },
      update: { rate: 10.0, pricePer1000Cents: 1750, markup: 1.75, isActive: true, isQuarantined: false },
      create: {
        numericId: 9999,
        name: 'E2E Dynamic Service',
        categoryId: category.id,
        providerId: provider.id,
        rate: 10.0,
        markup: 1.75,
        pricePer1000Cents: 1750, // 17.50 RUB
        externalId: '100',
        minQty: 10,
        maxQty: 10000,
        isActive: true,
      }
    });
    serviceId = service.id;

    // Clear redis override
    await redis.del('mock-provider:services');
    await redis.del('mock-provider:status_error');
  });

  test.afterEach(async () => {
    await prisma.service.deleteMany({ where: { providerId } });
    await prisma.provider.deleteMany({ where: { id: providerId } });
    await redis.del('mock-provider:services');
    await redis.del('mock-provider:status_error');
  });

  test('Price Spike (>20%) quarantines service, blocks it, and can be accepted/rejected via UI', async ({ page }) => {
    // 1. Write price spike to Redis override (rate 10.0 -> 13.0, representing +30% increase)
    const spikeCatalog = [
      { service: '100', name: 'Mock Telegram Followers', rate: '13.00', min: '10', max: '10000' }
    ];
    await redis.set('mock-provider:services', JSON.stringify(spikeCatalog));

    // 2. Navigate to UI and trigger synchronization
    await page.goto('/admin/providers');
    const providerRow = page.locator('tr', { hasText: 'E2E Dynamic Provider' });
    await providerRow.getByRole('button', { name: 'Синхронизировать' }).click();
    await expect(page.getByText('Синхронизация Бутика завершена')).toBeVisible({ timeout: 15000 });

    // 3. Verify PostgreSQL Quarantine details
    const serviceDb = await prisma.service.findUnique({ where: { id: serviceId } });
    expect(serviceDb!.isQuarantined).toBe(true);
    expect(serviceDb!.isActive).toBe(false);
    expect(serviceDb!.pendingRate).toBe(13.0);
    expect(serviceDb!.quarantineReason).toContain('Price Spike');

    // 4. Navigate to Quarantine UI and Accept
    await page.goto('/admin/catalog/quarantine');
    await expect(page.getByText('E2E Dynamic Service')).toBeVisible();
    
    // Click Accept button (✅ Принять)
    const row = page.locator('tr', { hasText: 'E2E Dynamic Service' });
    await row.getByRole('button', { name: '✅ Принять' }).click();
    await expect(page.getByText('Принято: E2E Dynamic Service')).toBeVisible();

    // Assert database price updates and audit log
    const approvedService = await prisma.service.findUnique({ where: { id: serviceId } });
    expect(approvedService!.isQuarantined).toBe(false);
    expect(approvedService!.rate).toBe(13.0);

    const auditLog = await prisma.adminAuditLog.findFirst({
      where: { action: 'QUARANTINE_APPROVE', target: serviceId }
    });
    expect(auditLog).not.toBeNull();
  });

  test('Margin Floor Breach quarantines service and deactivates it', async ({ page }) => {
    // Retail price is 17.50 RUB. If provider rate rises to 18.00 USD (at exchange rate 1.0, cost = 18.0 RUB),
    // actual markup = 17.5 / 18.0 = 0.97 < SAFETY_FLOOR_MARKUP (1.0).
    const breachCatalog = [
      { service: '100', name: 'Mock Telegram Followers', rate: '18.00', min: '10', max: '10000' }
    ];
    await redis.set('mock-provider:services', JSON.stringify(breachCatalog));

    await page.goto('/admin/providers');
    await page.locator('tr', { hasText: 'E2E Dynamic Provider' }).getByRole('button', { name: 'Синхронизировать' }).click();
    await expect(page.getByText('Синхронизация Бутика завершена')).toBeVisible({ timeout: 15000 });

    const serviceDb = await prisma.service.findUnique({ where: { id: serviceId } });
    expect(serviceDb!.isQuarantined).toBe(true);
    expect(serviceDb!.isActive).toBe(false);
    expect(serviceDb!.quarantineReason).toContain('Margin Floor Breach');
  });

  test('Zombie Service is deactivated and archived via UI', async ({ page }) => {
    // 1. Simulate empty provider catalog (external service 100 removed)
    await redis.set('mock-provider:services', JSON.stringify([]));

    await page.goto('/admin/providers');
    await page.locator('tr', { hasText: 'E2E Dynamic Provider' }).getByRole('button', { name: 'Синхронизировать' }).click();
    await expect(page.getByText('Синхронизация Бутика завершена')).toBeVisible({ timeout: 15000 });

    // Verify database ZOMBIE status
    const serviceDb = await prisma.service.findUnique({ where: { id: serviceId } });
    expect(serviceDb!.isActive).toBe(false);
    expect(serviceDb!.cooldownReason).toBe('ZOMBIE_AUTO_DISABLED');

    // 2. Archive via UI
    await page.goto('/admin/catalog/quarantine');
    await page.getByRole('button', { name: 'Зомби-услуги' }).click();
    await expect(page.getByText('E2E Dynamic Service')).toBeVisible();

    await page.locator('tr', { hasText: 'E2E Dynamic Service' }).getByRole('button', { name: 'Скрыть навсегда' }).click();
    await expect(page.getByText('Архивировано: E2E Dynamic Service')).toBeVisible();

    // Assert archived name prefix in DB & Audit Log
    const archivedService = await prisma.service.findUnique({ where: { id: serviceId } });
    expect(archivedService!.name).toContain('[ARCHIVED]');
    expect(archivedService!.isActive).toBe(false);

    const auditLog = await prisma.adminAuditLog.findFirst({
      where: { action: 'SERVICE_ARCHIVE_ZOMBIE', target: serviceId }
    });
    expect(auditLog).not.toBeNull();
  });

  test('Elastic API Cooldown puts service on hold and can be lifted early', async ({ page }) => {
    // 1. Simulate API Error
    await redis.set('mock-provider:status_error', 'true');

    // Manually force Trigger A failures in E2E (via direct backend calls or order timeouts)
    const { QuarantineService } = await import('@/services/providers/quarantine.service');
    for (let i = 0; i < 5; i++) {
      await QuarantineService.evaluateTriggerA(serviceId, 'E2E Simulated API Failure');
    }

    // Verify DB Cooldown
    const serviceDb = await prisma.service.findUnique({ where: { id: serviceId } });
    expect(serviceDb!.cooldownReason).toBe('HIGH_API_FAILURES');
    expect(serviceDb!.cooldownUntil).not.toBeNull();

    // 2. Nav to UI and lift block
    await page.goto('/admin/catalog/quarantine');
    await page.getByRole('button', { name: 'Сбои API' }).click();
    await expect(page.getByText('E2E Dynamic Service')).toBeVisible();

    await page.locator('tr', { hasText: 'E2E Dynamic Service' }).getByRole('button', { name: 'Снять блок' }).click();
    await expect(page.getByText('Блокировка снята: E2E Dynamic Service')).toBeVisible();

    // Verify db cooldown reset
    const clearedService = await prisma.service.findUnique({ where: { id: serviceId } });
    expect(clearedService!.cooldownReason).toBeNull();
    expect(clearedService!.cooldownUntil).toBeNull();

    const auditLog = await prisma.adminAuditLog.findFirst({
      where: { action: 'SERVICE_LIFT_API_BLOCK', target: serviceId }
    });
    expect(auditLog).not.toBeNull();
  });
});
```

---

### E. Exact Steps and Files to Modify/Create

1. **Modify `src/app/api/dev/mock-provider/route.ts`**:
   - Add checks at the beginning of the `services` action handler for a Redis override key (`mock-provider:services` and `mock-provider:status_error`).
2. **Modify `e2e/admin-panel.spec.ts`**:
   - Append the Admin Authentication and Redirection test suite.
   - Append the Quarantine Sync and UI Action assertions (Price Spikes, Zombie Services, API failures).
3. **Modify `e2e/providers.spec.ts`**:
   - Append the Provider CRUD test suite.

---

## 5. Verification Method

- **E2E Execution Command**:
  ```powershell
  # Spin up testing server environment
  npm run dev -- -p 3001
  
  # Run Playwright E2E tests
  npx playwright test e2e/admin-panel.spec.ts e2e/providers.spec.ts
  ```
- **Database Inspection**:
  Verify the audit entries in the database table using direct query:
  ```powershell
  # Run a query verification script or check Prisma Studio
  npx prisma studio
  ```
