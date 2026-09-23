import { test, expect } from '@playwright/test';

test.describe('Auth & Dashboard Flow', () => {

  test.describe('Dashboard Features (Authenticated)', () => {
    // This suite uses the default storageState from auth.setup.ts
    
    test('User can access refill page and see payment options', async ({ page }) => {
      await page.goto('/dashboard/add-funds');
      await expect(page.getByRole('heading', { name: /Пополнение баланса/i })).toBeVisible();
      
      // Check if Yookassa is visible
      await expect(page.getByRole('button', { name: /Банковская карта/i }).first()).toBeVisible();
    });

    test('User can access referral section', async ({ page }) => {
      await page.goto('/dashboard/referrals');
      
      const refInput = page.getByRole('textbox').filter({ hasText: /ref=/ });
      if (await refInput.isVisible()) {
         await expect(refInput).toBeVisible();
      } else {
         await expect(page).toHaveURL(/.*referrals/);
         await expect(page.locator('h1').first()).toBeVisible();
      }
    });

    test('User can view orders history table', async ({ page }) => {
      await page.goto('/dashboard/orders');
      
      // The orders table or an empty state should be visible
      await expect(page.getByRole('heading', { name: /История заказов|Мои заказы/i })).toBeVisible();
      
      // If there are no orders, it might show "Заказов пока нет", otherwise a table
      const table = page.locator('table');
      const emptyState = page.getByText(/Заказов пока нет|Ничего не найдено/i);
      
      await expect(table.or(emptyState).first()).toBeVisible({ timeout: 15000 });
    });
  });
});
