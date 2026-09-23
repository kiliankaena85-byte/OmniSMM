import { test, expect } from '@playwright/test';
import { seedTestAdmin, createAuthenticatedContext } from './fixtures';

test.describe('BLOCK 27: Test vs Live Mode Toggle, Panel Assertions & Nuclear Cleanup Suite', () => {
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

  test('Vector 1: TestModePanel Visibility & Dual-Mode Status Indicator in /admin/settings', async () => {
    const page = await authContext.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin/settings?tab=system', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/\/admin\/settings/);

    // 1. Assert panel headline is visible
    const testModeHeadline = page.locator('h3:has-text("Тестовый режим"), h3:has-text("Боевой режим")');
    await expect(testModeHeadline.first()).toBeVisible({ timeout: 15000 });

    // 2. Assert toggle switch is rendered
    const toggleBtn = page.locator('button:has(span.rounded-full)');
    await expect(toggleBtn.first()).toBeVisible();

    await page.close();
  });

  test('Vector 2: Nuclear Test Data Cleanup Modal Lifecycle (Open -> Inspect Confirmation -> Dismiss)', async () => {
    const page = await authContext.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin/settings?tab=system', { waitUntil: 'domcontentloaded' });

    // 1. Locate "Очистить тестовые данные" button (if in Test Mode)
    const clearBtn = page.locator('button:has-text("Очистить тестовые данные")');
    const isClearBtnVisible = await clearBtn.isVisible().catch(() => false);

    if (isClearBtnVisible) {
      await clearBtn.click();

      // 2. Assert ConfirmModal appears
      const dialog = page.getByRole('dialog', { name: 'Очистить тестовые данные' });
      await expect(dialog).toBeVisible();

      const modalDesc = dialog.locator('text=Все тестовые заказы будут БЕЗВОЗВРАТНО удалены');
      await expect(modalDesc).toBeVisible();

      // 3. Dismiss via "Отмена"
      const cancelBtn = dialog.locator('button:has-text("Отмена")');
      await cancelBtn.click();
      await expect(dialog).not.toBeVisible();
    }

    await page.close();
  });
});
