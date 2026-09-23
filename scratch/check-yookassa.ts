import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const s = await prisma.systemSettings.findUnique({ where: { id: 'global' } });
  console.log('--- Yookassa Config Check ---');
  if (!s) {
    console.log('No global SystemSettings found.');
    return;
  }
  console.log('yookassaShopId:', s.yookassaShopId);
  console.log('yookassaTestShopId:', s.yookassaTestShopId);
  console.log('yookassaSecretKey defined?', !!s.yookassaSecretKey && s.yookassaSecretKey !== 'placeholder');
  console.log('yookassaTestSecretKey defined?', !!s.yookassaTestSecretKey && s.yookassaTestSecretKey !== 'placeholder');
  console.log('isTestMode:', s.isTestMode);
}

main().catch(console.error).finally(() => prisma.$disconnect());
