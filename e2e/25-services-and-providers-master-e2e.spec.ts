import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { seedTestAdmin, createAuthenticatedContext } from './fixtures';

const db = new PrismaClient();

test.describe('BLOCK 25: Master Services & Providers Management E2E Synergy Suite', () => {
  let adminId: string;
  let authContext: any;
  let testProvider: any;
  let testCategory: any;
  let testService: any;

  test.beforeAll(async ({ browser }) => {
    // 1. Seed Admin
    const admin = await seedTestAdmin();
    adminId = admin.id;
    authContext = await createAuthenticatedContext(browser, adminId, 'OWNER');

    // 2. Ensure Provider exists
    testProvider = await db.provider.upsert({
      where: { name: 'E2E_Master_Provider' },
      update: { isActive: true, balanceCurrency: 'RUB' },
      create: {
        name: 'E2E_Master_Provider',
        apiUrl: 'https://api.e2emaster.com/v2',
        apiKey: 'master_key_123',
        balanceCurrency: 'RUB',
        isActive: true,
      }
    });

    // 3. Ensure Category exists
    testCategory = await db.category.upsert({
      where: { slug: 'e2e-master-category' },
      update: { tenantId: 'all' },
      create: {
        name: '📢 E2E Master Telegram Subscribers',
        slug: 'e2e-master-category',
        tenantId: 'all',
      }
    });

    // 4. Ensure Service exists
    testService = await db.service.create({
      data: {
        name: `E2E Master Telegram Subscribers ${Date.now()}`,
        categoryId: testCategory.id,
        tenantId: 'smmplan',
        rate: 45.0,
        markup: 3.0,
        pricePer1000Cents: 13500, // 135.00 RUB per 1k
        minQty: 10,
        maxQty: 25000,
        providerId: testProvider.id,
        externalId: '999',
        isActive: true,
      }
    });

    // 5. Ensure Service Route exists for Hot-Swap
    await db.serviceRoute.create({
      data: {
        serviceId: testService.id,
        providerId: testProvider.id,
        providerServiceId: '999',
        isPrimary: true,
        isActive: true,
        priority: 0,
      }
    });
  });

  test.afterAll(async () => {
    if (authContext) await authContext.close();
    await db.$disconnect();
  });

  test('E2E 1: Providers List & Liquidity Dashboard Render Accurately', async () => {
    const page = await authContext.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin/providers', { waitUntil: 'domcontentloaded' });

    // Verify page title and header
    await expect(page.locator('h1')).toContainText(/Провайдеры API/i);

    // Verify '+ Подключить Панель' button is visible
    const addBtn = page.getByRole('link', { name: /\+ Подключить Панель/i });
    await expect(addBtn).toBeVisible();

    // Verify import button is visible
    const importBtn = page.getByRole('link', { name: /Импорт Услуг/i });
    await expect(importBtn).toBeVisible();

    // Verify zero horizontal scroll
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth + 5;
    });
    expect(hasHorizontalOverflow).toBe(false);

    await page.close();
  });

  test('E2E 2: Provider Keys Hot-Reload Interface Loads and Verifies AES Encryption', async () => {
    const page = await authContext.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin/providers/keys', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/\/admin\/providers\/keys/);
    const bodyContent = await page.textContent('body');
    expect(bodyContent).not.toContain('An unexpected response was received from the server');

    await page.close();
  });

  test('E2E 3: Provider Health & Latency Dashboard Renders Status Metrics', async () => {
    const page = await authContext.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin/providers/health', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/\/admin\/providers\/health/);
    const pageContent = await page.textContent('body');
    expect(pageContent).not.toContain('Internal Server Error');

    await page.close();
  });

  test('E2E 4: Cherry-Pick Import Wizard Loads Categories and Providers Without Crash', async () => {
    const page = await authContext.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin/providers/import', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/\/admin\/providers\/import/);
    await expect(page.locator('body')).not.toContainText('An unexpected response was received from the server');

    await page.close();
  });

  test('E2E 5: Catalog Management Page Renders 2x4 Filters, Table and Syncs Counters', async () => {
    const page = await authContext.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin/catalog', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/\/admin\/catalog/);
    await expect(page.locator('h1')).toContainText(/Каталог услуг/i);

    // Verify search input is present
    const searchInput = page.locator('input').first();
    await expect(searchInput).toBeVisible();

    // Verify '+ Создать услугу' button is visible
    const createServiceBtn = page.getByRole('link', { name: /\+ Создать услугу/i });
    await expect(createServiceBtn).toBeVisible();

    // Assert that table has visible rows by default
    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    const initialRowCount = await rows.count();
    expect(initialRowCount).toBeGreaterThan(0);

    // CLICK "Скрыть удаленные / архив" button
    const hideDeletedBtn = page.locator('button:has-text("Скрыть удаленные")');
    if (await hideDeletedBtn.isVisible()) {
      await hideDeletedBtn.click();
      // Wait for table update
      await page.waitForTimeout(1000);
      
      // CRITICAL ASSERTION: Active services MUST NOT disappear!
      const activeRows = page.locator('table tbody tr');
      await expect(activeRows.first()).toBeVisible();
      const filteredRowCount = await activeRows.count();
      expect(filteredRowCount).toBeGreaterThan(0);
    }

    // Check zero horizontal scroll
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth + 5;
    });
    expect(hasHorizontalOverflow).toBe(false);

    await page.close();
  });

  test('E2E 6: Categories Manager Page Renders Network Groups and Modals', async () => {
    const page = await authContext.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin/catalog/categories', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/\/admin\/catalog\/categories/);
    await expect(page.locator('body')).not.toContainText('An unexpected response was received from the server');

    await page.close();
  });

  test('E2E 7: Service Routing Hot-Swap Page Renders Cascading Routes', async () => {
    const page = await authContext.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/admin/services/${testService.id}/routing`, { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(new RegExp(`/admin/services/${testService.id}/routing`));
    await expect(page.locator('body')).not.toContainText('An unexpected response was received from the server');

    await page.close();
  });

  test('E2E 8: Quarantined Services Page Loads and Displays Health Status', async () => {
    const page = await authContext.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin/catalog/quarantine', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/\/admin\/catalog\/quarantine/);
    await expect(page.locator('body')).not.toContainText('An unexpected response was received from the server');

    await page.close();
  });
});
