import { logger } from '@/lib/logger';

const log = logger.child({ component: 'SmartCaptchaService' });

export interface SmartCaptchaVerifyResult {
  success: boolean;
  error?: string;
}

/**
 * Server-side token verification with Yandex SmartCaptcha (yandex-services-integrator standard).
 * Fail-closed when SMARTCAPTCHA_SERVER_KEY is configured.
 * Gracefully bypassed when key is absent in local dev/test.
 */
export async function verifySmartCaptchaToken(
  token?: string | null,
  clientIp?: string
): Promise<SmartCaptchaVerifyResult> {
  const secret = process.env.SMARTCAPTCHA_SERVER_KEY;

  // If SmartCaptcha secret is not configured (e.g. in test or non-configured dev environment), bypass gracefully
  if (!secret) {
    return { success: true };
  }

  // If secret is configured, token is strictly required
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return {
      success: false,
      error: 'Пожалуйста, пройдите проверку капчи перед отправкой формы.',
    };
  }

  try {
    const params = new URLSearchParams({
      secret,
      token: token.trim(),
    });
    if (clientIp) {
      params.append('ip', clientIp.trim());
    }

    const url = `https://smartcaptcha.yandexcloud.net/validate?${params.toString()}`;
    const res = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      log.error('SmartCaptcha HTTP validation error', { status: res.status });
      return {
        success: false,
        error: 'Сбой проверки капчи. Пожалуйста, попробуйте еще раз.',
      };
    }

    const data = (await res.json()) as { status: string; message?: string };
    if (data.status === 'ok') {
      return { success: true };
    }

    log.warn('SmartCaptcha token rejected by Yandex', { message: data.message });
    return {
      success: false,
      error: 'Проверка капчи не пройдена или срок действия токена истек.',
    };
  } catch (err: unknown) {
    log.error('SmartCaptcha network or timeout error', { err });
    return {
      success: false,
      error: 'Не удалось проверить токен капчи. Проверьте интернет-соединение.',
    };
  }
}
