import type { Job } from 'bullmq';
import { logger } from '@/lib/logger';
import { runWithTenant } from '@/lib/tenant-context';

/**
 * BullMQ processor для OmniOrganic кампаний.
 * Запускается каждый час (cron: 0 * * * *).
 * Находит активные кампании и выдаёт FOLLOW/UNFOLLOW задания для нод.
 */
export async function processOrganicCampaign(job: Job): Promise<void> {
  const tenantId = job.data?.tenantId || 'smmplan';
  return runWithTenant(tenantId, async () => {
    logger.info('🌱 Organic campaign executor started', { component: 'OrganicCampaign', tenantId });

    try {
    const { db } = await import('@/lib/db');

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    // Берём все активные кампании с незавершённым планом на сегодня
    const activePlans = await db.organicDailyPlan.findMany({
      where: {
        completed: false,
        planDate: { gte: todayStart, lt: todayEnd },
        campaign: { status: 'ACTIVE' },
      },
      include: {
        campaign: {
          select: {
            id: true,
            channelUsername: true,
            activeHourStart: true,
            activeHourEnd: true,
          },
        },
      },
    });

    const currentHour = now.getHours();
    let followsQueued = 0;
    let unfollowsQueued = 0;

    for (const plan of activePlans) {
      const { campaign } = plan;

      // Проверяем что час входит в активное окно кампании
      if (currentHour < campaign.activeHourStart || currentHour > campaign.activeHourEnd) {
        continue;
      }

      // Рассчитываем сколько действий нужно в этот час
      const activeWindowHours = campaign.activeHourEnd - campaign.activeHourStart + 1;
      const hourlyFollows   = Math.ceil(plan.targetFollows   / activeWindowHours);
      const hourlyUnfollows = Math.ceil(plan.targetUnfollows / activeWindowHours);

      // Добавляем FOLLOW задания в DePinTarget (для нод с acceptsFollowTasks=true)
      if (hourlyFollows > 0) {
        const followNodes = await db.dePinNode.findMany({
          where: {
            acceptsFollowTasks: true,
            reputation: { gte: 30 }, // только надёжные ноды
          },
          orderBy: { lastActiveAt: 'desc' },
          take: hourlyFollows,
          select: { id: true },
        });

        for (const node of followNodes) {
          await db.dePinTarget.upsert({
            where: {
              channel_postId: { channel: campaign.channelUsername, postId: 0 },
            },
            create: {
              channel:     campaign.channelUsername,
              postId:      0,
              type:        'FOLLOW_CHANNEL',
              status:      'QUEUED',
              nodeId:      node.id,
              orderId:     plan.campaignId,
              targetViews: 1,
            },
            update: { status: 'QUEUED', nodeId: node.id },
          });
          followsQueued++;
        }
      }

      // Обновляем план — фиксируем выданные задания
      await db.organicDailyPlan.update({
        where: { id: plan.id },
        data: {
          actualFollows:   { increment: followsQueued },
          actualUnfollows: { increment: unfollowsQueued },
          completed: (followsQueued >= plan.targetFollows && unfollowsQueued >= plan.targetUnfollows),
        },
      });

      // Обновляем счётчики кампании
      await db.organicGrowthCampaign.update({
        where: { id: campaign.id },
        data: {
          followsDelivered:   { increment: followsQueued },
          unfollowsDelivered: { increment: unfollowsQueued },
          netGainActual:      { increment: followsQueued - unfollowsQueued },
        },
      });
    }

    logger.info(
      '✅ Organic hour slot processed',
      { component: 'OrganicCampaign', followsQueued, unfollowsQueued, plans: activePlans.length }
    );
  } catch (err: unknown) {
    logger.error('Organic executor failed', { component: 'OrganicCampaign', err: String(err) });
    throw err;
  }
  });
}
