import { db } from './src/lib/db';

async function main() {
  const shopId = process.env.YOOKASSA_SHOP_ID || '';
  const secretKey = process.env.YOOKASSA_SECRET_KEY || '';

  if (!shopId || !secretKey) {
    throw new Error('[seed-yookassa-db] YOOKASSA_SHOP_ID and YOOKASSA_SECRET_KEY env vars are required');
  }

  console.log('Seeding YooKassa secrets into database SystemSettings for smmplan & flux...');

  const settings = await db.systemSettings.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      yookassaShopId: shopId,
      yookassaSecretKey: secretKey,
      yookassaTestShopId: shopId,
      yookassaTestSecretKey: secretKey,
    },
    update: {
      yookassaShopId: shopId,
      yookassaSecretKey: secretKey,
      yookassaTestShopId: shopId,
      yookassaTestSecretKey: secretKey,
    },
  });

  console.log('✅ Updated SystemSettings with YooKassa credentials:', {
    shopId: settings.yookassaShopId,
    secretKeySet: Boolean(settings.yookassaSecretKey),
  });

  // Verify Provider
  const providers = await db.provider.findMany({ select: { id: true, name: true, apiUrl: true, isEnabled: true } });
  console.log('✅ Active Providers in Database:', providers);
}

main()
  .catch((e) => {
    console.error('Error seeding YooKassa secrets:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
