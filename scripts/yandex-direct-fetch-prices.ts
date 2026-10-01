/**
 * Скрипт для работы с Яндекс.Директ API:
 * 1. Обмен кода подтверждения на OAuth-токен (если передан CODE)
 * 2. Расчет реального прогноза ставок аукциона через CreateNewForecast / GetForecast
 * 
 * Запуск:
 *   npx tsx scripts/yandex-direct-fetch-prices.ts
 */

import https from 'https';

const CLIENT_ID = '720b947833134c9b8709d893bed682b7';
const CLIENT_SECRET = 'ffbd7dc773ff4b70a7b2aa41a2ef83a9';

// Ключевые слова для анализа
const TARGET_KEYWORDS = [
  'smm панель',
  'smm panel',
  'smm api',
  'smm провайдер',
  'продвижение телеграм канала',
  'раскрутка тг канала',
  'бусты телеграм канала купить',
  'продвижение группы вк',
  'продвижение рутуб канала',
  'smmprime',
  'doctorsmm'
];

const MINUS_WORDS = [
  'бесплатно',
  'скачать',
  'слив',
  'взлом',
  'курсы',
  'вакансии',
  'своими руками'
];

interface YandexForecastPhrase {
  Phrase: string;
  Shows: number;
  Clicks: number;
  CTR?: number;
  Min: number;
  Price: number;
  Max: number;
}

interface YandexForecastResponse {
  data?: {
    Phrases?: YandexForecastPhrase[];
  };
  error_code?: number;
  error_str?: string;
}

function postJson<T = Record<string, unknown>>(url: string, data: unknown, token?: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const bodyStr = typeof data === 'string' ? data : JSON.stringify(data);

    const headers: Record<string, string> = {
      'Content-Type': typeof data === 'string' ? 'application/x-www-form-urlencoded' : 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(bodyStr).toString()
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = https.request(
      {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(rawData);
            resolve(parsed);
          } catch (e) {
            resolve({ raw: rawData, statusCode: res.statusCode });
          }
        });
      }
    );

    req.on('error', (err) => reject(err));
    req.write(bodyStr);
    req.end();
  });
}

/**
 * Обмен 7-значного кода подтверждения на постоянный OAuth-токен
 */
export async function exchangeCodeForToken(code: string): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code.trim(),
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET
  }).toString();

  const res = await postJson('https://oauth.yandex.ru/token', body);
  if (res.access_token) {
    console.log('✅ Успешно получен OAuth-токен:', res.access_token);
    return res.access_token;
  }
  throw new Error(`Ошибка получения токена: ${JSON.stringify(res)}`);
}

/**
 * Запрос живых цен аукциона из Яндекс.Директ (Live 4 API)
 */
export async function fetchLiveDirectPrices(token: string) {
  const apiUrl = 'https://api.direct.yandex.ru/live/v4/json/';

  console.log(`\n📡 Отправка заявки на прогноз ставок в Яндекс.Директ для ${TARGET_KEYWORDS.length} фраз...`);

  const createRes = await postJson(apiUrl, {
    method: 'CreateNewForecast',
    token: token.trim(),
    param: {
      Phrases: TARGET_KEYWORDS,
      GeoID: [225], // 225 = Вся Россия
      Currency: 'RUB',
      CommonMinusWords: MINUS_WORDS
    }
  });

  if (createRes.error_code) {
    console.error('❌ Ошибка ответа Яндекс.Директ API:', createRes);
    return null;
  }

  const forecastId = createRes.data;
  console.log(`⏳ Прогноз успешно поставлен в очередь. Forecast ID: ${forecastId}`);
  console.log('⏳ Ожидаем 5 секунд формирования отчета серверами Яндекса...');

  await new Promise((r) => setTimeout(r, 5000));

  let reportRes: YandexForecastResponse | null = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    reportRes = await postJson<YandexForecastResponse>(apiUrl, {
      method: 'GetForecast',
      token: token.trim(),
      param: forecastId
    });

    if (reportRes.data && reportRes.data.Phrases) {
      break;
    }
    console.log(`Попытка ${attempt}/4: отчет еще формируется... ждем 3 сек.`);
    await new Promise((r) => setTimeout(r, 3000));
  }

  if (!reportRes?.data?.Phrases) {
    console.error('Не удалось получить сформированный отчет:', reportRes);
    return null;
  }

  console.log('\n======================================================');
  console.log('🎯 РЕАЛЬНЫЕ ЦЕНЫ И СТАВКИ АУКЦИОНА ЯНДЕКС.ДИРЕКТ');
  console.log('======================================================');

  const rows = reportRes.data.Phrases.map((p: YandexForecastPhrase) => ({
    Фраза: p.Phrase,
    'Показы/мес': p.Shows,
    Клики: p.Clicks,
    'CTR (%)': (p.CTR || 0).toFixed(2),
    'Мин. цена (₽)': p.Min,
    'Сред. CPC (₽)': p.Price,
    'Макс. ставка (₽)': p.Max
  }));

  console.table(rows);

  // Очистка отчета
  await postJson(apiUrl, {
    method: 'DeleteForecastReport',
    token: token.trim(),
    param: forecastId
  });

  return rows;
}

// Если запущен напрямую
async function main() {
  const token = process.env.YANDEX_DIRECT_TOKEN;
  if (!token) {
    console.log('ℹ️ Токен не задан в YANDEX_DIRECT_TOKEN.');
    console.log(`\nШаг 1. Перейдите по ссылке для авторизации:\nhttps://oauth.yandex.ru/authorize?response_type=token&client_id=${CLIENT_ID}\n`);
    console.log('Шаг 2. Скопируйте полученный токен и передайте его.');
    return;
  }

  await fetchLiveDirectPrices(token);
}

if (process.argv[1]?.includes('yandex-direct-fetch-prices')) {
  main().catch(console.error);
}
