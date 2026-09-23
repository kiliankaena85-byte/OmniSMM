import { SettingsManager } from '../src/lib/settings';

async function testYooKassaAuth() {
  console.log('Testing YooKassa connectivity with provided credentials...');
  const shopId = process.env.YOOKASSA_SHOP_ID || '';
  const secretKey = process.env.YOOKASSA_SECRET_KEY || process.env.YOOKASSA_TEST_SECRET_KEY || '';
  const authHeader = 'Basic ' + Buffer.from(`${shopId}:${secretKey}`).toString('base64');

  const idempotencyKey = 'test_verify_' + Date.now();
  const payload = {
    amount: {
      value: '10.00',
      currency: 'RUB'
    },
    confirmation: {
      type: 'redirect',
      return_url: 'https://smmplan.pro/dashboard/orders'
    },
    description: 'Test Verification Order 2026',
    capture: true
  };

  try {
    const res = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Idempotence-Key': idempotencyKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    console.log('YooKassa API HTTP Status:', res.status);
    if (res.ok) {
      console.log('✅ YooKassa Test Payment created successfully!');
      console.log('Payment ID:', data.id);
      console.log('Status:', data.status);
      console.log('Confirmation URL:', data.confirmation?.confirmation_url);
    } else {
      console.error('❌ YooKassa API Error response:', data);
    }
  } catch (err) {
    console.error('❌ Network error during YooKassa call:', err);
  }
}

testYooKassaAuth().then(() => process.exit(0));