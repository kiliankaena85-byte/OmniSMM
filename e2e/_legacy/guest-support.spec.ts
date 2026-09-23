import { test, expect } from '@playwright/test';

test.describe('Guest Support Flow', () => {

  test('Guest can create an email ticket', async ({ page }) => {
    // 1. Go to landing page
    await page.goto('/');
    
    // 2. Navigate to Support page
    // The link might be in footer or header
    await page.goto('/support');
    
    // 3. Verify we are on support page
    await expect(page.getByText(/Служба поддержки/i).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Написать на Email/i).first()).toBeVisible();

    // 4. Fill the ticket form
    // Since getByLabel can be brittle if aria-labels are missing, we can use placeholder or name
    await page.locator('input[name="email"]').fill('e2e-tester@test.com');
    await page.locator('textarea[name="message"]').fill('Hello, this is an automated E2E test ticket.');
    
    // 5. Submit
    await page.getByRole('button', { name: /Отправить обращение/i }).click();
    
    // 6. Verify success
    await expect(page.getByText(/Запрос отправлен!/i).first()).toBeVisible({ timeout: 10000 });
  });
});
