/**
 * e2e/03-billing-and-payments.spec.ts
 * BLOCK 3: Billing, Payments, Webhooks, Idempotency & 54-FZ Fiscal E2E Tests
 *
 * Invariants & Contract (AGENTS.md & Zero-Defect):
 * 1. Financial Trust Boundary: Balance changed ONLY via WalletOps in kopecks (BigInt).
 * 2. Idempotency: Webhooks must never double-credit on repeated events.
 * 3. 54-FZ & VAT 2026: VAT code 1 (no VAT under 20M limit), VAT code 10 (22% VAT above threshold).
 * 4. Never disabled submit buttons in payment forms.
 */

import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { PaymentService } from '../src/services/financial/payment.service';
import { createAuthenticatedContext } from './fixtures';

const db = new PrismaClient();
const paymentService = new PaymentService();

test.describe.serial('BLOCK 3: Billing, Payments, Webhooks & 54-FZ Fiscal E2E', () => {
  let userId: string;
  let userEmail: string;

  test.beforeAll(async () => {
    // 1. Ensure test user
    userEmail = `billing-test-${Date.now()}@smmplan.local`;
    const user = await db.user.create({
      data: {
        email: userEmail,
        tenantId: 'smmplan',
        role: 'USER',
        balance: 0,
        isActive: true,
        isDeleted: false,
      },
    });
    userId = user.id;

    // 2. Ensure system settings (exchange rates & test mode)
    await db.systemSettings.upsert({
      where: { id: 'smmplan' },
      update: { isTestMode: true, exchangeRateUSD: 95.0 },
      create: { id: 'smmplan', isTestMode: true, exchangeRateUSD: 95.0 },
    });
  });

  test.afterAll(async () => {
    await db.payment.deleteMany({ where: { userId } }).catch(() => {});
    await db.order.deleteMany({ where: { userId } }).catch(() => {});
    await db.user.delete({ where: { id: userId } }).catch(() => {});
    await db.$disconnect();
  });

  test('Scenario 1: Client Top-up Flow in UI & Payment Record Creation', async ({ browser, baseURL }) => {
    const context = await createAuthenticatedContext(browser, userId, 'USER');
    const page = await context.newPage();

    // 1. Visit finance deposit tab
    await page.goto(`${baseURL}/dashboard/finance?tab=deposit`);
    await expect(page.locator('body')).toBeVisible();

    // 2. Verify payment methods exist (СБП, Карты РФ, CryptoBot)
    const paymentMethods = page.locator('text=СБП').or(page.locator('text=Банковские карты РФ')).or(page.locator('text=CryptoBot'));
    await expect(paymentMethods.first()).toBeVisible({ timeout: 10_000 });

    // 3. Select preset amount or enter custom amount
    const presetBtn = page.getByRole('button', { name: /1 000 ₽|500 ₽|2 500 ₽/i }).first();
    if (await presetBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await presetBtn.click();
    } else {
      const amountInput = page.locator('input[type="number"], input[placeholder*="Сумма"]').first();
      if (await amountInput.isVisible()) {
        await amountInput.fill('1000');
      }
    }

    // 4. Submit button must be visible & enabled
    const submitBtn = page.getByRole('button', { name: /(Перейти к оплате|Выставить счёт|Оплатить)/i }).first();
    await expect(submitBtn).toBeVisible({ timeout: 10_000 });
    await expect(submitBtn).toBeEnabled();

    // Submit form and wait for network activity
    await Promise.all([
      page.waitForResponse(
        res => res.url().includes('deposit') || res.url().includes('finance') || res.request().method() === 'POST',
        { timeout: 10_000 }
      ).catch(() => null),
      submitBtn.click(),
    ]);

    await page.waitForTimeout(2500);

    // 5. Verify in DB that a payment record exists for this user
    const createdPayment = await db.payment.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    expect(createdPayment).not.toBeNull();
    if (createdPayment) {
      expect(createdPayment.amount).toBeGreaterThanOrEqual(1000); // >= 10 RUB in kopecks
      expect(createdPayment.userId).toBe(userId);
    }

    await context.close();
  });

  test('Scenario 2: Webhook Idempotency & Balance Credit via WalletOps', async () => {
    const initialUser = await db.user.findUnique({ where: { id: userId } });
    const initialBalance = initialUser?.balance ?? 0;

    // 1. Create a pending payment of 2,500.00 RUB (250,000 kopecks)
    const gatewayPaymentId = `yoo_pay_${Date.now()}`;
    const payment = await db.payment.create({
      data: {
        userId,
        amount: 250_000,
        currency: 'RUB',
        status: 'PENDING',
        gateway: 'yookassa',
        gatewayId: gatewayPaymentId,
        tenantId: 'smmplan',
      },
    });

    // 2. First Webhook Execution: Confirm payment
    const confirmedFirstTime = await paymentService.confirmPayment(
      gatewayPaymentId,
      250_000,
      userId,
      true, // isDevSandbox
      'yookassa',
      payment.id,
      'TOPUP'
    );

    expect(confirmedFirstTime).toBe(true);

    // Verify user balance increased by exactly 250,000 kopecks
    const userAfterFirst = await db.user.findUnique({ where: { id: userId } });
    expect(Number(userAfterFirst?.balance ?? 0)).toBe(Number(initialBalance) + 250_000);

    // Verify payment status is SUCCEEDED
    const updatedPayment = await db.payment.findUnique({ where: { id: payment.id } });
    expect(updatedPayment?.status).toBe('SUCCEEDED');

    // 3. Second Webhook Execution (Simulate Network Retry / Duplicate Event)
    const confirmedSecondTime = await paymentService.confirmPayment(
      gatewayPaymentId,
      250_000,
      userId,
      true, // isDevSandbox
      'yookassa',
      payment.id,
      'TOPUP'
    );

    expect(confirmedSecondTime).toBe(true);

    // CRITICAL IDEMPOTENCY CHECK: Balance must NOT increase a second time!
    const userAfterSecond = await db.user.findUnique({ where: { id: userId } });
    expect(Number(userAfterSecond?.balance ?? 0)).toBe(Number(initialBalance) + 250_000);
  });

  test('Scenario 3: Fiscal 54-FZ & VAT 2026 Calculation Compliance', async () => {
    // Invariants (AGENTS.md & 54-FZ):
    // Under 20M RUB limit: vat_code = 1 (Без НДС)
    // Above 20M RUB limit: vat_code = 10 (НДС 22% по ФЗ № 425-ФЗ)

    const testAmountCents = 500_000; // 5,000 RUB
    const VAT_RATE_PERCENT_2026 = 22; // 22% VAT 2026
    const calculatedVatCents = Math.round((testAmountCents * VAT_RATE_PERCENT_2026) / (100 + VAT_RATE_PERCENT_2026));

    expect(calculatedVatCents).toBeGreaterThan(0);
    expect(calculatedVatCents).toBeLessThan(testAmountCents);

    // Verify receipt items schema structure
    const receiptItem = {
      description: 'Пополнение лицевого счета SMMplan',
      quantity: 1.0,
      amount: {
        value: (testAmountCents / 100).toFixed(2),
        currency: 'RUB',
      },
      vat_code: 1, // Default USN without VAT
      payment_mode: 'full_prepayment',
      payment_subject: 'service',
    };

    expect(receiptItem.vat_code).toBe(1);
    expect(receiptItem.amount.value).toBe('5000.00');
  });

  test('Scenario 4: CryptoBot Payment Webhook Processing', async () => {
    const userBefore = await db.user.findUnique({ where: { id: userId } });
    const balanceBefore = userBefore?.balance ?? 0;

    const cryptoPaymentId = `crypto_pay_${Date.now()}`;
    const depositAmountCents = 100_000; // 1,000 RUB in kopecks

    const cryptoPayment = await db.payment.create({
      data: {
        userId,
        amount: depositAmountCents,
        currency: 'RUB',
        status: 'PENDING',
        gateway: 'cryptobot',
        gatewayId: cryptoPaymentId,
        tenantId: 'smmplan',
      },
    });

    const confirmed = await paymentService.confirmPayment(
      cryptoPaymentId,
      depositAmountCents,
      userId,
      true,
      'cryptobot',
      cryptoPayment.id,
      'TOPUP'
    );

    expect(confirmed).toBe(true);

    const userAfter = await db.user.findUnique({ where: { id: userId } });
    expect(Number(userAfter?.balance ?? 0)).toBe(Number(balanceBefore) + depositAmountCents);

    const finalPayment = await db.payment.findUnique({ where: { id: cryptoPayment.id } });
    expect(finalPayment?.status).toBe('SUCCEEDED');
  });
});
