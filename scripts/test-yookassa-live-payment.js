const https = require('https');

async function testYooKassa() {
  const shopId = process.env.YOOKASSA_SHOP_ID || '';
  const secretKey = process.env.YOOKASSA_SECRET_KEY || process.env.YOOKASSA_TEST_SECRET_KEY || '';
  const auth = 'Basic ' + Buffer.from(shopId + ':' + secretKey).toString('base64');
  const payload = JSON.stringify({
    amount: { value: '10.00', currency: 'RUB' },
    confirmation: { type: 'redirect', return_url: 'https://smmplan.pro/dashboard/orders' },
    description: 'Test Verification Order 2026',
    capture: true
  });

  const agent = new https.Agent({
    // Минцифры root CA cert handling in dev environment
    rejectUnauthorized: false
  });

  const req = https.request({
    hostname: 'api.yookassa.ru',
    port: 443,
    path: '/v3/payments',
    method: 'POST',
    agent,
    headers: {
      'Authorization': auth,
      'Idempotence-Key': 'verify_' + Date.now(),
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  }, (res) => {
    let raw = '';
    res.on('data', chunk => raw += chunk);
    res.on('end', () => {
      console.log('HTTP STATUS:', res.statusCode);
      try {
        const json = JSON.parse(raw);
        console.log('RESPONSE:', JSON.stringify(json, null, 2));
      } catch {
        console.log('RAW RESPONSE:', raw);
      }
    });
  });

  req.on('error', err => console.error('REQUEST ERROR:', err));
  req.write(payload);
  req.end();
}

testYooKassa();