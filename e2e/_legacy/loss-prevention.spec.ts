import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

test.describe('Loss Prevention & Repricing E2E Flow', () => {
  const prisma = new PrismaClient();

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('should disable service on negative margin and log routingAuditLog', async ({ page }) => {
    // 1. Prepare/seed test data
    let network = await prisma.network.findUnique({ where: { slug: 'telegram' } });
    if (!network) {
      network = await prisma.network.create({ data: { name: 'Telegram', slug: 'telegram' } });
    }

    const categoryId = 'e2e-loss-prevention-cat';
    await prisma.category.upsert({
      where: { id: categoryId },
      update: { name: 'E2E Loss Prevention Cat', networkId: network.id },
      create: { id: categoryId, name: 'E2E Loss Prevention Cat', networkId: network.id }
    });

    const serviceId = 'e2e-loss-prevention-svc';
    await prisma.service.upsert({
      where: { id: serviceId },
      update: {
        name: 'E2E Loss Prevention Service',
        categoryId,
        rate: 10.0, // provider rate per 1000 = $10
        providerCurrency: 'USD',
        markup: 0.9, // negative margin (90% markup)
        isActive: true,
        pricePer1000Cents: 900 // 9.00 RUB
      },
      create: {
        id: serviceId,
        name: 'E2E Loss Prevention Service',
        categoryId,
        rate: 10.0,
        providerCurrency: 'USD',
        markup: 0.9,
        isActive: true,
        pricePer1000Cents: 900
      }
    });

    // Clean up old routing audit logs for this service
    await prisma.routingAuditLog.deleteMany({
      where: { serviceId }
    });

    // 2. Trigger the sync route manually via GET request to /api/debug?syncPrices=150.0
    const response = await page.request.get('/api/debug?syncPrices=150.0');
    expect(response.ok()).toBe(true);

    const json = await response.json();
    expect(json.success).toBe(true);

    // 3. Assertions in DB: service must be set to isActive: false
    const dbService = await prisma.service.findUnique({
      where: { id: serviceId }
    });
    expect(dbService).not.toBeNull();
    expect(dbService!.isActive).toBe(false);

    // 4. Assert routingAuditLog is created
    const log = await prisma.routingAuditLog.findFirst({
      where: { serviceId, action: 'LOSS_PREVENTION_BLOCK' }
    });
    expect(log).not.toBeNull();
    expect(log!.reason).toContain('Exchange rate fluctuation');

    // Clean up
    await prisma.service.delete({ where: { id: serviceId } });
    await prisma.category.delete({ where: { id: categoryId } });
  });
});
