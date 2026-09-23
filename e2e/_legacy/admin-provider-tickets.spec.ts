import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

test.describe('Admin Provider Support Links Flow', () => {
  let prisma: PrismaClient;

  test.beforeAll(async () => {
    prisma = new PrismaClient();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('Admin can see support links and copy external ID on click', async ({ page, context }) => {
    // 1. Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    // 2. Prepare test data
    const testEmail = 'support-links-tester@test.com';
    let testUser = await prisma.user.findFirst({ where: { email: testEmail } });
    if (!testUser) {
      testUser = await prisma.user.create({
        data: { email: testEmail, tenantId: 'smmplan', balance: 100000, role: 'USER' }
      });
    }

    const providerName = 'Vexboost Test E2E Provider';
    let provider = await prisma.provider.findFirst({ where: { name: providerName } });
    if (!provider) {
      provider = await prisma.provider.create({
        data: {
          name: providerName,
          apiUrl: 'https://vexboost.ru/api/v2/',
          apiKey: 'fake_api_key_for_test',
          isActive: true,
          ticketUrl: 'https://vexboost.ru/tickets/'
        }
      });
    } else {
      provider = await prisma.provider.update({
        where: { id: provider.id },
        data: { ticketUrl: 'https://vexboost.ru/tickets/' }
      });
    }

    let category = await prisma.category.findFirst({ where: { name: 'E2E Support Category' } });
    if (!category) {
      category = await prisma.category.create({ data: { name: 'E2E Support Category', sort: 0 } });
    }

    let service = await prisma.service.findFirst({ where: { name: 'E2E Support Service' } });
    if (!service) {
      service = await prisma.service.create({
        data: {
          name: 'E2E Support Service',
          categoryId: category.id,
          providerId: provider.id,
          rate: 5.0,
          minQty: 10,
          maxQty: 1000,
          isActive: true,
          externalId: '1001'
        }
      });
    } else {
      service = await prisma.service.update({
        where: { id: service.id },
        data: { providerId: provider.id }
      });
    }

    const externalId = 'ext_e2e_ticket_12345';
    const testOrder = await prisma.order.create({
      data: {
        userId: testUser.id,
        serviceId: service.id,
        providerId: provider.id,
        link: 'https://t.me/e2e_support_links_test',
        quantity: 100,
        charge: 500,
        providerCost: 200,
        status: 'IN_PROGRESS',
        externalId: externalId
      }
    });

    // Cleanup page error / console error checks
    page.on('pageerror', error => console.error('PAGE ERROR:', error));

    try {
      // 3. Navigate to orders page
      await page.goto('/admin/orders');
      await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });

      // 4. Search for the test order
      const searchInput = page.getByPlaceholder('🔍 Поиск (пример: подписчики -bot)');
      await expect(searchInput).toBeVisible();
      await searchInput.fill('E2E Support Service');
      await page.getByRole('button', { name: 'Найти' }).click();

      // Ensure the order row is visible
      const orderRow = page.locator('tr', { hasText: 'e2e_support_links_test' });
      await expect(orderRow).toBeVisible();

      // 5. Expand details
      const detailsBtn = orderRow.getByText('Показать детали');
      await expect(detailsBtn).toBeVisible();
      await detailsBtn.click();

      // 6. Verify "Поддержка" link next to provider name
      const supportLink = orderRow.getByRole('link', { name: 'Поддержка ↗' });
      await expect(supportLink).toBeVisible();
      await expect(supportLink).toHaveAttribute('href', 'https://vexboost.ru/tickets/');

      // 7. Verify "Тикет" button next to provider ID
      const ticketBtn = orderRow.getByRole('button', { name: 'Тикет ↗' });
      await expect(ticketBtn).toBeVisible();

      // 8. Click "Тикет ↗" and verify clipboard/toast
      // Note: Click triggers popup, let's catch the popup to prevent it from hanging or opening browser tab
      const [popup] = await Promise.all([
        page.waitForEvent('popup'),
        ticketBtn.click()
      ]);
      await popup.close();

      // Verify success toast
      await expect(page.getByText(`Внешний ID (${externalId}) скопирован в буфер обмена!`).first()).toBeVisible({ timeout: 10000 });

      // Verify clipboard value
      const clipboardValue = await page.evaluate(async () => {
        return await navigator.clipboard.readText();
      });
      expect(clipboardValue).toBe(externalId);

    } finally {
      // 9. Cleanup database
      await prisma.order.deleteMany({ where: { userId: testUser.id } });
      await prisma.service.deleteMany({ where: { id: service.id } });
      await prisma.category.deleteMany({ where: { id: category.id } });
      await prisma.provider.deleteMany({ where: { id: provider.id } });
      await prisma.user.deleteMany({ where: { id: testUser.id } });
    }
  });
});
