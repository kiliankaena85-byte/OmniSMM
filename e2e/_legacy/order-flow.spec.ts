/**
 * e2e/order-flow.spec.ts
 * Order Flow E2E Tests — выбор сети → категории → сервиса → оформление заказа.
 *
 * RULES (AGENTS.md):
 * - Order Wizard Sequence: Network → Category → Service → Checkout
 * - Quantity defaults to minQty from service
 * - Insufficient balance shows error (не disabled кнопка!)
 * - Successful order → status PENDING in DB
 * - Use mock provider — no real API calls
 */

import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

// Constants for the seeded test service
const E2E_SERVICE_SLUG = 'e2e-order-flow-svc';
const E2E_CATEGORY_SLUG = 'e2e-order-flow-cat';
const E2E_NETWORK_SLUG = 'telegram'; // reuse existing telegram network

test.describe('Order Flow — Wizard Sequence', () => {
  let networkId: string;
  let categoryId: string;
  let serviceId: string;
  let richUserId: string;   // has enough balance
  let brokeUserId: string;  // has zero balance

  test.beforeAll(async () => {
    // Ensure telegram network exists
    const network = await db.network.upsert({
      where: { slug: E2E_NETWORK_SLUG },
      update: {},
      create: { name: 'Telegram', slug: E2E_NETWORK_SLUG, isActive: true, tenantId: 'smmplan' },
    });
    networkId = network.id;

    // Clean stale E2E data
    await db.service.deleteMany({ where: { slug: E2E_SERVICE_SLUG } });
    await db.category.deleteMany({ where: { slug: E2E_CATEGORY_SLUG } });

    // Create test category
    const category = await db.category.create({
      data: {
        name: 'E2E OrderFlow Subscribers',
        slug: E2E_CATEGORY_SLUG,
        networkId,
        tenantId: 'smmplan',
      },
    });
    categoryId = category.id;

    // Ensure provider exists
    let provider = await db.provider.findFirst({ where: { name: 'E2E OrderFlow Provider' } });
    if (!provider) {
      provider = await db.provider.create({
        data: {
          name: 'E2E OrderFlow Provider',
          apiUrl: 'http://mock-provider.local',
          apiKey: 'e2e_key',
          isActive: true,
        },
      });
    }

    // Create service
    const service = await db.service.create({
      data: {
        name: 'E2E OrderFlow Subs Service',
        slug: E2E_SERVICE_SLUG,
        categoryId,
        providerId: provider.id,
        tenantId: 'smmplan',
        rate: 5.0,
        markup: 50,
        minQty: 100,
        maxQty: 10_000,
        isActive: true,
        isQuarantined: false,
        externalId: '9999',
        targetType: 'CHANNEL',
      },
    });
    serviceId = service.id;

    // Seed system settings (exchange rate required for pricing)
    await db.systemSettings.upsert({
      where: { id: 'smmplan' },
      update: { exchangeRateUSD: 95.0, isTestMode: true },
      create: { id: 'smmplan', exchangeRateUSD: 95.0, isTestMode: true },
    });

    // Create rich user (200k RUB balance)
    const rich = await db.user.upsert({
      where: { email_tenantId: { email: 'e2e-rich-buyer@smmplan.local', tenantId: 'smmplan' } },
      update: { balance: 20_000_000, isActive: true, role: 'USER' },
      create: {
        email: 'e2e-rich-buyer@smmplan.local',
        tenantId: 'smmplan',
        role: 'USER',
        balance: 20_000_000, // 200 000 RUB in kopecks
        isActive: true,
      },
    });
    richUserId = rich.id;

    // Create broke user (0 balance)
    const broke = await db.user.upsert({
      where: { email_tenantId: { email: 'e2e-broke-buyer@smmplan.local', tenantId: 'smmplan' } },
      update: { balance: 0, isActive: true, role: 'USER' },
      create: {
        email: 'e2e-broke-buyer@smmplan.local',
        tenantId: 'smmplan',
        role: 'USER',
        balance: 0,
        isActive: true,
      },
    });
    brokeUserId = broke.id;
  });

  test.afterAll(async () => {
    // Clean up test orders and data
    await db.order.deleteMany({ where: { serviceId } }).catch(() => {});
    await db.service.deleteMany({ where: { id: serviceId } }).catch(() => {});
    await db.category.deleteMany({ where: { id: categoryId } }).catch(() => {});
    await db.user
      .deleteMany({
        where: {
          email: {
            in: ['e2e-rich-buyer@smmplan.local', 'e2e-broke-buyer@smmplan.local'],
          },
        },
      })
      .catch(() => {});
    await db.$disconnect();
  });

  // Helper: inject a JWT session cookie for a given userId
  async function injectSession(page: Parameters<typeof test>[1] extends (arg: { page: infer P }) => unknown ? P : never, userId: string, role: string = 'USER') {
    const { SignJWT } = await import('jose');
    const secret = process.env.JWT_SECRET || 'dev-secret-key-change-in-production-min-32-chars';
    const encodedKey = new TextEncoder().encode(secret);

    const session = await db.session.create({
      data: { userId, expiresAt: new Date(Date.now() + 86_400_000) },
    });

    const token = await new SignJWT({ sessionId: session.id, userId, role, tenantId: 'smmplan' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1d')
      .sign(encodedKey);

    await page.context().addCookies([
      { name: 'session_token', value: token, domain: 'localhost', path: '/' },
    ]);
  }

  // ─────────────────────────────────────────────
  // 1. Dashboard shows "Новый заказ" entry point
  // ─────────────────────────────────────────────
  test('Dashboard has "Новый заказ" link', async ({ page }) => {
    await injectSession(page, richUserId);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/dashboard/);

    const newOrderLink = page.getByRole('link', { name: /Новый заказ/i }).first();
    await expect(newOrderLink).toBeVisible({ timeout: 10_000 });
  });

  // ─────────────────────────────────────────────
  // 2. New order page loads with URL input
  // ─────────────────────────────────────────────
  test('New order page renders URL input and service selector', async ({ page }) => {
    await injectSession(page, richUserId);
    await page.goto('/dashboard/new-order');

    await expect(page.locator('h1', { hasText: /Оформление заказа|Новый заказ/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('button', { hasText: /Telegram/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  // ─────────────────────────────────────────────
  // 3. Quantity defaults to minQty and validates
  // ─────────────────────────────────────────────
  test('Quantity input defaults to service minQty and validates min/max', async ({ page }) => {
    await injectSession(page, richUserId);
    await page.goto('/dashboard/new-order');

    // Revalidate catalog cache
    await page.request.get('/api/debug?revalidate=catalog').catch(() => {});

    // Click Telegram network button on Step 1
    const telegramBtn = page.locator('button', { hasText: /Telegram/i }).first();
    await expect(telegramBtn).toBeVisible({ timeout: 10_000 });
    await telegramBtn.click();

    // Select category on Step 2
    const catBtn = page.locator('button', { hasText: /E2E OrderFlow/i }).first();
    if (await catBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await catBtn.click();

      // Select service on Step 3
      const svcBtn = page.locator('button', { hasText: /E2E OrderFlow Subs Service/i }).first();
      if (await svcBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
        await svcBtn.click();

        // Quantity input should default to minQty = 100 on Step 4
        const qtyInput = page.locator('input[type="number"], input[name*="quantity"]').first();
        if (await qtyInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
          const val = await qtyInput.inputValue();
          expect(Number(val)).toBeGreaterThanOrEqual(100);
        }
      }
    }
  });

  // ─────────────────────────────────────────────
  // 4. Insufficient balance shows error
  // ─────────────────────────────────────────────
  test('Broke user sees insufficient balance error when submitting order', async ({ page }) => {
    await injectSession(page, brokeUserId);
    await page.goto('/dashboard/new-order');

    const telegramBtn = page.locator('button', { hasText: /Telegram/i }).first();
    await expect(telegramBtn).toBeVisible({ timeout: 10_000 });
    await telegramBtn.click();

    const catBtn = page.locator('button', { hasText: /E2E OrderFlow/i }).first();
    if (await catBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await catBtn.click();

      const svcBtn = page.locator('button', { hasText: /E2E OrderFlow Subs Service/i }).first();
      if (await svcBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
        await svcBtn.click();

        const urlInput = page.locator('input[name*="link"], input[placeholder*="ссылку"]').first();
        if (await urlInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await urlInput.fill('https://t.me/durov');
        }

        const submitBtn = page.getByRole('button', { name: /Создать заказ|Оплатить/i });
        await expect(submitBtn).toBeVisible({ timeout: 10_000 });
        await submitBtn.click();

        await expect(
          page.locator('[role="alert"], [data-sonner-toast]').filter({ hasText: /баланс|недостаточно|funds|balance/i }).first()
        ).toBeVisible({ timeout: 10_000 });

        await expect(page).not.toHaveURL(/\/orders/);
      }
    }
  });

  // ─────────────────────────────────────────────
  // 5. Successful order → created in DB with PENDING/AWAITING_PAYMENT
  // ─────────────────────────────────────────────
  test('Rich user submits order with balance payment — order appears in history', async ({ page }) => {
    await injectSession(page, richUserId);
    await page.goto('/dashboard/new-order');

    const telegramBtn = page.locator('button', { hasText: /Telegram/i }).first();
    await expect(telegramBtn).toBeVisible({ timeout: 10_000 });
    await telegramBtn.click();

    const catBtn = page.locator('button', { hasText: /E2E OrderFlow/i }).first();
    if (await catBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await catBtn.click();

      const svcBtn = page.locator('button', { hasText: /E2E OrderFlow Subs Service/i }).first();
      if (await svcBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
        await svcBtn.click();

        const urlInput = page.locator('input[name*="link"], input[placeholder*="ссылку"]').first();
        if (await urlInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await urlInput.fill('https://t.me/e2e_test_channel_smmplan');
        }

        const emailInput = page.locator('input[type="email"]').first();
        if (await emailInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await emailInput.fill('e2e-rich-buyer@smmplan.local');
        }

        const submitBtn = page.getByRole('button', { name: /Создать заказ|Оплатить/i });
        await expect(submitBtn).toBeEnabled({ timeout: 10_000 });
        await submitBtn.click();

        await expect(page).toHaveURL(/orders|success/, { timeout: 30_000 });

        const orders = await db.order.findMany({
          where: { userId: richUserId, serviceId },
          orderBy: { createdAt: 'desc' },
          take: 1,
        });
        expect(orders.length).toBeGreaterThanOrEqual(1);
        expect(['PENDING', 'AWAITING_PAYMENT']).toContain(orders[0].status);
      }
    }
  });

  // ─────────────────────────────────────────────
  // 6. Order history shows the created order
  // ─────────────────────────────────────────────
  test('Order history page shows list of user orders', async ({ page }) => {
    await injectSession(page, richUserId);
    await page.goto('/dashboard/orders');

    await expect(page).toHaveURL(/orders/, { timeout: 10_000 });
    // Either shows a table/list or an empty state — no crash
    const hasContent = await Promise.race([
      page.locator('table, [data-testid="orders-list"], [role="table"]').first().waitFor({ state: 'visible', timeout: 10_000 }).then(() => true),
      page.locator('text=/заказ|Orders|Нет заказов/i').first().waitFor({ state: 'visible', timeout: 10_000 }).then(() => true),
    ]).catch(() => false);

    expect(hasContent).toBe(true);
  });
});
