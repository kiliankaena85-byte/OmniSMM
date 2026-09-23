import type { Prisma, SystemSettings } from '@prisma/client';
import { sendAdminAlert } from '@/lib/notifications';

interface DispatchAlertsParams {
  activeTenantId: string;
  userEmail: string;
  ipAddress?: string;
  dataToUpdate: Prisma.SystemSettingsUpdateInput;
  oldSettings: SystemSettings | null;
  isRateChanged: boolean;
  finalExchangeRate?: number;
}

const PAYMENT_KEYS = [
  'yookassaShopId', 'yookassaSecretKey', 'yookassaWebhookSecret',
  'yookassaTestShopId', 'yookassaTestSecretKey', 'cryptoBotToken',
  'robokassaLogin', 'robokassaPassword', 'robokassaWebhookPassword',
  'safetyFloor', 'globalMarkup'
];

const TG_KEYS = ['telegramBotToken', 'telegramBotMode', 'contactTelegramBot', 'contactTelegramChannel'];
const EMAIL_KEYS = ['emailProvider', 'resendApiKey', 'smtpHost', 'smtpPort', 'smtpUser', 'smtpPassword', 'inboundEmailWebhookSecret'];

export async function dispatchSettingsAlerts({
  activeTenantId,
  userEmail,
  ipAddress = 'unknown',
  dataToUpdate,
  oldSettings,
  isRateChanged,
  finalExchangeRate,
}: DispatchAlertsParams): Promise<void> {
  const changedPaymentKeys: string[] = [];
  const changedTgKeys: string[] = [];
  const changedEmailKeys: string[] = [];

  for (const key of Object.keys(dataToUpdate)) {
    if (PAYMENT_KEYS.includes(key)) changedPaymentKeys.push(key);
    else if (TG_KEYS.includes(key)) changedTgKeys.push(key);
    else if (EMAIL_KEYS.includes(key)) changedEmailKeys.push(key);
  }

  // 1. Payment Gateways Alert
  if (changedPaymentKeys.length > 0) {
    sendAdminAlert(
      `🚨 <b>[P0 CRITICAL] ИЗМЕНЕНИЕ ПЛАТЁЖНЫХ ШЛЮЗОВ</b>\n` +
      `<b>Тенант / Бренд:</b> <code>${activeTenantId}</code>\n` +
      `<b>Администратор:</b> ${userEmail} (IP: ${ipAddress})\n` +
      `<b>Изменённые параметры:</b> <code>${changedPaymentKeys.join(', ')}</code>\n` +
      `⚠️ <i>Проверьте тестовые платежи для верификации доступности шлюзов.</i>`,
      'CRITICAL',
      activeTenantId
    );
  }

  // 2. Telegram Bot Alert
  if (changedTgKeys.length > 0) {
    try {
      const { BotSettingsService } = await import('@/bot/services/bot-settings.service');
      BotSettingsService.invalidate(activeTenantId);
    } catch { /* ignore */ }

    try {
      const { redis } = await import('@/lib/redis');
      await redis.publish('bot:reload', JSON.stringify({ tenantId: activeTenantId, timestamp: Date.now() }));
    } catch { /* ignore */ }

    const newBotUsername = dataToUpdate.contactTelegramBot
      ? `@${String(dataToUpdate.contactTelegramBot).replace('@', '')}`
      : 'Отвязан/Сброшен';

    sendAdminAlert(
      `⚠️ <b>ИЗМЕНЕНИЕ НАСТРОЕК TELEGRAM-БОТА</b>\n` +
      `<b>Тенант / Бренд:</b> <code>${activeTenantId}</code>\n` +
      `<b>Администратор:</b> ${userEmail} (IP: ${ipAddress})\n` +
      `<b>Бот поддержки:</b> <code>${newBotUsername}</code>\n` +
      `<b>Изменённые параметры:</b> <code>${changedTgKeys.join(', ')}</code>`,
      'WARNING',
      activeTenantId
    );
  }

  // 3. Maintenance Mode Alert
  if (dataToUpdate.maintenanceMode !== undefined && oldSettings?.maintenanceMode !== dataToUpdate.maintenanceMode) {
    const state = dataToUpdate.maintenanceMode ? '🔴 ВКЛЮЧЁН (Сайт недоступен)' : '🟢 ВЫКЛЮЧЕН (Сайт в штатном режиме)';
    sendAdminAlert(
      `🚨 <b>РЕЖИМ ТЕХРАБОТ ИЗМЕНЁН</b>\n` +
      `<b>Тенант / Бренд:</b> <code>${activeTenantId}</code>\n` +
      `<b>Статус:</b> ${state}\n` +
      `<b>Администратор:</b> ${userEmail} (IP: ${ipAddress})`,
      'CRITICAL',
      activeTenantId
    );
  }

  // 4. Exchange Rate USD Alert
  if (isRateChanged && finalExchangeRate) {
    const oldRate = oldSettings?.exchangeRateUSD ? `${oldSettings.exchangeRateUSD} ₽` : 'Не задан';
    sendAdminAlert(
      `💱 <b>КУРС USD К РУБЛЮ ОБНОВЛЁН</b>\n` +
      `<b>Тенант / Бренд:</b> <code>${activeTenantId}</code>\n` +
      `<b>Старый курс:</b> ${oldRate}\n` +
      `<b>Новый курс:</b> <b>${finalExchangeRate} ₽</b>\n` +
      `<b>Синхронизация ЦБ:</b> ${dataToUpdate.exchangeRateUpdatedAt ? 'Автоматическая' : 'Ручная'}\n` +
      `<b>Администратор:</b> ${userEmail}`,
      'INFO',
      activeTenantId
    );
  }
}
