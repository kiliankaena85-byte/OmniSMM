import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Fresh unauthenticated context — ignore default user.json storageState
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Password Auth Flow (Dynamic E2E Tests)', () => {
  const testEmail = `dynamic-user-${Date.now()}@smmplan.local`;
  const testPassword = 'SecurePassword123!';

  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test.afterAll(async () => {
    // Clean up created user
    await prisma.user.deleteMany({
      where: { email: { in: [testEmail, 'blocked-auth-user@smmplan.local'] } },
    });
    await prisma.$disconnect();
  });

  test('Guest can register with password, switch to login tab, and log in successfully', async ({ page }) => {
    // 1. Go to login page
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    // 2. Click on the "Регистрация" tab button
    const regTab = page.locator('button:has-text("Регистрация")').last();
    await regTab.click();

    // 3. Fill registration details
    await page.locator('#register-email').fill(testEmail);
    await page.locator('#register-password').fill(testPassword);

    // 4. Submit registration
    await page.getByRole('button', { name: 'Создать аккаунт' }).click();

    // 5. Switch to password login tab
    const loginTab = page.locator('button:has-text("Войти по паролю")').first();
    await loginTab.click();

    // 6. Fill login details with newly created user
    await page.locator('#login-email').fill(testEmail);
    await page.locator('#login-password').fill(testPassword);

    // 7. Submit login
    await page.getByRole('button', { name: 'Войти в кабинет' }).click();

    // 8. Should redirect to dashboard
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 20000 });
  });

  test('Password login prevents blocked / inactive users from accessing dashboard', async ({ page }) => {
    // 1. Pre-create a blocked user in DB
    const blockedEmail = 'blocked-auth-user@smmplan.local';
    await prisma.user.upsert({
      where: { email_tenantId: { email: blockedEmail, tenantId: 'smmplan' } },
      update: { isActive: false, isDeleted: true },
      create: {
        email: blockedEmail,
        tenantId: 'smmplan',
        isActive: false,
        isDeleted: true,
        role: 'USER',
      },
    });

    // 2. Try logging in as the blocked user
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    const loginTab = page.locator('button:has-text("Войти по паролю")').first();
    if (await loginTab.isVisible()) {
      await loginTab.click();
    }

    await page.locator('#login-email').fill(blockedEmail);
    await page.locator('#login-password').fill('SomePassword123!');
    await page.getByRole('button', { name: 'Войти в кабинет' }).click();

    // 3. Page should remain on /login
    await expect(page).toHaveURL(/.*login/);
  });
});
