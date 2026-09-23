import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '20s', target: 20 },  // Ramp-up
    { duration: '40s', target: 50 },  // Peak ordering load
    { duration: '20s', target: 0 },   // Ramp-down
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],     // Less than 5% failure under stress
    http_req_duration: ['p(95)<1200'],  // 95% of request processing under 1.2s
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // 1. Visit new order page
  const pageRes = http.get(`${BASE_URL}/dashboard/new-order`);
  check(pageRes, {
    'new-order page accessible (200/302)': (r) => r.status === 200 || r.status === 302,
  });

  sleep(0.5);

  // 2. Validate Link Analysis API or Catalog Service Lookup
  const checkLinkRes = http.post(
    `${BASE_URL}/api/v2?action=services`,
    JSON.stringify({ key: 'demo_key' }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  check(checkLinkRes, {
    'services lookup returns status 200 or 401': (r) => r.status === 200 || r.status === 401,
    'lookup response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
