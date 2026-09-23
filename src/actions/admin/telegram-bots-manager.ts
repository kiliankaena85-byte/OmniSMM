'use server';

/**
 * (c) 2024-2026 SMMplan / OmniSMM 1.0. All rights reserved.
 * Server actions for Telegram Bot Constructor & Multi-Bot Platform.
 */

import { requireStaffPermission } from '@/lib/server/rbac';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { auditAdminAwaitable } from '@/lib/admin-audit';
import { getClientIp } from '@/utils/ip';
import { VaultService } from '@/lib/vault';
import { multiBotManager } from '@/bot/manager/multi-bot-manager';
import {
  BOT_PRESETS,
  type TelegramBotInstanceDTO,
  type CreateTelegramBotInput,
  type UpdateTelegramBotInput,
  type TelegramBotRole
} from '@/types/telegram-builder';
import type { TelegramMenuButton } from '@/types/telegram';

function maskToken(token: string): string {
  if (!token || token.length < 8) return '****';
  const parts = token.split(':');
  if (parts.length === 2) {
    const prefix = parts[0].slice(0, 4);
    const suffix = parts[1].slice(0, 4);
    return `${prefix}****:${suffix}****`;
  }
  return token.slice(0, 4) + '****' + token.slice(-4);
}

/**
 * Returns all configured bots for the active tenant.
 */
