import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- System Settings ---');
  const settings = await prisma.systemSettings.findMany();
  console.log(JSON.stringify(settings, null, 2));

  console.log('--- Providers ---');
  const providers = await prisma.provider.findMany();
  console.log(JSON.stringify(providers, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
