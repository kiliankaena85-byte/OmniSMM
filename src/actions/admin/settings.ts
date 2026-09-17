'use server';
import { Prisma } from '@prisma/client';

import crypto from 'crypto';
import { requireStaffPermission, requireOwnerPermission } from '@/lib/server/rbac';
import { roleSchema, globalSettingsSchema } from '@/validators/admin.validators';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { settingsService } from '@/services/admin/settings.service';
import { SettingsProvider } from '@/lib/settings';
import { catalogQueue } from '@/lib/queue-manager';
import { VaultService } from '@/lib/vault';
import { auditAdmin, auditAdminAwaitable } from '@/lib/admin-audit';
import { getClientIp } from '@/utils/ip';
import { sendAdminAlert } from '@/lib/notifications';
import { normalizeTenantId } from '@/lib/tenant-resolver-edge';


// ── User Role Update ──
export async function updateUserRole(formData: FormData) {
  return requireOwnerPermission(async (admin) => {
    const parsed = roleSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { success: false as const, error: 'Некорректные данные' };
    const { userId: targetUserId, role: newRole, staffRoleId } = parsed.data;

    if (targetUserId === admin.id) {
      return { success: false as const, error: 'Нельзя изменить собственную роль' };
    }

    // SECURITY: Only OWNER can assign high-level administrative roles
    if (['ADMIN', 'OWNER'].includes(newRole) && admin.role !== 'OWNER') {
      return { success: false as const, error: 'Только Владелец может назначать роли Админ или Владелец' };
    }

    const targetUser = await db.user.findUnique({ where: { id: targetUserId }, select: { role: true, email: true } });
    if (!targetUser) return { success: false as const, error: 'Пользователь не найден' };

    // SECURITY: OWNER role cannot be demoted by anyone
    if (targetUser.role === 'OWNER' && newRole !== 'OWNER') {
      return { success: false as const, error: 'Запрещено понижать роль Владельца платформы' };
    }

    // SECURITY: Only OWNER can change roles of existing ADMINs or OWNERs
    if (['ADMIN', 'OWNER'].includes(targetUser.role) && admin.role !== 'OWNER') {
      return { success: false as const, error: 'Только Владелец может изменять права администраторов' };
    }

    const finalStaffRoleId = staffRoleId === 'NONE' || !staffRoleId ? null : staffRoleId;
    await settingsService.updateUserRole(targetUserId, newRole, finalStaffRoleId);

    const ipAddress = await getClientIp();

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'USER_ROLE_CHANGE',
      target: targetUserId,
      targetType: 'USER',
      oldValue: { email: targetUser.email, role: targetUser.role },
      newValue: { role: newRole },
      ipAddress
    });

    const isHighPrivilege = ['ADMIN', 'OWNER'].includes(newRole) || ['ADMIN', 'OWNER'].includes(targetUser.role);
    sendAdminAlert(
      `${isHighPrivilege ? '🚨' : '⚠️'} <b>СМЕНА РОЛИ СОТРУДНИКА / ПОЛЬЗОВАТЕЛЯ</b>\n` +
      `<b>Администратор:</b> ${admin.email} (IP: ${ipAddress || 'unknown'})\n` +
      `<b>Пользователь:</b> ${targetUser.email} (ID: <code>${targetUserId}</code>)\n` +
      `<b>Старая роль:</b> <code>${targetUser.role}</code>\n` +
      `<b>Новая роль:</b> <code>${newRole}</code>`,
      isHighPrivilege ? 'CRITICAL' : 'WARNING'
    );

    revalidatePath('/admin/settings');
    return { success: true as const };
  });
}


