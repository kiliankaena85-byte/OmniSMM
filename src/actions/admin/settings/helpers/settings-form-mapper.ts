import type { Prisma, SystemSettings } from '@prisma/client';
import type { z } from 'zod';
import type { globalSettingsSchema } from '@/validators/admin.validators';
import { VaultService } from '@/lib/vault';

type GlobalSettingsData = z.infer<typeof globalSettingsSchema>;

const isPlaceholder = (val?: string | null) => !val || val.trim() === '' || val.includes('•••');

export interface MappedSettingsResult {
  dataToUpdate: Prisma.SystemSettingsUpdateInput;
  isRateChanged: boolean;
  finalExchangeRate?: number;
}

export async function mapSettingsFormData(
  formData: FormData,
  data: GlobalSettingsData,
  oldSettings: SystemSettings | null
): Promise<MappedSettingsResult> {
  const dataToUpdate: Prisma.SystemSettingsUpdateInput = {};

  if (formData.has('_isGeneralSettings')) {
    dataToUpdate.maintenanceMode = formData.has('maintenanceMode');
  }
  if (formData.has('siteName')) dataToUpdate.siteName = data.siteName;
  if (formData.has('siteDescription')) dataToUpdate.siteDescription = data.siteDescription;
  if (formData.has('usnScheme')) dataToUpdate.usnScheme = data.usnScheme;
  if (formData.has('contactSupportEmail')) dataToUpdate.contactSupportEmail = data.contactSupportEmail;
  if (formData.has('contactPrivacyEmail')) dataToUpdate.contactPrivacyEmail = data.contactPrivacyEmail;
  if (formData.has('contactTelegramBot')) {
    dataToUpdate.contactTelegramBot = data.contactTelegramBot && data.contactTelegramBot.trim() ? data.contactTelegramBot.trim() : null;
  }
  if (formData.has('contactTelegramChannel')) {
    dataToUpdate.contactTelegramChannel = data.contactTelegramChannel && data.contactTelegramChannel.trim() ? data.contactTelegramChannel.trim() : null;
  }
  if (formData.has('contactWhatsApp')) dataToUpdate.contactWhatsApp = data.contactWhatsApp;
  if (formData.has('contactVk')) dataToUpdate.contactVk = data.contactVk;
  if (formData.has('legalCompanyName')) dataToUpdate.legalCompanyName = data.legalCompanyName;
  if (formData.has('legalCompanyInn')) dataToUpdate.legalCompanyInn = data.legalCompanyInn;
  if (formData.has('legalCompanyOgrnip')) dataToUpdate.legalCompanyOgrnip = data.legalCompanyOgrnip;
  if (formData.has('legalCompanyAddress')) dataToUpdate.legalCompanyAddress = data.legalCompanyAddress;
  if (formData.has('welcomeMessage') && data.welcomeMessage !== null) dataToUpdate.welcomeMessage = data.welcomeMessage;

  // Finance & Taxes
  if (formData.has('taxRate') && data.taxRate !== undefined) dataToUpdate.taxRate = data.taxRate;
  if (formData.has('opexMonthly') && data.opexMonthly !== undefined) {
    dataToUpdate.opexMonthly = Math.round(data.opexMonthly * 100);
  }

  // Branding
  if (formData.has('siteLogoUrl')) dataToUpdate.siteLogoUrl = data.siteLogoUrl ?? null;
  if (formData.has('siteFaviconUrl')) dataToUpdate.siteFaviconUrl = data.siteFaviconUrl ?? null;

  // Catalog & Pricing
  if (formData.has('globalMarkup') && data.globalMarkup !== undefined) dataToUpdate.globalMarkup = data.globalMarkup;
  if (formData.has('safetyFloor') && data.safetyFloor !== undefined) dataToUpdate.safetyFloor = data.safetyFloor;
  if (formData.has('quarantineThreshold') && data.quarantineThreshold !== undefined) {
    dataToUpdate.quarantineThreshold = data.quarantineThreshold / 100;
  }

  let isRateChanged = false;
  let finalExchangeRate = data.exchangeRateUSD;

  if (data.exchangeRateUSD !== undefined && data.exchangeRateUSD >= 0) {
    if (data.exchangeRateUSD === 0) {
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
      if (oldSettings?.exchangeRateUSD !== data.exchangeRateUSD) {
        dataToUpdate.exchangeRateUSD = data.exchangeRateUSD;
        dataToUpdate.exchangeRateUpdatedAt = null;
        isRateChanged = true;
      }
    }
  }

  // Encrypted Secrets
  if (data.telegramBotToken && !isPlaceholder(data.telegramBotToken)) {
    dataToUpdate.telegramBotToken = VaultService.encrypt(data.telegramBotToken.trim());
  }
  if (formData.has('telegramBotMode') && data.telegramBotMode) dataToUpdate.telegramBotMode = data.telegramBotMode;

  if (formData.has('yookassaShopId')) dataToUpdate.yookassaShopId = data.yookassaShopId;
  if (data.yookassaSecretKey && !isPlaceholder(data.yookassaSecretKey)) {
    dataToUpdate.yookassaSecretKey = VaultService.encrypt(data.yookassaSecretKey);
  }
  if (data.yookassaWebhookSecret && !isPlaceholder(data.yookassaWebhookSecret)) {
    dataToUpdate.yookassaWebhookSecret = VaultService.encrypt(data.yookassaWebhookSecret.trim());
  }
  if (formData.has('yookassaTestShopId')) dataToUpdate.yookassaTestShopId = data.yookassaTestShopId;
  if (data.yookassaTestSecretKey && !isPlaceholder(data.yookassaTestSecretKey)) {
    dataToUpdate.yookassaTestSecretKey = VaultService.encrypt(data.yookassaTestSecretKey);
  }
  if (data.cryptoBotToken && !isPlaceholder(data.cryptoBotToken)) {
    dataToUpdate.cryptoBotToken = VaultService.encrypt(data.cryptoBotToken);
  }

  if (formData.has('robokassaLogin')) dataToUpdate.robokassaLogin = data.robokassaLogin;
  if (data.robokassaPassword && !isPlaceholder(data.robokassaPassword)) {
    dataToUpdate.robokassaPassword = VaultService.encrypt(data.robokassaPassword);
  }
  if (data.robokassaWebhookPassword && !isPlaceholder(data.robokassaWebhookPassword)) {
    dataToUpdate.robokassaWebhookPassword = VaultService.encrypt(data.robokassaWebhookPassword);
  }

  // Email / SMTP
  if (formData.has('emailProvider') && data.emailProvider !== undefined) dataToUpdate.emailProvider = data.emailProvider;
  if (data.resendApiKey && !isPlaceholder(data.resendApiKey)) {
    dataToUpdate.resendApiKey = VaultService.encrypt(data.resendApiKey.trim());
  }
  if (formData.has('smtpHost') && data.smtpHost !== null) dataToUpdate.smtpHost = data.smtpHost;
  if (formData.has('smtpPort') && data.smtpPort !== undefined) dataToUpdate.smtpPort = data.smtpPort;
  if (formData.has('smtpUser') && data.smtpUser !== null) dataToUpdate.smtpUser = data.smtpUser;
  if (data.smtpPassword && !isPlaceholder(data.smtpPassword)) {
    dataToUpdate.smtpPassword = VaultService.encrypt(data.smtpPassword);
  }
  if (formData.has('supportEmailDomain') && data.supportEmailDomain !== null) {
    dataToUpdate.supportEmailDomain = data.supportEmailDomain;
  }
  if (data.inboundEmailWebhookSecret && !isPlaceholder(data.inboundEmailWebhookSecret)) {
    dataToUpdate.inboundEmailWebhookSecret = VaultService.encrypt(data.inboundEmailWebhookSecret);
  }

  // Google Gemini AI
  if (formData.has('geminiProxy') && data.geminiProxy !== null) dataToUpdate.geminiProxy = data.geminiProxy;
  if (data.geminiApiKeys && !isPlaceholder(data.geminiApiKeys)) {
    dataToUpdate.geminiApiKeys = VaultService.encrypt(data.geminiApiKeys.trim());
  }

  // Alfa-Bank
  if (formData.has('alfaBankAccountNumber')) {
    dataToUpdate.alfaBankAccountNumber = data.alfaBankAccountNumber ? data.alfaBankAccountNumber.trim() : null;
  }
  if (data.alfaBankApiKey && !isPlaceholder(data.alfaBankApiKey)) {
    dataToUpdate.alfaBankApiKey = VaultService.encrypt(data.alfaBankApiKey.trim());
  }
  if (data.alfaBankClientSecret && !isPlaceholder(data.alfaBankClientSecret)) {
    dataToUpdate.alfaBankClientSecret = VaultService.encrypt(data.alfaBankClientSecret.trim());
  }
  if (formData.has('alfaBankApiBaseUrl')) {
    dataToUpdate.alfaBankApiBaseUrl = data.alfaBankApiBaseUrl ? data.alfaBankApiBaseUrl.trim() : 'https://business.alfabank.ru/ext-api/v1';
  }
  if (formData.has('alfaBankIsSandbox')) {
    dataToUpdate.alfaBankIsSandbox = data.alfaBankIsSandbox ?? true;
  }

  return {
    dataToUpdate,
    isRateChanged,
    finalExchangeRate,
  };
}
