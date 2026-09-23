import { test, expect } from './fixtures/auth.fixture';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPageError(page: any): Promise<string | null> {
  const currentUrl = page.url();
  if (currentUrl.includes('/login')) {
    return 'Redirected to /login';
  }

  // Attempt to evaluate page body multiple times if context gets destroyed due to client transitions
  for (let i = 0; i < 3; i++) {
    try {
      const isErrorText = await page.evaluate(() => {
        const bodyText = document.body.innerText;
        if (bodyText.includes('Страница не найдена')) return 'Страница не найдена';
        if (bodyText.includes('Что-то пошло не так')) return 'Что-то пошло не так';
        if (bodyText.includes('Internal Server Error')) return 'Internal Server Error';
        if (bodyText.includes('Application error')) return 'Application error';
        return null;
      });
      return isErrorText;
    } catch (err: any) {
      if (err.message.includes('Execution context was destroyed')) {
        await page.waitForTimeout(500);
        continue;
      }
      return `Evaluation error: ${err.message}`;
    }
  }
  return null;
}

test.describe('Auth-Zone Routes E2E Testing', () => {
  let testNetwork: any;
  let testUser: any;
  let testCategory: any;
  let testProvider: any;
  let testService: any;
  let testOrder: any;
  let testPayment: any;
  let testTicket: any;
  let testContentPage: any;
  let testArticle: any;

  test.beforeAll(async () => {
    // 1. Seed global dependencies
    testUser = await prisma.user.create({
      data: {
        email: `e2e-routing-client-${Date.now()}@example.com`,
        role: 'USER',
        balance: 50000,
      }
    });

    testNetwork = await prisma.network.create({
      data: {
        name: `E2E Network ${Date.now()}`,
        slug: `e2e-net-${Date.now()}`,
        icon: 'Instagram',
      }
    });

    testCategory = await prisma.category.create({
      data: {
        name: `E2E Routing Category ${Date.now()}`,
        slug: `e2e-routing-cat-${Date.now()}`,
        networkId: testNetwork.id,
      }
    });

    testProvider = await prisma.provider.create({
      data: {
        name: `E2E Routing Provider ${Date.now()}`,
        apiUrl: 'https://api.routing-test.com/',
        apiKey: 'test-api-key',
        isActive: true,
      }
    });

    testService = await prisma.service.create({
      data: {
        name: `E2E Routing Service ${Date.now()}`,
        categoryId: testCategory.id,
        providerId: testProvider.id,
        rate: 1.5,
        minQty: 10,
        maxQty: 1000,
        isActive: true,
        externalId: 'ext-svc-123',
      }
    });

    testOrder = await prisma.order.create({
      data: {
        userId: testUser.id,
        serviceId: testService.id,
        providerId: testProvider.id,
        link: 'https://instagram.com/p/test',
        quantity: 100,
        charge: 300,
        providerCost: 150,
        status: 'PENDING',
      }
    });

    testPayment = await prisma.payment.create({
      data: {
        userId: testUser.id,
        amount: 1000,
        currency: 'RUB',
        status: 'SUCCEEDED',
        gateway: 'yookassa',
        gatewayId: `yookassa-pay-${Date.now()}`,
      }
    });

    testTicket = await prisma.ticket.create({
      data: {
        userId: testUser.id,
        subject: 'E2E Routing Test Ticket',
        status: 'OPEN',
        source: 'WEB',
        orderId: testOrder.id,
        paymentId: testPayment.id,
      }
    });

    testContentPage = await prisma.contentItem.create({
      data: {
        slug: `e2e-routing-page-${Date.now()}`,
        title: 'E2E Routing Page',
        type: 'PAGE',
        contentHtml: '<p>Hello world</p>',
        isPublished: true,
      }
    });

    testArticle = await prisma.article.create({
      data: {
        slug: `e2e-routing-art-${Date.now()}`,
        title: 'E2E Routing Test Article',
        content: 'Test markdown article content',
        description: 'Test description',
        category: 'General',
        status: 'PUBLISHED',
      }
    });
  });

  test.afterAll(async () => {
    // 2. Cascade delete seeded test records
    if (testArticle) await prisma.article.delete({ where: { id: testArticle.id } });
    if (testContentPage) await prisma.contentItem.delete({ where: { id: testContentPage.id } });
    if (testTicket) await prisma.ticket.delete({ where: { id: testTicket.id } });
    if (testPayment) await prisma.payment.delete({ where: { id: testPayment.id } });
    if (testOrder) await prisma.order.delete({ where: { id: testOrder.id } });
    if (testService) await prisma.service.delete({ where: { id: testService.id } });
    if (testCategory) await prisma.category.delete({ where: { id: testCategory.id } });
    if (testNetwork) await prisma.network.delete({ where: { id: testNetwork.id } });
    if (testProvider) await prisma.provider.delete({ where: { id: testProvider.id } });
    if (testUser) await prisma.user.delete({ where: { id: testUser.id } });
    await prisma.$disconnect();
  });

  test('User static and dynamic dashboard routes crawl', async ({ userPage }) => {
    // Set generous timeout for compilation overhead
    test.setTimeout(180000);

    // 1. Identify dynamic user from session to bypass IDOR restrictions
    const user = await prisma.user.findFirst({
      where: { email: { startsWith: 'test-user-' } },
      orderBy: { createdAt: 'desc' }
    });
    if (!user) throw new Error('[E2E] Dynamic fixture user not found in database');

    // Create user-specific order and ticket to test dynamic details routes
    const userOrder = await prisma.order.create({
      data: {
        userId: user.id,
        serviceId: testService.id,
        providerId: testProvider.id,
        link: 'https://instagram.com/p/user-test',
        quantity: 100,
        charge: 300,
        providerCost: 150,
        status: 'PENDING',
      }
    });

    const userTicket = await prisma.ticket.create({
      data: {
        userId: user.id,
        subject: 'E2E User Ticket',
        status: 'OPEN',
        source: 'WEB',
      }
    });

    const userRoutes = [
      '/dashboard',
      '/dashboard/add-funds',
      '/dashboard/new-order',
      '/dashboard/orders',
      `/dashboard/orders/${userOrder.id}`,
      '/dashboard/referrals',
      '/dashboard/settings',
      '/dashboard/settings/api',
      '/dashboard/smart-drip',
      '/dashboard/tickets',
      `/dashboard/tickets/${userTicket.id}`,
      '/dashboard/transactions'
    ];

    const failedRoutes: string[] = [];

    try {
      for (const route of userRoutes) {
        console.log(`[E2E userPage] Visiting: ${route}`);
        try {
          const response = await userPage.goto(route, { waitUntil: 'domcontentloaded', timeout: 60000 });
          
          const errorMsg = await checkPageError(userPage);
          if (errorMsg) {
            console.error(`[E2E userPage] FAILED route: ${route} (status: ${response?.status()}, error: ${errorMsg})`);
            failedRoutes.push(`${route} (${errorMsg})`);
          }
        } catch (err: any) {
          console.error(`[E2E userPage] Exception on route ${route}:`, err.message);
          failedRoutes.push(`${route} (Exception: ${err.message})`);
        }
      }
    } finally {
      // Clean up user-specific temporary records
      await prisma.ticket.delete({ where: { id: userTicket.id } });
      await prisma.order.delete({ where: { id: userOrder.id } });
    }

    expect(failedRoutes).toHaveLength(0);
  });

  test('Admin static and dynamic panel routes crawl', async ({ adminPage }) => {
    // Set generous timeout for compilation overhead
    test.setTimeout(180000);

    const adminRoutes = [
      '/admin/analytics',
      '/admin/catalog',
      '/admin/catalog/categories',
      '/admin/catalog/drift',
      '/admin/catalog/enrichment',
      '/admin/catalog/quarantine',
      '/admin/clients',
      `/admin/clients/${testUser.id}`,
      '/admin/cms',
      `/admin/cms/${testContentPage.id}`,
      '/admin/cms/new',
      '/admin/dashboard',
      '/admin/finance',
      `/admin/finance/payments/${testPayment.id}/dispute-pack`,
      '/admin/knowledge',
      `/admin/knowledge/${testArticle.id}/edit`,
      '/admin/knowledge/create',
      '/admin/manual',
      '/admin/marketing',
      '/admin/orders',
      '/admin/pages',
      `/admin/pages/${testContentPage.slug}`,
      '/admin/providers',
      `/admin/providers/${testProvider.id}`,
      '/admin/providers/import',
      '/admin/providers/new',
      '/admin/refills',
      `/admin/services/${testService.id}/routing`,
      '/admin/settings',
      '/admin/smart',
      '/admin/system/features',
      '/admin/tickets',
      `/admin/tickets/${testTicket.id}`
    ];

    const failedRoutes: string[] = [];

    for (const route of adminRoutes) {
      console.log(`[E2E adminPage] Visiting: ${route}`);
      try {
        const response = await adminPage.goto(route, { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        const errorMsg = await checkPageError(adminPage);
        if (errorMsg) {
          console.error(`[E2E adminPage] FAILED route: ${route} (status: ${response?.status()}, error: ${errorMsg})`);
          failedRoutes.push(`${route} (${errorMsg})`);
        }
      } catch (err: any) {
        console.error(`[E2E adminPage] Exception on route ${route}:`, err.message);
        failedRoutes.push(`${route} (Exception: ${err.message})`);
      }
    }

    expect(failedRoutes).toHaveLength(0);
  });
});
