'use server';

import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { getClientIp } from '@/utils/ip';
import crypto from 'crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { SettingsProvider } from '@/lib/settings';
import type {
  CompanyRequisitesInput,
  UpdateCompanyRequisitesResult,
  ApiWebhookInput,
  UpdateApiWebhookResult,
  Confirm152FzConsentResult,
  ApiKeyActionResult,
  TelegramBindDetailsResult,
  TelegramNotificationSettingsInput,
  TelegramNotificationSettingsResult,
  UnbindTelegramResult,
} from './settings-extra.types';

const taxRequisitesSchema = z.object({
  companyName: z.string().max(255, 'Название компании не должно превышать 255 символов').nullable().optional(),
  inn: z.string().refine(val => !val || /^\d{10}$|^\d{12}$/.test(val.trim()), {
    message: 'ИНН должен содержать ровно 10 цифр (для организаций) или 12 цифр (для ИП)',
  }).nullable().optional(),
  kpp: z.string().refine(val => !val || /^\d{9}$/.test(val.trim()), {
    message: 'КПП должен содержать ровно 9 цифр',
  }).nullable().optional(),
  ogrn: z.string().refine(val => !val || /^\d{13}$|^\d{15}$/.test(val.trim()), {
    message: 'ОГРН должен содержать ровно 13 цифр (для юрлиц) или 15 цифр ОГРНИП (для ИП)',
  }).nullable().optional(),
  legalAddress: z.string().max(500, 'Юридический адрес не должен превышать 500 символов').nullable().optional(),
});

const apiWebhookSchema = z.object({
  webhookUrl: z.string().refine(val => {
    if (!val || val.trim() === '') return true;
    try {
      const u = new URL(val.trim());
      return u.protocol === 'https:';
    } catch {
      return false;
    }
  }, { message: 'URL вебхука должен быть валидным и начинаться с https://' }).nullable().optional(),
  isWebhookActive: z.boolean().optional(),
});

const telegramNotificationsSchema = z.object({
  notifyOrders: z.boolean().optional(),
  notifyBalance: z.boolean().optional(),
  notifyTickets: z.boolean().optional(),
});

/**
 * Updates tax/company API requisites (companyName, inn, kpp, ogrn, legalAddress).
 */
export async function updateTaxRequisitesAction(
  data: CompanyRequisitesInput
): Promise<UpdateCompanyRequisitesResult> {
  const session = await verifySession();
  if (!session?.userId) {
    return { success: false, error: 'Авторизуйтесь для выполнения этого действия' };
  }

  const parsed = taxRequisitesSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message || 'Некорректные реквизиты',
    };
  }

  const companyName = parsed.data.companyName?.trim() || null;
  const inn = parsed.data.inn?.trim() || null;
  const kpp = parsed.data.kpp?.trim() || null;
  const ogrn = parsed.data.ogrn?.trim() || null;
  const legalAddress = parsed.data.legalAddress?.trim() || null;

  try {
    await db.user.update({
      where: { id: session.userId },
      data: {
        companyName,
        inn,
        kpp,
        ogrn,
        legalAddress,
      },
    });

    revalidatePath('/dashboard/settings');
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
    console.error('[updateTaxRequisitesAction] Error:', message);
    return { success: false, error: 'Не удалось сохранить реквизиты компании' };
  }
}

/**
 * Alias wrapper for updateCompanyRequisitesAction.
 */
export async function updateCompanyRequisitesAction(
  data: CompanyRequisitesInput
): Promise<UpdateCompanyRequisitesResult> {
  return updateTaxRequisitesAction(data);
}

/**
 * Updates API Webhook URL, connection status toggle (isWebhookActive), and manages webhookSecret in ApiConfig.
 */
