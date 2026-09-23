import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

test.describe('Order Lifecycle', () => {

  test.beforeAll(async () => {
    const prisma = new PrismaClient();
    
    // Cleanup old test data (delete orders first to prevent foreign key violation)
    await prisma.order.deleteMany({ where: { service: { name: { startsWith: 'E2E ' } } } });
    await prisma.service.deleteMany({ where: { name: { startsWith: 'E2E ' } } });
    await prisma.category.deleteMany({ where: { name: { startsWith: 'E2E ' } } });

    // Ensure network exists
    let network = await prisma.network.findUnique({ where: { slug: 'telegram' } });
    if (!network) {
      network = await prisma.network.create({ data: { name: 'Telegram', slug: 'telegram' } });
    }
    
    // Ensure category exists
    let category = await prisma.category.findFirst({ where: { name: 'E2E Telegram Subscribers' } });
    if (!category) {
      category = await prisma.category.create({
        data: {
          name: 'E2E Telegram Subscribers',
          networkId: network.id
        }
      });
    }

    // Ensure provider exists
    let provider = await prisma.provider.findFirst({ where: { name: 'E2E Test Provider' } });
    if (!provider) {
      provider = await prisma.provider.create({
        data: { name: 'E2E Test Provider', apiUrl: 'http://test.local', apiKey: 'test_key' }
      });
    }

    // Ensure service exists
    const service = await prisma.service.findFirst({ where: { name: 'E2E Telegram Service' } });
    if (!service) {
      await prisma.service.create({
        data: {
          name: 'E2E Telegram Service',
          categoryId: category.id,
          providerId: provider.id,
          rate: 10.0,
          markup: 50.0,
          minQty: 10,
          maxQty: 10000,
          isQuarantined: false,
          isActive: true,
          externalId: '101',
          targetType: 'CHANNEL'
        }
      });
    }

    await prisma.$disconnect();
  });

  test('User can create a new order via SmartOrderForm', async ({ page }) => {
    // 1. Listen to console logs
    page.on('console', msg => console.log(`[Browser]: ${msg.text()}`));
    
    // 1. Revalidate catalog cache to ensure newly seeded data is visible
    await page.request.get('/api/debug?revalidate=catalog');
    
    // 2. Visit the order page
    await page.goto('/dashboard/new-order');
    
    // Ensure the main layout and input renders
    await expect(page.locator('h1', { hasText: 'Новый заказ' })).toBeVisible();
    
    // 1. Input a URL
    const urlInput = page.locator('input#order-url');
    await expect(urlInput).toBeVisible();
    await urlInput.fill('https://t.me/durov');

    // 2. Wait for categories/services to load and verify the first service option is auto-selected
    // Ensure we are in the correct category (auto-selection might pick 'Stars' or something else if it exists)
    const categoryTab = page.getByRole('tab', { name: /E2E Telegram Subscribers/i });
    await expect(categoryTab).toBeVisible({ timeout: 10000 });
    await categoryTab.click();

    // It should fetch data based on link analysis
    const serviceOption = page.getByRole('option', { name: /E2E Telegram Service/i });
    await expect(serviceOption).toBeVisible({ timeout: 15000 });
    
    // Wait for the option to be auto-selected by the hook logic
    await expect(serviceOption).toHaveAttribute('aria-selected', 'true', { timeout: 5000 });

    // 3. The checkout form should now appear on the right
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await emailInput.fill('e2e-tester@test.com');

    // 4. Quantity Input check
    const qtyInput = page.locator('input[type="number"]');
    await expect(qtyInput).toBeVisible();
    const initialQty = await qtyInput.inputValue();
    expect(Number(initialQty)).toBeGreaterThan(0);

    // 5. Select Balance Gateway
    const balanceBtn = page.getByRole('button', { name: /Баланс/i });
    await expect(balanceBtn).toBeVisible();
    await balanceBtn.click();

    // 7. Verify the submit button is enabled
    const submitBtn = page.getByRole('button', { name: /Создать заказ и перейти к оплате/i });
    await expect(submitBtn).toBeEnabled();
    
    // Wait for calculations to finish
    await expect(page.getByText('Считаем...')).toBeHidden();

    // Proceed to checkout
    await submitBtn.click();
    
    // Check for any form errors
    const errorMsg = page.locator('p.text-red-500[role="alert"]');
    if (await errorMsg.isVisible({ timeout: 2000 }).catch(() => false)) {
      const text = await errorMsg.textContent();
      throw new Error(`Order submission failed with UI error: ${text}`);
    }

    // We should be redirected to the success page (e.g., /dashboard/orders or a success screen)
    await expect(page).toHaveURL(/dashboard\/orders|success/, { timeout: 30000 });
  });

});