export async function listTelegramBotsAction(
  targetTenantId?: string
): Promise<{ success: boolean; bots?: TelegramBotInstanceDTO[]; error?: string }> {
  return requireStaffPermission('settings', 'view', async () => {
    try {
      const tenantId = targetTenantId || 'smmplan';

      // Auto-migrate / seed existing primary bot so it appears immediately
      const count = await db.telegramBotInstance.count({ where: { tenantId } });
      if (count === 0) {
        try {
          const sys = await db.systemSettings.findUnique({ where: { id: tenantId } });
          let rawToken = '';
          if (sys?.telegramBotToken) {
            rawToken = VaultService.decrypt(sys.telegramBotToken);
          }
          if (!rawToken) {
            const envToken = process.env.TELEGRAM_BOT_TOKEN || '';
            if (envToken && !envToken.includes('YOUR_') && envToken !== 'dummy_token') {
              rawToken = envToken;
            }
          }
          if (rawToken && /^\d{8,11}:[A-Za-z0-9_-]{35}$/.test(rawToken)) {
            const tokenEncrypted = VaultService.encrypt(rawToken);
            await db.telegramBotInstance.create({
              data: {
                id: `primary_bot_${tenantId}`,
                tenantId,
                name: tenantId === 'flux' ? 'Основной бот SMMflux' : 'Основной бот SMMplan',
                username: sys?.contactTelegramBot || (tenantId === 'flux' ? 'smmflux_support_bot' : 'smmplan_support_bot'),
                tokenEncrypted,
                role: 'STORE_FULL',
                description: 'Главный рабочий бот платформы (Каталог, быстрый заказ, пополнение, поддержка)',
                isActive: true,
                maintenanceMode: sys?.telegramMaintenanceMode || false,
                welcomeMessage: sys?.welcomeMessage || null,
                menuConfig: (sys?.telegramMenuConfig as unknown as object) || (BOT_PRESETS.STORE_FULL.menuConfig as unknown as object),
                templates: (sys?.telegramTemplates as unknown as object) || (BOT_PRESETS.STORE_FULL.templates as unknown as object),
                flowConfig: BOT_PRESETS.STORE_FULL.flowConfig as unknown as object,
              }
            });
          }
        } catch (seedErr) {
          console.warn('[TelegramBotsManager] Auto-seed warning:', seedErr);
        }
      }

      const list = await db.telegramBotInstance.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'asc' }
      });

      const bots: TelegramBotInstanceDTO[] = list.map((b) => {
        let allowedUsers: string[] = [];
        if (b.allowedUserIds) {
          try {
            allowedUsers = JSON.parse(b.allowedUserIds);
          } catch { /* ignore */ }
        }

        return {
          id: b.id,
          tenantId: b.tenantId,
          name: b.name,
          username: b.username,
          tokenMasked: maskToken(b.tokenEncrypted),
          role: b.role as TelegramBotRole,
          description: b.description,
          isActive: b.isActive,
          maintenanceMode: b.maintenanceMode,
          welcomeMessage: b.welcomeMessage,
          menuConfig: (b.menuConfig as unknown as TelegramMenuButton[]) || [],
          templates: (b.templates as unknown as Record<string, string>) || {},
          flowConfig: (b.flowConfig as unknown as any[]) || [],
          allowedUserIds: allowedUsers,
          createdAt: b.createdAt.toISOString(),
          updatedAt: b.updatedAt.toISOString(),
          isOnline: b.isActive && multiBotManager.isBotRunning(b.id),
        };
      });

      return { success: true, bots };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Ошибка загрузки ботов: ${msg}` };
    }
  });
}

/**
 * Validates a bot token against Telegram API before saving.
 */
export async function testTelegramBotTokenAction(token: string): Promise<{
  success: boolean;
  valid?: boolean;
  bot?: { id: number; username: string; first_name: string };
  error?: string;
}> {
  return requireStaffPermission('settings', 'view', async () => {
    const res = await multiBotManager.verifyToken(token);
    return {
      success: res.valid,
      valid: res.valid,
      bot: res.bot,
      error: res.error,
    };
  });
}

/**
 * Creates a new bot in the constructor, optionally applying a preset.
 */
export async function createTelegramBotAction(
  input: CreateTelegramBotInput
): Promise<{ success: boolean; bot?: TelegramBotInstanceDTO; error?: string }> {
  return requireStaffPermission('settings', 'edit', async (admin) => {
    try {
      const tenantId = input.tenantId || 'smmplan';

      // 1. Verify token with Telegram API
      const verifyRes = await multiBotManager.verifyToken(input.token);
      if (!verifyRes.valid) {
        return { success: false, error: verifyRes.error || 'Невалидный токен бота.' };
      }

      // 2. Encrypt token via AES-256-GCM
      const tokenEncrypted = VaultService.encrypt(input.token.trim());

      // 3. Resolve presets if selected
      const presetKey = input.presetKey || input.role;
      const preset = BOT_PRESETS[presetKey] || BOT_PRESETS.CUSTOM_BUILDER;

      // 4. Create in DB
      const created = await db.telegramBotInstance.create({
        data: {
          tenantId,
          name: input.name.trim(),
          username: verifyRes.bot?.username || null,
          tokenEncrypted,
          role: input.role,
          description: input.description?.trim() || preset.description,
          isActive: true,
          maintenanceMode: false,
          welcomeMessage: input.welcomeMessage || preset.welcomeMessage,
          menuConfig: preset.menuConfig as unknown as object,
          templates: preset.templates as unknown as object,
          flowConfig: preset.flowConfig as unknown as object,
        }
      });

      // 5. Start bot in MultiBotManager runtime
      void multiBotManager.startBot(created);

      // 6. Audit & Cache Invalidation
      const ipAddress = await getClientIp();
      await auditAdminAwaitable({
        adminId: admin.id,
        adminEmail: admin.email,
        action: 'TELEGRAM_BOT_CREATE',
        target: created.id,
        targetType: 'TELEGRAM_BOT_INSTANCE',
        ipAddress,
        newValue: { name: created.name, role: created.role, username: created.username }
      });

      revalidatePath('/admin/settings');

      return {
        success: true,
        bot: {
          id: created.id,
          tenantId: created.tenantId,
          name: created.name,
          username: created.username,
          tokenMasked: maskToken(created.tokenEncrypted),
          role: created.role as TelegramBotRole,
          description: created.description,
          isActive: created.isActive,
          maintenanceMode: created.maintenanceMode,
          welcomeMessage: created.welcomeMessage,
          menuConfig: (created.menuConfig as unknown as TelegramMenuButton[]) || [],
          templates: (created.templates as unknown as Record<string, string>) || {},
          flowConfig: (created.flowConfig as unknown as any[]) || [],
          allowedUserIds: [],
          createdAt: created.createdAt.toISOString(),
          updatedAt: created.updatedAt.toISOString(),
          isOnline: true
        }
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Ошибка создания бота: ${msg}` };
    }
  });
}

