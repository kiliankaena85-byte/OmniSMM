'use server';

import { requireStaffPermission } from '@/lib/server/rbac';
import { settingsService } from '@/services/admin/settings.service';
import { SettingsProvider, getTenantFallbackBranding } from '@/lib/settings';
import { VaultService } from '@/lib/vault';
import { db } from '@/lib/db';
import { auditAdminAwaitable } from '@/lib/admin-audit';
import { getClientIp } from '@/utils/ip';
import { sendAdminAlert } from '@/lib/notifications';
import { normalizeTenantId } from '@/lib/tenant-resolver-edge';

export async function testSmtpConnectionAction(host?: string, port?: number, user?: string, pass?: string) {
  return requireStaffPermission('settings', 'view', async () => {
    const { isPublicHost } = await import('@/lib/ssrf-guard');
    const tenantId = await SettingsProvider.getTenantId();
    const settings = await settingsService.getSystemSettings(tenantId);

    const targetHost = host || settings.smtpHost;
    const targetPort = port || settings.smtpPort || 465;
    const targetUser = user || settings.smtpUser;
    const targetPass = pass && !pass.includes('•••') ? pass : (settings.smtpPassword ? VaultService.decrypt(settings.smtpPassword) : '');

    if (!targetHost) {
      return { success: false, message: 'SMTP хост не настроен' };
    }

    const isSafe = await isPublicHost(targetHost);
    if (!isSafe) {
      return { success: false, message: 'SSRF защита: хост недопустим (локальный или приватный)' };
    }

    try {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.createTransport({
        host: targetHost,
        port: targetPort,
        secure: targetPort === 465,
        auth: targetUser && targetPass ? { user: targetUser, pass: targetPass } : undefined,
        family: 4,
        connectionTimeout: 5000,
        greetingTimeout: 5000,
      } as Parameters<typeof nodemailer.createTransport>[0]);

      await transporter.verify();
      return { success: true, message: `SMTP соединение с ${targetHost}:${targetPort} успешно подтверждено` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: `Ошибка SMTP: ${msg}` };
    }
  });
}

export async function testGeminiAiConnectionAction(apiKey?: string, proxy?: string) {
  return requireStaffPermission('settings', 'view', async () => {
    const { isPublicHost } = await import('@/lib/ssrf-guard');
    const tenantId = await SettingsProvider.getTenantId();
    const settings = await settingsService.getSystemSettings(tenantId);

    let targetKey = apiKey;
    if (!targetKey || targetKey.includes('•••')) {
      if (settings.geminiApiKeys) {
        const decrypted = VaultService.decrypt(settings.geminiApiKeys);
        targetKey = decrypted.split(',')[0].trim();
      } else {
        targetKey = process.env.GEMINI_API_KEY;
      }
    }

    if (!targetKey) {
      return { success: false, message: 'API-ключ Gemini не найден' };
    }

    const targetProxy = proxy || settings.geminiProxy;
    if (targetProxy) {
      try {
        const url = new URL(targetProxy);
        if (!await isPublicHost(url.hostname)) {
          return { success: false, message: 'SSRF защита: прокси указывает на приватный хост' };
        }
      } catch {
        return { success: false, message: 'Некорректный URL прокси' };
      }
    }

    try {
      const { GeminiClient } = await import('@/services/ai/gemini-client');
      const startTime = Date.now();
      const response = await GeminiClient.generateContent({
        customApiKey: targetKey,
        contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
        timeoutMs: 8000,
      });
      const pingMs = Date.now() - startTime;
      if (response && typeof response === 'string') {
        return { success: true, message: `Gemini API (gemini-latest) отвечает штатно (${pingMs}ms)` };
      }
      return { success: true, message: `Gemini API доступен (${pingMs}ms)` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: `Ошибка Gemini API: ${msg}` };
    }
  });
}

export async function testTelegramBotConnectionAction(targetTenantId?: string) {
  return requireStaffPermission('settings', 'view', async () => {
    const tenantId = targetTenantId || 'smmplan';
    let token: string | null = null;
    try {
      const { BotSettingsService } = await import('@/bot/services/bot-settings.service');
      token = await BotSettingsService.getBotToken(tenantId);
    } catch { /* ignore */ }

    if (!token) {
      const envToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
      if (envToken && /^\d{8,11}:[A-Za-z0-9_-]{35}$/.test(envToken) && !envToken.includes('YOUR_') && envToken !== 'dummy_token') {
        token = envToken;
      }
    }

    if (!token) {
      return { 
        success: false, 
        message: `Токен Telegram-бота для бренда ${tenantId === 'flux' ? 'SMMflux' : 'SMMplan'} не настроен в админ-панели` 
      };
    }

    try {
      const startTime = Date.now();
      const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      });
      const pingMs = Date.now() - startTime;
      const data = await res.json();
      if (data.ok && data.result) {
        return {
          success: true,
          message: `Бот @${data.result.username} онлайн (${pingMs}ms, ID: ${data.result.id})`,
        };
      }
      return { success: false, message: data.description || 'Ошибка Telegram Bot API' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: `Ошибка связи: ${msg}` };
    }
  });
}