// ── System Settings Update ──
export async function updateGlobalSettings(formData: FormData) {
  if (!formData || typeof formData.entries !== 'function') {
    return { success: false, errors: { _form: ["Некорректные данные формы"] } };
  }
  const result = await requireStaffPermission("settings", "edit", async (user) => {
    const parsed = globalSettingsSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) {
      return { 
        success: false as const, 
        errors: parsed.error.flatten().fieldErrors 
      };
    }

    // ── CRITICAL: Resolve active tenantId from formData or x-tenant-id header ──
    const formTenant = formData.get('tenantId') as string | null;
    const headerTenant = await SettingsProvider.getTenantId();
    const activeTenantId = (formTenant && formTenant.trim()) || headerTenant || 'smmplan';
    
    const {
      siteName,
      siteDescription,
      usnScheme,
      telegramBotToken: rawTelegramBotToken,
      telegramBotMode,
      welcomeMessage,
      yookassaShopId,
      yookassaSecretKey: rawYookassaSecret,
      yookassaWebhookSecret: rawYookassaWebhookSecret,
      yookassaTestShopId,
      yookassaTestSecretKey: rawYookassaTestSecret,
      cryptoBotToken: rawCryptoBotToken,
      robokassaLogin,
      robokassaPassword: rawRobokassaPassword,
      robokassaWebhookPassword: rawRobokassaWebhookPassword,
      exchangeRateUSD,
      emailProvider,
      resendApiKey: rawResendApiKey,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPassword: rawSmtpPassword,
      supportEmailDomain,
      inboundEmailWebhookSecret: rawInboundSecret,
      contactSupportEmail,
      contactPrivacyEmail,
      contactTelegramBot,
      contactTelegramChannel,
      contactWhatsApp,
      contactVk,
      legalCompanyName,
      legalCompanyInn,
      legalCompanyOgrnip,
      legalCompanyAddress,
      taxRate,
      opexMonthly,
      quarantineThreshold,
      globalMarkup,
      safetyFloor,
      siteLogoUrl,
      siteFaviconUrl,
      geminiApiKeys: rawGeminiKeys,
      geminiProxy,
    } = parsed.data;

    const oldSettings = await db.systemSettings.findUnique({ where: { id: activeTenantId } });

    const dataToUpdate: Prisma.SystemSettingsUpdateInput = {};
    if (formData.has('_isGeneralSettings')) {
      dataToUpdate.maintenanceMode = formData.has('maintenanceMode');
    }
    if (formData.has('siteName')) dataToUpdate.siteName = siteName;
    if (formData.has('siteDescription')) dataToUpdate.siteDescription = siteDescription;
    if (formData.has('usnScheme')) dataToUpdate.usnScheme = usnScheme;
    if (formData.has('contactSupportEmail')) dataToUpdate.contactSupportEmail = contactSupportEmail;
    if (formData.has('contactPrivacyEmail')) dataToUpdate.contactPrivacyEmail = contactPrivacyEmail;
    if (formData.has('contactTelegramBot')) {
      dataToUpdate.contactTelegramBot = contactTelegramBot && contactTelegramBot.trim() ? contactTelegramBot.trim() : null;
    }
    if (formData.has('contactTelegramChannel')) {
      dataToUpdate.contactTelegramChannel = contactTelegramChannel && contactTelegramChannel.trim() ? contactTelegramChannel.trim() : null;
    }
    if (formData.has('contactWhatsApp')) dataToUpdate.contactWhatsApp = contactWhatsApp;
    if (formData.has('contactVk')) dataToUpdate.contactVk = contactVk;
    if (formData.has('legalCompanyName')) dataToUpdate.legalCompanyName = legalCompanyName;
    if (formData.has('legalCompanyInn')) dataToUpdate.legalCompanyInn = legalCompanyInn;
    if (formData.has('legalCompanyOgrnip')) dataToUpdate.legalCompanyOgrnip = legalCompanyOgrnip;
    if (formData.has('legalCompanyAddress')) dataToUpdate.legalCompanyAddress = legalCompanyAddress;
    if (formData.has('welcomeMessage') && welcomeMessage !== null) dataToUpdate.welcomeMessage = welcomeMessage;
    
    // Finance & Taxes
    if (formData.has('taxRate') && taxRate !== undefined) dataToUpdate.taxRate = taxRate;
    if (formData.has('opexMonthly') && opexMonthly !== undefined) {
      dataToUpdate.opexMonthly = Math.round(opexMonthly * 100);
    }
    
    // Branding
    if (formData.has('siteLogoUrl')) dataToUpdate.siteLogoUrl = siteLogoUrl ?? null;
    if (formData.has('siteFaviconUrl')) dataToUpdate.siteFaviconUrl = siteFaviconUrl ?? null;

    // Catalog & Pricing
    if (formData.has('globalMarkup') && globalMarkup !== undefined) dataToUpdate.globalMarkup = globalMarkup;
    if (formData.has('safetyFloor') && safetyFloor !== undefined) dataToUpdate.safetyFloor = safetyFloor;
    if (formData.has('quarantineThreshold') && quarantineThreshold !== undefined) {
      dataToUpdate.quarantineThreshold = quarantineThreshold / 100;
    }

    let isRateChanged = false;
    let finalExchangeRate = exchangeRateUSD;

    if (exchangeRateUSD !== undefined && exchangeRateUSD >= 0) {
      if (exchangeRateUSD === 0) {
        // Trigger CBR sync immediately
        try {
          const { CBRRateService } = await import('@/services/system/cbr-rate.service');
          const syncResult = await CBRRateService.syncCBRExchangeRate();
          if (syncResult.updated) {
            finalExchangeRate = syncResult.systemRate;
            dataToUpdate.exchangeRateUSD = finalExchangeRate;
            dataToUpdate.exchangeRateUpdatedAt = new Date();
            isRateChanged = true;
          } else {
            finalExchangeRate = syncResult.systemRate || 95.0;
            dataToUpdate.exchangeRateUSD = finalExchangeRate;
            isRateChanged = true;
          }
        } catch (syncErr) {
          console.error('[SettingsAction] Failed to sync CBR rate on 0 input:', syncErr);
        }
      } else {
        if (oldSettings?.exchangeRateUSD !== exchangeRateUSD) {
          dataToUpdate.exchangeRateUSD = exchangeRateUSD;
          dataToUpdate.exchangeRateUpdatedAt = null; // Clear sync timestamp to indicate manual mode
          isRateChanged = true;
        }
      }
    }

    // Helper to prevent overwriting secrets with placeholders
    const isPlaceholder = (val?: string | null) => !val || val.trim() === '' || val.includes('•••');

    // Only update secrets if they are provided (prevent overwriting with empty or placeholders)
    if (rawTelegramBotToken && !isPlaceholder(rawTelegramBotToken)) dataToUpdate.telegramBotToken = VaultService.encrypt(rawTelegramBotToken.trim());
    if (formData.has('telegramBotMode') && telegramBotMode) dataToUpdate.telegramBotMode = telegramBotMode;

    if (formData.has('yookassaShopId')) dataToUpdate.yookassaShopId = yookassaShopId;
    if (rawYookassaSecret && !isPlaceholder(rawYookassaSecret)) dataToUpdate.yookassaSecretKey = VaultService.encrypt(rawYookassaSecret);
    if (rawYookassaWebhookSecret && !isPlaceholder(rawYookassaWebhookSecret)) dataToUpdate.yookassaWebhookSecret = VaultService.encrypt(rawYookassaWebhookSecret.trim());
    if (formData.has('yookassaTestShopId')) dataToUpdate.yookassaTestShopId = yookassaTestShopId;
    if (rawYookassaTestSecret && !isPlaceholder(rawYookassaTestSecret)) dataToUpdate.yookassaTestSecretKey = VaultService.encrypt(rawYookassaTestSecret);
    if (rawCryptoBotToken && !isPlaceholder(rawCryptoBotToken)) dataToUpdate.cryptoBotToken = VaultService.encrypt(rawCryptoBotToken);
    
    if (formData.has('robokassaLogin')) dataToUpdate.robokassaLogin = robokassaLogin;
    if (rawRobokassaPassword && !isPlaceholder(rawRobokassaPassword)) dataToUpdate.robokassaPassword = VaultService.encrypt(rawRobokassaPassword);
    if (rawRobokassaWebhookPassword && !isPlaceholder(rawRobokassaWebhookPassword)) dataToUpdate.robokassaWebhookPassword = VaultService.encrypt(rawRobokassaWebhookPassword);

    // Email / SMTP settings
    if (formData.has('emailProvider') && emailProvider !== undefined) dataToUpdate.emailProvider = emailProvider;
    if (rawResendApiKey && !isPlaceholder(rawResendApiKey)) {
      dataToUpdate.resendApiKey = VaultService.encrypt(rawResendApiKey.trim());
    }
    if (formData.has('smtpHost') && smtpHost !== null) dataToUpdate.smtpHost = smtpHost;
    if (formData.has('smtpPort') && smtpPort !== undefined) dataToUpdate.smtpPort = smtpPort;
    if (formData.has('smtpUser') && smtpUser !== null) dataToUpdate.smtpUser = smtpUser;
    if (rawSmtpPassword && !isPlaceholder(rawSmtpPassword)) dataToUpdate.smtpPassword = VaultService.encrypt(rawSmtpPassword);
    if (formData.has('supportEmailDomain') && supportEmailDomain !== null) dataToUpdate.supportEmailDomain = supportEmailDomain;
    if (rawInboundSecret && !isPlaceholder(rawInboundSecret)) dataToUpdate.inboundEmailWebhookSecret = VaultService.encrypt(rawInboundSecret);

    // Google Gemini AI & Proxy
    if (formData.has('geminiProxy') && geminiProxy !== null) dataToUpdate.geminiProxy = geminiProxy;
    if (rawGeminiKeys && !isPlaceholder(rawGeminiKeys)) {
      dataToUpdate.geminiApiKeys = VaultService.encrypt(rawGeminiKeys.trim());
    }

    // SECURITY RBAC (P0): Only OWNER can change critical financial gateways, safety floors, and payment credentials
    const isOwnerOnlyChange = Boolean(
      rawYookassaSecret ||
      rawYookassaTestSecret ||
      rawRobokassaPassword ||
      rawRobokassaWebhookPassword ||
      rawCryptoBotToken ||
      formData.has('yookassaShopId') ||
      formData.has('yookassaTestShopId') ||
      formData.has('robokassaLogin') ||
      formData.has('safetyFloor') ||
      formData.has('taxRate') ||
      formData.has('opexMonthly')
    );

    if (isOwnerOnlyChange && user.role !== 'OWNER') {
      return {
        success: false as const,
        errors: {
          _form: ['Только Владелец (OWNER) имеет права на изменение платёжных шлюзов, налогов и порогов безопасности.'],
        },
      };
    }

    // SSRF DEFENSE (P0): Validate SMTP host and Gemini Proxy to block internal / loopback destinations
    const { isPublicHost } = await import('@/lib/ssrf-guard');
    if (smtpHost && smtpHost.trim()) {
      const isSafe = await isPublicHost(smtpHost.trim());
      if (!isSafe) {
        return {
          success: false as const,
          errors: {
            smtpHost: ['Указанный SMTP хост недопустим (локальные и приватные адреса запрещены)'],
          },
        };
      }
    }

    if (geminiProxy && geminiProxy.trim()) {
      try {
        const url = new URL(geminiProxy.trim());
        const isSafe = await isPublicHost(url.hostname);
        if (!isSafe) {
          return {
            success: false as const,
            errors: {
              geminiProxy: ['Указанный прокси недопустим (локальные и приватные адреса запрещены)'],
            },
          };
        }
      } catch {
        return {
          success: false as const,
          errors: {
            geminiProxy: ['Некорректный URL прокси'],
          },
        };
      }
    }

    await settingsService.updateSystemSettings(dataToUpdate as Parameters<typeof settingsService.updateSystemSettings>[0], activeTenantId);

    // Atomic Re-pricing: trigger background sync if rate changed
    if (isRateChanged && finalExchangeRate) {
       try {
         await catalogQueue.add('sync-prices-bg', { type: 'SYNC_PRICES', usdToRub: finalExchangeRate });
       } catch (err) {
         console.error('[SettingsAction] Failed to enqueue background price sync:', err);
       }
    }

    const ipAddress = await getClientIp();

    const sensitiveKeys = ['yookassaSecretKey', 'yookassaTestSecretKey', 'cryptoBotToken', 'robokassaPassword', 'robokassaWebhookPassword', 'resendApiKey', 'smtpPassword', 'inboundEmailWebhookSecret', 'geminiApiKeys'];
    
    const safeDataToUpdate: Record<string, unknown> = { ...dataToUpdate };
    for (const key of sensitiveKeys) {
      if (safeDataToUpdate[key]) safeDataToUpdate[key] = '***';
    }

    const oldValueToLog: Record<string, unknown> = {};
    for (const key of Object.keys(safeDataToUpdate)) {
      if (oldSettings && key in oldSettings) {
        oldValueToLog[key] = sensitiveKeys.includes(key) ? '***' : (oldSettings as Record<string, unknown>)[key];
      }
    }

    await auditAdminAwaitable({
      adminId: user.id,
      adminEmail: user.email,
      action: 'SYSTEM_SETTINGS_UPDATE',
      target: activeTenantId,
      targetType: 'SETTINGS',
      oldValue: oldValueToLog,
      newValue: safeDataToUpdate,
      ipAddress
    });

    // ── DISPATCH REALTIME ADMIN ALERTS (P0) ──
    const changedPaymentKeys: string[] = [];
    const changedTgKeys: string[] = [];
    const changedEmailKeys: string[] = [];

    const paymentKeysList = ['yookassaShopId', 'yookassaSecretKey', 'yookassaWebhookSecret', 'yookassaTestShopId', 'yookassaTestSecretKey', 'cryptoBotToken', 'robokassaLogin', 'robokassaPassword', 'robokassaWebhookPassword', 'safetyFloor', 'globalMarkup'];
    const tgKeysList = ['telegramBotToken', 'telegramBotMode', 'contactTelegramBot', 'contactTelegramChannel'];
    const emailKeysList = ['emailProvider', 'resendApiKey', 'smtpHost', 'smtpPort', 'smtpUser', 'smtpPassword', 'inboundEmailWebhookSecret'];

    for (const key of Object.keys(dataToUpdate)) {
      if (paymentKeysList.includes(key)) changedPaymentKeys.push(key);
      else if (tgKeysList.includes(key)) changedTgKeys.push(key);
      else if (emailKeysList.includes(key)) changedEmailKeys.push(key);
    }

    // 1. Payment Gateways Alert (CRITICAL)
    if (changedPaymentKeys.length > 0) {
      sendAdminAlert(
        `🚨 <b>[P0 CRITICAL] ИЗМЕНЕНИЕ ПЛАТЁЖНЫХ ШЛЮЗОВ</b>\n` +
        `<b>Тенант / Бренд:</b> <code>${activeTenantId}</code>\n` +
        `<b>Администратор:</b> ${user.email} (IP: ${ipAddress || 'unknown'})\n` +
        `<b>Изменённые параметры:</b> <code>${changedPaymentKeys.join(', ')}</code>\n` +
        `⚠️ <i>Проверьте тестовые платежи для верификации доступности шлюзов.</i>`,
        'CRITICAL',
        activeTenantId
      );
    }

    // 2. Telegram Bot Alert (HIGH)
    if (changedTgKeys.length > 0) {
      const newBotUsername = dataToUpdate.contactTelegramBot ? `@${String(dataToUpdate.contactTelegramBot).replace('@', '')}` : 'Отвязан/Сброшен';
      sendAdminAlert(
        `⚠️ <b>ИЗМЕНЕНИЕ НАСТРОЕК TELEGRAM-БОТА</b>\n` +
        `<b>Тенант / Бренд:</b> <code>${activeTenantId}</code>\n` +
        `<b>Администратор:</b> ${user.email} (IP: ${ipAddress || 'unknown'})\n` +
        `<b>Бот поддержки:</b> <code>${newBotUsername}</code>\n` +
        `<b>Изменённые параметры:</b> <code>${changedTgKeys.join(', ')}</code>`,
        'WARNING',
        activeTenantId
      );
    }

    // 3. Maintenance Mode Alert (HIGH)
    if (dataToUpdate.maintenanceMode !== undefined && oldSettings?.maintenanceMode !== dataToUpdate.maintenanceMode) {
      const state = dataToUpdate.maintenanceMode ? '🔴 ВКЛЮЧЁН (Сайт недоступен)' : '🟢 ВЫКЛЮЧЕН (Сайт в штатном режиме)';
      sendAdminAlert(
        `🚨 <b>РЕЖИМ ТЕХРАБОТ ИЗМЕНЁН</b>\n` +
        `<b>Тенант / Бренд:</b> <code>${activeTenantId}</code>\n` +
        `<b>Статус:</b> ${state}\n` +
        `<b>Администратор:</b> ${user.email} (IP: ${ipAddress || 'unknown'})`,
        'CRITICAL',
        activeTenantId
      );
    }

    // 4. Exchange Rate USD Alert (INFO)
    if (isRateChanged && finalExchangeRate) {
      const oldRate = oldSettings?.exchangeRateUSD ? `${oldSettings.exchangeRateUSD} ₽` : 'Не задан';
      sendAdminAlert(
        `💱 <b>КУРС USD К РУБЛЮ ОБНОВЛЁН</b>\n` +
        `<b>Тенант / Бренд:</b> <code>${activeTenantId}</code>\n` +
        `<b>Старый курс:</b> ${oldRate}\n` +
        `<b>Новый курс:</b> <b>${finalExchangeRate} ₽</b>\n` +
        `<b>Администратор:</b> ${user.email} (IP: ${ipAddress || 'unknown'})`,
        'INFO',
        activeTenantId
      );
    }

    // 5. Email / SMTP Alert (WARNING)
    if (changedEmailKeys.length > 0) {
      sendAdminAlert(
        `📧 <b>ИЗМЕНЕНИЕ ПОЧТОВЫХ СЕРВЕРОВ (SMTP / Resend)</b>\n` +
        `<b>Тенант / Бренд:</b> <code>${activeTenantId}</code>\n` +
        `<b>Администратор:</b> ${user.email} (IP: ${ipAddress || 'unknown'})\n` +
        `<b>Изменённые параметры:</b> <code>${changedEmailKeys.join(', ')}</code>`,
        'WARNING',
        activeTenantId
      );
    }

    // Invalidate the SettingsProvider cache so changes apply instantly (SMTP, Keys, Rates, Maintenance)
    try {
      const { revalidateTag, revalidatePath } = (await import('next/cache')) as unknown as { 
        revalidateTag: (tag: string) => unknown; 
        revalidatePath: (path: string, type?: 'layout' | 'page') => unknown; 
      };
      revalidateTag('settings');
      revalidateTag(`settings-${activeTenantId}`);
      SettingsProvider.invalidateLocalCache(activeTenantId);
      revalidatePath('/', 'layout');
      revalidatePath('/admin/settings');
    } catch (cacheErr) {
      console.error('[SettingsAction] Warning: Failed to invalidate cache tag:', cacheErr);
      // We don't throw here to avoid failing the action if Redis cache is temporarily down
    }
    return { success: true as const };
  });

  if (result && typeof result === 'object' && 'success' in result && !result.success) {
    return result;
  }
  return result;
}

