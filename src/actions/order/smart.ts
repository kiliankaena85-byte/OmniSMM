'use server';

import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export async function getClientCampaigns(page: number = 1, limit: number = 20) {
  const session = await verifySession();
  if (!session || !session.userId) {
    return { success: false as const, error: 'Необходима авторизация' };
  }

  // Clamp pagination to prevent negative skip / unbounded take from a crafted RPC call
  page = Number.isInteger(page) && page > 0 ? page : 1;
  limit = Number.isInteger(limit) ? Math.min(Math.max(limit, 1), 100) : 20;
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

  return { success: true as const, data: { campaigns: formatted, total, pages: Math.ceil(total / limit) } };
}

export async function toggleClientCampaignStatus(campaignId: string, status: 'RUNNING' | 'PAUSED') {
  const session = await verifySession();
  if (!session || !session.userId) {
    return { success: false as const, error: 'Необходима авторизация' };
  }

  // Runtime guard: Server Actions are public RPC, TS types are not enforced on the wire
  if (typeof campaignId !== 'string' || !campaignId || (status !== 'RUNNING' && status !== 'PAUSED')) {
    return { success: false as const, error: 'Некорректные параметры запроса' };
  }

  const campaign = await db.smartCampaign.findUnique({
    where: { id: campaignId }
  });

  // IDOR Security Guard (same response for "not found" and "foreign" to avoid ID enumeration)
  if (!campaign || campaign.userId !== session.userId) {
    return { success: false as const, error: 'Кампания не найдена' };
  }

  if (campaign.status === 'COMPLETED' || campaign.status === 'ERROR') {
    return { success: false as const, error: 'Нельзя изменить статус завершенной или деактивированной кампании' };
  }

  // Atomic owner-scoped update (TOCTOU: status may have changed between read and write)
  const updated = await db.smartCampaign.updateMany({
    where: { id: campaignId, userId: session.userId, status: { notIn: ['COMPLETED', 'ERROR'] } },
    data: { status }
  });
  if (updated.count === 0) {
    return { success: false as const, error: 'Статус кампании изменился, обновите страницу' };
  }

  revalidatePath('/dashboard/smart-drip');
  return { success: true as const, data: { id: campaignId, status } };
}
