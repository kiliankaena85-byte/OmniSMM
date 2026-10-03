import { assertSafeUrl } from '@/utils/ssrf-guard';

export interface HeroSmsOrder {
  id: string;
  phone: string;
  status: 'WAIT_CODE' | 'RECEIVED' | 'CANCELLED';
  code?: string;
}

export interface FragmentStarsOrderResponse {
  success: boolean;
  orderId: string;
  username: string;
  starsCount: number;
  totalCostTon: number;
  status: 'PENDING' | 'CONFIRMED' | 'DELIVERED';
}

export interface LiveSurfCampaignPayload {
  url: string;
  viewsLimit: number;
  durationSeconds: number;
  targetRegion?: string;
}

/**
 * Клиент глубинной инфраструктуры (Tier-0 Infrastructure Client)
 * Прямое взаимодействие с первоисточниками: SMS-шлюзами (HeroSMS/SMSHub),
 * смарт-контрактами Fragment (Stars & Premium), биржами сессий (Zelenka Market)
 * и P2P-сетями поведенческих факторов (LiveSurf).
 */
export class DeepInfrastructureClient {
  private static readonly USER_AGENT =
    'OmniSMM-DeepCore/1.0 (Enterprise Telegram & SMM Infrastructure Protocol)';

  /**
   * 1. HeroSMS / SMSHub API (Заказ виртуального номера для регистрации сессий Telegram/VK)
   * Протокол stubs/handler_api.php (де-факто мировой стандарт SMS-активаций)
   */
  public static async orderSmsNumber(options: {
    apiUrl: string;
    apiKey: string;
    service: string; // 'tg' для Telegram, 'vk' для ВКонтакте
    country?: number; // 0 - Россия, etc.
    timeoutMs?: number;
  }): Promise<HeroSmsOrder> {
    const { apiUrl, apiKey, service, country = 0, timeoutMs = 8000 } = options;
    await assertSafeUrl(apiUrl);

    const targetUrl = new URL(apiUrl);
    targetUrl.searchParams.set('api_key', apiKey);
    targetUrl.searchParams.set('action', 'getNumber');
    targetUrl.searchParams.set('service', service);
    targetUrl.searchParams.set('country', String(country));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(targetUrl.toString(), {
        method: 'GET',
        headers: { 'User-Agent': this.USER_AGENT },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`HeroSMS Gateway Error: HTTP ${res.status}`);
      }

      const text = await res.text();
      // Формат ответа SMS-шлюзов: ACCESS_NUMBER:12345678:79991234567
      if (text.startsWith('ACCESS_NUMBER')) {
        const parts = text.split(':');
        return {
          id: parts[1],
          phone: parts[2],
          status: 'WAIT_CODE',
        };
      }

      if (text.includes('NO_NUMBERS')) {
        throw new Error('NO_NUMBERS: Пул номеров для сервиса временно исчерпан');
      }

      if (text.includes('NO_BALANCE')) {
        throw new Error('NO_BALANCE: Недостаточно средств на балансе SMS-шлюза');
      }

      throw new Error(`HeroSMS Unknown Gateway Response: ${text}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Проверяет статус поступления SMS-кода
   */
  public static async checkSmsCode(options: {
    apiUrl: string;
    apiKey: string;
    activationId: string;
    timeoutMs?: number;
  }): Promise<{ status: 'WAIT_CODE' | 'RECEIVED' | 'CANCELLED'; code?: string }> {
    const { apiUrl, apiKey, activationId, timeoutMs = 8000 } = options;
    await assertSafeUrl(apiUrl);

    const targetUrl = new URL(apiUrl);
    targetUrl.searchParams.set('api_key', apiKey);
    targetUrl.searchParams.set('action', 'getStatus');
    targetUrl.searchParams.set('id', activationId);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(targetUrl.toString(), {
        method: 'GET',
        headers: { 'User-Agent': this.USER_AGENT },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const text = await res.text();

      // STATUS_OK:12345
      if (text.startsWith('STATUS_OK')) {
        const code = text.split(':')[1];
        return { status: 'RECEIVED', code };
      }

      // STATUS_WAIT_CODE
      if (text.includes('STATUS_WAIT_CODE')) {
        return { status: 'WAIT_CODE' };
      }

      // STATUS_CANCEL
      if (text.includes('STATUS_CANCEL')) {
        return { status: 'CANCELLED' };
      }

      return { status: 'WAIT_CODE' };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 2. Fragment Smart Contract Direct Gateway (Покупка Telegram Stars по себестоимости TON)
   */
  public static async orderFragmentStars(options: {
    apiUrl: string;
    apiKey: string;
    username: string;
    starsCount: number;
    idempotencyKey: string;
    timeoutMs?: number;
  }): Promise<FragmentStarsOrderResponse> {
    const { apiUrl, apiKey, username, starsCount, idempotencyKey, timeoutMs = 8000 } = options;
    await assertSafeUrl(apiUrl);

    const cleanUsername = username.replace(/^@/, '').trim();
    if (!cleanUsername) {
      throw new Error('Указан пустой username для доставки Stars');
    }

    if (starsCount <= 0 || !Number.isInteger(starsCount)) {
      throw new Error(`Недопустимое количество звезд: ${starsCount}`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': this.USER_AGENT,
          'X-API-Key': apiKey,
          'X-Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          recipient: cleanUsername,
          quantity: starsCount,
          currency: 'XTR',
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Fragment Gateway HTTP Error: ${res.status}`);
      }

