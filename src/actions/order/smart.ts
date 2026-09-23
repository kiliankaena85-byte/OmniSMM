'use server';

import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { getClientIp } from '@/utils/ip';

export async function getClientCampaigns(page: number = 1, limit: number = 20) {
  const session = await verifySession();
  if (!session || !session.userId) {
    throw new Error('Необходима авторизация');
  }

  const skip = (page - 1) * limit;

  const [campaigns, total] = await Promise.all([
    db.smartCampaign.findMany({
      where: { userId: session.userId },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        service: { select: { name: true, category: { select: { network: { select: { slug: true, name: true } } } } } },
        tasks: {
          orderBy: { runAt: 'asc' },
          include: { executions: { select: { externalOrderId: true, status: true } } }
        }
      }
    }),
    db.smartCampaign.count({ where: { userId: session.userId } })
  ]);

  const formatted = campaigns.map(c => {
    const totalTasks = c.tasks.length;
    const completedTasks = c.tasks.filter(t => t.status === 'COMPLETED').length;

    return {
      id: c.id,
      serviceName: c.service.name,
      networkSlug: c.service.category?.network?.slug || 'web',
      networkName: c.service.category?.network?.name || 'Другое',
      link: c.link,
      totalQuantity: c.totalQuantity,
      totalDays: c.totalDays,
      status: c.status,
      createdAt: c.createdAt,
      progress: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      tasks: c.tasks.map(t => ({
        id: t.id,
        quantity: t.quantity,
        runAt: t.runAt,
        status: t.status,
        error: t.error,
        externalOrderId: t.executions[0]?.externalOrderId || null,
        execStatus: t.executions[0]?.status || null
      }))
    };
  });

  return { success: true, data: { campaigns: formatted, total, pages: Math.ceil(total / limit) } };
}

export async function toggleClientCampaignStatus(campaignId: string, status: 'RUNNING' | 'PAUSED') {
  const session = await verifySession();
  if (!session || !session.userId) {
    throw new Error('Необходима авторизация');
  }

  const campaign = await db.smartCampaign.findUnique({
    where: { id: campaignId }
  });

  if (!campaign) {
    throw new Error('Кампания не найдена');
  }

  // IDOR Security Guard
  if (campaign.userId !== session.userId) {
    throw new Error('Доступ запрещен');
  }

  if (campaign.status === 'COMPLETED' || campaign.status === 'ERROR') {
    throw new Error('Нельзя изменить статус завершенной или деактивированной кампании');
  }

  const updated = await db.smartCampaign.update({
    where: { id: campaignId },
    data: { status }
  });

  revalidatePath('/dashboard/smart-drip');
  return { success: true, data: updated };
}
