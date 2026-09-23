import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

test.describe('Admin Marketing & Referrals Flow', () => {
  let prisma: PrismaClient;

  test.beforeAll(async () => {
    prisma = new PrismaClient();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('Admin can manage promocodes and payouts', async ({ page }) => {
    page.on('pageerror', error => console.error('PAGE ERROR:', error));
    page.on('console', msg => {
      if (msg.type() === 'error') console.error('CONSOLE ERROR:', msg.text());
    });

    // 1. Prepare test users for referral payouts
    const richEmail = 'rich-referrer-e2e@test.com';
    const poorEmail = 'poor-referrer-e2e@test.com';

    let richUser = await prisma.user.findFirst({ where: { email: richEmail } });
    if (!richUser) {
      richUser = await prisma.user.create({
        data: { email: richEmail, tenantId: 'smmplan', balance: 0, referralBalance: 25000, role: 'USER' } // 250 RUB (eligible for payout)
      });
    } else {
      richUser = await prisma.user.update({
        where: { id: richUser.id },
        data: { balance: 0, referralBalance: 25000 }
      });
    }

    let poorUser = await prisma.user.findFirst({ where: { email: poorEmail } });
    if (!poorUser) {
      poorUser = await prisma.user.create({
        data: { email: poorEmail, tenantId: 'smmplan', balance: 0, referralBalance: 5000, role: 'USER' } // 50 RUB (not eligible for payout)
      });
    } else {
      poorUser = await prisma.user.update({
        where: { id: poorUser.id },
        data: { balance: 0, referralBalance: 5000 }
      });
    }

    // Clean up previous payouts to make sure stats are consistent
    await prisma.ledgerEntry.deleteMany({
      where: { userId: { in: [richUser.id, poorUser.id] } }
    });

    // Clean up previous test promocode to avoid duplication conflicts
    const testPromoCode = 'E2EPROMO15';
    await prisma.promoCode.deleteMany({ where: { code: testPromoCode } });

    // 2. Go to /admin/marketing page
    await page.goto('/admin/marketing');

    // 3. Create a new promo code
    await page.getByRole('button', { name: /Создать/i }).first().click();
    await expect(page.getByRole('heading', { name: 'Новый промокод' })).toBeVisible();

    // Fill out code field (override random one with our test value)
    const codeInput = page.locator('input[name="code"]');
    await codeInput.fill('');
    await codeInput.fill(testPromoCode);

    // Enter budget and discount values
    await page.locator('input[name="discountPercent"]').fill('15');
    await page.locator('input[name="maxUses"]').fill('50');
    await page.locator('input[name="description"]').fill('E2E Test Promo Code');
    await page.locator('input[name="budget"]').fill('3500');

    // Submit the form
    await page.getByRole('button', { name: 'Создать промокод' }).click();

    // Wait for the modal to close and new promo code to appear in the table
    await expect(page.locator('span').filter({ hasText: testPromoCode }).first()).toBeVisible({ timeout: 10000 });

    // 4. Test Filters Toolbar
    // We expect the custom toolbar to be visible
    await expect(page.getByText('Тип бонуса')).toBeVisible();

    // Filter by type: VOUCHER
    // Locate the first select trigger (which should be "Тип бонуса")
    const typeSelectTrigger = page.locator('button[data-slot="select-trigger"]').nth(0);
    await typeSelectTrigger.click();
    await page.locator('div[data-slot="select-item"]').filter({ hasText: 'Ваучер' }).click();

    // Our discount promo code E2EPROMO15 should be filtered out
    await expect(page.locator('span').filter({ hasText: testPromoCode }).first()).not.toBeVisible();

    // Reset filter back to ALL
    await typeSelectTrigger.click();
    await page.locator('div[data-slot="select-item"]').filter({ hasText: 'Все типы' }).click();
    await expect(page.locator('span').filter({ hasText: testPromoCode }).first()).toBeVisible();

    // 5. Test Referral Program Tab
    const referralTabTrigger = page.getByRole('tab', { name: /Партнерская программа/i });
    await referralTabTrigger.click();

    // Verify referrer table and stats are visible
    await expect(page.getByText('Аудит рефоводов')).toBeVisible();
    await expect(page.getByText('Выплачено всего')).toBeVisible();

    // Locate rich user row and payout button
    const richRow = page.locator('tr').filter({ hasText: richEmail });
    const payoutButton = richRow.getByRole('button', { name: 'На баланс' });
    await expect(payoutButton).toBeEnabled();

    // Locate poor user row and disabled button with Min limit label
    const poorRow = page.locator('tr').filter({ hasText: poorEmail });
    const disabledButton = poorRow.getByRole('button', { name: 'Мин. 100 ₽' });
    await expect(disabledButton).toBeDisabled();

    // Click payout on rich user, which opens custom ConfirmModal
    await payoutButton.click();

    // Click confirm button inside the modal
    const confirmBtn = page.getByRole('button', { name: 'Выплатить', exact: true });
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // Check success toast
    await expect(page.getByText('Выплата произведена успешно').first()).toBeVisible({ timeout: 10000 });

    // Verify DB changes
    const updatedRichUser = await prisma.user.findUnique({ where: { id: richUser.id } });
    expect(updatedRichUser?.referralBalance).toBe(0);
    expect(updatedRichUser?.balance).toBe(BigInt(25000));
  });
});
