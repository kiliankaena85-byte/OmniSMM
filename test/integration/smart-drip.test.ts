import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { PrismaClient, SmartCampaignStatus, SmartTaskStatus } from '@prisma/client';
import { SmartDripService } from '../../src/services/dripfeed/smart-drip.service';
import { runSmartDripfeedTick } from '../../src/workers/processors/dripfeed.processor';

const db = new PrismaClient();

describe('Smart Drip Execution Integrity Suite', () => {
  let tenantId: string;
  let userId: string;
  let serviceId: string;

  afterAll(async () => {
    await db.$disconnect();
  });

  beforeEach(async () => {
    // Ensure DB columns exist for schema compatibility
    await db.$executeRawUnsafe(`ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;`);

    // Setup test tenant and user
    const tenant = await db.tenant.upsert({
      where: { domain: 'smart-drip-test.local' },
      update: {},
      create: { name: 'Smart Drip Test Tenant', slug: 'smart-drip-test', domain: 'smart-drip-test.local' }
    });
    tenantId = tenant.id;

    const user = await db.user.upsert({
      where: { email_tenantId: { email: 'drip_test_user@smmplan.local', tenantId } },
      update: { balance: 100000_00n },
      create: {
        email: 'drip_test_user@smmplan.local',
        tenantId,
        balance: 100000_00n,
        role: 'USER'
      }
    });
    userId = user.id;

    // 1. Ensure a valid Category exists via raw SQL
    let categoryId: string;
    const cats = await db.$queryRaw<Array<{ id: string }>>`SELECT id FROM "Category" LIMIT 1`;
    if (cats && cats.length > 0) {
      categoryId = cats[0].id;
    } else {
      categoryId = `cat-drip-${Date.now()}`;
      await db.$executeRawUnsafe(
        `INSERT INTO "Category" ("id", "name", "slug", "updatedAt") VALUES ($1, $2, $3, NOW())`,
        categoryId,
        'Smart Drip Test Category',
        `cat-slug-${Date.now()}`
      );
    }

    // 2. Ensure a valid Service exists via raw SQL
    const services = await db.$queryRaw<Array<{ id: string }>>`SELECT id FROM "Service" LIMIT 1`;
    if (services && services.length > 0) {
      serviceId = services[0].id;
    } else {
      serviceId = `svc-drip-${Date.now()}`;
      await db.$executeRawUnsafe(
        `INSERT INTO "Service" ("id", "name", "categoryId", "tenantId", "rate", "minQty", "maxQty", "isActive", "updatedAt") VALUES ($1, $2, $3, $4, 1.0, 50, 10000, true, NOW())`,
        serviceId,
        'Smart Drip Test Service',
        categoryId,
        tenantId
      );
    }

    await db.$executeRawUnsafe(
      `UPDATE "Service" SET "tenantId" = $1 WHERE "tenantId" IS NULL`,
      tenantId
    );

    // 3. Upsert SmartConfig for test service
    await db.serviceSmartConfig.upsert({
      where: { serviceId },
      update: { isEnabled: true, isTestMode: true, minChunk: 50, maxChunk: 200, markup: 0.15 },
      create: { serviceId, isEnabled: true, isTestMode: true, minChunk: 50, maxChunk: 200, markup: 0.15 }
    });
  });

  it('generates task distribution matching total quantity invariant', () => {
    const totalQty = 1000;
    const days = 5;
    const tasks = SmartDripService.generateTaskDistribution(totalQty, days, 50, 200);

    const sumQty = tasks.reduce((acc, t) => acc + t.qty, 0);
    expect(sumQty).toBe(totalQty);
    expect(tasks.length).toBeGreaterThan(0);
  });

  it('prevents execution of PAUSED campaigns', async () => {
    const parentOrder = await db.order.create({
      data: {
        userId,
        tenantId,
        serviceId,
        link: 'https://t.me/test_channel',
        quantity: 500,
        charge: 575_00,
        providerCost: 500_00,
        status: 'IN_PROGRESS'
      }
    });

    const campaign = await db.smartCampaign.create({
      data: {
        userId,
        serviceId,
        link: 'https://t.me/test_channel',
        totalQuantity: 500,
        totalDays: 2,
        status: SmartCampaignStatus.PAUSED, // PAUSED
        isTestMode: true,
        orderId: parentOrder.id
      }
    });

    const task = await db.smartTask.create({
      data: {
        campaignId: campaign.id,
        quantity: 250,
        runAt: new Date(Date.now() - 1000), // Past due
        status: SmartTaskStatus.PLANNED
      }
    });

    // Run tick
    await runSmartDripfeedTick();

    // Verify task was NOT picked up because campaign is PAUSED
    const reloadedTask = await db.smartTask.findUniqueOrThrow({ where: { id: task.id } });
    expect(reloadedTask.status).toBe(SmartTaskStatus.PLANNED);
  });

  it('claims task atomically preventing double dispatch across parallel ticks', async () => {
    const parentOrder = await db.order.create({
      data: {
        userId,
        tenantId,
        serviceId,
        link: 'https://t.me/test_channel',
        quantity: 500,
        charge: 575_00,
        providerCost: 500_00,
        status: 'IN_PROGRESS'
      }
    });

    const campaign = await db.smartCampaign.create({
      data: {
        userId,
        serviceId,
        link: 'https://t.me/test_channel',
        totalQuantity: 500,
        totalDays: 2,
        status: SmartCampaignStatus.RUNNING,
        isTestMode: true,
        orderId: parentOrder.id
      }
    });

    const task = await db.smartTask.create({
      data: {
        campaignId: campaign.id,
        quantity: 250,
        runAt: new Date(Date.now() - 1000),
        status: SmartTaskStatus.PLANNED
      }
    });

    // Execute 3 ticks in parallel (simulating multi-worker collision)
    await Promise.all([
      runSmartDripfeedTick(),
      runSmartDripfeedTick(),
      runSmartDripfeedTick()
    ]);

    // Verify task is completed ONCE and only 1 SmartExecution exists
    const reloadedTask = await db.smartTask.findUniqueOrThrow({ where: { id: task.id } });
    expect(reloadedTask.status).toBe(SmartTaskStatus.COMPLETED);

    const executions = await db.smartExecution.findMany({ where: { taskId: task.id } });
    expect(executions.length).toBe(1);
  });
});
