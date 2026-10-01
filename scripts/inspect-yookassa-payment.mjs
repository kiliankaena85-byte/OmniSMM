import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const settings = await prisma.systemSettings.findUnique({
    where: { id: 'flux' }
  });
  if (!settings) {
    console.error('No flux settings');
    return;
  }
  // Decrypt secret key
  const { decryptAesGcm } = await import('./src/lib/encryption.ts').catch(async () => {
    return await import('../src/lib/encryption.ts');
  });

  // Let's inspect using app's YooKassaService or direct fetch
  console.log('Shop ID:', settings.yookassaShopId);
  // Get decrypted key
  const secretKey = decryptAesGcm(settings.yookassaSecretKey);
  const authHeader = 'Basic ' + Buffer.from(`${settings.yookassaShopId}:${secretKey}`).toString('base64');

  const res = await fetch('https://api.yookassa.ru/v3/payments/324fd325-000f-5001-9000-13f527e02040', {
    headers: {
      Authorization: authHeader
    }
  });

  const data = await res.json();
  console.log('YOOKASSA PAYMENT DATA:');
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
