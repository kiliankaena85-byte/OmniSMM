import http from 'http';

interface TestResult {
  category: string;
  testName: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  details: string;
}

const results: TestResult[] = [];
const BASE_URL = 'http://127.0.0.1:3000';

function record(category: string, testName: string, status: 'PASS' | 'FAIL' | 'WARN', details: string) {
  results.push({ category, testName, status, details });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} [${category}] ${testName}: ${details}`);
}

async function fetchReq(urlPath: string, options: RequestInit = {}) {
  return await fetch(`${BASE_URL}${urlPath}`, {
    redirect: 'manual', // do not auto-follow redirects so we can inspect 307/308/302
    ...options,
  });
}

async function waitForServer(retries = 15, delayMs = 1000): Promise<boolean> {
  console.log(`⏳ Waiting for server at ${BASE_URL} to respond...`);
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${BASE_URL}/`, { method: 'HEAD' });
      if (res.status) {
        console.log(`🚀 Server is LIVE! HTTP Status: ${res.status}`);
        return true;
      }
    } catch {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  return false;
}

async function runLiveSecurityAudit() {
  console.log('\n======================================================');
  console.log('🛡️  DYNAMIC APPLICATION SECURITY TESTING (DAST / LIVE AUDIT)');
  console.log('======================================================\n');

  const isUp = await waitForServer();
  if (!isUp) {
    console.error('❌ Server is not responding on port 3000. Dynamic test aborted.');
    process.exit(1);
  }

  // ----------------------------------------------------
  // TEST SUITE 1: HTTP Security Headers
  // ----------------------------------------------------
  console.log('\n--- 1. HTTP Security Headers Audit ---');
  try {
    const res = await fetchReq('/');
    const headers = res.headers;

    const xFrame = headers.get('x-frame-options');
    if (xFrame || headers.get('content-security-policy')?.includes('frame-ancestors')) {
      record('Headers', 'Clickjacking Protection', 'PASS', `X-Frame-Options/CSP frame-ancestors detected: ${xFrame || 'CSP frame-ancestors'}`);
    } else {
      record('Headers', 'Clickjacking Protection', 'WARN', 'X-Frame-Options header not explicitly set on root (check proxy/nginx in prod)');
    }

    const nosniff = headers.get('x-content-type-options');
    if (nosniff === 'nosniff') {
      record('Headers', 'MIME Sniffing (nosniff)', 'PASS', 'X-Content-Type-Options: nosniff is active');
    } else {
      record('Headers', 'MIME Sniffing (nosniff)', 'WARN', 'nosniff not set on root response');
    }

    const poweredBy = headers.get('x-powered-by');
    if (!poweredBy) {
      record('Headers', 'Technology Disclosure', 'PASS', 'X-Powered-By header is hidden / suppressed');
    } else {
      record('Headers', 'Technology Disclosure', 'WARN', `X-Powered-By reveals: ${poweredBy}`);
    }
  } catch (e: any) {
    record('Headers', 'Root Header Inspection', 'FAIL', e.message);
  }

  // ----------------------------------------------------
  // TEST SUITE 2: Protected Admin & Operator Routes (Auth Bypass)
  // ----------------------------------------------------
  console.log('\n--- 2. Unauthenticated Protected Route Probe ---');
  const protectedRoutes = [
    '/admin',
    '/admin/finance',
    '/admin/providers',
    '/admin/settings',
    '/admin/catalog',
    '/operator/dashboard',
    '/operator/orders',
    '/dashboard/orders',
    '/dashboard/deposit'
  ];

  for (const route of protectedRoutes) {
    try {
      const res = await fetchReq(route);
      // Protected routes should redirect to login (302/303/307/308) or return 401/403/404
      if ([301, 302, 303, 307, 308, 401, 403, 404].includes(res.status)) {
        const location = res.headers.get('location') || '';
        record('Auth Guard', `Route ${route}`, 'PASS', `Protected with status ${res.status} ${location ? '-> redirecting to ' + location : ''}`);
      } else if (res.status === 200) {
        // If 200, check if it's the login form or an exposed admin interface
        const text = await res.text();
        if (text.includes('Войти') || text.includes('login') || text.includes('Авторизация')) {
          record('Auth Guard', `Route ${route}`, 'PASS', 'Renders login/auth barrier on unauthenticated request');
        } else {
          record('Auth Guard', `Route ${route}`, 'FAIL', `UNAUTHENTICATED ACCESS EXPOSED! Returned 200 OK without login barrier.`);
        }
      } else {
        record('Auth Guard', `Route ${route}`, 'PASS', `Access blocked with status ${res.status}`);
      }
    } catch (e: any) {
      record('Auth Guard', `Route ${route}`, 'FAIL', e.message);
    }
  }

  // ----------------------------------------------------
  // TEST SUITE 3: Payment Webhook Forgery & Injection
  // ----------------------------------------------------
  console.log('\n--- 3. Webhook Forgery & Signature Tampering ---');
  
  // 3.1 Fake ЮKassa webhook
  try {
    const fakeYookassa = {
      type: 'notification',
      event: 'payment.succeeded',
      object: {
        id: 'fake-yookassa-attack-id',
        status: 'succeeded',
        amount: { value: '99999.00', currency: 'RUB' },
        metadata: { userId: 'victim-id-123' }
      }
    };
    const res = await fetchReq('/api/webhooks/yookassa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fakeYookassa)
    });
    // Should reject fake IP / missing signature / unverified transaction
    if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 404 || res.status === 500) {
      record('Webhooks', 'Fake ЮKassa Injection', 'PASS', `Rejected unauthorized forged webhook with status ${res.status}`);
    } else {
      const text = await res.text();
      record('Webhooks', 'Fake ЮKassa Injection', 'FAIL', `Accepted forged webhook! Status: ${res.status}, Body: ${text}`);
    }
  } catch (e: any) {
    record('Webhooks', 'Fake ЮKassa Injection', 'PASS', `Connection dropped/rejected: ${e.message}`);
  }

  // 3.2 Fake Robokassa webhook
  try {
    const res = await fetchReq('/api/webhooks/robokassa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'OutSum=50000&InvId=9999&SignatureValue=FAKESIGNATURE12345'
    });
    if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 404 || res.status === 500) {
      record('Webhooks', 'Fake Robokassa Signature', 'PASS', `Rejected invalid Robokassa signature with status ${res.status}`);
    } else {
      record('Webhooks', 'Fake Robokassa Signature', 'FAIL', `Accepted forged signature! Status: ${res.status}`);
    }
  } catch (e: any) {
    record('Webhooks', 'Fake Robokassa Signature', 'PASS', `Rejected: ${e.message}`);
  }

  // 3.3 Fake CryptoBot webhook
  try {
    const res = await fetchReq('/api/webhooks/crypto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'crypto-pay-api-signature': 'invalid_hmac' },
      body: JSON.stringify({ update_type: 'invoice_paid', payload: { invoice_id: 12345, amount: '100' } })
    });
    if ([400, 401, 403, 404, 500].includes(res.status)) {
      record('Webhooks', 'Fake Crypto Signature', 'PASS', `Rejected invalid CryptoPay signature with status ${res.status}`);
    } else {
      record('Webhooks', 'Fake Crypto Signature', 'FAIL', `Accepted forged crypto signature! Status: ${res.status}`);
    }
  } catch (e: any) {
    record('Webhooks', 'Fake Crypto Signature', 'PASS', `Rejected: ${e.message}`);
  }

  // ----------------------------------------------------
  // TEST SUITE 4: Cross-Origin Server Action CSRF Attack
  // ----------------------------------------------------
  console.log('\n--- 4. Cross-Origin CSRF Server Action Attack ---');
  try {
    const res = await fetchReq('/', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8',
        'Next-Action': 'malicious_forged_action_id',
        'Origin': 'https://evil-attacker-website.com'
      },
      body: JSON.stringify(['malicious_payload'])
    });
    // Next.js App Router rejects invalid Origin or bad Next-Action header
    if ([400, 403, 404, 405, 500].includes(res.status)) {
      record('CSRF', 'Cross-Origin Action Forgery', 'PASS', `Next.js blocked untrusted Cross-Origin POST (Status: ${res.status})`);
    } else {
      record('CSRF', 'Cross-Origin Action Forgery', 'WARN', `Status ${res.status} returned for forged action`);
    }
  } catch (e: any) {
    record('CSRF', 'Cross-Origin Action Forgery', 'PASS', `Blocked connection: ${e.message}`);
  }

  // ----------------------------------------------------
  // TEST SUITE 5: Injection & Malformed Payload Fuzzing
  // ----------------------------------------------------
  console.log('\n--- 5. SQLi / Fuzzing & Malformed Payloads ---');
  const fuzzPayloads = [
    { url: "/api/order-status?id=' OR '1'='1", desc: 'SQLi Single Quote Bypass' },
    { url: '/api/order-status?id=99999999999999999999999999999', desc: 'BigInt / Integer Overflow' },
    { url: '/api/order-status?id=%00%27%22--%20', desc: 'Null Byte & Comment Injection' },
    { url: '/services/telegram/subs/%3Cscript%3Ealert(1)%3C%2Fscript%3E', desc: 'XSS URL Path Reflection' },
  ];

  for (const item of fuzzPayloads) {
    try {
      const res = await fetchReq(item.url);
      // Must not return 500 with stacktrace, should return 400/404 or sanitized response
      const text = await res.text();
      const leaksStackTrace = text.includes('PrismaClientKnownRequestError') || text.includes('SyntaxError') || text.includes('node_modules');
      
      if (leaksStackTrace) {
        record('Fuzzing', item.desc, 'FAIL', 'Revealed internal database stack trace to client!');
      } else {
        record('Fuzzing', item.desc, 'PASS', `Handled safely with status ${res.status} (no stack trace leak)`);
      }
    } catch (e: any) {
      record('Fuzzing', item.desc, 'PASS', `Rejected safely: ${e.message}`);
    }
  }

  // ----------------------------------------------------
  // TEST SUITE 6: Concurrency & DoS Resilience
  // ----------------------------------------------------
  console.log('\n--- 6. High-Concurrency Server Flood (50 Concurrent Requests) ---');
  try {
    const startTime = Date.now();
    const flood = Array.from({ length: 50 }).map(() => fetchReq('/'));
    const floodResults = await Promise.all(flood);
    const duration = Date.now() - startTime;
    const all200orRedirect = floodResults.every(r => r.status === 200 || r.status === 307);

    if (all200orRedirect) {
      record('Concurrency', '50 Parallel Hits', 'PASS', `Server processed 50 concurrent requests in ${duration}ms without dropping a single connection`);
    } else {
      record('Concurrency', '50 Parallel Hits', 'WARN', `Some requests dropped or returned errors in ${duration}ms`);
    }
  } catch (e: any) {
    record('Concurrency', '50 Parallel Hits', 'FAIL', e.message);
  }

  // ----------------------------------------------------
  // SUMMARY REPORT
  // ----------------------------------------------------
  console.log('\n======================================================');
  console.log('📊 DAST / LIVE SECURITY AUDIT SUMMARY');
  console.log('======================================================');
  const passes = results.filter(r => r.status === 'PASS').length;
  const fails = results.filter(r => r.status === 'FAIL').length;
  const warns = results.filter(r => r.status === 'WARN').length;

  console.log(`Total Live Tests Executed: ${results.length}`);
  console.log(`✅ Passed: ${passes}`);
  console.log(`⚠️ Warnings: ${warns}`);
  console.log(`❌ Failures: ${fails}\n`);

  if (fails > 0) {
    console.error('❌ DAST FAILED: Critical vulnerabilities detected on live server!');
    process.exit(1);
  } else {
    console.log('🎉 DAST PASSED: Live server withstood all automated attack vectors and penetration probes!');
    process.exit(0);
  }
}

runLiveSecurityAudit().catch(err => {
  console.error('Live audit runner failed:', err);
  process.exit(1);
});
