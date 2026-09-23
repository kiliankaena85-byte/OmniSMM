import { ProxyAgent } from 'undici';
import { db } from '@/lib/db';
import { VaultService } from '@/lib/vault';

// Приоритетный каскад: всегда новейшая модель (gemini-flash-latest / gemini-latest) с плавным фоллбэком
const FALLBACK_MODEL_CASCADES = [
  'gemini-flash-latest',
  'gemini-latest',
  'gemini-3-flash-preview',
  'gemini-3-flash',
  'gemini-2.5-flash',
  'gemini-flash-lite-latest',
];

interface CachedModelRegistry {
  resolvedModel: string;
  cachedAt: number;
}

let modelCache: CachedModelRegistry | null = null;
const MODEL_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 часов

// Кэш временных блокировок ключей (при 429 Too Many Requests или 403)
const keyCooldownMap = new Map<string, number>();
const KEY_COOLDOWN_MS = 5 * 60 * 1000; // 5 минут отлежки при исчерпании квоты

let keyRotationIndex = 0;

export interface GeminiCallOptions {
  staffUserId?: string;
  customApiKey?: string;
  systemInstruction?: string;
  contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
  jsonMode?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
}

export class GeminiClient {
  /**
   * Получает список ProxyAgent диспетчеров (для Multi-Proxy Failover пула).
   * Поддерживает несколько прокси через запятую или перевод строки.
   */
  static async getDispatchers(): Promise<Array<ProxyAgent | undefined>> {
    let proxyRaw =
      process.env.GEMINI_PROXY ||
      process.env.HTTPS_PROXY ||
      process.env.HTTP_PROXY ||
      process.env.ALL_PROXY ||
      '';

    try {
      const settings = await db.systemSettings.findFirst({ select: { geminiProxy: true } });
      if (settings?.geminiProxy && settings.geminiProxy.trim()) {
        proxyRaw = settings.geminiProxy.trim();
      }
    } catch {
      // Игнорируем ошибку при недоступности БД
    }

    const proxyUrls = proxyRaw
      .split(/[,\n]/)
      .map((p) => p.trim())
      .filter((p) => p.startsWith('http://') || p.startsWith('https://') || p.startsWith('socks5://'));

    if (proxyUrls.length === 0) {
      try {
        const { UniversalNetworkRouter } = await import('@/lib/network/network-router');
        const resolution = await UniversalNetworkRouter.resolveRoute('https://generativelanguage.googleapis.com', {
          service: 'AI_GEMINI',
        });
        if (resolution.proxyConfig) {
          const { createProxyDispatcher } = await import('@/lib/http/proxy-fetch');
          const disp = await createProxyDispatcher(resolution.proxyConfig);
          return [disp as unknown as ProxyAgent];
        }
      } catch (err) {
        console.warn('[GeminiClient] Could not resolve proxy from NetworkRouter:', err);
      }
      // Direct connection fallback
      return [undefined];
    }

    return proxyUrls.map((url) => new ProxyAgent(url));
  }

  static async getDispatcher(): Promise<ProxyAgent | undefined> {
    const list = await this.getDispatchers();
    return list[0];
  }

