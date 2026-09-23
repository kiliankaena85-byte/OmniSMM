'use server';

import { requireStaffPermission, requireOwnerPermission } from '@/lib/server/rbac';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { auditAdminAwaitable } from '@/lib/admin-audit';
import { getClientIp } from '@/utils/ip';
import { sendTestAlertSchema, sanitizeTelegramHtml } from '@/schemas/telegram';
import type { TelegramBotDiagnostics, TelegramActionResponse } from '@/types/telegram';
import { getTenantId, getBotToken, safeTelegramFetch } from './helpers';

export async function getTelegramBotDiagnosticsAction(targetTenantId?: string): Promise<TelegramBotDiagnostics> {
  return requireStaffPermission('settings', 'view', async () => {
    const tenantId = await getTenantId(targetTenantId);
    const token = await getBotToken(tenantId);

    if (!token) {
      return {
        success: false,
        daemonRunning: false,
        error: `Токен бота для бренда ${tenantId === 'flux' ? 'SMMflux' : 'SMMplan'} не настроен`,
      };
    }

    try {
      const startTime = Date.now();
      let daemonRunning = false;
      let heartbeatAgeMs: number | undefined;
      try {
        const { redis } = await import('@/lib/redis');
        const lastHb = await redis.get(`bot:${tenantId}:heartbeat`) || await redis.get('bot:heartbeat');
        if (lastHb) {
          const age = Date.now() - parseInt(lastHb, 10);
          if (age < 65_000) {
            daemonRunning = true;
            heartbeatAgeMs = age;
          }
        }
      } catch { /* Redis unavailable */ }

      const [getMeRes, webhookRes, linkedUsersCount, telegramTicketsCount, totalOrdersCount, activeButtonsCount, activeTemplatesCount, unresolvedErrorsCount] = await Promise.all([
        safeTelegramFetch(`https://api.telegram.org/bot${token}/getMe`),
        safeTelegramFetch(`https://api.telegram.org/bot${token}/getWebhookInfo`),
        db.user.count({ where: { telegramId: { not: null }, tenantId } }),
        db.ticket.count({ where: { source: 'TELEGRAM', tenantId } }),
        db.order.count({ where: { tenantId } }),
        db.telegramButton.count({ where: { tenantId, isVisible: true } }),
        db.telegramTemplate.count({ where: { tenantId, isActive: true } }),
        db.telegramErrorLog.count({ where: { tenantId, isResolved: false } }),
      ]);

      const pingMs = Date.now() - startTime;
      const getMeData = await getMeRes.json();
      const webhookData = await webhookRes.json();

      if (!getMeData.ok) {
        return { success: false, daemonRunning: false, error: getMeData.description || 'Не удалось получить статус бота' };
      }

      const settings = await db.systemSettings.findUnique({
        where: { id: tenantId },
        select: {
          telegramWebhookSecret: true,
          telegramAllowedIps: true,
          telegramRateLimitPerMin: true,
          telegramMaintenanceMode: true,
          telegramProxyId: true,
        },
      });

      let proxy: TelegramBotDiagnostics['proxy'];
      if (settings?.telegramProxyId) {
        const proxyRecord = await db.telegramProxy.findUnique({ where: { id: settings.telegramProxyId } });
        if (proxyRecord) {
          proxy = {
            isActive: proxyRecord.isActive,
            label: proxyRecord.label,
            protocol: proxyRecord.protocol,
            lastTestLatencyMs: proxyRecord.lastTestLatencyMs ?? undefined,
          };
        }
      }

      return {
        success: true,
        pingMs,
        daemonRunning,
        heartbeatAgeMs,
        bot: getMeData.result,
        webhook: webhookData.ok ? webhookData.result : undefined,
        proxy,
        security: {
          webhookSecretSet: !!settings?.telegramWebhookSecret,
          rateLimitPerMin: settings?.telegramRateLimitPerMin ?? 30,
          allowedIpsCount: settings?.telegramAllowedIps ? JSON.parse(settings.telegramAllowedIps).length : 0,
          maintenanceMode: settings?.telegramMaintenanceMode ?? false,
        },
        stats: {
          linkedUsersCount, telegramTicketsCount, totalOrdersCount,
          activeButtonsCount, activeTemplatesCount, unresolvedErrorsCount,
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Ошибка связи с Telegram API: ${msg}` };
    }
  });
}

export async function resetTelegramWebhookAction(targetTenantId?: string): Promise<TelegramActionResponse> {
  return requireStaffPermission('settings', 'edit', async (admin) => {
    const tenantId = await getTenantId(targetTenantId);
    const token = await getBotToken(tenantId);
    if (!token) return { success: false, error: `TELEGRAM_BOT_TOKEN для бренда ${tenantId === 'flux' ? 'SMMflux' : 'SMMplan'} не задан` };

    try {
      const res = await safeTelegramFetch(
        `https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=true`,
        { method: 'POST' }
      );
      const data = await res.json();

      if (data.ok) {
        const ipAddress = await getClientIp();
        await auditAdminAwaitable({
          adminId: admin.id, adminEmail: admin.email,
          action: 'TELEGRAM_WEBHOOK_RESET',
          target: `telegram_bot_${tenantId}`, targetType: 'SYSTEM_SETTINGS', ipAddress,
        });
        revalidatePath('/admin/settings');
        return { success: true, message: `Вебхук и зависшие апдейты успешно сброшены для бренда ${tenantId === 'flux' ? 'SMMflux' : 'SMMplan'}.` };
      }
      return { success: false, error: data.description || 'Не удалось сбросить вебхук' };
    } catch (err) {
      return { success: false, error: `Ошибка: ${err instanceof Error ? err.message : String(err)}` };
    }
  });
}

export async function sendTelegramTestAlertAction(formData: FormData): Promise<TelegramActionResponse> {
  return requireStaffPermission('settings', 'edit', async (admin) => {
    const ipAddress = await getClientIp();
    try {
      const { redis } = await import('@/lib/redis');
      const rateKey = `tg:test_msg:${admin.id}`;
      const count = await redis.incr(rateKey);
      if (count === 1) await redis.expire(rateKey, 600);
      if (count > 5) return { success: false, error: 'Лимит: максимум 5 тестовых сообщений за 10 минут' };
    } catch { /* Redis unavailable */ }

    const raw = {
      chatId: formData.get('chatId') as string,
      message: formData.get('message') as string,
      parseMode: (formData.get('parseMode') as string) || 'HTML',
    };
    const parsed = sendTestAlertSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || 'Некорректные параметры' };

    const { chatId, message, parseMode } = parsed.data;
    const token = await getBotToken();
    if (!token) return { success: false, error: 'TELEGRAM_BOT_TOKEN не задан' };

    const sanitizedMsg = parseMode === 'HTML' ? sanitizeTelegramHtml(message) : message;

    try {
      const res = await safeTelegramFetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: Number(chatId),
          text: `🔔 <b>Тестовое уведомление из админ-панели</b>\n\n${sanitizedMsg}\n\n<i>Отправлено: ${new Date().toLocaleString('ru-RU')}</i>`,
          parse_mode: 'HTML',
        }),
      });

      const data = await res.json();
      if (data.ok) {
        await auditAdminAwaitable({
          adminId: admin.id, adminEmail: admin.email,
          action: 'TELEGRAM_TEST_MESSAGE_SENT',
          target: chatId, targetType: 'SYSTEM_SETTINGS', ipAddress,
        });
        return { success: true, message: `Сообщение отправлено в чат ${chatId}` };
      }
      return { success: false, error: data.description || 'Telegram API отклонил отправку' };
    } catch (err) {
      return { success: false, error: `Ошибка отправки: ${err instanceof Error ? err.message : String(err)}` };
    }
  });
}

export async function updateTelegramBotSettingsAction(formData: FormData) {
  return requireOwnerPermission(async (admin) => {
    const tenantId = (formData.get('tenantId') as string) || await getTenantId();
    const botUsername = (formData.get('contactTelegramBot') as string) || '';
    const botChannel = (formData.get('contactTelegramChannel') as string) || '';
    const rawBotToken = (formData.get('telegramBotToken') as string) || '';
    const telegramBotMode = (formData.get('telegramBotMode') as string) || 'polling';

    let encryptedToken: string | undefined;
    if (rawBotToken && rawBotToken.trim() && !rawBotToken.includes('••••')) {
      const token = rawBotToken.trim();
      try {
        const res = await safeTelegramFetch(`https://api.telegram.org/bot${token}/getMe`);
        const data = await res.json();
        if (!data.ok) return { success: false, error: `Токен невалиден: ${data.description}` };
      } catch (err) {
        return { success: false, error: `Ошибка проверки токена: ${err instanceof Error ? err.message : String(err)}` };
      }

      const { VaultService } = await import('@/lib/vault');
      encryptedToken = VaultService.encrypt(token);

      try {
        const { bot } = await import('@/bot/index');
        try { bot.stop('Hot-Reload'); } catch { /* ignore */ }
        (bot.telegram as any).token = token;
        await new Promise((resolve) => setTimeout(resolve, 500));
        bot.launch({ dropPendingUpdates: true }).catch((err) => console.error('[Bot Hot-Reload] Failed to launch:', err));
      } catch (err) {
        console.error('[Bot Hot-Reload] Error during hot reload:', err);
      }
    }

    const dataToUpdate: any = {
      contactTelegramBot: botUsername.trim() || null,
      contactTelegramChannel: botChannel.trim() || null,
      telegramBotMode,
    };
    if (encryptedToken) dataToUpdate.telegramBotToken = encryptedToken;

    await db.systemSettings.update({ where: { id: tenantId }, data: dataToUpdate });

    try {
      const { BotSettingsService } = await import('@/bot/services/bot-settings.service');
      BotSettingsService.invalidate(tenantId);
    } catch { /* ignore */ }

    try {
      const { redis } = await import('@/lib/redis');
      await redis.publish('bot:reload', JSON.stringify({ tenantId, timestamp: Date.now() }));
    } catch { /* ignore */ }

    const ipAddress = await getClientIp();
    await auditAdminAwaitable({
      adminId: admin.id, adminEmail: admin.email,
      action: 'TELEGRAM_BOT_SETTINGS_UPDATE',
      target: tenantId, targetType: 'SETTINGS', ipAddress,
    });

    revalidatePath('/admin/settings');
    return { success: true, message: 'Настройки Telegram бота сохранены и применены.' };
  });
}