// ── Generate Inbound Mail Webhook Secret ──
export async function generateInboundSecretAction() {
  const result = await requireStaffPermission("settings", "edit", async (admin) => {
    const tenantId = await SettingsProvider.getTenantId();
    const rawSecret = crypto.randomBytes(32).toString('hex');
    const encryptedSecret = VaultService.encrypt(rawSecret);

    await settingsService.updateSystemSettings({
      inboundEmailWebhookSecret: encryptedSecret
    }, tenantId);

    const ipAddress = await getClientIp();

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'INBOUND_SECRET_GENERATE',
      target: tenantId,
      targetType: 'SETTINGS',
      ipAddress
    });

    sendAdminAlert(
      `🔑 <b>СГЕНЕРИРОВАН НОВЫЙ СЕКРЕТ ВХОДЯЩЕЙ ПОЧТЫ</b>\n` +
      `<b>Тенант / Бренд:</b> <code>${tenantId}</code>\n` +
      `<b>Администратор:</b> ${admin.email} (IP: ${ipAddress || 'unknown'})`,
      'WARNING',
      tenantId
    );

    try {
      const { revalidateTag } = (await import('next/cache')) as unknown as { revalidateTag: (tag: string) => unknown };
      revalidateTag('settings');
      revalidatePath('/admin/settings');
    } catch (cacheErr) {
      console.error('[SettingsAction] Warning: Failed to invalidate cache tag:', cacheErr);
    }

    return { success: true as const, secret: rawSecret };
  });

  if (result && typeof result === 'object' && 'success' in result && !result.success) {
    throw new Error(result.error);
  }
  return result;
}

