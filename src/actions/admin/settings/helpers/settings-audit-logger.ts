import type { Prisma, SystemSettings } from '@prisma/client';
import { auditAdminAwaitable } from '@/lib/admin-audit';

interface AuditSettingsParams {
  adminId: string;
  adminEmail: string;
  activeTenantId: string;
  dataToUpdate: Prisma.SystemSettingsUpdateInput;
  oldSettings: SystemSettings | null;
  ipAddress?: string;
}

const SENSITIVE_KEYS = [
  'yookassaSecretKey',
  'yookassaTestSecretKey',
  'cryptoBotToken',
  'robokassaPassword',
  'robokassaWebhookPassword',
  'resendApiKey',
  'smtpPassword',
  'inboundEmailWebhookSecret',
  'geminiApiKeys',
  'alfaBankApiKey',
  'alfaBankClientSecret',
];

export async function logSettingsAudit({
  adminId,
  adminEmail,
  activeTenantId,
  dataToUpdate,
  oldSettings,
  ipAddress,
}: AuditSettingsParams): Promise<void> {
  const safeDataToUpdate: Record<string, unknown> = { ...dataToUpdate };
  for (const key of SENSITIVE_KEYS) {
    if (safeDataToUpdate[key]) safeDataToUpdate[key] = '***';
  }

  const oldValueToLog: Record<string, unknown> = {};
  for (const key of Object.keys(safeDataToUpdate)) {
    if (oldSettings && key in oldSettings) {
      oldValueToLog[key] = SENSITIVE_KEYS.includes(key) ? '***' : (oldSettings as Record<string, unknown>)[key];
    }
  }

  await auditAdminAwaitable({
    adminId,
    adminEmail,
    action: 'SYSTEM_SETTINGS_UPDATE',
    target: activeTenantId,
    targetType: 'SETTINGS',
    oldValue: oldValueToLog,
    newValue: safeDataToUpdate,
    ipAddress,
  });
}
