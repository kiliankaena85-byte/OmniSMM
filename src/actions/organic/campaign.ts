'use server';

import { db } from '@/lib/db';
import {
  CreateCampaignSchema,
  UpdateNodePrefsSchema,
  type CampaignStatusDto,
} from './contracts';

// ─── Создание кампании ────────────────────────────────────────────────────────

export async function createCampaignAction(rawInput: unknown): Promise<{
  success: boolean;
  campaignId?: string;
  error?: string;
}> {
  try {
    const parsed = CreateCampaignSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'INVALID_INPUT' };
    }
    const data = parsed.data;

    // Генерируем расписание
    const { NaturalChurnEngine } = await import('@/services/organic/natural-churn-engine');
    const plans = NaturalChurnEngine.generateCampaignSchedule(data);

    const startDate = new Date();
    const endDate = new Date(Date.now() + data.durationDays * 86_400_000);

    // Создаём кампанию + дневные планы
    const campaign = await db.organicGrowthCampaign.create({
      data: {
        orderId:           data.orderId,
        tenantId:          data.tenantId,
        channelUsername:   data.channelUsername,
        targetNetGain:     data.targetNetGain,
        durationDays:      data.durationDays,
        churnRateMin:      data.churnRateMin,
        churnRateMax:      data.churnRateMax,
        activeHourStart:   data.activeHourStart,
        activeHourEnd:     data.activeHourEnd,
        weekendMultiplier: data.weekendMultiplier,
        status:            'ACTIVE',
        startDate,
        endDate,
        dailyPlans: {
          createMany: {
            data: plans.map(p => ({
              planDate:       p.date,
              targetFollows:  p.follows,
              targetUnfollows: p.unfollows,
            })),
          },
        },
      },
    });

    return { success: true, campaignId: campaign.id };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'CREATE_CAMPAIGN_FAILED' };
  }
}

// ─── Статус кампании ──────────────────────────────────────────────────────────

export async function getCampaignStatusAction(campaignId: string): Promise<{
  success: boolean;
  data?: CampaignStatusDto;
  error?: string;
}> {
  try {
    const campaign = await db.organicGrowthCampaign.findUnique({
      where: { id: campaignId },
    });
    if (!campaign) return { success: false, error: 'CAMPAIGN_NOT_FOUND' };

    const now = Date.now();
    const progressPercent = Math.min(
      100,
      Math.round((campaign.netGainActual / Math.max(1, campaign.targetNetGain)) * 100)
    );
    const daysRemaining = Math.max(
      0,
      Math.ceil((campaign.endDate.getTime() - now) / 86_400_000)
    );
    const retentionRate = campaign.followsDelivered > 0
      ? 1 - campaign.unfollowsDelivered / campaign.followsDelivered
      : 1;

    return {
      success: true,
      data: {
        id:                 campaign.id,
        channelUsername:    campaign.channelUsername,
        status:             campaign.status as CampaignStatusDto['status'],
        targetNetGain:      campaign.targetNetGain,
        netGainActual:      campaign.netGainActual,
        followsDelivered:   campaign.followsDelivered,
        unfollowsDelivered: campaign.unfollowsDelivered,
        progressPercent,
        daysRemaining,
        retentionRate,
        startDate:          campaign.startDate.toISOString(),
        endDate:            campaign.endDate.toISOString(),
      },
    };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'STATUS_FAILED' };
  }
}

// ─── Управление кампанией ─────────────────────────────────────────────────────

export async function pauseCampaignAction(campaignId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await db.organicGrowthCampaign.update({
      where: { id: campaignId },
      data: { status: 'PAUSED' },
    });
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'PAUSE_FAILED' };
  }
}

export async function resumeCampaignAction(campaignId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await db.organicGrowthCampaign.update({
      where: { id: campaignId },
      data: { status: 'ACTIVE' },
    });
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'RESUME_FAILED' };
  }
}

export async function cancelCampaignAction(campaignId: string): Promise<{
  success: boolean;
  cancelledPlans?: number;
  error?: string;
}> {
  try {
    const campaign = await db.organicGrowthCampaign.findUnique({
      where: { id: campaignId },
      select: { status: true, targetNetGain: true, netGainActual: true },
    });
    if (!campaign) return { success: false, error: 'CAMPAIGN_NOT_FOUND' };
    if (campaign.status === 'COMPLETED') return { success: false, error: 'ALREADY_COMPLETED' };

    await db.organicGrowthCampaign.update({
      where: { id: campaignId },
      data: { status: 'CANCELLED' },
    });

    const cancelled = await db.organicDailyPlan.updateMany({
      where: { campaignId, completed: false },
      data: { completed: true },
    });

    return { success: true, cancelledPlans: cancelled.count };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'CANCEL_FAILED' };
  }
}

// ─── Предпочтения ноды ───────────────────────────────────────────────────────

export async function updateNodePreferencesAction(rawInput: unknown): Promise<{
  success: boolean;
  acceptsViewTasks?: boolean;
  acceptsReactTasks?: boolean;
  acceptsFollowTasks?: boolean;
  error?: string;
}> {
  try {
    const parsed = UpdateNodePrefsSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'INVALID_INPUT' };
    }
    const { nodeId, ...prefs } = parsed.data;

    // Убираем undefined поля
    const updateData = Object.fromEntries(
      Object.entries(prefs).filter(([, v]) => v !== undefined)
    ) as Record<string, boolean>;

    const node = await db.dePinNode.update({
      where: { id: nodeId },
      data: updateData,
      select: {
        acceptsViewTasks: true,
        acceptsReactTasks: true,
        acceptsFollowTasks: true,
      },
    });

    return {
      success: true,
      acceptsViewTasks:   node.acceptsViewTasks,
      acceptsReactTasks:  node.acceptsReactTasks,
      acceptsFollowTasks: node.acceptsFollowTasks,
    };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'UPDATE_PREFS_FAILED' };
  }
}