// ── Get Masked Settings Action (P0 Secret Protection) ──
export async function getSettingsAction() {
  return requireStaffPermission('settings', 'view', async () => {
    const tenantId = await SettingsProvider.getTenantId();
    const settings = await settingsService.getSystemSettings(tenantId);
    return {
      ...settings,
      yookassaSecretKey: settings.yookassaSecretKey ? '••••••••' + (settings.yookassaSecretKey.length >= 4 ? settings.yookassaSecretKey.slice(-4) : '') : '',
      yookassaTestSecretKey: settings.yookassaTestSecretKey ? '••••••••' + (settings.yookassaTestSecretKey.length >= 4 ? settings.yookassaTestSecretKey.slice(-4) : '') : '',
      robokassaPassword: settings.robokassaPassword ? '••••••••' : '',
      robokassaWebhookPassword: settings.robokassaWebhookPassword ? '••••••••' : '',
      geminiApiKeys: settings.geminiApiKeys ? '••••••••' : '',
      smtpPassword: settings.smtpPassword ? '••••••••' : '',
      cryptoBotToken: settings.cryptoBotToken ? '••••••••' : '',
      resendApiKey: settings.resendApiKey ? '••••••••' : '',
      inboundEmailWebhookSecret: settings.inboundEmailWebhookSecret ? '••••••••' : '',
      _hasYookassaSecret: Boolean(settings.yookassaSecretKey),
      _hasYookassaTestSecret: Boolean(settings.yookassaTestSecretKey),
      _hasRobokassaPassword: Boolean(settings.robokassaPassword),
      _hasCryptoBotToken: Boolean(settings.cryptoBotToken),
      _hasSmtpPassword: Boolean(settings.smtpPassword),
      _hasResendApiKey: Boolean(settings.resendApiKey),
      _hasGeminiKeys: Boolean(settings.geminiApiKeys),
    };
  });
}

