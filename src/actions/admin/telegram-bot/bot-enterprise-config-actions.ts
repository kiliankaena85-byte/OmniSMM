'use server';

import { requireStaffPermission } from '@/lib/server/rbac';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { auditAdminAwaitable } from '@/lib/admin-audit';
import { getClientIp } from '@/utils/ip';
import { z } from 'zod';
import { BotSettingsService } from '@/bot/services/bot-settings.service';
import {
  DEFAULT_TELEGRAM_MENU_BUTTONS,
  DEFAULT_TELEGRAM_RATING_REASONS,
  DEFAULT_TELEGRAM_MESSAGE_TEMPLATES,
  type TelegramMenuButton,
  type TelegramRatingReasonsConfig,
  type TelegramMessageTemplatesConfig,
  type TelegramEnterpriseConfig,
} from '@/types/telegram';
import { getTenantId } from './helpers';

export async function getTelegramEnterpriseConfigAction(targetTenantId?: string): Promise<{
  success: boolean;
  config?: TelegramEnterpriseConfig;
  error?: string;
}> {
  return requireStaffPermission('settings', 'view', async () => {
    try {
      const tenantId = await getTenantId(targetTenantId);
      const settings = await db.systemSettings.findUnique({ where: { id: tenantId } });
      const menuButtons = (settings?.telegramMenuConfig as unknown as TelegramMenuButton[]) || DEFAULT_TELEGRAM_MENU_BUTTONS;
      const ratingReasons = (settings?.telegramRatingReasons as unknown as TelegramRatingReasonsConfig) || DEFAULT_TELEGRAM_RATING_REASONS;
      const templates = (settings?.telegramTemplates as unknown as TelegramMessageTemplatesConfig) || DEFAULT_TELEGRAM_MESSAGE_TEMPLATES;

      return {
        success: true,
        config: {
          menuButtons: Array.isArray(menuButtons) && menuButtons.length > 0 ? menuButtons : DEFAULT_TELEGRAM_MENU_BUTTONS,
          ratingReasons: ratingReasons.negative ? ratingReasons : DEFAULT_TELEGRAM_RATING_REASONS,
          templates: templates.welcome ? templates : DEFAULT_TELEGRAM_MESSAGE_TEMPLATES,
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Ошибка загрузки конфигурации: ${msg}` };
    }
  });
}

const saveMenuConfigSchema = z.array(
  z.object({
    id: z.string(),
    label: z.string().min(1, 'Название кнопки не может быть пустым').max(50),
    action: z.enum(['CATALOG', 'ORDERS', 'REFILL', 'PROFILE', 'SUPPORT', 'REFERRALS', 'URL', 'WEB_APP', 'COMMAND', 'TEXT_REPLY']),
    row: z.number().int().min(0).max(10),
    col: z.number().int().min(0).max(5),
    value: z.string().optional(),
    isActive: z.boolean(),
  })
);

export async function saveTelegramMenuConfigAction(buttons: TelegramMenuButton[], targetTenantId?: string) {
  return requireStaffPermission('settings', 'edit', async (admin) => {
    const parsed = saveMenuConfigSchema.safeParse(buttons);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Некорректная структура кнопок' };
    }

    try {
      const tenantId = await getTenantId(targetTenantId);
      await db.systemSettings.upsert({
        where: { id: tenantId },
        update: { telegramMenuConfig: parsed.data as unknown as object },
        create: {
          id: tenantId,
          siteName: tenantId === 'flux' ? 'SMMflux' : 'SMMplan',
          telegramMenuConfig: parsed.data as unknown as object,
        },
      });

      const ipAddress = await getClientIp();
      await auditAdminAwaitable({
        adminId: admin.id, adminEmail: admin.email,
        action: 'TELEGRAM_MENU_UPDATE',
        target: `telegram_menu_${tenantId}`,
        targetType: 'SYSTEM_SETTINGS',
        ipAddress,
        newValue: { buttonCount: parsed.data.length },
      });

      BotSettingsService.invalidate(tenantId);
      revalidatePath('/admin/settings');
      return { success: true, message: `Конфигурация кнопок меню успешно сохранена для бренда ${tenantId === 'flux' ? 'SMMflux' : 'SMMplan'}` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Ошибка сохранения кнопок: ${msg}` };
    }
  });
}

export async function saveTelegramRatingReasonsAction(reasons: TelegramRatingReasonsConfig, targetTenantId?: string) {
  return requireStaffPermission('settings', 'edit', async (admin) => {
    if (!reasons.negative?.length || !reasons.neutral?.length || !reasons.positive?.length) {
      return { success: false, error: 'Каждая категория должна содержать хотя бы одну причину оценки' };
    }

    try {
      const tenantId = await getTenantId(targetTenantId);
      await db.systemSettings.upsert({
        where: { id: tenantId },
        update: { telegramRatingReasons: reasons as unknown as object },
        create: {
          id: tenantId,
          siteName: tenantId === 'flux' ? 'SMMflux' : 'SMMplan',
          telegramRatingReasons: reasons as unknown as object,
        },
      });

      const ipAddress = await getClientIp();
      await auditAdminAwaitable({
        adminId: admin.id, adminEmail: admin.email,
        action: 'TELEGRAM_RATING_REASONS_UPDATE',
        target: `telegram_rating_reasons_${tenantId}`,
        targetType: 'SYSTEM_SETTINGS',
        ipAddress,
      });

      BotSettingsService.invalidate(tenantId);
      revalidatePath('/admin/settings');
      return { success: true, message: `Теги причин оценок успешно сохранены для бренда ${tenantId === 'flux' ? 'SMMflux' : 'SMMplan'}` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Ошибка сохранения причин: ${msg}` };
    }
  });
}

export async function saveTelegramTemplatesAction(templates: TelegramMessageTemplatesConfig, targetTenantId?: string) {
  return requireStaffPermission('settings', 'edit', async (admin) => {
    try {
      const tenantId = await getTenantId(targetTenantId);
      await db.systemSettings.upsert({
        where: { id: tenantId },
        update: { telegramTemplates: templates as unknown as object },
        create: {
          id: tenantId,
          siteName: tenantId === 'flux' ? 'SMMflux' : 'SMMplan',
          telegramTemplates: templates as unknown as object,
        },
      });

      const ipAddress = await getClientIp();
      await auditAdminAwaitable({
        adminId: admin.id, adminEmail: admin.email,
        action: 'TELEGRAM_TEMPLATES_UPDATE',
        target: `telegram_templates_${tenantId}`,
        targetType: 'SYSTEM_SETTINGS',
        ipAddress,
      });

      BotSettingsService.invalidate(tenantId);
      revalidatePath('/admin/settings');
      return { success: true, message: `Шаблоны сообщений успешно сохранены для бренда ${tenantId === 'flux' ? 'SMMflux' : 'SMMplan'}` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Ошибка сохранения шаблонов: ${msg}` };
    }
  });
}
