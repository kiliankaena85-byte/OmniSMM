'use server';

import { requireStaffPermission, requireOwnerPermission } from '@/lib/server/rbac';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { auditAdminAwaitable } from '@/lib/admin-audit';
import { getClientIp } from '@/utils/ip';
import { z } from 'zod';
import { statsQuerySchema, securityConfigSchema } from '@/schemas/telegram';
import { BotSettingsService } from '@/bot/services/bot-settings.service';
import type {
  TelegramStatsOverview,
  TelegramActionResponse,
  TicketFeedbackStats,
  TicketFeedbackItem,
} from '@/types/telegram';
import { getTenantId } from './helpers';

export async function getTelegramStatsAction(
  period: string = '7d'
): Promise<TelegramActionResponse & { data?: TelegramStatsOverview }> {
  return requireStaffPermission('settings', 'view', async () => {
    const parsed = statsQuerySchema.safeParse({ period });
    if (!parsed.success) return { success: false, error: 'Некорректный период' };

    const tenantId = await getTenantId();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const [todayStat, yesterdayStat, last7Days, linkedUsersCount, telegramTicketsCount, totalOrdersCount, activeButtonsCount, activeTemplatesCount, unresolvedErrorsCount, errorsLast24h] = await Promise.all([
      db.telegramDailyStat.findUnique({ where: { date_tenantId: { date: today, tenantId } } }),
      db.telegramDailyStat.findUnique({ where: { date_tenantId: { date: yesterday, tenantId } } }),
      db.telegramDailyStat.findMany({
        where: { tenantId, date: { gte: new Date(today.getTime() - 7 * 86400000) } },
        orderBy: { date: 'asc' },
      }),
      db.user.count({ where: { telegramId: { not: null }, tenantId } }),
      db.ticket.count({ where: { source: 'TELEGRAM', tenantId } }),
      db.order.count({ where: { tenantId } }),
      db.telegramButton.count({ where: { tenantId, isVisible: true } }),
      db.telegramTemplate.count({ where: { tenantId, isActive: true } }),
      db.telegramErrorLog.count({ where: { tenantId, isResolved: false } }),
      db.telegramErrorLog.count({
        where: { tenantId, lastSeenAt: { gte: new Date(Date.now() - 86400000) } },
      }),
    ]);

    return {
      success: true,
      data: {
        today: todayStat || null,
        yesterday: yesterdayStat || null,
        last7Days,
        linkedUsersCount,
        telegramTicketsCount,
        totalOrdersCount,
        activeButtonsCount,
        activeTemplatesCount,
        unresolvedErrorsCount,
        errorsLast24h,
      },
    };
  });
}

export async function updateTelegramSecurityAction(
  raw: z.infer<typeof securityConfigSchema>
): Promise<TelegramActionResponse> {
  return requireOwnerPermission(async (admin) => {
    const parsed = securityConfigSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Ошибка валидации' };
    }
    const data = parsed.data;
    const tenantId = await getTenantId();

    let encryptedSecret: string | null | undefined;
    if (data.webhookSecret !== undefined) {
      if (data.webhookSecret) {
        try {
          const { VaultService } = await import('@/lib/vault');
          encryptedSecret = VaultService.encrypt(data.webhookSecret);
        } catch {
          return { success: false, error: 'Ошибка шифрования webhook секрета' };
        }
      } else {
        encryptedSecret = null;
      }
    }

    await db.systemSettings.update({
      where: { id: tenantId },
      data: {
        ...(encryptedSecret !== undefined && { telegramWebhookSecret: encryptedSecret }),
        telegramAllowedIps: JSON.stringify(data.allowedIps),
        telegramRateLimitPerMin: data.rateLimitPerMin,
        telegramMaxMessageLength: data.maxMessageLength,
        telegramMaintenanceMode: data.telegramMaintenanceMode,
        telegramLogErrors: data.telegramLogErrors,
        telegramEnableCsat: data.telegramEnableCsat,
        telegramEnableSmartBind: data.telegramEnableSmartBind,
      },
    });

    const ipAddress = await getClientIp();
    await auditAdminAwaitable({
      adminId: admin.id, adminEmail: admin.email,
      action: 'TELEGRAM_SECURITY_UPDATE',
      target: 'security_config', targetType: 'SYSTEM_SETTINGS', ipAddress,
      newValue: JSON.stringify({
        webhookSecretSet: !!encryptedSecret,
        allowedIpsCount: data.allowedIps.length,
        rateLimitPerMin: data.rateLimitPerMin,
        maintenanceMode: data.telegramMaintenanceMode,
      }),
    });

    BotSettingsService.invalidate(tenantId);
    revalidatePath('/admin/settings?tab=telegram');
    return { success: true, message: 'Настройки безопасности обновлены' };
  });
}

export async function getTicketFeedbackStatsAction(): Promise<{
  success: boolean;
  stats?: TicketFeedbackStats;
  error?: string;
}> {
  return requireStaffPermission('settings', 'view', async (admin) => {
    try {
      const tenantFilter = admin.tenantId ? { tenantId: admin.tenantId } : {};
      const feedbacks = await db.ticketFeedback.findMany({
        where: tenantFilter,
        select: { score: true, reasons: true },
      });

      const totalCount = feedbacks.length;
      if (totalCount === 0) {
        return {
          success: true,
          stats: {
            totalCount: 0,
            avgScore: 5.0,
            scoreBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            topReasons: [],
          },
        };
      }

      let sumScore = 0;
      const scoreBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      const reasonsMap: Record<string, number> = {};

      for (const fb of feedbacks) {
        sumScore += fb.score;
        if (fb.score >= 1 && fb.score <= 5) {
          scoreBreakdown[fb.score as 1 | 2 | 3 | 4 | 5]++;
        }
        if (Array.isArray(fb.reasons)) {
          for (const r of fb.reasons) {
            reasonsMap[r] = (reasonsMap[r] || 0) + 1;
          }
        }
      }

      const avgScore = Number((sumScore / totalCount).toFixed(2));
      const topReasons = Object.entries(reasonsMap)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      return {
        success: true,
        stats: { totalCount, avgScore, scoreBreakdown, topReasons },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Ошибка получения статистики: ${msg}` };
    }
  });
}

export async function getTicketFeedbackListAction(params?: {
  page?: number;
  pageSize?: number;
  score?: number;
}): Promise<{
  success: boolean;
  items?: TicketFeedbackItem[];
  total?: number;
  page?: number;
  error?: string;
}> {
  return requireStaffPermission('settings', 'view', async (admin) => {
    try {
      const page = Math.max(1, params?.page || 1);
      const pageSize = Math.min(50, Math.max(5, params?.pageSize || 15));
      const where: Record<string, unknown> = {};

      if (admin.tenantId) where.tenantId = admin.tenantId;
      if (params?.score && params.score >= 1 && params.score <= 5) where.score = params.score;

      const [total, items] = await Promise.all([
        db.ticketFeedback.count({ where }),
        db.ticketFeedback.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            ticket: { select: { subject: true } },
            user: { select: { email: true } },
          },
        }),
      ]);

      const formatted: TicketFeedbackItem[] = items.map((item) => ({
        id: item.id,
        ticketId: item.ticketId,
        ticketSubject: item.ticket?.subject || 'Без темы',
        userId: item.userId,
        userEmail: item.user?.email || 'Неизвестно',
        score: item.score,
        reasons: item.reasons || [],
        comment: item.comment,
        source: item.source,
        createdAt: item.createdAt.toISOString(),
      }));

      return { success: true, items: formatted, total, page };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Ошибка загрузки отзывов: ${msg}` };
    }
  });
}
