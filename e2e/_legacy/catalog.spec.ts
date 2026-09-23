import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

test.describe('Catalog & Pricing Flow', () => {

  test('Admin cannot set margin below breakeven (Safety Floor)', async ({ page }) => {
    // 1. Seed a test service with 10.00 rate
    const prisma = new PrismaClient();
    let network = await prisma.network.findUnique({ where: { slug: 'telegram' } });
    if (!network) {
      network = await prisma.network.create({ data: { name: 'Telegram', slug: 'telegram' } });
    }

    let category = await prisma.category.findFirst({ where: { name: 'E2E Test Category' } });
    if (!category) {
      category = await prisma.category.create({ data: { name: 'E2E Test Category', sort: 999, networkId: network.id } });
    }

    let provider = await prisma.provider.findFirst({ where: { name: 'E2E Test Provider' } });
    if (!provider) {
      provider = await prisma.provider.create({ data: { name: 'E2E Test Provider', apiUrl: 'http://test.local', apiKey: 'test_key' } });
    }

    let service = await prisma.service.findFirst({ where: { name: 'E2E Test Safety Floor Service' } });
    if (!service) {
      // eslint-disable-next-line no-useless-assignment
      service = await prisma.service.create({
        data: {
          name: 'E2E Test Safety Floor Service',
          categoryId: category.id,
          providerId: provider.id,
          rate: 10.0,
          markup: 2.0,
          minQty: 10,
          maxQty: 1000
        }
      });
    } else {
      // eslint-disable-next-line no-useless-assignment
      service = await prisma.service.update({
        where: { id: service.id },
        data: { rate: 10.0, markup: 2.0 }
      });
    }

    await prisma.$disconnect();

    // 2. Go to Catalog
    await page.goto('/admin/catalog');

    // 3. Find our specific row in the table
    // It might be paginated, so search for it
    const searchInput = page.locator('input[placeholder*="Название или ID"], input[name="q"]').first();
    await expect(searchInput).toBeVisible({ timeout: 15000 });
    await searchInput.fill('E2E Test Safety Floor Service');
    await searchInput.press('Enter');
    await page.waitForTimeout(500); // Wait for debounce / reload

    const row = page.locator('tr').filter({ hasText: 'E2E Test Safety Floor Service' });
    await expect(row).toBeVisible({ timeout: 15000 });

    // 4. Try to edit the price to 1 RUB (which is extremely low and guarantees < SAFETY_MULTIPLIER)
    const priceInput = row.locator('input[type="number"]').first();
    await expect(priceInput).toBeVisible();

    await priceInput.fill('1');
    await priceInput.blur(); // Trigger save or validation

    // 5. Verify the safety floor rejects it
    await expect(page.getByText(/Ошибка маржинальности/i).first()).toBeVisible({ timeout: 5000 });
    
    // Original value should be restored or at least not saved as 0.5
    // Need to verify it resets to 2.00 or the UI shows an error state.
  });

});
