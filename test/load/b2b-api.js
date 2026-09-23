/* global __ENV */
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  // Этапы нагрузки (Spike Testing + Load Testing)
  stages: [
    { duration: '10s', target: 50 },  // Плавный разгон до 50 VUs (Virtual Users)
    { duration: '30s', target: 50 },  // Плато нагрузки (50 RPS)
    { duration: '10s', target: 200 }, // Резкий спайк (Black Friday) - 200 VUs
    { duration: '20s', target: 200 }, // Держим спайк
    { duration: '10s', target: 0 },   // Охлаждение
  ],
  thresholds: {
    // 95% запросов должны выполняться быстрее 300ms
    http_req_duration: ['p(95)<300'],
    // Уровень ошибок не должен превышать 1%
    http_req_failed: ['rate<0.01'],
  },
};

// URL. При запуске в Docker используем host.docker.internal вместо localhost
const BASE_URL = __ENV.BASE_URL || 'http://host.docker.internal:3000';

export default function () {
  // Симуляция обращения B2B реселлера к API V2 для проверки баланса или создания заказа
  const payload = 'key=test-load-key&action=balance';
  const params = {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  };

  const res = http.post(`${BASE_URL}/api/v2`, payload, params);

  // Проверяем, что сервер не упал (Next.js работает)
  check(res, {
    'status is 200': (r) => r.status === 200,
    'has json response': (r) => r.json() !== undefined,
  });

  // Эмуляция задержки между запросами клиента (чтобы не DDOSить локальную сеть впустую)
  sleep(0.1); 
}
