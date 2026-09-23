import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

// Clean context (no global setup cookies)
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('E2E Registration and Ordering Flow', () => {
  const prisma = new PrismaClient();
  const testEmail = `e2e-reg-order-${Date.now()}@smmplan.local`;
  const testPassword = 'Password123!';
  const targetServiceId = 'cmr5dn1mu00q4ljachnhb3dnw'; // Telegram Просмотры поста [Медленные]
  const targetCategoryName = '👁 Просмотры / Охват';
  const targetLink = 'https://t.me/durov/123';
  const quantity = 100;
  const artifactDir = 'd:/SMM_plan_2/artifacts';

  test.beforeAll(async () => {
    fs.mkdirSync(artifactDir, { recursive: true });

    // Clear rate limits in DB and Redis
    await prisma.rateLimit.deleteMany({}).catch(() => {});
    try {
      const { Redis } = await import('ioredis');
      const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
      await redis.flushdb().catch(() => {});
      await redis.quit().catch(() => {});
    } catch (e) {
      // Ignored
    }

    // 1. Ensure target service exists and is active
    const service = await prisma.service.findUnique({
      where: { id: targetServiceId }
    });
    if (!service || !service.isActive) {
      throw new Error(`Target service ${targetServiceId} not found or inactive`);
    }

    // 2. Ensure test user does not exist
    const oldUser = await prisma.user.findFirst({ where: { email: testEmail } });
    if (oldUser) {
      await prisma.order.deleteMany({ where: { userId: oldUser.id } }).catch(() => {});
      await prisma.payment.deleteMany({ where: { userId: oldUser.id } }).catch(() => {});
      await prisma.ledgerEntry.deleteMany({ where: { userId: oldUser.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: oldUser.id } }).catch(() => {});
    }
  });

  test.afterAll(async () => {
    // Cleanup
    const user = await prisma.user.findFirst({
      where: { email: testEmail }
    });
    if (user) {
      await prisma.order.deleteMany({ where: { userId: user.id } }).catch(() => {});
      await prisma.payment.deleteMany({ where: { userId: user.id } }).catch(() => {});
      await prisma.ledgerEntry.deleteMany({ where: { userId: user.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  test('Registration, login, ordering, and balance payment', async ({ page }) => {
    page.on('console', msg => console.log('[BROWSER LOG]', msg.text()));
    page.on('pageerror', err => console.error('[BROWSER ERROR]', err.message));
    // --- 1. Registration ---
    await page.goto('/login');
    await page.getByRole('button', { name: 'Регистрация' }).click();

    // Take screenshot: registration_page.png
    await page.screenshot({ path: path.join(artifactDir, 'registration_page.png') });

    await page.locator('#register-email').fill(testEmail);
    await page.locator('#register-password').fill(testPassword);
    await page.getByRole('button', { name: 'Создать аккаунт' }).click();

    // Verify switched back to login (by checking that the login email field becomes visible)
    await expect(page.locator('#login-email')).toBeVisible({ timeout: 10000 });

    // --- 2. Seed Balance and Verify Email ---
    await prisma.user.update({
      where: { email: testEmail },
      data: {
        isEmailVerified: true,
        balance: 500000 // 5000 RUB in cents
      }
    });

    // --- 3. Login ---
    await page.locator('#login-email').fill(testEmail);
    await page.locator('#login-password').fill(testPassword);
    await page.getByRole('button', { name: 'Войти в кабинет' }).click();

    // Verify redirected to dashboard
    await expect(page).toHaveURL(/.*dashboard/);

    // Take screenshot: cabinet_dashboard.png
    await page.screenshot({ path: path.join(artifactDir, 'cabinet_dashboard.png') });

    // --- 4. Place Order ---
    await page.goto('/dashboard/new-order');
    await expect(page.locator('h1', { hasText: 'Новый заказ' })).toBeVisible();

    const textarea = page.getByPlaceholder('Вставьте ссылку или сразу несколько');
    await expect(textarea).toBeVisible();
    await textarea.fill(targetLink);

    // Click "+ Добавить" button
    await page.getByRole('button', { name: '+ Добавить' }).click();

    // Wait for the accordion and select to stabilize
    await page.waitForTimeout(1000);

    // Click Category Select using label container (specifically within the category block)
    const categorySelect = page.locator('label:text-is("Категория")').locator('xpath=..').locator('button').first();
    await expect(categorySelect).toBeVisible({ timeout: 10000 });
    console.log('[E2E] Category Select HTML:', await categorySelect.evaluate(el => el.outerHTML));
    
    // Open Select dropdown
    await categorySelect.click({ force: true });
    await page.waitForTimeout(1000);

    // Let's get the options
    const options = page.getByRole('option');
    let optionCount = await options.count();
    console.log(`[E2E] After click, found ${optionCount} options in category select`);
    
    if (optionCount === 0) {
      console.log('[E2E] Dropdown not open. Trying click on text inside button...');
      await page.locator('button:has-text("Звезды")').first().click({ force: true });
      await page.waitForTimeout(1000);
      optionCount = await options.count();
      console.log(`[E2E] After second attempt, found ${optionCount} options`);
    }

    if (optionCount === 0) {
      console.log('[E2E] Dropdown still not open. Trying dispatch click event...');
      await categorySelect.evaluate(el => {
        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        (el as any).click();
      });
      await page.waitForTimeout(1000);
      optionCount = await options.count();
      console.log(`[E2E] After dispatch event, found ${optionCount} options`);
    }

    for (let i = 0; i < optionCount; i++) {
      console.log(`[E2E] Option ${i}: ${await options.nth(i).textContent()}`);
    }

    await page.getByRole('option', { name: targetCategoryName }).first().click();

    // Click Service Select using label container (specifically within the service block)
    const serviceSelect = page.locator('label:text-is("Услуга")').locator('xpath=..').locator('button').first();
    await expect(serviceSelect).toBeVisible({ timeout: 10000 });
    console.log('[E2E] Service Select HTML:', await serviceSelect.evaluate(el => el.outerHTML));

    await serviceSelect.click({ force: true });
    await page.waitForTimeout(1000);

    const svcOptions = page.getByRole('option');
    let svcOptionCount = await svcOptions.count();
    console.log(`[E2E] After click, found ${svcOptionCount} options in service select`);

    if (svcOptionCount === 0) {
      console.log('[E2E] Service dropdown not open. Trying dispatch event...');
      await serviceSelect.evaluate(el => {
        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        (el as any).click();
      });
      await page.waitForTimeout(1000);
      svcOptionCount = await svcOptions.count();
      console.log(`[E2E] After dispatch event, found ${svcOptionCount} options in service select`);
    }

    for (let i = 0; i < svcOptionCount; i++) {
      console.log(`[E2E] Service Option ${i}: ${await svcOptions.nth(i).textContent()}`);
    }

    await page.getByRole('option', { name: /Telegram Просмотры поста/ }).first().click();

    // Fill quantity
    const qtyInput = page.locator('input[type="number"]');
    await qtyInput.fill(quantity.toString());

    // Enter email in footer
    const footerEmail = page.locator('input[placeholder="Ваш email"]');
    await expect(footerEmail).toBeVisible();
    await footerEmail.fill(testEmail);

    // Select Balance Payment Gateway using label container (specifically within the payment block)
    const gatewaySelect = page.locator('label:text-is("Способ оплаты")').locator('xpath=..').locator('button').first();
    await expect(gatewaySelect).toBeVisible({ timeout: 10000 });
    console.log('[E2E] Gateway Select HTML:', await gatewaySelect.evaluate(el => el.outerHTML));

    await gatewaySelect.click({ force: true });
    await page.waitForTimeout(1000);

    const gwOptions = page.getByRole('option');
    let gwOptionCount = await gwOptions.count();
    console.log(`[E2E] After click, found ${gwOptionCount} options in gateway select`);

    if (gwOptionCount === 0) {
      console.log('[E2E] Gateway dropdown not open. Trying dispatch event...');
      await gatewaySelect.evaluate(el => {
        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        (el as any).click();
      });
      await page.waitForTimeout(1000);
      gwOptionCount = await gwOptions.count();
      console.log(`[E2E] After dispatch event, found ${gwOptionCount} options in gateway select`);
    }

    for (let i = 0; i < gwOptionCount; i++) {
      console.log(`[E2E] Gateway Option ${i}: ${await gwOptions.nth(i).textContent()}`);
    }

    await page.getByRole('option', { name: /Баланс/ }).first().click();

    // Take screenshot: order_form_filled.png
    await page.screenshot({ path: path.join(artifactDir, 'order_form_filled.png') });

    // Click pay
    const payBtn = page.getByRole('button', { name: 'Оплатить' });
    await expect(payBtn).toBeEnabled();
    await payBtn.click();

    // Wait for redirection back to success with orderId or paymentId query param
    await page.waitForURL(/.*success\?(orderId|paymentId)=.*/, { timeout: 15000 });
    
    // Take screenshot: order_placed_success.png
    await page.screenshot({ path: path.join(artifactDir, 'order_placed_success.png') });

    // Verify order exists in the DB
    const dbUser = await prisma.user.findUnique({
      where: { email: testEmail }
    });
    expect(dbUser).toBeTruthy();
    const dbOrder = await prisma.order.findFirst({
      where: { userId: dbUser!.id }
    });
    expect(dbOrder).toBeTruthy();
    expect(dbOrder!.status).toBe('PENDING');
  });
});
