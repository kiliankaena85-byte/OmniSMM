import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },   // Ramp-up to 50 VUs
    { duration: '1m', target: 150 },   // High load: 150 API requests/sec
    { duration: '30s', target: 0 },    // Ramp-down
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],    // B2B API SLA: less than 1% errors
    http_req_duration: ['p(99)<400'],  // 99% of API requests finish in < 400ms
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_KEY = __ENV.API_KEY || 'smm_demo_test_key_12345';

export default function () {
  const params = {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
  };

  // 1. GET Balance Action
  const balanceRes = http.get(`${BASE_URL}/api/v2?action=balance`, params);
  check(balanceRes, {
    'balance status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    'balance latency < 300ms': (r) => r.timings.duration < 300,
  });

  sleep(0.2);

  // 2. GET Services Catalog Action
  const servicesRes = http.get(`${BASE_URL}/api/v2?action=services`, params);
  check(servicesRes, {
    'services status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    'services latency < 400ms': (r) => r.timings.duration < 400,
  });

  sleep(0.3);

  // 3. GET Order Status Action
  const statusRes = http.get(`${BASE_URL}/api/v2?action=status&order=1001`, params);
  check(statusRes, {
    'order status endpoint responds': (r) => r.status === 200 || r.status === 400 || r.status === 401,
  });

  sleep(0.5);
}