export async function updateApiWebhookAction(
  data: ApiWebhookInput
): Promise<UpdateApiWebhookResult> {
  const session = await verifySession();
  if (!session?.userId) {
    return { success: false, error: 'Авторизуйтесь для выполнения этого действия' };
  }

  const parsed = apiWebhookSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message || 'Некорректный формат URL вебхука',
    };
  }

  const rawUrl = parsed.data.webhookUrl?.trim() || null;

  try {
    const existingConfig = await db.apiConfig.findUnique({
      where: { userId: session.userId },
    });

    let webhookSecret = existingConfig?.webhookSecret || null;

    if (data.regenerateSecret || !webhookSecret) {
      webhookSecret = crypto.randomBytes(24).toString('hex');
    }

    const isWebhookActive = data.isWebhookActive ?? (existingConfig?.isWebhookActive ?? (!!rawUrl));

    const updatedConfig = await db.apiConfig.upsert({
      where: { userId: session.userId },
      create: {
        userId: session.userId,
        isApiEnabled: true,
        prioritySupport: true,
        webhookUrl: rawUrl,
        webhookSecret,
        isWebhookActive,
      },
      update: {
        webhookUrl: rawUrl,
        webhookSecret,
        isWebhookActive,
      },
    });

    revalidatePath('/dashboard/settings');
    return {
      success: true,
      webhookUrl: updatedConfig.webhookUrl,
      webhookSecret: updatedConfig.webhookSecret,
      isWebhookActive: updatedConfig.isWebhookActive,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
    console.error('[updateApiWebhookAction] Error:', message);
    return { success: false, error: 'Не удалось сохранить настройки вебхука' };
  }
}

/**
 * Records user's consent to 152-FZ Terms of Service & Privacy Policy with client IP and timestamp.
 */