// ── Dry Run Integration Test Actions ──

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
      } as any);

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

export async function testTelegramBotConnectionAction() {
  return requireStaffPermission('settings', 'view', async () => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token || token === 'dummy_token') {
      return { success: false, message: 'TELEGRAM_BOT_TOKEN не задан в .env' };
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

export async function testYooKassaConnectionAction() {
  return requireStaffPermission('settings', 'view', async () => {
    const { SettingsManager } = await import('@/lib/settings');
    const secrets = await SettingsManager.getPaymentSecrets();
    if (!secrets.yookassaShopId || !secrets.yookassaSecretKey) {
      return { success: false, message: 'Ключи ЮKassa (Shop ID / Secret Key) не заполнены в БД или .env' };
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

// ── Staff Personal Gemini API Key Update ──
export async function updateStaffGeminiApiKeyAction(targetUserId: string, apiKey: string | null) {
  return requireStaffPermission('settings', 'view', async (admin) => {
    // Only owner/admin or the staff user themselves can change their key
    if (admin.role !== 'OWNER' && admin.role !== 'ADMIN' && admin.id !== targetUserId) {
      return { success: false, error: 'Недостаточно прав для изменения ключа сотрудника' };
    }

    const encryptedKey = apiKey && apiKey.trim().length > 5 ? VaultService.encrypt(apiKey.trim()) : null;

    await db.user.update({
      where: { id: targetUserId },
      data: { geminiApiKey: encryptedKey }
    });

    const ipAddress = await getClientIp();

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'USER_ROLE_CHANGE',
      target: targetUserId,
      targetType: 'USER',
      oldValue: { action: 'UPDATE_PERSONAL_GEMINI_KEY' },
      newValue: { hasKey: Boolean(encryptedKey) },
      ipAddress
    });

    revalidatePath('/admin/settings');
    return { success: true };
  });
}

// ── Disconnect Telegram Bot for Specific Tenant ──
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
        siteName: activeTenantId === 'flux' ? 'SMMflux' : 'SMMplan',
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


