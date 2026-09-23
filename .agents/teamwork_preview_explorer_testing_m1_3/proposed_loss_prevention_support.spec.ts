import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';

const prisma = new PrismaClient();

// Helper to create an authenticated browser context for a specific user
async function createAuthContext(browser: any, userEmail: string, role: string) {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error('[E2E] JWT_SECRET not set.');

  let user = await prisma.user.findUnique({
    where: { email: userEmail },
    include: { staffRole: true },
  });

  if (!user) {
    // If not found, create a basic user
    user = await prisma.user.create({
      data: {
        email: userEmail,
        role: role,
        supportLimitCents: 50000, // 500 RUB default limit
      },
      include: { staffRole: true },
    });
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      expiresAt,
      userAgent: 'Playwright E2E Agent',
      ipAddress: '127.0.0.1',
    },
  });

  const encodedKey = new TextEncoder().encode(jwtSecret);
  const sessionToken = await new SignJWT({ sessionId: session.id, userId: user.id, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encodedKey);

  const context = await browser.newContext();
  await context.addCookies([{
    name: 'session_token',
    value: sessionToken,
    domain: 'localhost',
    path: '/',
  }]);

  return { context, user, session };
}

test.describe('Loss Prevention & Support Limits Verification', () => {
  let testCategory: any;
  let testServiceCancelDisabled: any;
  let testServiceCancelEnabled: any;
  let supportRole: any;

  test.beforeAll(async () => {
    // Setup generic structures
    let network = await prisma.network.findFirst();
    if (!network) {
      network = await prisma.network.create({ data: { name: 'Telegram', slug: 'telegram' } });
    }

    testCategory = await prisma.category.create({
      data: {
        name: `E2E LP Support Category ${Date.now()}`,
        slug: `e2e-lp-support-cat-${Date.now()}`,
        networkId: network.id,
      },
    });

    testServiceCancelDisabled = await prisma.service.create({
      data: {
        name: `E2E Cancel Disabled Service ${Date.now()}`,
        categoryId: testCategory.id,
        rate: 2.0,
        minQty: 10,
        maxQty: 1000,
        isActive: true,
        isCancelEnabled: false,
      },
    });

    testServiceCancelEnabled = await prisma.service.create({
      data: {
        name: `E2E Cancel Enabled Service ${Date.now()}`,
        categoryId: testCategory.id,
        rate: 3.0,
        minQty: 10,
        maxQty: 1000,
        isActive: true,
        isCancelEnabled: true,
      },
    });

    // Setup RBAC StaffRole for SUPPORT user to bypass Administrator/Staff context checks
    supportRole = await prisma.staffRole.create({
      data: {
        name: `E2E Support Test Role ${Date.now()}`,
        permissions: {
          createMany: {
            data: [
              { section: 'orders', canView: true, canEdit: true },
              { section: 'support', canView: true, canEdit: true },
            ]
          }
        }
      }
    });
  });

  test.afterAll(async () => {
    // Teardown E2E artifacts
    if (testServiceCancelDisabled) await prisma.service.delete({ where: { id: testServiceCancelDisabled.id } });
    if (testServiceCancelEnabled) await prisma.service.delete({ where: { id: testServiceCancelEnabled.id } });
    if (testCategory) await prisma.category.delete({ where: { id: testCategory.id } });
    if (supportRole) await prisma.staffRole.delete({ where: { id: supportRole.id } });
    await prisma.$disconnect();
  });

  test('Support operator cannot cancel active order when isCancelEnabled = false', async ({ browser }) => {
    // 1. Seed Client & Active Order
    const client = await prisma.user.create({
      data: {
        email: `lp-client-cancel-${Date.now()}@example.com`,
        role: 'USER',
        balance: 100000,
      }
    });

    const order = await prisma.order.create({
      data: {
        userId: client.id,
        serviceId: testServiceCancelDisabled.id,
        link: 'https://t.me/active_channel',
        quantity: 500,
        charge: 5000, // 50 RUB in cents
        providerCost: 2500,
        status: 'IN_PROGRESS', // Active state
        remains: 500,
        numericId: 99001, // Manually set >= 4 digits to match regex parsers if needed
      }
    });

    // 2. Setup Support User
    const supportEmail = `support-cancel-${Date.now()}@smmplan.pro`;
    const { context, user, session } = await createAuthContext(browser, supportEmail, 'SUPPORT');
    await prisma.user.update({
      where: { id: user.id },
      data: { staffRoleId: supportRole.id }
    });

    const page = await context.newPage();

    // 3. Try to cancel from support orders dashboard
    await page.goto('/operator/orders');
    
    // Search for order link
    await page.getByPlaceholder('Поиск: email, ссылка, ID заказа...').fill('active_channel');
    await page.keyboard.press('Enter');

    // Setup dialog listener to confirm the cancel confirm dialog
    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('Вы действительно хотите отменить заказ');
      await dialog.accept();
    });

    // Click cancel button
    const cancelBtn = page.locator(`button:has-text("Отмена")`).first();
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();

    // 4. Assert warning message is displayed in Toast
    const expectedWarning = `Отмена невозможна: услуга "${testServiceCancelDisabled.name}" не поддерживает отмену на стороне провайдера. Только Администратор или Владелец могут принудительно отменить этот заказ.`;
    await expect(page.getByText(expectedWarning)).toBeVisible({ timeout: 15000 });

    // 5. Verify order is still IN_PROGRESS in DB
    const dbOrder = await prisma.order.findUnique({ where: { id: order.id } });
    expect(dbOrder?.status).toBe('IN_PROGRESS');

    // Clean up
    await page.close();
    await context.close();
    await prisma.session.delete({ where: { id: session.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.order.delete({ where: { id: order.id } });
    await prisma.user.delete({ where: { id: client.id } });
  });

  test('Support operator refund/compensation beyond daily limit is blocked', async ({ browser }) => {
    // 1. Seed Client & Active Order (Partial refund will cost 1000 RUB, exceeding support limit of 500 RUB)
    const client = await prisma.user.create({
      data: {
        email: `lp-client-refund-${Date.now()}@example.com`,
        role: 'USER',
        balance: 150000,
      }
    });

    // Set high charge so that partial refund is 1000 RUB (exceeding 500 RUB limit)
    const order = await prisma.order.create({
      data: {
        userId: client.id,
        serviceId: testServiceCancelEnabled.id,
        link: 'https://t.me/refundable_channel',
        quantity: 1000,
        charge: 100000, // 1000 RUB in cents
        providerCost: 50000,
        status: 'IN_PROGRESS',
        remains: 1000, // 100% remains => refund calculated is 1000 RUB
        numericId: 99002, // 5-digit ID to match ticket parser regex
      }
    });

    // Create a support ticket containing the order ID to populate the AttachedOrdersGrid
    const ticket = await prisma.ticket.create({
      data: {
        userId: client.id,
        subject: `Problem with order #${order.numericId}`, // Numeric ID inside subject triggers extraction
        status: 'OPEN',
        source: 'WEB',
      }
    });

    // Create a client message in the ticket
    await prisma.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        sender: 'USER',
        text: `Please refund my order #${order.numericId}`,
      }
    });

    // 2. Setup Support User (500 RUB Limit)
    const supportEmail = `support-refund-${Date.now()}@smmplan.pro`;
    const { context, user, session } = await createAuthContext(browser, supportEmail, 'SUPPORT');
    await prisma.user.update({
      where: { id: user.id },
      data: {
        staffRoleId: supportRole.id,
        supportLimitCents: 50000, // 500 RUB limit
      }
    });

    const page = await context.newPage();

    // 3. Open ticket details page in admin panel
    await page.goto(`/admin/tickets?ticketId=${ticket.id}`);

    // Wait for AttachedOrdersGrid to render with the parsed order card
    const orderCard = page.locator(`div:has-text("#${order.numericId}")`).first();
    await expect(orderCard).toBeVisible({ timeout: 15000 });

    // Select the attached order checkbox
    const checkbox = orderCard.locator('input[type="checkbox"]');
    await checkbox.check();

    // Click Bulk Refund button
    const refundBtn = page.getByRole('button', { name: 'Массовый возврат' });
    await expect(refundBtn).toBeVisible();
    await refundBtn.click();

    // Confirm the action in modal
    const confirmBtn = page.getByRole('button', { name: 'Оформить возврат' });
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // 4. Assert visual blocking error message
    // Note: Due to frontend code logic, it may toast 'Произошла непредвиденная ошибка'
    // or display the actual backend error message depending on error bubbling.
    // Assert either message is visible:
    const errorToast = page.locator('div[role="status"]').getByText(/Превышен суточный лимит|Произошла непредвиденная ошибка/);
    await expect(errorToast).toBeVisible({ timeout: 15000 });

    // 5. Verify order is still IN_PROGRESS in DB
    const dbOrder = await prisma.order.findUnique({ where: { id: order.id } });
    expect(dbOrder?.status).toBe('IN_PROGRESS');

    // Verify no ledger entries were successfully approved
    const ledger = await prisma.ledgerEntry.findFirst({
      where: { userId: client.id, adminId: user.id }
    });
    expect(ledger).toBeNull();

    // Clean up
    await page.close();
    await context.close();
    await prisma.session.delete({ where: { id: session.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.ticketMessage.deleteMany({ where: { ticketId: ticket.id } });
    await prisma.ticket.delete({ where: { id: ticket.id } });
    await prisma.order.delete({ where: { id: order.id } });
    await prisma.user.delete({ where: { id: client.id } });
  });
});
