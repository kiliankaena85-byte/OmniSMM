import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

test.describe('External Payment (YooKassa) Lifecycle', () => {

  test.beforeAll(async () => {
    const prisma = new PrismaClient();
    
    // Clear stale test data first to avoid database pollution and foreign key conflicts
    await prisma.order.deleteMany({ where: { email: 'e2e-tester@test.com' } });
    await prisma.payment.deleteMany({ where: { user: { email: 'e2e-tester@test.com' } } });
    await prisma.service.deleteMany({ where: { id: 'e2e-telegram-service-id' } });
    await prisma.category.deleteMany({ where: { id: 'e2e-telegram-subscribers-cat' } });
    await prisma.provider.deleteMany({ where: { name: 'E2E Test Provider' } });

    let network = await prisma.network.findUnique({ where: { slug: 'telegram' } });
    if (!network) {
      network = await prisma.network.create({ data: { name: 'Telegram', slug: 'telegram' } });
    }
    
    // Always upsert the Category to ensure it exists and matches
    const category = await prisma.category.create({
      data: {
        id: 'e2e-telegram-subscribers-cat',
        name: 'QA Telegram Subscribers',
        sort: 1,
        networkId: network.id
      }
    });

    const provider = await prisma.provider.create({
      data: {
        name: 'E2E Test Provider',
        apiUrl: 'http://test.local',
        apiKey: 'test_key'
      }
    });

    // Always upsert the Service to ensure it is linked to the correct category ID and active
    await prisma.service.create({
      data: {
        id: 'e2e-telegram-service-id',
        name: 'QA Telegram Service',
        categoryId: category.id,
        providerId: provider.id,
        rate: 10.0,
        markup: 50.0,
        minQty: 10,
        maxQty: 10000,
        isQuarantined: false,
        isActive: true,
        externalId: '101'
      }
    });

    // Seed YooKassa settings
    await prisma.systemSettings.upsert({
      where: { id: 'global' },
      update: {
        yookassaShopId: 'test_shop_id',
        yookassaSecretKey: 'test_secret_key',
        isTestMode: true,
        exchangeRateUSD: 95.0
      },
      create: {
        id: 'global',
        yookassaShopId: 'test_shop_id',
        yookassaSecretKey: 'test_secret_key',
        isTestMode: true,
        exchangeRateUSD: 95.0
      }
    });

    await prisma.$disconnect();
  });

  test('should create AWAITING_PAYMENT order and successfully credit via Webhook simulation', async ({ page, request }) => {
    // 1. Revalidate catalog cache to ensure newly seeded data is visible
    await request.get('/api/debug?revalidate=catalog');
    
    // 2. Visit Dashboard (logged out user gets auto-login via auth.setup)
    await page.goto('/dashboard/new-order');
    
    await expect(page).toHaveTitle(/Новый заказ | Smmplan/i);

    // 2. Wait for SmartOrderForm to load
    const linkInput = page.locator('input#order-url').first();
    await expect(linkInput).toBeVisible();

    // 3. Paste a test URL
    await linkInput.fill('https://t.me/durov');
    
    // Wait for the option to be auto-selected by the hook logic
    const serviceOption = page.getByRole('option', { name: /QA Telegram Service/i });
    await expect(serviceOption).toBeVisible({ timeout: 15000 });
    await expect(serviceOption).toHaveAttribute('aria-selected', 'true', { timeout: 5000 });

    const qtyInput = page.locator('input[type="number"], input[placeholder*="Количество"]').first();
    await expect(qtyInput).toBeVisible();
    const minQty = await qtyInput.getAttribute('min');
    await qtyInput.fill(minQty ? (parseInt(minQty) + 5).toString() : '15');

    // 7. Submit Order
    const payBtn = page.locator('button', { hasText: /💳|Оплатить/ }).first();
    await expect(payBtn).toBeVisible();

    // 6. Change Gateway to YooKassa
    // Wait for the pricing calculation to complete and update the button price first
    // This prevents the gateway reset useEffect from overwriting yookassa back to balance
    await expect(payBtn).toContainText('712.50', { timeout: 10000 });

    const yookassaTab = page.locator('button', { hasText: /ЮKassa|Банковская карта|СБП \/ Карта/i }).first();
    if (await yookassaTab.count() > 0) {
      await yookassaTab.click();
    }
    
    // Intercept mock-payment redirect so it doesn't auto-confirm the payment
    // We want the Webhook to do the confirmation!
    await page.route('**/api/dev/mock-payment*', route => route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<html><body>Mock YooKassa Gateway</body></html>'
    }));

    // Wait for React to re-render and enable the button
    await expect(payBtn).toBeEnabled({ timeout: 5000 });

    // 6.5 Fill Email (Required by schema)
    const emailInput = page.locator('input[type="email"]').first();
    await expect(emailInput).toBeVisible();
    await emailInput.fill('e2e-tester@test.com');

    await payBtn.click();
    await page.waitForTimeout(1000); // Wait for React state or Server Action
    
    // 8. Fetch userId from DB via Prisma by polling for the new Payment
    const prisma = new PrismaClient();
    let payment = null;
    const order = null;
    
    // Poll the database for up to 10 seconds (20 * 500ms)
    for (let i = 0; i < 20; i++) {
      payment = await prisma.payment.findFirst({
        where: { gateway: 'yookassa', status: 'PENDING' },
        orderBy: { createdAt: 'desc' }
      });
      if (payment) break;
      await page.waitForTimeout(500);
    }
    
    expect(payment).not.toBeNull();
    const internalPaymentId = payment!.id;
    
    expect(payment).not.toBeNull();
    const userId = payment!.userId;
    
    // Find linked order using paymentId (basket architecture)
    const linkedOrder = await prisma.order.findFirst({ where: { paymentId: internalPaymentId } });
    expect(linkedOrder).not.toBeNull();
    const orderId = linkedOrder!.id;
    
    const amountRub = Number(payment!.amount) / 100;

    // 10. Simulate the YooKassa Webhook Action
    console.log(`[E2E YooKassa] Simulating Webhook for DB Payment: ${internalPaymentId}`);
    const mockGatewayId = 'mock_yookassa_' + Date.now();
    
    const webhookPayload = {
      type: 'notification',
      event: 'payment.succeeded',
      object: {
        id: mockGatewayId,
        amount: {
          value: amountRub.toFixed(2),
          currency: 'RUB'
        },
        metadata: {
          userId: userId,
          paymentId: internalPaymentId,
          type: 'yookassa'
        }
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crypto = require('crypto');
    const rawBody = JSON.stringify(webhookPayload);
    const signature = crypto
      .createHmac('sha256', 'test_webhook_secret_key_123456')
      .update(rawBody, 'utf8')
      .digest('hex');

    const webhookResp = await request.post('/api/webhooks/yookassa', {
      headers: {
        'Content-Type': 'application/json',
        'x-sha256-signature': `sha256=${signature}`
      },
      data: rawBody
    });
    
    expect(webhookResp.status()).toBe(200);

    // 11. Assert Database State Transitions
    const finalPayment = await prisma.payment.findUnique({ where: { id: internalPaymentId } });
    expect(finalPayment!.status).toBe('SUCCEEDED');
    
    const finalOrder = await prisma.order.findUnique({ where: { id: orderId } });
    expect(finalOrder!.status).toBe('PENDING'); // Should activate
    
    console.log('[E2E YooKassa] Financial Flow (Order -> Webhook -> Activation) verified successfully.');
    
    await prisma.$disconnect();
  });

  test.afterAll(async () => {
    const prisma = new PrismaClient();
    await prisma.order.deleteMany({ where: { email: 'e2e-tester@test.com' } });
    await prisma.payment.deleteMany({ where: { user: { email: 'e2e-tester@test.com' } } });
    await prisma.service.deleteMany({ where: { id: 'e2e-telegram-service-id' } });
    await prisma.category.deleteMany({ where: { id: 'e2e-telegram-subscribers-cat' } });
    await prisma.provider.deleteMany({ where: { name: 'E2E Test Provider' } });
    await prisma.$disconnect();
  });
});
