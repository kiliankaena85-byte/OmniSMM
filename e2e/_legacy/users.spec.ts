import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

test.describe('Users Management Flow', () => {

  test('Admin can manually adjust user balance', async ({ page }) => {
    // 1. Prepare test user
    const prisma = new PrismaClient();
    const testEmail = 'balance-tester-e2e@test.com';
    let testUser = await prisma.user.findFirst({ where: { email: testEmail } });
    if (!testUser) {
      // eslint-disable-next-line no-useless-assignment
      testUser = await prisma.user.create({
        data: { email: testEmail, tenantId: 'smmplan', balance: 0, role: 'USER' }
      });
    } else {
      // eslint-disable-next-line no-useless-assignment
      testUser = await prisma.user.update({
        where: { id: testUser.id },
        data: { balance: 0 }
      });
    }

    // 2. Go directly to Client detail page
    await page.goto(`/admin/clients/${testUser.id}`);
    
    // Wait for the UI to load inside the page
    const amountInput = page.locator('input[placeholder*="Пример: 500"], input[type="number"]').first();
    await expect(amountInput).toBeVisible({ timeout: 15000 });

    // 3. Fill amount and reason
    await amountInput.fill('500'); // 500 RUB
    await page.locator('input[name="reason"], textarea[name="reason"]').first().fill('TEST_REWARD');

    // 4. Submit form to open modal
    await page.getByRole('button', { name: 'Применить изменение' }).click();

    // 5. Click 'Продолжить' in the confirmation modal
    const confirmModalBtn = page.getByRole('button', { name: 'Продолжить' });
    await expect(confirmModalBtn).toBeVisible({ timeout: 5000 });
    await confirmModalBtn.click();

    // 6. Verify balance in UI reflects 500.00
    // Because the UI formats 50000 kopecks as '500.00 ₽'
    await expect(page.getByText('500.00 ₽').first()).toBeVisible({ timeout: 15000 });
    
    await prisma.$disconnect();
  });

});
