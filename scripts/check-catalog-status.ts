import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkCatalog() {
  const providers = await prisma.provider.findMany();
  const networks = await prisma.network.findMany();
  const categories = await prisma.category.findMany();
  const services = await prisma.service.findMany({ take: 5 });
  const totalServices = await prisma.service.count();

  console.log(`Провайдеров в БД: ${providers.length}`);
  providers.forEach(p => console.log(` - [${p.id}] ${p.name} (${p.apiUrl})`));

  console.log(`\nСоцсетей (Networks) в БД: ${networks.length}`);
  console.log(`Категорий (Categories) в БД: ${categories.length}`);
  console.log(`Всего услуг (Services) в БД: ${totalServices}`);
}

checkCatalog().catch(console.error).finally(() => prisma.$disconnect());
