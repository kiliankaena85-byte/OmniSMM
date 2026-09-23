import http from 'k6/http';
import { check, group, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 30 },  // Ramp-up to 30 VUs
    { duration: '1m', target: 80 },   // Stay at 80 VUs
    { duration: '30s', target: 0 },   // Ramp-down to 0
  ],
  thresholds: {
    http_req_failed: ['rate<0.02'],    // Less than 2% errors
    http_req_duration: ['p(95)<800'],  // 95% of requests must finish within 800ms
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

const categories = [
  '/services',
  '/services/telegram',
  '/services/telegram/subscribers',
  '/services/telegram/views',
  '/services/vk',
  '/services/instagram',
];

export default function () {
  group('Catalog Overview Page', function () {
    const res = http.get(`${BASE_URL}/services`);
    check(res, {
      'catalog status is 200': (r) => r.status === 200,
      'catalog load time < 600ms': (r) => r.timings.duration < 600,
    });
  });

  sleep(0.5);

  group('Category Deep-Dive Pages', function () {
    const targetPath = categories[Math.floor(Math.random() * categories.length)];
    const res = http.get(`${BASE_URL}${targetPath}`);

    check(res, {
      'category page status is 200 or 404': (r) => r.status === 200 || r.status === 404,
      'category response time < 800ms': (r) => r.timings.duration < 800,
    });
  });

  sleep(1);
}
