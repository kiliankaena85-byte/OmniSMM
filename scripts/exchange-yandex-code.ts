import https from 'https';
import fs from 'fs';

const CLIENT_ID = '720b947833134c9b8709d893bed682b7';
const CLIENT_SECRET = 'ffbd7dc773ff4b70a7b2aa41a2ef83a9';
const CODE = process.argv[2] || 'uqkewzach55qan7v';

function postJson<T = Record<string, unknown>>(url: string, data: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const bodyStr = typeof data === 'string' ? data : JSON.stringify(data);
    const headers: Record<string, string> = {
      'Content-Type': typeof data === 'string' ? 'application/x-www-form-urlencoded' : 'application/json',
      'Content-Length': String(Buffer.byteLength(bodyStr))
    };

    const req = https.request(
      {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => (rawData += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(rawData));
          } catch (e) {
            resolve({ raw: rawData, statusCode: res.statusCode });
          }
        });
      }
    );

    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

function getJson(url: string, token: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const req = https.request(
      {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'Authorization': `OAuth ${token}`,
          'Accept': 'application/json'
        }
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => (rawData += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(rawData));
          } catch (e) {
            resolve({ raw: rawData, statusCode: res.statusCode });
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('🔄 Обмен кода подтверждения на OAuth-токен...');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: CODE.trim(),
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET
  }).toString();

  const tokenRes = await postJson('https://oauth.yandex.ru/token', body);
  if (!tokenRes.access_token) {
    console.error('❌ Ошибка обмена токена:', tokenRes);
    process.exit(1);
  }

  const token = tokenRes.access_token;
  console.log('✅ OAuth-токен успешно получен!');

  // Сохраняем токен в локальный файл для скриптов
  fs.writeFileSync('.yandex-oauth-token', token.trim(), 'utf8');

  console.log('\n📊 Запрашиваем список счетчиков Яндекс.Метрики...');
  const countersRes = await getJson('https://api-metrika.yandex.net/management/v1/counters', token);
  console.log('Метрика счетчики:', JSON.stringify(countersRes, null, 2));

  console.log('\n📡 Проверяем доступ к API Яндекс.Директа...');
  const directRes = await postJson('https://api.direct.yandex.ru/v5/campaigns', {
    method: 'get',
    params: {
      SelectionCriteria: {},
      FieldNames: ['Id', 'Name', 'State', 'Status']
    }
  });
  console.log('Директ ответ:', JSON.stringify(directRes, null, 2));
}

main().catch(console.error);