export async function confirm152FzConsentAction(): Promise<Confirm152FzConsentResult> {
  const session = await verifySession();
  if (!session?.userId) {
    return { success: false, error: 'Авторизуйтесь для выполнения этого действия' };
  }

  const clientIp = await getClientIp();
  const now = new Date();

  try {
    const updatedUser = await db.user.update({
      where: { id: session.userId },
      data: {
        tosAcceptedAt: now,
        tosAcceptedIp: clientIp,
      },
      select: {
        tosAcceptedAt: true,
        tosAcceptedIp: true,
      },
    });

    revalidatePath('/dashboard/settings');
    return {
      success: true,
      tosAcceptedAt: updatedUser.tosAcceptedAt,
      tosAcceptedIp: updatedUser.tosAcceptedIp,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
    console.error('[confirm152FzConsentAction] Error:', message);
    return { success: false, error: 'Не удалось зафиксировать согласие 152-ФЗ' };
  }
}

/**
 * Generates initial Panel API Key, stores SHA-256 hash in User.apiKeyHash, and returns raw key ONLY ONCE.
 */
export async function generateApiKeyAction(): Promise<ApiKeyActionResult> {
  const session = await verifySession();
  if (!session?.userId) {
    return { success: false, error: 'Авторизуйтесь для выполнения этого действия' };
  }

  const rawKey = 'smm_' + crypto.randomBytes(32).toString('hex');
  const hashedKey = crypto.createHash('sha256').update(rawKey).digest('hex');

  try {
    await db.user.update({
      where: { id: session.userId },
      data: { apiKeyHash: hashedKey },
    });

    revalidatePath('/dashboard/settings');
    revalidatePath('/dashboard/settings/api');
    return { success: true, apiKey: rawKey };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
    console.error('[generateApiKeyAction] Error:', message);
    return { success: false, error: 'Не удалось сгенерировать API-ключ' };
  }
}

/**
 * Resets existing API Key with a newly generated one, updating User.apiKeyHash with SHA-256 hash.
 */
export async function resetApiKeyAction(): Promise<ApiKeyActionResult> {
  return generateApiKeyAction();
}

/**
 * Revokes API Key by clearing User.apiKeyHash.
 */
export async function revokeApiKeyAction(): Promise<{ success: boolean; error?: string }> {
  const session = await verifySession();
  if (!session?.userId) {
    return { success: false, error: 'Авторизуйтесь для выполнения этого действия' };
  }

  try {
    await db.user.update({
      where: { id: session.userId },
      data: { apiKeyHash: null },
    });

    revalidatePath('/dashboard/settings');
    revalidatePath('/dashboard/settings/api');
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
    console.error('[revokeApiKeyAction] Error:', message);
    return { success: false, error: 'Не удалось отозвать API-ключ' };
  }
}

/**
 * Generates a one-time Smart Bind deep-link for Telegram integration (Level 1 Protocol).
 */
export async function getTelegramBindDetailsAction(): Promise<TelegramBindDetailsResult> {
  const session = await verifySession();
  if (!session?.userId) {
    return { success: false, error: 'Авторизуйтесь для выполнения этого действия' };
  }

  try {
    const tenantId = await SettingsProvider.getTenantId();
    const contactSettings = await SettingsProvider.getContactAndLegalSettings();
    let botUsername = contactSettings.TELEGRAM_SUPPORT_BOT;
    if (tenantId === 'flux') {
      botUsername = process.env.FLUX_TELEGRAM_BOT || 'smmflux_support_bot';
    }
    if (!botUsername) {
      botUsername = process.env.TELEGRAM_BOT_USERNAME || 'smmplan_support_bot';
    }
    botUsername = botUsername.replace(/^@/, '');

    const tokenStr = `tg_bind_${crypto.randomBytes(16).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await db.authToken.create({
      data: {
        token: tokenStr,
        userId: session.userId,
        expiresAt,
      },
    });

    const deepLink = `https://t.me/${botUsername}?start=${tokenStr}`;

    return {
      success: true,
      botUsername,
      bindToken: tokenStr,
      deepLink,
      expiresAt: expiresAt.toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
    console.error('[getTelegramBindDetailsAction] Error:', message);
    return { success: false, error: 'Не удалось сгенерировать ссылку для привязки Telegram' };
  }
}

/**
 * Updates Telegram notification switches (orders, balance, tickets).
 */
export async function updateTelegramNotificationSettingsAction(
  data: TelegramNotificationSettingsInput
): Promise<TelegramNotificationSettingsResult> {
  const session = await verifySession();
  if (!session?.userId) {
    return { success: false, error: 'Авторизуйтесь для выполнения этого действия' };
  }

  const parsed = telegramNotificationsSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: 'Некорректные параметры уведомлений' };
  }

  try {
    const updatedUser = await db.user.update({
      where: { id: session.userId },
      data: {
        ...(typeof parsed.data.notifyOrders === 'boolean' && { telegramNotifyOrders: parsed.data.notifyOrders }),
        ...(typeof parsed.data.notifyBalance === 'boolean' && { telegramNotifyBalance: parsed.data.notifyBalance }),
        ...(typeof parsed.data.notifyTickets === 'boolean' && { telegramNotifyTickets: parsed.data.notifyTickets }),
      },
      select: {
        telegramNotifyOrders: true,
        telegramNotifyBalance: true,
        telegramNotifyTickets: true,
      },
    });

    revalidatePath('/dashboard/settings');
    return {
      success: true,
      telegramNotifyOrders: updatedUser.telegramNotifyOrders,
      telegramNotifyBalance: updatedUser.telegramNotifyBalance,
      telegramNotifyTickets: updatedUser.telegramNotifyTickets,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
    console.error('[updateTelegramNotificationSettingsAction] Error:', message);
    return { success: false, error: 'Не удалось обновить настройки уведомлений' };
  }
}

/**
 * Unbinds Telegram account from the user profile.
 */
export async function unbindTelegramAction(): Promise<UnbindTelegramResult> {
  const session = await verifySession();
  if (!session?.userId) {
    return { success: false, error: 'Авторизуйтесь для выполнения этого действия' };
  }

  try {
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { telegramId: true, email: true },
    });

    if (!user?.telegramId) {
      return { success: true };
    }

    const previousTgId = user.telegramId;

    await db.user.update({
      where: { id: session.userId },
      data: { telegramId: null },
    });

    // Record audit log
    await db.adminAuditLog.create({
      data: {
        adminId: session.userId,
        adminEmail: user.email,
        action: 'USER_UNBIND_TELEGRAM',
        target: session.userId,
        targetType: 'USER',
        oldValue: JSON.stringify({ telegramId: previousTgId }),
        newValue: JSON.stringify({ telegramId: null }),
        ipAddress: await getClientIp(),
      },
    });

    revalidatePath('/dashboard/settings');
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
    console.error('[unbindTelegramAction] Error:', message);
    return { success: false, error: 'Не удалось отвязать Telegram аккаунт' };
  }
}
