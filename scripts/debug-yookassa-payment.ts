import * as dotenv from 'dotenv';
dotenv.config();
import { SettingsManager } from '@/lib/settings';
import { db } from '@/lib/db';
import { PaymentGatewayFactory } from '@/services/financial/payment-gateway.service';

async function main() {
  console.log('=== YOOKASSA LIVE PAYMENT TEST ===');
  const secrets = await SettingsManager.getPaymentSecrets();
  console.log('shopId:', secrets.yookassaShopId);
  console.log('secretKey length:', secrets.yookassaSecretKey ? secrets.yookassaSecretKey.length : 0);
  console.log('secretKey prefix:', secrets.yookassaSecretKey ? secrets.yookassaSecretKey.slice(0, 15) : 'none');

  const yookassa = PaymentGatewayFactory.getGateway('yookassa');
  
  // Try creating a 10.00 RUB test payment directly
  try {
    const res = await yookassa.createPayment({
      paymentId: 'test_dbg_' + Date.now(),
      userId: 'test_user_debug',
      amountRub: 10.0,
      email: 'test@smmplan.pro',
      successUrl: 'https://test.smmplan.pro/success',
      description: 'Тестовый платеж ЮKassa E2E',
      isTestMode: false,
    });
    console.log('Payment created successfully!');
    console.log('Remote Gateway ID:', res.remoteGatewayId);
    console.log('Payment URL:', res.paymentUrl);
  } catch (err: any) {
    console.error('YooKassa createPayment FAILED:');
    console.error('Error message:', err.message);
  }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