/**
 * Updates an existing bot instance (menu, flow, templates, status).
 */
export async function updateTelegramBotAction(
  botId: string,
  input: UpdateTelegramBotInput
): Promise<{ success: boolean; error?: string }> {
  return requireStaffPermission('settings', 'edit', async (admin) => {
    try {
      const current = await db.telegramBotInstance.findUnique({ where: { id: botId } });
      if (!current) {
        return { success: false, error: 'Бот не найден.' };
      }

      let tokenEncrypted: string | undefined = undefined;
      let username = current.username;

      if (input.token && input.token.trim().length > 15) {
        const verifyRes = await multiBotManager.verifyToken(input.token);
        if (!verifyRes.valid) {
          return { success: false, error: verifyRes.error || 'Невалидный новый токен.' };
        }
        tokenEncrypted = VaultService.encrypt(input.token.trim());
        username = verifyRes.bot?.username || username;
      }

      const updated = await db.telegramBotInstance.update({
        where: { id: botId },
        data: {
          ...(input.name && { name: input.name.trim() }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.role && { role: input.role }),
          ...(tokenEncrypted && { tokenEncrypted, username }),
          ...(input.isActive !== undefined && { isActive: input.isActive }),
          ...(input.maintenanceMode !== undefined && { maintenanceMode: input.maintenanceMode }),
          ...(input.welcomeMessage !== undefined && { welcomeMessage: input.welcomeMessage }),
          ...(input.menuConfig && { menuConfig: input.menuConfig as unknown as object }),
          ...(input.templates && { templates: input.templates as unknown as object }),
          ...(input.flowConfig && { flowConfig: input.flowConfig as unknown as object }),
          ...(input.allowedUserIds && { allowedUserIds: JSON.stringify(input.allowedUserIds) }),
        }
      });

      // Hot reload in manager
      void multiBotManager.reloadBot(botId);

      const ipAddress = await getClientIp();
      await auditAdminAwaitable({
        adminId: admin.id,
        adminEmail: admin.email,
        action: 'TELEGRAM_BOT_UPDATE',
        target: botId,
        targetType: 'TELEGRAM_BOT_INSTANCE',
        ipAddress,
        newValue: { name: updated.name, isActive: updated.isActive }
      });

      revalidatePath('/admin/settings');
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Ошибка обновления бота: ${msg}` };
    }
  });
}

/**
 * Toggles a bot's active status.
 */
export async function toggleTelegramBotStatusAction(
  botId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  return requireStaffPermission('settings', 'edit', async () => {
    try {
      const updated = await db.telegramBotInstance.update({
        where: { id: botId },
        data: { isActive }
      });

      if (isActive) {
        await multiBotManager.startBot(updated);
      } else {
        await multiBotManager.stopBot(botId);
      }

      revalidatePath('/admin/settings');
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Ошибка переключения статуса: ${msg}` };
    }
  });
}

/**
 * Deletes a bot instance completely.
 */
export async function deleteTelegramBotAction(
  botId: string
): Promise<{ success: boolean; error?: string }> {
  return requireStaffPermission('settings', 'edit', async (admin) => {
    try {
      await multiBotManager.stopBot(botId);
      await db.telegramBotInstance.delete({ where: { id: botId } });

      const ipAddress = await getClientIp();
      await auditAdminAwaitable({
        adminId: admin.id,
        adminEmail: admin.email,
        action: 'TELEGRAM_BOT_DELETE',
        target: botId,
        targetType: 'TELEGRAM_BOT_INSTANCE',
        ipAddress
      });

      revalidatePath('/admin/settings');
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Ошибка удаления бота: ${msg}` };
    }
  });
}