  static getBaseUrl(): string {
    return (process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
  }

  /**
   * Извлекает ключи из .env
   */
  static getEnvApiKeys(): string[] {
    const raw = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
    return raw
      .split(/[,\n]/)
      .map((k) => k.trim())
      .filter((k) => k.length > 5);
  }

  static getAvailableApiKeys(): string[] {
    return this.getEnvApiKeys();
  }

  /**
   * Собирает многоуровневый пул ключей:
   * 1. Персональный ключ сотрудника (User.geminiApiKey)
   * 2. Глобальные ключи из админ-панели (SystemSettings.geminiApiKeys)
   * 3. Переменные окружения (.env)
   */
  static async getActiveKeyPool(staffUserId?: string, customApiKey?: string): Promise<string[]> {
    const candidateKeys: string[] = [];

    // 1. Явно переданный ключ
    if (customApiKey && customApiKey.trim().length > 5) {
      candidateKeys.push(customApiKey.trim());
    }

    // 2. Персональный ключ сотрудника из БД
    if (staffUserId) {
      try {
        const user = await db.user.findUnique({
          where: { id: staffUserId },
          select: { geminiApiKey: true },
        });
        if (user?.geminiApiKey) {
          const decrypted = VaultService.decrypt(user.geminiApiKey);
          if (decrypted && decrypted.trim().length > 5) {
            candidateKeys.push(decrypted.trim());
          }
        }
      } catch (err) {
        console.warn(`[GeminiClient] Failed to read staff user key for ${staffUserId}:`, err);
      }
    }

    // 3. Глобальные ключи из БД (SystemSettings)
    try {
      const settings = await db.systemSettings.findFirst({
        select: { geminiApiKeys: true },
      });
      if (settings?.geminiApiKeys) {
        const decrypted = VaultService.decrypt(settings.geminiApiKeys);
        if (decrypted) {
          const dbKeys = decrypted
            .split(/[,\n]/)
            .map((k) => k.trim())
            .filter((k) => k.length > 5);
          candidateKeys.push(...dbKeys);
        }
      }
    } catch {
      // Игнорируем ошибку при инициализации
    }

    // 4. Ключи из .env
    candidateKeys.push(...this.getEnvApiKeys());

    const uniqueKeys = Array.from(new Set(candidateKeys));
    if (uniqueKeys.length === 0) return [];

    const now = Date.now();
    for (const [key, expiresAt] of keyCooldownMap.entries()) {
      if (now >= expiresAt) {
        keyCooldownMap.delete(key);
      }
    }

    const available = uniqueKeys.filter((k) => !keyCooldownMap.has(k));
    return available.length > 0 ? available : uniqueKeys;
  }

  /**
   * Помечает ключ как временно недоступный (например, исчерпан лимит запросов / 429).
   */
  static markKeyCooldown(key: string, reason: string) {
    const expiresAt = Date.now() + KEY_COOLDOWN_MS;
    keyCooldownMap.set(key, expiresAt);
    console.warn(`[GeminiClient] Key ...${key.slice(-6)} placed on cooldown for 5m. Reason: ${reason}`);
  }

  /**
   * Возвращает целевую модель Gemini (по умолчанию gemini-3-flash-preview).
   */
  static async resolveLatestModel(_apiKey?: string): Promise<string> {
    if (process.env.GEMINI_MODEL) {
      return process.env.GEMINI_MODEL.trim();
    }
    return 'gemini-3.8-flash';
  }

  /**
   * Выполняет потоковый запрос к Gemini (SSE) с ротацией ключей, Multi-Proxy Failover
   * и каскадом моделей. Передает каждый чанк текста в коллбэк onChunk.
   */
  static async streamGenerateContent(
    payload: GeminiCallOptions,
    onChunk: (text: string) => void | Promise<void>
  ): Promise<string> {
    const activeKeys = await this.getActiveKeyPool(payload.staffUserId, payload.customApiKey);
    if (activeKeys.length === 0) {
      throw new Error('GEMINI_API_KEY / GEMINI_API_KEYS is not configured');
    }

    const startIndex = keyRotationIndex % activeKeys.length;
    keyRotationIndex = (keyRotationIndex + 1) % 100000;

    const keysToTry = [
      ...activeKeys.slice(startIndex),
      ...activeKeys.slice(0, startIndex),
    ];

    let lastError: Error | null = null;
    const dispatchers = await this.getDispatchers();

    for (const apiKey of keysToTry) {
      const primaryModel = await this.resolveLatestModel(apiKey);
      const candidateModels = Array.from(
        new Set([primaryModel, ...FALLBACK_MODEL_CASCADES])
      );

      for (const model of candidateModels) {
        for (const dispatcher of dispatchers) {
          try {
            const baseUrl = this.getBaseUrl();
            const url = `${baseUrl}/v1beta/models/${model}:streamGenerateContent?alt=sse`;

            const body: Record<string, unknown> = {
              contents: payload.contents,
            };

            if (payload.systemInstruction) {
              body.system_instruction = {
                parts: [{ text: payload.systemInstruction }],
              };
            }

            if (payload.temperature !== undefined || payload.maxOutputTokens !== undefined) {
              body.generationConfig = {
                ...(payload.temperature !== undefined ? { temperature: payload.temperature } : {}),
                ...(payload.maxOutputTokens !== undefined ? { maxOutputTokens: payload.maxOutputTokens } : {}),
              };
            }

            const res = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey,
              },
              body: JSON.stringify(body),
              dispatcher,
              signal: AbortSignal.timeout(payload.timeoutMs || 45000),
            } as unknown as RequestInit);

            if (res.status === 429 || res.status === 403) {
              const errText = await res.text();
              this.markKeyCooldown(apiKey, `HTTP ${res.status}: ${errText.slice(0, 100)}`);
              break;
            }

            if (res.status === 404 || res.status === 400) {
              console.warn(`[GeminiClient] Model ${model} returned HTTP ${res.status} on stream. Trying next model...`);
              modelCache = null;
              break;
            }

            if (!res.ok) {
              const errText = await res.text();
              throw new Error(`Gemini API HTTP ${res.status}: ${errText}`);
            }

            if (!res.body) {
              throw new Error('No readable body in Gemini streaming response');
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let fullText = '';

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data: ')) continue;
                const jsonStr = trimmed.slice(6);
                if (jsonStr === '[DONE]') continue;

                try {
                  const parsed = JSON.parse(jsonStr);
                  const partText = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
                  if (partText) {
                    fullText += partText;
                    await onChunk(partText);
                  }
                } catch {
                  // ignore incomplete JSON chunk
                }
              }
            }

            if (fullText.length > 0) {
              modelCache = { resolvedModel: model, cachedAt: Date.now() };
              return fullText;
            }
          } catch (e: unknown) {
            lastError = e instanceof Error ? e : new Error(String(e));
            console.warn(`[GeminiClient] Stream attempt failed:`, lastError.message);
            const isNetworkError =
              lastError.name === 'TimeoutError' ||
              lastError.name === 'AbortError' ||
              lastError.message.includes('fetch failed') ||
              lastError.message.includes('ECONN') ||
              lastError.message.includes('ETIMEDOUT') ||
              lastError.message.includes('UND_ERR') ||
              lastError.message.includes('Socket closed');
            if (isNetworkError) {
              break;
            }
            continue;
          }
        }
      }
    }

    throw lastError || new Error('All Gemini API keys, proxies, and models exhausted for streaming');
  }

  /**
   * Выполняет запрос к Gemini с ротацией ключей, поддержкой пула прокси с авто-переключением (Multi-Proxy Failover)
   * и каскадным перебором моделей.
   */
  static async generateContent(payload: GeminiCallOptions): Promise<string> {
    const activeKeys = await this.getActiveKeyPool(payload.staffUserId, payload.customApiKey);
    if (activeKeys.length === 0) {
      throw new Error('GEMINI_API_KEY / GEMINI_API_KEYS is not configured');
    }

    const startIndex = keyRotationIndex % activeKeys.length;
    keyRotationIndex = (keyRotationIndex + 1) % 100000;

    const keysToTry = [
      ...activeKeys.slice(startIndex),
      ...activeKeys.slice(0, startIndex),
    ];

    let lastError: Error | null = null;
    const dispatchers = await this.getDispatchers();

    for (const apiKey of keysToTry) {
      const primaryModel = await this.resolveLatestModel(apiKey);
      const candidateModels = Array.from(
        new Set([primaryModel, ...FALLBACK_MODEL_CASCADES])
      );

      for (const model of candidateModels) {
        // Перебираем прокси в случае сбоя соединения (Multi-Proxy Failover)
        for (const dispatcher of dispatchers) {
          try {
            const baseUrl = this.getBaseUrl();
            const url = `${baseUrl}/v1beta/models/${model}:generateContent`;

            const body: Record<string, unknown> = {
              contents: payload.contents,
            };

            if (payload.systemInstruction) {
              body.system_instruction = {
                parts: [{ text: payload.systemInstruction }],
              };
            }

            if (payload.jsonMode || payload.temperature !== undefined || payload.maxOutputTokens !== undefined) {
              body.generationConfig = {
                ...(payload.jsonMode ? { response_mime_type: 'application/json' } : {}),
                ...(payload.temperature !== undefined ? { temperature: payload.temperature } : {}),
                ...(payload.maxOutputTokens !== undefined ? { maxOutputTokens: payload.maxOutputTokens } : {}),
              };
            }

            const res = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey,
              },
              body: JSON.stringify(body),
              dispatcher,
              signal: AbortSignal.timeout(payload.timeoutMs || 25000),
              } as unknown as RequestInit);

            if (res.status === 429 || res.status === 403) {
              const errText = await res.text();
              this.markKeyCooldown(apiKey, `HTTP ${res.status}: ${errText.slice(0, 100)}`);
              break; // Меняем API-ключ
            }

            if (res.status === 404 || res.status === 400) {
              console.warn(`[GeminiClient] Model ${model} returned HTTP ${res.status}. Trying next model in cascade...`);
              modelCache = null;
              break; // Меняем модель
            }

            if (!res.ok) {
              const errText = await res.text();
              throw new Error(`Gemini API HTTP ${res.status}: ${errText}`);
            }

            const data = await res.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

            if (text) {
              modelCache = { resolvedModel: model, cachedAt: Date.now() };
              return text;
            }
          } catch (e: unknown) {
            lastError = e instanceof Error ? e : new Error(String(e));
            console.warn(`[GeminiClient] Proxy/Model attempt failed:`, lastError.message);
            // Переходим к следующему прокси в пуле
            continue;
          }
        }
      }
    }

    throw lastError || new Error('All Gemini API keys, proxies, and models exhausted');
  }
}
