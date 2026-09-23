import { db } from '../src/lib/db';
import { VaultService } from '../src/lib/vault';

async function main() {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;

  if (!shopId || !secretKey) {
    console.error("YOOKASSA_SHOP_ID or YOOKASSA_SECRET_KEY not found in .env");
    return;
  }

  const settings = await db.systemSettings.findFirst();
  if (!settings) {
    console.error("No SystemSettings record found in DB!");
    return;
  }

  const encryptedSecret = VaultService.encrypt(secretKey);

  await db.systemSettings.update({
    where: { id: settings.id },
    data: {
      yookassaShopId: shopId,
      yookassaSecretKey: encryptedSecret,
      // Also populate test settings just in case
      yookassaTestShopId: shopId,
      yookassaTestSecretKey: encryptedSecret
    }
  });

  console.log("Successfully synced YooKassa payment settings from .env to DB!");
  console.log(`Shop ID in DB: ${shopId}`);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
