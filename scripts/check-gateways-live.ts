import { db } from '../src/lib/db';
import { SettingsProvider } from '../src/lib/settings';

async function checkGatewaysDirectly() {
  console.log('--- GATEWAYS DIAGNOSTICS ---');
  const secrets = await SettingsProvider.getPaymentSecrets();
  
  console.log('1. YooKassa Config:');
  console.log('   Shop ID:', secrets.yookassaShopId ? `${secrets.yookassaShopId.slice(0, 3)}***` : 'None');
  console.log('   Secret Key:', secrets.yookassaSecretKey ? `${secrets.yookassaSecretKey.slice(0, 4)}***` : 'None');
  
  console.log('2. CryptoBot Config:');
  console.log('   Token:', secrets.cryptoBotToken ? `${secrets.cryptoBotToken.slice(0, 4)}***` : 'None');

  console.log('3. Robokassa Config:');
  console.log('   Login:', secrets.robokassaLogin || 'None');
  
  // Test CryptoBot API getMe
  if (secrets.cryptoBotToken && !secrets.cryptoBotToken.startsWith('test_')) {
    try {
      const resp = await fetch('https://pay.crypt.bot/api/getMe', {
        headers: { 'Crypto-Pay-API-Token': secrets.cryptoBotToken },
        signal: AbortSignal.timeout(10000)
      });
      const data = await resp.json();
      console.log('CryptoBot API getMe Response:', data);
    } catch (e: any) {
      console.log('CryptoBot connection error:', e.message);
    }
  }

  // Test YooKassa API get /me or test payment
  if (secrets.yookassaShopId && secrets.yookassaSecretKey && !secrets.yookassaShopId.startsWith('test_')) {
    try {
      const authHeader = 'Basic ' + Buffer.from(`${secrets.yookassaShopId}:${secrets.yookassaSecretKey}`).toString('base64');
      const resp = await fetch('https://api.yookassa.ru/v3/me', {
        headers: { 'Authorization': authHeader },
        signal: AbortSignal.timeout(10000)
      });
      const data = await resp.json();
      console.log('YooKassa API /me Response:', resp.status, data);
    } catch (e: any) {
      console.log('YooKassa connection error:', e.message);
    }
  }
}

checkGatewaysDirectly()
  .catch(console.error)
  .finally(() => db.$disconnect());
