import { test, expect } from './fixtures/auth.fixture';
import { PrismaClient } from '@prisma/client';

test.describe('Providers Integration Flow', () => {
  let previouslyActiveProviderIds: string[] = [];

  test.beforeAll(async () => {
    const prisma = new PrismaClient();
    try {
      const activeProviders = await prisma.provider.findMany({
        where: { isActive: true },
        select: { id: true }
      });
      previouslyActiveProviderIds = activeProviders.map(p => p.id);
    } finally {
      await prisma.$disconnect();
    }
  });

  test.beforeEach(async () => {
    // We could seed db here if needed, but we will mostly test UI interactions
  });

  test('Admin can navigate to Providers list and see elements', async ({ adminPage }) => {
    await adminPage.goto('/admin/providers');
    
    // Check page title
    await expect(adminPage.getByRole('heading', { name: 'Провайдеры API' })).toBeVisible();
    
    // Check for standard buttons
    await expect(adminPage.getByRole('link', { name: '+ Подключить Панель' })).toBeVisible();
    await expect(adminPage.getByRole('link', { name: 'Импорт Услуг' })).toBeVisible();
  });

  test('Admin can open provider creation form and validate fields', async ({ adminPage }) => {
    adminPage.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    adminPage.on('pageerror', err => console.error('BROWSER ERROR:', err.message));

    await adminPage.goto('/admin/providers');
    
    // Click "+ Подключить Панель"
    await adminPage.getByRole('link', { name: '+ Подключить Панель' }).click();
 
    // Check page opens
    await expect(adminPage.getByRole('heading', { name: 'Новое подключение' })).toBeVisible();

    // Wait for hydration/rendering to settle
    await adminPage.waitForTimeout(1000);

    // Try saving empty form
    await adminPage.getByRole('button', { name: 'Создать провайдера' }).click();

    // Expect validation errors
    await expect(adminPage.locator('text=API Ключ обязателен').first()).toBeVisible({ timeout: 5000 });
  });

  test('Admin can test provider connection (fake URL)', async ({ adminPage }) => {
    const prisma = new PrismaClient();
    let provider = await prisma.provider.findFirst({ where: { name: 'E2E Connection Test Provider' } });
    if (!provider) {
      // eslint-disable-next-line no-useless-assignment
      provider = await prisma.provider.create({ 
        data: { name: 'E2E Connection Test Provider', apiUrl: 'http://localhost:9999/api/v2', apiKey: 'fake_key_123', isActive: true } 
      });
    } else {
      await prisma.provider.update({ where: { id: provider.id }, data: { apiUrl: 'http://localhost:9999/api/v2', apiKey: 'fake_key_123', isActive: true } });
    }
    await prisma.$disconnect();

    await adminPage.goto('/admin/providers');
    
    // Find the connection test provider in table and click "Настроить"
    const row = adminPage.locator('tr', { hasText: 'E2E Connection Test Provider' });
    await row.getByRole('link', { name: 'Настроить' }).click();

    // Expect to be on Edit page
    await expect(adminPage.getByRole('heading', { name: 'Новое подключение' })).not.toBeVisible();

    // Click test connection
    await adminPage.getByRole('button', { name: 'Протестировать API соединение' }).click();

    // Should fail because localhost:9999 is not serving the API
    await expect(adminPage.getByText(/Ошибка:|Failed to fetch|Network error|Ошибка соединения/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('Import Wizard loads successfully', async ({ adminPage }) => {
    const prisma = new PrismaClient();
    let provider = await prisma.provider.findFirst({ where: { name: 'E2E Fake Provider' } });
    if (!provider) {
      // eslint-disable-next-line no-useless-assignment
      provider = await prisma.provider.create({ 
        data: { name: 'E2E Fake Provider', apiUrl: 'http://test.local', apiKey: 'test_key', isActive: true } 
      });
    } else if (!provider.isActive) {
      await prisma.provider.update({ where: { id: provider.id }, data: { isActive: true } });
    }

    await adminPage.goto('/admin/providers/import');

    // Expect the title
    await expect(adminPage.getByRole('heading', { name: 'Импорт Услуг' })).toBeVisible();

    // Expect the provider to be in the selection list
    const selectTrigger = adminPage.locator('[data-slot="select-trigger"]').first();
    await expect(selectTrigger).toBeVisible();
    await selectTrigger.click();
    await expect(adminPage.locator('[data-slot="select-item"]', { hasText: 'E2E Fake Provider' }).first()).toBeVisible();
    
    await prisma.$disconnect();
  });

  test('Admin can import service via Cherry-Pick Wizard', async ({ adminPage }) => {
    const prisma = new PrismaClient();
    
    // Deactivate all existing providers to ensure the mock provider is auto-selected
    await prisma.provider.updateMany({ data: { isActive: false } });
    
    // Ensure network `telegram` exists
    const network = await prisma.network.upsert({
      where: { slug: 'telegram' },
      update: {},
      create: { name: 'Telegram', slug: 'telegram', icon: 'tg' }
    });
    
    // Ensure category `e2e-telegram-subs-cat` exists with name 'E2E Telegram Subscribers' under network `telegram`
    const category = await prisma.category.upsert({
      where: { slug: 'e2e-telegram-subs-cat' },
      update: {},
      create: {
        name: 'E2E Telegram Subscribers',
        slug: 'e2e-telegram-subs-cat',
        networkId: network.id
      }
    });

    // Create a provider 'Mock Provider for Import' with apiUrl 'http://localhost:3001/api/dev/mock-provider'
    // and apiKey using process.env.MOCK_PROVIDER_KEY (fallback to 'dev_mock_key') and isActive: true
    const provider = await prisma.provider.upsert({
      where: { name: 'Mock Provider for Import' },
      update: {
        apiUrl: 'http://localhost:3001/api/dev/mock-provider',
        apiKey: process.env['MOCK_PROVIDER_KEY'] || 'dev_mock_key',
        isActive: true
      },
      create: {
        name: 'Mock Provider for Import',
        apiUrl: 'http://localhost:3001/api/dev/mock-provider',
        apiKey: process.env['MOCK_PROVIDER_KEY'] || 'dev_mock_key',
        isActive: true
      }
    });

    const prisma = new PrismaClient();

    try {
      // Delete any service in Postgres with externalId '100' or name 'Mock Telegram Followers'
      await prisma.service.deleteMany({
        where: {
          OR: [
            { externalId: '100' },
            { name: 'Mock Telegram Followers' }
          ]
        }
      });

      // AUD-12: the shadow catalog lives in the ShadowService table now —
      // clear it so the wizard shows the 'Каталог провайдера пуст' empty state
      await prisma.shadowService.deleteMany({ where: { providerId: provider.id } });

      // Navigate to /admin/providers/import
      await adminPage.goto('/admin/providers/import');

      // Verify the "Каталог провайдера пуст" view is shown, and click the "Загрузить каталог" button
      await expect(adminPage.getByText('Каталог провайдера пуст').first()).toBeVisible();
      await adminPage.getByRole('button', { name: 'Загрузить каталог' }).click();

      // Wait for the services table to be visible
      const table = adminPage.locator('table');
      await expect(table).toBeVisible({ timeout: 15000 });

      // Find the row containing text "Mock Telegram Followers" and check its checkbox
      const row = adminPage.locator('tr', { hasText: 'Mock Telegram Followers' });
      await expect(row).toBeVisible();
      const checkbox = row.locator('input[type="checkbox"]');
      await checkbox.check();

      // Find the markup input (label: "Наценка (%)") and fill it with '75'
      const markupInput = adminPage.locator('div:has-text("Наценка (%)") >> input[type="number"]');
      await markupInput.fill('75');

      // Click the "Импортировать выбранные" button
      await adminPage.getByRole('button', { name: /Импортировать выбранные/ }).click();

      // In the confirmation modal, click the button ✅ Подтвердить импорт
      await adminPage.getByRole('button', { name: '✅ Подтвердить импорт' }).click();

      // Wait for success toast / notification
      await expect(adminPage.getByText('Успешно импортировано').first()).toBeVisible({ timeout: 15000 });

      // Assert that the service is successfully created in PostgreSQL with markup set to 1.75, externalId to 100, name to 'Mock Telegram Followers', and associated with the category
      const service = await prisma.service.findFirst({
        where: {
          externalId: '100',
          providerId: provider.id
        }
      });

      expect(service).not.toBeNull();
      expect(service!.name).toBe('Mock Telegram Followers');
      expect(service!.markup).toBe(1.75);
      expect(service!.categoryId).toBe(category.id);
    } finally {
      // Cleanup: delete the imported service, the provider, and the shadow catalog
      await prisma.service.deleteMany({
        where: {
          externalId: '100',
          providerId: provider.id
        }
      });
      await prisma.shadowService.deleteMany({ where: { providerId: provider.id } });
      await prisma.provider.delete({
        where: { id: provider.id }
      });
      await prisma.$disconnect();
    }
  });

  test('Admin can perform Provider CRUD operations and verify Audit Logs', async ({ adminPage }) => {
    const prisma = new PrismaClient();
    const providerName = 'E2E CRUD Provider';
    const editedProviderName = 'E2E CRUD Provider Edited';

    // Cleanup before starting to ensure clean state
    await prisma.provider.deleteMany({ where: { name: { in: [providerName, editedProviderName] } } });
    await prisma.adminAuditLog.deleteMany({
      where: {
        action: { in: ['PROVIDER_CREATE', 'PROVIDER_UPDATE'] },
        targetType: 'PROVIDER',
      }
    });

    try {
      // a. Create Provider
      await adminPage.goto('/admin/providers/new');
      await adminPage.locator('#provider-name').fill(providerName);
      await adminPage.locator('#provider-url').fill('http://localhost:3001/api/dev/mock-provider');
      await adminPage.locator('#provider-key').fill('dev_mock_key');
      await adminPage.locator('#provider-currency').selectOption('RUB');

      // Click create button
      await adminPage.getByRole('button', { name: 'Создать провайдера' }).click();

      // Verify it redirects to /admin/providers and shows a success toast
      await expect(adminPage).toHaveURL(/\/admin\/providers$/);
      await expect(adminPage.getByText('Провайдер успешно добавлен.').first()).toBeVisible();

      // Verify in DB
      const createdProvider = await prisma.provider.findFirst({
        where: { name: providerName }
      });
      expect(createdProvider).not.toBeNull();
      expect(createdProvider!.balanceCurrency).toBe('RUB');

      const createAuditLog = await prisma.adminAuditLog.findFirst({
        where: {
          action: 'PROVIDER_CREATE',
          targetType: 'PROVIDER',
          target: createdProvider!.id
        }
      });
      expect(createAuditLog).not.toBeNull();

      // b. Edit Provider
      // Locate the newly created provider in table and click "Настроить"
      const row = adminPage.locator('tr', { hasText: providerName });
      await row.getByRole('link', { name: 'Настроить' }).click();

      // Edit Name
      await adminPage.locator('#provider-name').fill(editedProviderName);

      // Save
      await adminPage.getByRole('button', { name: 'Сохранить изменения провайдера' }).click();

      // Verify success toast
      await expect(adminPage.getByText('Настройки провайдера сохранены.').first()).toBeVisible();

      // Verify in DB
      const updatedProvider = await prisma.provider.findUnique({
        where: { id: createdProvider!.id }
      });
      expect(updatedProvider).not.toBeNull();
      expect(updatedProvider!.name).toBe(editedProviderName);

      const updateAuditLog = await prisma.adminAuditLog.findFirst({
        where: {
          action: 'PROVIDER_UPDATE',
          targetType: 'PROVIDER',
          target: createdProvider!.id
        }
      });
      expect(updateAuditLog).not.toBeNull();

      // c. Delete Provider (AUD-01/AUD-12): delete button + confirmation modal with impact counts
      const editRow = adminPage.locator('tr', { hasText: editedProviderName });
      await editRow.locator('button[title="Удалить провайдера"]').click();

      // Confirmation modal appears with the provider name and counters
      const confirmDialog = adminPage.getByText(`Удалить провайдера «${editedProviderName}»?`);
      await expect(confirmDialog).toBeVisible();
      await expect(adminPage.getByText('Услуг').first()).toBeVisible();
      await expect(adminPage.getByText('Заказов').first()).toBeVisible();

      await adminPage.getByRole('button', { name: 'Да, удалить' }).click();

      // Provider is gone from the database
      await expect
        .poll(async () => {
          const stillExists = await prisma.provider.findUnique({ where: { id: createdProvider!.id } });
          return stillExists === null;
        }, { timeout: 10000 })
        .toBe(true);

      // PROVIDER_DELETE audit entry is written
      const deleteAuditLog = await prisma.adminAuditLog.findFirst({
        where: {
          action: 'PROVIDER_DELETE',
          targetType: 'PROVIDER',
          target: createdProvider!.id
        }
      });
      expect(deleteAuditLog).not.toBeNull();

    } finally {
      // d. Cleanup
      await prisma.service.updateMany({
        where: { providerId: createdProvider?.id ?? 'nonexistent' },
        data: { providerId: null }
      }).catch(() => {});
      await prisma.serviceRoute.deleteMany({ where: { providerId: createdProvider?.id ?? 'nonexistent' } });
      await prisma.provider.deleteMany({ where: { name: { in: [providerName, editedProviderName] } } });
      await prisma.adminAuditLog.deleteMany({
        where: {
          targetType: 'PROVIDER',
          action: { in: ['PROVIDER_CREATE', 'PROVIDER_UPDATE', 'PROVIDER_DELETE'] }
        }
      });
      await prisma.$disconnect();
    }
  });

  test.afterAll(async () => {
    const prisma = new PrismaClient();
    try {
      // Restore previously active providers
      if (previouslyActiveProviderIds.length > 0) {
        await prisma.provider.updateMany({
          where: { id: { in: previouslyActiveProviderIds } },
          data: { isActive: true }
        });
      }
      
      // Clean up test providers
      await prisma.provider.deleteMany({
        where: {
          name: {
            in: [
              'E2E Connection Test Provider',
              'E2E Fake Provider',
              'Mock Provider for Import',
              'E2E CRUD Provider',
              'E2E CRUD Provider Edited'
            ]
          }
        }
      });
      
      // Clean up services associated with categories starting with E2E
      await prisma.service.deleteMany({
        where: {
          name: {
            in: [
              'Mock Telegram Followers'
            ]
          }
        }
      });
      
      // Clean up category and network if created starting with E2E
      await prisma.category.deleteMany({
        where: {
          name: {
            in: [
              'E2E Telegram Subscribers'
            ]
          }
        }
      });
      
      // Delete admin audit logs related to test providers
      await prisma.adminAuditLog.deleteMany({
        where: {
          targetType: 'PROVIDER',
          action: { in: ['PROVIDER_CREATE', 'PROVIDER_UPDATE', 'PROVIDER_DELETE'] },
        }
      });
    } finally {
      await prisma.$disconnect();
    }
  });

});