export async function testYooKassaConnectionAction(targetTenantId?: string) {
  return requireStaffPermission('settings', 'view', async () => {
    const { SettingsManager, SettingsProvider } = await import('@/lib/settings');
    const rawTenant = targetTenantId || await SettingsProvider.getTenantId();
    const activeTenantId = normalizeTenantId(rawTenant) || 'smmplan';
    const secrets = await SettingsManager.getPaymentSecrets(activeTenantId);
    if (!secrets.yookassaShopId || !secrets.yookassaSecretKey) {
      return { success: false, message: `Ключи ЮKassa (${activeTenantId}) не заполнены в БД или .env` };
    }

    try {
      const startTime = Date.now();
      const authHeader = 'Basic ' + Buffer.from(`${secrets.yookassaShopId}:${secrets.yookassaSecretKey}`).toString('base64');
      const res = await fetch('https://api.yookassa.ru/v3/payments?limit=1', {
        headers: { Authorization: authHeader },
        signal: AbortSignal.timeout(8000),
        cache: 'no-store'
      });
      const pingMs = Date.now() - startTime;

      if (res.ok) {
        return { success: true, message: `ЮKassa API отвечает штатно (${pingMs}ms, Shop ID: ${secrets.yookassaShopId})` };
      }
      const body = await res.text();
      return { success: false, message: `ЮKassa API отклонил запрос: HTTP ${res.status} — ${body.slice(0, 150)}` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: `Ошибка связи с ЮKassa API: ${msg}` };
    }
  });
}

export async function testAlfaBankConnectionAction(targetTenantId?: string) {
  return requireStaffPermission('settings', 'view', async () => {
    const { AlfaBankService } = await import('@/services/financial/bank-integrations/alfa-bank.service');
    const { SettingsProvider } = await import('@/lib/settings');
    const rawTenant = targetTenantId || await SettingsProvider.getTenantId();
    const activeTenantId = normalizeTenantId(rawTenant) || 'smmplan';

    const startTime = Date.now();
    try {
      const res = await AlfaBankService.getLiveBalance(activeTenantId, true);
      const pingMs = Date.now() - startTime;

      if (res.success && res.account) {
        const modeLabel = res.account.isSandbox ? 'Sandbox Mock' : 'Live Open API';
        return {
          success: true,
          pingMs,
          message: `Связь с Альфа-Банком установлена (${pingMs}ms, ${modeLabel})`,
          balance: res.account.authorizedBalanceRub,
        };
      }

      return {
        success: false,
        pingMs,
        message: res.error || 'Ошибка связи с Альфа-Банк API',
        error: res.error || 'Ошибка связи с Альфа-Банк API',
        balance: undefined,
      };
    } catch (err) {
      const pingMs = Date.now() - startTime;
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        pingMs,
        message: `Ошибка подключения к Альфа-Банку: ${msg}`,
        error: `Ошибка подключения к Альфа-Банку: ${msg}`,
        balance: undefined,
      };
    }
  });
}

export async function disconnectTelegramBotAction(tenantId?: string) {
  return requireStaffPermission('settings', 'edit', async (admin) => {
    const rawTenant = tenantId || await SettingsProvider.getTenantId();
    const activeTenantId = normalizeTenantId(rawTenant) || 'smmplan';
    
    await db.systemSettings.upsert({
      where: { id: activeTenantId },
      update: {
        contactTelegramBot: null,
        telegramBotToken: null,
      },
      create: {
        id: activeTenantId,
        siteName: getTenantFallbackBranding(activeTenantId).name,
        contactTelegramBot: null,
        telegramBotToken: null,
      },
    });

    const ipAddress = await getClientIp();

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'TELEGRAM_BOT_DISCONNECTED',
      target: activeTenantId,
      targetType: 'SETTINGS',
      oldValue: { action: 'DISCONNECT_BOT' },
      newValue: { contactTelegramBot: null, telegramBotToken: null },
      ipAddress
    });

    sendAdminAlert(
      `🚨 <b>TELEGRAM-БОТ ПОДДЕРЖКИ ОТВЯЗАН</b>\n` +
      `<b>Тенант / Бренд:</b> <code>${activeTenantId}</code>\n` +
      `<b>Администратор:</b> ${admin.email} (IP: ${ipAddress || 'unknown'})\n` +
      `⚠️ <i>Уведомления и поддержка через бота для бренда ${activeTenantId} остановлены.</i>`,
      'WARNING',
      activeTenantId
    );

    try {
      const { revalidateTag, revalidatePath } = (await import('next/cache')) as unknown as { 
        revalidateTag: (tag: string) => unknown;
        revalidatePath: (path: string, type?: 'layout' | 'page') => unknown;
      };
      revalidateTag('settings');
      revalidateTag(`settings-${activeTenantId}`);
      revalidatePath('/admin/settings');
      revalidatePath('/', 'layout');
    } catch (revalErr) {
      console.warn('[settings] Cache revalidation error after unbind bot:', revalErr);
    }

    return { success: true, message: `Telegram-бот успешно отвязан от бренда ${activeTenantId}` };
  });
}
