import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

test.describe('Finance & Ledger Flow', () => {
  let prisma: PrismaClient;

  test.beforeAll(async () => {
    prisma = new PrismaClient();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('Admin can resolve Escrow Quarantine entries', async ({ page }) => {
    page.on('pageerror', error => console.error('PAGE ERROR:', error));
    page.on('console', msg => {
      if (msg.type() === 'error') console.error('CONSOLE ERROR:', msg.text());
    });
    // 1. Prepare target user and quarantine entry
    const testEmail = 'quarantine-tester-e2e@test.com';
    let testUser = await prisma.user.findFirst({ where: { email: testEmail } });
    if (!testUser) {
      testUser = await prisma.user.create({
        data: { email: testEmail, tenantId: 'smmplan', balance: 0, quarantineBalance: 50000, role: 'USER' } // 500 RUB quarantined
      });
    } else {
      testUser = await prisma.user.update({
        where: { id: testUser.id },
        data: { balance: 0, quarantineBalance: 50000 }
      });
    }

    // Clean up previous test entries for this user
    await prisma.ledgerEntry.deleteMany({ where: { userId: testUser.id } });

    // Create the Quarantine entry
    const entry = await prisma.ledgerEntry.create({
      data: {
        userId: testUser.id,
        adminId: 'e2e-support-id', 
        amount: 50000, // 500 RUB
        reason: 'E2E_QUARANTINE_TEST',
        status: 'QUARANTINE',
      }
    });

    // 2. Go to Finance page
    await page.goto(`/admin/finance`);
    
    // 3. Verify the Quarantine list is visible
    await page.screenshot({ path: 'finance-error.png' });
    await expect(page.getByText(/транзакций в карантине Escrow/i)).toBeVisible({ timeout: 15000 });
    
    // Wait for the specific entry reason to appear
    await expect(page.getByText('E2E_QUARANTINE_TEST').first()).toBeVisible();

    // 4. Click "Одобрить" (Approve) button in the row
    // We intercept the window.confirm before clicking
    page.once('dialog', dialog => dialog.accept());

    // We locate the container with the text and find the approve button
    const quarantineCard = page.locator('div').filter({ hasText: 'E2E_QUARANTINE_TEST' }).first();
    await quarantineCard.getByRole('button', { name: /Одобрить/i }).click();

    // 5. Wait for the success toast
    await expect(page.getByText('Транзакция одобрена').first()).toBeVisible({ timeout: 10000 });

    // 6. Verify the entry was resolved in DB
    const resolvedEntry = await prisma.ledgerEntry.findUnique({ where: { id: entry.id } });
    expect(resolvedEntry?.status).toBe('APPROVE'); 

    // 7. Verify user's balance increased by 500 RUB
    const updatedUser = await prisma.user.findUnique({ where: { id: testUser.id } });
    expect(updatedUser?.balance).toBe(BigInt(50000));
    expect(updatedUser?.quarantineBalance).toBe(BigInt(0));
  });
});
