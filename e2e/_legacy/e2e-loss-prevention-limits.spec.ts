import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/auth/password';
import * as fs from 'fs';
import * as path from 'path';

// Clean context (no global setup cookies)
test.use({ storageState: { cookies: [], origins: [] } });

const prisma = new PrismaClient();

test.describe('E2E Loss Prevention & Support Limits Flow', () => {
  const clientEmail = `lp-client-${Date.now()}@smmplan.local`;
  const clientPassword = 'ClientPassword2026!';
  const operatorEmail = `support-lp-${Date.now()}@smmplan.test`;
  const operatorPassword = 'SupportPassword2026!';
  const artifactDir = 'd:/SMM_plan_2/artifacts';

  let clientUser: any = null;
  let operatorUser: any = null;
  let testCategory: any = null;
  let testServiceCancelDisabled: any = null;
  let testServiceCancelEnabled: any = null;
  let supportRole: any = null;

  let orderCancelDisabled: any = null;
  let orderCancelEnabled: any = null;
  let ticket: any = null;
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

    // Setup network & categories
    let network = await prisma.network.findFirst({
      where: { slug: 'telegram' }
    });
    if (!network) {
      network = await prisma.network.create({ data: { name: 'Telegram', slug: 'telegram' } });
    }

    testCategory = await prisma.category.create({
      data: {
        name: `E2E LP Category ${Date.now()}`,
        slug: `e2e-lp-cat-${Date.now()}`,
        networkId: network.id,
      },
    });

    testServiceCancelDisabled = await prisma.service.create({
      data: {
        name: `E2E Cancel Disabled ${Date.now()}`,
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
        name: `E2E Cancel Enabled ${Date.now()}`,
        categoryId: testCategory.id,
        rate: 3.0,
        minQty: 10,
        maxQty: 1000,
        isActive: true,
        isCancelEnabled: true,
      },
    });

    // Setup support role and permissions
    supportRole = await prisma.staffRole.create({
      data: {
        name: `E2E Support LP Role ${Date.now()}`,
        permissions: {
          createMany: {
            data: [
              { section: 'orders', canView: true, canEdit: true },
              { section: 'support', canView: true, canEdit: true },
              { section: 'tickets', canView: true, canEdit: true },
            ]
          }
        }
      }
    });

    // Create client
    const hashedClientPassword = await hashPassword(clientPassword);
    clientUser = await prisma.user.create({
      data: {
        email: clientEmail,
        passwordHash: hashedClientPassword,
        role: 'USER',
        balance: 500000, // 5000 RUB
        isEmailVerified: true,
        isActive: true,
      }
    });

    // Create operator (with 500 RUB support limit = 50000 cents)
    const hashedOperatorPassword = await hashPassword(operatorPassword);
    operatorUser = await prisma.user.create({
      data: {
        email: operatorEmail,
        passwordHash: hashedOperatorPassword,
        role: 'SUPPORT',
        isActive: true,
        isEmailVerified: true,
        staffRoleId: supportRole.id,
        supportLimitCents: 50000, // 500 RUB limit
      }
    });

    // Seed order 1: Cancel disabled
    orderCancelDisabled = await prisma.order.create({
      data: {
        userId: clientUser.id,
        serviceId: testServiceCancelDisabled.id,
        link: 'https://t.me/cancel_disabled_channel',
        quantity: 500,
        charge: 5000, // 50 RUB in cents
        providerCost: 2500,
        status: 'IN_PROGRESS',
        remains: 500,
        numericId: 99101,
      }
    });

    // Seed order 2: Cancel enabled but refund will exceed limit
    orderCancelEnabled = await prisma.order.create({
      data: {
        userId: clientUser.id,
        serviceId: testServiceCancelEnabled.id,
        link: 'https://t.me/cancel_enabled_channel',
        quantity: 1000,
        charge: 100000, // 1000 RUB charge
        providerCost: 50000,
        status: 'IN_PROGRESS',
        remains: 1000,
        numericId: 99102,
      }
    });

    // Create ticket mentioning order 2
    ticket = await prisma.ticket.create({
      data: {
        userId: clientUser.id,
        subject: `Problem with order #${orderCancelEnabled.numericId}`,
        status: 'OPEN',
        source: 'WEB',
      }
    });

    await prisma.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        sender: 'USER',
        text: `Please refund my order #${orderCancelEnabled.numericId}`,
      }
    });
  });

  test.afterAll(async () => {
    // Cleanup
    if (ticket) {
      await prisma.ticketMessage.deleteMany({ where: { ticketId: ticket.id } });
      await prisma.ticket.delete({ where: { id: ticket.id } }).catch(() => {});
    }
    if (orderCancelDisabled) {
      await prisma.order.delete({ where: { id: orderCancelDisabled.id } }).catch(() => {});
    }
    if (orderCancelEnabled) {
      await prisma.order.delete({ where: { id: orderCancelEnabled.id } }).catch(() => {});
    }
    if (clientUser) {
      await prisma.user.delete({ where: { id: clientUser.id } }).catch(() => {});
    }
    if (operatorUser) {
      await prisma.user.delete({ where: { id: operatorUser.id } }).catch(() => {});
    }
    if (testServiceCancelDisabled) {
      await prisma.service.delete({ where: { id: testServiceCancelDisabled.id } }).catch(() => {});
    }
    if (testServiceCancelEnabled) {
      await prisma.service.delete({ where: { id: testServiceCancelEnabled.id } }).catch(() => {});
    }
    if (testCategory) {
      await prisma.category.delete({ where: { id: testCategory.id } }).catch(() => {});
    }
    if (supportRole) {
      await prisma.staffRole.delete({ where: { id: supportRole.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  test('Cancellation blocked warning and daily support limit enforcement', async ({ page }) => {
    page.on('console', msg => console.log('[BROWSER LOG]', msg.text()));
    page.on('pageerror', err => console.error('[BROWSER ERROR]', err.message));

    // Log in as Support Operator
    await page.goto('/login');
    await page.locator('#login-email').fill(operatorEmail);
    await page.locator('#login-password').fill(operatorPassword);
    await page.getByRole('button', { name: 'Войти в кабинет' }).click();
    await expect(page).toHaveURL(/.*dashboard/);

    // --- STEP 1: Attempt to cancel orderCancelDisabled ---
    await page.goto('/operator/orders');
    await expect(page).toHaveURL(/.*operator\/orders/);

    await page.getByPlaceholder('Email, ID заказа, ссылка или ID провайдера...').fill('cancel_disabled_channel');
    await page.keyboard.press('Enter');

    // Accept dialog
    page.once('dialog', dialog => {
      dialog.accept().catch(() => {});
    });

    // Locate the specific row for orderCancelDisabled (numericId 99101)
    const row = page.locator('tr', { hasText: `${orderCancelDisabled.numericId}` });
    const cancelBtn = row.locator('button:has-text("Отмена")');
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();

    // Verify warning toast
    await expect(page.getByText(/Отмена невозможна: услуга.*не поддерживает отмену на стороне провайдера/).first()).toBeVisible({ timeout: 15000 });

    // Take screenshot: cancellation_blocked.png
    await page.screenshot({ path: path.join(artifactDir, 'cancellation_blocked.png') });

    // Verify status in DB remains IN_PROGRESS
    const dbOrderDisabled = await prisma.order.findUnique({ where: { id: orderCancelDisabled.id } });
    expect(dbOrderDisabled?.status).toBe('IN_PROGRESS');

    // --- STEP 2: Attempt bulk refund exceeding daily limit ---
    await page.goto(`/admin/tickets?ticketId=${ticket.id}`);

    // Wait for AttachedOrdersGrid
    const orderCard = page.locator(`div:has-text("#${orderCancelEnabled.numericId}")`).first();
    await expect(orderCard).toBeVisible({ timeout: 15000 });

    // Click the attached order card itself to select it
    await orderCard.click();

    // Click bulk refund
    const refundBtn = page.getByRole('button', { name: 'Массовый возврат' });
    await expect(refundBtn).toBeVisible();
    await refundBtn.click();

    // Click confirm in modal
    const confirmBtn = page.getByRole('button', { name: 'Оформить возврат' });
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // Verify toast error (exceeding limit)
    const errorToast = page.getByText(/Превышен суточный лимит|Произошла непредвиденная ошибка/).first();
    await expect(errorToast).toBeVisible({ timeout: 15000 });

    // Take screenshot: compensation_limit_exceeded.png
    await page.screenshot({ path: path.join(artifactDir, 'compensation_limit_exceeded.png') });

    // Verify order is still IN_PROGRESS in DB
    const dbOrderEnabled = await prisma.order.findUnique({ where: { id: orderCancelEnabled.id } });
    expect(dbOrderEnabled?.status).toBe('IN_PROGRESS');
  });
});
