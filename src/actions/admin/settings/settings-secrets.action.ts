'use server';

import crypto from 'crypto';
import { requireStaffPermission } from '@/lib/server/rbac';
import { settingsService } from '@/services/admin/settings.service';
import { SettingsProvider } from '@/lib/settings';
import { normalizeTenantId } from '@/lib/tenant-resolver-edge';

export async function getMaskedPaymentSecrets(tenantId?: string) {
  return requireStaffPermission('settings', 'view', async () => {
    const rawTenant = tenantId || await SettingsProvider.getTenantId();
    const activeTenantId = normalizeTenantId(rawTenant) || 'smmplan';
    const settings = await settingsService.getSystemSettings(activeTenantId);

    return {
      success: true,
      telegramBotToken: settings.telegramBotToken ? '••••••••' : '',
      yookassaSecretKey: settings.yookassaSecretKey ? '••••••••' : '',
      yookassaWebhookSecret: settings.yookassaWebhookSecret ? '••••••••' : '',
      yookassaTestSecretKey: settings.yookassaTestSecretKey ? '••••••••' : '',
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

export async function generateInboundSecretAction() {
  return requireStaffPermission('settings', 'edit', async () => {
    const secret = crypto.randomBytes(32).toString('hex');
    return { success: true, secret };
  });
}
