import { assertSafeUrl } from '@/utils/ssrf-guard';
import { UniversalProvider } from '../providers/universal.provider';
import { ApiMappingDTO } from './provider.service';

export interface ProviderProbeServiceSample {
  serviceId: string;
  name: string;
  category: string;
  rate: string;
  min: string;
  max: string;
  type?: string;
}

export interface ProviderProbeResult {
  success: boolean;
  sanitizedUrl: string;
  sanitizedKey: string;
  latencyMs: number;
  // Balance Step
  balanceSuccess: boolean;
  balance?: string;
  detectedCurrency?: string;
  // Services Step
  servicesSuccess: boolean;
  servicesCount?: number;
  sampleServices?: ProviderProbeServiceSample[];
  // Status & Guidance
  errorMessage?: string;
  suggestedFix?: string;
  suggestedUrl?: string;
}

export class ProviderDiagnosticService {
  /**
   * Cleans and normalizes provider URL (strips slashes, adds https, trims whitespace).
   */
  static sanitizeUrl(rawUrl: string): { cleanUrl: string; suggestedUrl?: string } {
    let url = (rawUrl || '').trim().replace(/[\r\n\t]/g, '');
    if (!url) return { cleanUrl: '' };

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    url = url.replace(/\/+$/, '');

    let suggestedUrl: string | undefined;
    try {
      const parsed = new URL(url);
      if (!parsed.pathname || parsed.pathname === '/' || parsed.pathname === '') {
        suggestedUrl = `${url}/api/v2`;
      }
    } catch {
      // ignore parse error
    }

    return { cleanUrl: url, suggestedUrl };
  }

  /**
   * Sanitizes API key by stripping invisible control chars, spaces, and line breaks.
   */
  static sanitizeKey(rawKey: string): string {
    return (rawKey || '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // zero-width spaces
      .replace(/[\r\n\t]/g, '')
      .trim();
  }

  /**
   * Translates raw API / Network errors into user-friendly actionable Russian text.
   */
  static translateError(error: unknown, targetUrl: string): { message: string; suggestedFix?: string; suggestedUrl?: string } {
    const rawMsg = error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error || '');

    if (rawMsg.includes('Invalid API key') || rawMsg.includes('API key') || rawMsg.includes('Unauthorized') || rawMsg.includes('401')) {
      return {
        message: 'Неверный API-ключ провайдера.',
        suggestedFix: 'Проверьте и скопируйте актуальный API-ключ в настройках вашего аккаунта на сайте провайдера.',
      };
    }

    if (rawMsg.includes('403') || rawMsg.includes('Cloudflare') || rawMsg.includes('ddos-guard') || rawMsg.includes('Forbidden')) {
      return {
        message: 'Запрос отклонен защитой провайдера (Cloudflare / WAF 403).',
        suggestedFix: 'Убедитесь, что ваш IP-адрес не заблокирован в личном кабинете провайдера (проверьте раздел API Whitelist).',
      };
    }

    if (rawMsg.includes('404') || rawMsg.includes('Cannot POST') || rawMsg.includes('Not Found') || rawMsg.includes('HTML')) {
      const { cleanUrl } = this.sanitizeUrl(targetUrl);
      const isMissingApiV2 = !cleanUrl.endsWith('/api/v2') && !cleanUrl.endsWith('/api');
      return {
        message: 'Эндпоинт API не найден (404 / HTML страница вместо JSON).',
        suggestedFix: isMissingApiV2 
          ? `Возможно, пропущен путь к API. Попробуйте использовать адрес: ${cleanUrl}/api/v2`
          : 'Проверьте точный адрес API в документации провайдера.',
        suggestedUrl: isMissingApiV2 ? `${cleanUrl}/api/v2` : undefined,
      };
    }

    if (rawMsg.includes('ENOTFOUND') || rawMsg.includes('getaddrinfo')) {
      return {
        message: 'Домен провайдера не найден (ошибка DNS).',
        suggestedFix: 'Проверьте правильность написания доменного имени сайта провайдера.',
      };
    }

    if (rawMsg.includes('ECONNREFUSED')) {
      return {
        message: 'Сервер провайдера сбросил соединение (Connection Refused).',
        suggestedFix: 'Сервер провайдера сейчас недоступен или не принимает входящие API запросы.',
      };
    }

    if (rawMsg.includes('ETIMEDOUT') || rawMsg.includes('timeout') || rawMsg.includes('Таймаут') || rawMsg.includes('Timeout')) {
      return {
        message: 'Таймаут ответа от сервера провайдера (>10 сек).',
        suggestedFix: 'Сервер провайдера перегружен или временно не отвечает. Попробуйте повторить попытку позже.',
      };
    }

    if (rawMsg.includes('fetch failed')) {
      return {
        message: 'Сетевая ошибка соединения с сервером провайдера.',
        suggestedFix: 'Проверьте доступность сайта провайдера и правильность указанного протокола (https://).',
      };
    }

    return {
      message: rawMsg || 'Неизвестная ошибка связи с провайдером.',
      suggestedFix: 'Проверьте правильность URL и ключа в документации провайдера.',
    };
  }

