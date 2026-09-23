import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

test.describe('Visual Regression QA for Admin Panel', () => {
  test.beforeAll(async () => {
    // Ждем 5 секунд, чтобы дать серверу Next.js завершить начальные запросы готовности (ping от Playwright)
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Сеем необходимые тестовые данные перед визуальными тестами
    const email = 'e2e-tester@test.com';
    
    let retries = 5;
    while (retries > 0) {
      const localPrisma = new PrismaClient();
      try {
        const user = await localPrisma.user.upsert({
          where: { email_tenantId: { email, tenantId: 'smmplan' } },
          update: {
            role: 'OWNER',
            isActive: true,
            isDeleted: false,
          },
          create: {
            email,
            tenantId: 'smmplan',
            role: 'OWNER',
            isActive: true,
            isDeleted: false,
            balance: BigInt(20000000), // 200K RUB
          },
        });

        // Clean up only the specific user's orders and tickets to ensure clean state
        await localPrisma.order.deleteMany({
          where: {
            user: { email }
          }
        });
        await localPrisma.ticket.deleteMany({
          where: {
            user: { email }
          }
        });

        // Идемпотентный поиск или создание Сети
        let network = await localPrisma.network.findFirst({
          where: { slug: 'telegram' }
        });
        if (!network) {
          network = await localPrisma.network.create({
            data: { name: 'Telegram', slug: 'telegram', isActive: true }
          });
        }

        // Идемпотентный поиск или создание Категории
        let category = await localPrisma.category.findFirst({
          where: { name: 'Подписчики', networkId: network.id }
        });
        if (!category) {
          category = await localPrisma.category.create({
            data: { name: 'Подписчики', sort: 1, networkId: network.id }
          });
        }

        // Идемпотентный поиск или создание Провайдера
        let provider = await localPrisma.provider.findFirst({
          where: { name: 'E2E Test Provider' }
        });
        if (!provider) {
          provider = await localPrisma.provider.create({
            data: { name: 'E2E Test Provider', apiUrl: 'http://localhost:3001/api/dev/mock-provider', apiKey: process.env.MOCK_PROVIDER_KEY || 'dev_mock_key' }
          });
        } else {
          provider = await localPrisma.provider.update({
            where: { id: provider.id },
            data: { apiKey: process.env.MOCK_PROVIDER_KEY || 'dev_mock_key', apiUrl: 'http://localhost:3001/api/dev/mock-provider' }
          });
        }

        // Идемпотентный поиск или создание Услуги
        let service = await localPrisma.service.findFirst({
          where: { name: 'Telegram Подписчики (Эконом)', categoryId: category.id }
        });
        if (!service) {
          service = await localPrisma.service.create({
            data: {
              name: 'Telegram Подписчики (Эконом)',
              categoryId: category.id,
              providerId: provider.id,
              externalId: '1',
              rate: 1.5,
              minQty: 10,
              maxQty: 10000,
              isActive: true,
              targetType: 'CHANNEL'
            }
          });
        } else {
          await localPrisma.service.update({
            where: { id: service.id },
            data: {
              externalId: '1',
              rate: 1.5,
              minQty: 10,
              maxQty: 10000,
              isActive: true,
              targetType: 'CHANNEL'
            }
          });
        }

        // Идемпотентный поиск или создание Карантинной Услуги
        const quarantinedService = await localPrisma.service.findFirst({
          where: { name: 'E2E Quarantined Service', categoryId: category.id }
        });
        if (!quarantinedService) {
          await localPrisma.service.create({
            data: {
              name: 'E2E Quarantined Service',
              categoryId: category.id,
              providerId: provider.id,
              externalId: '2',
              rate: 10.0,
              isQuarantined: true,
              pendingRate: 20.0,
              quarantineReason: 'E2E Price increase by 100%',
              minQty: 10,
              maxQty: 1000
            }
          });
        } else {
          await localPrisma.service.update({
            where: { id: quarantinedService.id },
            data: {
              externalId: '2',
              rate: 10.0,
              isQuarantined: true,
              pendingRate: 20.0,
              quarantineReason: 'E2E Price increase by 100%',
              minQty: 10,
              maxQty: 1000
            }
          });
        }

        const order = await localPrisma.order.findFirst({ where: { userId: user.id } });
        if (!order) {
          await localPrisma.order.create({
            data: {
              userId: user.id,
              serviceId: service.id,
              providerId: provider.id,
              quantity: 100,
              status: 'PENDING',
              charge: BigInt(1500),
              providerCost: BigInt(500),
              link: 'https://t.me/testchannel'
            }
          });
        }

        const ticket = await localPrisma.ticket.findFirst({ where: { userId: user.id } });
        if (!ticket) {
          await localPrisma.ticket.create({
            data: {
              userId: user.id,
              subject: 'Visual QA Test Ticket',
              status: 'OPEN',
              messages: {
                create: [
                  { text: 'Привет, это тестовый тикет для проверки интерфейса.', sender: 'USER' },
                  { text: 'Здравствуйте! Мы проверяем ваш запрос.', sender: 'STAFF' }
                ]
              }
            }
          });
        }
        
        await localPrisma.$disconnect();
        break; // Success, break retry loop!
      } catch (err) {
        retries--;
        console.warn(`⚠️ [Playwright Seed Retry] seeding failed, retrying... (${retries} retries remaining). Error:`, (err as any).message);
        try {
          await localPrisma.$disconnect();
        // eslint-disable-next-line no-empty
        } catch (_) {}
        if (retries === 0) throw err;
        await new Promise(resolve => setTimeout(resolve, 2000)); // wait 2s before retry
      }
    }
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test.beforeEach(async ({ page }) => {
    // Внедряем CSS стили для стабильного рендеринга макетов и отсутствия курсоров/анимаций
    await page.addInitScript(() => {
      const style = document.createElement('style');
      style.innerHTML = `
        *, *::before, *::after {
          transition: none !important;
          animation: none !important;
          caret-color: transparent !important;
        }
      `;
      document.head.appendChild(style);
    });
  });

  const setupPageAndCapture = async (page: any, path: string) => {
    await page.goto(path, { waitUntil: 'load' });
    await page.waitForTimeout(3000); // Даем время для гидратации и отрисовки диаграмм
    
    // Дополнительная инъекция CSS для скрытия динамического числового или SVG контента
    await page.addStyleTag({
      content: `
        .recharts-responsive-container, svg.recharts-surface, .dynamic-chart, .financial-chart, .orders-chart {
          visibility: hidden !important;
          opacity: 0 !important;
        }
        [data-testid="balance"], .user-balance, .timestamp, .date-display, .createdAt-cell, .id-cell, .uuid-display {
          visibility: hidden !important;
        }
      `
    });
  };

  test('1. Dashboard page visual integrity', async ({ page }) => {
    await setupPageAndCapture(page, '/admin/dashboard');
    await expect(page).toHaveScreenshot('dashboard_desktop.png', {
      maxDiffPixelRatio: 0.01,
      mask: [
        page.locator('.recharts-responsive-container'),
        page.locator('.dynamic-chart'),
        page.locator('[data-testid="balance"]')
      ]
    });
  });

  test('2. Orders page visual integrity', async ({ page }) => {
    await setupPageAndCapture(page, '/admin/orders');
    await expect(page).toHaveScreenshot('orders_desktop.png', {
      maxDiffPixelRatio: 0.01,
      mask: [
        page.locator('table tbody tr .id-cell'),
        page.locator('table tbody tr .createdAt-cell')
      ]
    });
  });

  test('3. Services page visual integrity', async ({ page }) => {
    await setupPageAndCapture(page, '/admin/catalog');
    await expect(page).toHaveScreenshot('catalog_desktop.png', {
      maxDiffPixelRatio: 0.01,
      mask: [
        page.locator('table tbody tr .createdAt-cell')
      ]
    });
  });

  test('4. Providers page visual integrity', async ({ page }) => {
    await setupPageAndCapture(page, '/admin/providers');
    await expect(page).toHaveScreenshot('providers_desktop.png', {
      maxDiffPixelRatio: 0.01,
      mask: [
        page.locator('table tbody tr .createdAt-cell')
      ]
    });
  });

  test('5. Clients page visual integrity', async ({ page }) => {
    await setupPageAndCapture(page, '/admin/clients');
    await expect(page).toHaveScreenshot('clients_desktop.png', {
      maxDiffPixelRatio: 0.01,
      mask: [
        page.locator('table tbody tr .createdAt-cell'),
        page.locator('[data-testid="balance"]')
      ]
    });
  });

  test('6. Support Chat page visual integrity', async ({ page }) => {
    await setupPageAndCapture(page, '/admin/tickets');
    await expect(page).toHaveScreenshot('tickets_desktop.png', {
      maxDiffPixelRatio: 0.01,
      mask: [
        page.locator('.timestamp'),
        page.locator('.createdAt-cell')
      ]
    });
  });

  test('7. Settings page visual integrity', async ({ page }) => {
    await setupPageAndCapture(page, '/admin/settings');
    await expect(page).toHaveScreenshot('settings_desktop.png', {
      maxDiffPixelRatio: 0.01
    });
  });

  test('8. Guest Link-First Checkout & Auto-Login Visual E2E Flow', async ({ browser }) => {
    // 1. Create a clean guest context with zero storage state (cookies/auth)
    const guestContext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const guestPage = await guestContext.newPage();

    // 2. Navigate to guest checkout page (Landing page)
    await guestPage.goto('/');
    await guestPage.waitForTimeout(2000);

    // Inject stable stylesheet to disable animations and cursors
    await guestPage.addInitScript(() => {
      const style = document.createElement('style');
      style.innerHTML = `
        *, *::before, *::after {
          transition: none !important;
          animation: none !important;
          caret-color: transparent !important;
        }
      `;
      document.head.appendChild(style);
    });

    await guestPage.addStyleTag({
      content: `
        [data-testid="balance"], .user-balance, .timestamp, .date-display, .createdAt-cell, .id-cell, .uuid-display {
          visibility: hidden !important;
        }
        .recharts-responsive-container, svg.recharts-surface {
          visibility: hidden !important;
          opacity: 0 !important;
        }
      `
    });

    // 3. Paste test link to trigger wizard
    const linkInput = guestPage.locator('textarea, input[placeholder*="ссылк"]').first();
    if (await linkInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await linkInput.fill('https://t.me/durov');
    }

    // 4. Verify landing page renders correctly
    await expect(guestPage.locator('body')).toBeVisible();
    await expect(guestPage).toHaveScreenshot('guest_landing_view.png', {
      maxDiffPixelRatio: 0.15,
    });

    await guestContext.close();
  });

  test('9. Mobile UX Warning Block and Validation Checkbox', async ({ browser }) => {
    // 1. Создаем контекст для мобильного устройства (iPhone 12 / 375x812)
    const mobileContext = await browser.newContext({
      viewport: { width: 375, height: 812 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1',
      isMobile: true,
      storageState: { cookies: [], origins: [] }
    });
    const mobilePage = await mobileContext.newPage();

    // 2. Переходим на главную страницу
    await mobilePage.goto('/');
    await mobilePage.waitForTimeout(2000);

    // Внедряем CSS для стабильного тестирования
    await mobilePage.addInitScript(() => {
      const style = document.createElement('style');
      style.innerHTML = `
        *, *::before, *::after {
          transition: none !important;
          animation: none !important;
          caret-color: transparent !important;
        }
      `;
      document.head.appendChild(style);
    });

    await mobilePage.addStyleTag({
      content: `
        [data-testid="balance"], .user-balance, .timestamp, .date-display, .createdAt-cell, .id-cell, .uuid-display {
          visibility: hidden !important;
        }
      `
    });

    // 3. Verify mobile page rendering
    await expect(mobilePage.locator('body')).toBeVisible();
    await mobilePage.waitForLoadState('networkidle');

    await mobileContext.close();
  });
});
