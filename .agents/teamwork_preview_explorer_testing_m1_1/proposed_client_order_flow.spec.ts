import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

test.describe('Client Registration and Ordering Flow E2E', () => {
  const prisma = new PrismaClient();
  const testEmail = `e2e-reg-order-${Date.now()}@smmplan.local`;
  const testPassword = 'Password123!';
  const targetServiceId = 'cmr5dn1mu00q4ljachnhb3dnw'; // Telegram Просмотры поста [Медленные]
  const targetCategoryName = '👁 Просмотры / Охват';
  const targetLink = 'https://t.me/durov/123';
  const quantity = 100;

  test.beforeAll(async () => {
    // 1. Ensure the target service exists and is active in the database
    const service = await prisma.service.findUnique({
      where: { id: targetServiceId },
    });
    if (!service || !service.isActive) {
      throw new Error(`Prerequisites failed: Active service ID ${targetServiceId} not found in database.`);
    }

    // 2. Setup YooKassa mock credentials in settings
    await prisma.systemSettings.upsert({
      where: { id: 'global' },
      update: {
        yookassaShopId: 'test_shop_id',
        yookassaSecretKey: 'test_secret_key',
        isTestMode: true,
      },
      create: {
        id: 'global',
        yookassaShopId: 'test_shop_id',
        yookassaSecretKey: 'test_secret_key',
        isTestMode: true,
      },
    });
  });

  test.afterAll(async () => {
    // Cleanup created test user
    await prisma.user.deleteMany({
      where: { email: testEmail },
    });
    await prisma.$disconnect();
  });

  test('Guest can register, verify email, navigate to new order, and place an order using YooKassa test mode', async ({ page }) => {
    // --- 1. Registration ---
    await page.goto('/login');
    await page.getByRole('button', { name: 'Регистрация' }).click();

    await page.locator('#register-email').fill(testEmail);
    await page.locator('#register-password').fill(testPassword);
    await page.getByRole('button', { name: 'Создать аккаунт' }).click();

    // Verify registration switches back to the password login tab
    await expect(page.getByRole('button', { name: 'Войти по паролю' })).toHaveClass(/bg-card/);

    // --- 2. Email Verification Sim ---
    // In production env, we'd need to mock SMTP or read the rawToken, but here we can just use the verifySession helper or prisma update to activate email
    // Since we don't have the raw token in plaintext in the DB, we activate the email directly in DB so we can log in
    await prisma.user.update({
      where: { email: testEmail },
      data: { isEmailVerified: true },
    });

    // --- 3. Login ---
    await page.goto('/login');
    await page.locator('#login-email').fill(testEmail);
    await page.locator('#login-password').fill(testPassword);
    await page.getByRole('button', { name: 'Войти в кабинет' }).click();

    // Verify redirection to dashboard
    await expect(page).toHaveURL(/.*dashboard/);

    // --- 4. Navigation & Order Placement ---
    await page.goto('/dashboard/new-order');
    await expect(page.locator('h1', { hasText: 'Новый заказ' })).toBeVisible();

    // Paste link in text area
    const textarea = page.getByPlaceholder('Вставьте ссылку или сразу несколько');
    await expect(textarea).toBeVisible();
    await textarea.fill(targetLink);

    // Click "+ Добавить" button
    await page.getByRole('button', { name: '+ Добавить' }).click();

    // Accordion should appear and auto-expand
    const accordionHeader = page.locator('div[onClick]').first();
    await expect(accordionHeader).toBeVisible();

    // Wait for services to finish loading
    await expect(page.locator('text=-- Выберите услугу --')).toBeVisible();

    // Select category (SelectTrigger with placeholder "Выберите категорию")
    const categoryTrigger = page.getByRole('button', { name: 'Выберите категорию' });
    if (await categoryTrigger.isVisible()) {
      await categoryTrigger.click();
      await page.getByRole('option', { name: targetCategoryName }).click();
    }

    // Select the specific service
    const serviceTrigger = page.getByRole('button', { name: '-- Выберите услугу --' });
    await serviceTrigger.click();
    // Locate the select list item with target service name and click
    await page.getByRole('option', { name: /Telegram Просмотры поста/ }).click();

    // Fill quantity input
    const qtyInput = page.locator('input[type="number"]');
    await qtyInput.fill(quantity.toString());

    // Enter email in the sticky footer
    const footerEmail = page.locator('input[placeholder="Ваш email"]');
    await expect(footerEmail).toBeVisible();
    await footerEmail.fill(testEmail);

    // Choose payment method (YooKassa by default, or we can choose select item)
    // Intercept redirect to yookassa payment
    await page.route('**/api/dev/mock-payment*', route => route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<html><body>Mock YooKassa Payment Screen</body></html>',
    }));

    // Click "Оплатить" button
    const payBtn = page.getByRole('button', { name: 'Оплатить' });
    await expect(payBtn).toBeEnabled();
    await payBtn.click();

    // Verify it redirects to the mock payment screen / success page
    await page.waitForTimeout(2000);
    expect(page.url()).toContain('mock-payment');
  });
});
