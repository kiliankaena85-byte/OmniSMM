import { db } from '../src/lib/db';
import { VaultService } from '../src/lib/vault';

async function main() {
  console.log('--- YooKassa Remote Settings Check ---');
  const settings = await db.systemSettings.findFirst();
  if (!settings) {
    console.error('No SystemSettings found in DB.');
    return;
  }
  
  console.log('Settings metadata:');
  console.log(`- isTestMode: ${settings.isTestMode}`);
  console.log(`- yookassaShopId: ${settings.yookassaShopId}`);
  console.log(`- yookassaTestShopId: ${settings.yookassaTestShopId}`);
  
  // Try decrypting keys if they exist
  try {
    if (settings.yookassaSecretKey) {
      const decrypted = VaultService.decrypt(settings.yookassaSecretKey);
      console.log(`- yookassaSecretKey: Decrypted successfully, length: ${decrypted.length}, prefix: ${decrypted.substring(0, 5)}...`);
    } else {
      console.log('- yookassaSecretKey: null');
    }
  } catch (e: any) {
    console.error(`- yookassaSecretKey Decryption failed: ${e.message}`);
  }

  try {
    if (settings.yookassaTestSecretKey) {
      const decrypted = VaultService.decrypt(settings.yookassaTestSecretKey);
      console.log(`- yookassaTestSecretKey: Decrypted successfully, length: ${decrypted.length}, prefix: ${decrypted.substring(0, 5)}...`);
    } else {
      console.log('- yookassaTestSecretKey: null');
    }
  } catch (e: any) {
    console.error(`- yookassaTestSecretKey Decryption failed: ${e.message}`);
  }
}

main().finally(async () => {
  await db.$disconnect();
});