  /**
   * Executes full health probe: Ping -> Balance & Auto-Currency -> Catalog Sampling.
   */
  static async probe(
    rawUrl: string,
    rawKey: string,
    mapping?: ApiMappingDTO | null,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    timeoutMs = 10000
  ): Promise<ProviderProbeResult> {
    const { cleanUrl, suggestedUrl } = this.sanitizeUrl(rawUrl);
    const cleanKey = this.sanitizeKey(rawKey);

    const result: ProviderProbeResult = {
      success: false,
      sanitizedUrl: cleanUrl,
      sanitizedKey: cleanKey,
      latencyMs: 0,
      balanceSuccess: false,
      servicesSuccess: false,
      suggestedUrl,
    };

    if (!cleanUrl) {
      result.errorMessage = 'Укажите URL адрес API провайдера.';
      return result;
    }

    if (!cleanKey) {
      result.errorMessage = 'Укажите API-ключ для проверки подключения.';
      return result;
    }

    try {
      await assertSafeUrl(cleanUrl);
    } catch (e: unknown) {
      result.errorMessage = `URL заблокирован политикой безопасности: ${(e instanceof Error ? e.message : String(e))}`;
      return result;
    }

    const providerInstance = new UniversalProvider(cleanUrl, cleanKey, { mapping: mapping || null });
    const startTime = Date.now();

    // 1. Probe Balance & Auto-Currency
    try {
      const balanceData = await providerInstance.getBalance();
      result.balanceSuccess = true;
      result.balance = balanceData.balance;
      result.detectedCurrency = (balanceData.currency || 'USD').toUpperCase();
    } catch (err) {
      const translated = this.translateError(err, cleanUrl);
      result.errorMessage = translated.message;
      result.suggestedFix = translated.suggestedFix;
      if (translated.suggestedUrl) result.suggestedUrl = translated.suggestedUrl;
      result.latencyMs = Date.now() - startTime;
      return result;
    }

    // Measure latency after successful balance ping
    result.latencyMs = Date.now() - startTime;

    // 2. Probe Catalog
    try {
      const services = await providerInstance.getServices();
      result.servicesSuccess = true;
      result.servicesCount = services.length;
      result.sampleServices = services.slice(0, 5).map(s => ({
        serviceId: String(s.service),
        name: s.name || 'Без названия',
        category: s.category || 'Общая категория',
        rate: String(s.rate),
        min: String(s.min),
        max: String(s.max),
        type: s.type,
      }));
    } catch (err) {
      // Services fetch failed, but balance succeeded
      const translated = this.translateError(err, cleanUrl);
      result.errorMessage = `Баланс получен, но каталог недоступен: ${translated.message}`;
      result.suggestedFix = translated.suggestedFix;
    }

    result.success = result.balanceSuccess && result.servicesSuccess;
    return result;
  }
}
