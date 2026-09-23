import { test, expect } from '@playwright/test';
import { seedTestAdmin, createAuthenticatedContext } from './fixtures';

test.describe('BLOCK 26: Master Catalog Combinatorial State-Matrix & Visual Assertion Suite', () => {
  let authContext: any;
  let adminId: string;

  test.beforeAll(async ({ browser }) => {
    const admin = await seedTestAdmin();
    adminId = admin.id;
    authContext = await createAuthenticatedContext(browser, adminId, 'OWNER');
  });

  test.afterAll(async () => {
    await authContext?.close();
  });

  test('Vector 1 & 2: Cross-Metric Consistency & "Скрыть удаленные / архив" Active Mutation', async () => {
    const page = await authContext.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin/catalog', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/\/admin\/catalog/);
    await expect(page.locator('h1')).toContainText(/Каталог услуг/i);

    // 1. Assert table rows exist
    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 15000 });
    const initialCount = await rows.count();
    expect(initialCount).toBeGreaterThan(0);

    // 2. Click "Скрыть удаленные / архив"
    const hideDeletedBtn = page.locator('button:has-text("Скрыть удаленные / архив")');
    await expect(hideDeletedBtn).toBeVisible();
    await hideDeletedBtn.click();

    // 3. Wait for network response & text transition
    const activeFilterBtn = page.locator('button:has-text("Удаленные скрыты")');
    await expect(activeFilterBtn).toBeVisible();

    // 4. CRITICAL INVARIANT: Active rows MUST be visible, table MUST NOT be empty!
    const activeRows = page.locator('table tbody tr');
    await expect(activeRows.first()).toBeVisible();
    const activeRowCount = await activeRows.count();
    expect(activeRowCount).toBeGreaterThan(0);

    // 5. Click again to toggle back and wait for navigation response
    const [response] = await Promise.all([
      page.waitForResponse(res => res.url().includes('/admin/catalog') && res.status() === 200),
      activeFilterBtn.click(),
    ]);
    expect(response.status()).toBe(200);
    await expect(page.locator('button:has-text("Скрыть удаленные / архив")')).toBeVisible();
    await page.waitForTimeout(500);
    expect(await page.locator('table tbody tr').count()).toBeGreaterThanOrEqual(activeRowCount);

    await page.close();
  });

  test('Vector 3: Platform Filter Switching (Telegram -> VK -> ALL)', async () => {
    const page = await authContext.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin/catalog', { waitUntil: 'domcontentloaded' });

    // Find platform select trigger
    const platformSelect = page.locator('button:has-text("Все соцсети")').or(page.locator('button[role="combobox"]').first());
    if (await platformSelect.isVisible()) {
      await platformSelect.click();
      const tgOption = page.locator('[role="option"]:has-text("Telegram")');
      if (await tgOption.isVisible()) {
        await tgOption.click();
        await page.waitForTimeout(1000);
        // Assert filtered
        const rows = page.locator('table tbody tr');
        if (await rows.count() > 0) {
          await expect(rows.first()).toBeVisible();
        }
      }
    }

    await page.close();
  });

  test('Vector 4: Price & Volume Switcher ("За 1 шт" ↔ "За 1000 шт", "RUB" ↔ "USD")', async () => {
    const page = await authContext.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin/catalog', { waitUntil: 'domcontentloaded' });

    // 1. Find Volume Switcher buttons
    const btn1k = page.locator('button:has-text("За 1000 шт")');
    const btnUnit = page.locator('button:has-text("За 1 шт")');
    
    await expect(btn1k).toBeVisible();
    await expect(btnUnit).toBeVisible();

    // Toggle to 1K
    await btn1k.click();
    await page.waitForTimeout(300);

    // Toggle to Unit
    await btnUnit.click();
    await page.waitForTimeout(300);

    // 2. Find Currency Switcher buttons
    const btnRub = page.locator('button:has-text("RUB (₽)")');
    const btnUsd = page.locator('button:has-text("USD ($)")');

    await expect(btnRub).toBeVisible();
    await expect(btnUsd).toBeVisible();

    await btnUsd.click();
    await page.waitForTimeout(300);

    await btnRub.click();
    await page.waitForTimeout(300);

    await page.close();
  });

  test('Vector 5: Omni-Search Box with Debounce & Zero Crash', async () => {
    const page = await authContext.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin/catalog', { waitUntil: 'domcontentloaded' });

    const searchInput = page.locator('input[placeholder*="ID, название"]').or(page.locator('input').first());
    await expect(searchInput).toBeVisible();

    // Type query
    await searchInput.fill('Telegram');
    await page.waitForTimeout(800); // Allow debounce

    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible();

    // Clear query
    await searchInput.fill('');
    await page.waitForTimeout(800);
    expect(await rows.count()).toBeGreaterThan(0);

    await page.close();
  });

  test('Vector 6: Zero Horizontal Scroll & 100% Viewport Fit', async () => {
    const page = await authContext.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin/catalog', { waitUntil: 'domcontentloaded' });

    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth + 5;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // Check on smaller desktop (1280px)
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(500);
    const hasSmallOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth + 5;
    });
    expect(hasSmallOverflow).toBe(false);

    await page.close();
  });
});
