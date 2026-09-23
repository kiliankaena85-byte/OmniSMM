/**
 * AI Regex Generator for SMMplan Link Analyzer
 * Uses gemini-3-flash to create safe, robust regular expressions from URL samples.
 */

import { GeminiClient } from '@/services/ai/gemini-client';
import { SafeRegexValidator } from './safe-regex.validator';

export interface GeneratedRegexResult {
  pattern: string;
  contentType: string;
  description: string;
  exampleUrl: string;
  testCases: Array<{ url: string; shouldMatch: boolean }>;
  confidence: number;
}

export class AiRegexGenerator {
  /**
   * Generates a safe RegExp pattern and test cases given 1-5 sample URLs
   */
  static async generate(options: {
    platformName: string;
    sampleUrls: string[];
    contentTypeHint?: string;
  }): Promise<GeneratedRegexResult> {
    const { platformName, sampleUrls, contentTypeHint } = options;

    if (!sampleUrls || sampleUrls.length === 0) {
      throw new Error('Укажите хотя бы один пример ссылки для анализа');
    }

    const prompt = `Ты — эксперт по регулярным выражениям (RegExp в JavaScript) и анализу ссылок социальных сетей.
Твоя задача — сгенерировать точное, оптимизированное и безопасное регулярное выражение (БЕЗ уязвимостей ReDoS, без вложенных квантификаторов вроде (a+)+), которое соответствует ссылкам для соцсети "${platformName}".

Примеры валидных ссылок от пользователя:
${sampleUrls.map((u, i) => `${i + 1}. ${u}`).join('\n')}
${contentTypeHint ? `Желаемый тип контента: ${contentTypeHint}` : ''}

Требования к ответу:
1. "pattern": строка RegExp (БЕЗ слэшей /.../ и флагов), которая должна матчить эти ссылки. Обязательно экранируй точки и используй capture groups () для ID или username.
2. "contentType": один из типов: "post" | "channel" | "profile" | "reel" | "story" | "video" | "poll" | "bot" | "custom".
3. "description": краткое понятное описание на русском языке (например: "Пост или Reels в Instagram").
4. "exampleUrl": один чистый канонический пример ссылки.
5. "testCases": массив из 3-5 объектов { "url": string, "shouldMatch": boolean }, включающий как позитивные примеры, так и 1-2 негативных примера (ссылки на другие соцсети или невалидные форматы).
6. "confidence": оценка уверенности от 0.1 до 1.0.

Ответь строго в формате JSON без markdown блоков:
{
  "pattern": "...",
  "contentType": "...",
  "description": "...",
  "exampleUrl": "...",
  "testCases": [
    { "url": "...", "shouldMatch": true },
    { "url": "...", "shouldMatch": false }
  ],
  "confidence": 0.95
}`;

    try {
      const responseText = await GeminiClient.generateContent({
        systemInstruction: 'You are an expert in JavaScript regular expressions, URL parsing and anti-ReDoS security.',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        jsonMode: true,
        temperature: 0.1,
        maxOutputTokens: 500,
      });

      const parsed = JSON.parse(responseText.trim()) as GeneratedRegexResult;

      // Validate pattern with SafeRegexValidator
      const audit = SafeRegexValidator.staticAudit(parsed.pattern);
      if (!audit.isSafe) {
        throw new Error(`Сгенерированное выражение не прошло аудит безопасности: ${audit.reason}`);
      }

      return parsed;
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e);
      // Fallback heuristics if Gemini fails or quota is unavailable
      const firstUrl = sampleUrls[0];
      const cleaned = firstUrl.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
      const domainMatch = cleaned.match(/^([^/]+)/);
      const domain = domainMatch ? domainMatch[1] : 'example\\.com';
      const escapedDomain = domain.replace(/\./g, '\\.');

      const fallbackPattern = `${escapedDomain}\\/([a-zA-Z0-9_.-]+)`;

      return {
        pattern: fallbackPattern,
        contentType: contentTypeHint || 'post',
        description: `Автоматическое правило для ${platformName}`,
        exampleUrl: sampleUrls[0],
        testCases: sampleUrls.map(u => ({ url: u, shouldMatch: true })),
        confidence: 0.7,
      };
    }
  }
}
