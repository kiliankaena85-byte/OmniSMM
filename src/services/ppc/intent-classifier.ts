/**
 * src/services/ppc/intent-classifier.ts
 *
 * Семантический классификатор поисковых интентов для Autonomous PPC Agent.
 * Разделяет реальные запросы пользователей на коммерческие и мусорные.
 */

import { IntentClassifierResult, IntentClassifierResultSchema } from './types';

const JUNK_MARKERS = [
  'бесплатно',
  'free',
  'взлом',
  'взломать',
  'слив',
  'скачать',
  'фильм',
  'сериал',
  'кино',
  'заработок',
  'работа',
  'подработка',
  'вакансия',
  'клики',
  'своими руками',
  'кряк',
  'crack',
  'чит',
  'читерство',
  'airmax',
  'кроссовки',
  'мара',
  'обувь',
];

const COMMERCIAL_MARKERS = [
  'купить',
  'заказать',
  'продвижение',
  'раскрутка',
  'панель',
  'провайдер',
  'бусты',
  'подписчики',
  'просмотры',
  'реакции',
  'api',
  'шлюз',
  'сервис',
  'цена',
  'тариф',
  'оптом',
];

export async function classifySearchIntents(rawQueries: string[]): Promise<IntentClassifierResult> {
  const commercialKeywords: string[] = [];
  const negativeWordsSet = new Set<string>();
  const botRiskKeywords: string[] = [];

  for (const raw of rawQueries) {
    const lower = raw.toLowerCase().trim();

    let hasJunk = false;
    for (const marker of JUNK_MARKERS) {
      if (lower.includes(marker)) {
        hasJunk = true;
        negativeWordsSet.add(marker);
      }
    }

    if (hasJunk) {
      if (lower.includes('взлом') || lower.includes('чит') || lower.includes('кряк')) {
        botRiskKeywords.push(raw);
      }
      continue;
    }

    let isCommercial = false;
    for (const marker of COMMERCIAL_MARKERS) {
      if (lower.includes(marker)) {
        isCommercial = true;
        break;
      }
    }

    if (isCommercial) {
      commercialKeywords.push(raw);
    }
  }

  const result: IntentClassifierResult = {
    commercialKeywords,
    negativeKeywordsToAdd: Array.from(negativeWordsSet),
    botRiskKeywords,
    reasoning: `Analyzed ${rawQueries.length} search queries. Identified ${commercialKeywords.length} commercial and ${negativeWordsSet.size} negative keywords.`,
  };

  return IntentClassifierResultSchema.parse(result);
}
