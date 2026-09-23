import * as dotenv from 'dotenv';
dotenv.config();

import { SettingsManager } from '../src/lib/settings';
import { UnifiedPaymentService } from '../src/services/financial/unified-payment.service';
import { db } from '../src/lib/db';

async function main() {
  console.log('=== 1. DIAGNOSE PAYMENT GATEWAY SETTINGS ===');
  const secrets = await SettingsManager.getPaymentSecrets();
  console.log({
    yookassaShopId: secrets.yookassaShopId,
    yookassaSecretKeyLength: secrets.yookassaSecretKey?.length || 0,
    yookassaSecretKeyPrefix: secrets.yookassaSecretKey?.substring(0, 10),
    cryptobotApiTokenLength: secrets.cryptobotApiToken?.length || 0,
  });

  console.log('=== 2. FIND OR CREATE TEST USER ===');
  let user = await db.user.findFirst({
    where: { telegramId: { not: null } }
  });
  if (!user) {
    user = await db.user.findFirst();
  }
  console.log('User:', { id: user?.id, email: user?.email, telegramId: user?.telegramId, balance: user?.balance?.toString() });

  if (!user) {
    console.error('No users found in database!');
    return;
  }

  console.log('=== 3. TEST YOOKASSA PAYMENT CREATION ===');
  try {
    const yooRes = await UnifiedPaymentService.createPayment(
      undefined,
      user.id,
      100,
      'Пополнение баланса SMMplan (Тест)',
      { source: 'DIAGNOSTIC_SCRIPT' },
      'yookassa'
    );
    console.log('YooKassa Result:', JSON.stringify(yooRes, null, 2));
  } catch (err: any) {
    console.error('YooKassa Error:', err);
  }

  console.log('=== 4. TEST CRYPTOBOT PAYMENT CREATION ===');
  try {
    const cryptoRes = await UnifiedPaymentService.createPayment(
      undefined,
      user.id,
      100,
      'Пополнение баланса SMMplan (Crypto Test)',
      { source: 'DIAGNOSTIC_SCRIPT' },
      'cryptobot'
    );
    console.log('CryptoBot Result:', JSON.stringify(cryptoRes, null, 2));
  } catch (err: any) {
    console.error('CryptoBot Error:', err);
  }
}

main().catch(console.error).finally(() => db.$disconnect());