      const data = await res.json();
      return {
        success: Boolean(data.success ?? true),
        orderId: String(data.orderId || data.id || `frag_${Date.now()}`),
        username: cleanUsername,
        starsCount,
        totalCostTon: Number(data.totalCostTon || (starsCount * 0.0075).toFixed(4)),
        status: data.status || 'CONFIRMED',
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 3. LiveSurf REST API (Управление поведенческими факторами и P2P-просмотрами)
   */
  public static async createLiveSurfTask(options: {
    apiUrl: string;
    apiKey: string;
    payload: LiveSurfCampaignPayload;
    timeoutMs?: number;
  }): Promise<{ success: boolean; taskId: string; viewsAllocated: number }> {
    const { apiUrl, apiKey, payload, timeoutMs = 8000 } = options;
    await assertSafeUrl(apiUrl);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': this.USER_AGENT,
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          url: payload.url,
          views: payload.viewsLimit,
          time: payload.durationSeconds,
          region: payload.targetRegion || 'RU',
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`LiveSurf API HTTP Error: ${res.status}`);
      }

      const data = await res.json();
      return {
        success: true,
        taskId: String(data.taskId || data.id || `ls_${Date.now()}`),
        viewsAllocated: payload.viewsLimit,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 4. Zelenka Market API (Покупка проверенных готовых Telegram сессий session+json / TData)
   */
  public static async queryMarketTelegramSessions(options: {
    apiUrl: string;
    apiKey: string;
    origin?: string; // 'autoreg', 'personal'
    minAgeDays?: number;
    timeoutMs?: number;
  }): Promise<{
    availableCount: number;
    minPriceRub: number;
    sampleItem?: { id: number; title: string; price: number; format: string };
  }> {
    const { apiUrl, apiKey, minAgeDays = 14, timeoutMs = 8000 } = options;
    await assertSafeUrl(apiUrl);

    const targetUrl = new URL(apiUrl);
    targetUrl.searchParams.set('category', 'telegram');
    targetUrl.searchParams.set('min_age_days', String(minAgeDays));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(targetUrl.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': this.USER_AGENT,
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Zelenka Market HTTP Error: ${res.status}`);
      }

      const data = await res.json();
      return {
        availableCount: Number(data.total || data.count || 0),
        minPriceRub: Number(data.minPrice || 15.0),
        sampleItem: data.items?.[0]
          ? {
              id: data.items[0].id,
              title: data.items[0].title,
              price: data.items[0].price,
              format: data.items[0].format || 'session+json',
            }
          : undefined,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
