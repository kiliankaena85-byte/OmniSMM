import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

test.describe('Orders Management Flow', () => {
  let prisma: PrismaClient;

  test.beforeAll(async () => {
    prisma = new PrismaClient();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('Admin can perform partial refund via Order Drawer', async ({ page }) => {
    // 1. Prepare test user, service, and order
    const testEmail = 'order-tester-e2e@test.com';
    let testUser = await prisma.user.findFirst({ where: { email: testEmail } });
    if (!testUser) {
      testUser = await prisma.user.create({
        data: { email: testEmail, tenantId: 'smmplan', balance: 100000, role: 'USER' } // 1000 RUB
      });
    } else {
      testUser = await prisma.user.update({
        where: { email: testEmail },
        data: { balance: 100000 }
      });
    }

    // Prepare Category and Service
    let category = await prisma.category.findFirst({ where: { name: 'E2E Category' } });
    if (!category) {
      category = await prisma.category.create({ data: { name: 'E2E Category', sort: 0 } });
    }

    let service = await prisma.service.findFirst({ where: { name: 'E2E Service for Orders' } });
    if (!service) {
      service = await prisma.service.create({
        data: {
          name: 'E2E Service for Orders',
          categoryId: category.id,
          providerId: null,
          rate: 10000, // 100 RUB per 1000
          minQty: 10,
          maxQty: 10000,
          isActive: true
        }
      });
    }

    // Create a fresh test order (1000 quantity, 100 RUB charge)
    const testOrder = await prisma.order.create({
      data: {
        userId: testUser.id,
        serviceId: service.id,
        link: 'https://t.me/e2e_test_channel_123',
        quantity: 1000,
        charge: 10000, // 100 RUB
        providerCost: 5000, // 50 RUB
        status: 'IN_PROGRESS',
        remains: 0,
      }
    });

    // 2. Go to Orders page
    await page.goto(`/admin/orders`);
    await page.screenshot({ path: 'orders-error.png' });
    await expect(page.getByRole('heading', { name: 'Заказы', exact: true })).toBeVisible({ timeout: 15000 });

    // 3. Test Omni-search: filter by the specific link
    const searchInput = page.getByPlaceholder('Поиск: email, ссылка, ID заказа...');
    await searchInput.fill('e2e_test_channel_123');
    await page.getByRole('button', { name: 'Найти' }).click();
    await page.waitForTimeout(1000);
    
    // Ensure the order is visible
    await expect(page.getByText(testOrder.numericId.toString()).first()).toBeVisible();

    // 4. Open the Order Drawer
    await page.goto(`/admin/orders?edit_order_id=${testOrder.id}`);
    
    // Verify Drawer is open
    await expect(page.getByText(`Заказ #${testOrder.numericId}`)).toBeVisible();

    // 5. Change status to PARTIAL
    await page.getByRole('combobox', { name: /Выбор нового статуса заказа/i }).selectOption('PARTIAL');

    // 6. Enter remains (e.g. 500 out of 1000, which is exactly 50% refund -> 50 RUB)
    const remainsInput = page.getByRole('spinbutton', { name: /Остаток недоставленных единиц/i });
    await remainsInput.fill('500');

    // Wait for the UI to calculate the refund text
    await expect(page.getByText('Возврат: 50.00 ₽')).toBeVisible();

    // 7. Intercept confirmation dialog if there is any (actually there is none for setOrderStatusAction, only for cancelOrderAction)
    
    // 8. Submit
    await page.getByRole('button', { name: 'Применить новый статус' }).click();

    // 9. Verify success toast
    await expect(page.getByText(`✅ Статус #${testOrder.numericId} изменён. Возврат: 50.00 ₽`).first()).toBeVisible({ timeout: 10000 });

    // 10. Verify balance in DB updated correctly
    const updatedUser = await prisma.user.findUnique({ where: { id: testUser.id } });
    expect(updatedUser?.balance).toBe(BigInt(105000));

    // Verify order status in DB
    const updatedOrder = await prisma.order.findUnique({ where: { id: testOrder.id } });
    expect(updatedOrder?.status).toBe('PARTIAL');
    expect(updatedOrder?.remains).toBe(500);
  });

});
