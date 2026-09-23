import { db } from '../src/lib/db';
import { VaultService } from '../src/lib/vault';

async function main() {
  console.log('--- YooKassa Settings Configuration Script ---');
  
  const testShopId = process.env.YOOKASSA_TEST_SHOP_ID || '1155075';
  const testSecretKey = process.env.YOOKASSA_TEST_SECRET_KEY || 'test_mock_secret_key';
  
  console.log(`Configuring test credentials: Shop ID = ${testShopId}`);
  
  const encryptedSecret = VaultService.encrypt(testSecretKey);
  
  const settings = await db.systemSettings.upsert({
    where: { id: 'global' },
    update: {
      isTestMode: true,
      yookassaTestShopId: testShopId,
      yookassaTestSecretKey: encryptedSecret,
    },
    create: {
      id: 'global',
      isTestMode: true,
      taxRate: 6.0,
      opexMonthly: 0,
      maintenanceMode: false,
      siteName: 'Smmplan Lite',
      siteDescription: '',
      exchangeRateUSD: 95.0,
      yookassaTestShopId: testShopId,
      yookassaTestSecretKey: encryptedSecret,
    },
  });

  console.log('Database updated successfully!');
  console.log('Resulting Settings in DB:');
  console.log({
    id: settings.id,
    isTestMode: settings.isTestMode,
    yookassaTestShopId: settings.yookassaTestShopId,
    yookassaTestSecretKey: settings.yookassaTestSecretKey ? '•••••••• (Encrypted)' : 'null',
  });
}

main()
  .catch((e) => {
    console.error('Error updating YooKassa settings:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
