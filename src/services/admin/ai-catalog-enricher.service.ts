import { SecuritySanitizer } from '@/utils/security-sanitizer';
import { checkServiceRefill } from '@/utils/service-refill';
import { GeminiClient } from '@/services/ai/gemini-client';

export interface RawServiceToEnrich {
  externalId?: string;
  name: string;
  description?: string | null;
  categoryName?: string;
  networkName?: string;
  rateUsd?: number;
  minQty?: number;
  maxQty?: number;
  speed?: string;
  isRefillEnabled?: boolean;
}

export interface EnrichedServiceOutput {
  cleanTitle: string;
  badge: string;
  shortDescription: string;
  fullDescriptionMarkdown: string;
  targetType: 'CHANNEL' | 'POST' | 'PROFILE' | 'STORY' | 'CUSTOM';
  clientRequirement: string;
  isRefillConfirmed: boolean;
}

class AiCatalogEnricherService {
  /**
   * Обогащает и стандартизирует название и описание услуги через самовосстанавливающийся GeminiClient.
   */
  async enrichService(raw: RawServiceToEnrich): Promise<EnrichedServiceOutput> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return this.fallbackRuleBasedEnrich(raw);
    }

    const systemInstruction = `Ты — ведущий E-commerce редактор и продакт-маркетолог SMM-платформы SMMplan.
Твоя задача — трансформировать хаотичное, кривое и спамное техническое название/описание услуги от оптового поставщика в кристально чистое, привлекательное и структурированное описание на идеальном русском языке.

ПРАВИЛА:
1. Заголовок (cleanTitle):
   - Стандарт: [Платформа]: [Направление/Качество] ([Главное преимущество / Гео])
   - Пример: "Telegram: Живые подписчики (HQ с гарантией 30 дней)"
   - ЗАПРЕЩЕНО использовать капслок, спам-эмодзи в названии (🔥⚡️🚀), технические ID вроде "[1242]".
2. Бейдж (badge):
   - Короткий тег (до 16 символов), например: "🛡️ Refill 30d", "⚡️ Топ скорость", "🔥 Хит", "💎 Премиум HQ", "⚡️ Быстрый старт".
3. Описание (fullDescriptionMarkdown):
   - Четкие структурированные буллеты Markdown:
     ⚡️ Старт: [указать реальный срок: 30 сек - 15 мин]
     🚀 Скорость: [указать скорость, если есть в данных, иначе "до 5 000 в сутки"]
     👥 Аудитория: [кто подписывается: реальные профили РФ/СНГ или офферы]
     🛡️ Гарантия: [только если есть гарантия/refill, иначе указать "Без гарантии от списаний (Эконом)"]
     ⚠️ Требования к ссылке: [прямая ссылка на открытый канал/пост/профиль]
4. targetType:
   - "CHANNEL" — для подписчиков каналов/групп
   - "POST" — для лайков, просмотров, реакций, репостов
   - "PROFILE" — для историй/профилей
   - "CUSTOM" — для комментов или кастомных данных.

Верни СТРОГИЙ JSON со следующей схемой:
{
  "cleanTitle": string,
  "badge": string,
  "shortDescription": string,
  "fullDescriptionMarkdown": string,
  "targetType": "CHANNEL" | "POST" | "PROFILE" | "STORY" | "CUSTOM",
  "clientRequirement": string,
  "isRefillConfirmed": boolean
}`;

    const promptText = JSON.stringify({
      rawName: SecuritySanitizer.sanitizePromptInjection(raw.name),
      rawDescription: SecuritySanitizer.sanitizePromptInjection(raw.description || ''),
      category: raw.categoryName || 'Общее',
      network: raw.networkName || 'Соцсети',
      rateUsd: raw.rateUsd || 0,
      speed: raw.speed || 'В течение часа',
      providerRefillFlag: Boolean(raw.isRefillEnabled),
      minQty: raw.minQty || 10,
      maxQty: raw.maxQty || 100000,
    });

    try {
      const rawJson = await GeminiClient.generateContent({
        systemInstruction,
        contents: [{ role: 'user', parts: [{ text: promptText }] }],
        jsonMode: true,
        temperature: 0.2,
        timeoutMs: 15000,
      });

      const { z } = await import('zod');
      const EnrichedServiceSchema = z.object({
        cleanTitle: z.string().min(1).max(200).default(raw.name),
        badge: z.string().max(32).default(raw.isRefillEnabled ? '🛡️ Refill' : '⚡️ Быстро'),
        shortDescription: z.string().max(500).default(''),
        fullDescriptionMarkdown: z.string().max(3000).default(''),
        targetType: z.enum(['CHANNEL', 'POST', 'PROFILE', 'STORY', 'CUSTOM']).default('POST'),
        clientRequirement: z.string().max(300).default('Укажите прямую ссылку на открытый объект.'),
        isRefillConfirmed: z.boolean().default(Boolean(raw.isRefillEnabled)),
      });

      const rawParsed = JSON.parse(rawJson);
      const validated = EnrichedServiceSchema.safeParse(rawParsed);

      if (!validated.success) {
        console.warn('[AiCatalogEnricher] Zod validation failed for Gemini output, using fallback:', validated.error.format());
        return this.fallbackRuleBasedEnrich(raw);
      }

      return validated.data;
    } catch (e) {
      console.warn('[AiCatalogEnricher] Generation failed, falling back to rule-based parser:', e);
      return this.fallbackRuleBasedEnrich(raw);
    }
  }

  /**
   * Fallback-генерация без вызова ИИ (надежный детерминированный парсер).
   */
  private fallbackRuleBasedEnrich(raw: RawServiceToEnrich): EnrichedServiceOutput {
    const { hasRefill, badgeLabel } = checkServiceRefill({
      name: raw.name,
      description: raw.description ?? null,
      badge: '',
      isRefillEnabled: raw.isRefillEnabled,
    });

    const netPrefix = raw.networkName ? `${raw.networkName}: ` : '';
    const cleanTitle = `${netPrefix}${raw.name.replace(/^\[\d+\]\s*/, '').replace(/\[[^\]]+\]/g, '').trim()}`;

    const badge = hasRefill ? (badgeLabel || '🛡️ Refill Гарантия') : '⚡️ Быстрый старт';

    const fullDescriptionMarkdown = [
      `⚡️ **Старт:** ${raw.speed || 'Мгновенно (1-15 минут)'}`,
      `🚀 **Лимиты заказа:** от ${raw.minQty || 10} до ${(raw.maxQty || 100000).toLocaleString('ru-RU')} шт.`,
      hasRefill
        ? `🛡️ **Гарантия:** Действует защита от списаний с автоматической докруткой.`
        : `🔒 **Качество:** Эконом-тариф для быстрого набора объема (без гарантии от списаний).`,
      `⚠️ **Требования:** Ссылка должна вести на открытый профиль, канал или публикацию.`,
    ].join('\n\n');

    return {
      cleanTitle,
      badge,
      shortDescription: hasRefill ? 'Качественное продвижение с гарантией автодокрутки.' : 'Быстрый доступный тариф для набора объема.',
      fullDescriptionMarkdown,
      targetType: raw.name.toLowerCase().includes('подписч') || raw.name.toLowerCase().includes('member') ? 'CHANNEL' : 'POST',
      clientRequirement: 'Укажите прямую ссылку на открытый объект продвижения.',
      isRefillConfirmed: hasRefill,
    };
  }
}

export const aiCatalogEnricherService = new AiCatalogEnricherService();
