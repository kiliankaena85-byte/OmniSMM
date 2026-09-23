import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db as prisma } from '@/lib/db';
import { SmartCampaignStatus, SmartTaskStatus } from '@prisma/client';
import { SmartFeedbackLoopProcessor } from '../../src/workers/processors/smart-feedback-loop.processor';
import { sendAdminAlert } from '@/lib/notifications';

// Mock the admin alert notification system
vi.mock('@/lib/notifications', () => ({
  sendAdminAlert: vi.fn()
}));

describe.skip('Smart Dripfeed 2.5: Dynamic Feedback-Loop Refill & Auto-Compensation', () => {
  let testUser: any = null;
  let testNetwork: any = null;
  let testCategory: any = null;
  let testService: any = null;

  beforeEach(async () => {
    // 1. Enable test mode
    await prisma.systemSettings.upsert({
      where: { id: 'global' },
      update: { isTestMode: true },
      create: { id: 'global', isTestMode: true }
    });

    // 2. Clear tables to have a clean slate
    await prisma.smartChannelMetric.deleteMany();
    await prisma.smartTask.deleteMany();
    await prisma.smartCampaign.deleteMany();
    await prisma.serviceSmartConfig.deleteMany();
    await prisma.ledgerEntry.deleteMany().catch(() => {});
    await prisma.order.deleteMany().catch(() => {});
    await prisma.service.deleteMany();
    await prisma.category.deleteMany();
    await prisma.network.deleteMany();
    await prisma.user.deleteMany();

    vi.clearAllMocks();

    // 3. Set up baseline entities
    testUser = await prisma.user.create({
      data: {
        email: 'drip_tester@example.com',
        role: 'USER'
      }
    });

    testNetwork = await prisma.network.create({
      data: { name: 'Telegram', slug: 'telegram' }
    });

    testCategory = await prisma.category.create({
      data: { name: 'Telegram Subscribers', networkId: testNetwork.id }
    });

    testService = await prisma.service.create({
      data: {
        name: 'Telegram Premium Subscribers',
        categoryId: testCategory.id,
        rate: 2.0,
        markup: 1.5,
        minQty: 10,
        maxQty: 10000,
        isActive: true,
        externalId: '102'
      }
    });
  });

  it('TC-SFL-001: should completely skip campaigns where autoCompensate is disabled', async () => {
    // Create service config with autoCompensate = false
    await prisma.serviceSmartConfig.create({
      data: {
        serviceId: testService.id,
        isEnabled: true,
        autoCompensate: false,
        checkIntervalMins: 120
      }
    });

    // Create a running campaign
    const campaign = await prisma.smartCampaign.create({
      data: {
        userId: testUser.id,
        serviceId: testService.id,
        link: 'https://t.me/clean_channel',
        totalQuantity: 1000,
        totalDays: 7,
        status: SmartCampaignStatus.RUNNING,
        isTestMode: true
      }
    });

    // Add a completed task of 500 followers
    await prisma.smartTask.create({
      data: {
        campaignId: campaign.id,
        quantity: 500,
        runAt: new Date(Date.now() - 3600 * 1000),
        status: SmartTaskStatus.COMPLETED
      }
    });

    await SmartFeedbackLoopProcessor.runSmartFeedbackLoopTick();

    // Verify no new task or metric has been written
    const tasksCount = await prisma.smartTask.count({ where: { campaignId: campaign.id } });
    expect(tasksCount).toBe(1); // Only the initial completed task should exist

    const metricsCount = await prisma.smartChannelMetric.count({ where: { campaignId: campaign.id } });
    expect(metricsCount).toBe(0);

    expect(sendAdminAlert).not.toHaveBeenCalled();
  });

  it('TC-SFL-002: should automatically detect drops and compensate them within the 30% margin ceiling', async () => {
    // Create service config with autoCompensate = true
    await prisma.serviceSmartConfig.create({
      data: {
        serviceId: testService.id,
        isEnabled: true,
        autoCompensate: true,
        checkIntervalMins: 120
      }
    });

    // Create running campaign
    const campaign = await prisma.smartCampaign.create({
      data: {
        userId: testUser.id,
        serviceId: testService.id,
        link: 'https://t.me/drop_channel',
        totalQuantity: 1000, // 30% ceiling = 300
        totalDays: 7,
        status: SmartCampaignStatus.RUNNING,
        isTestMode: true
      }
    });

    // Add completed task of 500 followers (simulates 500 delivered, so expected count is 1500)
    // 20% simulated drop will be 100 followers
    await prisma.smartTask.create({
      data: {
        campaignId: campaign.id,
        quantity: 500,
        runAt: new Date(Date.now() - 3600 * 1000),
        status: SmartTaskStatus.COMPLETED
      }
    });

    await SmartFeedbackLoopProcessor.runSmartFeedbackLoopTick();

    // Verify a new task was created to compensate the 100 dropped followers
    const compensationTask = await prisma.smartTask.findFirst({
      where: {
        campaignId: campaign.id,
        status: SmartTaskStatus.PLANNED
      }
    });

    expect(compensationTask).not.toBeNull();
    expect(compensationTask!.quantity).toBe(100); // 20% of 500 delivered
    expect(compensationTask!.runAt.getTime()).toBeLessThanOrEqual(Date.now());

    // Verify a metric log was created in database
    const metricLog = await prisma.smartChannelMetric.findFirst({
      where: { campaignId: campaign.id }
    });
    expect(metricLog).not.toBeNull();
    expect(metricLog!.detectedDrops).toBe(100);
    expect(metricLog!.compensatedQty).toBe(100);

    // Verify notification was sent
    expect(sendAdminAlert).toHaveBeenCalledWith(
      expect.stringContaining('detected a drop of 100 followers. Compensating 100 followers immediately.'),
      'WARNING'
    );
  });

  it('TC-SFL-003: should cap auto-compensation to exactly the remaining 30% margin allowance', async () => {
    // Create service config with autoCompensate = true
    await prisma.serviceSmartConfig.create({
      data: {
        serviceId: testService.id,
        isEnabled: true,
        autoCompensate: true,
        checkIntervalMins: 120
      }
    });

    // Create running campaign
    const campaign = await prisma.smartCampaign.create({
      data: {
        userId: testUser.id,
        serviceId: testService.id,
        link: 'https://t.me/capped_channel',
        totalQuantity: 1000, // 30% ceiling = 300
        totalDays: 7,
        status: SmartCampaignStatus.RUNNING,
        isTestMode: true
      }
    });

    // Add completed task of 500 followers
    // 20% drop = 100 followers
    await prisma.smartTask.create({
      data: {
        campaignId: campaign.id,
        quantity: 500,
        runAt: new Date(Date.now() - 3600 * 1000),
        status: SmartTaskStatus.COMPLETED
      }
    });

    // Write a metric showing we ALREADY compensated 250 followers in the past
    // (Meaning we only have 300 - 250 = 50 followers left in our budget!)
    await prisma.smartChannelMetric.create({
      data: {
        campaignId: campaign.id,
        memberCount: 1400,
        delta: -50,
        detectedDrops: 50,
        compensatedQty: 250 // Exhausted 250 of our 300 cents ceiling limit
      }
    });

    await SmartFeedbackLoopProcessor.runSmartFeedbackLoopTick();

    // Verify that the new compensation task is capped to exactly 50 followers
    const plannedTasks = await prisma.smartTask.findMany({
      where: { campaignId: campaign.id, status: SmartTaskStatus.PLANNED }
    });
    expect(plannedTasks.length).toBe(1);
    expect(plannedTasks[0].quantity).toBe(50); // Capped from 100 to 50

    // Verify metrics show delta and correct capped compensation
    const latestMetric = await prisma.smartChannelMetric.findFirst({
      where: { campaignId: campaign.id },
      orderBy: { recordedAt: 'desc' }
    });
    expect(latestMetric!.detectedDrops).toBe(100);
    expect(latestMetric!.compensatedQty).toBe(50); // Exactly 50!

    // Verify critical limit alert was sent
    expect(sendAdminAlert).toHaveBeenCalledWith(
      expect.stringContaining('reached its 30% margin protection ceiling'),
      'CRITICAL'
    );
  });
});
