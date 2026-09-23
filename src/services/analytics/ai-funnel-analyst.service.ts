import { redis } from '@/lib/redis';
import { GeminiClient } from '@/services/ai/gemini-client';

export interface FunnelMetricsInput {
  linkPasted: number;
  serviceSelected: number;
  checkoutInitiated: number;
  paymentClicked: number;
  periodDays: number;
  tenantId?: string;
  topServices?: Array<{ name: string; clicks: number }>;
}

export interface FunnelRecommendation {
  title: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  effort: 'EASY' | 'MEDIUM' | 'HARD';
  description: string;
  actionItem: string;
}

export interface AiFunnelAnalysisResult {
  healthScore: number; // 0 - 100
  healthStatus: 'EXCELLENT' | 'GOOD' | 'ATTENTION_NEEDED' | 'CRITICAL';
  summary: string;
  bottleneck: {
    step: string;
    dropOffRate: number;
    description: string;
  };
  strengths: string[];
  growthRecommendations: FunnelRecommendation[];
  source: 'AI_GEMINI' | 'DETERMINISTIC_FALLBACK';
  generatedAt: string;
}

export class AiFunnelAnalystService {
  private static readonly CACHE_TTL_SECONDS = 3600; // 1 hour

  /**
   * Performs an AI-driven CRO analysis of the conversion funnel.
   */
  static async analyzeFunnel(
    metrics: FunnelMetricsInput,
    forceRefresh: boolean = false
  ): Promise<AiFunnelAnalysisResult> {
    const tenantKey = metrics.tenantId || 'global';
    const cacheKey = `ai:funnel:analysis:${tenantKey}:${metrics.periodDays}d`;

    // 1. Check Redis Cache
    if (!forceRefresh) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached) as AiFunnelAnalysisResult;
          return parsed;
        }
      } catch {
        // Cache miss / error -> proceed to generation
      }
    }

    // 2. Compute Mathematical Drop-Offs
    const s1 = Math.max(0, metrics.linkPasted);
    const s2 = Math.max(0, metrics.serviceSelected);
    const s3 = Math.max(0, metrics.checkoutInitiated);
    const s4 = Math.max(0, metrics.paymentClicked);

    const crStep1To2 = s1 > 0 ? (s2 / s1) * 100 : 0;
    const crStep2To3 = s2 > 0 ? (s3 / s2) * 100 : 0;
    const crStep3To4 = s3 > 0 ? (s4 / s3) * 100 : 0;
    const finalCr = s1 > 0 ? (s4 / s1) * 100 : 0;

    const drop1To2 = Math.max(0, 100 - crStep1To2);
    const drop2To3 = Math.max(0, 100 - crStep2To3);
    const drop3To4 = Math.max(0, 100 - crStep3To4);

    // 3. Try Gemini 3 Flash Analysis
    try {
      const prompt = `Ты — ведущий эксперт по CRO (Conversion Rate Optimization) и продуктовой аналитике в сфере SMM-панелей и цифровых услуг.
Проанализируй воронку конверсий за период ${metrics.periodDays} дн. для сайта ${tenantKey.toUpperCase()}:

ДАННЫЕ ВОРОНКИ:
- Шаг 1 (Вход / Трафик / Ссылка): ${s1} сессий
- Шаг 2 (Выбор услуги): ${s2} (CR: ${crStep1To2.toFixed(1)}%, Отвал: ${drop1To2.toFixed(1)}%)
- Шаг 3 (Чекаут / Ввод параметров): ${s3} (CR: ${crStep2To3.toFixed(1)}%, Отвал: ${drop2To3.toFixed(1)}%)
- Шаг 4 (Оплата / Клик по платежу): ${s4} (CR: ${crStep3To4.toFixed(1)}%, Отвал: ${drop3To4.toFixed(1)}%)
- Итоговая конверсия (Final CR): ${finalCr.toFixed(1)}%
- Популярные услуги: ${metrics.topServices?.map(t => `${t.name} (${t.clicks} кликов)`).join(', ') || 'Нет данных'}

Сформируй строгий JSON с полями:
{
  "healthScore": number (от 0 до 100, где 80+ отличная конверсия, 60-79 нормальная, <60 требует оптимизации),
  "healthStatus": "EXCELLENT" | "GOOD" | "ATTENTION_NEEDED" | "CRITICAL",
  "summary": "Краткое заключение на 1-2 предложения о состоянии воронки на русском языке",
  "bottleneck": {
    "step": "Название шага с наибольшим отвалом (например: 'Шаг 2: Выбор услуги' или 'Шаг 3: Чекаут')",
    "dropOffRate": number (процент отвала на этом шаге),
    "description": "Причина отвала и гипотеза почему клиенты уходят"
  },
  "strengths": [
    "Сильная сторона 1 (на русском языке)",
    "Сильная сторона 2"
  ],
  "growthRecommendations": [
    {
      "title": "Заголовок рекомендации 1",
      "impact": "HIGH" | "MEDIUM" | "LOW",
      "effort": "EASY" | "MEDIUM" | "HARD",
      "description": "Суть гипотезы и обоснование",
      "actionItem": "Конкретное действие для овнера (что изменить в тарифах, UI или формах)"
    },
    {
      "title": "Заголовок рекомендации 2",
      "impact": "HIGH" | "MEDIUM" | "LOW",
      "effort": "EASY" | "MEDIUM" | "HARD",
      "description": "Суть гипотезы",
      "actionItem": "Конкретное действие"
    },
    {
      "title": "Заголовок рекомендации 3",
      "impact": "HIGH" | "MEDIUM" | "LOW",
      "effort": "EASY" | "MEDIUM" | "HARD",
      "description": "Суть гипотезы",
      "actionItem": "Конкретное действие"
    }
  ]
}`;

      const responseText = await GeminiClient.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        jsonMode: true,
        temperature: 0.2,
      });

      const cleanJson = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsedAi = JSON.parse(cleanJson);

      const result: AiFunnelAnalysisResult = {
        healthScore: typeof parsedAi.healthScore === 'number' ? parsedAi.healthScore : 75,
        healthStatus: ['EXCELLENT', 'GOOD', 'ATTENTION_NEEDED', 'CRITICAL'].includes(parsedAi.healthStatus)
          ? parsedAi.healthStatus
          : 'GOOD',
        summary: parsedAi.summary || 'Воронка демонстрирует стабильную динамику прохождения этапов заказа.',
        bottleneck: {
          step: parsedAi.bottleneck?.step || 'Шаг 2 ➔ Шаг 3 (Чекаут)',
          dropOffRate: typeof parsedAi.bottleneck?.dropOffRate === 'number' ? parsedAi.bottleneck.dropOffRate : drop2To3,
          description: parsedAi.bottleneck?.description || 'Основной отвал происходит при переходе к параметрам заказа.'
        },
        strengths: Array.isArray(parsedAi.strengths) ? parsedAi.strengths : ['Высокий интерес к каталогу услуг'],
        growthRecommendations: Array.isArray(parsedAi.growthRecommendations) ? parsedAi.growthRecommendations : [],
        source: 'AI_GEMINI',
        generatedAt: new Date().toISOString()
      };

      // Save to Redis
      try {
        await redis.set(cacheKey, JSON.stringify(result), 'EX', this.CACHE_TTL_SECONDS);
      } catch {
        // Non-blocking
      }

      return result;
    } catch {
      // 4. Fallback to Deterministic Heuristic Engine
      const fallbackResult = this.buildDeterministicFallback(metrics, {
        crStep1To2,
        crStep2To3,
        crStep3To4,
        finalCr,
        drop1To2,
        drop2To3,
        drop3To4,
      });

      try {
        await redis.set(cacheKey, JSON.stringify(fallbackResult), 'EX', this.CACHE_TTL_SECONDS);
      } catch {
        // Non-blocking
      }

      return fallbackResult;
    }
  }

  /**
   * Deterministic Fallback calculation based on standard e-commerce CRO thresholds.
   */
  public static buildDeterministicFallback(
    metrics: FunnelMetricsInput,
    rates: {
      crStep1To2: number;
      crStep2To3: number;
      crStep3To4: number;
      finalCr: number;
      drop1To2: number;
      drop2To3: number;
      drop3To4: number;
    }
  ): AiFunnelAnalysisResult {
    let healthScore = 70;
    let healthStatus: AiFunnelAnalysisResult['healthStatus'] = 'GOOD';
    let bottleneckStep = 'Шаг 2: Выбор услуги';
    let bottleneckDrop = rates.drop1To2;
    let bottleneckDesc = 'Пользователи открывают лендинг, но не переходят к конкретной услуге.';

    if (rates.drop2To3 > rates.drop1To2 && rates.drop2To3 > rates.drop3To4) {
      bottleneckStep = 'Шаг 3: Ввод параметров и чекаут';
      bottleneckDrop = rates.drop2To3;
      bottleneckDesc = 'Пользователи выбирают услугу, но сомневаются на этапе ввода ссылки или настройки объема.';
    } else if (rates.drop3To4 > rates.drop1To2 && rates.drop3To4 > rates.drop2To3) {
      bottleneckStep = 'Шаг 4: Выбор способа оплаты';
      bottleneckDrop = rates.drop3To4;
      bottleneckDesc = 'Клиенты доходят до оплаты, но не завершают транзакцию (возможно, не хватает привычных шлюзов).';
    }

    if (rates.finalCr >= 15) {
      healthScore = 92;
      healthStatus = 'EXCELLENT';
    } else if (rates.finalCr >= 7) {
      healthScore = 78;
      healthStatus = 'GOOD';
    } else if (rates.finalCr >= 2) {
      healthScore = 55;
      healthStatus = 'ATTENTION_NEEDED';
    } else {
      healthScore = 35;
      healthStatus = 'CRITICAL';
    }

    return {
      healthScore,
      healthStatus,
      summary: `Итоговая конверсия составляет ${rates.finalCr.toFixed(1)}%. Главная точка роста — оптимизация этапа «${bottleneckStep}».`,
      bottleneck: {
        step: bottleneckStep,
        dropOffRate: Math.round(bottleneckDrop),
        description: bottleneckDesc,
      },
      strengths: [
        `Конверсия на этапе выбора услуги: ${rates.crStep1To2.toFixed(1)}%`,
        metrics.topServices && metrics.topServices.length > 0
          ? `Явный спрос на услугу: «${metrics.topServices[0].name}»`
          : 'Сбалансированное распределение трафика по каталогу',
      ],
      growthRecommendations: [
        {
          title: 'Упрощение выбора услуги и фильтров',
          impact: 'HIGH',
          effort: 'EASY',
          description: 'Добавьте бейджи «Хит продаж» и «Мгновенный старт» на ключевые тарифы.',
          actionItem: 'Отметьте топ-3 маржинальные услуги флагом популярности в каталоге.',
        },
        {
          title: 'Снижение трения при вводе ссылки',
          impact: 'HIGH',
          effort: 'MEDIUM',
          description: 'Показывайте пример правильной ссылки для каждой социальной сети прямо в поле ввода.',
          actionItem: 'Убедитесь, что для Telegram и Instagram отображаются визуальные подсказки форматов ссылок.',
        },
        {
          title: 'Повышение доверия на шаге оплаты',
          impact: 'MEDIUM',
          effort: 'EASY',
          description: 'Выделите логотипы быстрых платежей (СБП, ЮMoney, банковские карты) с пометкой 0% комиссии.',
          actionItem: 'Проверьте активность шлюзов ЮKassa и баланса в настройках платежей.',
        },
      ],
      source: 'DETERMINISTIC_FALLBACK',
      generatedAt: new Date().toISOString(),
    };
  }
}
