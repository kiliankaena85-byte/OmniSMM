import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },  // Ramp-up to 50 VUs
    { duration: '1m', target: 100 },  // Stay at 100 VUs
    { duration: '30s', target: 0 },   // Ramp-down to 0
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],    // Less than 1% errors
    http_req_duration: ['p(95)<500'],  // 95% of requests must finish within 500ms
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const res = http.get(`${BASE_URL}/`, {
    headers: {
      'User-Agent': 'k6-load-test-agent/1.0',
      'Accept': 'text/html,application/xhtml+xml,application/xml',
    },
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
    'has HTML body': (r) => r.body && r.body.includes('<!DOCTYPE html'),
    'has title or brand': (r) => r.body && (r.body.includes('SMMplan') || r.body.includes('SMMflux')),
  });

  sleep(1);
}
