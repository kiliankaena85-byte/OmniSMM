import { test, expect } from './fixtures/auth.fixture';
import { PrismaClient } from '@prisma/client';

test.describe('Admin Panel Flow', () => {
  // Use the admin storage state (which we set up in auth.setup.ts)
  // Assuming auth.setup.ts saves state as admin if needed, or we just rely on standard auth.
  // For this test, we assume the user is logged in as ADMIN.

  test('Admin can view dashboard and user list', async ({ adminPage }) => {
    await adminPage.goto('/admin/dashboard');
    // We expect the dashboard to load without redirecting
    // We don't check for "Админ" since it might just show "Smmplan" or metrics.
    
    // Navigate to Users
    await adminPage.locator('a[href="/admin/clients"]').first().click();
    
    // The table should be visible
    await expect(adminPage.locator('table').first()).toBeVisible({ timeout: 15000 });
  });

  test('Admin can view and reply to tickets', async ({ adminPage }) => {
    // 1. Seed a test ticket into the DB so the table doesn't render empty state
    const prisma = new PrismaClient();
    let testUser = await prisma.user.findFirst({ where: { email: 'e2e-tester@test.com' } });
    if (!testUser) {
      testUser = await prisma.user.create({
        data: {
          email: 'e2e-tester@test.com',
          tenantId: 'smmplan',
          role: 'USER'
        }
      });
    }

    // Cleanup old ones to prevent conflict
    await prisma.ticket.deleteMany({
      where: { subject: 'E2E Admin Ticket Test' }
    });

    await prisma.ticket.create({
      data: {
        userId: testUser.id,
        subject: 'E2E Admin Ticket Test',
        messages: {
          create: {
            text: 'This ticket was created automatically to test the admin panel.',
            sender: 'USER'
          }
        },
        status: 'OPEN'
      }
    });
    await prisma.$disconnect();

    await adminPage.goto('/admin/tickets');
    
    // Check that the test ticket is rendered in the left panel list
    const ticketLink = adminPage.getByText('E2E Admin Ticket Test');
    await expect(ticketLink.first()).toBeVisible({ timeout: 15000 });
    
    // Click the ticket to open the chat in the center panel (wait for it to be visible first)
    await expect(ticketLink.first()).toBeVisible({ timeout: 15000 });
    await ticketLink.first().click();
    
    // Reply
    const textarea = adminPage.locator('textarea');
    await expect(textarea).toBeVisible({ timeout: 15000 });
    await textarea.fill('Admin reply to E2E test ticket');

    await adminPage.getByRole('button', { name: 'Отправить' }).click();

    // Verify it appears in chat
    await expect(adminPage.getByText('Admin reply to E2E test ticket')).toBeVisible();
  });

  test('Admin can manage quarantined services', async ({ adminPage }) => {
    // 1. Seed a quarantined service
    const prisma = new PrismaClient();
    
    // Cleanup previous runs to avoid unique constraint errors
    await prisma.service.deleteMany({ where: { name: 'E2E Quarantined Service' } });
    await prisma.provider.deleteMany({ where: { name: 'E2E Test Provider' } });
    await prisma.category.deleteMany({ where: { name: 'E2E Test Category' } });
    
    // Check if network exists, if not create
    let network = await prisma.network.findUnique({ where: { slug: 'telegram' } });
    if (!network) {
      network = await prisma.network.create({ data: { name: 'Telegram', slug: 'telegram' } });
    }
    
    // Create dummy category and provider
    const category = await prisma.category.create({
      data: { name: 'E2E Test Category', sort: 999, networkId: network.id }
    });
    
    const provider = await prisma.provider.create({
      data: { name: 'E2E Test Provider', apiUrl: 'http://test.local', apiKey: 'test_key' }
    });
    
    const service = await prisma.service.create({
      data: {
        name: 'E2E Quarantined Service',
        categoryId: category.id,
        providerId: provider.id,
        rate: 10.0,
        isQuarantined: true,
        pendingRate: 20.0,
        quarantineReason: 'E2E Price increase by 100%',
        minQty: 10,
        maxQty: 1000
      }
    });
    await prisma.$disconnect();

    // 2. Navigate to Quarantine page
    await adminPage.request.get('/api/debug?revalidate=catalog');
    await adminPage.goto('/admin/catalog/quarantine');
    
    // 3. Ensure the quarantined service is visible
    await expect(adminPage.getByText('E2E Quarantined Service').first()).toBeVisible();
    await expect(adminPage.getByText('E2E Price increase by 100%').first()).toBeVisible();

    // 4. Click 'Reject' button (Отклонить)
    await adminPage.getByRole('button', { name: /Отклонить/i }).first().click();

    // 5. Verify toast message
    await expect(adminPage.getByText('Отклонено, цена сохранена').first()).toBeVisible();
    
    // 6. Cleanup is partially done, but we should rely on db-cleaner
    // For now, let's just assert it disappears from the list
    await expect(adminPage.locator('table').getByText('E2E Quarantined Service')).not.toBeVisible();
  });

  test('Admin can view financial transactions', async ({ adminPage }) => {
    await adminPage.goto('/admin/finance');
    
    // Assuming there are charts or transaction tables
    await expect(adminPage.locator('table').first()).toBeVisible({ timeout: 15000 });
  });

  test('Admin can manually adjust user balance', async ({ adminPage }) => {
    adminPage.on('console', msg => {
      if (msg.type() === 'error') console.error('BROWSER ERROR:', msg.text());
    });
    adminPage.on('pageerror', err => console.error('PAGE EXCEPTION:', err.message));

    // 1. Create a specific test user for this test to avoid global state issues
    const prisma = new PrismaClient();
    const testUser = await prisma.user.upsert({
      where: { email: 'balance-tester@test.com' },
      update: { balance: 0 },
      create: { email: 'balance-tester@test.com', balance: 0, role: 'USER' }
    });

    // 2. Go directly to the Sheet view for this user
    await adminPage.goto(`/admin/clients?userId=${testUser.id}`);

    // 3. Wait for the 'Корректировка баланса' form to appear in the Sheet
    try {
      await expect(adminPage.getByText('Корректировка баланса').first()).toBeVisible({ timeout: 5000 });
    } catch (e) {
      const content = await adminPage.content();
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('fs');
      fs.writeFileSync('page-dump.html', content);
      throw e;
    }

    // 4. Fill in the adjustment amount and reason
    await adminPage.locator('input[name="amount"]').fill('15000'); // 150 RUB
    await adminPage.locator('input[name="reason"]').fill('E2E Deep Check Refund');

    // 5. Click apply (opens custom confirm modal)
    await adminPage.getByRole('button', { name: /Применить/i }).click();

    // 6. Accept the custom confirm modal
    await adminPage.getByRole('button', { name: 'Продолжить' }).click();

    // 7. Verify the balance is updated (either toast or network idle)
    await adminPage.waitForLoadState('networkidle');

    // 8. Assertions in DB
    // Give background fire-and-forget logs a moment to complete
    await adminPage.waitForTimeout(1000);

    const dbUser = await prisma.user.findUnique({
      where: { id: testUser.id }
    });
    expect(Number(dbUser!.balance)).toBe(15000); // 150.00 RUB in cents

    // Find the ledger entry
    const ledgerEntry = await prisma.ledgerEntry.findFirst({
      where: { userId: testUser.id },
      orderBy: { createdAt: 'desc' }
    });
    expect(ledgerEntry).not.toBeNull();
    expect(Number(ledgerEntry!.amount)).toBe(15000);
    expect(ledgerEntry!.reason).toBe('E2E Deep Check Refund');
    expect(ledgerEntry!.status).toBe('APPROVED');
    expect(ledgerEntry!.adminId).not.toBeNull();

    // Find the AdminAuditLog
    const auditLogs = await prisma.adminAuditLog.findMany({
      where: { target: testUser.id, targetType: 'USER' },
      orderBy: { createdAt: 'desc' }
    });
    const balanceChangeLog = auditLogs.find(log => log.action === 'USER_BALANCE_CHANGE');
    expect(balanceChangeLog).not.toBeUndefined();
    expect(balanceChangeLog!.adminId).toBe(ledgerEntry!.adminId);

    const oldVal = JSON.parse(balanceChangeLog!.oldValue || '{}');
    const newVal = JSON.parse(balanceChangeLog!.newValue || '{}');
    expect(oldVal.balance).toBe(0);
    expect(newVal.balance).toBe(15000);
    expect(newVal.delta).toBe(15000);
    expect(newVal.reason).toBe('E2E Deep Check Refund');

    await prisma.$disconnect();
  });

  test('Admin can update global exchange rate', async ({ adminPage }) => {
    // 1. Go to settings
    await adminPage.goto('/admin/settings?tab=catalog');
    await expect(adminPage.getByRole('heading', { name: 'Правила ценообразования' })).toBeVisible();

    // 2. Update the exchange rate
    const rateInput = adminPage.locator('input[name="exchangeRateUSD"]');
    await expect(rateInput).toBeVisible();
    await rateInput.fill('98.76');

    // 3. Save
    await adminPage.getByRole('button', { name: /Сохранить настройки каталога/i }).click();

    // 4. Verify toast
    await expect(adminPage.getByText('Настройки каталога успешно обновлены').first()).toBeVisible();
  });

  test('Standard user is redirected from /admin and /admin/dashboard to /dashboard', async ({ userPage }) => {
    await userPage.goto('/admin');
    await userPage.waitForURL('**/dashboard');
    expect(userPage.url()).toContain('/dashboard');

    await userPage.goto('/admin/dashboard');
    await userPage.waitForURL('**/dashboard');
    expect(userPage.url()).toContain('/dashboard');
  });

  test('Owner admin can access /admin/dashboard without redirection', async ({ adminPage }) => {
    const response = await adminPage.goto('/admin/dashboard');
    expect(response?.status()).toBe(200);
    expect(adminPage.url()).toContain('/admin/dashboard');
  });

  test('Admin can update service markup and it recalculates price and logs audit log', async ({ adminPage }) => {
    const prisma = new PrismaClient();
    
    // Seed service
    const network = await prisma.network.upsert({
      where: { slug: 'telegram' },
      update: {},
      create: { name: 'Telegram', slug: 'telegram', icon: 'tg' }
    });
    
    const category = await prisma.category.upsert({
      where: { slug: 'e2e-markup-test-cat' },
      update: {},
      create: { name: 'E2E Markup Test Category', slug: 'e2e-markup-test-cat', networkId: network.id }
    });
    
    const provider = await prisma.provider.upsert({
      where: { name: 'E2E Markup Provider' },
      update: {},
      create: { name: 'E2E Markup Provider', apiUrl: 'http://test.local', apiKey: 'test_key' }
    });

    // Clean any old service
    await prisma.service.deleteMany({ where: { name: 'E2E Pricing Markup Recalculation Service' } });

    const service = await prisma.service.create({
      data: {
        name: 'E2E Pricing Markup Recalculation Service',
        categoryId: category.id,
        providerId: provider.id,
        rate: 5.0, // 5.0 USD
        markup: 2.0, // 2.0x markup
        minQty: 10,
        maxQty: 1000,
        providerCurrency: 'USD',
        isActive: true
      }
    });

    // Get current exchange rate
    const settings = await prisma.systemSettings.findFirst();
    const usdToRub = settings?.exchangeRateUSD ? Number(settings.exchangeRateUSD) : 98.76;

    await prisma.$disconnect();

    // Revalidate catalog cache so the new service is visible
    await adminPage.request.get('/api/debug?revalidate=catalog');

    // Go to catalog
    await adminPage.goto('/admin/catalog?q=E2E+Pricing+Markup+Recalculation+Service');

    // Find the row for E2E Pricing Markup Recalculation Service
    const row = adminPage.locator('tr', { hasText: 'E2E Pricing Markup Recalculation Service' });
    await expect(row).toBeVisible({ timeout: 15000 });

    // Click on Edit Service button (opens Drawer)
    await row.getByRole('button', { name: /Редактировать услугу/i }).click();
 
    // Verify sheet is visible
    const sheet = adminPage.locator('[role="dialog"]');
    await expect(sheet).toBeVisible({ timeout: 5000 });
 
    // Switch to 'pricing' tab inside Sheet
    await sheet.getByRole('button', { name: 'Цены & Провайдер' }).click();
 
    // Locate the retail price input inside Sheet
    const retailPriceInput = sheet.locator('input[type="number"]').nth(2); // rate is nth 0, markup is nth 1, price is nth 2
    await expect(retailPriceInput).toBeVisible();
 
    // Fill with '1499'
    await retailPriceInput.click();
    await retailPriceInput.fill('');
    await retailPriceInput.fill('1499');
    await adminPage.waitForTimeout(500);
 
    // Save
    await sheet.getByRole('button', { name: 'Сохранить услугу' }).click();
 
    // Verify toast
    await expect(adminPage.getByText('Услуга успешно обновлена').first()).toBeVisible({ timeout: 15000 });
 
    // Assert database price is updated and recalculated
    const prismaAssert = new PrismaClient();
    const updatedService = await prismaAssert.service.findUnique({
      where: { id: service.id }
    });
 
    const expectedPriceRub = 1500; // beautiful rounded price from 1498.98
    const expectedCents = expectedPriceRub * 100;
    const expectedMarkup = 3.0356;
 
    expect(updatedService!.markup).toBeCloseTo(expectedMarkup, 4);
    expect(updatedService!.pricePer1000Cents).toBe(expectedCents);
 
    // Assert audit log exists
    const auditLog = await prismaAssert.adminAuditLog.findFirst({
      where: {
        target: service.id,
        targetType: 'SERVICE',
        action: { in: ['SERVICE_MARKUP_UPDATE', 'SERVICE_MARKUP_CHANGE', 'SERVICE_MANUAL_UPDATE'] }
      }
    });
    expect(auditLog).not.toBeNull();
    await prismaAssert.$disconnect();
  });

  test('Admin can approve price spike quarantine, and cooldown service displays as disabled to client', async ({ adminPage, userPage }) => {
    const prisma = new PrismaClient();

    const network = await prisma.network.upsert({
      where: { slug: 'telegram' },
      update: {},
      create: { name: 'Telegram', slug: 'telegram', icon: 'tg' }
    });
    
    const category = await prisma.category.upsert({
      where: { slug: 'e2e-quarantine-test-cat' },
      update: {},
      create: { name: 'E2E Quarantine Test Category', slug: 'e2e-quarantine-test-cat', networkId: network.id }
    });
    
    const provider = await prisma.provider.upsert({
      where: { name: 'E2E Quarantine Provider' },
      update: {},
      create: { name: 'E2E Quarantine Provider', apiUrl: 'http://test.local', apiKey: 'test_key' }
    });

    // Clean old ones
    await prisma.service.deleteMany({
      where: {
        OR: [
          { name: 'E2E Quarantine Service to Approve' },
          { name: 'E2E Elastic Cooldown Service Test' }
        ]
      }
    });

    // Seed quarantined service
    const serviceQuarantine = await prisma.service.create({
      data: {
        name: 'E2E Quarantine Service to Approve',
        categoryId: category.id,
        providerId: provider.id,
        rate: 10.0,
        markup: 2.0,
        minQty: 10,
        maxQty: 1000,
        providerCurrency: 'USD',
        isQuarantined: true,
        pendingRate: 30.0,
        quarantineReason: 'E2E Price spike spike',
        isActive: true
      }
    });

    // Seed cooldown service
    const serviceCooldown = await prisma.service.create({
      data: {
        name: 'E2E Elastic Cooldown Service Test',
        categoryId: category.id,
        providerId: provider.id,
        rate: 10.0,
        markup: 2.0,
        minQty: 10,
        maxQty: 1000,
        providerCurrency: 'USD',
        cooldownUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
        cooldownReason: 'API_LIMIT_REACHED',
        isActive: true
      }
    });

    await prisma.$disconnect();

    // Revalidate catalog cache
    await adminPage.request.get('/api/debug?revalidate=catalog');

    // 1. Test quarantine approval
    await adminPage.goto('/admin/catalog/quarantine');
    
    // Wait for the text to appear first
    await expect(adminPage.getByText('E2E Quarantine Service to Approve').first()).toBeVisible({ timeout: 15000 });
    
    // Find the row containing this text
    const row = adminPage.locator('tr').filter({ hasText: 'E2E Quarantine Service to Approve' });

    // Click ✅ Принять
    await row.getByRole('button', { name: '✅ Принять' }).first().click();

    // Expect toast
    await expect(adminPage.getByText('✅ Принято: E2E Quarantine Service to Approve').first()).toBeVisible({ timeout: 15000 });

    // Assert DB updated
    const prismaAssert = new PrismaClient();
    const updatedQuarantine = await prismaAssert.service.findUnique({
      where: { id: serviceQuarantine.id }
    });
    expect(updatedQuarantine!.isQuarantined).toBe(false);
    expect(updatedQuarantine!.rate).toBe(30.0);
    expect(updatedQuarantine!.pendingRate).toBeNull();

    // Assert audit log for QUARANTINE_APPROVE
    const quarantineAudit = await prismaAssert.adminAuditLog.findFirst({
      where: {
        target: serviceQuarantine.id,
        targetType: 'SERVICE',
        action: 'QUARANTINE_APPROVE'
      }
    });
    expect(quarantineAudit).not.toBeNull();

    // 2. Test cooldown display on client page
    await userPage.goto('/dashboard/new-order');
    await expect(userPage.locator('h1', { hasText: 'Новый заказ' })).toBeVisible();

    // Fill link to select network (Telegram)
    const urlInput = userPage.locator('#order-url');
    await expect(urlInput).toBeVisible();
    await urlInput.fill('https://t.me/durov');
    await urlInput.press('Enter');

    // Select the category explicitly to load quarantine test services
    const categoryTrigger = userPage.locator('button', { hasText: 'E2E' }).first();
    await expect(categoryTrigger).toBeVisible();
    await categoryTrigger.click();

    const categoryOption = userPage.getByRole('option', { name: 'E2E Quarantine Test Category' });
    await expect(categoryOption).toBeVisible();
    await categoryOption.click();

    // Open the service selection dropdown
    const selectTrigger = userPage.locator('button:has-text("-- Выберите услугу --")');
    await expect(selectTrigger).toBeVisible({ timeout: 15000 });
    await selectTrigger.click();

    // Verify option is disabled and contains the temporary unavailable warning
    const option = userPage.getByRole('option', { name: /E2E Elastic Cooldown Service Test/i });
    await expect(option).toBeVisible();
    await expect(option).toBeDisabled();
    await expect(option).toContainText('временно недоступно');

    await prismaAssert.$disconnect();
  });

  test.afterAll(async () => {
    const prisma = new PrismaClient();
    
    // Clean up tickets and their messages
    await prisma.ticket.deleteMany({
      where: {
        OR: [
          { subject: { startsWith: 'E2E ' } },
          { user: { email: { in: ['e2e-tester@test.com', 'balance-tester@test.com'] } } }
        ]
      }
    });

    await prisma.service.deleteMany({
      where: { name: { in: [
        'E2E Quarantined Service', 
        'E2E Pricing Markup Recalculation Service', 
        'E2E Quarantine Service to Approve', 
        'E2E Elastic Cooldown Service Test'
      ] } }
    });
    await prisma.category.deleteMany({
      where: { name: { in: [
        'E2E Test Category', 
        'E2E Markup Test Category', 
        'E2E Quarantine Test Category'
      ] } }
    });
    await prisma.provider.deleteMany({
      where: { name: { in: [
        'E2E Test Provider', 
        'E2E Markup Provider', 
        'E2E Quarantine Provider'
      ] } }
    });
    
    try {
      const testerUser = await prisma.user.findFirst({ where: { email: 'balance-tester@test.com' } });
      if (testerUser) {
        // Skip ledger deletion because ledger is immutable
        try {
          await prisma.user.delete({ where: { id: testerUser.id } });
        } catch {
          // ignore or keep log clean
        }
      }
    } catch {
      // ignore
    }

    // Clean up admin audit logs created by test runs
    await prisma.adminAuditLog.deleteMany({
      where: {
        OR: [
          { adminEmail: 'e2e-tester@test.com', action: 'USER_BALANCE_CHANGE' },
          { adminEmail: 'e2e-tester@test.com', action: { in: ['SERVICE_MARKUP_UPDATE', 'SERVICE_MARKUP_CHANGE', 'QUARANTINE_APPROVE'] } }
        ]
      }
    });

    await prisma.$disconnect();
  });
});
