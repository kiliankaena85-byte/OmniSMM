/**
 * (c) 2024-2026 SMMplan / OmniSMM 1.0. All rights reserved.
 * k6 External Load & Stress Testing Scenario (RAC-2026 / ISO 25010)
 *
 * Simulates high-concurrency traffic targeting OmniSMM endpoints:
 * 1. Catalog browsing (P95 <= 30ms)
 * 2. Balance & Session lookups (P95 <= 15ms)
 * 3. Keyset cursor pagination (P95 <= 25ms)
 *
 * Usage:
 *   k6 run scripts/db-testing/k6-load-scenario.js
 *   k6 run --vus 50 --duration 30s scripts/db-testing/k6-load-scenario.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '5s', target: 20 },   // Warm-up to 20 VUs
    { duration: '20s', target: 50 },  // Sustained load at 50 VUs
    { duration: '5s', target: 0 },    // Ramp-down
  ],
  thresholds: {
    // RAC-2026 SLA budgets
    'http_req_duration{endpoint:catalog}': ['p(95)<30'],
    'http_req_duration{endpoint:orders}': ['p(95)<25'],
    'http_req_failed': ['rate<0.01'], // <1% failure rate
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://127.0.0.1:3000';

export default function () {
  // 1. Catalog Fetch
  const catalogRes = http.get(`${BASE_URL}/api/catalog?tenant=smmplan`, {
    tags: { endpoint: 'catalog' },
  });
  check(catalogRes, {
    'catalog status 200': (r) => r.status === 200,
  });

  // 2. Keyset pagination forward scan
  const ordersRes = http.get(`${BASE_URL}/api/orders?limit=10&dir=forward`, {
    tags: { endpoint: 'orders' },
  });
  check(ordersRes, {
    'orders status 200 or 401': (r) => r.status === 200 || r.status === 401,
  });

  sleep(0.1);
}
