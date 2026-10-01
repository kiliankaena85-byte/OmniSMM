import https from 'https';
import fs from 'fs';

const token = fs.readFileSync('.yandex-oauth-token', 'utf8').trim();

function fetchJson<T = Record<string, unknown>>(url: string, options: { method?: string; headers?: Record<string, string>; body?: unknown } = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const bodyStr = options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : null;
    const headers: Record<string, string> = {
      ...(options.headers || {})
    };
    if (bodyStr) {
      headers['Content-Length'] = String(Buffer.byteLength(bodyStr));
    }

    const req = https.request(
      {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: options.method || 'GET',
        headers
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => (rawData += chunk));
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, data: JSON.parse(rawData) });
          } catch (e) {
            resolve({ statusCode: res.statusCode, raw: rawData });
          }
        });
      }
    );

    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function main() {
  console.log('🔑 Проверяем информацию об аккаунте через login.yandex.ru...');
  const loginInfo = await fetchJson('https://login.yandex.ru/info?format=json', {
    headers: {
      'Authorization': `OAuth ${token}`
    }
  });
  console.log('Пользователь:', JSON.stringify(loginInfo, null, 2));

  console.log('\n📊 Проверяем доступ к счетчику 113263331...');
  const specificCounter = await fetchJson('https://api-metrika.yandex.net/management/v1/counter/113263331', {
    headers: {
      'Authorization': `OAuth ${token}`,
      'Accept': 'application/json'
    }
  });
  console.log('Счетчик 113263331:', JSON.stringify(specificCounter, null, 2));

  const metrikaOAuth = await fetchJson('https://api-metrika.yandex.net/management/v1/counters', {
    headers: {
      'Authorization': `OAuth ${token}`,
      'Accept': 'application/json'
    }
  });
  console.log('Метрика (OAuth):', JSON.stringify(metrikaOAuth, null, 2));

  console.log('\n📡 Проверяем доступ к API Яндекс.Директа...');
  const directRes = await fetchJson('https://api.direct.yandex.com/json/v5/campaigns', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept-Language': 'ru',
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: {
      method: 'get',
      params: {
        SelectionCriteria: {},
        FieldNames: ['Id', 'Name', 'State', 'Status']
      }
    }
  });
  console.log('Директ ответ:', JSON.stringify(directRes, null, 2));
}

main().catch(console.error);
