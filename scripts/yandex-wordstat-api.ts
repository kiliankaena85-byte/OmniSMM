/**
 * Скрипт для работы с официальным Yandex Search API v2 (Wordstat) в AI Studio
 * Документация: https://aistudio.yandex.ru/ru/docs/search-api/concepts/wordstat
 */

import https from 'https';

const API_KEY = process.env.YANDEX_AI_API_KEY || '';
const FOLDER_ID = process.env.YANDEX_FOLDER_ID || '';

if (!API_KEY) {
  console.warn('⚠️ YANDEX_AI_API_KEY is not set. Please provide it via environment variable.');
}

const CLI_PHRASES = process.argv.slice(2).filter(p => !p.startsWith('-'));
const TARGET_PHRASES = CLI_PHRASES.length > 0 ? CLI_PHRASES : [
  'smm панель',
  'smm panel',
  'smm api',
  'продвижение телеграм',
  'продвижение телеграм канала',
  'раскрутка телеграм',
  'накрутка телеграм',
  'бусты телеграм',
  'продвижение вк',
  'продвижение группы вк',
  'продвижение рутуб',
  'просмотры рутуб',
  'продвижение дзен',
  'smmprime',
  'doctorsmm',
  'smmlaba'
];

interface WordstatResult {
  phrase: string;
  count: string;
}

interface WordstatResponse {
  totalCount: string;
  results: WordstatResult[];
  associations?: WordstatResult[];
}

function requestWordstatTop(phrase: string): Promise<WordstatResponse> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      phrase: phrase,
      numPhrases: 10,
      folderId: FOLDER_ID
    });

    const req = https.request(
      {
        hostname: 'searchapi.api.cloud.yandex.net',
        path: '/v2/wordstat/topRequests',
        method: 'POST',
        headers: {
          'Authorization': 'Api-Key ' + API_KEY,
          'x-folder-id': FOLDER_ID,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      },
      (res) => {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error(`Failed to parse: ${body}`));
          }
        });
      }
    );

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  console.log('================================================================');
  console.log('🚀 ОФИЦИАЛЬНЫЙ СРЕЗ YANDEX SEARCH API v2 / WORDSTAT (AI STUDIO)');
  console.log('================================================================');
  console.log(`🔑 Каталог: ${FOLDER_ID}\n`);

  const summaryTable: Array<Record<string, string>> = [];

  for (const phrase of TARGET_PHRASES) {
    try {
      const data = await requestWordstatTop(phrase);
      const total = parseInt(data.totalCount || '0', 10);
      const topPhrases = (data.results || [])
        .slice(0, 3)
        .map((r) => `${r.phrase} (${r.count})`)
        .join(', ');

      summaryTable.push({
        'Ключевая фраза': phrase,
        'Общий спрос (Wordstat)': total.toLocaleString('ru-RU'),
        'Топ подзапросов с частотой': topPhrases || '—'
      });

      // Небольшая задержка 300мс
      await new Promise((r) => setTimeout(r, 300));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Ошибка по фразе "${phrase}":`, msg);
    }
  }

  console.table(summaryTable);
}

main().catch(console.error);
