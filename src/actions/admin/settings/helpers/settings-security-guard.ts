import type { z } from 'zod';
import type { globalSettingsSchema } from '@/validators/admin.validators';

type GlobalSettingsData = z.infer<typeof globalSettingsSchema>;

export interface SecurityValidationResult {
  success: boolean;
  errors?: Record<string, string[]>;
}

export async function validateSettingsSecurity(
  data: GlobalSettingsData,
  formData: FormData,
  userRole: string
): Promise<SecurityValidationResult> {
  const {
    yookassaSecretKey: rawYookassaSecret,
    yookassaTestSecretKey: rawYookassaTestSecret,
    robokassaPassword: rawRobokassaPassword,
    robokassaWebhookPassword: rawRobokassaWebhookPassword,
    cryptoBotToken: rawCryptoBotToken,
    alfaBankApiKey: rawAlfaBankApiKey,
    alfaBankClientSecret: rawAlfaBankClientSecret,
    smtpHost,
    geminiProxy,
  } = data;

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
    formData.has('opexMonthly') ||
    rawAlfaBankApiKey ||
    rawAlfaBankClientSecret ||
    formData.has('alfaBankAccountNumber') ||
    formData.has('alfaBankApiBaseUrl') ||
    formData.has('alfaBankIsSandbox')
  );

  if (isOwnerOnlyChange && userRole !== 'OWNER') {
    return {
      success: false,
      errors: {
        _form: ['Только Владелец (OWNER) имеет права на изменение платёжных шлюзов, налогов и порогов безопасности.'],
      },
    };
  }

  // SSRF DEFENSE (P0): Validate SMTP host and Gemini Proxy
  const { isPublicHost } = await import('@/lib/ssrf-guard');
  if (smtpHost && smtpHost.trim()) {
    const isSafe = await isPublicHost(smtpHost.trim());
    if (!isSafe) {
      return {
        success: false,
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
          success: false,
          errors: {
            geminiProxy: ['Указанный прокси недопустим (локальные и приватные адреса запрещены)'],
          },
        };
      }
    } catch {
      return {
        success: false,
        errors: {
          geminiProxy: ['Некорректный URL прокси'],
        },
      };
    }
  }

  return { success: true };
}
