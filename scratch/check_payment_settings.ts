import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const settings = await prisma.systemSettings.findFirst();
  console.log('--- SystemSettings ---');
  if (!settings) {
    console.log('No settings found!');
  } else {
    console.log({
      isTestMode: settings.isTestMode,
      yookassaShopId: settings.yookassaShopId,
      yookassaSecretKey: settings.yookassaSecretKey ? '***PRESENT***' : null,
      yookassaTestShopId: settings.yookassaTestShopId,
      yookassaTestSecretKey: settings.yookassaTestSecretKey ? '***PRESENT***' : null,
      cryptoBotToken: settings.cryptoBotToken ? '***PRESENT***' : null,
      robokassaLogin: settings.robokassaLogin,
      robokassaPassword: settings.robokassaPassword ? '***PRESENT***' : null,
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
